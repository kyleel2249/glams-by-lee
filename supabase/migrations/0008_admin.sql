-- GLAMS BY LEE — 0008 admin back-office rules
-- All functions are service_role only. The app authorises the staff member first, then passes their id as p_actor.

-- 1) Record WHO changed an order. Service-role calls have no auth.uid(), so admin functions set a transaction-local actor.
create or replace function orders_enforce_status() returns trigger language plpgsql as $$
declare v_actor uuid := coalesce(auth.uid(), nullif(current_setting('app.actor', true), '')::uuid);
begin
  if new.status is distinct from old.status then
    if not is_valid_order_transition(old.status, new.status) then
      raise exception 'Invalid order status transition: % -> %', old.status, new.status using errcode = '23514';
    end if;
    if new.status = 'paid' and new.paid_at is null then new.paid_at := now(); end if;
    if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
    insert into order_status_history(order_id, from_status, to_status, actor_id) values (new.id, old.status, new.status, v_actor);
  end if;
  return new;
end $$;

-- A declined refund must be able to return the order to where it was (shipped / ready_for_dispatch were missing).
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
    when 'refund_pending'      then to_s in ('partially_refunded','refunded','paid','processing','ready_for_dispatch','shipped','delivered')
    when 'partially_refunded'  then to_s in ('refund_pending','refunded')
    else false
  end;
$$;

-- 2) Staff-driven status changes. Payment states are system-controlled and refunds have their own functions.
create or replace function admin_set_order_status(p_order uuid, p_to order_status, p_actor uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare ord orders%rowtype;
begin
  if p_actor is null then raise exception 'An actor is required'; end if;
  perform set_config('app.actor', p_actor::text, true);
  if p_to in ('paid','payment_processing','payment_failed') then raise exception 'Payment status is set by verified payments only' using errcode = 'P0005'; end if;
  if p_to in ('refund_pending','partially_refunded','refunded') then raise exception 'Use the refund workflow' using errcode = 'P0006'; end if;
  select * into ord from orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if p_to = 'cancelled' then
    if ord.status in ('pending_payment','payment_processing','payment_failed') then perform cancel_unpaid_order(p_order, p_actor);
    else raise exception 'Paid orders are refunded, not cancelled' using errcode = 'P0006'; end if;
  else
    update orders set status = p_to where id = p_order;
  end if;
  if p_note is not null and length(trim(p_note)) > 0 then
    update order_status_history set note = left(p_note, 500) where id = (select max(id) from order_status_history where order_id = p_order);
  end if;
  insert into audit_logs(actor_id, action, resource_type, resource_id, metadata)
  values (p_actor, 'order.status_changed', 'order', p_order::text, jsonb_build_object('from', ord.status, 'to', p_to));
end $$;

-- 3) Refund tracking. Money is returned manually in the payment provider's dashboard; these functions keep the books honest.
create or replace function request_refund(p_order uuid, p_amount_minor bigint, p_reason text, p_actor uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare ord orders%rowtype; pay payments%rowtype; v_open bigint; v_id uuid;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into ord from orders where id = p_order for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if ord.status not in ('paid','processing','ready_for_dispatch','shipped','delivered','partially_refunded') then
    raise exception 'This order cannot be refunded in status %', ord.status using errcode = 'P0006';
  end if;
  select * into pay from payments where order_id = p_order and status in ('succeeded','partially_refunded') order by created_at desc limit 1;
  if not found then raise exception 'No successful payment to refund' using errcode = 'P0006'; end if;
  select coalesce(sum(amount_minor),0) into v_open from refunds where order_id = p_order and status in ('requested','processing','completed');
  if p_amount_minor <= 0 or p_amount_minor > ord.total_minor - v_open then
    raise exception 'Refund amount exceeds what is left to refund' using errcode = 'P0006';
  end if;
  insert into refunds(payment_id, order_id, amount_minor, currency, reason, requested_by)
  values (pay.id, p_order, p_amount_minor, ord.currency, left(p_reason, 300), p_actor) returning id into v_id;
  update orders set status = 'refund_pending' where id = p_order;
  insert into audit_logs(actor_id, action, resource_type, resource_id, metadata)
  values (p_actor, 'refund.requested', 'order', p_order::text, jsonb_build_object('refund_id', v_id, 'amount_minor', p_amount_minor));
  return v_id;
end $$;

create or replace function complete_refund(p_refund uuid, p_actor uuid, p_restock boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare r refunds%rowtype; ord orders%rowtype; v_done bigint; it record;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into r from refunds where id = p_refund for update;
  if not found or r.status not in ('requested','processing') then raise exception 'Refund is not open' using errcode = 'P0006'; end if;
  select * into ord from orders where id = r.order_id for update;
  update refunds set status = 'completed' where id = p_refund;
  select coalesce(sum(amount_minor),0) into v_done from refunds where order_id = r.order_id and status = 'completed';
  if v_done >= ord.total_minor then
    update orders set status = 'refunded' where id = r.order_id;
    update payments set status = 'refunded' where id = r.payment_id;
    if p_restock then
      for it in select variant_id, quantity from order_items where order_id = r.order_id and variant_id is not null order by variant_id loop
        perform adjust_stock(it.variant_id, it.quantity, 'returned', 'Returned after full refund', p_actor);
      end loop;
    end if;
  else
    update orders set status = 'partially_refunded' where id = r.order_id;
    update payments set status = 'partially_refunded' where id = r.payment_id;
  end if;
  insert into audit_logs(actor_id, action, resource_type, resource_id, metadata)
  values (p_actor, 'refund.completed', 'order', r.order_id::text, jsonb_build_object('refund_id', p_refund, 'amount_minor', r.amount_minor, 'restocked', p_restock and v_done >= ord.total_minor));
end $$;

create or replace function decline_refund(p_refund uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r refunds%rowtype; v_prev order_status; v_open int;
begin
  perform set_config('app.actor', p_actor::text, true);
  select * into r from refunds where id = p_refund for update;
  if not found or r.status not in ('requested','processing') then raise exception 'Refund is not open' using errcode = 'P0006'; end if;
  update refunds set status = 'failed' where id = p_refund;
  select count(*) into v_open from refunds where order_id = r.order_id and status in ('requested','processing');
  if v_open = 0 then
    select from_status into v_prev from order_status_history where order_id = r.order_id and to_status = 'refund_pending' order by id desc limit 1;
    if v_prev is not null and (select status from orders where id = r.order_id) = 'refund_pending' then update orders set status = v_prev where id = r.order_id; end if;
  end if;
  insert into audit_logs(actor_id, action, resource_type, resource_id, metadata)
  values (p_actor, 'refund.declined', 'order', r.order_id::text, jsonb_build_object('refund_id', p_refund));
end $$;

-- 4) Dashboard figures. Revenue = orders whose payment was VERIFIED in the period (paid_at), gross; refunds completed in the period are
--    reported separately so reports can show net. Unpaid, failed and cancelled orders never count.
create or replace function admin_metrics(p_from timestamptz, p_to timestamptz) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'revenue', coalesce((select jsonb_agg(x) from (select currency, sum(total_minor)::bigint as gross_minor, count(*)::int as orders from orders
        where paid_at >= p_from and paid_at < p_to and status in ('paid','processing','ready_for_dispatch','shipped','delivered','partially_refunded','refund_pending','refunded')
        group by currency) x), '[]'::jsonb),
    'refunded', coalesce((select jsonb_agg(x) from (select currency, sum(amount_minor)::bigint as amount_minor from refunds
        where status = 'completed' and updated_at >= p_from and updated_at < p_to group by currency) x), '[]'::jsonb),
    'orders_total', (select count(*)::int from orders where placed_at >= p_from and placed_at < p_to),
    'unpaid', (select count(*)::int from orders where status in ('pending_payment','payment_processing','payment_failed')),
    'awaiting_dispatch', (select count(*)::int from orders where status in ('paid','processing','ready_for_dispatch')),
    'refunds_open', (select count(*)::int from refunds where status in ('requested','processing')),
    'low_stock', (select count(*)::int from product_variants v join inventory i on i.variant_id = v.id
        where v.is_active and not v.allow_backorder and i.on_hand - i.reserved > 0 and i.on_hand - i.reserved <= v.low_stock_threshold),
    'out_of_stock', (select count(*)::int from product_variants v join inventory i on i.variant_id = v.id
        where v.is_active and not v.allow_backorder and i.on_hand - i.reserved <= 0),
    'payment_exceptions', (select count(*)::int from payments where failure_reason ilike 'Amount or currency mismatch%' or failure_reason ilike '%refund review needed%')
        + (select count(*)::int from payment_events where processing_error is not null and processed_at is null),
    'best_sellers', coalesce((select jsonb_agg(x) from (select oi.product_name, sum(oi.quantity)::int as units from order_items oi join orders o on o.id = oi.order_id
        where o.paid_at >= p_from and o.paid_at < p_to and o.status in ('paid','processing','ready_for_dispatch','shipped','delivered','partially_refunded','refund_pending')
        group by oi.product_name order by units desc, oi.product_name limit 5) x), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(x order by x.day) from (select (paid_at at time zone 'UTC')::date as day, currency, sum(total_minor)::bigint as gross_minor, count(*)::int as orders from orders
        where paid_at >= p_from and paid_at < p_to and status in ('paid','processing','ready_for_dispatch','shipped','delivered','partially_refunded','refund_pending','refunded')
        group by 1, 2) x), '[]'::jsonb)
  );
$$;

-- 5) The shop can never be left without an owner.
create or replace function protect_last_owner() returns trigger language plpgsql as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') and (select count(*) from user_roles where role = 'owner' and id <> old.id) = 0 then
    raise exception 'Cannot remove the last owner' using errcode = 'P0007';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists protect_last_owner on user_roles;
create trigger protect_last_owner before update or delete on user_roles for each row execute function protect_last_owner();

-- 6) Public bucket for product photos (Supabase only; skipped on plain Postgres). Uploads go through the service role after staff checks.
do $$ begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
  end if;
end $$;

revoke all on function admin_set_order_status(uuid, order_status, uuid, text), request_refund(uuid, bigint, text, uuid), complete_refund(uuid, uuid, boolean),
  decline_refund(uuid, uuid), admin_metrics(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function admin_set_order_status(uuid, order_status, uuid, text), request_refund(uuid, bigint, text, uuid), complete_refund(uuid, uuid, boolean),
  decline_refund(uuid, uuid), admin_metrics(timestamptz, timestamptz) to service_role;
