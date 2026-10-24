import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sendPaymentConfirmation } from '@/lib/email/notify';
import { orderLinkSecret } from '@/lib/env';
import { orderUrl } from '@/lib/orderLink';
import { confirmPayment } from '@/lib/payments/process';
import { createSupabasePaymentStore, getPaystackProvider } from '@/lib/payments/paymentStore';
import { createAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Confirming your payment', robots: { index: false, follow: false } };

/** Landing page after the provider's hosted checkout. The redirect itself proves nothing: we ask the provider and the database decides. */
export default async function Return({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = [sp.reference, sp.trxref].flat().find((x): x is string => typeof x === 'string');
  const ref = raw && /^[A-Za-z0-9._=-]{6,100}$/.test(raw) ? raw : null;
  if (!ref) redirect('/cart');

  let target: string | null = null;
  try {
    if (process.env.PAYSTACK_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.ORDER_LINK_SECRET) {
      const outcome = await confirmPayment(ref, getPaystackProvider(), createSupabasePaymentStore());
      if (outcome === 'paid') await sendPaymentConfirmation(ref).catch((e) => console.error('email failed', e instanceof Error ? e.message : e));
      const { data } = await createAdmin().from('payments').select('orders(order_number)').eq('reference', ref).maybeSingle();
      const orders = (data as { orders: { order_number: string } | { order_number: string }[] | null } | null)?.orders;
      const number = Array.isArray(orders) ? orders[0]?.order_number : orders?.order_number;
      if (number) target = orderUrl(process.env.NEXT_PUBLIC_SITE_URL ?? '', number, orderLinkSecret());
    }
  } catch (e) { console.error('return confirmation failed', e instanceof Error ? e.message : e); }

  if (target) redirect(target);
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-4xl">We are still confirming your payment</h1>
      <p className="mt-4 text-muted">This can take a moment. If you were charged, your order will update automatically and you will receive an email. Nothing is lost.</p>
      <div className="mt-8 flex justify-center gap-3"><Link href={`/checkout/return?reference=${encodeURIComponent(ref)}`} className="btn-gold">Check again</Link><Link href="/contact" className="btn-outline">Contact us</Link></div>
    </main>
  );
}
