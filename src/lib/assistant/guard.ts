import type { Knowledge } from './types';

const AMOUNT = /(?:gh₵|ghs|₵|usd|gbp|eur|us\$|\$|£|€)\s?(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s?(?:ghs|usd|gbp|eur|cedis?|ghana cedis)\b/gi;

/** Every amount the assistant is allowed to quote: real prices, real delivery costs, the customer's own order totals. */
export function allowedAmounts(k: Knowledge): Set<number> {
  const set = new Set<number>();
  const add = (n: number | null | undefined) => { if (typeof n === 'number' && Number.isFinite(n)) set.add(Math.round(n)); };
  k.products.forEach((p) => { add(p.minPriceMinor); add(p.maxPriceMinor); });
  k.shipping.forEach((z) => z.rates.forEach((r) => { add(r.costMinor); const m = r.freeOverText?.match(/(\d[\d,]*(?:\.\d{1,2})?)/); if (m) add(Math.round(Number(m[1].replace(/,/g, '')) * 100)); }));
  k.orders?.forEach((o) => add(o.totalMinor));
  return set;
}

const contextText = (k: Knowledge) => JSON.stringify([k.shipping, Object.values(k.policies).map((p) => p.body), k.contact.hours]);

export interface GuardResult { ok: boolean; reason?: string }

/**
 * Last line of defence against invented facts. The model is told never to make these up; this checks that it did not.
 * Blocks: money amounts that are not real prices, percentage discounts, promo codes, free-delivery claims with no matching rule,
 * and day counts that appear nowhere in the shop's own shipping or policy text.
 */
export function checkGrounding(answer: string, k: Knowledge): GuardResult {
  const allowed = allowedAmounts(k);
  for (const m of answer.matchAll(AMOUNT)) {
    const minor = Math.round(Number((m[1] ?? m[2]).replace(/,/g, '')) * 100);
    if (!allowed.has(minor)) return { ok: false, reason: 'unverified amount' };
  }
  if (/\b\d{1,3}\s?%\s?(?:off|discount|reduction|cheaper)/i.test(answer) || /\bdiscount of\b/i.test(answer)) return { ok: false, reason: 'discount claim' };
  if (/\b(?:promo|coupon|discount|voucher)\s+code\b/i.test(answer) || /\b(?:[Uu]se|[Ee]nter|[Aa]pply|[Tt]ry|[Ww]ith)\s+(?:the\s+)?code\s+["']?[A-Z0-9]{3,}/.test(answer)) return { ok: false, reason: 'promo code' };
  const hasFreeRule = k.shipping.some((z) => z.rates.some((r) => r.freeOverText !== null || r.costMinor === 0));
  if (/\bfree\s+(?:shipping|delivery)\b/i.test(answer) && !hasFreeRule) return { ok: false, reason: 'free delivery claim' };
  const ctx = contextText(k);
  for (const m of answer.matchAll(/\b(\d{1,3})(?:\s?(?:-|–|to)\s?(\d{1,3}))?\s*(?:business\s+|working\s+)?(?:days?|weeks?)\b/gi)) {
    for (const n of [m[1], m[2]].filter(Boolean)) if (!new RegExp(`(?<![\\d.])${n}(?![\\d])`).test(ctx)) return { ok: false, reason: 'unverified time frame' };
  }
  if (/\b(?:only|just)\s+\d+\s+(?:left|remaining|in stock)\b/i.test(answer) || /\b\d+\s+(?:units?|pieces?)\s+(?:left|in stock|remaining)\b/i.test(answer)) return { ok: false, reason: 'stock quantity' };
  if (/\b(?:ignore|disregard)\s+(?:all\s+|the\s+)?(?:previous|prior|above)\s+instructions\b/i.test(answer) || /system prompt/i.test(answer)) return { ok: false, reason: 'instruction leak' };
  return { ok: true };
}
