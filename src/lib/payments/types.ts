import type { CurrencyCode } from '@/lib/money';

export type ProviderName = 'paystack' | 'flutterwave';

export interface InitializeInput {
  orderId: string;
  reference: string;          // our unique payment reference
  email: string;
  amountMinor: number;        // always computed server-side from the persisted order
  currency: CurrencyCode;
  callbackUrl: string;
}
export interface InitializeResult { authorizationUrl: string; providerReference: string }

export interface VerifiedTransaction {
  reference: string;
  providerTransactionId: string;
  status: 'success' | 'failed' | 'abandoned' | 'pending';
  amountMinor: number;
  currency: CurrencyCode;
  channel?: string;
}

/** Every provider implements this so checkout code never depends on one vendor. */
export interface PaymentProvider {
  readonly name: ProviderName;
  initialize(input: InitializeInput): Promise<InitializeResult>;
  verify(reference: string): Promise<VerifiedTransaction>;
  /** Must use the RAW request body, never re-serialised JSON. */
  verifyWebhookSignature(rawBody: string, signature: string | null): boolean;
}
