import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/shop/CheckoutForm';
import { getDeliveryCountries } from '@/lib/catalog';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Checkout', robots: { index: false, follow: false } };

export default async function Checkout() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-4xl md:text-5xl">Checkout</h1>
      <CheckoutForm countries={await getDeliveryCountries()} />
    </main>
  );
}
