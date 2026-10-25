import type { KProduct } from './types';

const STOP = new Set(['the', 'and', 'for', 'with', 'you', 'your', 'have', 'has', 'are', 'any', 'can', 'could', 'would', 'want', 'need', 'looking', 'something', 'show', 'tell', 'what', 'which', 'how', 'much', 'does', 'do', 'is', 'it', 'me', 'my', 'i', 'a', 'an', 'to', 'of', 'in', 'on', 'under', 'below', 'inch', 'inches', 'wig', 'wigs', 'hair', 'please', 'good', 'best', 'about', 'that', 'this', 'there', 'some', 'like', 'buy', 'get', 'ghs', 'cedis']);

export interface Constraints { maxPriceMinor?: number; minPriceMinor?: number; length?: number }

/** Pulls a budget and length out of free text ("under 1500", "between 800 and 1200", "22 inch"). Anything unclear is ignored. */
export function parseConstraints(q: string): Constraints {
  const text = q.toLowerCase().replace(/,/g, '');
  const out: Constraints = {};
  const num = '(\\d{2,6}(?:\\.\\d{1,2})?)';
  const between = text.match(new RegExp(`between\\s*(?:ghs|gh₵|₵)?\\s*${num}\\s*(?:and|to|-)\\s*(?:ghs|gh₵|₵)?\\s*${num}`));
  if (between) { out.minPriceMinor = Math.round(Number(between[1]) * 100); out.maxPriceMinor = Math.round(Number(between[2]) * 100); }
  else {
    const under = text.match(new RegExp(`(?:under|below|less than|up to|within|max(?:imum)?|budget(?: of| is)?|not more than)\\s*(?:ghs|gh₵|₵)?\\s*${num}`));
    if (under) out.maxPriceMinor = Math.round(Number(under[1]) * 100);
    const over = text.match(new RegExp(`(?:over|above|more than|at least|from)\\s*(?:ghs|gh₵|₵)\\s*${num}`));
    if (over) out.minPriceMinor = Math.round(Number(over[1]) * 100);
  }
  const len = text.match(/(\d{1,2})\s*(?:inch|inches|in\b|")/);
  if (len && Number(len[1]) >= 4 && Number(len[1]) <= 60) out.length = Number(len[1]);
  return out;
}

const tokens = (q: string) => q.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t));

/** Transparent keyword scoring over real catalogue fields. Returns best matches first; score 0 means "no match", never a guess. */
export function selectProducts(q: string, products: KProduct[], limit = 4): KProduct[] {
  const c = parseConstraints(q), toks = tokens(q);
  const scored = products.map((p) => {
    const hay = [p.name, p.type, p.texture, p.construction, p.material, p.lace, p.description, ...p.colors].filter(Boolean).join(' ').toLowerCase();
    let score = 0;
    for (const t of toks) if (hay.includes(t)) score += p.name.toLowerCase().includes(t) ? 3 : 1;
    const priced = p.minPriceMinor !== null && p.maxPriceMinor !== null;
    if (c.maxPriceMinor !== undefined) { if (priced && p.minPriceMinor! <= c.maxPriceMinor) score += 2; else score = -1; }
    if (c.minPriceMinor !== undefined && priced && p.maxPriceMinor! < c.minPriceMinor) score = -1;
    if (c.length !== undefined) { if (p.lengths.includes(c.length)) score += 2; else if (p.lengths.length) score -= 1; }
    if (p.availability === 'out_of_stock') score -= 1;
    const matchedSomething = toks.some((t) => hay.includes(t)) || c.maxPriceMinor !== undefined || c.minPriceMinor !== undefined || c.length !== undefined;
    return { p, score: matchedSomething ? score : 0 };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name)).slice(0, limit).map((s) => s.p);
}
