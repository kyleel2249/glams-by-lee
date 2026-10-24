# Architecture decisions (Phase 1)

Each choice is reversible and was made to keep running costs low for a single merchant.

1. **Next.js + Supabase + Vercel.** One deployable app, managed Postgres with row-level security, no servers to patch.
2. **Service role only on the server.** `src/lib/supabase/admin.ts` imports `server-only`, so a build fails if it reaches the browser.
3. **Business rules live in Postgres.** Stock, payment application and status transitions are SQL functions and triggers, so a bug in the app cannot oversell or mark an unpaid order as paid.
4. **Payment provider interface.** `src/lib/payments/types.ts`. Paystack ships first. Flutterwave is a second implementation of the same interface, added only after the merchant account is confirmed eligible.
5. **Guest orders.** Guests get an unguessable token; only its hash is stored (`orders.guest_access_token_hash`).
6. **Abandoned checkouts.** `expire_unpaid_orders()` releases held stock. Schedule it every 15 minutes (Supabase `pg_cron` or a Vercel cron route).
7. **Late payments.** If a verified payment arrives for a cancelled order, it is kept, flagged and audited for a manual refund decision.

## Known limits at the end of Phase 1

- Discount redemption is modelled but the atomic redeem function lands with checkout (Phase 3).
- Tax calculation rules (Ghana VAT/levies) need the merchant's accountant before checkout is built.
- The design-system page has not been checked in a real browser or on real devices.
- No Paystack test-mode transaction has been run yet; that needs your test keys.
