import { requirePermission } from '@/lib/admin/auth';
import { userEmails } from '@/lib/admin/users';
import { createAdmin } from '@/lib/supabase/admin';
import { Flash, PageTitle, Table } from '@/components/admin/ui';
import { deleteCustomerAccount } from './actions';

export const dynamic = 'force-dynamic';

export default async function Privacy({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission('privacy.manage');
  const sp = await searchParams;
  const [{ data }, emails] = await Promise.all([createAdmin().from('profiles').select('id, full_name, deletion_requested_at').not('deletion_requested_at', 'is', null).order('deletion_requested_at'), userEmails()]);
  const rows = (data ?? []) as { id: string; full_name: string | null; deletion_requested_at: string }[];
  return (
    <>
      <PageTitle title="Privacy requests" /><Flash ok={sp.ok} error={sp.error} />
      <p className="mb-4 max-w-2xl text-sm text-muted">Customers can ask to delete their account from their profile page. Deleting removes their account, saved addresses, wishlist, cart and reviews. Order records are kept for accounting and legal needs but are no longer linked to the account. Ask your lawyer how long you must keep them.</p>
      {rows.length ? <Table head={['Customer', 'Email', 'Asked on', '']}>{rows.map((r) => (
        <tr key={r.id}><td className="px-3 py-2">{r.full_name ?? '—'}</td><td className="px-3 py-2">{emails.get(r.id) ?? '—'}</td><td className="px-3 py-2">{r.deletion_requested_at.slice(0, 10)}</td>
          <td className="px-3 py-2"><form action={deleteCustomerAccount}><input type="hidden" name="userId" value={r.id} /><button className="btn-outline !min-h-[36px] !px-4">Delete account</button></form></td></tr>))}</Table>
        : <p className="border border-line bg-white p-6 text-center text-muted">No deletion requests.</p>}
    </>
  );
}
