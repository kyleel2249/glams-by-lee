import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/customer/auth';

export const dynamic = 'force-dynamic';

/** Lets the (cached) header show Sign in or Account without making every page dynamic. */
export async function GET() {
  try { return NextResponse.json({ signedIn: Boolean(await getCustomer()) }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ signedIn: false }); }
}
