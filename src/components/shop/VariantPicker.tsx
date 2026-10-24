'use client';
import { useMemo, useState } from 'react';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { AVAILABILITY_LABEL, type CatalogVariant } from '@/lib/catalogTypes';

type Axis = 'lengthInches' | 'color' | 'density' | 'capSize';
const AXES: { key: Axis; label: string; fmt?: (v: string | number) => string }[] = [
  { key: 'lengthInches', label: 'Length', fmt: (v) => `${v} in` },
  { key: 'color', label: 'Colour' },
  { key: 'density', label: 'Density' },
  { key: 'capSize', label: 'Cap size' },
];

export function VariantPicker({ variants, whatsappHref }: { variants: CatalogVariant[]; whatsappHref: string | null }) {
  // only show attributes this product actually varies on
  const axes = AXES.filter((a) => new Set(variants.map((v) => v[a.key]).filter((x) => x != null)).size > 0);
  const [sel, setSel] = useState<Partial<Record<Axis, string | number>>>(() => {
    const start = variants.find((v) => v.availability !== 'out_of_stock') ?? variants[0];
    return Object.fromEntries(axes.map((a) => [a.key, start?.[a.key] ?? undefined]));
  });
  const current = useMemo(() => variants.find((v) => axes.every((a) => (sel[a.key] ?? null) === (v[a.key] ?? null))) ?? null, [variants, axes, sel]);

  if (!variants.length) return <p className="text-sm text-muted">This product has no purchasable options yet.</p>;
  const cur = (current?.currency ?? variants[0].currency) as CurrencyCode;
  const purchasable = current && current.availability !== 'out_of_stock';

  return (
    <div>
      <p className="text-2xl font-semibold" aria-live="polite">
        {current ? formatMoney(current.priceMinor, cur) : 'Choose an available combination'}
        {current?.compareAtMinor && current.compareAtMinor > current.priceMinor ? <s className="ml-3 text-base font-normal text-muted">{formatMoney(current.compareAtMinor, cur)}</s> : null}
      </p>
      {axes.map((a) => {
        const options = [...new Set(variants.map((v) => v[a.key]).filter((x): x is string | number => x != null))];
        return (
          <fieldset key={a.key} className="mt-5">
            <legend className="text-sm font-medium">{a.label}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {options.map((o) => {
                const active = sel[a.key] === o;
                return (
                  <button key={String(o)} type="button" aria-pressed={active}
                    onClick={() => setSel((s) => ({ ...s, [a.key]: o }))}
                    className={`min-h-[44px] min-w-[44px] border px-4 text-sm ${active ? 'border-ink bg-ink text-ivory' : 'border-line bg-white hover:border-ink'}`}>
                    {a.fmt ? a.fmt(o) : String(o)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      <p className="mt-5 text-sm" aria-live="polite">
        {current ? <>{AVAILABILITY_LABEL[current.availability]} · SKU {current.sku}</> : 'This combination is not offered.'}
      </p>
      <button type="button" disabled className="btn-gold mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50" aria-describedby="bag-note">
        {purchasable ? 'Add to bag' : 'Unavailable'}
      </button>
      <p id="bag-note" className="mt-2 text-xs text-muted">Bag and secure checkout open in the next release. Ask about this item on WhatsApp in the meantime.</p>
      {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-outline mt-4 w-full">Ask about this wig on WhatsApp</a> : null}
    </div>
  );
}
