import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { createAdmin } from '@/lib/supabase/admin';
import { Flash, PageTitle } from '@/components/admin/ui';
import { moderateReview } from './actions';

export const dynamic = 'force-dynamic';
interface R { id: string; rating: number; title: string | null; body: string | null; status: string; is_verified_purchase: boolean; created_at: string; products: { name: string; slug: string } | null }

export default async function Reviews({ searchParams }: { searchParams: Promise<{ show?: string; ok?: string; error?: string }> }) {
  await requirePermission('reviews.moderate');
  const sp = await searchParams, show = ['pending', 'approved', 'rejected'].includes(sp.show ?? '') ? sp.show! : 'pending';
  const { data, error } = await createAdmin().from('reviews').select('id, rating, title, body, status, is_verified_purchase, created_at, products(name, slug)').eq('status', show).order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Reviews query failed');
  const rows = (data ?? []) as unknown as R[];
  const tab = (k: string, label: string) => <Link href={`/admin/reviews?show=${k}`} aria-current={show === k ? 'page' : undefined} className={`min-h-[44px] border px-4 py-2.5 text-sm ${show === k ? 'border-ink bg-ink text-ivory' : 'border-line bg-white'}`}>{label}</Link>;
  return (
    <>
      <PageTitle title="Reviews" /><Flash ok={sp.ok} error={sp.error} />
      <div className="mb-4 flex flex-wrap gap-2">{tab('pending', 'Waiting')}{tab('approved', 'Approved')}{tab('rejected', 'Rejected')}</div>
      {rows.length ? <ul className="grid gap-4">{rows.map((r) => (
        <li key={r.id} className="border border-line bg-white p-4 text-sm">
          <p className="font-medium">{r.products?.name ?? 'Deleted product'} · {r.rating} out of 5{r.is_verified_purchase ? <span className="badge ml-3">Verified purchase</span> : <span className="ml-3 text-xs text-muted">Not a verified purchase</span>}</p>
          {r.title ? <p className="mt-2 font-medium">{r.title}</p> : null}{r.body ? <p className="mt-1 whitespace-pre-line">{r.body}</p> : null}
          <p className="mt-2 text-xs text-muted">{r.created_at.slice(0, 10)}</p>
          <form action={moderateReview} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="id" value={r.id} />
            {r.status !== 'approved' ? <button name="decision" value="approved" className="btn-gold !min-h-[36px] !px-4">Approve</button> : null}
            {r.status !== 'rejected' ? <button name="decision" value="rejected" className="btn-outline !min-h-[36px] !px-4">Reject</button> : null}
            {r.status !== 'pending' ? <button name="decision" value="pending" className="btn-outline !min-h-[36px] !px-4">Move back to waiting</button> : null}</form>
        </li>))}</ul> : <p className="border border-line bg-white p-6 text-center text-muted">Nothing here.</p>}
    </>
  );
}
