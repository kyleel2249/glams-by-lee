import type { ReactNode } from 'react';

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p role="alert" className="mb-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>;
  if (ok) return <p role="status" className="mb-4 border border-gold bg-white p-3 text-sm text-gold-deep">{ok}</p>;
  return null;
}
export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl md:text-4xl">{title}</h1>{children}</div>;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="grid gap-1 text-sm font-medium">{label}{children}{hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}</label>;
}
export const Check = ({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) => (
  <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-5 w-5 accent-gold-deep" />{label}</label>
);
export const Card = ({ children, title }: { children: ReactNode; title?: string }) => (
  <section className="border border-line bg-white p-5">{title ? <h2 className="mb-4 font-display text-2xl">{title}</h2> : null}{children}</section>
);
export const Stat = ({ label, value, note }: { label: string; value: string | number; note?: string }) => (
  <div className="border border-line bg-white p-4"><dt className="text-sm text-muted">{label}</dt><dd className="mt-1 font-display text-3xl">{value}</dd>{note ? <dd className="mt-1 text-xs text-muted">{note}</dd> : null}</div>
);
export const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <div className="overflow-x-auto border border-line bg-white"><table className="w-full min-w-[40rem] text-left text-sm"><thead className="border-b border-line bg-ivory"><tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-line">{children}</tbody></table></div>
);
