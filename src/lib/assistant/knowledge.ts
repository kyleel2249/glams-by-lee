import 'server-only';
import { getCategories, getProducts, getSettings, getShippingSummary, getSiteContent } from '@/lib/catalog';
import { genuineSale, priceRange, productAvailability } from '@/lib/catalogTypes';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';
import { createServer } from '@/lib/supabase/server';
import { whatsAppLink } from '@/lib/whatsapp';
import type { KOrder, KProduct, Knowledge } from './types';

const clip = (s: string | null, n: number) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : null);
const POLICY_KEYS = ['shipping', 'returns', 'privacy', 'terms'] as const;

let cache: { at: number; value: Omit<Knowledge, 'orders'> } | null = null;
const TTL_MS = 60_000;

/** Public shop facts (same for every visitor). Cached briefly per server instance to keep database load and latency low. */
async function publicKnowledge(): Promise<Omit<Knowledge, 'orders'>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const [products, categories, settings, zones, ...policies] = await Promise.all([
    getProducts(), getCategories(), getSettings(), getShippingSummary(), ...POLICY_KEYS.map((k) => getSiteContent<{ title?: string; body?: string }>(`policy_${k}`)),
  ]);
  const currency = settings.defaultCurrency;
  const money = (n: number, c: string) => formatMoney(n, c as CurrencyCode);
  const kProducts: KProduct[] = products.map((p) => {
    const range = priceRange(p), cur = range?.currency ?? currency;
    const lengths = [...new Set(p.variants.map((v) => v.lengthInches).filter((x): x is number => x != null))].sort((a, b) => a - b);
    const colors = [...new Set(p.variants.map((v) => v.color).filter((x): x is string => Boolean(x)))];
    return {
      name: p.name, slug: p.slug, type: p.productType, texture: p.texture, construction: p.construction, material: p.hairMaterial, lace: p.laceType,
      description: clip(p.description, 300), care: clip(p.careInstructions, 300), lengths, colors,
      minPriceMinor: range?.min ?? null, maxPriceMinor: range?.max ?? null,
      priceText: range ? (range.min === range.max ? money(range.min, cur) : `From ${money(range.min, cur)}`) : null,
      availability: productAvailability(p), onSale: Boolean(genuineSale(p)), rating: p.rating && p.rating.count > 0 ? p.rating : null,
    };
  });
  const value = {
    currency, products: kProducts, categories: categories.filter((c) => !c.parentId).map((c) => ({ name: c.name, slug: c.slug })),
    policies: Object.fromEntries(POLICY_KEYS.flatMap((k, i) => { const p = policies[i]; return p?.body ? [[k, { title: p.title ?? k, body: p.body }]] : []; })),
    shipping: zones.map((z) => ({
      name: z.name, countries: z.countries,
      rates: z.rates.map((r) => ({
        name: r.name, method: r.methodCode, costText: r.flatRateMinor === 0 ? 'Free' : money(r.flatRateMinor, r.currency), costMinor: r.flatRateMinor,
        days: r.daysMin && r.daysMax ? `Estimated ${r.daysMin}-${r.daysMax} days` : null, dutiesNote: r.dutiesNote,
        freeOverText: r.freeOverMinor !== null ? `over ${money(r.freeOverMinor, r.currency)}` : null,
      })),
    })),
    contact: { whatsappUrl: whatsAppLink(settings.whatsappNumber, 'Hello GLAMS BY LEE, I have a question.'), email: settings.contactEmail, hours: settings.supportHours },
  };
  cache = { at: Date.now(), value };
  return value;
}

/** The signed-in customer's own latest orders, read through THEIR login (row-level security) so no one else's data can appear. No addresses. */
async function customerOrders(): Promise<KOrder[]> {
  const db = await createServer();
  const { data, error } = await db.from('orders').select('id, order_number, status, total_minor, currency').order('placed_at', { ascending: false }).limit(3);
  if (error || !data) return [];
  const rows = data as { id: string; order_number: string; status: OrderStatus; total_minor: number; currency: string }[];
  const { data: ships } = rows.length ? await db.from('shipments').select('order_id, carrier, tracking_number, tracking_url').in('order_id', rows.map((r) => r.id)) : { data: [] };
  const byOrder = new Map(((ships ?? []) as { order_id: string; carrier: string | null; tracking_number: string | null; tracking_url: string | null }[]).map((s) => [s.order_id, s]));
  return rows.map((o) => {
    const s = byOrder.get(o.id);
    return { number: o.order_number, status: STATUS_LABEL[o.status], totalMinor: Number(o.total_minor), totalText: formatMoney(Number(o.total_minor), o.currency.trim() as CurrencyCode),
      tracking: s ? { carrier: s.carrier, number: s.tracking_number, url: s.tracking_url?.startsWith('https://') ? s.tracking_url : null } : null };
  });
}

export async function buildKnowledge(signedIn: boolean): Promise<Knowledge> {
  const base = await publicKnowledge();
  return { ...base, orders: signedIn ? await customerOrders() : null };
}
