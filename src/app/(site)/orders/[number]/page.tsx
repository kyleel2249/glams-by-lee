import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PayNowButton } from '@/components/shop/PayNowButton';
import { orderLinkSecret } from '@/lib/env';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { verifyOrderLinkToken } from '@/lib/orderLink';
import { STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';
import { confirmPayment } from '@/lib/payments/process';
import { createSupabasePaymentStore, getPaystackProvider } from '@/lib/payments/paymentStore';
import { getSettings } from '@/lib/catalog';
import { createAdmin } from '@/lib/supabase/admin';
import { whatsAppLink } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your order', robots: { index: false, follow: false } };

interface OrderRow { id: string; order_number: string; status: OrderStatus; currency: string; subtotal_minor: number; discount_minor: number; shipping_minor: number; tax_minor: number; total_minor: number; shipping_method_name: string | null; shipping_address: { name?: string; city?: string; country?: string }; placed_at: string }

const MESSAGE: Partial<Record<OrderStatus, string>> = {
  pending_payment: 'We are waiting for your payment.', payment_processing: 'Your payment is being confirmed.', payment_failed: 'Your payment did not go through. Nothing was charged.',
  paid: 'Payment received. We will start preparing your order.', processing: 'We are preparing your order.', ready_for_dispatch: 'Your order is packed and ready for dispatch.',
  shipped: 'Your order is on its way.', delivered: 'Your order has been delivered.', cancelled: 'This order was cancelled.',
  refund_pending: 'A refund is being processed.', partially_refunded: 'Part of this order has been refunded.', refunded: 'This order has been refunded.',
};

async function load(number: string) {
  const db = createAdmin();
  const { data } = await db.from('orders').select('id, order_number, status, currency, subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor, shipping_method_name, shipping_address, placed_at').eq('order_number', number).maybeSingle();
  return data as OrderRow | null;
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ number }, { t }] = await Promise.all([params, searchParams]);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.ORDER_LINK_SECRET || !verifyOrderLinkToken(number, t, orderLinkSecret())) notFound();

  let order = await load(number);
  if (!order) notFound();
  const db = createAdmin();

  // Safe recovery path: if the customer is still shown as unpaid, ask the provider (idempotent) before rendering.
  if (['pending_payment', 'payment_processing', 'payment_failed'].includes(order.status) && process.env.PAYSTACK_SECRET_KEY) {
    try {
      const { data: p } = await db.from('payments').select('reference').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1);
      const ref = (p as { reference: string }[] | null)?.[0]?.reference;
      if (ref) { await confirmPayment(ref, getPaystackProvider(), createSupabasePaymentStore()); order = (await load(number)) ?? order; }
    } catch (e) { console.error('order recheck failed', e instanceof Error ? e.message : e); }
  }

  const [{ data: items }, { data: ships }, settings] = await Promise.all([
    db.from('order_items').select('product_name, variant_attributes, quantity, line_total_minor, image_url').eq('order_id', order.id),
    db.from('shipments').select('carrier, tracking_number, tracking_url, status').eq('order_id', order.id),
    getSettings(),
  ]);
  const cur = order.currency.trim() as CurrencyCode; const m = (n: number) => formatMoney(Number(n), cur);
  const wa = whatsAppLink(settings.whatsappNumber, `Hello GLAMS BY LEE, my order number is ${order.order_number}.`);
  const unpaid = ['pending_payment', 'payment_failed'].includes(order.status);
  const attrs = (a: Record<string, unknown>) => [a.length_inches ? `${a.length_inches} in` : null, a.color, a.density, a.cap_size].filter((x): x is string => typeof x === 'string' && x.length > 0).join(' · ');

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-muted">Order {order.order_number}</p>
      <h1 className="mt-1 text-4xl md:text-5xl">{STATUS_LABEL[order.status]}</h1>
      <p className="mt-3" role="status">{MESSAGE[order.status]}</p>
      {unpaid ? <div className="mt-6"><PayNowButton orderNumber={order.order_number} token={t!} /><p className="mt-2 text-xs text-muted">Unpaid orders are held for a limited time, then released.</p></div> : null}

      {(ships ?? []).length ? (
        <section className="mt-8 border border-line bg-white p-5" aria-labelledby="track"><h2 id="track" className="font-display text-2xl">Tracking</h2>
          <ul className="mt-3 space-y-2 text-sm">{(ships as { carrier: string | null; tracking_number: string | null; tracking_url: string | null; status: string }[]).map((s, i) => (
            <li key={i}>{s.carrier ?? 'Carrier'}{s.tracking_number ? ` · ${s.tracking_number}` : ''} · {s.status.replace(/_/g, ' ')}{s.tracking_url?.startsWith('https://') ? <> · <a className="underline" href={s.tracking_url} target="_blank" rel="noopener noreferrer">Track parcel</a></> : null}</li>))}</ul>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="items"><h2 id="items" className="font-display text-2xl">Items</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">{((items ?? []) as { product_name: string; variant_attributes: Record<string, unknown>; quantity: number; line_total_minor: number }[]).map((i, k) => (
          <li key={k} className="flex justify-between gap-4 py-3 text-sm"><span>{i.quantity} × {i.product_name}{attrs(i.variant_attributes ?? {}) ? <span className="block text-xs text-muted">{attrs(i.variant_attributes ?? {})}</span> : null}</span><span>{m(i.line_total_minor)}</span></li>))}</ul>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{m(order.subtotal_minor)}</dd></div>
          {order.discount_minor > 0 ? <div className="flex justify-between"><dt>Discount</dt><dd>−{m(order.discount_minor)}</dd></div> : null}
          <div className="flex justify-between"><dt>Delivery{order.shipping_method_name ? ` (${order.shipping_method_name})` : ''}</dt><dd>{m(order.shipping_minor)}</dd></div>
          {order.tax_minor > 0 ? <div className="flex justify-between"><dt>Tax</dt><dd>{m(order.tax_minor)}</dd></div> : null}
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{m(order.total_minor)}</dd></div>
        </dl>
      </section>
      <p className="mt-6 text-sm text-muted">Delivering to {[order.shipping_address?.name, order.shipping_address?.city, order.shipping_address?.country].filter(Boolean).join(', ')}.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-outline">Ask about this order on WhatsApp</a> : null}
        <Link href="/shop" className="btn-gold">Continue shopping</Link>
      </div>
      <p className="mt-8 text-xs text-muted">Keep this page’s link private: anyone with it can view this order.</p>
    </main>
  );
}
