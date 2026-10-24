import Link from 'next/link';
import { applyFilters, filterOptions, parseFilters } from '@/lib/catalogFilters';
import type { CatalogCategory, CatalogProduct } from '@/lib/catalogTypes';
import { FilterPanel } from './FilterPanel';
import { ProductGrid } from './ProductCard';

type SP = Record<string, string | string[] | undefined>;

export function ShopView({ title, intro, basePath, products, categories, activeSlug, searchParams }: {
  title: string; intro?: string | null; basePath: string; products: CatalogProduct[]; categories: CatalogCategory[]; activeSlug?: string; searchParams: SP;
}) {
  const filters = parseFilters(searchParams);
  const results = applyFilters(products, filters);
  const options = filterOptions(products);
  const top = categories.filter((c) => !c.parentId);
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-ink">Home</Link> / {activeSlug ? <><Link href="/shop" className="hover:text-ink">Shop</Link> / <span className="text-ink">{title}</span></> : <span className="text-ink">Shop</span>}
      </nav>
      <h1 className="mt-4 text-4xl md:text-5xl">{title}</h1>
      {intro ? <p className="mt-3 max-w-prose text-muted">{intro}</p> : null}
      {top.length ? (
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Categories">
          <li><Link href="/shop" aria-current={!activeSlug ? 'page' : undefined} className={`inline-flex min-h-[44px] items-center border px-4 text-sm ${!activeSlug ? 'border-ink bg-ink text-ivory' : 'border-line bg-white hover:border-ink'}`}>All</Link></li>
          {top.map((c) => (
            <li key={c.id}><Link href={`/shop/${c.slug}`} aria-current={activeSlug === c.slug ? 'page' : undefined} className={`inline-flex min-h-[44px] items-center border px-4 text-sm ${activeSlug === c.slug ? 'border-ink bg-ink text-ivory' : 'border-line bg-white hover:border-ink'}`}>{c.name}</Link></li>
          ))}
        </ul>
      ) : null}
      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <details className="border border-line bg-white p-4 lg:border-0 lg:bg-transparent lg:p-0" open={Boolean(searchParams.q || searchParams.focus)}>
          <summary className="cursor-pointer text-sm font-medium lg:hidden">Filter and sort</summary>
          <div className="mt-4 lg:mt-0"><FilterPanel action={basePath} filters={filters} options={options} /></div>
        </details>
        <section aria-live="polite">
          <p className="text-sm text-muted">{results.length} {results.length === 1 ? 'product' : 'products'}</p>
          {results.length ? <div className="mt-4"><ProductGrid products={results} priorityCount={4} /></div> : (
            <div className="mt-4 border border-line bg-white p-8 text-center">
              <p className="font-display text-2xl">{products.length ? 'No products match those filters.' : 'Our collection is arriving soon.'}</p>
              <p className="mt-2 text-sm text-muted">{products.length ? 'Try removing a filter to see close alternatives.' : 'Check back shortly, or ask us on the contact page.'}</p>
              <Link href={products.length ? basePath : '/contact'} className="btn-outline mt-5">{products.length ? 'Clear filters' : 'Contact us'}</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
