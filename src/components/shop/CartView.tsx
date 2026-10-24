'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { notifyCartChanged } from './BagCount';

interface Line { variantId: string; productName: string; slug: string; image: { url: string; alt: string } | null; sku: string; attributes: string[]; unitPriceMinor: number; quantity: number; lineTotalMinor: number; available: number | null; problem: 'unavailable' | 'insufficient_stock' | null }
interface Cart { lines: Line[]; subtotalMinor: number; currency: string; count: number; hasProblems: boolean }

export function CartView() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/cart', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Could not load your bag.'); setCart({ lines: [], subtotalMinor: 0, currency: 'GHS', count: 0, hasProblems: false }); return; }
      setCart(d);
    } catch { setError('No connection. Please try again.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function change(variantId: string, quantity: number) {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/cart/items/${variantId}`, quantity === 0 ? { method: 'DELETE' } : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity }) });
      if (!r.ok) setError((await r.json().catch(() => ({}))).error ?? 'Could not update your bag.');
      await load(); notifyCartChanged();
    } finally { setBusy(false); }
  }

  if (!cart) return <p className="mt-8 text-muted" role="status">Loading your bag…</p>;
  const cur = cart.currency as CurrencyCode;
  if (!cart.lines.length) return (
    <div className="mt-8 text-center">
      {error ? <p role="alert" className="mb-4 text-sm text-red-700">{error}</p> : null}
      <p className="text-muted">Your bag is empty.</p>
      <Link href="/shop" className="btn-gold mt-6">Continue shopping</Link>
    </div>
  );

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
      <div>
        {error ? <p role="alert" className="mb-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        <ul className="divide-y divide-line border-y border-line">
          {cart.lines.map((l) => (
            <li key={l.variantId} className="grid grid-cols-[5rem_1fr] gap-4 py-5 sm:grid-cols-[6rem_1fr_auto]">
              <div className="relative aspect-[4/5] bg-line">{l.image ? <Image src={l.image.url} alt={l.image.alt} fill sizes="96px" className="object-cover" /> : <span className="grid h-full place-items-center bg-charcoal font-display text-3xl text-gold" aria-hidden>G</span>}</div>
              <div>
                <Link href={`/products/${l.slug}`} className="font-medium hover:underline">{l.productName}</Link>
                <p className="mt-1 text-sm text-muted">{l.attributes.join(' · ')}{l.attributes.length ? ' · ' : ''}SKU {l.sku}</p>
                <p className="mt-1 text-sm">{formatMoney(l.unitPriceMinor, cur)} each</p>
                {l.problem === 'unavailable' ? <p role="alert" className="mt-2 text-sm text-red-800">This item is no longer available. Please remove it to continue.</p> : null}
                {l.problem === 'insufficient_stock' ? <p role="alert" className="mt-2 text-sm text-red-800">Only {l.available} left. Please lower the quantity.</p> : null}
                <div className="mt-3 flex items-center gap-3">
                  <div className="inline-flex items-center border border-line bg-white" role="group" aria-label={`Quantity for ${l.productName}`}>
                    <button type="button" className="h-11 w-11 text-lg disabled:opacity-40" disabled={busy} onClick={() => change(l.variantId, l.quantity - 1)} aria-label="Decrease quantity">−</button>
                    <span className="min-w-8 text-center text-sm" aria-live="polite">{l.quantity}</span>
                    <button type="button" className="h-11 w-11 text-lg disabled:opacity-40" disabled={busy || l.problem === 'unavailable'} onClick={() => change(l.variantId, l.quantity + 1)} aria-label="Increase quantity">+</button>
                  </div>
                  <button type="button" className="min-h-[44px] text-sm underline" disabled={busy} onClick={() => change(l.variantId, 0)}>Remove</button>
                </div>
              </div>
              <p className="col-span-2 text-right font-semibold sm:col-span-1">{formatMoney(l.lineTotalMinor, cur)}</p>
            </li>
          ))}
        </ul>
      </div>
      <aside className="h-fit border border-line bg-white p-5" aria-label="Order summary">
        <h2 className="font-display text-2xl">Summary</h2>
        <p className="mt-4 flex justify-between text-sm"><span>Subtotal</span><span>{formatMoney(cart.subtotalMinor, cur)}</span></p>
        <p className="mt-2 text-xs text-muted">Shipping, discounts and any taxes are calculated at checkout.</p>
        {cart.hasProblems ? <p className="mt-4 text-sm text-red-800">Fix the highlighted items to continue.</p> : null}
        {cart.hasProblems ? <button className="btn-gold mt-4 w-full opacity-50" disabled>Checkout</button> : <Link href="/checkout" className="btn-gold mt-4 w-full">Checkout</Link>}
        <Link href="/shop" className="btn-outline mt-3 w-full">Continue shopping</Link>
      </aside>
    </div>
  );
}
