import type { Metadata } from 'next';
import { ShopView } from '@/components/shop/ShopView';
import { getCategories, getProducts } from '@/lib/catalog';

// Rendered per request: Cloudflare Workers has no shared page cache unless KV/R2 is configured, and shop data must never be stale.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Shop wigs, bundles and hair care', description: 'Browse premium wigs, hair bundles, closures, frontals and hair care from GLAMS BY LEE.', alternates: { canonical: '/shop' } };

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [sp, products, categories] = await Promise.all([searchParams, getProducts(), getCategories()]);
  return <ShopView title="Shop" basePath="/shop" products={products} categories={categories} searchParams={sp} />;
}
