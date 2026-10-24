import Link from 'next/link';

export default function Forbidden() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-4xl">You do not have access to that</h1>
      <p className="mt-3 text-muted">Your role does not include this area. Ask the shop owner if you need it.</p>
      <Link href="/admin" className="btn-gold mt-8">Back to the dashboard</Link>
    </main>
  );
}
