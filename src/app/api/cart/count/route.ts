import { NextResponse } from 'next/server';
import { getCartId, loadCart } from '@/lib/cart';

export const dynamic = 'force-dynamic';

/** Tiny endpoint for the header bag badge. Never errors the page: unconfigured or failing means 0. */
export async function GET() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ count: 0 });
    const cart = await loadCart(await getCartId(false));
    return NextResponse.json({ count: cart.count }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ count: 0 }); }
}
