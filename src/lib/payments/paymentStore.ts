import 'server-only';
import { createAdmin } from '@/lib/supabase/admin';
import { createPaystackProvider } from './paystack';
import { paystackSecretKey } from '@/lib/env';
import type { ApplyOutcome, PaymentStore } from './process';
import type { PaymentProvider } from './types';

export const getPaystackProvider = (): PaymentProvider => createPaystackProvider(paystackSecretKey());

export function createSupabasePaymentStore(): PaymentStore {
  const db = createAdmin();
  return {
    async recordWebhookEvent(e) {
      const { data, error } = await db.from('payment_events')
        .insert({ provider: e.provider, event_id: e.eventId, event_type: e.eventType, reference: e.reference, signature_valid: true, payload: e.payload })
        .select('id').single();
      if (!error && data) return { id: (data as { id: string }).id, alreadyProcessed: false };
      if (error?.code !== '23505') throw new Error(`Could not record webhook event: ${error?.message}`);
      // Same event delivered again: only skip it if the first delivery finished.
      const { data: ex, error: e2 } = await db.from('payment_events').select('id, processed_at').eq('provider', e.provider).eq('event_id', e.eventId).single();
      if (e2 || !ex) throw new Error('Could not read existing webhook event');
      const row = ex as { id: string; processed_at: string | null };
      return { id: row.id, alreadyProcessed: row.processed_at !== null };
    },
    async markEvent(id, error) {
      const retry = error?.startsWith('processing failed') ?? false;
      await db.from('payment_events').update({ processing_error: error, ...(retry ? {} : { processed_at: new Date().toISOString() }) }).eq('id', id);
    },
    async applyVerifiedPayment(a) {
      const { data, error } = await db.rpc('apply_verified_payment', {
        p_payment_reference: a.reference, p_provider_txn: a.providerTransactionId, p_amount_minor: a.amountMinor, p_currency: a.currency, p_channel: a.channel ?? null,
      });
      if (error) throw new Error(`apply_verified_payment failed: ${error.message}`);
      return data as ApplyOutcome;
    },
    async markPaymentFailed(reference, reason, abandoned) {
      const { error } = await db.rpc('mark_payment_failed', { p_reference: reference, p_reason: reason, p_abandoned: abandoned });
      if (error) throw new Error(`mark_payment_failed failed: ${error.message}`);
    },
  };
}
