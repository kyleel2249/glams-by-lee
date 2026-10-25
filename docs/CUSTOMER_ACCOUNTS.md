# Customer accounts (Phase 5)

Guest checkout always works. Accounts add order history, saved addresses, a wishlist, reviews and a bag that follows the customer across devices.

## Supabase settings to turn on (Authentication)

1. **Providers → Email**: enabled, **Confirm email** ON (so only verified addresses can claim past guest orders).
2. **URL configuration**: Site URL = your live domain. Add `https://YOUR-DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback` for testing) to Redirect URLs.
3. **Password rules**: minimum length 10 and "letters and digits" (the site enforces this too).
4. **Email delivery**: Supabase's built-in sender is for testing only and is heavily limited. Add your own SMTP (for example Resend) under Project Settings → Authentication → SMTP before launch, or confirmation emails will not arrive.
5. **Email templates**: edit the confirm and reset emails so they are branded GLAMS BY LEE.
6. Rate limits: keep Supabase's defaults; the site adds its own per-IP limits as well.

## What customers can do

- Register (marketing emails are opt-in, off by default, with the date recorded), confirm their email, sign in, reset their password.
- See orders (including earlier guest orders placed with the same email, once the email is confirmed).
- Save addresses; checkout pre-fills from them.
- Keep a wishlist and write reviews (reviews wait for your approval; "Verified purchase" is worked out by the database from real paid orders).
- Ask for their account to be deleted from their profile page.

## What you do

- **Reviews**: Admin → Reviews. Approve or reject. Only approved reviews and ratings are shown.
- **Deletion requests**: Admin → Privacy requests. "Delete account" removes the account, saved addresses, wishlist, cart and reviews. Order records are kept but unlinked from the account. Ask a lawyer how long you must keep them and update your privacy policy.

## Security notes

- Customer pages read data through the customer's own login, so row-level security blocks access to anyone else's rows.
- Sign-in, registration and reset forms give the same answer whether or not an email has an account.
- The `next=` address after sign-in only accepts paths on this site.
- Signing out clears the bag cookie so the next person on a shared device does not see it.
- A guest cart already tied to a different customer is never handed to whoever signs in next.

## Not in this version

Changing the account email, social sign-in (Google), data export download, and two-step sign-in for customers (staff accounts should turn it on in Supabase).
