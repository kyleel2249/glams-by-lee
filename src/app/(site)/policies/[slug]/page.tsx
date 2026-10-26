import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSiteContent } from '@/lib/catalog';

// Rendered per request: Cloudflare Workers has no shared page cache unless KV/R2 is configured, and shop data must never be stale.
export const dynamic = 'force-dynamic';
const SLUGS = { shipping: 'Shipping policy', returns: 'Returns and refunds policy', privacy: 'Privacy policy', terms: 'Terms and conditions' } as const;
type Slug = keyof typeof SLUGS;
interface Policy { title?: string; body?: string; updated?: string }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!(slug in SLUGS)) return { title: 'Not found', robots: { index: false } };
  const p = await getSiteContent<Policy>(`policy_${slug}`);
  return { title: p?.title ?? SLUGS[slug as Slug], robots: p?.body ? undefined : { index: false }, alternates: { canonical: `/policies/${slug}` } };
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in SLUGS)) notFound();
  const p = await getSiteContent<Policy>(`policy_${slug}`);
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-4xl md:text-5xl">{p?.title ?? SLUGS[slug as Slug]}</h1>
      {p?.body ? (
        <>
          {p.updated ? <p className="mt-2 text-sm text-muted">Last updated {p.updated}</p> : null}
          <div className="mt-8 space-y-4 leading-relaxed">{p.body.split(/\n\n+/).map((para, i) => <p key={i}>{para}</p>)}</div>
        </>
      ) : (
        <p className="mt-6 text-muted">This policy is being finalised. For questions in the meantime, please <Link href="/contact" className="underline">contact us</Link>.</p>
      )}
    </main>
  );
}
