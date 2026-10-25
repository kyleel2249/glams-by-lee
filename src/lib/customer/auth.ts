import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServer } from '@/lib/supabase/server';

export interface Customer { id: string; email: string; emailVerified: boolean; name: string | null }

/** Cheap check (no network): is there a Supabase session cookie at all? Lets anonymous visitors skip a round trip. */
export async function hasSessionCookie(): Promise<boolean> {
  return (await cookies()).getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
}
export const customerAuthConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('YOUR-PROJECT') && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** The signed-in customer, validated with Supabase (not just a cookie), or null. */
export async function getCustomer(): Promise<Customer | null> {
  if (!customerAuthConfigured() || !(await hasSessionCookie())) return null;
  const { data: { user } } = await (await createServer()).auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? '', emailVerified: Boolean(user.email_confirmed_at), name: (user.user_metadata?.full_name as string | undefined) ?? null };
}

export async function requireCustomer(next = '/account'): Promise<Customer> {
  const c = await getCustomer();
  if (!c) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return c;
}
