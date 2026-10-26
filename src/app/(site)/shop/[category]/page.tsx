import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShopView } from '@/components/shop/ShopView';
import { getCategories, getProducts } from '@/lib/catalog';

// Rendered per request: Cloudflare Workers has no shared page cache unless KV/R2 is configured, and shop data must never be stale.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const cat = (await getCategories()).find((c) => c.slug === category);
  if (!cat) return { title: 'Category not found', robots: { index: false } };
  return { title: cat.name, description: cat.description ?? `Shop ${cat.name} at GLAMS BY LEE.`, alternates: { canonical: `/shop/${cat.slug}` } };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { category } = await params;
  const [sp, categories, products] = await Promise.all([searchParams, getCategories(), getProducts(category)]);
  const cat = categories.find((c) => c.slug === category);
  if (!cat) notFound();
  return <ShopView title={cat.name} intro={cat.description} basePath={`/shop/${cat.slug}`} activeSlug={cat.slug} products={products} categories={categories} searchParams={sp} />;
}
