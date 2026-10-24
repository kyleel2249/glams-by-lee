import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VariantPicker } from '@/components/shop/VariantPicker';
import { ProductGrid } from '@/components/shop/ProductCard';
import { getApprovedReviews, getCategories, getProductBySlug, getProducts, getSettings } from '@/lib/catalog';
import { priceRange, type CatalogProduct } from '@/lib/catalogTypes';
import { whatsAppLink } from '@/lib/whatsapp';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: 'Product not found', robots: { index: false } };
  const desc = (p.description ?? `${p.name} from GLAMS BY LEE.`).slice(0, 155);
  return { title: p.name, description: desc, alternates: { canonical: `/products/${p.slug}` }, openGraph: { title: p.name, description: desc, images: p.images[0] ? [p.images[0].url] : undefined } };
}

const SCHEMA_AVAIL = { in_stock: 'InStock', low_stock: 'LimitedAvailability', backorder: 'BackOrder', out_of_stock: 'OutOfStock' } as const;

function jsonLd(p: CatalogProduct, base: string) {
  const range = priceRange(p);
  if (!range) return null;
  const best = ['in_stock', 'low_stock', 'backorder', 'out_of_stock'].find((a) => p.variants.some((v) => v.availability === a)) as keyof typeof SCHEMA_AVAIL;
  return {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.sku, description: p.description ?? undefined,
    image: p.images.map((i) => i.url), brand: { '@type': 'Brand', name: 'GLAMS BY LEE' }, url: `${base}/products/${p.slug}`,
    offers: { '@type': 'AggregateOffer', priceCurrency: range.currency, lowPrice: (range.min / 100).toFixed(2), highPrice: (range.max / 100).toFixed(2), offerCount: p.variants.length, availability: `https://schema.org/${SCHEMA_AVAIL[best]}` },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [settings, reviews, categories, siblings] = await Promise.all([getSettings(), getApprovedReviews(product.id), getCategories(), getProducts()]);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const category = categories.find((c) => c.id === product.categoryId);
  const related = siblings.filter((p) => p.id !== product.id && p.categoryId === product.categoryId).slice(0, 4);
  const wa = whatsAppLink(settings.whatsappNumber, `Hello GLAMS BY LEE, I have a question about ${product.name} (${product.sku}).`);
  const ld = jsonLd(product, base);
  const specs = [['Material', product.hairMaterial], ['Texture', product.texture], ['Construction', product.construction], ['Lace', product.laceType]].filter(([, v]) => v) as [string, string][];
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      {ld ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} /> : null}
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">Home</Link> / <Link href="/shop" className="hover:text-ink">Shop</Link>
        {category ? <> / <Link href={`/shop/${category.slug}`} className="hover:text-ink">{category.name}</Link></> : null} / <span className="text-ink">{product.name}</span>
      </nav>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          {product.images.length ? product.images.map((img, i) => (
            <div key={img.url} className={`relative aspect-[4/5] bg-line ${i === 0 ? 'col-span-2' : ''}`}>
              <Image src={img.url} alt={img.alt} fill sizes={i === 0 ? '(min-width:1024px) 50vw, 100vw' : '(min-width:1024px) 25vw, 50vw'} priority={i === 0} className="object-cover" />
            </div>
          )) : <div className="col-span-2 grid aspect-[4/5] place-items-center bg-charcoal font-display text-7xl text-gold" aria-hidden>G</div>}
        </div>
        <div>
          <h1 className="text-4xl md:text-5xl">{product.name}</h1>
          {avg !== null ? <p className="mt-2 text-sm">{avg.toFixed(1)} out of 5 from {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</p> : null}
          <div className="mt-6"><VariantPicker variants={product.variants} whatsappHref={wa} /></div>
          {product.description ? <p className="mt-8 whitespace-pre-line leading-relaxed">{product.description}</p> : null}
          {specs.length ? (
            <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
              {specs.map(([k, v]) => <div key={k} className="grid grid-cols-3 gap-4 py-3"><dt className="font-medium">{k}</dt><dd className="col-span-2">{v}</dd></div>)}
            </dl>
          ) : null}
          {product.careInstructions ? <section className="mt-8"><h2 className="text-2xl">Care</h2><p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{product.careInstructions}</p></section> : null}
          <section className="mt-8"><h2 className="text-2xl">Shipping and returns</h2>
            <p className="mt-2 text-sm leading-relaxed">{product.shippingReturnsNote ?? <>Read our <Link className="underline" href="/policies/shipping">shipping policy</Link> and <Link className="underline" href="/policies/returns">returns policy</Link>.</>}</p>
          </section>
        </div>
      </div>
      {reviews.length ? (
        <section className="mt-16" aria-labelledby="reviews"><h2 id="reviews" className="text-3xl">Customer reviews</h2>
          <ul className="mt-6 grid gap-6 md:grid-cols-2">
            {reviews.map((r) => (
              <li key={r.id} className="border border-line bg-white p-5">
                <p className="text-sm font-semibold">{r.rating} out of 5{r.verified ? <span className="badge ml-3">Verified purchase</span> : null}</p>
                {r.title ? <p className="mt-2 font-medium">{r.title}</p> : null}
                {r.body ? <p className="mt-1 text-sm">{r.body}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {related.length ? <section className="mt-16" aria-labelledby="related"><h2 id="related" className="text-3xl">You may also like</h2><div className="mt-6"><ProductGrid products={related} /></div></section> : null}
    </main>
  );
}
