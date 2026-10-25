'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getCustomer } from '@/lib/customer/auth';
import { createServer } from '@/lib/supabase/server';

export type WishlistResult = { status: 'added' | 'removed' | 'login' | 'error' };

/** Toggles a product on the signed-in customer's wishlist. Row-level security keeps it to their own list. */
export async function toggleWishlist(productId: string): Promise<WishlistResult> {
  const id = z.string().uuid().safeParse(productId);
  if (!id.success) return { status: 'error' };
  const c = await getCustomer();
  if (!c) return { status: 'login' };
  const db = await createServer();
  let { data: list } = await db.from('wishlists').select('id').eq('user_id', c.id).maybeSingle();
  if (!list) {
    const created = await db.from('wishlists').upsert({ user_id: c.id }, { onConflict: 'user_id' }).select('id').single();
    if (created.error || !created.data) return { status: 'error' };
    list = created.data;
  }
  const wishlistId = (list as { id: string }).id;
  const { data: existing } = await db.from('wishlist_items').select('product_id').eq('wishlist_id', wishlistId).eq('product_id', id.data).maybeSingle();
  if (existing) { const { error } = await db.from('wishlist_items').delete().eq('wishlist_id', wishlistId).eq('product_id', id.data); if (error) return { status: 'error' }; revalidatePath('/account/wishlist'); return { status: 'removed' }; }
  const { error } = await db.from('wishlist_items').insert({ wishlist_id: wishlistId, product_id: id.data });
  if (error) return { status: 'error' };
  revalidatePath('/account/wishlist');
  return { status: 'added' };
}

export async function isWishlisted(productId: string): Promise<boolean> {
  const c = await getCustomer();
  if (!c || !z.string().uuid().safeParse(productId).success) return false;
  const { data } = await (await createServer()).from('wishlist_items').select('product_id, wishlists!inner(user_id)').eq('product_id', productId).eq('wishlists.user_id', c.id).maybeSingle();
  return Boolean(data);
}
