-- Run after all migrations. Any failed assertion raises and aborts with a non-zero exit.
\set ON_ERROR_STOP on
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, service_role;

create or replace function assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond,false) then raise exception 'ASSERTION FAILED: %', msg; end if; end $$;

insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000a1','owner@test'),
 ('00000000-0000-0000-0000-0000000000b1','cust1@test'),
 ('00000000-0000-0000-0000-0000000000b2','cust2@test');
insert into user_roles(user_id, role) values ('00000000-0000-0000-0000-0000000000a1','owner');

-- profile bootstrap
select assert((select count(*) from profiles)=3, 'profiles auto-created');

-- catalogue fixtures
insert into products(id,sku,name,slug,product_type,is_published) values
 ('10000000-0000-0000-0000-000000000001','P-1','Test Wig','test-wig','wig',true),
 ('10000000-0000-0000-0000-000000000002','P-2','Hidden Wig','hidden-wig','wig',false);
insert into product_variants(id,product_id,sku,price_minor) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','P-1-A',100000);
select assert((select count(*) from inventory)=1, 'inventory row auto-created');
select adjust_stock('20000000-0000-0000-0000-000000000001', 1, 'received', 'initial stock', '00000000-0000-0000-0000-0000000000a1');

-- overselling: only 1 unit, second reservation must fail
insert into orders(id,user_id,email,currency,subtotal_minor,total_minor,shipping_address)
 values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','c1@test','GHS',100000,100000,'{}');
insert into orders(id,user_id,email,currency,subtotal_minor,total_minor,shipping_address)
 values ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b2','c2@test','GHS',100000,100000,'{}');
select assert((select order_number from orders where id='30000000-0000-0000-0000-000000000001') like 'GBL-%', 'order number generated');
select reserve_stock('20000000-0000-0000-0000-000000000001',1,'30000000-0000-0000-0000-000000000001');
do $$ begin
  begin perform reserve_stock('20000000-0000-0000-0000-000000000001',1,'30000000-0000-0000-0000-000000000002');
    raise exception 'ASSERTION FAILED: oversell allowed';
  exception when sqlstate 'P0001' then null; end;
end $$;

-- payment: mismatch must NOT mark paid
insert into order_items(order_id,variant_id,product_id,product_name,variant_sku,unit_price_minor,quantity,line_total_minor)
 values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Test Wig','P-1-A',100000,1,100000);
insert into payments(order_id,provider,reference,amount_minor,currency) values ('30000000-0000-0000-0000-000000000001','paystack','ref-1',100000,'GHS');
select assert(apply_verified_payment('ref-1','t1',99999,'GHS')='mismatch','amount mismatch rejected');
select assert((select status from orders where id='30000000-0000-0000-0000-000000000001')='pending_payment','order unchanged after mismatch');
-- fresh payment row for retry (failed one stays as evidence)
insert into payments(order_id,provider,reference,amount_minor,currency) values ('30000000-0000-0000-0000-000000000001','paystack','ref-2',100000,'GHS');
select assert(apply_verified_payment('ref-2','t2',100000,'USD')='mismatch','currency mismatch rejected');
insert into payments(order_id,provider,reference,amount_minor,currency) values ('30000000-0000-0000-0000-000000000001','paystack','ref-3',100000,'GHS');
select assert(apply_verified_payment('ref-3','t3',100000,'GHS')='paid','verified payment accepted');
select assert(apply_verified_payment('ref-3','t3',100000,'GHS')='already_processed','duplicate payment is idempotent');
select assert((select on_hand from inventory)=0 and (select reserved from inventory)=0, 'stock committed once');
select assert((select status from orders where id='30000000-0000-0000-0000-000000000001')='paid','order is paid');

-- invalid status transition blocked
do $$ begin
  begin update orders set status='delivered' where id='30000000-0000-0000-0000-000000000001';
    raise exception 'ASSERTION FAILED: invalid transition allowed';
  exception when check_violation then null; end;
end $$;
update orders set status='processing' where id='30000000-0000-0000-0000-000000000001';

-- duplicate webhook event blocked
insert into payment_events(provider,event_id,signature_valid,payload) values ('paystack','evt-1',true,'{}');
do $$ begin
  begin insert into payment_events(provider,event_id,signature_valid,payload) values ('paystack','evt-1',true,'{}');
    raise exception 'ASSERTION FAILED: duplicate event allowed';
  exception when unique_violation then null; end;
end $$;

-- cancel releases stock
select adjust_stock('20000000-0000-0000-0000-000000000001', 2, 'received', 'restock', '00000000-0000-0000-0000-0000000000a1');
insert into order_items(order_id,variant_id,product_id,product_name,variant_sku,unit_price_minor,quantity,line_total_minor)
 values ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Test Wig','P-1-A',100000,1,100000);
select reserve_stock('20000000-0000-0000-0000-000000000001',1,'30000000-0000-0000-0000-000000000002');
select assert((select reserved from inventory)=1,'reserved after reserve');
select cancel_unpaid_order('30000000-0000-0000-0000-000000000002');
select assert((select reserved from inventory)=0,'reservation released on cancel');
select assert((select status from orders where id='30000000-0000-0000-0000-000000000002')='cancelled','order cancelled');

-- closed-order payment is kept and flagged, not lost
insert into payments(order_id,provider,reference,amount_minor,currency) values ('30000000-0000-0000-0000-000000000002','paystack','ref-late',100000,'GHS');
select assert(apply_verified_payment('ref-late','t-late',100000,'GHS')='paid_on_closed_order','late payment on cancelled order flagged');
select assert((select count(*) from audit_logs where action='payment.received_for_closed_order')=1,'late payment audited');

-- stale unpaid orders expire and release stock
insert into orders(id,user_id,email,currency,subtotal_minor,total_minor,shipping_address,placed_at)
 values ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000b1','c3@test','GHS',100000,100000,'{}', now() - interval '3 hours');
insert into order_items(order_id,variant_id,product_id,product_name,variant_sku,unit_price_minor,quantity,line_total_minor)
 values ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Test Wig','P-1-A',100000,1,100000);
select reserve_stock('20000000-0000-0000-0000-000000000001',1,'30000000-0000-0000-0000-000000000003');
select assert((select reserved from inventory)=1,'stale order holds stock');
select assert(expire_unpaid_orders(interval '60 minutes')=1,'one stale order expired');
select assert((select reserved from inventory)=0,'expired order released stock');
select assert((select status from orders where id='30000000-0000-0000-0000-000000000003')='cancelled','stale order cancelled');

-- ===== place_order (Phase 3) =====
insert into discount_codes(id,code,discount_type,percentage_off,usage_limit,per_customer_limit)
 values ('40000000-0000-0000-0000-000000000001','WELCOME10','percentage',10,1,1);
select adjust_stock('20000000-0000-0000-0000-000000000001', 3, 'received', 'stock for place_order tests', '00000000-0000-0000-0000-0000000000a1');
-- stock now: on_hand 3, reserved 0
create temp table po(r jsonb);
insert into po select place_order(
  '{"email":"Buyer@Test","currency":"GHS","subtotal_minor":200000,"discount_minor":20000,"shipping_minor":5000,"tax_minor":0,"total_minor":185000,"discount_code_id":"40000000-0000-0000-0000-000000000001","shipping_address":{"country":"GH"},"idempotency_key":"key-1"}'::jsonb,
  '[{"variant_id":"20000000-0000-0000-0000-000000000001","quantity":2,"unit_price_minor":100000}]'::jsonb);
select assert((select (r->>'is_new')::boolean from po),'place_order creates a new order');
select assert((select reserved from inventory)=2,'place_order reserved stock');
select assert((select count(*) from order_items where order_id=(select (r->>'order_id')::uuid from po))=1,'item snapshot written');
select assert((select email from orders where idempotency_key='key-1')='buyer@test','email normalised');
select assert((select count(*) from discount_redemptions where discount_code_id='40000000-0000-0000-0000-000000000001')=1,'discount redeemed');

-- same idempotency key returns the same order and changes nothing
select assert((select (place_order('{"email":"buyer@test","currency":"GHS","subtotal_minor":200000,"discount_minor":20000,"shipping_minor":5000,"tax_minor":0,"total_minor":185000,"shipping_address":{},"idempotency_key":"key-1"}'::jsonb,
  '[{"variant_id":"20000000-0000-0000-0000-000000000001","quantity":2,"unit_price_minor":100000}]'::jsonb)->>'is_new')::boolean)=false,'duplicate submission returns existing order');
select assert((select reserved from inventory)=2,'duplicate submission did not reserve twice');

-- usage limit: a second order cannot reuse the single-use code
do $$ begin
  begin perform place_order('{"email":"other@test","currency":"GHS","subtotal_minor":100000,"discount_minor":10000,"shipping_minor":0,"tax_minor":0,"total_minor":90000,"discount_code_id":"40000000-0000-0000-0000-000000000001","shipping_address":{},"idempotency_key":"key-2"}'::jsonb,
      '[{"variant_id":"20000000-0000-0000-0000-000000000001","quantity":1,"unit_price_minor":100000}]'::jsonb);
    raise exception 'ASSERTION FAILED: used-up discount accepted';
  exception when sqlstate 'P0004' then null; end;
end $$;
select assert((select count(*) from orders where idempotency_key='key-2')=0 and (select reserved from inventory)=2,'failed discount rolled back the whole order and its stock');

-- price tampering is rejected
do $$ begin
  begin perform place_order('{"email":"x@test","currency":"GHS","subtotal_minor":1,"discount_minor":0,"shipping_minor":0,"tax_minor":0,"total_minor":1,"shipping_address":{},"idempotency_key":"key-3"}'::jsonb,
      '[{"variant_id":"20000000-0000-0000-0000-000000000001","quantity":1,"unit_price_minor":1}]'::jsonb);
    raise exception 'ASSERTION FAILED: tampered price accepted';
  exception when sqlstate 'P0003' then null; end;
end $$;

-- overselling: only 1 unit left (3 on hand, 2 reserved); asking for 2 must fail and leave no order behind
do $$ begin
  begin perform place_order('{"email":"y@test","currency":"GHS","subtotal_minor":200000,"discount_minor":0,"shipping_minor":0,"tax_minor":0,"total_minor":200000,"shipping_address":{},"idempotency_key":"key-4"}'::jsonb,
      '[{"variant_id":"20000000-0000-0000-0000-000000000001","quantity":2,"unit_price_minor":100000}]'::jsonb);
    raise exception 'ASSERTION FAILED: oversell via place_order';
  exception when sqlstate 'P0001' then null; end;
end $$;
select assert((select count(*) from orders where idempotency_key='key-4')=0,'oversell attempt left no order');
select assert((select reserved from inventory)=2,'oversell attempt left stock untouched');

-- unpublished product cannot be ordered
do $$ begin
  insert into product_variants(id,product_id,sku,price_minor) values ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','P-2-A',50000);
  begin perform place_order('{"email":"z@test","currency":"GHS","subtotal_minor":50000,"discount_minor":0,"shipping_minor":0,"tax_minor":0,"total_minor":50000,"shipping_address":{},"idempotency_key":"key-5"}'::jsonb,
      '[{"variant_id":"20000000-0000-0000-0000-000000000002","quantity":1,"unit_price_minor":50000}]'::jsonb);
    raise exception 'ASSERTION FAILED: unpublished product ordered';
  exception when sqlstate 'P0002' then null; end;
end $$;

-- cancelling the unpaid order frees stock AND the discount redemption
select cancel_unpaid_order((select (r->>'order_id')::uuid from po));
select assert((select reserved from inventory where variant_id='20000000-0000-0000-0000-000000000001')=0,'cancel released place_order stock');
select assert((select count(*) from discount_redemptions)=0,'cancel freed the discount redemption');

-- customers cannot call place_order
set role authenticated;
do $$ begin
  begin perform place_order('{}'::jsonb,'[]'::jsonb);
    raise exception 'ASSERTION FAILED: customer called place_order';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ===== payment failure (Phase 3) =====
select adjust_stock('20000000-0000-0000-0000-000000000001', 2, 'received', 'stock for failure tests', '00000000-0000-0000-0000-0000000000a1');
create temp table po2(r jsonb);
insert into po2 select place_order('{"email":"f@test","currency":"GHS","subtotal_minor":100000,"discount_minor":0,"shipping_minor":0,"tax_minor":0,"total_minor":100000,"shipping_address":{},"idempotency_key":"key-fail"}'::jsonb,
  '[{"variant_id":"20000000-0000-0000-0000-000000000001","quantity":1,"unit_price_minor":100000}]'::jsonb);
insert into payments(order_id,provider,reference,amount_minor,currency) values ((select (r->>'order_id')::uuid from po2),'paystack','ref-fail-1',100000,'GHS');
select assert(mark_payment_failed('ref-fail-1','declined')='marked_failed','failed payment recorded');
select assert((select status from orders where id=(select (r->>'order_id')::uuid from po2))='payment_failed','order moved to payment_failed');
select assert((select status from payments where reference='ref-fail-1')='failed','payment row failed');
-- a retry with a new reference can still succeed on the same order
insert into payments(order_id,provider,reference,amount_minor,currency) values ((select (r->>'order_id')::uuid from po2),'paystack','ref-fail-2',100000,'GHS');
select assert(apply_verified_payment('ref-fail-2','t-retry',100000,'GHS')='paid','order can be paid after an earlier failure');
select assert(mark_payment_failed('ref-fail-2','late failure webhook')='already_succeeded','a succeeded payment is never downgraded');
select assert(mark_payment_failed('nope','x')='unknown_reference','unknown reference handled');

-- one email per order and template
insert into notification_events(order_id,template,recipient) values ((select (r->>'order_id')::uuid from po2),'payment_confirmation','f@test');
do $$ begin
  begin insert into notification_events(order_id,template,recipient) values ((select (r->>'order_id')::uuid from po2),'payment_confirmation','f@test');
    raise exception 'ASSERTION FAILED: duplicate email allowed';
  exception when unique_violation then null; end;
end $$;

-- RLS: customer isolation
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select assert((select count(*) from orders)=1, 'cust2 sees only own order');
select assert((select count(*) from payments)=1 and (select count(*) from payments where order_id='30000000-0000-0000-0000-000000000001')=0, 'cust2 sees only own payments');
select assert((select count(*) from inventory)=0, 'customers cannot read stock counts');
select assert((select count(*) from user_roles)=0, 'customer has no roles visible');
do $$ begin
  begin insert into orders(user_id,email,currency,subtotal_minor,total_minor,shipping_address)
    values ('00000000-0000-0000-0000-0000000000b2','x@test','GHS',1,1,'{}');
    raise exception 'ASSERTION FAILED: customer inserted order';
  exception when insufficient_privilege then null; end;
end $$;
do $$ begin
  begin perform reserve_stock('20000000-0000-0000-0000-000000000001',1,null);
    raise exception 'ASSERTION FAILED: customer called reserve_stock';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- RLS: anon sees only published catalogue
set request.jwt.claim.sub = '';
set role anon;
select assert((select count(*) from products)=1, 'anon sees only published products');
select assert((select count(*) from orders)=0, 'anon sees no orders');
select assert((select count(*) from public_variant_availability)=1, 'availability view works for anon');
reset role;

-- RLS: owner can read orders and audit
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select assert((select count(*) from orders)=5, 'owner sees all orders');
select assert((select count(*) from products)=2, 'owner sees unpublished products');
reset role;

select 'ALL ASSERTIONS PASSED' as result;
