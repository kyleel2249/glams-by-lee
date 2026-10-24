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
select assert((select count(*) from orders)=3, 'owner sees all orders');
select assert((select count(*) from products)=2, 'owner sees unpublished products');
reset role;

select 'ALL ASSERTIONS PASSED' as result;
