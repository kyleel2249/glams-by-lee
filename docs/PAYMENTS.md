# Payments, checkout and orders (Phase 3)

## How a purchase flows

1. **Bag** (`/cart`): guest cart in the database, identified by an httpOnly cookie. Only a hash of the cookie token is stored.
2. **Checkout** (`/checkout`): the browser sends choices only (address, delivery option, discount code). The server re-reads prices, stock, shipping rules and tax from the database and recomputes every total (`src/lib/quote.ts`).
3. **Place order**: the database function `place_order()` creates the order, item snapshots, stock reservations and discount redemption in one transaction. If anything fails, nothing is written.
4. **Pay**: the order and a payment attempt are saved first, then Paystack is asked for a hosted payment page. The amount sent comes from the saved order.
5. **Confirm**: both the webhook and the return page call the same `confirmPayment()`. It asks Paystack for the transaction, then `apply_verified_payment()` checks amount, currency and order. Only then is the order `paid`, stock is committed, and one confirmation email is sent.
6. **Recovery**: the order page re-checks an unpaid order with Paystack when opened, and offers "Pay now" (new payment reference, same saved amount). Unpaid orders are released by `expire_unpaid_orders()`.

## Set up (test mode first)

1. Create a Paystack account and use **test** keys. Put `PAYSTACK_SECRET_KEY` and `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` in Vercel env vars.
2. In the Paystack dashboard, set the webhook URL to `https://YOUR-DOMAIN/api/webhooks/paystack`.
3. Generate `ORDER_LINK_SECRET` (`openssl rand -base64 32`) and set it. Set `NEXT_PUBLIC_SITE_URL` to your live URL.
4. Add shipping zones and rates (Supabase table editor until the admin dashboard exists in Phase 4). Example zone: name "Ghana", `country_codes` `{GH}`; rate: name "Accra courier", `flat_rate_minor` 3000 (= GH₵30.00).
5. Optional email: set `EMAIL_PROVIDER_API_KEY` (Resend) and `EMAIL_FROM` on a domain you have verified. Without them, confirmation emails stay `queued` in `notification_events`.
6. Schedule stock release for abandoned checkouts (Supabase SQL editor, needs the `pg_cron` extension):

```sql
select cron.schedule('expire-unpaid-orders', '*/15 * * * *', $$select expire_unpaid_orders(interval '60 minutes')$$);
```

## Test checklist (use Paystack test cards only, never real cards)

Successful payment, declined payment, closing the payment page, paying twice with the same link, webhook arriving before and after the return page, wrong amount (cannot be forced from the browser), duplicate discount use, last item bought by two people at once.

## Not done yet

- Tax: `tax_rate_bps` in `admin_settings` is `0` until your accountant confirms Ghana VAT/levy treatment.
- Refunds, customer accounts and order history (Phases 4 and 5). Orders are guest orders viewed through the signed link in the email.
- Mobile Money and card availability depend on your approved Paystack account.
- Zero-total orders (100% discounts) are refused because Paystack cannot charge zero.
