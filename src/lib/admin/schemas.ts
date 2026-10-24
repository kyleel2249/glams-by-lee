import { z } from 'zod';
import { toMinor } from '@/lib/money';
import { normaliseWhatsAppNumber } from '@/lib/whatsapp';
import { slugify } from './slug';

const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());
const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optText = (max: number) => z.preprocess(blank, z.string().trim().max(max).optional());
const reqText = (max: number) => z.string().trim().min(1, 'Required').max(max);
const uuid = z.string().uuid();
const optUuid = z.preprocess(blank, uuid.optional());
/** Money typed in major units (GH₵ 1,250.50) and stored as integer minor units. */
export const money = z.preprocess((v) => (typeof v === 'string' ? v.replace(/,/g, '').trim() : v),
  z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount like 1250 or 1250.50').transform((s) => toMinor(s)));
const optMoney = z.preprocess(blank, money.optional());
const optInt = (min: number, max: number) => z.preprocess(blank, z.coerce.number().int().min(min).max(max).optional());
const optDate = z.preprocess(blank, z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date').optional());

export const PRODUCT_TYPES = ['wig', 'bundle', 'closure_frontal', 'wig_cap', 'hair_care', 'accessory'] as const;

export const productSchema = z.object({
  name: reqText(160), slug: optText(80), sku: reqText(60).regex(/^[A-Za-z0-9._-]+$/, 'Letters, numbers, dot, dash and underscore only'),
  description: optText(5000), productType: z.enum(PRODUCT_TYPES), categoryId: optUuid,
  hairMaterial: optText(80), texture: optText(80), construction: optText(80), laceType: optText(80),
  careInstructions: optText(3000), shippingReturnsNote: optText(1000), isFeatured: checkbox, isPublished: checkbox,
}).transform((p) => ({ ...p, slug: p.slug ? slugify(p.slug) : slugify(p.name) }));

export const variantSchema = z.object({
  sku: reqText(60).regex(/^[A-Za-z0-9._-]+$/, 'Letters, numbers, dot, dash and underscore only'),
  lengthInches: optInt(1, 80), color: optText(60), density: optText(40), capSize: optText(40),
  price: money, compareAt: optMoney, weightGrams: optInt(0, 100000), lowStockThreshold: z.preprocess(blank, z.coerce.number().int().min(0).max(1000).default(2)),
  allowBackorder: checkbox, isActive: checkbox,
}).refine((v) => v.compareAt === undefined || v.compareAt > v.price, { message: 'Compare-at price must be higher than the price', path: ['compareAt'] });

export const categorySchema = z.object({
  name: reqText(80), slug: optText(80), description: optText(500), parentId: optUuid, sortOrder: z.preprocess(blank, z.coerce.number().int().min(0).max(9999).default(0)), isVisible: checkbox,
}).transform((c) => ({ ...c, slug: c.slug ? slugify(c.slug) : slugify(c.name) }));

export const discountSchema = z.object({
  code: reqText(40).regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, dash and underscore only').transform((s) => s.toUpperCase()),
  discountType: z.enum(['percentage', 'fixed', 'free_shipping']),
  percentageOff: z.preprocess(blank, z.coerce.number().gt(0).max(100).optional()), amountOff: optMoney, currency: z.preprocess(blank, z.string().length(3).transform((s) => s.toUpperCase()).optional()),
  minSubtotal: z.preprocess(blank, money.default('0')), startsAt: optDate, expiresAt: optDate,
  usageLimit: optInt(1, 1_000_000), perCustomerLimit: optInt(1, 1000), isActive: checkbox,
}).superRefine((d, ctx) => {
  if (d.discountType === 'percentage' && d.percentageOff === undefined) ctx.addIssue({ code: 'custom', path: ['percentageOff'], message: 'Enter a percentage' });
  if (d.discountType === 'fixed' && (d.amountOff === undefined || !d.currency)) ctx.addIssue({ code: 'custom', path: ['amountOff'], message: 'Enter an amount and currency' });
  if (d.startsAt && d.expiresAt && Date.parse(d.expiresAt) <= Date.parse(d.startsAt)) ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Expiry must be after the start' });
});

const csvList = (max: number) => z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v), z.array(z.string().trim().max(max)).max(60).default([]));
export const zoneSchema = z.object({
  name: reqText(80), countryCodes: z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : v), z.array(z.string().regex(/^[A-Z]{2}$/, 'Use 2-letter country codes like GH, GB')).min(1, 'Add at least one country')),
  regions: csvList(80), isActive: checkbox,
});
export const rateSchema = z.object({
  zoneId: uuid, name: reqText(80), methodCode: z.enum(['courier', 'collection', 'international']), currency: z.string().length(3).transform((s) => s.toUpperCase()),
  flatRate: money, perKg: z.preprocess(blank, money.default('0')), minSubtotal: optMoney, maxSubtotal: optMoney, freeOver: optMoney,
  daysMin: optInt(0, 90), daysMax: optInt(0, 90), dutiesNote: optText(300), isActive: checkbox,
}).refine((r) => r.daysMin === undefined || r.daysMax === undefined || r.daysMax >= r.daysMin, { message: 'Maximum days must be at least the minimum', path: ['daysMax'] });

export const trackingSchema = z.object({
  carrier: reqText(80), trackingNumber: reqText(80),
  trackingUrl: z.preprocess(blank, z.string().url().refine((u) => u.startsWith('https://'), 'Tracking links must start with https://').optional()),
  markShipped: checkbox,
});
export const adjustSchema = z.object({
  variantId: uuid, type: z.enum(['received', 'adjusted', 'damaged', 'returned']), quantity: z.coerce.number().int().min(-100000).max(100000).refine((n) => n !== 0, 'Quantity cannot be zero'),
  reason: z.string().trim().min(3, 'Give a short reason').max(200),
}).superRefine((a, ctx) => {
  if ((a.type === 'received' || a.type === 'returned') && a.quantity < 0) ctx.addIssue({ code: 'custom', path: ['quantity'], message: `${a.type} must be a positive number` });
  if (a.type === 'damaged' && a.quantity > 0) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Damaged stock must be a negative number' });
});
export const refundSchema = z.object({ orderId: uuid, amount: money, reason: z.string().trim().min(3, 'Give a short reason').max(300) });
export const statusSchema = z.object({ orderId: uuid, to: z.enum(['processing', 'ready_for_dispatch', 'shipped', 'delivered', 'cancelled']), note: optText(500) });

export const settingsSchema = z.object({
  whatsappNumber: z.preprocess(blank, z.string().refine((s) => normaliseWhatsAppNumber(s) !== null, 'Use international format, e.g. +233241234567').optional()),
  contactEmail: z.preprocess(blank, z.string().email().max(254).optional()), supportHours: optText(120),
  instagram: z.preprocess(blank, z.string().url().startsWith('https://').optional()), facebook: z.preprocess(blank, z.string().url().startsWith('https://').optional()),
  tiktok: z.preprocess(blank, z.string().url().startsWith('https://').optional()),
  taxRatePercent: z.preprocess(blank, z.coerce.number().min(0).max(100).default(0)), checkoutEnabled: checkbox,
});
export const announcementSchema = z.object({ enabled: checkbox, text: optText(160) });
export const policySchema = z.object({ title: reqText(120), body: z.string().trim().min(1, 'Required').max(20000), updated: optText(40) });
