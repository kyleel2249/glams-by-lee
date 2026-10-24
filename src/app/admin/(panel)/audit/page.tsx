import { requirePermission } from '@/lib/admin/auth';
import { safeQuery } from '@/lib/admin/query';
import { userEmails } from '@/lib/admin/users';
import { createAdmin } from '@/lib/supabase/admin';
import { PageTitle, Table } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function Audit({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission('audit.view');
  const q = safeQuery((await searchParams).q);
  let query = createAdmin().from('audit_logs').select('id, actor_id, action, resource_type, resource_id, metadata, created_at').order('id', { ascending: false }).limit(200);
  if (q) query = query.ilike('action', `${q}%`);
  const [{ data, error }, emails] = await Promise.all([query, userEmails()]);
  if (error) throw new Error('Audit query failed');
  const rows = (data ?? []) as { id: number; actor_id: string | null; action: string; resource_type: string; resource_id: string | null; metadata: Record<string, unknown>; created_at: string }[];
  return (
    <>
      <PageTitle title="Audit log" />
      <form className="mb-4 flex max-w-md gap-2" role="search"><label className="sr-only" htmlFor="aq">Action starts with</label><input id="aq" name="q" defaultValue={q} placeholder="e.g. order, refund, product" className="field" /><button className="btn-outline">Filter</button></form>
      {rows.length ? <Table head={['When (UTC)', 'Who', 'Action', 'Item', 'Details']}>{rows.map((r) => (
        <tr key={r.id}><td className="px-3 py-2 whitespace-nowrap">{r.created_at.slice(0, 16).replace('T', ' ')}</td><td className="px-3 py-2">{r.actor_id ? emails.get(r.actor_id) ?? 'staff' : 'system'}</td><td className="px-3 py-2">{r.action}</td>
          <td className="px-3 py-2">{r.resource_type}{r.resource_id ? ` ${r.resource_id.slice(0, 8)}` : ''}</td><td className="max-w-xs break-words px-3 py-2 text-xs text-muted">{Object.keys(r.metadata ?? {}).length ? JSON.stringify(r.metadata) : ''}</td></tr>))}</Table>
        : <p className="border border-line bg-white p-6 text-center text-muted">No activity recorded yet.</p>}
    </>
  );
}
