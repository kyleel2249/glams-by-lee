'use client';
import { useState } from 'react';

export function NewsletterForm() {
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'error'; message?: string }>({ kind: 'idle' });
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') ?? '');
    setState({ kind: 'busy' });
    try {
      const res = await fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const body = await res.json().catch(() => ({}));
      setState(res.ok ? { kind: 'ok', message: body.message } : { kind: 'error', message: body.error ?? 'Something went wrong. Please try again.' });
    } catch { setState({ kind: 'error', message: 'No connection. Please try again.' }); }
  }
  return (
    <form onSubmit={onSubmit} className="mt-4" noValidate>
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <div className="flex gap-2">
        <input id="nl-email" name="email" type="email" required autoComplete="email" placeholder="Email address" className="field !border-ivory/30 !bg-charcoal !text-ivory placeholder:!text-ivory/60" />
        <button className="btn-gold shrink-0 !px-4" disabled={state.kind === 'busy'}>{state.kind === 'busy' ? 'Joining…' : 'Join'}</button>
      </div>
      <p role="status" className={`mt-2 min-h-[1.25rem] text-xs ${state.kind === 'error' ? 'text-red-300' : 'text-gold-soft'}`}>{state.message}</p>
    </form>
  );
}
