import type { ReactNode } from 'react';

export function AuthShell({ title, intro, error, ok, children }: { title: string; intro?: string; error?: string; ok?: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-4xl md:text-5xl">{title}</h1>
      {intro ? <p className="mt-3 text-muted">{intro}</p> : null}
      {error ? <p role="alert" className="mt-6 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {ok ? <p role="status" className="mt-6 border border-gold bg-white p-3 text-sm text-gold-deep">{ok}</p> : null}
      <div className="mt-6">{children}</div>
    </main>
  );
}
