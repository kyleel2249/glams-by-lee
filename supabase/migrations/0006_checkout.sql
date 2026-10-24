-- GLAMS BY LEE — 0006 checkout
-- place_order() creates an order, its item snapshots, stock reservations and discount redemption in ONE transaction.
-- If anything fails (e.g. stock runs out), nothing is written. Service role only.

alter table payments add column if not exists authorization_url text;

insert into admin_settings (key, value, is_public) values
 ('tax_rate_bps', '0', false),          -- tax in basis points on (subtotal - discount); 0 until your accountant confirms
 ('checkout_enabled', 'true', true)
on conflict (key) do nothing;

create or replace function place_order(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_key text := nullif(p_order->>'idempotency_key','');
  v_currency char(3) := (p_order->>'currency');
  v_sum bigint := 0; it record; v_var record; v_img text;
  v_code uuid := nullif(p_order->>'discount_code_id','')::uuid; d discount_codes%rowtype;
  v_email text := lower(p_order->>'email');
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Order has no items'; end if;

  if v_key is not null then
    select id into v_id from orders where idempotency_key = v_key;
    if found then return jsonb_build_object('order_id', v_id, 'is_new', false); end if;
  end if;

  -- validate every line against live catalogue data (prices cannot drift between pricing and placing)
  for it in select (e->>'variant_id')::uuid as variant_id, (e->>'quantity')::int as qty, (e->>'unit_price_minor')::bigint as price
            from jsonb_array_elements(p_items) e loop
    select v.id, v.price_minor, v.currency, v.is_active, p.is_published into v_var
      from product_variants v join products p on p.id = v.product_id where v.id = it.variant_id;
    if not found or not v_var.is_active or not v_var.is_published then
      raise exception 'Item no longer available' using errcode = 'P0002';
    end if;
    if v_var.price_minor <> it.price or v_var.currency <> v_currency then
      raise exception 'Price changed' using errcode = 'P0003';
    end if;
    if it.qty < 1 or it.qty > 20 then raise exception 'Invalid quantity'; end if;
    v_sum := v_sum + it.price * it.qty;
  end loop;
  if v_sum <> (p_order->>'subtotal_minor')::bigint then raise exception 'Subtotal mismatch' using errcode = 'P0003'; end if;

  begin
    insert into orders(user_id, email, phone, currency, subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor,
                       discount_code_id, shipping_rate_id, shipping_method_name, shipping_address, billing_address, idempotency_key, customer_note, guest_email)
    values (nullif(p_order->>'user_id','')::uuid, v_email, p_order->>'phone', v_currency,
            (p_order->>'subtotal_minor')::bigint, (p_order->>'discount_minor')::bigint, (p_order->>'shipping_minor')::bigint,
            (p_order->>'tax_minor')::bigint, (p_order->>'total_minor')::bigint, v_code, nullif(p_order->>'shipping_rate_id','')::uuid,
            p_order->>'shipping_method_name', p_order->'shipping_address', p_order->'billing_address', v_key, p_order->>'customer_note',
            case when nullif(p_order->>'user_id','') is null then v_email end)
    returning id into v_id;
  exception when unique_violation then
    -- two identical submissions raced: return the winner
    select id into v_id from orders where idempotency_key = v_key;
    if found then return jsonb_build_object('order_id', v_id, 'is_new', false); end if;
    raise;
  end;

  -- snapshots, then reserve stock in a stable order (variant id) so concurrent orders cannot deadlock
  for it in select (e->>'variant_id')::uuid as variant_id, (e->>'quantity')::int as qty, (e->>'unit_price_minor')::bigint as price
            from jsonb_array_elements(p_items) e order by 1 loop
    select v.sku, v.length_inches, v.color, v.density, v.cap_size, v.product_id, p.name, p.texture, p.construction into v_var
      from product_variants v join products p on p.id = v.product_id where v.id = it.variant_id;
    select url into v_img from product_images where product_id = v_var.product_id order by sort_order limit 1;
    insert into order_items(order_id, variant_id, product_id, product_name, variant_sku, variant_attributes, image_url, unit_price_minor, quantity, line_total_minor)
    values (v_id, it.variant_id, v_var.product_id, v_var.name, v_var.sku,
            jsonb_strip_nulls(jsonb_build_object('length_inches', v_var.length_inches, 'color', v_var.color, 'density', v_var.density,
                                                 'cap_size', v_var.cap_size, 'texture', v_var.texture, 'construction', v_var.construction)),
            v_img, it.price, it.qty, it.price * it.qty);
    perform reserve_stock(it.variant_id, it.qty, v_id);
  end loop;

  if v_code is not null then
    select * into d from discount_codes where id = v_code for update;
    if not found or not d.is_active or (d.starts_at is not null and d.starts_at > now()) or (d.expires_at is not null and d.expires_at < now()) then
      raise exception 'Discount code is not valid' using errcode = 'P0004';
    end if;
    if d.usage_limit is not null and (select count(*) from discount_redemptions where discount_code_id = d.id) >= d.usage_limit then
      raise exception 'Discount code has been fully used' using errcode = 'P0004';
    end if;
    if d.per_customer_limit is not null and (select count(*) from discount_redemptions where discount_code_id = d.id and email = v_email) >= d.per_customer_limit then
      raise exception 'You have already used this discount code' using errcode = 'P0004';
    end if;
    insert into discount_redemptions(discount_code_id, order_id, user_id, email, amount_minor)
    values (d.id, v_id, nullif(p_order->>'user_id','')::uuid, v_email, (p_order->>'discount_minor')::bigint);
  end if;

  return jsonb_build_object('order_id', v_id, 'is_new', true);
end $$;

-- A cancelled/expired order frees its discount redemption so the code is not burned by an unpaid order.
create or replace function cancel_unpaid_order(p_order uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare ord orders%rowtype; item record;
begin
  select * into ord from orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if ord.status not in ('pending_payment','payment_processing','payment_failed') then
    raise exception 'Only unpaid orders can be cancelled here (status: %)', ord.status;
  end if;
  for item in select variant_id, quantity from order_items where order_id = ord.id and variant_id is not null order by variant_id loop
    perform release_stock(item.variant_id, item.quantity, ord.id, 'Released after cancellation', p_actor);
  end loop;
  delete from discount_redemptions where order_id = ord.id;
  update orders set status = 'cancelled' where id = ord.id;
end $$;

revoke all on function place_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function place_order(jsonb, jsonb) to service_role;
