import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyPaystackSignature } from './paystack';

const secret = 'sk_test_example';
const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } });
const sign = (b: string, s = secret) => createHmac('sha512', s).update(b).digest('hex');

describe('paystack webhook signature', () => {
  it('accepts a correct signature', () => expect(verifyPaystackSignature(body, sign(body), secret)).toBe(true));
  it('rejects a tampered body', () => expect(verifyPaystackSignature(body + ' ', sign(body), secret)).toBe(false));
  it('rejects a wrong secret', () => expect(verifyPaystackSignature(body, sign(body, 'other'), secret)).toBe(false));
  it('rejects a missing signature', () => expect(verifyPaystackSignature(body, null, secret)).toBe(false));
  it('rejects a short signature without throwing', () => expect(verifyPaystackSignature(body, 'abc', secret)).toBe(false));
});
