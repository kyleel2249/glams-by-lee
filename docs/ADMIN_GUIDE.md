# Admin guide (Phase 4)

The admin area lives at `/admin`. It is hidden from search engines, never cached, and every page and action checks your role on the server.

## First sign-in

1. In Supabase, open **Authentication → Users → Add user** and create your account (email and a strong password).
2. In the SQL editor, make yourself the owner (use the user id shown in the Users list):
   ```sql
   insert into user_roles (user_id, role) values ('YOUR-USER-ID', 'owner');
   ```
3. Go to `https://YOUR-DOMAIN/admin` and sign in. Turn on two-step sign-in for your account in Supabase.
4. Open **Team** to give staff access. Each person needs a Supabase account first. Give the smallest role that does the job.

## Daily work

| Task | Where |
|---|---|
| See sales, stock alerts, payment exceptions | Dashboard |
| Fulfil an order: move status, add tracking, email the customer | Orders → open the order |
| Record a refund | Order → Refunds (see below) |
| Add or edit a wig, its sizes, prices and photos | Products |
| Receive stock or correct a count | Inventory → Adjust stock (a reason is required) |
| Run a promotion | Discounts |
| Set delivery countries and prices | Shipping |
| Change the banner, About page, policies | Content |
| WhatsApp number, contact email, tax rate, pause checkout | Settings (store manager and owner) |
| See who did what | Audit log (owner) |

## Rules the system enforces for you

- **Paid means verified.** Staff cannot mark an order paid. Only a payment confirmed with Paystack does that.
- **Paid orders are refunded, not cancelled.** Unpaid orders can be cancelled, which frees their stock and discount.
- **Refunds:** Record the request in the order, send the money back in your Paystack dashboard, then press **Mark completed**. A full refund can return the items to stock. Nothing is sent to Paystack automatically in this version.
- **No overselling:** stock cannot be reduced below what open orders have reserved.
- **Ordered products cannot be deleted**, only unpublished, so order history stays intact.
- **Every sensitive action is logged** (who, what, when).
- The last owner cannot be removed.

## Roles

Owner: everything. Store manager: products, orders, refunds, discounts, shipping, content, settings. Order manager: orders, tracking, refunds. Inventory manager: products, variants, stock. Customer support: read orders. Content editor: product text and photos, categories, homepage, policies.

## Not in this version

Customer accounts and order history (Phase 5), automatic refunds through Paystack, bulk product import, customer notes, per-product sales reports and CSV exports other than orders.
