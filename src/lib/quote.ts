import { evaluateDiscount, matchZone, priceOrder, rateIsEligible, shippingCost, subtotalOf, type DiscountRule, type PriceLine, type RateRule, type Totals, type Zone } from './pricing';

export interface ShippingOption { id: string; name: string; methodCode: string; costMinor: number; daysMin: number | null; daysMax: number | null; dutiesNote: string | null }
export interface Quote {
  deliverable: boolean; zoneName: string | null; options: ShippingOption[]; selected: ShippingOption | null;
  discount: { code: string; discountMinor: number; freeShipping: boolean } | null; discountError: string | null; totals: Totals | null;
}
export type ZoneRate = RateRule & { zoneId: string };

/** Everything the checkout screen and the order placement share, so the number shown is the number charged. */
export function buildQuote(i: {
  lines: PriceLine[]; currency: string; country: string; region?: string; zones: Zone[]; rates: ZoneRate[];
  rateId?: string | null; discountRule?: DiscountRule | null; taxRateBps: number; now?: Date;
}): Quote {
  let discount: Quote['discount'] = null; let discountError: string | null = null;
  if (i.discountRule) {
    const r = evaluateDiscount(i.discountRule, i.lines, i.currency, i.now);
    if (r.ok) discount = { code: i.discountRule.code, discountMinor: r.discountMinor, freeShipping: r.freeShipping }; else discountError = r.reason;
  }
  const zone = matchZone(i.zones, i.country, i.region);
  if (!zone) return { deliverable: false, zoneName: null, options: [], selected: null, discount, discountError, totals: null };

  const afterDiscount = subtotalOf(i.lines) - (discount?.discountMinor ?? 0);
  const weight = i.lines.reduce((s, l) => s + l.weightGrams * l.quantity, 0);
  const eligible = i.rates.filter((r) => r.zoneId === zone.id && rateIsEligible(r, afterDiscount, i.currency));
  const options: ShippingOption[] = eligible.map((r) => ({
    id: r.id, name: r.name, methodCode: r.methodCode, costMinor: shippingCost(r, afterDiscount, weight, discount?.freeShipping ?? false),
    daysMin: r.estimatedDaysMin, daysMax: r.estimatedDaysMax, dutiesNote: r.dutiesNote,
  }));
  const selected = options.find((o) => o.id === i.rateId) ?? null;
  const rate = selected ? eligible.find((r) => r.id === selected.id)! : null;
  const totals = selected ? priceOrder({ lines: i.lines, discount, rate, taxRateBps: i.taxRateBps }) : null;
  return { deliverable: options.length > 0, zoneName: zone.name, options, selected, discount, discountError, totals };
}
