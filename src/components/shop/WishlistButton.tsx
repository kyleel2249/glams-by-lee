'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { isWishlisted, toggleWishlist } from '@/app/(site)/account/(portal)/wishlist/actions';

export function WishlistButton({ productId, initial, loginHref }: { productId: string; initial: boolean; loginHref: string }) {
  const [saved, setSaved] = useState(initial);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => { let alive = true; isWishlisted(productId).then((v) => { if (alive) setSaved(v); }).catch(() => {}); return () => { alive = false; }; }, [productId]);
  return (
    <div>
      <button type="button" disabled={pending} aria-pressed={saved} onClick={() => start(async () => {
        const r = await toggleWishlist(productId);
        if (r.status === 'login') { router.push(loginHref); return; }
        if (r.status === 'error') { setMsg('Could not update your wishlist. Please try again.'); return; }
        setSaved(r.status === 'added'); setMsg(r.status === 'added' ? 'Saved to your wishlist.' : 'Removed from your wishlist.');
      })} className="btn-outline w-full">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" className="mr-2"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></svg>
        {saved ? 'Saved to wishlist' : 'Save to wishlist'}
      </button>
      <p role="status" className="mt-1 min-h-[1.25rem] text-xs text-gold-deep">{msg}</p>
    </div>
  );
}
