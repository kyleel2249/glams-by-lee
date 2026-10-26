import type { MetadataRoute } from 'next';
import { getCategories, getProducts } from '@/lib/catalog';

// Rendered per request: Cloudflare Workers has no shared page cache unless KV/R2 is configured, and shop data must never be stale.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const fixed = ['', '/shop', '/find-your-wig', '/about', '/contact'].map((p) => ({ url: `${base}${p}` }));
  return [
    ...fixed,
    ...categories.map((c) => ({ url: `${base}/shop/${c.slug}` })),
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: new Date(p.createdAt) })),
  ];
}
