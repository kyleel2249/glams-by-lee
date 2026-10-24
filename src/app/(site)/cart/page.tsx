import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Your bag', robots: { index: false, follow: false } };

export default function Cart() {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-4xl">Your bag</h1>
      <p className="mt-4 text-muted">Your bag is empty. Secure checkout opens in the next release; until then, message us to order.</p>
      <div className="mt-8 flex justify-center gap-3"><Link href="/shop" className="btn-gold">Continue shopping</Link><Link href="/contact" className="btn-outline">Contact us</Link></div>
    </main>
  );
}
