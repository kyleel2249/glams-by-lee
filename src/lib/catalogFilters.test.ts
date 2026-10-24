import { describe, it, expect } from 'vitest';
import { applyFilters, parseFilters, filterOptions } from './catalogFilters';
import type { CatalogProduct, CatalogVariant } from './catalogTypes';
import { normaliseWhatsAppNumber, whatsAppLink } from './whatsapp';

const v = (o: Partial<CatalogVariant>): CatalogVariant => ({
  id: 'v', sku: 's', priceMinor: 100000, compareAtMinor: null, currency: 'GHS', lengthInches: 18, color: 'Natural black',
  density: null, capSize: null, availability: 'in_stock', ...o,
});
const p = (o: Partial<CatalogProduct>): CatalogProduct => ({
  id: 'p', slug: 'p', sku: 'P', name: 'Wig', description: null, productType: 'wig', categoryId: null, hairMaterial: null,
  texture: 'Body wave', construction: 'Lace front', laceType: null, careInstructions: null, shippingReturnsNote: null,
  isFeatured: false, createdAt: '2026-01-01', images: [], variants: [v({})], ...o,
});

describe('parseFilters', () => {
  it('ignores junk and clamps', () => {
    const f = parseFilters({ sort: 'DROP TABLE', length: '9999', min: '-5', q: ' '.repeat(10) });
    expect(f.sort).toBe('featured'); expect(f.length).toBeUndefined(); expect(f.minPriceMinor).toBeUndefined(); expect(f.q).toBeUndefined();
  });
  it('converts price filters to minor units', () => expect(parseFilters({ min: '500', max: '1500.50' })).toMatchObject({ minPriceMinor: 50000, maxPriceMinor: 150050 }));
});

describe('applyFilters', () => {
  const a = p({ id: 'a', name: 'Deep wave unit', texture: 'Deep wave', variants: [v({ priceMinor: 90000, lengthInches: 20 })] });
  const b = p({ id: 'b', name: 'Bob', construction: 'Glueless', isFeatured: true, variants: [v({ priceMinor: 200000, lengthInches: 10, color: 'Honey blonde' })] });
  const c = p({ id: 'c', name: 'Sold out', variants: [v({ availability: 'out_of_stock' })] });
  const all = [a, b, c];
  it('filters by texture', () => expect(applyFilters(all, parseFilters({ texture: 'deep wave' })).map((x) => x.id)).toEqual(['a']));
  it('requires one variant to satisfy colour AND length together', () => {
    expect(applyFilters(all, parseFilters({ color: 'Honey blonde', length: '10' })).map((x) => x.id)).toEqual(['b']);
    expect(applyFilters(all, parseFilters({ color: 'Honey blonde', length: '20' }))).toHaveLength(0);
  });
  it('filters by price range and stock', () => {
    expect(applyFilters(all, parseFilters({ max: '1000' })).map((x) => x.id).sort()).toEqual(['a', 'c']);
    expect(applyFilters(all, parseFilters({ stock: '1' })).map((x) => x.id)).not.toContain('c');
  });
  it('sorts by price and puts featured first by default', () => {
    expect(applyFilters(all, parseFilters({ sort: 'price-asc' }))[0].id).toBe('a');
    expect(applyFilters(all, parseFilters({}))[0].id).toBe('b');
  });
  it('builds options only from real data', () => expect(filterOptions(all).colors).toEqual(['Honey blonde', 'Natural black']));
});

describe('whatsapp', () => {
  it('normalises international numbers', () => expect(normaliseWhatsAppNumber('+233 24 123 4567')).toBe('233241234567'));
  it('rejects unconfigured or malformed values', () => { expect(whatsAppLink(null)).toBeNull(); expect(whatsAppLink('0241234567')).toBeNull(); expect(whatsAppLink('abc')).toBeNull(); });
  it('encodes the prefilled message', () => expect(whatsAppLink('+233241234567', 'Hi & hello')).toBe('https://wa.me/233241234567?text=Hi%20%26%20hello'));
});
