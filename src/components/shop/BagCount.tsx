'use client';
import { useEffect, useState } from 'react';

export const CART_EVENT = 'gbl:cart';
export const notifyCartChanged = () => window.dispatchEvent(new Event(CART_EVENT));

/** Live item count in the header. Fetched on the client so pages stay cacheable. */
export function BagCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/cart/count', { cache: 'no-store' }).then((r) => r.json()).then((d) => { if (alive) setCount(Number(d.count) || 0); }).catch(() => {});
    load();
    window.addEventListener(CART_EVENT, load);
    return () => { alive = false; window.removeEventListener(CART_EVENT, load); };
  }, []);
  return count > 0 ? <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center bg-gold px-1 text-xs font-semibold text-ink" aria-label={`${count} items in bag`}>{count}</span> : null;
}
