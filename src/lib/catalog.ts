import { createPublic } from '@/lib/supabase/public';
import type { ApprovedReview, Availability, CatalogCategory, CatalogProduct } from './catalogTypes';

interface RawProduct {
  id: string; slug: string; sku: string; name: string; description: string | null; product_type: string; category_id: string | null;
  hair_material: string | null; texture: string | null; construction: string | null; lace_type: string | null;
  care_instructions: string | null; shipping_returns_note: string | null; is_featured: boolean; created_at: string;
  product_images: { url: string; alt_text: string; sort_order: number; variant_id: string | null }[];
  product_variants: { id: string; sku: string; price_minor: number; compare_at_price_minor: number | null; currency: string;
    length_inches: number | null; color: string | null; density: string | null; cap_size: string | null; is_active: boolean; sort_order: number }[];
}

const PRODUCT_SELECT = `id, slug, sku, name, description, product_type, category_id, hair_material, texture, construction, lace_type,
  care_instructions, shipping_returns_note, is_featured, created_at,
  product_images(url, alt_text, sort_order, variant_id),
  product_variants(id, sku, price_minor, compare_at_price_minor, currency, length_inches, color, density, cap_size, is_active, sort_order)`;

/**
 * When Supabase IS configured, a failed query must throw: Next.js then keeps serving the last good cached page
 * instead of caching an empty catalogue. When Supabase is NOT configured the helpers return empty results.
 */
function ok<T>(res: { data: T | null; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(`Catalogue query failed: ${res.error.message}`);
  return res.data;
}

async function availabilityMap(productIds: string[]): Promise<Map<string, Availability>> {
  const db = createPublic();
  const map = new Map<string, Availability>();
  if (!db || !productIds.length) return map;
  const data = ok(await db.from('public_variant_availability').select('variant_id, availability').in('product_id', productIds));
  (data ?? []).forEach((r: { variant_id: string; availability: Availability }) => map.set(r.variant_id, r.availability));
  return map;
}

function shape(rows: RawProduct[], avail: Map<string, Availability>): CatalogProduct[] {
  return rows.map((r) => ({
    id: r.id, slug: r.slug, sku: r.sku, name: r.name, description: r.description, productType: r.product_type, categoryId: r.category_id,
    hairMaterial: r.hair_material, texture: r.texture, construction: r.construction, laceType: r.lace_type,
    careInstructions: r.care_instructions, shippingReturnsNote: r.shipping_returns_note, isFeatured: r.is_featured, createdAt: r.created_at,
    images: [...r.product_images].sort((a, b) => a.sort_order - b.sort_order).map((i) => ({ url: i.url, alt: i.alt_text, variantId: i.variant_id })),
    variants: r.product_variants.filter((v) => v.is_active).sort((a, b) => a.sort_order - b.sort_order).map((v) => ({
      id: v.id, sku: v.sku, priceMinor: v.price_minor, compareAtMinor: v.compare_at_price_minor, currency: v.currency.trim(),
      lengthInches: v.length_inches, color: v.color, density: v.density, capSize: v.cap_size,
      availability: avail.get(v.id) ?? 'out_of_stock',
    })),
  }));
}

export async function getCategories(): Promise<CatalogCategory[]> {
  const db = createPublic(); if (!db) return [];
  const data = ok(await db.from('categories').select('id, parent_id, name, slug, description, image_url').order('sort_order'));
  return (data ?? []).map((c: { id: string; parent_id: string | null; name: string; slug: string; description: string | null; image_url: string | null }) =>
    ({ id: c.id, parentId: c.parent_id, name: c.name, slug: c.slug, description: c.description, imageUrl: c.image_url }));
}

/** All published products (optionally within one category and its children). Filtering/sorting happens in catalogFilters.ts. */
export async function getProducts(categorySlug?: string): Promise<CatalogProduct[]> {
  const db = createPublic(); if (!db) return [];
  let query = db.from('products').select(PRODUCT_SELECT).eq('is_published', true);
  if (categorySlug) {
    const cats = await getCategories();
    const root = cats.find((c) => c.slug === categorySlug);
    if (!root) return [];
    query = query.in('category_id', cats.filter((c) => c.id === root.id || c.parentId === root.id).map((c) => c.id));
  }
  const data = ok(await query.order('created_at', { ascending: false }));
  const rows = (data ?? []) as unknown as RawProduct[];
  return shape(rows, await availabilityMap(rows.map((r) => r.id)));
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const db = createPublic(); if (!db) return null;
  const data = ok(await db.from('products').select(PRODUCT_SELECT).eq('slug', slug).eq('is_published', true).maybeSingle());
  if (!data) return null;
  const row = data as unknown as RawProduct;
  return shape([row], await availabilityMap([row.id]))[0];
}

export async function getApprovedReviews(productId: string): Promise<ApprovedReview[]> {
  const db = createPublic(); if (!db) return [];
  const data = ok(await db.from('reviews').select('id, rating, title, body, is_verified_purchase, created_at').eq('product_id', productId).eq('status', 'approved').order('created_at', { ascending: false }).limit(20));
  return (data ?? []).map((r: { id: string; rating: number; title: string | null; body: string | null; is_verified_purchase: boolean; created_at: string }) =>
    ({ id: r.id, rating: r.rating, title: r.title, body: r.body, verified: r.is_verified_purchase, createdAt: r.created_at }));
}

export async function getSiteContent<T = Record<string, unknown>>(key: string): Promise<T | null> {
  const db = createPublic(); if (!db) return null;
  const data = ok(await db.from('site_content').select('value').eq('key', key).eq('is_published', true).maybeSingle());
  return ((data as { value: T } | null)?.value) ?? null;
}

export interface StoreSettings {
  whatsappNumber: string | null; supportHours: string | null; contactEmail: string | null;
  socialLinks: Record<string, string>; defaultCurrency: string;
}
export async function getSettings(): Promise<StoreSettings> {
  const base: StoreSettings = { whatsappNumber: null, supportHours: null, contactEmail: null, socialLinks: {}, defaultCurrency: 'GHS' };
  const db = createPublic(); if (!db) return base;
  const data = ok(await db.from('admin_settings').select('key, value').eq('is_public', true));
  const m = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const str = (k: string) => (typeof m.get(k) === 'string' && (m.get(k) as string).trim() ? (m.get(k) as string).trim() : null);
  return {
    whatsappNumber: str('whatsapp_number'), supportHours: str('support_hours'), contactEmail: str('contact_email'),
    socialLinks: (m.get('social_links') as Record<string, string>) ?? {}, defaultCurrency: str('default_currency') ?? 'GHS',
  };
}

/** Active delivery zones the merchant has configured. Used so the site only advertises delivery that really exists. */
export async function getShippingZoneNames(): Promise<string[]> {
  const db = createPublic(); if (!db) return [];
  const data = ok(await db.from('shipping_zones').select('name').eq('is_active', true));
  return (data ?? []).map((z: { name: string }) => z.name);
}
