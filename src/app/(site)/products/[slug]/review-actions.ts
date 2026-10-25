'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { formObject } from '@/lib/admin/action';
import { getCustomer } from '@/lib/customer/auth';
import { reviewSchema } from '@/lib/customer/schemas';
import { createServer } from '@/lib/supabase/server';

function go(slug: string, kind: 'review_ok' | 'review_error', msg: string): never { redirect(`/products/${encodeURIComponent(slug)}?${kind}=${encodeURIComponent(msg)}#reviews-form`); }

/** Reviews always start in moderation. Whether it is a verified purchase is worked out by the database from real paid orders. */
export async function submitReview(fd: FormData) {
  const slug = String(fd.get('slug') ?? '').replace(/[^a-z0-9-]/g, '').slice(0, 80);
  const c = await getCustomer();
  if (!c) redirect(`/account/login?next=${encodeURIComponent(`/products/${slug}`)}`);
  const p = reviewSchema.safeParse(formObject(fd));
  if (!p.success) go(slug, 'review_error', p.error.issues[0].message);
  const { error } = await (await createServer()).from('reviews').insert({ product_id: p.data.productId, user_id: c.id, rating: p.data.rating, title: p.data.title ?? null, body: p.data.body ?? null });
  if (error) go(slug, 'review_error', error.code === '23505' ? 'You have already reviewed this product.' : 'Could not save your review. Please try again.');
  revalidatePath(`/products/${slug}`);
  go(slug, 'review_ok', 'Thank you. Your review will appear once it has been checked.');
}
