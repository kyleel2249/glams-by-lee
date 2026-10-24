import { createHmac, timingSafeEqual } from 'node:crypto';

/** Unguessable, stateless order-page token: HMAC of the order number with a server secret. Needs no database column and works in emails. */
export function orderLinkToken(orderNumber: string, secret: string): string {
  return createHmac('sha256', secret).update(`order:${orderNumber}`).digest('base64url');
}
export function verifyOrderLinkToken(orderNumber: string, token: string | null | undefined, secret: string): boolean {
  if (!token || !secret) return false;
  const a = Buffer.from(orderLinkToken(orderNumber, secret)); const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const orderUrl = (siteUrl: string, orderNumber: string, secret: string) =>
  `${siteUrl.replace(/\/$/, '')}/orders/${encodeURIComponent(orderNumber)}?t=${orderLinkToken(orderNumber, secret)}`;
