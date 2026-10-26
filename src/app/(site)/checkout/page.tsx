import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/shop/CheckoutForm';
import { getDeliveryCountries } from '@/lib/catalog';

// Rendered per request: Cloudflare Workers has no shared page cache unless KV/R2 is configured, and shop data must never be stale.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

export default async function Checkout() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-4xl md:text-5xl">Checkout</h1>
      <CheckoutForm countries={await getDeliveryCountries()} />
    </main>
  );
}
