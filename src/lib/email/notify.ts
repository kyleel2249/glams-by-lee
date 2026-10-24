import 'server-only';
import { createAdmin } from '@/lib/supabase/admin';
import { orderLinkSecret } from '@/lib/env';
import { orderUrl } from '@/lib/orderLink';
import { whatsAppLink } from '@/lib/whatsapp';
import { sendEmail } from './send';
import { paymentConfirmationEmail, shippedEmail, type EmailOrder } from './templates';

/**
 * Queues and sends the "payment confirmed" email, exactly once per order (unique index on notification_events).
 * Without EMAIL_PROVIDER_API_KEY + EMAIL_FROM the row stays 'queued' so nothing is lost and nothing is falsely reported as sent.
 */
export async function sendPaymentConfirmation(reference: string): Promise<void> {
  const db = createAdmin();
  const { data: pay } = await db.from('payments').select('order_id').eq('reference', reference).maybeSingle();
  const orderId = (pay as { order_id: string } | null)?.order_id;
  if (!orderId) return;

  const { data: o } = await db.from('orders').select('order_number, email, currency, subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor, shipping_method_name, shipping_address, status').eq('id', orderId).single();
  const order = o as { order_number: string; email: string; currency: string; subtotal_minor: number; discount_minor: number; shipping_minor: number; tax_minor: number; total_minor: number; shipping_method_name: string | null; shipping_address: { name?: string; city?: string; country?: string }; status: string } | null;
  if (!order || order.status === 'pending_payment') return;

  const { error: qErr } = await db.from('notification_events').insert({ order_id: orderId, template: 'payment_confirmation', recipient: order.email, status: 'queued' });
  if (qErr) { if (qErr.code !== '23505') console.error('could not queue email', qErr.code); return; }   // 23505 = already queued: do not double send

  const key = process.env.EMAIL_PROVIDER_API_KEY, from = process.env.EMAIL_FROM;
  if (!key || !from) return;

  const [{ data: items }, { data: wa }] = await Promise.all([
    db.from('order_items').select('product_name, variant_attributes, quantity, line_total_minor').eq('order_id', orderId),
    db.from('admin_settings').select('value').eq('key', 'whatsapp_number').maybeSingle(),
  ]);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const attrs = (a: Record<string, unknown>) => [a.length_inches ? `${a.length_inches} in` : null, a.color, a.density, a.cap_size, a.texture].filter((x): x is string => typeof x === 'string' && x.length > 0);
  const emailOrder: EmailOrder = {
    orderNumber: order.order_number, currency: order.currency.trim(), subtotalMinor: Number(order.subtotal_minor), discountMinor: Number(order.discount_minor),
    shippingMinor: Number(order.shipping_minor), taxMinor: Number(order.tax_minor), totalMinor: Number(order.total_minor),
    items: ((items ?? []) as { product_name: string; variant_attributes: Record<string, unknown>; quantity: number; line_total_minor: number }[]).map((i) => ({ name: i.product_name, attributes: attrs(i.variant_attributes ?? {}), quantity: i.quantity, lineTotalMinor: Number(i.line_total_minor) })),
    shippingMethod: order.shipping_method_name,
    deliveryTo: [order.shipping_address?.name, order.shipping_address?.city, order.shipping_address?.country].filter(Boolean).join(', '),
    orderUrl: orderUrl(site, order.order_number, orderLinkSecret()),
    whatsappUrl: whatsAppLink((wa as { value: unknown } | null)?.value, `Hello GLAMS BY LEE, my order number is ${order.order_number}.`),
  };
  const mail = paymentConfirmationEmail(emailOrder);
  const result = await sendEmail({ to: order.email, ...mail }, { apiKey: key, from });
  await db.from('notification_events').update(result.ok ? { status: 'sent', sent_at: new Date().toISOString(), attempts: 1 } : { status: 'failed', attempts: 1, last_error: result.error })
    .eq('order_id', orderId).eq('template', 'payment_confirmation');
}

/** Admin "resend": clears the once-only marker so the confirmation can be sent again, then sends it. */
export async function resendPaymentConfirmation(orderId: string): Promise<boolean> {
  const db = createAdmin();
  const { data } = await db.from('payments').select('reference').eq('order_id', orderId).in('status', ['succeeded', 'partially_refunded', 'refunded']).order('created_at', { ascending: false }).limit(1);
  const ref = (data as { reference: string }[] | null)?.[0]?.reference;
  if (!ref) return false;
  await db.from('notification_events').delete().eq('order_id', orderId).eq('template', 'payment_confirmation');
  await sendPaymentConfirmation(ref);
  return true;
}

/** "Your order has shipped" email, once per order. Needs the same email settings as the payment confirmation. */
export async function sendShippedNotification(orderId: string): Promise<void> {
  const db = createAdmin();
  const { data: o } = await db.from('orders').select('order_number, email').eq('id', orderId).single();
  const order = o as { order_number: string; email: string } | null;
  if (!order) return;
  const { data: s } = await db.from('shipments').select('carrier, tracking_number, tracking_url').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1);
  const ship = (s as { carrier: string | null; tracking_number: string | null; tracking_url: string | null }[] | null)?.[0];
  if (!ship?.carrier || !ship.tracking_number) return;
  const { error: qErr } = await db.from('notification_events').insert({ order_id: orderId, template: 'order_shipped', recipient: order.email, status: 'queued' });
  if (qErr) { if (qErr.code !== '23505') console.error('could not queue shipped email', qErr.code); return; }
  const key = process.env.EMAIL_PROVIDER_API_KEY, from = process.env.EMAIL_FROM;
  if (!key || !from) return;
  const { data: wa } = await db.from('admin_settings').select('value').eq('key', 'whatsapp_number').maybeSingle();
  const mail = shippedEmail({
    orderNumber: order.order_number, carrier: ship.carrier, trackingNumber: ship.tracking_number, trackingUrl: ship.tracking_url?.startsWith('https://') ? ship.tracking_url : null,
    orderUrl: orderUrl(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000', order.order_number, orderLinkSecret()),
    whatsappUrl: whatsAppLink((wa as { value: unknown } | null)?.value, `Hello GLAMS BY LEE, my order number is ${order.order_number}.`),
  });
  const result = await sendEmail({ to: order.email, ...mail }, { apiKey: key, from });
  await db.from('notification_events').update(result.ok ? { status: 'sent', sent_at: new Date().toISOString(), attempts: 1 } : { status: 'failed', attempts: 1, last_error: result.error }).eq('order_id', orderId).eq('template', 'order_shipped');
}
