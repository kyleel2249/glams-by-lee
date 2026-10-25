import Link from 'next/link';
import { ProductGrid } from '@/components/shop/ProductCard';
import { getProducts } from '@/lib/catalog';
import { requireCustomer } from '@/lib/customer/auth';
import { createServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function Wishlist() {
  const c = await requireCustomer('/account/wishlist');
  const { data } = await (await createServer()).from('wishlist_items').select('product_id, wishlists!inner(user_id)').eq('wishlists.user_id', c.id);
  const ids = new Set(((data ?? []) as { product_id: string }[]).map((r) => r.product_id));
  const products = ids.size ? (await getProducts()).filter((p) => ids.has(p.id)) : [];
  return (
    <>
      <h1 className="text-4xl">Your wishlist</h1>
      {products.length ? <div className="mt-6"><ProductGrid products={products} /></div> : <p className="mt-6 text-muted">Nothing saved yet. Tap “Save to wishlist” on a product you love. <Link href="/shop" className="underline">Browse the shop</Link></p>}
      {ids.size > products.length ? <p className="mt-4 text-xs text-muted">Some saved items are no longer available.</p> : null}
    </>
  );
}
