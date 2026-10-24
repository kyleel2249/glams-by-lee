import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createCheckoutDb } from '@/lib/checkoutDb';
import { restartPayment } from '@/lib/checkoutService';
import { orderLinkSecret } from '@/lib/env';
import { verifyOrderLinkToken } from '@/lib/orderLink';
import { getPaystackProvider } from '@/lib/payments/paymentStore';
import { clientIp, rateLimited } from '@/lib/rateLimit';
import { createAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ number: string }> }) {
  if (rateLimited(`pay:${clientIp(req)}`, 10)) return NextResponse.json({ error: 'Too many attempts. Please wait a minute.' }, { status: 429 });
  if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ORDER_LINK_SECRET || !process.env.NEXT_PUBLIC_SITE_URL) return NextResponse.json({ error: 'Payments are not available yet.' }, { status: 503 });
  const { number } = await ctx.params;
  const token = new URL(req.url).searchParams.get('t');
  if (!verifyOrderLinkToken(number, token, orderLinkSecret())) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  try {
    const { data } = await createAdmin().from('orders').select('id').eq('order_number', number).maybeSingle();
    const id = (data as { id: string } | null)?.id;
    if (!id) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    const r = await restartPayment(id, `${process.env.NEXT_PUBLIC_SITE_URL!.replace(/\/$/, '')}/checkout/return`, { db: createCheckoutDb(), provider: getPaystackProvider(), newReference: () => `GBL-${randomBytes(9).toString('hex')}` });
    return r.ok ? NextResponse.json({ authorizationUrl: r.authorizationUrl }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (e) { console.error('pay retry failed', e instanceof Error ? e.message : e); return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 }); }
}
