import { describe, it, expect } from 'vitest';
import { buildQuote, type ZoneRate } from './quote';
import type { DiscountRule, PriceLine, Zone } from './pricing';

const lines: PriceLine[] = [{ variantId: 'v', productId: 'p', categoryId: null, unitPriceMinor: 100000, quantity: 2, weightGrams: 400 }];
const zones: Zone[] = [{ id: 'gh', name: 'Ghana', countryCodes: ['GH'], regions: [] }, { id: 'uk', name: 'UK', countryCodes: ['GB'], regions: [] }];
const rate = (o: Partial<ZoneRate>): ZoneRate => ({ id: 'r1', zoneId: 'gh', name: 'Courier', methodCode: 'courier', currency: 'GHS', flatRateMinor: 5000, perKgMinor: 0, minSubtotalMinor: null, maxSubtotalMinor: null, freeOverSubtotalMinor: null, estimatedDaysMin: 1, estimatedDaysMax: 3, dutiesNote: null, ...o });
const code: DiscountRule = { id: 'd', code: 'TEN', type: 'percentage', percentageOff: 10, amountOffMinor: null, currency: null, minSubtotalMinor: 0, startsAt: null, expiresAt: null, categoryIds: [], productIds: [], isActive: true };

describe('buildQuote', () => {
  it('prices a selected option and the total matches the database rule', () => {
    const q = buildQuote({ lines, currency: 'GHS', country: 'GH', zones, rates: [rate({})], rateId: 'r1', discountRule: code, taxRateBps: 0 });
    expect(q.totals).toEqual({ subtotalMinor: 200000, discountMinor: 20000, shippingMinor: 5000, taxMinor: 0, totalMinor: 185000 });
  });
  it('lists options but gives no totals until one is chosen', () => { const q = buildQuote({ lines, currency: 'GHS', country: 'GH', zones, rates: [rate({})], taxRateBps: 0 }); expect(q.options).toHaveLength(1); expect(q.totals).toBeNull(); });
  it('ignores a rate id that is not offered for this destination', () => expect(buildQuote({ lines, currency: 'GHS', country: 'GH', zones, rates: [rate({ id: 'uk-rate', zoneId: 'uk' })], rateId: 'uk-rate', taxRateBps: 0 }).deliverable).toBe(false));
  it('reports undeliverable destinations', () => expect(buildQuote({ lines, currency: 'GHS', country: 'FR', zones, rates: [rate({})], taxRateBps: 0 })).toMatchObject({ deliverable: false, zoneName: null }));
  it('surfaces discount errors without breaking the quote', () => { const q = buildQuote({ lines, currency: 'GHS', country: 'GH', zones, rates: [rate({})], rateId: 'r1', discountRule: { ...code, isActive: false }, taxRateBps: 0 }); expect(q.discountError).toBeTruthy(); expect(q.totals?.discountMinor).toBe(0); });
  it('free-shipping codes zero out shipping', () => expect(buildQuote({ lines, currency: 'GHS', country: 'GH', zones, rates: [rate({})], rateId: 'r1', discountRule: { ...code, type: 'free_shipping', percentageOff: null }, taxRateBps: 0 }).totals?.shippingMinor).toBe(0));
  it('applies tax to the discounted subtotal', () => expect(buildQuote({ lines, currency: 'GHS', country: 'GH', zones, rates: [rate({})], rateId: 'r1', discountRule: code, taxRateBps: 1000 }).totals?.taxMinor).toBe(18000));
  it('filters rates by currency and subtotal bounds', () => expect(buildQuote({ lines, currency: 'GHS', country: 'GH', zones, rates: [rate({ minSubtotalMinor: 999999 })], taxRateBps: 0 }).options).toHaveLength(0));
});
