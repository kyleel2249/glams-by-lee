import 'server-only';
import { cookies } from 'next/headers';
import { CART_COOKIE, hashCartToken, isPlausibleToken, newCartToken } from '@/lib/cartToken';
import { createAdmin } from '@/lib/supabase/admin';
import type { PriceLine } from '@/lib/pricing';

export interface CartLine {
  variantId: string; productId: string; categoryId: string | null; productName: string; slug: string; image: { url: string; alt: string } | null;
  sku: string; attributes: string[]; unitPriceMinor: number; compareAtMinor: number | null; currency: string; quantity: number;
  weightGrams: number; lineTotalMinor: number;
  /** null = no limit (backorder allowed) */
  available: number | null;
  problem: 'unavailable' | 'insufficient_stock' | null;
}
export interface CartSnapshot { cartId: string | null; lines: CartLine[]; subtotalMinor: number; currency: string; count: number; hasProblems: boolean }

const EMPTY: CartSnapshot = { cartId: null, lines: [], subtotalMinor: 0, currency: 'GHS', count: 0, hasProblems: false };
const MAX_LINE_QTY = 20;

interface RawItem {
  quantity: number; variant_id: string;
  product_variants: {
    id: string; sku: string; price_minor: number; compare_at_price_minor: number | null; currency: string; length_inches: number | null; color: string | null;
    density: string | null; cap_size: string | null; weight_grams: number | null; allow_backorder: boolean; is_active: boolean;
    inventory: { on_hand: number; reserved: number } | { on_hand: number; reserved: number }[] | null;
    products: { id: string; slug: string; name: string; category_id: string | null; is_published: boolean; product_images: { url: string; alt_text: string; sort_order: number }[] };
  };
}

const ITEM_SELECT = `quantity, variant_id, product_variants(id, sku, price_minor, compare_at_price_minor, currency, length_inches, color, density, cap_size, weight_grams, allow_backorder, is_active,
  inventory(on_hand, reserved), products(id, slug, name, category_id, is_published, product_images(url, alt_text, sort_order)))`;

export async function readCartToken(): Promise<string | null> {
  const t = (await cookies()).get(CART_COOKIE)?.value;
  return isPlausibleToken(t) ? t : null;
}

async function findCartId(token: string): Promise<string | null> {
  const { data, error } = await createAdmin().from('carts').select('id').eq('guest_token_hash', hashCartToken(token)).maybeSingle();
  if (error) throw new Error('Cart lookup failed');
  return (data as { id: string } | null)?.id ?? null;
}

/** Returns the visitor's cart id, creating the cart and cookie when `create` is true. */
export async function getCartId(create: boolean, currency = 'GHS'): Promise<string | null> {
  const existing = await readCartToken();
  if (existing) { const id = await findCartId(existing); if (id) return id; }
  if (!create) return null;
  const token = newCartToken();
  const { data, error } = await createAdmin().from('carts').insert({ guest_token_hash: hashCartToken(token), currency }).select('id').single();
  if (error || !data) throw new Error('Could not create cart');
  (await cookies()).set(CART_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return (data as { id: string }).id;
}

export async function loadCart(cartId: string | null): Promise<CartSnapshot> {
  if (!cartId) return EMPTY;
  const { data, error } = await createAdmin().from('cart_items').select(ITEM_SELECT).eq('cart_id', cartId).order('created_at');
  if (error) throw new Error('Cart could not be loaded');
  const lines: CartLine[] = ((data ?? []) as unknown as RawItem[]).map((it) => {
    const v = it.product_variants, p = v.products;
    const inv = Array.isArray(v.inventory) ? v.inventory[0] : v.inventory;
    const available = v.allow_backorder ? null : Math.max((inv?.on_hand ?? 0) - (inv?.reserved ?? 0), 0);
    const unavailable = !v.is_active || !p.is_published;
    const img = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
    return {
      variantId: v.id, productId: p.id, categoryId: p.category_id, productName: p.name, slug: p.slug, image: img ? { url: img.url, alt: img.alt_text } : null,
      sku: v.sku, attributes: [v.length_inches ? `${v.length_inches} in` : null, v.color, v.density, v.cap_size].filter((x): x is string => Boolean(x)),
      unitPriceMinor: v.price_minor, compareAtMinor: v.compare_at_price_minor, currency: v.currency.trim(), quantity: it.quantity,
      weightGrams: v.weight_grams ?? 0, lineTotalMinor: v.price_minor * it.quantity, available,
      problem: unavailable ? 'unavailable' : available !== null && it.quantity > available ? 'insufficient_stock' : null,
    };
  });
  const sellable = lines.filter((l) => l.problem !== 'unavailable');
  return {
    cartId, lines, currency: lines[0]?.currency ?? 'GHS',
    subtotalMinor: sellable.reduce((s, l) => s + l.lineTotalMinor, 0),
    count: lines.reduce((s, l) => s + l.quantity, 0), hasProblems: lines.some((l) => l.problem !== null),
  };
}

export const toPriceLines = (lines: CartLine[]): PriceLine[] =>
  lines.map((l) => ({ variantId: l.variantId, productId: l.productId, categoryId: l.categoryId, unitPriceMinor: l.unitPriceMinor, quantity: l.quantity, weightGrams: l.weightGrams }));

export type AddResult = { ok: true } | { ok: false; status: number; error: string };

export async function addToCart(variantId: string, quantity: number): Promise<AddResult> {
  const db = createAdmin();
  const { data: v, error } = await db.from('product_variants')
    .select('id, is_active, allow_backorder, currency, inventory(on_hand, reserved), products(is_published)').eq('id', variantId).maybeSingle();
  if (error) throw new Error('Variant lookup failed');
  const variant = v as unknown as { id: string; is_active: boolean; allow_backorder: boolean; currency: string; inventory: { on_hand: number; reserved: number } | { on_hand: number; reserved: number }[] | null; products: { is_published: boolean } } | null;
  if (!variant || !variant.is_active || !variant.products?.is_published) return { ok: false, status: 404, error: 'This item is no longer available.' };

  const cartId = await getCartId(true, variant.currency.trim());
  if (!cartId) throw new Error('No cart');
  const cart = await loadCart(cartId);
  if (cart.lines.length && cart.currency !== variant.currency.trim()) return { ok: false, status: 409, error: 'Your bag already contains items in another currency.' };

  const existing = cart.lines.find((l) => l.variantId === variantId)?.quantity ?? 0;
  const inv = Array.isArray(variant.inventory) ? variant.inventory[0] : variant.inventory;
  const available = variant.allow_backorder ? Infinity : Math.max((inv?.on_hand ?? 0) - (inv?.reserved ?? 0), 0);
  const wanted = existing + quantity;
  if (available === 0) return { ok: false, status: 409, error: 'Sorry, this item is out of stock.' };
  if (wanted > Math.min(MAX_LINE_QTY, available)) return { ok: false, status: 409, error: available < MAX_LINE_QTY ? `Only ${available} available.` : `You can order up to ${MAX_LINE_QTY} of one item.` };

  const { error: upErr } = await db.from('cart_items').upsert({ cart_id: cartId, variant_id: variantId, quantity: wanted }, { onConflict: 'cart_id,variant_id' });
  if (upErr) throw new Error('Could not update bag');
  await db.from('carts').update({ updated_at: new Date().toISOString() }).eq('id', cartId);
  return { ok: true };
}

export async function setCartQuantity(variantId: string, quantity: number): Promise<AddResult> {
  const cartId = await getCartId(false);
  if (!cartId) return { ok: false, status: 404, error: 'Your bag is empty.' };
  const db = createAdmin();
  if (quantity <= 0) { await db.from('cart_items').delete().eq('cart_id', cartId).eq('variant_id', variantId); return { ok: true }; }
  const cart = await loadCart(cartId);
  const line = cart.lines.find((l) => l.variantId === variantId);
  if (!line) return { ok: false, status: 404, error: 'Item not in your bag.' };
  if (quantity > MAX_LINE_QTY || (line.available !== null && quantity > line.available)) return { ok: false, status: 409, error: line.available !== null && quantity > line.available ? `Only ${line.available} available.` : `You can order up to ${MAX_LINE_QTY} of one item.` };
  const { error } = await db.from('cart_items').update({ quantity }).eq('cart_id', cartId).eq('variant_id', variantId);
  if (error) throw new Error('Could not update bag');
  return { ok: true };
}

export async function clearCart(cartId: string) { await createAdmin().from('cart_items').delete().eq('cart_id', cartId); }
