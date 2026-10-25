import { notFound, redirect } from 'next/navigation';
import { requireCustomer } from '@/lib/customer/auth';
import { orderLinkSecret } from '@/lib/env';
import { orderUrl } from '@/lib/orderLink';
import { createServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Ownership is proven by row-level security (the query only returns the signed-in customer's orders); then we hand off to the signed order page. */
export default async function AccountOrder({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  await requireCustomer(`/account/orders/${number}`);
  if (!/^GBL-\d{4}-\d{6}$/.test(number) || !process.env.ORDER_LINK_SECRET) notFound();
  const { data } = await (await createServer()).from('orders').select('order_number').eq('order_number', number).maybeSingle();
  if (!data) notFound();
  redirect(orderUrl(process.env.NEXT_PUBLIC_SITE_URL ?? '', number, orderLinkSecret()));
}
