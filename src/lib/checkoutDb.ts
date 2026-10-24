import 'server-only';
import { createAdmin } from '@/lib/supabase/admin';
import type { DiscountRule, Zone } from '@/lib/pricing';
import type { ZoneRate } from '@/lib/quote';
import type { CheckoutDb } from '@/lib/checkoutService';

const rpcError = (e: { message: string; code?: string }) => Object.assign(new Error(e.message), { code: e.code });

export function createCheckoutDb(): CheckoutDb {
  const db = createAdmin();
  return {
    async placeOrder(order, items) {
      const { data, error } = await db.rpc('place_order', { p_order: order, p_items: items });
      if (error) throw rpcError(error);
      const r = data as { order_id: string; is_new: boolean };
      return { orderId: r.order_id, isNew: r.is_new };
    },
    async getOrder(orderId) {
      const { data, error } = await db.from('orders').select('order_number, total_minor, currency, email, status').eq('id', orderId).single();
      if (error || !data) throw new Error('Order not found after placement');
      const o = data as { order_number: string; total_minor: number; currency: string; email: string; status: string };
      return { orderNumber: o.order_number, totalMinor: Number(o.total_minor), currency: o.currency.trim(), email: o.email, status: o.status };
    },
    async latestPayment(orderId) {
      const { data, error } = await db.from('payments').select('reference, authorization_url').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1);
      if (error) throw new Error('Payment lookup failed');
      const p = (data as { reference: string; authorization_url: string | null }[] | null)?.[0];
      return p ? { reference: p.reference, authorizationUrl: p.authorization_url } : null;
    },
    async createPayment(p) {
      const { error } = await db.from('payments').insert({ order_id: p.orderId, provider: 'paystack', reference: p.reference, amount_minor: p.amountMinor, currency: p.currency });
      if (error) throw new Error(`Could not record payment attempt: ${error.message}`);
    },
    async setAuthorizationUrl(reference, url) { await db.from('payments').update({ authorization_url: url, status: 'processing' }).eq('reference', reference); },
    async failPayment(reference, reason) { await db.rpc('mark_payment_failed', { p_reference: reference, p_reason: reason, p_abandoned: false }); },
    async cancelUnpaid(orderId) { const { error } = await db.rpc('cancel_unpaid_order', { p_order: orderId }); if (error) throw new Error(error.message); },
  };
}

export interface CheckoutRules { zones: Zone[]; rates: ZoneRate[]; taxRateBps: number }

export async function loadCheckoutRules(): Promise<CheckoutRules> {
  const db = createAdmin();
  const [z, r, s] = await Promise.all([
    db.from('shipping_zones').select('id, name, country_codes, regions').eq('is_active', true),
    db.from('shipping_rates').select('id, zone_id, name, method_code, currency, flat_rate_minor, per_kg_minor, min_subtotal_minor, max_subtotal_minor, free_over_subtotal_minor, estimated_days_min, estimated_days_max, duties_note').eq('is_active', true).order('sort_order'),
    db.from('admin_settings').select('value').eq('key', 'tax_rate_bps').maybeSingle(),
  ]);
  if (z.error || r.error || s.error) throw new Error('Could not load shipping rules');
  const bps = Number((s.data as { value: unknown } | null)?.value ?? 0);
  return {
    taxRateBps: Number.isFinite(bps) && bps >= 0 && bps <= 10000 ? Math.round(bps) : 0,
    zones: ((z.data ?? []) as { id: string; name: string; country_codes: string[]; regions: string[] }[]).map((x) => ({ id: x.id, name: x.name, countryCodes: x.country_codes.map((c) => c.trim()), regions: x.regions ?? [] })),
    rates: ((r.data ?? []) as Record<string, unknown>[]).map((x) => ({
      id: x.id as string, zoneId: x.zone_id as string, name: x.name as string, methodCode: x.method_code as string, currency: String(x.currency).trim(),
      flatRateMinor: Number(x.flat_rate_minor), perKgMinor: Number(x.per_kg_minor),
      minSubtotalMinor: x.min_subtotal_minor == null ? null : Number(x.min_subtotal_minor), maxSubtotalMinor: x.max_subtotal_minor == null ? null : Number(x.max_subtotal_minor),
      freeOverSubtotalMinor: x.free_over_subtotal_minor == null ? null : Number(x.free_over_subtotal_minor),
      estimatedDaysMin: x.estimated_days_min as number | null, estimatedDaysMax: x.estimated_days_max as number | null, dutiesNote: x.duties_note as string | null,
    })),
  };
}

export async function findDiscount(code: string | undefined | null): Promise<DiscountRule | null> {
  const c = code?.trim();
  if (!c || !/^[A-Za-z0-9_-]{1,40}$/.test(c)) return null;
  const { data, error } = await createAdmin().from('discount_codes').select('*').eq('code', c).maybeSingle();
  if (error) throw new Error('Discount lookup failed');
  const d = data as Record<string, unknown> | null;
  if (!d) return null;
  return {
    id: d.id as string, code: String(d.code), type: d.discount_type as DiscountRule['type'],
    percentageOff: d.percentage_off == null ? null : Number(d.percentage_off), amountOffMinor: d.amount_off_minor == null ? null : Number(d.amount_off_minor),
    currency: d.currency ? String(d.currency).trim() : null, minSubtotalMinor: Number(d.min_subtotal_minor ?? 0),
    startsAt: d.starts_at as string | null, expiresAt: d.expires_at as string | null,
    categoryIds: (d.category_ids as string[]) ?? [], productIds: (d.product_ids as string[]) ?? [], isActive: Boolean(d.is_active),
  };
}
