import Link from 'next/link';
import type { ShopFilters } from '@/lib/catalogFilters';

interface Options { textures: string[]; constructions: string[]; colors: string[]; lengths: number[] }

/** Plain GET form: works without JavaScript and is easy to use on a phone. */
export function FilterPanel({ action, filters, options }: { action: string; filters: ShopFilters; options: Options }) {
  const Select = ({ name, label, values, current, fmt }: { name: string; label: string; values: (string | number)[]; current?: string | number; fmt?: (v: string | number) => string }) =>
    values.length ? (
      <label className="grid gap-1 text-sm font-medium">{label}
        <select name={name} defaultValue={current ?? ''} className="field font-normal">
          <option value="">Any</option>
          {values.map((v) => <option key={String(v)} value={String(v)}>{fmt ? fmt(v) : String(v)}</option>)}
        </select>
      </label>
    ) : null;
  const anyActive = Boolean(filters.q || filters.texture || filters.construction || filters.color || filters.length || filters.minPriceMinor !== undefined || filters.maxPriceMinor !== undefined || filters.inStock);
  return (
    <form action={action} className="grid gap-4" aria-label="Filter and sort products">
      <label className="grid gap-1 text-sm font-medium">Search
        <input name="q" type="search" defaultValue={filters.q ?? ''} className="field font-normal" placeholder="Name or style" />
      </label>
      <Select name="texture" label="Texture" values={options.textures} current={filters.texture} />
      <Select name="construction" label="Construction" values={options.constructions} current={filters.construction} />
      <Select name="length" label="Length" values={options.lengths} current={filters.length} fmt={(v) => `${v} in`} />
      <Select name="color" label="Colour" values={options.colors} current={filters.color} />
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-sm font-medium">Min price
          <input name="min" type="number" min="0" inputMode="decimal" defaultValue={filters.minPriceMinor !== undefined ? filters.minPriceMinor / 100 : ''} className="field font-normal" />
        </label>
        <label className="grid gap-1 text-sm font-medium">Max price
          <input name="max" type="number" min="0" inputMode="decimal" defaultValue={filters.maxPriceMinor !== undefined ? filters.maxPriceMinor / 100 : ''} className="field font-normal" />
        </label>
      </div>
      <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" name="stock" value="1" defaultChecked={filters.inStock} className="h-5 w-5 accent-gold-deep" /> In stock only</label>
      <label className="grid gap-1 text-sm font-medium">Sort by
        <select name="sort" defaultValue={filters.sort} className="field font-normal">
          <option value="featured">Featured</option><option value="newest">Newest</option>
          <option value="price-asc">Price, low to high</option><option value="price-desc">Price, high to low</option>
        </select>
      </label>
      <div className="flex gap-3">
        <button className="btn-gold flex-1">Apply</button>
        {anyActive ? <Link href={action} className="btn-outline flex-1">Clear</Link> : null}
      </div>
    </form>
  );
}
