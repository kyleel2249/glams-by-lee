import { toMinor } from './money';
import { type CatalogProduct, productAvailability } from './catalogTypes';

export type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc';
export interface ShopFilters {
  q?: string; texture?: string; construction?: string; color?: string; length?: number;
  minPriceMinor?: number; maxPriceMinor?: number; inStock: boolean; sort: SortKey;
}
type Params = Record<string, string | string[] | undefined>;
const SORTS: SortKey[] = ['featured', 'newest', 'price-asc', 'price-desc'];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const text = (v: string | string[] | undefined) => { const s = first(v)?.trim().slice(0, 60); return s ? s : undefined; };
const num = (v: string | string[] | undefined) => { const s = first(v); if (!s) return undefined; const n = Number(s); return Number.isFinite(n) && n >= 0 ? n : undefined; };

/** Turns untrusted URL parameters into a safe, typed filter object. */
export function parseFilters(sp: Params): ShopFilters {
  const sort = first(sp.sort) as SortKey;
  const min = num(sp.min), max = num(sp.max), length = num(sp.length);
  return {
    q: text(sp.q), texture: text(sp.texture), construction: text(sp.construction), color: text(sp.color),
    length: length && length <= 80 ? Math.round(length) : undefined,
    minPriceMinor: min !== undefined ? toMinor(min) : undefined,
    maxPriceMinor: max !== undefined ? toMinor(max) : undefined,
    inStock: first(sp.stock) === '1',
    sort: SORTS.includes(sort) ? sort : 'featured',
  };
}

const eq = (a: string | null | undefined, b: string) => (a ?? '').toLowerCase() === b.toLowerCase();

export function applyFilters(products: CatalogProduct[], f: ShopFilters): CatalogProduct[] {
  const q = f.q?.toLowerCase();
  const out = products.filter((p) => {
    if (q && !`${p.name} ${p.description ?? ''} ${p.texture ?? ''} ${p.construction ?? ''}`.toLowerCase().includes(q)) return false;
    if (f.texture && !eq(p.texture, f.texture)) return false;
    if (f.construction && !eq(p.construction, f.construction)) return false;
    if (f.inStock && !['in_stock', 'low_stock'].includes(productAvailability(p))) return false;
    // variant-level filters: the product matches if at least one variant satisfies all of them together
    const variantOk = p.variants.some((v) =>
      (f.color === undefined || eq(v.color, f.color)) &&
      (f.length === undefined || v.lengthInches === f.length) &&
      (f.minPriceMinor === undefined || v.priceMinor >= f.minPriceMinor) &&
      (f.maxPriceMinor === undefined || v.priceMinor <= f.maxPriceMinor));
    const needsVariant = f.color !== undefined || f.length !== undefined || f.minPriceMinor !== undefined || f.maxPriceMinor !== undefined;
    return needsVariant ? variantOk : true;
  });
  const minPrice = (p: CatalogProduct) => (p.variants.length ? Math.min(...p.variants.map((v) => v.priceMinor)) : Number.MAX_SAFE_INTEGER);
  const sorted = [...out];
  if (f.sort === 'newest') sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  else if (f.sort === 'price-asc') sorted.sort((a, b) => minPrice(a) - minPrice(b));
  else if (f.sort === 'price-desc') sorted.sort((a, b) => minPrice(b) - minPrice(a));
  else sorted.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.createdAt.localeCompare(a.createdAt));
  return sorted;
}

/** Filter choices come from the real catalogue, so shoppers never see an option that returns nothing. */
export function filterOptions(products: CatalogProduct[]) {
  const uniq = <T,>(xs: (T | null | undefined)[]) => [...new Set(xs.filter((x): x is T => x != null && x !== ''))];
  return {
    textures: uniq(products.map((p) => p.texture)).sort(),
    constructions: uniq(products.map((p) => p.construction)).sort(),
    colors: uniq(products.flatMap((p) => p.variants.map((v) => v.color))).sort(),
    lengths: uniq(products.flatMap((p) => p.variants.map((v) => v.lengthInches))).sort((a, b) => a - b),
  };
}
