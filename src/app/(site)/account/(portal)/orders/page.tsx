import Link from 'next/link';
import { requireCustomer } from '@/lib/customer/auth';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';
import { createServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Orders() {
  await requireCustomer('/account/orders');
  // Row-level security limits this to the signed-in customer's own orders.
  const { data, error } = await (await createServer()).from('orders').select('order_number, status, total_minor, currency, placed_at').order('placed_at', { ascending: false }).limit(100);
  if (error) throw new Error('Orders could not be loaded');
  const orders = (data ?? []) as { order_number: string; status: OrderStatus; total_minor: number; currency: string; placed_at: string }[];
  return (
    <>
      <h1 className="text-4xl">Your orders</h1>
      {orders.length ? <ul className="mt-6 divide-y divide-line border-y border-line">{orders.map((o) => (
        <li key={o.order_number}><Link href={`/account/orders/${o.order_number}`} className="grid min-h-[56px] items-center gap-1 py-3 text-sm hover:bg-white sm:grid-cols-4"><span className="font-medium">{o.order_number}</span><span className="text-muted">{o.placed_at.slice(0, 10)}</span><span>{STATUS_LABEL[o.status]}</span><span className="sm:text-right">{formatMoney(Number(o.total_minor), o.currency.trim() as CurrencyCode)}</span></Link></li>))}</ul>
        : <p className="mt-6 text-muted">You have no orders yet. <Link href="/shop" className="underline">Start shopping</Link></p>}
      <p className="mt-6 text-xs text-muted">Ordered as a guest with this email? Those orders appear here once your email is confirmed.</p>
    </>
  );
}
