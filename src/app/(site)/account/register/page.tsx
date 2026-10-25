import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/account/AuthShell';
import { safeNext } from '@/lib/customer/next';
import { registerAction } from '../actions';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false, follow: false } };

export default async function Register({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams, next = safeNext(sp.next);
  return (
    <AuthShell title="Create an account" intro="See your orders, save delivery addresses and keep a wishlist." error={sp.error}>
      <form action={registerAction} className="grid gap-4"><input type="hidden" name="next" value={next} />
        <label className="grid gap-1 text-sm font-medium">Full name<input name="name" required autoComplete="name" className="field font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">Email<input name="email" type="email" required autoComplete="email" className="field font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">Password<input name="password" type="password" required minLength={10} autoComplete="new-password" className="field font-normal" /><span className="text-xs font-normal text-muted">At least 10 characters, with a letter and a number.</span></label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="marketingConsent" className="mt-1 h-5 w-5 accent-gold-deep" /><span>Email me new arrivals and care tips. <span className="text-muted">Optional. You can unsubscribe any time.</span></span></label>
        <button className="btn-gold">Create account</button></form>
      <p className="mt-5 text-sm">Already have an account? <Link href="/account/login" className="underline">Sign in</Link></p>
      <p className="mt-4 text-xs text-muted">We use your details to run your account and orders. See our <Link href="/policies/privacy" className="underline">privacy policy</Link>.</p>
    </AuthShell>
  );
}
