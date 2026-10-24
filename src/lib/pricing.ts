/** Pure pricing engine. The server calls this with data it read from the database; browser totals are never trusted. */

export interface PriceLine { variantId: string; productId: string; categoryId: string | null; unitPriceMinor: number; quantity: number; weightGrams: number }
export interface DiscountRule {
  id: string; code: string; type: 'percentage' | 'fixed' | 'free_shipping';
  percentageOff: number | null; amountOffMinor: number | null; currency: string | null;
  minSubtotalMinor: number; startsAt: string | null; expiresAt: string | null;
  categoryIds: string[]; productIds: string[]; isActive: boolean;
}
export interface RateRule {
  id: string; name: string; methodCode: string; currency: string; flatRateMinor: number; perKgMinor: number;
  minSubtotalMinor: number | null; maxSubtotalMinor: number | null; freeOverSubtotalMinor: number | null;
  estimatedDaysMin: number | null; estimatedDaysMax: number | null; dutiesNote: string | null;
}
export interface Zone { id: string; name: string; countryCodes: string[]; regions: string[] }

export type DiscountResult = { ok: true; discountMinor: number; freeShipping: boolean } | { ok: false; reason: string };

export const subtotalOf = (lines: PriceLine[]) => lines.reduce((s, l) => s + l.unitPriceMinor * l.quantity, 0);
export const weightOf = (lines: PriceLine[]) => lines.reduce((s, l) => s + l.weightGrams * l.quantity, 0);

export function evaluateDiscount(rule: DiscountRule, lines: PriceLine[], currency: string, now = new Date()): DiscountResult {
  if (!rule.isActive) return { ok: false, reason: 'This code is not active.' };
  if (rule.startsAt && new Date(rule.startsAt) > now) return { ok: false, reason: 'This code is not valid yet.' };
  if (rule.expiresAt && new Date(rule.expiresAt) < now) return { ok: false, reason: 'This code has expired.' };
  const subtotal = subtotalOf(lines);
  if (subtotal < rule.minSubtotalMinor) return { ok: false, reason: 'Your order is below the minimum spend for this code.' };

  const restricted = rule.categoryIds.length > 0 || rule.productIds.length > 0;
  const eligible = restricted
    ? lines.filter((l) => rule.productIds.includes(l.productId) || (l.categoryId !== null && rule.categoryIds.includes(l.categoryId)))
    : lines;
  const eligibleSubtotal = subtotalOf(eligible);
  if (restricted && eligibleSubtotal === 0) return { ok: false, reason: 'This code does not apply to the items in your bag.' };

  if (rule.type === 'free_shipping') return { ok: true, discountMinor: 0, freeShipping: true };
  if (rule.type === 'percentage') {
    if (!rule.percentageOff || rule.percentageOff <= 0 || rule.percentageOff > 100) return { ok: false, reason: 'This code is misconfigured.' };
    return { ok: true, discountMinor: Math.floor((eligibleSubtotal * rule.percentageOff) / 100), freeShipping: false };
  }
  if (!rule.amountOffMinor || rule.currency !== currency) return { ok: false, reason: 'This code cannot be used with this currency.' };
  return { ok: true, discountMinor: Math.min(rule.amountOffMinor, eligibleSubtotal), freeShipping: false };
}

/** The most specific matching zone wins: a zone limited to regions beats a country-wide one. */
export function matchZone(zones: Zone[], country: string, region?: string): Zone | null {
  const c = country.toUpperCase();
  const reg = region?.trim().toLowerCase();
  const inCountry = zones.filter((z) => z.countryCodes.map((x) => x.toUpperCase()).includes(c));
  const specific = inCountry.find((z) => z.regions.length > 0 && reg && z.regions.some((r) => r.toLowerCase() === reg));
  if (specific) return specific;
  return inCountry.find((z) => z.regions.length === 0) ?? null;
}

export function rateIsEligible(rate: RateRule, subtotalAfterDiscount: number, currency: string): boolean {
  if (rate.currency !== currency) return false;
  if (rate.minSubtotalMinor !== null && subtotalAfterDiscount < rate.minSubtotalMinor) return false;
  if (rate.maxSubtotalMinor !== null && subtotalAfterDiscount > rate.maxSubtotalMinor) return false;
  return true;
}

export function shippingCost(rate: RateRule, subtotalAfterDiscount: number, weightGrams: number, freeShippingPromo: boolean): number {
  if (freeShippingPromo) return 0;
  if (rate.freeOverSubtotalMinor !== null && subtotalAfterDiscount >= rate.freeOverSubtotalMinor) return 0;
  return rate.flatRateMinor + rate.perKgMinor * Math.ceil(weightGrams / 1000);
}

/** Tax is exclusive and charged on (subtotal - discount). Rounds half up. Rate comes from admin settings (0 until confirmed). */
export function taxOn(taxableMinor: number, rateBps: number): number {
  if (rateBps <= 0) return 0;
  return Math.floor((taxableMinor * rateBps + 5000) / 10000);
}

export interface Totals { subtotalMinor: number; discountMinor: number; shippingMinor: number; taxMinor: number; totalMinor: number }

export function priceOrder(input: { lines: PriceLine[]; discount: { discountMinor: number; freeShipping: boolean } | null; rate: RateRule | null; taxRateBps: number }): Totals {
  const subtotalMinor = subtotalOf(input.lines);
  const discountMinor = Math.min(input.discount?.discountMinor ?? 0, subtotalMinor);
  const afterDiscount = subtotalMinor - discountMinor;
  const shippingMinor = input.rate ? shippingCost(input.rate, afterDiscount, weightOf(input.lines), input.discount?.freeShipping ?? false) : 0;
  const taxMinor = taxOn(afterDiscount, input.taxRateBps);
  // identical to the database CHECK: total = subtotal - discount + shipping + tax
  return { subtotalMinor, discountMinor, shippingMinor, taxMinor, totalMinor: subtotalMinor - discountMinor + shippingMinor + taxMinor };
}
