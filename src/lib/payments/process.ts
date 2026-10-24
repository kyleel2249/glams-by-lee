import type { PaymentProvider, VerifiedTransaction } from './types';

export type ApplyOutcome = 'paid' | 'already_processed' | 'mismatch' | 'unknown_reference' | 'paid_on_closed_order';
export type ConfirmOutcome = ApplyOutcome | 'pending' | 'failed' | 'abandoned';

/** Database operations the payment flow needs. Implemented with Supabase in paymentStore.ts; faked in tests. */
export interface PaymentStore {
  recordWebhookEvent(e: { provider: string; eventId: string; eventType: string; reference: string | null; payload: unknown }): Promise<{ id: string; alreadyProcessed: boolean }>;
  markEvent(id: string, error: string | null): Promise<void>;
  applyVerifiedPayment(a: { reference: string; providerTransactionId: string; amountMinor: number; currency: string; channel?: string }): Promise<ApplyOutcome>;
  markPaymentFailed(reference: string, reason: string, abandoned: boolean): Promise<void>;
}

/**
 * The ONLY path that can lead to "paid". It asks the provider directly (never trusts the browser redirect or webhook body),
 * then the database re-checks amount, currency and order before marking the order paid. Idempotent.
 */
export async function confirmPayment(reference: string, provider: PaymentProvider, store: PaymentStore): Promise<ConfirmOutcome> {
  const tx: VerifiedTransaction = await provider.verify(reference);
  if (tx.status === 'success') {
    return store.applyVerifiedPayment({ reference, providerTransactionId: tx.providerTransactionId, amountMinor: tx.amountMinor, currency: tx.currency, channel: tx.channel });
  }
  if (tx.status === 'failed' || tx.status === 'abandoned') {
    await store.markPaymentFailed(reference, `Provider reported ${tx.status}`, tx.status === 'abandoned');
    return tx.status;
  }
  return 'pending';
}

export interface WebhookDeps { provider: PaymentProvider; store: PaymentStore; onPaid?: (reference: string) => Promise<void> }
export interface WebhookResponse { status: number; body: string }

export async function handleProviderWebhook(rawBody: string, signature: string | null, deps: WebhookDeps): Promise<WebhookResponse> {
  const { provider, store } = deps;
  if (!provider.verifyWebhookSignature(rawBody, signature)) return { status: 401, body: 'invalid signature' };

  let parsed: { event?: unknown; data?: { id?: unknown; reference?: unknown } };
  try { parsed = JSON.parse(rawBody); } catch { return { status: 400, body: 'invalid json' }; }
  const event = typeof parsed.event === 'string' ? parsed.event : null;
  const reference = typeof parsed.data?.reference === 'string' ? parsed.data.reference : null;
  if (!event) return { status: 400, body: 'missing event' };

  const stableId = parsed.data?.id ?? reference;
  const eventId = `${event}:${String(stableId ?? 'unknown')}`;
  let rec: { id: string; alreadyProcessed: boolean };
  try { rec = await store.recordWebhookEvent({ provider: provider.name, eventId, eventType: event, reference, payload: parsed }); }
  catch (e) { console.error('webhook event could not be recorded', e instanceof Error ? e.message : e); return { status: 500, body: 'retry' }; }
  if (rec.alreadyProcessed) return { status: 200, body: 'duplicate' };

  if (event !== 'charge.success' || !reference) { await store.markEvent(rec.id, null); return { status: 200, body: 'ignored' }; }

  try {
    const outcome = await confirmPayment(reference, provider, store);
    const flagged = outcome === 'mismatch' || outcome === 'unknown_reference' || outcome === 'paid_on_closed_order';
    await store.markEvent(rec.id, flagged ? outcome : null);
    if (outcome === 'paid' && deps.onPaid) { try { await deps.onPaid(reference); } catch (e) { console.error('post-payment hook failed', e instanceof Error ? e.message : e); } }
    return { status: 200, body: outcome };
  } catch (e) {
    // Leave the event unprocessed and answer 500 so the provider retries later.
    await store.markEvent(rec.id, `processing failed: ${e instanceof Error ? e.message : 'unknown'}`.slice(0, 300)).catch(() => {});
    return { status: 500, body: 'retry' };
  }
}
