import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/account/AuthShell';
import { safeNext } from '@/lib/customer/next';
import { loginAction } from '../actions';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string; next?: string }> }) {
  const sp = await searchParams, next = safeNext(sp.next);
  return (
    <AuthShell title="Sign in" error={sp.error} ok={sp.ok}>
      <form action={loginAction} className="grid gap-4"><input type="hidden" name="next" value={next} />
        <label className="grid gap-1 text-sm font-medium">Email<input name="email" type="email" required autoComplete="username" className="field font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">Password<input name="password" type="password" required autoComplete="current-password" className="field font-normal" /></label>
        <button className="btn-gold">Sign in</button></form>
      <p className="mt-5 text-sm"><Link href="/account/forgot-password" className="underline">Forgot your password?</Link></p>
      <p className="mt-2 text-sm">New here? <Link href={`/account/register${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`} className="underline">Create an account</Link></p>
      <p className="mt-6 text-xs text-muted">You do not need an account to order. An account lets you see past orders, save addresses and keep a wishlist.</p>
    </AuthShell>
  );
}
