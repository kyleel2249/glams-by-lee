import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { isDate, safeQuery } from '@/lib/admin/query';
import { can } from '@/lib/admin/permissions';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';
import { createAdmin } from '@/lib/supabase/admin';
import { PageTitle, Table } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
const PAGE = 25;
type SP = { q?: string; status?: string; from?: string; to?: string; page?: string };


export default async function Orders({ searchParams }: { searchParams: Promise<SP> }) {
  const staff = await requirePermission('orders.view');
  const sp = await searchParams;
  const q = safeQuery(sp.q), page = Math.max(1, Number(sp.page) || 1);
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? '') ? sp.status : undefined;
  let query = createAdmin().from('orders').select('id, order_number, email, status, total_minor, currency, placed_at, paid_at', { count: 'exact' }).order('placed_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (q) query = query.or(`order_number.ilike.%${q}%,email.ilike.%${q}%`);
  if (status) query = query.eq('status', status);
  if (isDate(sp.from)) query = query.gte('placed_at', `${sp.from}T00:00:00Z`);
  if (isDate(sp.to)) query = query.lt('placed_at', new Date(Date.parse(`${sp.to}T00:00:00Z`) + 86_400_000).toISOString());
  const { data, count, error } = await query;
  if (error) throw new Error('Orders query failed');
  const rows = (data ?? []) as { id: string; order_number: string; email: string; status: OrderStatus; total_minor: number; currency: string; placed_at: string; paid_at: string | null }[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const qs = (p: number) => new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(isDate(sp.from) ? { from: sp.from! } : {}), ...(isDate(sp.to) ? { to: sp.to! } : {}), page: String(p) }).toString();

  return (
    <>
      <PageTitle title="Orders">{can(staff.roles, 'orders.export') ? <a href={`/admin/orders/export?${qs(1)}`} className="btn-outline">Export CSV</a> : null}</PageTitle>
      <form className="mb-5 grid gap-3 border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Filter orders">
        <label className="grid gap-1 text-sm font-medium lg:col-span-2">Order number or email<input name="q" defaultValue={q} className="field font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">Status<select name="status" defaultValue={status ?? ''} className="field font-normal"><option value="">All</option>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
        <label className="grid gap-1 text-sm font-medium">From<input type="date" name="from" defaultValue={isDate(sp.from) ? sp.from : ''} className="field font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">To<input type="date" name="to" defaultValue={isDate(sp.to) ? sp.to : ''} className="field font-normal" /></label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5"><button className="btn-gold">Apply</button><Link href="/admin/orders" className="btn-outline">Clear</Link></div>
      </form>
      {rows.length ? (
        <Table head={['Order', 'Customer', 'Status', 'Placed', 'Total']}>
          {rows.map((o) => (
            <tr key={o.id} className="hover:bg-ivory">
              <td className="px-3 py-2"><Link href={`/admin/orders/${o.id}`} className="font-medium underline">{o.order_number}</Link></td>
              <td className="px-3 py-2">{o.email}</td><td className="px-3 py-2">{STATUS_LABEL[o.status]}</td>
              <td className="px-3 py-2 whitespace-nowrap">{o.placed_at.slice(0, 16).replace('T', ' ')}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatMoney(Number(o.total_minor), o.currency.trim() as CurrencyCode)}</td>
            </tr>))}
        </Table>
      ) : <p className="border border-line bg-white p-6 text-center text-muted">No orders match.</p>}
      <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pages">
        {page > 1 ? <Link href={`/admin/orders?${qs(page - 1)}`} className="btn-outline">Previous</Link> : <span />}
        <span className="text-muted">Page {page} of {pages} ({count ?? 0} orders)</span>
        {page < pages ? <Link href={`/admin/orders?${qs(page + 1)}`} className="btn-outline">Next</Link> : <span />}
      </nav>
    </>
  );
}
