import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/customer/auth';
import { createServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Details for a signed-in customer to pre-fill checkout. Guests get { signedIn: false }. Reads only the customer's own rows (row-level security). */
export async function GET() {
  try {
    const c = await getCustomer();
    if (!c) return NextResponse.json({ signedIn: false });
    const db = await createServer();
    const [{ data: profile }, { data: addr }] = await Promise.all([
      db.from('profiles').select('full_name, phone').eq('id', c.id).maybeSingle(),
      db.from('addresses').select('recipient_name, phone, line1, line2, city, region, postal_code, country_code').eq('user_id', c.id).order('is_default', { ascending: false }).limit(1),
    ]);
    const p = profile as { full_name: string | null; phone: string | null } | null, a = (addr as Record<string, string | null>[] | null)?.[0];
    return NextResponse.json({ signedIn: true, email: c.email, name: a?.recipient_name ?? p?.full_name ?? '', phone: a?.phone ?? p?.phone ?? '',
      address: a ? { line1: a.line1, line2: a.line2, city: a.city, region: a.region, postalCode: a.postal_code, country: a.country_code } : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ signedIn: false }); }
}
