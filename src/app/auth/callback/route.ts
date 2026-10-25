import { NextResponse } from 'next/server';
import { safeNext } from '@/lib/customer/next';
import { createAdmin } from '@/lib/supabase/admin';
import { createServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Email confirmation and password-reset links land here. Exchanges the one-time code for a session, then claims verified guest orders. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? url.origin).replace(/\/$/, '');
  const code = url.searchParams.get('code'), next = safeNext(url.searchParams.get('next'));
  if (!code || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.redirect(`${base}/account/login?error=${encodeURIComponent('That link is not valid. Please sign in or request a new one.')}`);
  const supabase = await createServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${base}/account/login?error=${encodeURIComponent('That link has expired. Please request a new one.')}`);
  if (data.user.email_confirmed_at && data.user.email && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await createAdmin().rpc('claim_guest_orders', { p_user: data.user.id, p_email: data.user.email });
  }
  return NextResponse.redirect(`${base}${next}`);
}
