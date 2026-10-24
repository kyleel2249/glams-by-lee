import type { Metadata } from 'next';
import { CartView } from '@/components/shop/CartView';

export const metadata: Metadata = { title: 'Your bag', robots: { index: false, follow: false } };

export default function Cart() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-4xl md:text-5xl">Your bag</h1>
      <CartView />
    </main>
  );
}
