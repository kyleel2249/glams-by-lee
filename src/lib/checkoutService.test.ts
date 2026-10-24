import { describe, it, expect, vi } from 'vitest';
import { restartPayment, startCheckout, type CheckoutDb } from './checkoutService';
import type { PaymentProvider } from './payments/types';

const items = [{ variant_id: 'v1', quantity: 1, unit_price_minor: 100000 }];
const order = (total = 185000) => ({ total_minor: total, email: 'a@b.co' });
function mk(over: Partial<CheckoutDb> = {}, initFails = false) {
  const db: CheckoutDb = {
    placeOrder: vi.fn(async () => ({ orderId: 'o1', isNew: true })),
    getOrder: vi.fn(async () => ({ orderNumber: 'GBL-2610-001001', totalMinor: 185000, currency: 'GHS', email: 'a@b.co', status: 'pending_payment' })),
    latestPayment: vi.fn(async () => null), createPayment: vi.fn(async () => {}), setAuthorizationUrl: vi.fn(async () => {}),
    failPayment: vi.fn(async () => {}), cancelUnpaid: vi.fn(async () => {}), ...over,
  };
  const provider: PaymentProvider = {
    name: 'paystack', verify: vi.fn(), verifyWebhookSignature: () => true,
    initialize: vi.fn(async () => { if (initFails) throw new Error('paystack down'); return { authorizationUrl: 'https://pay.test/abc', providerReference: 'ref' }; }),
  };
  return { db, provider, deps: { db, provider, newReference: () => 'GBL-ref1' } };
}

describe('startCheckout', () => {
  it('charges the persisted order total, not anything from the request', async () => {
    const m = mk(); const r = await startCheckout({ order: order(1), items, callbackUrl: 'https://x/return' }, m.deps);
    expect(r).toEqual({ ok: true, orderNumber: 'GBL-2610-001001', authorizationUrl: 'https://pay.test/abc' });
    expect(m.provider.initialize).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 185000, currency: 'GHS', reference: 'GBL-ref1' }));
    expect(m.db.createPayment).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 185000 }));
  });
  it('records the payment attempt BEFORE contacting the provider', async () => {
    const calls: string[] = []; const m = mk({ createPayment: vi.fn(async () => { calls.push('payment'); }) });
    (m.provider.initialize as ReturnType<typeof vi.fn>).mockImplementation(async () => { calls.push('init'); return { authorizationUrl: 'u', providerReference: 'r' }; });
    await startCheckout({ order: order(), items, callbackUrl: 'c' }, m.deps); expect(calls).toEqual(['payment', 'init']);
  });
  it('cancels the order and releases stock if the provider fails', async () => {
    const m = mk({}, true); const r = await startCheckout({ order: order(), items, callbackUrl: 'c' }, m.deps);
    expect(r).toMatchObject({ ok: false, status: 502 }); expect(m.db.failPayment).toHaveBeenCalled(); expect(m.db.cancelUnpaid).toHaveBeenCalledWith('o1');
  });
  it('a duplicate submission returns the existing payment link without a second provider call', async () => {
    const m = mk({ placeOrder: vi.fn(async () => ({ orderId: 'o1', isNew: false })), latestPayment: vi.fn(async () => ({ reference: 'old', authorizationUrl: 'https://pay.test/old' })) });
    const r = await startCheckout({ order: order(), items, callbackUrl: 'c' }, m.deps);
    expect(r).toMatchObject({ ok: true, authorizationUrl: 'https://pay.test/old' }); expect(m.provider.initialize).not.toHaveBeenCalled();
  });
  it('refuses a duplicate for an order that is already paid', async () => {
    const m = mk({ placeOrder: vi.fn(async () => ({ orderId: 'o1', isNew: false })), getOrder: vi.fn(async () => ({ orderNumber: 'N', totalMinor: 1, currency: 'GHS', email: 'a', status: 'paid' })) });
    expect(await startCheckout({ order: order(), items, callbackUrl: 'c' }, m.deps)).toMatchObject({ ok: false, status: 409 });
  });
  it('maps database business errors to friendly 409s', async () => {
    for (const code of ['P0001', 'P0002', 'P0003', 'P0004']) {
      const m = mk({ placeOrder: vi.fn(async () => { throw Object.assign(new Error('x'), { code }); }) });
      expect(await startCheckout({ order: order(), items, callbackUrl: 'c' }, m.deps)).toMatchObject({ ok: false, status: 409 });
    }
  });
  it('rethrows unexpected database errors', async () => {
    const m = mk({ placeOrder: vi.fn(async () => { throw new Error('boom'); }) });
    await expect(startCheckout({ order: order(), items, callbackUrl: 'c' }, m.deps)).rejects.toThrow('boom');
  });
  it('refuses zero-total orders', async () => expect(await startCheckout({ order: order(0), items, callbackUrl: 'c' }, mk().deps)).toMatchObject({ ok: false, status: 400 }));
});

describe('restartPayment', () => {
  it('creates a fresh payment for the persisted total', async () => {
    const m = mk(); const r = await restartPayment('o1', 'https://x/return', m.deps);
    expect(r).toMatchObject({ ok: true, authorizationUrl: 'https://pay.test/abc' });
    expect(m.provider.initialize).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 185000 }));
  });
  it('refuses paid or cancelled orders', async () => {
    for (const status of ['paid', 'cancelled', 'shipped']) {
      const m = mk({ getOrder: vi.fn(async () => ({ orderNumber: 'N', totalMinor: 1, currency: 'GHS', email: 'a', status })) });
      expect(await restartPayment('o1', 'c', m.deps)).toMatchObject({ ok: false, status: 409 }); expect(m.provider.initialize).not.toHaveBeenCalled();
    }
  });
  it('keeps the order open when the provider fails so the customer can try again', async () => {
    const m = mk({}, true); expect(await restartPayment('o1', 'c', m.deps)).toMatchObject({ ok: false, status: 502 }); expect(m.db.cancelUnpaid).not.toHaveBeenCalled();
  });
});
