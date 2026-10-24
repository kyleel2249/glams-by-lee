/** Money is always integer minor units (pesewas/cents). Never floats. */
export type CurrencyCode = 'GHS' | 'USD' | 'GBP' | 'EUR' | 'NGN';

export function toMinor(major: number | string): number {
  const n = typeof major === 'string' ? Number(major) : major;
  if (!Number.isFinite(n) || n < 0) throw new RangeError('Invalid amount');
  return Math.round(n * 100);
}

export function formatMoney(minor: number, currency: CurrencyCode = 'GHS', locale = 'en-GH'): string {
  if (!Number.isInteger(minor)) throw new RangeError('Minor units must be an integer');
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
}

/** Percentage discount in minor units, rounded down so the shop never over-discounts. */
export function percentOff(subtotalMinor: number, percent: number): number {
  if (percent <= 0 || percent > 100) throw new RangeError('Percent must be in (0, 100]');
  return Math.floor((subtotalMinor * percent) / 100);
}
