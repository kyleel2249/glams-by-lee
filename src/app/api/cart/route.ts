import { NextResponse } from 'next/server';
import { getCartId, loadCart } from '@/lib/cart';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Bag is not available yet.' }, { status: 503 });
  return NextResponse.json(await loadCart(await getCartId(false)), { headers: { 'Cache-Control': 'no-store' } });
}
