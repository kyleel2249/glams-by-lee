'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney, type CurrencyCode } from '@/lib/money';

interface Option { id: string; name: string; costMinor: number; daysMin: number | null; daysMax: number | null; dutiesNote: string | null }
interface Quote { deliverable: boolean; options: Option[]; selected: Option | null; discount: { code: string; discountMinor: number } | null; discountError: string | null;
  totals: { subtotalMinor: number; discountMinor: number; shippingMinor: number; taxMinor: number; totalMinor: number } | null; currency: string; subtotalMinor: number; error?: string }
interface CartLite { lines: { variantId: string; productName: string; quantity: number; lineTotalMinor: number; attributes: string[] }[]; currency: string; subtotalMinor: number; hasProblems: boolean }

interface Prefill { signedIn: boolean; email?: string; name?: string; phone?: string; address?: { line1: string; line2: string | null; city: string; region: string | null; postalCode: string | null; country: string } | null }

export function CheckoutForm({ countries }: { countries: { code: string; name: string }[] }) {
  const [cart, setCart] = useState<CartLite | null>(null);
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [country, setCountry] = useState(countries.find((c) => c.code === 'GH')?.code ?? countries[0]?.code ?? '');
  const [region, setRegion] = useState('');
  const [rateId, setRateId] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idemKey = useMemo(() => { try { const k = sessionStorage.getItem('gbl_idem') ?? crypto.randomUUID(); sessionStorage.setItem('gbl_idem', k); return k; } catch { return crypto.randomUUID(); } }, []);

  useEffect(() => { fetch('/api/cart', { cache: 'no-store' }).then((r) => r.json()).then(setCart).catch(() => setError('Could not load your bag.')); }, []);
  useEffect(() => {
    fetch('/api/checkout/prefill', { cache: 'no-store' }).then((r) => r.json()).then((d: Prefill) => {
      setPrefill(d);
      if (d.address && countries.some((c) => c.code === d.address!.country)) { setCountry(d.address.country); setRegion(d.address.region ?? ''); }
    }).catch(() => setPrefill({ signedIn: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requote = useCallback(async () => {
    if (!country || !cart?.lines.length) return;
    try {
      const r = await fetch('/api/checkout/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country, region: region || undefined, rateId: rateId || undefined, code: code || undefined }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Could not calculate your order.'); setQuote(null); return; }
      setError(null); setQuote(d);
      if (!d.selected && d.options?.length === 1) setRateId(d.options[0].id);   // single option: pick it for the customer
      if (d.selected === null && rateId && !d.options.some((o: Option) => o.id === rateId)) setRateId('');
    } catch { setError('No connection. Please try again.'); }
  }, [country, region, rateId, code, cart]);
  useEffect(() => { const t = setTimeout(requote, 350); return () => clearTimeout(t); }, [requote]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const f = new FormData(e.currentTarget); const v = (k: string) => String(f.get(k) ?? '').trim();
    if (!rateId) { setError('Please choose a delivery option.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        email: v('email'), phone: v('phone'), name: v('name'), line1: v('line1'), line2: v('line2') || undefined, city: v('city'), region: region || undefined,
        postalCode: v('postalCode') || undefined, country, rateId, code: code || undefined, note: v('note') || undefined, idempotencyKey: idemKey }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? 'Something went wrong. Nothing was charged.'); setBusy(false); return; }
      try { sessionStorage.removeItem('gbl_idem'); } catch { /* ignore */ }
      window.location.assign(d.authorizationUrl);
    } catch { setError('No connection. Nothing was charged. Please try again.'); setBusy(false); }
  }

  if (!cart || !prefill) return <p className="mt-8 text-muted" role="status">Loading…</p>;
  if (!cart.lines.length) return <div className="mt-8"><p className="text-muted">Your bag is empty.</p><Link href="/shop" className="btn-gold mt-6">Continue shopping</Link></div>;
  if (cart.hasProblems) return <div className="mt-8"><p role="alert" className="text-red-800">Some items in your bag need attention before you can check out.</p><Link href="/cart" className="btn-gold mt-6">Review your bag</Link></div>;
  if (!countries.length) return <p className="mt-8 text-muted">We are setting up delivery. Please contact us to place your order.</p>;

  const cur = cart.currency as CurrencyCode; const t = quote?.totals;
  const eta = (o: Option) => (o.daysMin && o.daysMax ? `Estimated ${o.daysMin}–${o.daysMax} days` : null);

  return (
    <form onSubmit={submit} className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]" aria-label="Checkout">
      <div className="grid gap-8">
        {error ? <p role="alert" className="border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
        {!prefill.signedIn ? <p className="text-sm text-muted">Have an account? <a href="/account/login?next=%2Fcheckout" className="underline">Sign in</a> to use your saved details. Guest checkout is fine too.</p> : null}
        <fieldset className="grid gap-4"><legend className="font-display text-2xl">Contact</legend>
          <label className="grid gap-1 text-sm font-medium">Email<input name="email" type="email" required autoComplete="email" defaultValue={prefill.email ?? ''} className="field font-normal" /></label>
          <label className="grid gap-1 text-sm font-medium">Phone (for delivery)<input name="phone" type="tel" required autoComplete="tel" inputMode="tel" defaultValue={prefill.phone ?? ''} className="field font-normal" /></label>
        </fieldset>
        <fieldset className="grid gap-4"><legend className="font-display text-2xl">Delivery address</legend>
          <label className="grid gap-1 text-sm font-medium">Full name<input name="name" required autoComplete="name" defaultValue={prefill.name ?? ''} className="field font-normal" /></label>
          <label className="grid gap-1 text-sm font-medium">Country
            <select value={country} onChange={(e) => { setCountry(e.target.value); setRateId(''); }} required className="field font-normal">{countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm font-medium">Address<input name="line1" required autoComplete="address-line1" defaultValue={prefill.address?.line1 ?? ''} className="field font-normal" /></label>
          <label className="grid gap-1 text-sm font-medium">Apartment, landmark or directions (optional)<input name="line2" autoComplete="address-line2" defaultValue={prefill.address?.line2 ?? ''} className="field font-normal" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm font-medium">City or town<input name="city" required autoComplete="address-level2" defaultValue={prefill.address?.city ?? ''} className="field font-normal" /></label>
            <label className="grid gap-1 text-sm font-medium">Region<input value={region} onChange={(e) => { setRegion(e.target.value); setRateId(''); }} autoComplete="address-level1" className="field font-normal" /></label>
          </div>
          <label className="grid gap-1 text-sm font-medium">Postal code (if you have one)<input name="postalCode" autoComplete="postal-code" defaultValue={prefill.address?.postalCode ?? ''} className="field font-normal" /></label>
        </fieldset>
        <fieldset className="grid gap-3"><legend className="font-display text-2xl">Delivery method</legend>
          {quote && !quote.deliverable ? <p className="text-sm text-red-800">We do not deliver to this destination yet. Please contact us.</p> : null}
          {quote?.options.map((o) => (
            <label key={o.id} className={`flex min-h-[44px] cursor-pointer items-start gap-3 border p-4 text-sm ${rateId === o.id ? 'border-ink bg-white' : 'border-line bg-white'}`}>
              <input type="radio" name="rate" value={o.id} checked={rateId === o.id} onChange={() => setRateId(o.id)} className="mt-1 h-5 w-5 accent-gold-deep" />
              <span className="flex-1"><span className="font-medium">{o.name}</span>{eta(o) ? <span className="block text-muted">{eta(o)}</span> : null}{o.dutiesNote ? <span className="block text-muted">{o.dutiesNote}</span> : null}</span>
              <span className="font-medium">{o.costMinor === 0 ? 'Free' : formatMoney(o.costMinor, cur)}</span>
            </label>
          ))}
        </fieldset>
        <label className="grid gap-1 text-sm font-medium">Order note (optional)<textarea name="note" maxLength={500} rows={3} className="field py-2 font-normal" /></label>
      </div>

      <aside className="h-fit border border-line bg-white p-5" aria-label="Order summary">
        <h2 className="font-display text-2xl">Order summary</h2>
        <ul className="mt-4 space-y-2 text-sm">{cart.lines.map((l) => <li key={l.variantId} className="flex justify-between gap-3"><span>{l.quantity} × {l.productName}{l.attributes.length ? <span className="block text-xs text-muted">{l.attributes.join(' · ')}</span> : null}</span><span>{formatMoney(l.lineTotalMinor, cur)}</span></li>)}</ul>
        <div className="mt-4 flex gap-2">
          <label className="sr-only" htmlFor="code">Discount code</label>
          <input id="code" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Discount code" className="field" autoComplete="off" />
          <button type="button" className="btn-outline shrink-0 !px-4" onClick={() => { setCode(codeInput.trim()); setRateId(''); }}>Apply</button>
        </div>
        {quote?.discountError ? <p role="alert" className="mt-2 text-xs text-red-800">{quote.discountError}</p> : null}
        {quote?.discount ? <p className="mt-2 text-xs text-gold-deep">Code {quote.discount.code} applied.</p> : null}
        <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(t?.subtotalMinor ?? cart.subtotalMinor, cur)}</dd></div>
          {t && t.discountMinor > 0 ? <div className="flex justify-between"><dt>Discount</dt><dd>−{formatMoney(t.discountMinor, cur)}</dd></div> : null}
          <div className="flex justify-between"><dt>Delivery</dt><dd>{t ? (t.shippingMinor === 0 ? 'Free' : formatMoney(t.shippingMinor, cur)) : 'Choose a method'}</dd></div>
          {t && t.taxMinor > 0 ? <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(t.taxMinor, cur)}</dd></div> : null}
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd aria-live="polite">{t ? formatMoney(t.totalMinor, cur) : '—'}</dd></div>
        </dl>
        <button className="btn-gold mt-5 w-full disabled:opacity-50" disabled={busy || !t}>{busy ? 'Starting secure payment…' : 'Pay securely'}</button>
        <p className="mt-3 text-xs text-muted">You will be taken to our payment provider’s secure page to pay. We never see or store your card details. The amount is confirmed again on our server before you pay.</p>
      </aside>
    </form>
  );
}
