import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/account/AuthShell';
import { forgotAction } from '../actions';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false, follow: false } };

export default async function Forgot({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthShell title="Reset your password" intro="Enter your email and we will send you a link." error={sp.error} ok={sp.ok}>
      <form action={forgotAction} className="grid gap-4"><label className="grid gap-1 text-sm font-medium">Email<input name="email" type="email" required autoComplete="email" className="field font-normal" /></label><button className="btn-gold">Send reset link</button></form>
      <p className="mt-5 text-sm"><Link href="/account/login" className="underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
