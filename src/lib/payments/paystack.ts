import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CurrencyCode } from '@/lib/money';
import type { InitializeInput, InitializeResult, PaymentProvider, VerifiedTransaction } from './types';

const API = 'https://api.paystack.co';

/** Paystack signs the raw body with HMAC-SHA512 using your secret key (x-paystack-signature header). */
export function verifyPaystackSignature(rawBody: string, signature: string | null, secretKey: string): boolean {
  if (!signature || !secretKey) return false;
  const expected = createHmac('sha512', secretKey).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createPaystackProvider(secretKey: string): PaymentProvider {
  const headers = { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' };
  return {
    name: 'paystack',
    async initialize(i: InitializeInput): Promise<InitializeResult> {
      const res = await fetch(`${API}/transaction/initialize`, {
        method: 'POST', headers,
        body: JSON.stringify({ email: i.email, amount: i.amountMinor, currency: i.currency, reference: i.reference, callback_url: i.callbackUrl, metadata: { order_id: i.orderId } }),
      });
      const json = await res.json();
      if (!res.ok || !json.status) throw new Error('Payment could not be started');
      return { authorizationUrl: json.data.authorization_url, providerReference: json.data.reference };
    },
    async verify(reference: string): Promise<VerifiedTransaction> {
      const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, { headers, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.status) throw new Error('Payment could not be verified');
      const d = json.data;
      const status = d.status === 'success' ? 'success' : d.status === 'abandoned' ? 'abandoned' : d.status === 'failed' ? 'failed' : 'pending';
      return { reference: d.reference, providerTransactionId: String(d.id), status, amountMinor: d.amount, currency: d.currency as CurrencyCode, channel: d.channel };
    },
    verifyWebhookSignature: (raw, sig) => verifyPaystackSignature(raw, sig, secretKey),
  };
}
