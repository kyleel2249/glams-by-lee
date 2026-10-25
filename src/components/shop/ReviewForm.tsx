import Link from 'next/link';
import { submitReview } from '@/app/(site)/products/[slug]/review-actions';

/** Plain form that works without JavaScript. Signed-out visitors are sent to sign in when they submit. */
export function ReviewForm({ productId, slug, ok, error }: { productId: string; slug: string; ok?: string; error?: string }) {
  return (
    <section className="mt-16 max-w-xl" id="reviews-form">
      <h2 className="text-3xl">Write a review</h2>
      <p className="mt-2 text-sm text-muted">Reviews are checked before they appear. Reviews from customers who bought this product are marked “Verified purchase”. You need an account to review (<Link href={`/account/login?next=${encodeURIComponent(`/products/${slug}`)}`} className="underline">sign in</Link>).</p>
      {error ? <p role="alert" className="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {ok ? <p role="status" className="mt-4 border border-gold bg-white p-3 text-sm text-gold-deep">{ok}</p> : null}
      <form action={submitReview} className="mt-4 grid gap-3"><input type="hidden" name="productId" value={productId} /><input type="hidden" name="slug" value={slug} />
        <fieldset><legend className="text-sm font-medium">Your rating</legend>
          <div className="mt-1 flex flex-wrap gap-2">{[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-2 border border-line bg-white px-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-ivory"><input type="radio" name="rating" value={n} required className="sr-only" />{n} {n === 1 ? 'star' : 'stars'}</label>))}</div></fieldset>
        <label className="grid gap-1 text-sm font-medium">Headline (optional)<input name="title" maxLength={100} className="field font-normal" /></label>
        <label className="grid gap-1 text-sm font-medium">Your review<textarea name="body" rows={4} maxLength={2000} className="field py-2 font-normal" /></label>
        <button className="btn-gold justify-self-start">Submit review</button></form>
    </section>
  );
}
