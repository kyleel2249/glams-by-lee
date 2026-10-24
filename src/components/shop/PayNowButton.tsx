'use client';
import { useState } from 'react';

export function PayNowButton({ orderNumber, token }: { orderNumber: string; token: string }) {
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false });
  async function pay() {
    setState({ busy: true });
    try {
      const r = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/pay?t=${encodeURIComponent(token)}`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setState({ busy: false, error: d.error ?? 'Could not start payment.' }); return; }
      window.location.assign(d.authorizationUrl);
    } catch { setState({ busy: false, error: 'No connection. Please try again.' }); }
  }
  return (<div><button type="button" onClick={pay} disabled={state.busy} className="btn-gold">{state.busy ? 'Starting secure payment…' : 'Pay now'}</button>{state.error ? <p role="alert" className="mt-2 text-sm text-red-800">{state.error}</p> : null}</div>);
}
