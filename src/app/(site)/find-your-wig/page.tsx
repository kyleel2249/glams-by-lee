import type { Metadata } from 'next';
import { getProducts } from '@/lib/catalog';
import { filterOptions } from '@/lib/catalogFilters';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Find your perfect wig', description: 'Answer a few quick questions and see wigs that match your texture, length and budget.', alternates: { canonical: '/find-your-wig' } };

export default async function FindYourWig() {
  const opts = filterOptions(await getProducts());
  const Select = ({ name, label, values, fmt }: { name: string; label: string; values: (string | number)[]; fmt?: (v: string | number) => string }) => (
    <label className="grid gap-1 text-sm font-medium">{label}
      <select name={name} className="field font-normal"><option value="">No preference</option>{values.map((v) => <option key={String(v)} value={String(v)}>{fmt ? fmt(v) : String(v)}</option>)}</select>
    </label>
  );
  const hasOptions = opts.textures.length || opts.constructions.length || opts.lengths.length;
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-4xl md:text-5xl">Find your perfect wig</h1>
      <p className="mt-3 text-muted">Every question is optional. We match your answers against the wigs we currently have, then show them in the shop. We do not ask for personal details and this is not hair or scalp advice.</p>
      <form action="/shop" className="mt-8 grid gap-5">
        <Select name="texture" label="Which look do you prefer?" values={opts.textures} />
        <Select name="length" label="What length do you want?" values={opts.lengths} fmt={(v) => `${v} inches`} />
        <Select name="construction" label="Which construction suits you?" values={opts.constructions} />
        <Select name="color" label="Which colour?" values={opts.colors} />
        <label className="grid gap-1 text-sm font-medium">Your maximum budget
          <input name="max" type="number" min="0" inputMode="decimal" className="field font-normal" placeholder="Amount in GH₵" />
        </label>
        <input type="hidden" name="stock" value="1" />
        <button className="btn-gold">Show my matches</button>
        {!hasOptions ? <p className="text-sm text-muted">Style options will appear here as soon as products are added to the shop.</p> : null}
      </form>
    </main>
  );
}
