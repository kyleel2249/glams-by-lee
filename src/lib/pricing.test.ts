import { describe, it, expect } from 'vitest';
import { evaluateDiscount, matchZone, priceOrder, rateIsEligible, shippingCost, taxOn, type DiscountRule, type PriceLine, type RateRule, type Zone } from './pricing';

const line = (o: Partial<PriceLine> = {}): PriceLine => ({ variantId: 'v1', productId: 'p1', categoryId: 'c1', unitPriceMinor: 100000, quantity: 1, weightGrams: 500, ...o });
const rule = (o: Partial<DiscountRule> = {}): DiscountRule => ({ id: 'd', code: 'X', type: 'percentage', percentageOff: 10, amountOffMinor: null, currency: null, minSubtotalMinor: 0, startsAt: null, expiresAt: null, categoryIds: [], productIds: [], isActive: true, ...o });
const rate = (o: Partial<RateRule> = {}): RateRule => ({ id: 'r', name: 'Courier', methodCode: 'courier', currency: 'GHS', flatRateMinor: 5000, perKgMinor: 0, minSubtotalMinor: null, maxSubtotalMinor: null, freeOverSubtotalMinor: null, estimatedDaysMin: null, estimatedDaysMax: null, dutiesNote: null, ...o });

describe('discounts', () => {
  const now = new Date('2026-06-01');
  it('percentage rounds down', () => expect(evaluateDiscount(rule(), [line({ unitPriceMinor: 999 })], 'GHS', now)).toEqual({ ok: true, discountMinor: 99, freeShipping: false }));
  it('fixed is capped at the subtotal', () => expect(evaluateDiscount(rule({ type: 'fixed', amountOffMinor: 500000, currency: 'GHS', percentageOff: null }), [line()], 'GHS', now)).toMatchObject({ ok: true, discountMinor: 100000 }));
  it('fixed rejects a currency mismatch', () => expect(evaluateDiscount(rule({ type: 'fixed', amountOffMinor: 100, currency: 'USD', percentageOff: null }), [line()], 'GHS', now).ok).toBe(false));
  it('enforces expiry, start date, active flag and minimum spend', () => {
    expect(evaluateDiscount(rule({ expiresAt: '2026-01-01' }), [line()], 'GHS', now).ok).toBe(false);
    expect(evaluateDiscount(rule({ startsAt: '2027-01-01' }), [line()], 'GHS', now).ok).toBe(false);
    expect(evaluateDiscount(rule({ isActive: false }), [line()], 'GHS', now).ok).toBe(false);
    expect(evaluateDiscount(rule({ minSubtotalMinor: 200000 }), [line()], 'GHS', now).ok).toBe(false);
  });
  it('category restriction discounts only eligible lines', () => {
    const lines = [line({ categoryId: 'c1', unitPriceMinor: 100000 }), line({ variantId: 'v2', productId: 'p2', categoryId: 'c2', unitPriceMinor: 50000 })];
    expect(evaluateDiscount(rule({ categoryIds: ['c2'] }), lines, 'GHS', now)).toMatchObject({ ok: true, discountMinor: 5000 });
    expect(evaluateDiscount(rule({ categoryIds: ['c9'] }), lines, 'GHS', now).ok).toBe(false);
  });
  it('free shipping gives no money off but flags shipping', () => expect(evaluateDiscount(rule({ type: 'free_shipping', percentageOff: null }), [line()], 'GHS', now)).toEqual({ ok: true, discountMinor: 0, freeShipping: true }));
});

describe('zones and shipping', () => {
  const zones: Zone[] = [{ id: 'gh', name: 'Ghana', countryCodes: ['GH'], regions: [] }, { id: 'accra', name: 'Greater Accra', countryCodes: ['GH'], regions: ['Greater Accra'] }, { id: 'uk', name: 'UK', countryCodes: ['GB'], regions: [] }];
  it('prefers the region-specific zone', () => expect(matchZone(zones, 'gh', 'greater accra')?.id).toBe('accra'));
  it('falls back to the country-wide zone', () => expect(matchZone(zones, 'GH', 'Ashanti')?.id).toBe('gh'));
  it('returns null for unsupported destinations', () => expect(matchZone(zones, 'FR')).toBeNull());
  it('adds weight charges per started kg', () => expect(shippingCost(rate({ perKgMinor: 1000 }), 100000, 1500, false)).toBe(5000 + 2000));
  it('free over threshold and free-shipping promo', () => {
    expect(shippingCost(rate({ freeOverSubtotalMinor: 100000 }), 100000, 500, false)).toBe(0);
    expect(shippingCost(rate(), 1, 500, true)).toBe(0);
  });
  it('eligibility honours currency and subtotal bounds', () => {
    expect(rateIsEligible(rate({ currency: 'USD' }), 1, 'GHS')).toBe(false);
    expect(rateIsEligible(rate({ minSubtotalMinor: 5000 }), 4000, 'GHS')).toBe(false);
    expect(rateIsEligible(rate({ maxSubtotalMinor: 5000 }), 6000, 'GHS')).toBe(false);
  });
});

describe('priceOrder', () => {
  it('total equals subtotal - discount + shipping + tax', () => {
    const t = priceOrder({ lines: [line({ quantity: 2 })], discount: { discountMinor: 20000, freeShipping: false }, rate: rate(), taxRateBps: 1500 });
    expect(t).toEqual({ subtotalMinor: 200000, discountMinor: 20000, shippingMinor: 5000, taxMinor: 27000, totalMinor: 212000 });
  });
  it('never discounts below zero', () => expect(priceOrder({ lines: [line()], discount: { discountMinor: 999999, freeShipping: false }, rate: null, taxRateBps: 0 }).totalMinor).toBe(0));
  it('zero tax by default and rounds half up', () => { expect(taxOn(100000, 0)).toBe(0); expect(taxOn(1, 5000)).toBe(1); });
});
