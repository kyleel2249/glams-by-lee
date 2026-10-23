# GLAMS BY LEE

Premium wig and hair e-commerce platform for Ghana and international customers.
Stack: Next.js 15, TypeScript, Tailwind, Supabase (Postgres, Auth, Storage), Paystack, Vercel.

## Status: Phase 1 (foundation) complete

| Area | State |
|---|---|
| Database schema, functions, RLS, seed (`supabase/migrations`) | Done, 40+ assertions pass on Postgres 16 |
| Design system and `/design-system` page | Done |
| Logo set (SVG outlines + PNG, favicon, social) | Done, rebuild with `npm run brand:build` |
| Payment abstraction + Paystack signature check | Done, unit-tested; not yet connected to checkout |
| Storefront, cart, checkout, admin, accounts | Phases 2 to 5 |

## Run it

```bash
cp .env.example .env.local      # fill in your own keys
npm install
npm run dev                     # http://localhost:3000
npm run typecheck && npm run lint && npm test && npm run build
npm run db:test                 # needs a local Postgres (see below)
```

## Database

Apply `supabase/migrations/*.sql` in order, in the Supabase SQL editor or with the Supabase CLI.
Then make yourself the owner (run once, with your own user id from Auth > Users):

```sql
insert into user_roles (user_id, role) values ('YOUR-AUTH-USER-ID', 'owner');
```

`npm run db:test` creates a throwaway database `glams_test`, loads a minimal stand-in for Supabase's auth schema,
applies every migration and runs `supabase/tests/01_assertions.sql`. Set `DATABASE_URL` to point at a local server.

## Rules this foundation enforces

- Money is integer minor units. Totals are recomputed on the server.
- Browsers never create orders, payments or stock changes. Those go through service-role code and the
  `SECURITY DEFINER` functions, which are revoked from `anon` and `authenticated`.
- An order becomes `paid` only through `apply_verified_payment()`, which checks amount and currency and is idempotent.
- Stock reservation is one atomic UPDATE, so two buyers cannot take the last unit.
- Order status changes are validated by a database trigger and logged to `order_status_history`.
- Nothing is invented: no sample products, prices, reviews, phone numbers or addresses are seeded.

## You must supply

WhatsApp number (international format), support hours, contact email, social links, product photography,
shipping rates and zones, policy text (get legal review), and your own Supabase, Paystack and email credentials.
Until a setting is filled in, the matching feature stays hidden.
"# glams-by-lee" 
