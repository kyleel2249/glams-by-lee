import { describe, it, expect } from 'vitest';
import { safeNext } from './next';
import { addressSchema, loginSchema, passwordSchema, profileSchema, registerSchema, resetSchema, reviewSchema } from './schemas';

describe('safeNext', () => {
  it('allows same-site paths', () => { expect(safeNext('/account/orders')).toBe('/account/orders'); expect(safeNext('/products/x?a=1')).toBe('/products/x?a=1'); });
  it('rejects other sites and tricks', () => {
    for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/a://b', '/x\r\nSet-Cookie: a=b', '', undefined, 42]) expect(safeNext(bad)).toBe('/account');
  });
  it('never sends customers into the admin area', () => expect(safeNext('/admin/orders')).toBe('/account'));
});

describe('customer forms', () => {
  it('enforces a sensible password policy', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false); expect(passwordSchema.safeParse('onlyletterspassword').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890123').success).toBe(false); expect(passwordSchema.safeParse('GoodPass12345').success).toBe(true);
  });
  it('registration lowercases email and defaults consent to off', () => {
    const r = registerSchema.parse({ name: ' Ama ', email: 'AMA@Example.com', password: 'GoodPass12345' });
    expect(r).toMatchObject({ name: 'Ama', email: 'ama@example.com', marketingConsent: false });
    expect(registerSchema.parse({ name: 'A', email: 'a@b.co', password: 'GoodPass12345', marketingConsent: 'on' }).marketingConsent).toBe(true);
  });
  it('login does not leak password rules', () => expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true));
  it('reset needs matching passwords', () => { expect(resetSchema.safeParse({ password: 'GoodPass12345', confirm: 'Different12345' }).success).toBe(false); expect(resetSchema.safeParse({ password: 'GoodPass12345', confirm: 'GoodPass12345' }).success).toBe(true); });
  it('profile phone is optional but validated', () => { expect(profileSchema.safeParse({ name: 'A' }).success).toBe(true); expect(profileSchema.safeParse({ name: 'A', phone: 'abc' }).success).toBe(false); });
  it('addresses need country and phone', () => {
    const base = { recipientName: 'Ama', phone: '+233 24 000 0000', line1: '1 Main St', city: 'Accra', country: 'gh' };
    expect(addressSchema.parse(base)).toMatchObject({ country: 'GH', isDefault: false }); expect(addressSchema.safeParse({ ...base, country: 'Ghana' }).success).toBe(false); expect(addressSchema.safeParse({ ...base, phone: '1' }).success).toBe(false);
  });
  it('reviews need a rating from 1 to 5 and some text', () => {
    const id = '2f1c0a9e-1b2c-4d3e-8f4a-5b6c7d8e9f01';
    expect(reviewSchema.safeParse({ productId: id, rating: '5', body: 'Lovely' }).success).toBe(true); expect(reviewSchema.safeParse({ productId: id, rating: '6', body: 'x' }).success).toBe(false);
    expect(reviewSchema.safeParse({ productId: id, rating: '4' }).success).toBe(false); expect(reviewSchema.safeParse({ productId: id, rating: '0', body: 'x' }).success).toBe(false);
  });
});
