import { requirePermission } from '@/lib/admin/auth';
import { ROLE_LABEL, STAFF_ROLES, type StaffRole } from '@/lib/admin/permissions';
import { userEmails } from '@/lib/admin/users';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, Field, Flash, PageTitle, Table } from '@/components/admin/ui';
import { grantRole, revokeRole } from './actions';

export const dynamic = 'force-dynamic';

export default async function Team({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission('roles.manage');
  const sp = await searchParams;
  const [{ data }, emails] = await Promise.all([createAdmin().from('user_roles').select('id, user_id, role, created_at').order('created_at'), userEmails()]);
  const rows = (data ?? []) as { id: string; user_id: string; role: StaffRole; created_at: string }[];
  return (
    <>
      <PageTitle title="Team" /><Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6">
        <Card title="Give someone access">
          <p className="mb-3 text-sm text-muted">The person needs an account first (Supabase → Authentication → Users). Give each person only the role they need. Turn on two-step sign-in for owner accounts.</p>
          <form action={grantRole} className="grid gap-3 sm:grid-cols-3"><Field label="Email"><input name="email" type="email" required className="field font-normal" /></Field>
            <Field label="Role"><select name="role" className="field font-normal">{STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field><div className="self-end"><button className="btn-gold">Grant role</button></div></form>
        </Card>
        <Table head={['Person', 'Role', 'Since', '']}>{rows.map((r) => (
          <tr key={r.id}><td className="px-3 py-2">{emails.get(r.user_id) ?? r.user_id}</td><td className="px-3 py-2">{ROLE_LABEL[r.role]}</td><td className="px-3 py-2">{r.created_at.slice(0, 10)}</td>
            <td className="px-3 py-2"><form action={revokeRole}><input type="hidden" name="id" value={r.id} /><button className="underline">Remove</button></form></td></tr>))}</Table>
        <Card title="What each role can do"><ul className="space-y-1 text-sm">
          <li><strong>Owner</strong>: everything, including team and audit log.</li><li><strong>Store manager</strong>: products, prices, orders, refunds, discounts, shipping, content, settings.</li>
          <li><strong>Order manager</strong>: orders, tracking, refunds, stock view.</li><li><strong>Inventory manager</strong>: products, variants, stock.</li>
          <li><strong>Customer support</strong>: view orders and customer details only.</li><li><strong>Content editor</strong>: product text and photos, categories, homepage and policies.</li></ul></Card>
      </div>
    </>
  );
}
