-- GLAMS BY LEE — 0002 business functions
-- These run server-side only (service_role). They are revoked from anon/authenticated in 0003.

-- ---------- role helpers ----------
create or replace function has_any_role(roles staff_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur
    where ur.user_id = auth.uid() and (ur.role = any(roles) or ur.role = 'owner')
  );
$$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = 'owner');
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid());
$$;

-- ---------- order numbers ----------
create or replace function generate_order_number() returns text
language sql as $$
  select 'GBL-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('order_number_seq')::text, 6, '0');
$$;

create or replace function orders_set_number() returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := generate_order_number();
  end if;
  return new;
end $$;
-- BEFORE triggers run ahead of NOT NULL checks, so the column stays NOT NULL.
create trigger orders_set_number before insert on orders for each row execute function orders_set_number();

-- ---------- validated order status transitions ----------
create or replace function is_valid_order_transition(from_s order_status, to_s order_status) returns boolean
language sql immutable as $$
  select case from_s
    when 'pending_payment'     then to_s in ('payment_processing','paid','payment_failed','cancelled')
    when 'payment_processing'  then to_s in ('paid','payment_failed','cancelled')
    when 'payment_failed'      then to_s in ('payment_processing','paid','cancelled')
    when 'paid'                then to_s in ('processing','cancelled','refund_pending')
    when 'processing'          then to_s in ('ready_for_dispatch','cancelled','refund_pending')
    when 'ready_for_dispatch'  then to_s in ('shipped','cancelled','refund_pending')
    when 'shipped'             then to_s in ('delivered','refund_pending')
    when 'delivered'           then to_s in ('refund_pending')
    when 'refund_pending'      then to_s in ('partially_refunded','refunded','paid','processing','delivered')
    when 'partially_refunded'  then to_s in ('refund_pending','refunded')
    else false                 -- cancelled, refunded are terminal
  end;
$$;

create or replace function orders_enforce_status() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if not is_valid_order_transition(old.status, new.status) then
      raise exception 'Invalid order status transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;
    if new.status = 'paid' and new.paid_at is null then new.paid_at := now(); end if;
    if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
    insert into order_status_history(order_id, from_status, to_status, actor_id)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;
create trigger orders_enforce_status before update on orders for each row execute function orders_enforce_status();

create or replace function orders_log_initial_status() returns trigger language plpgsql as $$
begin
  insert into order_status_history(order_id, from_status, to_status, actor_id)
  values (new.id, null, new.status, auth.uid());
  return new;
end $$;
create trigger orders_log_initial_status after insert on orders for each row execute function orders_log_initial_status();

-- ---------- inventory (concurrency-safe) ----------
-- Every function takes a row lock via a single atomic UPDATE, so two buyers can never both take the last unit.

create or replace function reserve_stock(p_variant uuid, p_qty int, p_order uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_backorder boolean; v_rows int;
begin
  if p_qty <= 0 then raise exception 'Quantity must be positive'; end if;
  select allow_backorder into v_backorder from product_variants where id = p_variant and is_active;
  if not found then raise exception 'Variant % unavailable', p_variant using errcode = 'P0002'; end if;

  update inventory
     set reserved = reserved + p_qty
   where variant_id = p_variant
     and (v_backorder or on_hand - reserved >= p_qty);
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Insufficient stock for variant %', p_variant using errcode = 'P0001';
  end if;

  insert into inventory_movements(variant_id, movement_type, quantity_delta, reason, order_id, actor_id)
  values (p_variant, 'reserved', p_qty, 'Reserved for order', p_order, p_actor);
end $$;

create or replace function release_stock(p_variant uuid, p_qty int, p_order uuid, p_reason text default 'Released after cancellation', p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  update inventory set reserved = reserved - p_qty where variant_id = p_variant and reserved >= p_qty;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Cannot release % units for variant %', p_qty, p_variant using errcode = 'P0001'; end if;
  insert into inventory_movements(variant_id, movement_type, quantity_delta, reason, order_id, actor_id)
  values (p_variant, 'released', -p_qty, p_reason, p_order, p_actor);
end $$;

-- Called once payment is verified: converts reservation into a sale.
create or replace function commit_stock(p_variant uuid, p_qty int, p_order uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  update inventory
     set reserved = reserved - p_qty,
         on_hand  = greatest(on_hand - p_qty, 0)
   where variant_id = p_variant and reserved >= p_qty;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Cannot commit % units for variant %', p_qty, p_variant using errcode = 'P0001'; end if;
  insert into inventory_movements(variant_id, movement_type, quantity_delta, reason, order_id, actor_id)
  values (p_variant, 'sold', -p_qty, 'Sold', p_order, p_actor);
end $$;

-- Manual changes by staff (receive, adjust, damage, return). Reason is mandatory for audit.
create or replace function adjust_stock(p_variant uuid, p_delta int, p_type inventory_movement_type, p_reason text, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  if p_type in ('reserved','released','sold') then raise exception 'Use the order functions for % movements', p_type; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'A reason is required'; end if;
  if p_actor is null then raise exception 'An actor is required'; end if;
  if p_delta = 0 then raise exception 'Delta must be non-zero'; end if;

  insert into inventory(variant_id, on_hand) values (p_variant, 0) on conflict (variant_id) do nothing;
  update inventory set on_hand = on_hand + p_delta where variant_id = p_variant and on_hand + p_delta >= reserved;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Adjustment would drop stock below reserved units' using errcode = 'P0001'; end if;

  insert into inventory_movements(variant_id, movement_type, quantity_delta, reason, actor_id)
  values (p_variant, p_type, p_delta, p_reason, p_actor);
end $$;

-- Every new variant gets an inventory row.
create or replace function variants_create_inventory() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into inventory(variant_id) values (new.id) on conflict do nothing; return new; end $$;
create trigger variants_create_inventory after insert on product_variants for each row execute function variants_create_inventory();

-- ---------- payments ----------
-- Marks an order paid ONLY if the verified amount and currency match the order total.
-- Idempotent: calling twice for an already-paid order is a no-op.
create or replace function apply_verified_payment(
  p_payment_reference text, p_provider_txn text, p_amount_minor bigint, p_currency char(3), p_channel text default null
) returns text language plpgsql security definer set search_path = public as $$
declare pay payments%rowtype; ord orders%rowtype; item record;
begin
  select * into pay from payments where reference = p_payment_reference for update;
  if not found then return 'unknown_reference'; end if;
  select * into ord from orders where id = pay.order_id for update;

  if pay.status = 'succeeded' then return 'already_processed'; end if;

  if p_amount_minor <> ord.total_minor or p_currency <> ord.currency then
    update payments set status='failed', failure_reason='Amount or currency mismatch',
           verified_amount_minor=p_amount_minor, verified_currency=p_currency, verified_at=now()
     where id = pay.id;
    return 'mismatch';
  end if;

  update payments set status='succeeded', provider_transaction_id=p_provider_txn, channel=p_channel,
         verified_amount_minor=p_amount_minor, verified_currency=p_currency, verified_at=now()
   where id = pay.id;

  if ord.status in ('pending_payment','payment_processing','payment_failed') then
    for item in select variant_id, quantity from order_items where order_id = ord.id and variant_id is not null loop
      perform commit_stock(item.variant_id, item.quantity, ord.id);
    end loop;
    update orders set status = 'paid' where id = ord.id;
  end if;
  return 'paid';
end $$;

-- Cancel an unpaid order and release its reservations.
create or replace function cancel_unpaid_order(p_order uuid, p_actor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare ord orders%rowtype; item record;
begin
  select * into ord from orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if ord.status not in ('pending_payment','payment_processing','payment_failed') then
    raise exception 'Only unpaid orders can be cancelled here (status: %)', ord.status;
  end if;
  for item in select variant_id, quantity from order_items where order_id = ord.id and variant_id is not null loop
    perform release_stock(item.variant_id, item.quantity, ord.id, 'Released after cancellation', p_actor);
  end loop;
  update orders set status = 'cancelled' where id = ord.id;
end $$;

-- ---------- reviews ----------
create or replace function reviews_set_verified() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.is_verified_purchase := exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
    where oi.product_id = new.product_id and o.user_id = new.user_id
      and o.status in ('paid','processing','ready_for_dispatch','shipped','delivered')
  );
  new.status := 'pending';  -- always starts in moderation
  return new;
end $$;
create trigger reviews_set_verified before insert on reviews for each row execute function reviews_set_verified();

-- ---------- profile bootstrap ----------
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, full_name) values (new.id, new.raw_user_meta_data->>'full_name') on conflict do nothing;
  return new;
end $$;
-- Trigger on auth.users is created in 0003 (needs the Supabase auth schema).

-- ---------- public availability view (hides exact stock counts) ----------
create view public_variant_availability as
select v.id as variant_id, v.product_id,
       case when v.allow_backorder then 'backorder'
            when i.on_hand - i.reserved <= 0 then 'out_of_stock'
            when i.on_hand - i.reserved <= v.low_stock_threshold then 'low_stock'
            else 'in_stock' end as availability
from product_variants v
join products p on p.id = v.product_id and p.is_published
left join inventory i on i.variant_id = v.id
where v.is_active;
