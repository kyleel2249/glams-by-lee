import { NextResponse } from 'next/server';
import { z } from 'zod';
import { addToCart } from '@/lib/cart';
import { clientIp, rateLimited } from '@/lib/rateLimit';

const schema = z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(20).default(1) });

export async function POST(req: Request) {
  if (rateLimited(`cart:${clientIp(req)}`, 60)) return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Bag is not available yet.' }, { status: 503 });
  try {
    const r = await addToCart(parsed.data.variantId, parsed.data.quantity);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
  } catch (e) { console.error('cart add failed', e instanceof Error ? e.message : e); return NextResponse.json({ error: 'Could not update your bag. Please try again.' }, { status: 500 }); }
}
