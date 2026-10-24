import { handleProviderWebhook } from '@/lib/payments/process';
import { createSupabasePaymentStore, getPaystackProvider } from '@/lib/payments/paymentStore';
import { sendPaymentConfirmation } from '@/lib/email/notify';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!process.env.PAYSTACK_SECRET_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response('not configured', { status: 503 });
  const raw = await req.text();   // signature is computed over the RAW body
  const result = await handleProviderWebhook(raw, req.headers.get('x-paystack-signature'), {
    provider: getPaystackProvider(), store: createSupabasePaymentStore(), onPaid: sendPaymentConfirmation,
  });
  return new Response(result.body, { status: result.status });
}
