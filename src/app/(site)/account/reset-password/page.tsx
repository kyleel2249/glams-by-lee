import type { Metadata } from 'next';
import { AuthShell } from '@/components/account/AuthShell';
import { getCustomer } from '@/lib/customer/auth';
import { redirect } from 'next/navigation';
import { resetAction } from '../actions';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false, follow: false } };

export default async function Reset({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await getCustomer())) redirect('/account/forgot-password?error=' + encodeURIComponent('That link has expired. Request a new one.'));
  const sp = await searchParams;
  return (
    <AuthShell title="Choose a new password" error={sp.error}>
      <form action={resetAction} className="grid gap-4">
        <label className="grid gap-1 text-sm font-medium">New password<input name="password" type="password" required minLength={10} autoComplete="new-password" className="field font-normal" /><span className="text-xs font-normal text-muted">At least 10 characters, with a letter and a number.</span></label>
        <label className="grid gap-1 text-sm font-medium">Repeat new password<input name="confirm" type="password" required autoComplete="new-password" className="field font-normal" /></label>
        <button className="btn-gold">Update password</button></form>
    </AuthShell>
  );
}
