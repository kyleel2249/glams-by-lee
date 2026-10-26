import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { getSiteContent } from '@/lib/catalog';

// Rendered per request: Cloudflare Workers has no shared page cache unless KV/R2 is configured, and shop data must never be stale.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'About', description: 'GLAMS BY LEE: premium wigs, bundles and hair essentials for Ghana and international customers.', alternates: { canonical: '/about' } };

export default async function About() {
  const custom = await getSiteContent<{ title?: string; body?: string }>('about');
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-4xl md:text-6xl">{custom?.title ?? 'About GLAMS BY LEE'}</h1>
      <p className="mt-4 font-display text-2xl text-gold-deep">{BRAND.tagline}</p>
      <div className="mt-8 space-y-5 leading-relaxed">
        {custom?.body ? custom.body.split(/\n\n+/).map((para, i) => <p key={i}>{para}</p>) : (
          <>
            <p>GLAMS BY LEE is a beauty and hair brand offering stylish wigs, hair extensions, bundles, hair accessories and wig-care products to customers in Ghana and internationally.</p>
            <p>We believe the right look can change how you feel walking into a room. That is why we focus on a clear shopping experience, honest product information and personal support when you need it.</p>
          </>
        )}
      </div>
      <div className="mt-10 flex flex-wrap gap-3"><Link href="/shop" className="btn-gold">Shop now</Link><Link href="/contact" className="btn-outline">Contact us</Link></div>
    </main>
  );
}
