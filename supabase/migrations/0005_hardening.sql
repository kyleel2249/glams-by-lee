-- GLAMS BY LEE — 0005 hardening found during Phase 1 review

-- 1) Money received for an order that is no longer payable (e.g. cancelled while the customer was paying)
--    must never be lost or silently ignored: record it and flag it for a manual refund.
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
    return 'paid';
  end if;

  -- Order already cancelled/closed: keep the verified payment and ask for a refund decision.
  update payments set failure_reason = 'Verified payment received for a non-payable order; refund review needed' where id = pay.id;
  insert into audit_logs(action, resource_type, resource_id, metadata)
  values ('payment.received_for_closed_order', 'order', ord.id::text,
          jsonb_build_object('order_status', ord.status, 'payment_reference', p_payment_reference));
  return 'paid_on_closed_order';
end $$;

-- 2) Abandoned checkouts must not hold stock forever.
create or replace function expire_unpaid_orders(p_older_than interval default interval '60 minutes')
returns int language plpgsql security definer set search_path = public as $$
declare o record; n int := 0;
begin
  for o in select id from orders
           where status in ('pending_payment','payment_failed') and placed_at < now() - p_older_than
           for update skip locked
  loop
    perform cancel_unpaid_order(o.id, null);
    n := n + 1;
  end loop;
  return n;
end $$;

-- 3) Lookup indexes for support and reporting.
create index if not exists orders_email_idx on orders(email);
create index if not exists payments_status_idx on payments(status, created_at desc);
create index if not exists reviews_product_status_idx on reviews(product_id, status);
create index if not exists order_items_product_idx on order_items(product_id);

-- 4) Reviews: only approved ones may be edited by staff; authors cannot self-approve (policy already limits to insert).
revoke all on function apply_verified_payment(text,text,bigint,char,text), expire_unpaid_orders(interval) from public, anon, authenticated;
grant execute on function apply_verified_payment(text,text,bigint,char,text), expire_unpaid_orders(interval) to service_role;
