import { describe, it, expect } from 'vitest';
import { toMinor, percentOff, formatMoney } from './money';
import { canTransition, nextStatuses } from './orderStatus';

describe('money', () => {
  it('converts to integer minor units without float drift', () => {
    expect(toMinor(19.99)).toBe(1999);
    expect(toMinor('0.1')).toBe(10);
  });
  it('rejects bad input', () => { expect(() => toMinor(-1)).toThrow(); expect(() => toMinor('abc')).toThrow(); });
  it('rounds discounts down', () => { expect(percentOff(999, 10)).toBe(99); });
  it('formats GHS', () => { expect(formatMoney(150000, 'GHS')).toMatch(/1,500\.00/); });
});

describe('order status', () => {
  it('blocks skipping payment', () => { expect(canTransition('pending_payment', 'shipped')).toBe(false); });
  it('allows the happy path', () => {
    const path = ['pending_payment', 'paid', 'processing', 'ready_for_dispatch', 'shipped', 'delivered'] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });
  it('treats cancelled and refunded as terminal', () => {
    expect(nextStatuses('cancelled')).toHaveLength(0);
    expect(nextStatuses('refunded')).toHaveLength(0);
  });
});
