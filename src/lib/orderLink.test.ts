import { describe, it, expect } from 'vitest';
import { orderLinkToken, orderUrl, verifyOrderLinkToken } from './orderLink';

describe('order link token', () => {
  const secret = 'test-secret-value';
  it('verifies its own token', () => expect(verifyOrderLinkToken('GBL-2610-001001', orderLinkToken('GBL-2610-001001', secret), secret)).toBe(true));
  it('rejects another order, another secret, empty and truncated tokens', () => {
    const t = orderLinkToken('GBL-2610-001001', secret);
    expect(verifyOrderLinkToken('GBL-2610-001002', t, secret)).toBe(false);
    expect(verifyOrderLinkToken('GBL-2610-001001', t, 'other')).toBe(false);
    expect(verifyOrderLinkToken('GBL-2610-001001', '', secret)).toBe(false);
    expect(verifyOrderLinkToken('GBL-2610-001001', t.slice(0, 10), secret)).toBe(false);
    expect(verifyOrderLinkToken('GBL-2610-001001', null, secret)).toBe(false);
  });
  it('builds a URL containing the token', () => expect(orderUrl('https://x.test/', 'GBL-1', secret)).toMatch(/^https:\/\/x\.test\/orders\/GBL-1\?t=[\w-]{43}$/));
});
