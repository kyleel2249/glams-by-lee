-- GLAMS BY LEE — 0009 customer accounts

-- 1) Capture marketing consent (with a timestamp) when the account is created. Consent is opt-in only.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_consent boolean := lower(coalesce(new.raw_user_meta_data->>'marketing_consent', '')) in ('true', 't', '1');
begin
  insert into profiles(id, full_name, marketing_consent, marketing_consent_at)
  values (new.id, left(new.raw_user_meta_data->>'full_name', 120), v_consent, case when v_consent then now() end)
  on conflict do nothing;
  if v_consent and new.email is not null then
    insert into newsletter_subscriptions(email, consent_source) values (new.email, 'signup')
    on conflict (email) do update set unsubscribed_at = null;
  end if;
  return new;
end $$;

-- 2) Link earlier guest orders to an account. The caller must only do this for a VERIFIED email address (proof of ownership).
create or replace function claim_guest_orders(p_user uuid, p_email text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_user is null or p_email is null or length(trim(p_email)) = 0 then return 0; end if;
  update orders set user_id = p_user where user_id is null and lower(email::text) = lower(trim(p_email));
  get diagnostics n = row_count;
  return n;
end $$;

-- 3) Signing in must not lose the bag. Items from the browser's guest cart are merged into the account cart
--    (quantities added, capped at 20) and the browser keeps working with the same cookie.
create or replace function merge_guest_cart_into_user(p_guest uuid, p_user_cart uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_hash text; it record;
begin
  if p_guest = p_user_cart then return; end if;
  select guest_token_hash into v_hash from carts where id = p_guest for update;
  for it in select variant_id, quantity from cart_items where cart_id = p_guest loop
    insert into cart_items(cart_id, variant_id, quantity) values (p_user_cart, it.variant_id, least(it.quantity, 20))
    on conflict (cart_id, variant_id) do update set quantity = least(cart_items.quantity + excluded.quantity, 20);
  end loop;
  delete from carts where id = p_guest;                                      -- frees the unique token hash and cascades its items
  update carts set guest_token_hash = v_hash, updated_at = now() where id = p_user_cart;
end $$;

-- 4) Public rating summary: approved reviews only, aggregates only (no reviewer identities).
create or replace view product_rating_summary as
  select product_id, round(avg(rating)::numeric, 1) as avg_rating, count(*)::int as review_count
  from reviews where status = 'approved' group by product_id;
grant select on product_rating_summary to anon, authenticated;

revoke all on function claim_guest_orders(uuid, text), merge_guest_cart_into_user(uuid, uuid) from public, anon, authenticated;
grant execute on function claim_guest_orders(uuid, text), merge_guest_cart_into_user(uuid, uuid) to service_role;
