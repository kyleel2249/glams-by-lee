import Link from 'next/link';
import { requireCustomer } from '@/lib/customer/auth';
import { createServer } from '@/lib/supabase/server';
import { cancelDeletion, requestDeletion, saveProfile } from './actions';

export const dynamic = 'force-dynamic';

export default async function Profile({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const c = await requireCustomer('/account/profile');
  const sp = await searchParams;
  const { data } = await (await createServer()).from('profiles').select('full_name, phone, marketing_consent, deletion_requested_at').eq('id', c.id).maybeSingle();
  const p = (data ?? {}) as { full_name?: string | null; phone?: string | null; marketing_consent?: boolean; deletion_requested_at?: string | null };
  return (
    <>
      <h1 className="text-4xl">Your details</h1>
      {sp.error ? <p role="alert" className="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{sp.error}</p> : null}
      {sp.ok ? <p role="status" className="mt-4 border border-gold bg-white p-3 text-sm text-gold-deep">{sp.ok}</p> : null}
      <form action={saveProfile} className="mt-6 grid max-w-md gap-4">
        <label className="grid gap-1 text-sm font-medium">Email<input value={c.email} readOnly className="field bg-ivory font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">Full name<input name="name" required defaultValue={p.full_name ?? ''} autoComplete="name" className="field font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">Phone<input name="phone" defaultValue={p.phone ?? ''} autoComplete="tel" className="field font-normal" /></label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="marketingConsent" defaultChecked={p.marketing_consent} className="mt-1 h-5 w-5 accent-gold-deep" />Email me new arrivals and care tips (optional)</label>
        <button className="btn-gold justify-self-start">Save</button>
      </form>
      <p className="mt-8 text-sm"><Link href="/account/forgot-password" className="underline">Change your password</Link></p>
      <section className="mt-10 max-w-md border border-line bg-white p-5" aria-labelledby="del">
        <h2 id="del" className="font-display text-2xl">Delete my account</h2>
        {p.deletion_requested_at ? (
          <><p className="mt-2 text-sm">Deletion requested on {p.deletion_requested_at.slice(0, 10)}. We will complete it shortly.</p><form action={cancelDeletion} className="mt-3"><button className="btn-outline">Cancel the request</button></form></>
        ) : (
          <><p className="mt-2 text-sm text-muted">This removes your account, saved addresses, wishlist and reviews. Order records are kept as the law requires, without a link to your account.</p><form action={requestDeletion} className="mt-3"><button className="btn-outline">Request account deletion</button></form></>
        )}
      </section>
    </>
  );
}
