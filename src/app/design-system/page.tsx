import type { Metadata } from 'next';
import { Wordmark } from '@/components/brand/Wordmark';
import { BRAND } from '@/lib/brand';
import { formatMoney } from '@/lib/money';
import { STATUS_LABEL, ORDER_STATUSES } from '@/lib/orderStatus';

export const metadata: Metadata = { title: 'Design system', robots: { index: false, follow: false } };

const COLORS = [
  ['Luxury black', '#171514', 'bg-ink text-ivory'],
  ['Deep charcoal', '#211B1B', 'bg-charcoal text-ivory'],
  ['Champagne gold', '#B9945A', 'bg-gold text-ink'],
  ['Soft gold', '#D9B77C', 'bg-gold-soft text-ink'],
  ['Champagne ivory', '#F6F0E8', 'bg-ivory text-ink border border-line'],
  ['Pure white', '#FFFFFF', 'bg-white text-ink border border-line'],
  ['Warm grey border', '#E7DFD5', 'bg-line text-ink'],
  ['Muted text', '#6B625C', 'bg-muted text-ivory'],
] as const;

export default function DesignSystem() {
  return (
    <main id="main" className="mx-auto max-w-5xl space-y-16 px-5 py-12">
      <header className="bg-ink px-6 py-10 text-center">
        <Wordmark tone="gold" className="mx-auto h-20 w-auto" />
        <p className="mt-6 font-display text-2xl text-ivory">{BRAND.tagline}</p>
      </header>

      <section aria-labelledby="colour">
        <h2 id="colour" className="text-3xl">Colour</h2>
        <p className="mt-2 max-w-prose text-muted">Black frames navigation, promotions and the footer. Ivory and white carry product browsing. Gold marks actions and small accents. Use Deep gold (#8F6F3C) for gold text on light backgrounds so it stays readable.</p>
        <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {COLORS.map(([name, hex, cls]) => (
            <li key={hex} className={`${cls} p-4 text-sm`}><span className="block font-medium">{name}</span><span className="opacity-80">{hex}</span></li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type">
        <h2 id="type" className="text-3xl">Type</h2>
        <p className="mt-6 font-display text-5xl">Cormorant Garamond for editorial headings</p>
        <p className="mt-4 max-w-prose">Inter carries product details, navigation, forms and buttons. Body copy stays at 16px or larger with a 1.6 line height so prices and options read easily on small phones.</p>
      </section>

      <section aria-labelledby="actions">
        <h2 id="actions" className="text-3xl">Buttons and fields</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn-gold">Shop wigs</button>
          <button className="btn-outline">Find your style</button>
          <span className="bg-ink p-2"><button className="btn-outline-light">Add to bag</button></span>
        </div>
        <form className="mt-6 grid max-w-md gap-4" aria-label="Field examples">
          <label className="grid gap-1 text-sm font-medium">Email address
            <input type="email" className="field" placeholder="you@example.com" autoComplete="email" />
          </label>
          <label className="grid gap-1 text-sm font-medium">Length
            <select className="field"><option>18 inches</option><option>22 inches</option></select>
          </label>
        </form>
      </section>

      <section aria-labelledby="status">
        <h2 id="status" className="text-3xl">Order status</h2>
        <ul className="mt-6 flex flex-wrap gap-2">
          {ORDER_STATUSES.map((s) => <li key={s} className="badge">{STATUS_LABEL[s]}</li>)}
        </ul>
        <p className="mt-6 text-sm text-muted">Sample price formatting: {formatMoney(185000, 'GHS')} (stored as integer pesewas).</p>
      </section>
    </main>
  );
}
