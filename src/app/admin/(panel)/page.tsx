import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { can } from '@/lib/admin/permissions';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, PageTitle, Stat } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
interface Metrics {
  revenue: { currency: string; gross_minor: number; orders: number }[]; refunded: { currency: string; amount_minor: number }[]; orders_total: number; unpaid: number; awaiting_dispatch: number;
  refunds_open: number; low_stock: number; out_of_stock: number; payment_exceptions: number; best_sellers: { product_name: string; units: number }[]; daily: { day: string; currency: string; gross_minor: number; orders: number }[];
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const staff = await requirePermission('dashboard.view');
  const days = ({ '7': 7, '30': 30, '90': 90 } as Record<string, number>)[(await searchParams).range ?? ''] ?? 30;
  const to = new Date(Date.now() + 60_000), from = new Date(Date.now() - days * 86_400_000);
  const db = createAdmin();
  const { data, error } = await db.rpc('admin_metrics', { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) throw new Error('Dashboard metrics failed');
  const m = data as Metrics;
  const showOrders = can(staff.roles, 'orders.view');
  const { data: recent } = showOrders ? await db.from('orders').select('id, order_number, status, total_minor, currency, placed_at').order('placed_at', { ascending: false }).limit(8) : { data: [] };
  const money = (n: number, c: string) => formatMoney(Number(n), c.trim() as CurrencyCode);
  const refundedBy = new Map(m.refunded.map((r) => [r.currency, Number(r.amount_minor)]));
  const [{ count: pendingReviews }, { count: deletions }] = await Promise.all([
    can(staff.roles, 'reviews.moderate') ? db.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending') : Promise.resolve({ count: null }),
    can(staff.roles, 'privacy.manage') ? db.from('profiles').select('id', { count: 'exact', head: true }).not('deletion_requested_at', 'is', null) : Promise.resolve({ count: null }),
  ]);
  const maxDay = Math.max(1, ...m.daily.map((d) => Number(d.gross_minor)));

  return (
    <>
      <PageTitle title="Dashboard">
        <nav aria-label="Period" className="flex gap-2 text-sm">{[7, 30, 90].map((d) => <Link key={d} href={`/admin?range=${d}`} aria-current={d === days ? 'page' : undefined} className={`min-h-[44px] border px-4 py-2.5 ${d === days ? 'border-ink bg-ink text-ivory' : 'border-line bg-white'}`}>{d} days</Link>)}</nav>
      </PageTitle>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {m.revenue.length ? m.revenue.map((r) => <Stat key={r.currency} label={`Verified revenue (${r.currency.trim()})`} value={money(r.gross_minor - (refundedBy.get(r.currency) ?? 0), r.currency)} note={`${r.orders} paid orders. Gross ${money(r.gross_minor, r.currency)}, refunds ${money(refundedBy.get(r.currency) ?? 0, r.currency)}`} />)
          : <Stat label="Verified revenue" value="0" note="No verified payments in this period" />}
        <Stat label="Orders placed" value={m.orders_total} note="Includes unpaid" />
        <Stat label="Awaiting dispatch" value={m.awaiting_dispatch} /><Stat label="Unpaid orders" value={m.unpaid} note="Never counted as revenue" />
        <Stat label="Low stock variants" value={m.low_stock} /><Stat label="Out of stock variants" value={m.out_of_stock} />
        <Stat label="Open refunds" value={m.refunds_open} /><Stat label="Payment exceptions" value={m.payment_exceptions} note={m.payment_exceptions ? 'Mismatches or late payments need review' : 'None'} />
        {pendingReviews !== null ? <Stat label="Reviews waiting" value={pendingReviews} /> : null}{deletions !== null ? <Stat label="Deletion requests" value={deletions} /> : null}
      </dl>
      <p className="mt-2 text-xs text-muted">Revenue counts orders whose payment was verified in the period, minus refunds completed in the period. Unpaid, failed and cancelled orders are excluded.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title="Sales by day">
          {m.daily.length ? <ul className="space-y-1.5 text-sm">{m.daily.map((d) => <li key={d.day + d.currency} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3"><span className="text-muted">{d.day}</span><span className="h-3 bg-line"><span className="block h-3 bg-gold" style={{ width: `${Math.max(2, (Number(d.gross_minor) / maxDay) * 100)}%` }} /></span><span>{money(d.gross_minor, d.currency)}</span></li>)}</ul> : <p className="text-sm text-muted">No sales in this period.</p>}
        </Card>
        <Card title="Best sellers">
          {m.best_sellers.length ? <ol className="space-y-2 text-sm">{m.best_sellers.map((b) => <li key={b.product_name} className="flex justify-between"><span>{b.product_name}</span><span className="text-muted">{b.units} sold</span></li>)}</ol> : <p className="text-sm text-muted">No sales yet.</p>}
        </Card>
      </div>
      {showOrders ? (
        <div className="mt-6"><Card title="Recent orders">
          {(recent ?? []).length ? <ul className="divide-y divide-line text-sm">{(recent as { id: string; order_number: string; status: OrderStatus; total_minor: number; currency: string; placed_at: string }[]).map((o) => (
            <li key={o.id}><Link href={`/admin/orders/${o.id}`} className="flex min-h-[44px] items-center justify-between gap-3 hover:bg-ivory"><span>{o.order_number}</span><span className="text-muted">{STATUS_LABEL[o.status]}</span><span>{money(o.total_minor, o.currency)}</span></Link></li>))}</ul> : <p className="text-sm text-muted">No orders yet.</p>}
        </Card></div>
      ) : null}
    </>
  );
}
