-- GLAMS BY LEE — 0001 schema
-- Money is stored in minor units (pesewas/cents) as bigint. Never use floats for money.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------- enums ----------
create type staff_role as enum ('owner','store_manager','order_manager','inventory_manager','customer_support','content_editor');
create type product_type as enum ('wig','bundle','closure_frontal','wig_cap','hair_care','accessory');
create type order_status as enum ('pending_payment','payment_processing','paid','processing','ready_for_dispatch','shipped','delivered','cancelled','refund_pending','partially_refunded','refunded','payment_failed');
create type payment_status as enum ('initiated','processing','succeeded','failed','abandoned','refunded','partially_refunded');
create type refund_status as enum ('requested','processing','completed','failed');
create type shipment_status as enum ('pending','label_created','in_transit','out_for_delivery','delivered','exception','returned');
create type inventory_movement_type as enum ('received','reserved','released','sold','adjusted','returned','damaged');
create type discount_type as enum ('percentage','fixed','free_shipping');
create type review_status as enum ('pending','approved','rejected');
create type notification_status as enum ('queued','sent','failed');

-- ---------- helpers ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- identity ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role staff_role not null,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  region text,
  postal_code text,
  country_code char(2) not null check (country_code = upper(country_code)),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on addresses(user_id);
create unique index addresses_one_default_per_user on addresses(user_id) where is_default;

-- ---------- catalogue ----------
create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories(id) on delete set null,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_url text,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  image_url text,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  product_type product_type not null,
  category_id uuid references categories(id) on delete set null,
  hair_material text,          -- e.g. human hair, synthetic (merchant-supplied only)
  texture text,                -- straight, body wave, deep wave, curly ...
  construction text,           -- lace front, glueless, closure ...
  lace_type text,
  care_instructions text,
  shipping_returns_note text,
  video_url text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on products(category_id);
create index products_published_idx on products(is_published, created_at desc);
create index products_search_idx on products using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));

create table collection_products (
  collection_id uuid not null references collections(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sort_order int not null default 0,
  primary key (collection_id, product_id)
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text not null unique,
  length_inches int check (length_inches is null or length_inches between 1 and 80),
  color text,
  density text,
  cap_size text,
  price_minor bigint not null check (price_minor >= 0),
  compare_at_price_minor bigint check (compare_at_price_minor is null or compare_at_price_minor > price_minor),
  currency char(3) not null default 'GHS',
  weight_grams int check (weight_grams is null or weight_grams >= 0),
  low_stock_threshold int not null default 2 check (low_stock_threshold >= 0),
  allow_backorder boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index variants_product_idx on product_variants(product_id);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  url text not null,
  alt_text text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on product_images(product_id, sort_order);

-- ---------- inventory ----------
create table inventory (
  variant_id uuid primary key references product_variants(id) on delete cascade,
  on_hand int not null default 0 check (on_hand >= 0),
  reserved int not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now()
);

create table inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references product_variants(id) on delete cascade,
  movement_type inventory_movement_type not null,
  quantity_delta int not null check (quantity_delta <> 0),   -- change to on_hand (or reserved for reserve/release)
  reason text,
  order_id uuid,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on inventory_movements(variant_id, created_at desc);

-- ---------- carts & wishlists ----------
create table carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_token_hash text unique,       -- sha256 of a random cookie token; raw token never stored
  currency char(3) not null default 'GHS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or guest_token_hash is not null)
);
create unique index carts_one_per_user on carts(user_id) where user_id is not null;

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references carts(id) on delete cascade,
  variant_id uuid not null references product_variants(id) on delete cascade,
  quantity int not null check (quantity between 1 and 20),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create table wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table wishlist_items (
  wishlist_id uuid not null references wishlists(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

-- ---------- discounts ----------
create table discount_codes (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  discount_type discount_type not null,
  percentage_off numeric(5,2) check (percentage_off is null or (percentage_off > 0 and percentage_off <= 100)),
  amount_off_minor bigint check (amount_off_minor is null or amount_off_minor > 0),
  currency char(3),
  min_subtotal_minor bigint not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit int check (usage_limit is null or usage_limit > 0),
  per_customer_limit int check (per_customer_limit is null or per_customer_limit > 0),
  category_ids uuid[] not null default '{}',
  product_ids uuid[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (discount_type = 'percentage' and percentage_off is not null) or
    (discount_type = 'fixed' and amount_off_minor is not null and currency is not null) or
    (discount_type = 'free_shipping')
  )
);

-- ---------- shipping ----------
create table shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_codes char(2)[] not null,
  regions text[] not null default '{}',     -- optional region restriction (e.g. Ghana regions)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table shipping_rates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references shipping_zones(id) on delete cascade,
  name text not null,                       -- e.g. "Accra courier", "Collection"
  method_code text not null,                -- courier | collection | international
  currency char(3) not null default 'GHS',
  flat_rate_minor bigint not null default 0 check (flat_rate_minor >= 0),
  per_kg_minor bigint not null default 0 check (per_kg_minor >= 0),
  min_subtotal_minor bigint,
  max_subtotal_minor bigint,
  free_over_subtotal_minor bigint,          -- only set when merchant approves a free-shipping threshold
  estimated_days_min int,
  estimated_days_max int,
  duties_note text,                         -- who pays customs/import duty, shown to customers
  is_active boolean not null default true,
  sort_order int not null default 0
);
create index shipping_rates_zone_idx on shipping_rates(zone_id);

-- ---------- orders ----------
create sequence order_number_seq start 1000;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  guest_email citext,
  guest_access_token_hash text unique,      -- hash of unguessable token for guest order lookup
  email citext not null,
  phone text,
  status order_status not null default 'pending_payment',
  currency char(3) not null,
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  discount_code_id uuid references discount_codes(id) on delete set null,
  shipping_rate_id uuid references shipping_rates(id) on delete set null,
  shipping_method_name text,
  shipping_address jsonb not null,
  billing_address jsonb,
  idempotency_key text unique,              -- blocks duplicate submissions
  customer_note text,
  internal_notes text,
  placed_at timestamptz not null default now(),
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_minor = subtotal_minor - discount_minor + shipping_minor + tax_minor),
  check (user_id is not null or guest_email is not null)
);
create index orders_user_idx on orders(user_id, placed_at desc);
create index orders_status_idx on orders(status, placed_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  -- snapshots: history survives catalogue edits
  product_name text not null,
  variant_sku text not null,
  variant_attributes jsonb not null default '{}'::jsonb,
  image_url text,
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  quantity int not null check (quantity > 0),
  line_total_minor bigint not null check (line_total_minor = unit_price_minor * quantity)
);
create index order_items_order_idx on order_items(order_id);

create table order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  from_status order_status,
  to_status order_status not null,
  actor_id uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on order_status_history(order_id, created_at);

-- ---------- payments ----------
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  provider text not null check (provider in ('paystack','flutterwave','manual')),
  reference text not null unique,           -- our reference sent to the provider
  provider_transaction_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  status payment_status not null default 'initiated',
  channel text,                             -- card, mobile_money, bank ...
  failure_reason text,
  verified_amount_minor bigint,
  verified_currency char(3),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_transaction_id)
);
create index payments_order_idx on payments(order_id);

create table payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,                   -- provider event id, or derived hash when none is supplied
  event_type text,
  reference text,
  signature_valid boolean not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, event_id)               -- duplicate webhook protection
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete restrict,
  order_id uuid not null references orders(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  reason text,
  status refund_status not null default 'requested',
  provider_refund_id text,
  requested_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- fulfilment ----------
create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  carrier text,
  tracking_number text,
  tracking_url text,
  status shipment_status not null default 'pending',
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipments_order_idx on shipments(order_id);

create table shipment_events (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references shipments(id) on delete cascade,
  status shipment_status not null,
  description text,
  location text,
  source text not null default 'manual' check (source in ('manual','carrier')),
  actor_id uuid references auth.users(id),
  occurred_at timestamptz not null default now()
);

-- ---------- discount usage ----------
create table discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references discount_codes(id) on delete cascade,
  order_id uuid not null unique references orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email citext,
  amount_minor bigint not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- engagement ----------
create table reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text,
  body text,
  is_verified_purchase boolean not null default false,
  status review_status not null default 'pending',
  moderated_by uuid references auth.users(id),
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create table newsletter_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  consent_at timestamptz not null default now(),
  consent_source text not null default 'website',
  unsubscribed_at timestamptz,
  unsubscribe_token text not null default encode(gen_random_bytes(24),'hex') unique
);

create table support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  name text not null,
  email citext not null,
  subject text,
  message text not null,
  status text not null default 'open' check (status in ('open','pending','resolved')),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- content & settings ----------
create table site_content (
  key text primary key,                     -- e.g. announcement_bar, hero, brand_story
  value jsonb not null,
  is_published boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table admin_settings (
  key text primary key,                     -- e.g. whatsapp_number, support_hours
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- ---------- operations ----------
create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,   -- never put secrets or card data here
  created_at timestamptz not null default now()
);
create index audit_logs_resource_idx on audit_logs(resource_type, resource_id, created_at desc);

create table notification_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  template text not null,
  recipient text not null,
  status notification_status not null default 'queued',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','addresses','categories','collections','products','product_variants','inventory','carts','discount_codes','orders','payments','refunds','shipments','support_requests']
  loop
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t||'_updated_at', t);
  end loop;
end $$;
