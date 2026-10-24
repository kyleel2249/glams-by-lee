import { describe, it, expect } from 'vitest';
import { can, PERMISSIONS, STAFF_ROLES } from './permissions';
import { csvCell, toCsv } from './csv';
import { slugify } from './slug';
import { isDate, safeQuery } from './query';
import { adjustSchema, announcementSchema, categorySchema, discountSchema, productSchema, rateSchema, settingsSchema, trackingSchema, variantSchema, zoneSchema } from './schemas';

describe('permissions', () => {
  it('owner can do everything', () => PERMISSIONS.forEach((p) => expect(can(['owner'], p)).toBe(true)));
  it('audit log and role management are owner-only', () => STAFF_ROLES.filter((r) => r !== 'owner').forEach((r) => { expect(can([r], 'audit.view')).toBe(false); expect(can([r], 'roles.manage')).toBe(false); }));
  it('customer support can read orders but not change or export them', () => { expect(can(['customer_support'], 'orders.view')).toBe(true); expect(can(['customer_support'], 'orders.update')).toBe(false); expect(can(['customer_support'], 'orders.export')).toBe(false); });
  it('content editor cannot touch prices, stock, discounts or settings', () => ['variants.write', 'inventory.adjust', 'discounts.write', 'settings.write', 'orders.view'].forEach((p) => expect(can(['content_editor'], p as never)).toBe(false)));
  it('inventory manager adjusts stock but cannot see orders or refund', () => { expect(can(['inventory_manager'], 'inventory.adjust')).toBe(true); expect(can(['inventory_manager'], 'orders.view')).toBe(false); expect(can(['inventory_manager'], 'refunds.manage')).toBe(false); });
  it('no roles means no access; multiple roles combine', () => { expect(can([], 'dashboard.view')).toBe(false); expect(can(['content_editor', 'order_manager'], 'orders.update')).toBe(true); });
});

describe('csv', () => {
  it('neutralises spreadsheet formulas in text', () => { expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`); expect(csvCell('+1')).toBe("'+1"); expect(csvCell('@SUM')).toBe("'@SUM"); expect(csvCell('-2+3')).toBe("'-2+3"); });
  it('keeps genuine negative numbers numeric', () => expect(csvCell(-500)).toBe('-500'));
  it('quotes commas, quotes and newlines', () => { expect(csvCell('a,b')).toBe('"a,b"'); expect(csvCell('say "hi"')).toBe('"say ""hi"""'); expect(csvCell('a\nb')).toBe('"a\nb"'); });
  it('builds rows', () => expect(toCsv([['a', 1], ['b', null]])).toBe('a,1\r\nb,\r\n'));
});

describe('slugify', () => it('makes clean slugs', () => { expect(slugify('Body Wave & Lace Front 18"')).toBe('body-wave-and-lace-front-18'); expect(slugify('  Café   Crème ')).toBe('cafe-creme'); }));

describe('product and variant forms', () => {
  it('derives a slug and parses checkboxes', () => {
    const p = productSchema.parse({ name: 'Honey Bob', sku: 'BOB-1', productType: 'wig', isFeatured: 'on' });
    expect(p.slug).toBe('honey-bob'); expect(p.isFeatured).toBe(true); expect(p.isPublished).toBe(false);
  });
  it('rejects bad SKUs and unknown types', () => { expect(productSchema.safeParse({ name: 'x', sku: 'bad sku!', productType: 'wig' }).success).toBe(false); expect(productSchema.safeParse({ name: 'x', sku: 'A', productType: 'car' }).success).toBe(false); });
  it('converts prices to integer minor units', () => { const v = variantSchema.parse({ sku: 'V-1', price: '1,250.50', compareAt: '1500' }); expect(v.price).toBe(125050); expect(v.compareAt).toBe(150000); });
  it('rejects a compare-at price that is not higher, and negative or odd prices', () => {
    expect(variantSchema.safeParse({ sku: 'V', price: '100', compareAt: '90' }).success).toBe(false);
    expect(variantSchema.safeParse({ sku: 'V', price: '-5' }).success).toBe(false);
    expect(variantSchema.safeParse({ sku: 'V', price: '1.234' }).success).toBe(false);
  });
});

describe('other admin forms', () => {
  it('category defaults', () => expect(categorySchema.parse({ name: 'Bob Wigs' })).toMatchObject({ slug: 'bob-wigs', sortOrder: 0, isVisible: false }));
  it('discount rules need matching fields', () => {
    expect(discountSchema.safeParse({ code: 'ten', discountType: 'percentage', percentageOff: '10' }).success).toBe(true);
    expect(discountSchema.parse({ code: 'ten', discountType: 'percentage', percentageOff: '10' }).code).toBe('TEN');
    expect(discountSchema.safeParse({ code: 'x', discountType: 'percentage' }).success).toBe(false);
    expect(discountSchema.safeParse({ code: 'x', discountType: 'fixed', amountOff: '50' }).success).toBe(false);
    expect(discountSchema.safeParse({ code: 'x', discountType: 'percentage', percentageOff: '150' }).success).toBe(false);
    expect(discountSchema.safeParse({ code: 'x', discountType: 'free_shipping', startsAt: '2026-02-01', expiresAt: '2026-01-01' }).success).toBe(false);
  });
  it('zones need valid country codes', () => {
    expect(zoneSchema.parse({ name: 'Ghana', countryCodes: 'gh, gb' }).countryCodes).toEqual(['GH', 'GB']);
    expect(zoneSchema.safeParse({ name: 'x', countryCodes: 'Ghana' }).success).toBe(false);
  });
  it('rates convert money and check day ranges', () => {
    const id = '2f1c0a9e-1b2c-4d3e-8f4a-5b6c7d8e9f01';
    expect(rateSchema.parse({ zoneId: id, name: 'Courier', methodCode: 'courier', currency: 'ghs', flatRate: '30' })).toMatchObject({ flatRate: 3000, perKg: 0, currency: 'GHS' });
    expect(rateSchema.safeParse({ zoneId: id, name: 'x', methodCode: 'courier', currency: 'GHS', flatRate: '1', daysMin: '5', daysMax: '2' }).success).toBe(false);
  });
  it('tracking links must be https', () => {
    expect(trackingSchema.safeParse({ carrier: 'DHL', trackingNumber: '123', trackingUrl: 'http://x.test' }).success).toBe(false);
    expect(trackingSchema.safeParse({ carrier: 'DHL', trackingNumber: '123', trackingUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(trackingSchema.safeParse({ carrier: 'DHL', trackingNumber: '123', trackingUrl: 'https://track.test/1' }).success).toBe(true);
  });
  it('stock adjustments need a reason and a sensible sign', () => {
    const id = '2f1c0a9e-1b2c-4d3e-8f4a-5b6c7d8e9f01';
    expect(adjustSchema.safeParse({ variantId: id, type: 'received', quantity: '5', reason: 'New batch' }).success).toBe(true);
    expect(adjustSchema.safeParse({ variantId: id, type: 'received', quantity: '-5', reason: 'New batch' }).success).toBe(false);
    expect(adjustSchema.safeParse({ variantId: id, type: 'damaged', quantity: '3', reason: 'Water damage' }).success).toBe(false);
    expect(adjustSchema.safeParse({ variantId: id, type: 'adjusted', quantity: '0', reason: 'count' }).success).toBe(false);
    expect(adjustSchema.safeParse({ variantId: id, type: 'adjusted', quantity: '2', reason: '' }).success).toBe(false);
  });
  it('settings validate WhatsApp, email and https social links', () => {
    expect(settingsSchema.safeParse({ whatsappNumber: '0241234567' }).success).toBe(false);
    expect(settingsSchema.safeParse({ whatsappNumber: '+233241234567', contactEmail: 'a@b.co', instagram: 'https://instagram.com/x' }).success).toBe(true);
    expect(settingsSchema.safeParse({ instagram: 'javascript:alert(1)' }).success).toBe(false);
    expect(settingsSchema.parse({}).taxRatePercent).toBe(0);
  });
  it('announcement text is optional', () => expect(announcementSchema.parse({ enabled: 'on' })).toEqual({ enabled: true, text: undefined }));
});

describe('admin query helpers', () => {
  it('strips filter-injection characters', () => { expect(safeQuery('a,b)or(status.eq.paid')).toBe('abor' + 'status.eq.paid'); expect(safeQuery('x%25y*')).toBe('x25y'); expect(safeQuery(undefined)).toBe(''); expect(safeQuery('a'.repeat(100)).length).toBe(60); });
  it('validates dates', () => { expect(isDate('2026-10-24')).toBe(true); expect(isDate('2026-13-45')).toBe(false); expect(isDate("2026-10-24' or 1=1")).toBe(false); expect(isDate(undefined)).toBe(false); });
});
