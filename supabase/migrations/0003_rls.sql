-- GLAMS BY LEE — 0003 row-level security
-- Model: browsers (anon/authenticated) get the minimum. All commerce writes (orders, payments,
-- stock) go through server code using the service_role key, which bypasses RLS.

-- Create profile row when a Supabase Auth user signs up.
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Enable RLS everywhere.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------- public catalogue (read) ----------
create policy categories_public_read on categories for select using (is_visible);
create policy collections_public_read on collections for select using (is_visible);
create policy products_public_read on products for select using (is_published);
create policy variants_public_read on product_variants for select
  using (is_active and exists (select 1 from products p where p.id = product_id and p.is_published));
create policy images_public_read on product_images for select
  using (exists (select 1 from products p where p.id = product_id and p.is_published));
create policy collection_products_public_read on collection_products for select
  using (exists (select 1 from collections c where c.id = collection_id and c.is_visible));
create policy shipping_zones_public_read on shipping_zones for select using (is_active);
create policy shipping_rates_public_read on shipping_rates for select using (is_active);
create policy site_content_public_read on site_content for select using (is_published);
create policy settings_public_read on admin_settings for select using (is_public);
create policy reviews_public_read on reviews for select using (status = 'approved');

-- ---------- staff catalogue management ----------
create policy categories_staff_all on categories for all
  using (has_any_role(array['store_manager','content_editor']::staff_role[]))
  with check (has_any_role(array['store_manager','content_editor']::staff_role[]));
create policy collections_staff_all on collections for all
  using (has_any_role(array['store_manager','content_editor']::staff_role[]))
  with check (has_any_role(array['store_manager','content_editor']::staff_role[]));
create policy collection_products_staff_all on collection_products for all
  using (has_any_role(array['store_manager','content_editor']::staff_role[]))
  with check (has_any_role(array['store_manager','content_editor']::staff_role[]));
create policy products_staff_all on products for all
  using (has_any_role(array['store_manager','inventory_manager','content_editor']::staff_role[]))
  with check (has_any_role(array['store_manager','inventory_manager','content_editor']::staff_role[]));
create policy variants_staff_all on product_variants for all
  using (has_any_role(array['store_manager','inventory_manager']::staff_role[]))
  with check (has_any_role(array['store_manager','inventory_manager']::staff_role[]));
create policy images_staff_all on product_images for all
  using (has_any_role(array['store_manager','inventory_manager','content_editor']::staff_role[]))
  with check (has_any_role(array['store_manager','inventory_manager','content_editor']::staff_role[]));
create policy shipping_zones_staff_all on shipping_zones for all
  using (has_any_role(array['store_manager']::staff_role[])) with check (has_any_role(array['store_manager']::staff_role[]));
create policy shipping_rates_staff_all on shipping_rates for all
  using (has_any_role(array['store_manager']::staff_role[])) with check (has_any_role(array['store_manager']::staff_role[]));
create policy site_content_staff_all on site_content for all
  using (has_any_role(array['store_manager','content_editor']::staff_role[]))
  with check (has_any_role(array['store_manager','content_editor']::staff_role[]));
create policy settings_staff_all on admin_settings for all
  using (has_any_role(array['store_manager']::staff_role[])) with check (has_any_role(array['store_manager']::staff_role[]));
create policy discounts_staff_all on discount_codes for all
  using (has_any_role(array['store_manager']::staff_role[])) with check (has_any_role(array['store_manager']::staff_role[]));

-- Stock figures are staff-only; stock *changes* happen only through adjust_stock() (service role).
create policy inventory_staff_read on inventory for select
  using (has_any_role(array['store_manager','inventory_manager','order_manager']::staff_role[]));
create policy inventory_movements_staff_read on inventory_movements for select
  using (has_any_role(array['store_manager','inventory_manager']::staff_role[]));

-- ---------- customers: own data only ----------
create policy profiles_self_read on profiles for select using (id = auth.uid());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_staff_read on profiles for select
  using (has_any_role(array['store_manager','customer_support']::staff_role[]));

create policy addresses_own_all on addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy carts_own_all on carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own_all on cart_items for all
  using (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from carts c where c.id = cart_id and c.user_id = auth.uid()));

create policy wishlists_own_all on wishlists for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wishlist_items_own_all on wishlist_items for all
  using (exists (select 1 from wishlists w where w.id = wishlist_id and w.user_id = auth.uid()))
  with check (exists (select 1 from wishlists w where w.id = wishlist_id and w.user_id = auth.uid()));

create policy reviews_own_read on reviews for select using (user_id = auth.uid());
create policy reviews_own_insert on reviews for insert with check (user_id = auth.uid());
create policy reviews_staff_moderate on reviews for all
  using (has_any_role(array['store_manager','customer_support']::staff_role[]))
  with check (has_any_role(array['store_manager','customer_support']::staff_role[]));

-- Orders & related: customers read their own; creation/updates are server-only.
create policy orders_own_read on orders for select using (user_id = auth.uid());
create policy orders_staff_read on orders for select
  using (has_any_role(array['store_manager','order_manager','customer_support']::staff_role[]));
create policy order_items_own_read on order_items for select
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
create policy order_items_staff_read on order_items for select
  using (has_any_role(array['store_manager','order_manager','customer_support','inventory_manager']::staff_role[]));
create policy order_history_own_read on order_status_history for select
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
create policy order_history_staff_read on order_status_history for select
  using (has_any_role(array['store_manager','order_manager','customer_support']::staff_role[]));

create policy payments_own_read on payments for select
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
create policy payments_staff_read on payments for select
  using (has_any_role(array['store_manager','order_manager']::staff_role[]));
create policy refunds_staff_read on refunds for select
  using (has_any_role(array['store_manager','order_manager']::staff_role[]));
create policy payment_events_staff_read on payment_events for select
  using (has_any_role(array['store_manager']::staff_role[]));

create policy shipments_own_read on shipments for select
  using (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));
create policy shipments_staff_all on shipments for all
  using (has_any_role(array['store_manager','order_manager']::staff_role[]))
  with check (has_any_role(array['store_manager','order_manager']::staff_role[]));
create policy shipment_events_own_read on shipment_events for select
  using (exists (select 1 from shipments s join orders o on o.id = s.order_id where s.id = shipment_id and o.user_id = auth.uid()));
create policy shipment_events_staff_all on shipment_events for all
  using (has_any_role(array['store_manager','order_manager']::staff_role[]))
  with check (has_any_role(array['store_manager','order_manager']::staff_role[]));

create policy support_own_read on support_requests for select using (user_id = auth.uid());
create policy support_staff_all on support_requests for all
  using (has_any_role(array['store_manager','customer_support']::staff_role[]))
  with check (has_any_role(array['store_manager','customer_support']::staff_role[]));

create policy notifications_staff_read on notification_events for select
  using (has_any_role(array['store_manager','order_manager']::staff_role[]));
create policy newsletter_staff_read on newsletter_subscriptions for select
  using (has_any_role(array['store_manager','content_editor']::staff_role[]));
create policy discount_redemptions_staff_read on discount_redemptions for select
  using (has_any_role(array['store_manager']::staff_role[]));

-- Roles and audit trail: owner only. Writes happen server-side.
create policy user_roles_self_read on user_roles for select using (user_id = auth.uid());
create policy user_roles_owner_read on user_roles for select using (is_owner());  -- is_owner() is SECURITY DEFINER: avoids policy recursion
create policy audit_owner_read on audit_logs for select using (is_owner());

-- ---------- privilege lockdown ----------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function has_any_role(staff_role[]), is_staff(), is_owner() to anon, authenticated;
grant execute on function reserve_stock(uuid,int,uuid,uuid), release_stock(uuid,int,uuid,text,uuid),
  commit_stock(uuid,int,uuid,uuid), adjust_stock(uuid,int,inventory_movement_type,text,uuid),
  apply_verified_payment(text,text,bigint,char,text), cancel_unpaid_order(uuid,uuid), generate_order_number()
  to service_role;

grant select on public_variant_availability to anon, authenticated;
