import { NextResponse } from 'next/server';
import { getCartId, loadCart, toPriceLines } from '@/lib/cart';
import { findDiscount, loadCheckoutRules } from '@/lib/checkoutDb';
import { quoteSchema } from '@/lib/checkoutRequest';
import { buildQuote } from '@/lib/quote';
import { clientIp, rateLimited } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (rateLimited(`quote:${clientIp(req)}`, 40)) return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  const parsed = quoteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Choose a delivery country.' }, { status: 400 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Checkout is not available yet.' }, { status: 503 });
  try {
    const cart = await loadCart(await getCartId(false));
    if (!cart.lines.length) return NextResponse.json({ error: 'Your bag is empty.' }, { status: 400 });
    if (cart.hasProblems) return NextResponse.json({ error: 'Please fix the items in your bag first.' }, { status: 409 });
    const [rules, rule] = await Promise.all([loadCheckoutRules(), findDiscount(parsed.data.code)]);
    const quote = buildQuote({ lines: toPriceLines(cart.lines), currency: cart.currency, country: parsed.data.country, region: parsed.data.region, zones: rules.zones, rates: rules.rates, rateId: parsed.data.rateId, discountRule: rule, taxRateBps: rules.taxRateBps });
    const discountError = parsed.data.code && !rule ? 'That discount code was not found.' : quote.discountError;
    return NextResponse.json({ ...quote, discountError, currency: cart.currency, subtotalMinor: cart.subtotalMinor }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { console.error('quote failed', e instanceof Error ? e.message : e); return NextResponse.json({ error: 'Could not calculate your order. Please try again.' }, { status: 500 }); }
}
