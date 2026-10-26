import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { clearCart, getCartId, loadCart, toPriceLines } from '@/lib/cart';
import { createCheckoutDb, findDiscount, loadCheckoutRules } from '@/lib/checkoutDb';
import { checkoutSchema } from '@/lib/checkoutRequest';
import { startCheckout } from '@/lib/checkoutService';
import { getPaystackProvider } from '@/lib/payments/paymentStore';
import { buildQuote } from '@/lib/quote';
import { clientIp, rateLimited } from '@/lib/rateLimit';
import { createAdmin } from '@/lib/supabase/admin';
import { getCustomer } from '@/lib/customer/auth';

export const dynamic = 'force-dynamic';
// Written out one by one on purpose: NEXT_PUBLIC_ values are filled in at build time, which only works for direct references like process.env.NEXT_PUBLIC_SITE_URL.
const configured = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.PAYSTACK_SECRET_KEY && process.env.ORDER_LINK_SECRET && process.env.NEXT_PUBLIC_SITE_URL);

export async function POST(req: Request) {
  if (rateLimited(`checkout:${clientIp(req)}`, 10)) return NextResponse.json({ error: 'Too many attempts. Please wait a minute.' }, { status: 429 });
  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Please check your details.' }, { status: 400 });
  if (!configured()) return NextResponse.json({ error: 'Checkout is not available yet.' }, { status: 503 });
  const i = parsed.data;

  try {
    const { data: flag } = await createAdmin().from('admin_settings').select('value').eq('key', 'checkout_enabled').maybeSingle();
    if ((flag as { value: unknown } | null)?.value === false) return NextResponse.json({ error: 'Checkout is paused right now. Please contact us to order.' }, { status: 503 });

    const customer = await getCustomer();
    const cartId = await getCartId(false);
    const cart = await loadCart(cartId);
    if (!cartId || !cart.lines.length) return NextResponse.json({ error: 'Your bag is empty.' }, { status: 400 });
    if (cart.hasProblems) return NextResponse.json({ error: 'Please fix the items in your bag first.' }, { status: 409 });

    // Re-price everything on the server. Nothing from the browser decides the amount.
    const [rules, rule] = await Promise.all([loadCheckoutRules(), findDiscount(i.code)]);
    if (i.code && !rule) return NextResponse.json({ error: 'That discount code was not found.' }, { status: 409 });
    const lines = toPriceLines(cart.lines);
    const quote = buildQuote({ lines, currency: cart.currency, country: i.country, region: i.region, zones: rules.zones, rates: rules.rates, rateId: i.rateId, discountRule: rule, taxRateBps: rules.taxRateBps });
    if (quote.discountError) return NextResponse.json({ error: quote.discountError }, { status: 409 });
    if (!quote.deliverable || !quote.selected || !quote.totals) return NextResponse.json({ error: 'That delivery option is not available for your address.' }, { status: 409 });
    const t = quote.totals;

    // Same bag + same choices + same key => same order (blocks double clicks). Any change produces a new key.
    const idem = createHash('sha256').update([cartId, i.idempotencyKey, t.totalMinor, i.rateId, quote.discount?.code ?? '', ...cart.lines.map((l) => `${l.variantId}x${l.quantity}@${l.unitPriceMinor}`)].join('|')).digest('hex');
    const site = process.env.NEXT_PUBLIC_SITE_URL!.replace(/\/$/, '');

    const result = await startCheckout({
      order: {
        user_id: customer?.id ?? null, email: i.email, phone: i.phone, currency: cart.currency,
        subtotal_minor: t.subtotalMinor, discount_minor: t.discountMinor, shipping_minor: t.shippingMinor, tax_minor: t.taxMinor, total_minor: t.totalMinor,
        discount_code_id: quote.discount && rule ? rule.id : null, shipping_rate_id: quote.selected.id, shipping_method_name: quote.selected.name,
        shipping_address: { name: i.name, phone: i.phone, line1: i.line1, line2: i.line2 ?? null, city: i.city, region: i.region ?? null, postal_code: i.postalCode ?? null, country: i.country },
        customer_note: i.note ?? null, idempotency_key: idem,
      },
      items: cart.lines.map((l) => ({ variant_id: l.variantId, quantity: l.quantity, unit_price_minor: l.unitPriceMinor })),
      callbackUrl: `${site}/checkout/return`,
    }, { db: createCheckoutDb(), provider: getPaystackProvider(), newReference: () => `GBL-${randomBytes(9).toString('hex')}` });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    await clearCart(cartId);   // stock now belongs to the order; the order page can retry payment
    return NextResponse.json({ authorizationUrl: result.authorizationUrl, orderNumber: result.orderNumber });
  } catch (e) {
    console.error('checkout failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Something went wrong. Nothing was charged. Please try again.' }, { status: 500 });
  }
}
