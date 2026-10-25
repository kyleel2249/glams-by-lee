import Link from 'next/link';
import { requireCustomer } from '@/lib/customer/auth';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';
import { createServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Overview({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const customer = await requireCustomer();
  const sp = await searchParams;
  const { data } = await (await createServer()).from('orders').select('order_number, status, total_minor, currency, placed_at').order('placed_at', { ascending: false }).limit(5);
  const orders = (data ?? []) as { order_number: string; status: OrderStatus; total_minor: number; currency: string; placed_at: string }[];
  return (
    <>
      <h1 className="text-4xl">Welcome{customer.name ? `, ${customer.name.split(' ')[0]}` : ''}</h1>
      {sp.ok ? <p role="status" className="mt-4 border border-gold bg-white p-3 text-sm text-gold-deep">{sp.ok}</p> : null}
      {!customer.emailVerified ? <p className="mt-4 border border-line bg-white p-3 text-sm">Please confirm your email address. Past guest orders are added to your account once it is confirmed.</p> : null}
      <h2 className="mt-8 text-2xl">Recent orders</h2>
      {orders.length ? <ul className="mt-3 divide-y divide-line border-y border-line">{orders.map((o) => (
        <li key={o.order_number}><Link href={`/account/orders/${o.order_number}`} className="flex min-h-[48px] flex-wrap items-center justify-between gap-2 py-2 text-sm hover:bg-white"><span className="font-medium">{o.order_number}</span><span className="text-muted">{STATUS_LABEL[o.status]}</span><span>{formatMoney(Number(o.total_minor), o.currency.trim() as CurrencyCode)}</span></Link></li>))}</ul>
        : <p className="mt-3 text-muted">No orders yet. <Link href="/shop" className="underline">Start shopping</Link></p>}
      {orders.length ? <p className="mt-3 text-sm"><Link href="/account/orders" className="underline">See all orders</Link></p> : null}
    </>
  );
}
