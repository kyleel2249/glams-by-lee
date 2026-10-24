import { describe, it, expect, vi } from 'vitest';
import { confirmPayment, handleProviderWebhook, type ApplyOutcome, type PaymentStore } from './process';
import type { PaymentProvider, VerifiedTransaction } from './types';

function fakeProvider(tx: Partial<VerifiedTransaction> | Error, sigOk = true): PaymentProvider {
  return {
    name: 'paystack',
    initialize: vi.fn(),
    verify: vi.fn(async () => { if (tx instanceof Error) throw tx; return { reference: 'r1', providerTransactionId: '99', status: 'success', amountMinor: 185000, currency: 'GHS', ...tx } as VerifiedTransaction; }),
    verifyWebhookSignature: () => sigOk,
  };
}
function fakeStore(apply: ApplyOutcome = 'paid') {
  const events = new Map<string, { id: string; processed: boolean; error: string | null }>();
  const store: PaymentStore & { events: typeof events } = {
    events,
    recordWebhookEvent: vi.fn(async (e) => { const ex = events.get(e.eventId); if (ex) return { id: ex.id, alreadyProcessed: ex.processed }; const row = { id: `e${events.size + 1}`, processed: false, error: null }; events.set(e.eventId, row); return { id: row.id, alreadyProcessed: false }; }),
    markEvent: vi.fn(async (id, error) => { for (const v of events.values()) if (v.id === id) { v.processed = error === null || !error.startsWith('processing failed'); v.error = error; } }),
    applyVerifiedPayment: vi.fn(async () => apply),
    markPaymentFailed: vi.fn(async () => {}),
  };
  return store;
}
const body = JSON.stringify({ event: 'charge.success', data: { id: 555, reference: 'r1' } });

describe('confirmPayment', () => {
  it('applies a verified success', async () => { const s = fakeStore(); expect(await confirmPayment('r1', fakeProvider({}), s)).toBe('paid'); expect(s.applyVerifiedPayment).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 185000, currency: 'GHS' })); });
  it('records a failure and does not pay', async () => { const s = fakeStore(); expect(await confirmPayment('r1', fakeProvider({ status: 'failed' }), s)).toBe('failed'); expect(s.applyVerifiedPayment).not.toHaveBeenCalled(); expect(s.markPaymentFailed).toHaveBeenCalledWith('r1', expect.any(String), false); });
  it('flags abandoned payments', async () => { const s = fakeStore(); await confirmPayment('r1', fakeProvider({ status: 'abandoned' }), s); expect(s.markPaymentFailed).toHaveBeenCalledWith('r1', expect.any(String), true); });
  it('stays pending without touching the order', async () => { const s = fakeStore(); expect(await confirmPayment('r1', fakeProvider({ status: 'pending' }), s)).toBe('pending'); expect(s.applyVerifiedPayment).not.toHaveBeenCalled(); });
  it('passes through database mismatch', async () => expect(await confirmPayment('r1', fakeProvider({ amountMinor: 1 }), fakeStore('mismatch'))).toBe('mismatch'));
});

describe('webhook', () => {
  it('rejects an invalid signature before touching anything', async () => {
    const s = fakeStore(); const r = await handleProviderWebhook(body, 'bad', { provider: fakeProvider({}, false), store: s });
    expect(r.status).toBe(401); expect(s.recordWebhookEvent).not.toHaveBeenCalled(); expect(s.applyVerifiedPayment).not.toHaveBeenCalled();
  });
  it('rejects malformed JSON and missing event', async () => {
    expect((await handleProviderWebhook('{nope', 's', { provider: fakeProvider({}), store: fakeStore() })).status).toBe(400);
    expect((await handleProviderWebhook('{}', 's', { provider: fakeProvider({}), store: fakeStore() })).status).toBe(400);
  });
  it('processes a charge.success once and fires the paid hook once', async () => {
    const s = fakeStore(); const onPaid = vi.fn(async () => {}); const deps = { provider: fakeProvider({}), store: s, onPaid };
    expect((await handleProviderWebhook(body, 's', deps)).body).toBe('paid');
    expect((await handleProviderWebhook(body, 's', deps)).body).toBe('duplicate');
    expect(s.applyVerifiedPayment).toHaveBeenCalledTimes(1); expect(onPaid).toHaveBeenCalledTimes(1);
  });
  it('does not trust the webhook body for the amount: it re-verifies with the provider', async () => {
    const p = fakeProvider({}); await handleProviderWebhook(JSON.stringify({ event: 'charge.success', data: { id: 1, reference: 'r1', amount: 1 } }), 's', { provider: p, store: fakeStore() });
    expect(p.verify).toHaveBeenCalledWith('r1');
  });
  it('answers 500 (so the provider retries) when verification throws, and the retry succeeds', async () => {
    const s = fakeStore(); const failing = fakeProvider(new Error('network'));
    expect((await handleProviderWebhook(body, 's', { provider: failing, store: s })).status).toBe(500);
    expect((await handleProviderWebhook(body, 's', { provider: fakeProvider({}), store: s })).body).toBe('paid');
  });
  it('answers 500 so the provider retries when the event cannot even be recorded', async () => {
    const s = fakeStore(); (s.recordWebhookEvent as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('db down'));
    const r = await handleProviderWebhook(body, 's', { provider: fakeProvider({}), store: s });
    expect(r.status).toBe(500); expect(s.applyVerifiedPayment).not.toHaveBeenCalled();
  });
  it('ignores unrelated events with 200', async () => expect((await handleProviderWebhook(JSON.stringify({ event: 'transfer.success', data: { id: 3 } }), 's', { provider: fakeProvider({}), store: fakeStore() })).body).toBe('ignored'));
  it('survives an email-hook failure', async () => {
    const r = await handleProviderWebhook(body, 's', { provider: fakeProvider({}), store: fakeStore(), onPaid: async () => { throw new Error('smtp down'); } });
    expect(r).toEqual({ status: 200, body: 'paid' });
  });
});
