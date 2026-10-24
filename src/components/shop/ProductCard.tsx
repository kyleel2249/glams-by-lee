import Image from 'next/image';
import Link from 'next/link';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { AVAILABILITY_LABEL, genuineSale, priceRange, productAvailability, type CatalogProduct } from '@/lib/catalogTypes';

export function ProductImage({ product, sizes, priority = false }: { product: CatalogProduct; sizes: string; priority?: boolean }) {
  const img = product.images[0];
  return (
    <div className="relative aspect-[4/5] overflow-hidden bg-line">
      {img ? (
        <Image src={img.url} alt={img.alt} fill sizes={sizes} priority={priority} className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="grid h-full place-items-center bg-charcoal font-display text-5xl text-gold" aria-hidden>G</div>
      )}
    </div>
  );
}

export function ProductCard({ product, priority = false }: { product: CatalogProduct; priority?: boolean }) {
  const range = priceRange(product);
  const sale = genuineSale(product);
  const avail = productAvailability(product);
  const lengths = [...new Set(product.variants.map((v) => v.lengthInches).filter((x): x is number => x != null))].sort((a, b) => a - b);
  const cur = (range?.currency ?? 'GHS') as CurrencyCode;
  const specLine = [product.texture, product.construction, lengths.length ? `${lengths[0]}${lengths.length > 1 ? `–${lengths[lengths.length - 1]}` : ''} in` : null].filter(Boolean).join(', ');
  return (
    <article className="group">
      <Link href={`/products/${product.slug}`} className="block">
        <ProductImage product={product} sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" priority={priority} />
        <h3 className="mt-3 font-sans text-sm font-medium leading-snug">{product.name}</h3>
        <p className="mt-1 text-sm">
          {range ? (
            <>
              <span className="font-semibold">{range.min === range.max ? formatMoney(range.min, cur) : `From ${formatMoney(range.min, cur)}`}</span>
              {sale ? <s className="ml-2 text-muted">{formatMoney(sale.was, cur)}</s> : null}
            </>
          ) : <span className="text-muted">Price on request</span>}
        </p>
        {specLine ? <p className="mt-1 text-xs text-muted">{specLine}</p> : null}
        <p className={`mt-1 text-xs ${avail === 'out_of_stock' ? 'text-muted' : 'text-gold-deep'}`}>{AVAILABILITY_LABEL[avail]}</p>
      </Link>
    </article>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: CatalogProduct[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => <li key={p.id}><ProductCard product={p} priority={i < priorityCount} /></li>)}
    </ul>
  );
}
