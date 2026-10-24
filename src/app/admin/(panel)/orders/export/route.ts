import { requirePermission } from '@/lib/admin/auth';
import { recordAudit } from '@/lib/admin/audit';
import { toCsv } from '@/lib/admin/csv';
import { isDate, safeQuery as safe } from '@/lib/admin/query';
import { ORDER_STATUSES } from '@/lib/orderStatus';
import { createAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const staff = await requirePermission('orders.export');
  const u = new URL(req.url).searchParams;
  const q = safe(u.get('q')), status = u.get('status');
  let query = createAdmin().from('orders').select('order_number, email, phone, status, currency, subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor, shipping_method_name, shipping_address, placed_at, paid_at').order('placed_at', { ascending: false }).limit(5000);
  if (q) query = query.or(`order_number.ilike.%${q}%,email.ilike.%${q}%`);
  if (status && (ORDER_STATUSES as readonly string[]).includes(status)) query = query.eq('status', status);
  if (isDate(u.get('from'))) query = query.gte('placed_at', `${u.get('from')}T00:00:00Z`);
  if (isDate(u.get('to'))) query = query.lt('placed_at', new Date(Date.parse(`${u.get('to')}T00:00:00Z`) + 86_400_000).toISOString());
  const { data, error } = await query;
  if (error) return new Response('Export failed', { status: 500 });
  const rows = (data ?? []) as Record<string, unknown>[];
  const major = (n: unknown) => (Number(n) / 100).toFixed(2);
  const csv = toCsv([
    ['Order', 'Email', 'Phone', 'Status', 'Currency', 'Subtotal', 'Discount', 'Shipping', 'Tax', 'Total', 'Delivery method', 'Delivery name', 'City', 'Country', 'Placed', 'Paid'],
    ...rows.map((o) => { const a = (o.shipping_address ?? {}) as Record<string, string>; return [o.order_number, o.email, o.phone, o.status, String(o.currency).trim(), major(o.subtotal_minor), major(o.discount_minor), major(o.shipping_minor), major(o.tax_minor), major(o.total_minor), o.shipping_method_name, a.name, a.city, a.country, o.placed_at, o.paid_at] as (string | null)[]; }),
  ]);
  await recordAudit(staff.userId, 'orders.exported', 'order', null, { rows: rows.length, filters: { q, status } });
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } });
}
