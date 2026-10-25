'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/** Sign in / Account link. Asks the server once on load so the header itself can stay cached. */
export function AccountLink() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { let alive = true; fetch('/api/session', { cache: 'no-store' }).then((r) => r.json()).then((d) => { if (alive) setSignedIn(Boolean(d.signedIn)); }).catch(() => {}); return () => { alive = false; }; }, []);
  return (
    <Link href={signedIn ? '/account' : '/account/login'} className="flex h-11 items-center gap-2 px-3 text-sm hover:text-gold-soft" aria-label={signedIn ? 'Your account' : 'Sign in'}>
      <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></svg>
      <span className="hidden lg:inline">{signedIn ? 'Account' : 'Sign in'}</span>
    </Link>
  );
}
