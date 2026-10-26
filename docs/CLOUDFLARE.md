# Deploying on Cloudflare

GLAMS BY LEE is a full Next.js app (payments, webhooks, sign-in, admin, assistant). Cloudflare **Pages** cannot run that. Deploy it as a Cloudflare **Worker** using the OpenNext adapter. The repository already contains the needed files (`wrangler.jsonc`, `open-next.config.ts`).

## 1. Create the project (once)

Cloudflare dashboard → **Workers & Pages → Create → Import a repository** (not "Pages"). Choose `kyleel2249/glams-by-lee`, branch `main`.

| Setting | Value |
|---|---|
| Project / Worker name | `glams-by-lee` (must match `name` in `wrangler.jsonc`, otherwise the build fails) |
| Production branch | `main` |
| Root directory | `/` (leave empty) |
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Build output / output directory | none (not used for Workers) |

If you only see "Build command / Build output / Root directory / Build comments", you are in a **Pages** project. Delete it (or leave it unused) and create a Worker as above.

## 2. Build variables (Settings → Build → Variables and secrets)

These are baked into the site while it is built, so they must exist before the first build. After changing one, redeploy.

| Name | Value |
|---|---|
| `NODE_VERSION` | `22` |
| `NEXT_PUBLIC_SITE_URL` | your live address, e.g. `https://glamsbylee.com` (no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the public "anon" key |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | `pk_test_…` first, `pk_live_…` at launch |

## 3. Runtime secrets (Worker → Settings → Variables and Secrets, type **Secret**)

| Name | Needed for |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | orders, payments, admin (never share) |
| `PAYSTACK_SECRET_KEY` | taking and verifying payments |
| `ORDER_LINK_SECRET` | signing order links (long random value) |
| `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` | order emails (optional until launch) |
| `ANTHROPIC_API_KEY` | AI shopping assistant (optional) |

Variables set in the dashboard are kept when new versions deploy (`keep_vars` is on).

## 4. After the first deploy

1. Open the `*.workers.dev` address and check the home page, a product, and the images.
2. Add your custom domain: Worker → **Settings → Domains & Routes → Add custom domain**.
3. Point `NEXT_PUBLIC_SITE_URL` at that domain and redeploy.
4. Paystack dashboard → webhook URL: `https://YOUR-DOMAIN/api/webhooks/paystack`.
5. Supabase → Authentication → URL configuration: add `https://YOUR-DOMAIN/auth/callback`.
6. Place a test order with Paystack **test** keys (see `docs/PAYMENTS.md`).

## How it behaves on Cloudflare

- **Shop pages are rendered on every request**, so new products, prices and stock appear immediately. (There is no shared page cache by default. If traffic grows, add the KV cache described at opennext.js.org/cloudflare/caching.)
- **Images** are resized by the Cloudflare Images binding (`IMAGES`). If product photos ever fail to load, add the build variable `NEXT_IMAGES_UNOPTIMIZED` = `1` and redeploy. Photos then load at full size (slower on mobile data) until Images is sorted out.
- **Size:** the Worker is about 1.7 MB compressed, within Cloudflare's published limit for the free plan. Check Cloudflare's current Workers limits page if it grows.
- **Rate limits** inside the app are per Worker instance. For heavier protection add Cloudflare rate-limiting rules (Security → WAF → Rate limiting) on `/api/*`, `/account/*` and `/admin/login`.
- **Scheduling:** unpaid-order clean-up runs inside Supabase (`pg_cron`, see `docs/PAYMENTS.md`), not on Cloudflare.

## Try it on your computer first

```bash
cp .dev.vars.example .dev.vars   # fill in placeholders
npm run cf:preview               # builds and runs it in the same runtime Cloudflare uses
```
