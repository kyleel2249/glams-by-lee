import type { PaymentProvider } from './payments/types';
import type { CurrencyCode } from './money';

export interface OrderRow { orderNumber: string; totalMinor: number; currency: string; email: string; status: string }
export interface CheckoutDb {
  placeOrder(order: Record<string, unknown>, items: { variant_id: string; quantity: number; unit_price_minor: number }[]): Promise<{ orderId: string; isNew: boolean }>;
  getOrder(orderId: string): Promise<OrderRow>;
  latestPayment(orderId: string): Promise<{ reference: string; authorizationUrl: string | null } | null>;
  createPayment(p: { orderId: string; reference: string; amountMinor: number; currency: string }): Promise<void>;
  setAuthorizationUrl(reference: string, url: string): Promise<void>;
  failPayment(reference: string, reason: string): Promise<void>;
  cancelUnpaid(orderId: string): Promise<void>;
}
export type StartResult = { ok: true; orderNumber: string; authorizationUrl: string } | { ok: false; status: number; error: string };

const DB_ERRORS: Record<string, [number, string]> = {
  P0001: [409, 'Some items in your bag just sold out. Please review your bag.'],
  P0002: [409, 'An item in your bag is no longer available. Please review your bag.'],
  P0003: [409, 'A price changed while you were checking out. Please review your bag.'],
  P0004: [409, 'That discount code could not be applied.'],
};

/**
 * Places the order (one database transaction), records a payment attempt, then asks the provider for a hosted payment page.
 * The amount sent to the provider is read back from the PERSISTED order, never from the request.
 */
export async function startCheckout(
  input: { order: Record<string, unknown>; items: { variant_id: string; quantity: number; unit_price_minor: number }[]; callbackUrl: string },
  deps: { db: CheckoutDb; provider: PaymentProvider; newReference: () => string },
): Promise<StartResult> {
  const { db, provider } = deps;
  if (Number(input.order.total_minor) <= 0) return { ok: false, status: 400, error: 'Orders with a zero total are not supported yet. Please contact us to order.' };

  let placed: { orderId: string; isNew: boolean };
  try { placed = await db.placeOrder(input.order, input.items); }
  catch (e) {
    const mapped = DB_ERRORS[(e as { code?: string }).code ?? ''];
    if (mapped) return { ok: false, status: mapped[0], error: mapped[1] };
    throw e;
  }

  const order = await db.getOrder(placed.orderId);
  if (!placed.isNew) {
    if (!['pending_payment', 'payment_failed', 'payment_processing'].includes(order.status)) return { ok: false, status: 409, error: 'This order has already been processed.' };
    const prior = await db.latestPayment(placed.orderId);
    if (prior?.authorizationUrl) return { ok: true, orderNumber: order.orderNumber, authorizationUrl: prior.authorizationUrl };
  }

  const reference = deps.newReference();
  await db.createPayment({ orderId: placed.orderId, reference, amountMinor: order.totalMinor, currency: order.currency });
  try {
    const init = await provider.initialize({ orderId: placed.orderId, reference, email: order.email, amountMinor: order.totalMinor, currency: order.currency as CurrencyCode, callbackUrl: input.callbackUrl });
    await db.setAuthorizationUrl(reference, init.authorizationUrl);
    return { ok: true, orderNumber: order.orderNumber, authorizationUrl: init.authorizationUrl };
  } catch (e) {
    console.error('payment initialisation failed', e instanceof Error ? e.message : e);
    await db.failPayment(reference, 'Could not start payment').catch(() => {});
    if (placed.isNew) await db.cancelUnpaid(placed.orderId).catch(() => {});   // release stock and discount straight away
    return { ok: false, status: 502, error: 'We could not start your payment. Nothing was charged. Please try again.' };
  }
}

/** "Pay again" for an existing unpaid order. New payment reference each time; the amount still comes from the persisted order. */
export async function restartPayment(
  orderId: string, callbackUrl: string, deps: { db: CheckoutDb; provider: PaymentProvider; newReference: () => string },
): Promise<StartResult> {
  const { db, provider } = deps;
  const order = await db.getOrder(orderId);
  if (!['pending_payment', 'payment_failed', 'payment_processing'].includes(order.status)) return { ok: false, status: 409, error: 'This order can no longer be paid. Please place a new order.' };
  const reference = deps.newReference();
  await db.createPayment({ orderId, reference, amountMinor: order.totalMinor, currency: order.currency });
  try {
    const init = await provider.initialize({ orderId, reference, email: order.email, amountMinor: order.totalMinor, currency: order.currency as CurrencyCode, callbackUrl });
    await db.setAuthorizationUrl(reference, init.authorizationUrl);
    return { ok: true, orderNumber: order.orderNumber, authorizationUrl: init.authorizationUrl };
  } catch (e) {
    console.error('payment re-initialisation failed', e instanceof Error ? e.message : e);
    await db.failPayment(reference, 'Could not start payment').catch(() => {});
    return { ok: false, status: 502, error: 'We could not start your payment. Nothing was charged. Please try again.' };
  }
}
