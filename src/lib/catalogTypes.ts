export type Availability = 'in_stock' | 'low_stock' | 'backorder' | 'out_of_stock';

export interface CatalogVariant {
  id: string; sku: string; priceMinor: number; compareAtMinor: number | null; currency: string;
  lengthInches: number | null; color: string | null; density: string | null; capSize: string | null;
  availability: Availability;
}
export interface CatalogImage { url: string; alt: string; variantId: string | null }
export interface CatalogProduct {
  id: string; slug: string; sku: string; name: string; description: string | null;
  productType: string; categoryId: string | null;
  hairMaterial: string | null; texture: string | null; construction: string | null; laceType: string | null;
  careInstructions: string | null; shippingReturnsNote: string | null;
  isFeatured: boolean; createdAt: string;
  images: CatalogImage[]; variants: CatalogVariant[];
}
export interface CatalogCategory { id: string; parentId: string | null; name: string; slug: string; description: string | null; imageUrl: string | null }
export interface ApprovedReview { id: string; rating: number; title: string | null; body: string | null; verified: boolean; createdAt: string }

const RANK: Availability[] = ['in_stock', 'low_stock', 'backorder', 'out_of_stock'];
export function productAvailability(p: CatalogProduct): Availability {
  const found = RANK.find((a) => p.variants.some((v) => v.availability === a));
  return found ?? 'out_of_stock';
}
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  in_stock: 'In stock', low_stock: 'Low stock', backorder: 'Available to order', out_of_stock: 'Out of stock',
};
export function priceRange(p: CatalogProduct): { min: number; max: number; currency: string } | null {
  if (!p.variants.length) return null;
  const prices = p.variants.map((v) => v.priceMinor);
  return { min: Math.min(...prices), max: Math.max(...prices), currency: p.variants[0].currency };
}
/** A sale exists only when the merchant set a higher compare-at price on a variant. */
export function genuineSale(p: CatalogProduct): { was: number } | null {
  const cheapest = [...p.variants].sort((a, b) => a.priceMinor - b.priceMinor)[0];
  return cheapest?.compareAtMinor && cheapest.compareAtMinor > cheapest.priceMinor ? { was: cheapest.compareAtMinor } : null;
}
