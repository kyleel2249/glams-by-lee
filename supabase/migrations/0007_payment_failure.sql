-- GLAMS BY LEE — 0007 payment failure handling + one-email-per-event guard

-- A failed or abandoned payment is recorded, and the order moves to payment_failed so the customer can retry.
-- Never downgrades a payment that already succeeded.
create or replace function mark_payment_failed(p_reference text, p_reason text, p_abandoned boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare pay payments%rowtype;
begin
  select * into pay from payments where reference = p_reference for update;
  if not found then return 'unknown_reference'; end if;
  if pay.status = 'succeeded' then return 'already_succeeded'; end if;
  update payments set status = case when p_abandoned then 'abandoned'::payment_status else 'failed'::payment_status end,
                      failure_reason = left(coalesce(p_reason, 'Payment not completed'), 300)
   where id = pay.id;
  update orders set status = 'payment_failed' where id = pay.order_id and status in ('pending_payment','payment_processing');
  return 'marked_failed';
end $$;

-- Each transactional email is queued at most once per order, so retries and duplicate webhooks never double-send.
create unique index if not exists notification_once_per_order on notification_events(order_id, template) where order_id is not null;

revoke all on function mark_payment_failed(text, text, boolean) from public, anon, authenticated;
grant execute on function mark_payment_failed(text, text, boolean) to service_role;
