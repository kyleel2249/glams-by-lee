import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setCartQuantity } from '@/lib/cart';
import { clientIp, rateLimited } from '@/lib/rateLimit';

const id = z.string().uuid();
const body = z.object({ quantity: z.number().int().min(0).max(20) });

async function handle(req: Request, params: Promise<{ variantId: string }>, quantity: number | 'from-body') {
  if (rateLimited(`cart:${clientIp(req)}`, 60)) return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  const variantId = id.safeParse((await params).variantId);
  if (!variantId.success) return NextResponse.json({ error: 'Invalid item.' }, { status: 400 });
  let q = 0;
  if (quantity === 'from-body') {
    const b = body.safeParse(await req.json().catch(() => null));
    if (!b.success) return NextResponse.json({ error: 'Invalid quantity.' }, { status: 400 });
    q = b.data.quantity;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Bag is not available yet.' }, { status: 503 });
  try {
    const r = await setCartQuantity(variantId.data, q);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (e) { console.error('cart update failed', e instanceof Error ? e.message : e); return NextResponse.json({ error: 'Could not update your bag. Please try again.' }, { status: 500 }); }
}

export const PATCH = (req: Request, ctx: { params: Promise<{ variantId: string }> }) => handle(req, ctx.params, 'from-body');
export const DELETE = (req: Request, ctx: { params: Promise<{ variantId: string }> }) => handle(req, ctx.params, 0);
