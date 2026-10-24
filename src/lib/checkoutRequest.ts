import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const country = z.string().trim().length(2).transform((s) => s.toUpperCase()).refine((s) => /^[A-Z]{2}$/.test(s));

export const quoteSchema = z.object({
  country, region: z.string().trim().max(80).optional(), rateId: z.string().uuid().optional(), code: z.string().trim().max(40).optional(),
});

export const checkoutSchema = quoteSchema.extend({
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number'),
  name: text(120), line1: text(160), line2: z.string().trim().max(160).optional(), city: text(80), postalCode: z.string().trim().max(20).optional(),
  rateId: z.string().uuid(), note: z.string().trim().max(500).optional(), idempotencyKey: z.string().uuid(),
});
export type CheckoutRequest = z.infer<typeof checkoutSchema>;
