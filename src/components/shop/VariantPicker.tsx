'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { AVAILABILITY_LABEL, type CatalogVariant } from '@/lib/catalogTypes';
import { notifyCartChanged } from './BagCount';

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

  const [qty, setQty] = useState(1);
  const [add, setAdd] = useState<{ kind: 'idle' | 'busy' | 'added' | 'error'; message?: string }>({ kind: 'idle' });

  if (!variants.length) return <p className="text-sm text-muted">This product has no purchasable options yet.</p>;
  const cur = (current?.currency ?? variants[0].currency) as CurrencyCode;
  const purchasable = current && current.availability !== 'out_of_stock';
  async function addToBag() {
    if (!current) return;
    setAdd({ kind: 'busy' });
    try {
      const r = await fetch('/api/cart/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variantId: current.id, quantity: qty }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setAdd({ kind: 'error', message: d.error ?? 'Could not add to your bag.' }); return; }
      setAdd({ kind: 'added', message: 'Added to your bag.' }); notifyCartChanged();
    } catch { setAdd({ kind: 'error', message: 'No connection. Please try again.' }); }
  }

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
      <div className="mt-5 flex items-center gap-3">
        <div className="inline-flex items-center border border-line bg-white" role="group" aria-label="Quantity">
          <button type="button" className="h-11 w-11 text-lg disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">−</button>
          <span className="min-w-8 text-center text-sm" aria-live="polite">{qty}</span>
          <button type="button" className="h-11 w-11 text-lg disabled:opacity-40" onClick={() => setQty((q) => Math.min(10, q + 1))} disabled={qty >= 10} aria-label="Increase quantity">+</button>
        </div>
        <button type="button" onClick={addToBag} disabled={!purchasable || add.kind === 'busy'} className="btn-gold flex-1 disabled:cursor-not-allowed disabled:opacity-50">
          {!purchasable ? 'Unavailable' : add.kind === 'busy' ? 'Adding…' : 'Add to bag'}
        </button>
      </div>
      <p role="status" className={`mt-2 min-h-[1.25rem] text-sm ${add.kind === 'error' ? 'text-red-800' : 'text-gold-deep'}`}>
        {add.message}{add.kind === 'added' ? <> <Link href="/cart" className="underline">View bag</Link></> : null}
      </p>
      {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-outline mt-4 w-full">Ask about this wig on WhatsApp</a> : null}
    </div>
  );
}
