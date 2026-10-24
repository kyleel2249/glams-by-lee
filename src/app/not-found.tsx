import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink px-6 text-center text-ivory">
      <div><h1 className="text-5xl">Page not found</h1><p className="mt-3 text-ivory/75">That page does not exist or has moved.</p>
        <div className="mt-8 flex justify-center gap-3"><Link href="/" className="btn-gold">Home</Link><Link href="/shop" className="btn-outline-light">Shop</Link></div></div>
    </main>
  );
}
