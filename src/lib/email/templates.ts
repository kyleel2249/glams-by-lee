import { formatMoney, type CurrencyCode } from '@/lib/money';

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface EmailOrder {
  orderNumber: string; currency: string; subtotalMinor: number; discountMinor: number; shippingMinor: number; taxMinor: number; totalMinor: number;
  items: { name: string; attributes: string[]; quantity: number; lineTotalMinor: number }[];
  shippingMethod: string | null; deliveryTo: string; orderUrl: string; whatsappUrl: string | null;
}

/** Sent only after the payment has been verified server-side. Contains no card data. */
export function paymentConfirmationEmail(o: EmailOrder): { subject: string; html: string; text: string } {
  const cur = o.currency as CurrencyCode; const m = (n: number) => formatMoney(n, cur);
  const subject = `GLAMS BY LEE: payment received for order ${o.orderNumber}`;
  const rows = o.items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #E7DFD5">${esc(i.name)}${i.attributes.length ? `<br><span style="color:#6B625C;font-size:13px">${esc(i.attributes.join(' · '))}</span>` : ''}<br><span style="color:#6B625C;font-size:13px">Qty ${i.quantity}</span></td><td style="padding:8px 0;border-bottom:1px solid #E7DFD5;text-align:right;white-space:nowrap">${esc(m(i.lineTotalMinor))}</td></tr>`).join('');
  const line = (label: string, v: number, strong = false) => `<tr><td style="padding:4px 0;${strong ? 'font-weight:bold;' : ''}">${label}</td><td style="padding:4px 0;text-align:right;${strong ? 'font-weight:bold;' : ''}">${esc(m(v))}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#F6F0E8;font-family:Arial,Helvetica,sans-serif;color:#171514">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" style="max-width:600px;background:#fff">
<tr><td style="background:#171514;color:#B9945A;text-align:center;padding:24px;font-family:Georgia,serif;font-size:26px;letter-spacing:6px">GLAMS BY LEE</td></tr>
<tr><td style="padding:28px">
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 8px">Thank you. Your payment is confirmed.</h1>
<p style="margin:0 0 20px;color:#6B625C">Order ${esc(o.orderNumber)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
${line('Subtotal', o.subtotalMinor)}${o.discountMinor ? line('Discount', -o.discountMinor) : ''}${line(o.shippingMethod ? `Delivery (${esc(o.shippingMethod)})` : 'Delivery', o.shippingMinor)}${o.taxMinor ? line('Tax', o.taxMinor) : ''}${line('Total paid', o.totalMinor, true)}</table>
<p style="margin:20px 0 4px"><strong>Delivering to</strong><br>${esc(o.deliveryTo)}</p>
<p style="margin:24px 0"><a href="${esc(o.orderUrl)}" style="background:#B9945A;color:#171514;padding:12px 24px;text-decoration:none;display:inline-block">View your order</a></p>
${o.whatsappUrl ? `<p style="color:#6B625C;font-size:14px">Questions? <a href="${esc(o.whatsappUrl)}" style="color:#7A5C2B">Message us on WhatsApp</a> and quote your order number.</p>` : ''}
<p style="color:#6B625C;font-size:12px;margin-top:24px">This email confirms a verified payment. We will update you when your order ships. Keep this link private: anyone with it can view this order.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [`GLAMS BY LEE`, `Payment confirmed for order ${o.orderNumber}`, '',
    ...o.items.map((i) => `${i.quantity} x ${i.name}${i.attributes.length ? ` (${i.attributes.join(', ')})` : ''}  ${m(i.lineTotalMinor)}`), '',
    `Subtotal: ${m(o.subtotalMinor)}`, ...(o.discountMinor ? [`Discount: -${m(o.discountMinor)}`] : []), `Delivery: ${m(o.shippingMinor)}`, ...(o.taxMinor ? [`Tax: ${m(o.taxMinor)}`] : []), `Total paid: ${m(o.totalMinor)}`, '',
    `Delivering to: ${o.deliveryTo}`, `View your order: ${o.orderUrl}`].join('\n');
  return { subject, html, text };
}

export interface ShippedEmail { orderNumber: string; carrier: string; trackingNumber: string; trackingUrl: string | null; orderUrl: string; whatsappUrl: string | null }

export function shippedEmail(o: ShippedEmail): { subject: string; html: string; text: string } {
  const subject = `GLAMS BY LEE: order ${o.orderNumber} is on its way`;
  const html = `<!doctype html><html><body style="margin:0;background:#F6F0E8;font-family:Arial,Helvetica,sans-serif;color:#171514"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" style="max-width:600px;background:#fff"><tr><td style="background:#171514;color:#B9945A;text-align:center;padding:24px;font-family:Georgia,serif;font-size:26px;letter-spacing:6px">GLAMS BY LEE</td></tr>
<tr><td style="padding:28px"><h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 8px">Your order is on its way.</h1><p style="margin:0 0 20px;color:#6B625C">Order ${esc(o.orderNumber)}</p>
<p><strong>${esc(o.carrier)}</strong><br>Tracking number: ${esc(o.trackingNumber)}</p>
${o.trackingUrl ? `<p><a href="${esc(o.trackingUrl)}" style="background:#B9945A;color:#171514;padding:12px 24px;text-decoration:none;display:inline-block">Track your parcel</a></p>` : ''}
<p><a href="${esc(o.orderUrl)}" style="color:#7A5C2B">View your order</a></p>
${o.whatsappUrl ? `<p style="color:#6B625C;font-size:14px">Questions? <a href="${esc(o.whatsappUrl)}" style="color:#7A5C2B">Message us on WhatsApp</a>.</p>` : ''}</td></tr></table></td></tr></table></body></html>`;
  const text = [`GLAMS BY LEE`, `Order ${o.orderNumber} is on its way.`, `${o.carrier}: ${o.trackingNumber}`, ...(o.trackingUrl ? [`Track: ${o.trackingUrl}`] : []), `Your order: ${o.orderUrl}`].join('\n');
  return { subject, html, text };
}
