import { z } from 'zod';

const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());
export const passwordSchema = z.string().min(10, 'Use at least 10 characters').max(128, 'That password is too long')
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), 'Include at least one letter and one number');

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120), email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  password: passwordSchema, marketingConsent: checkbox,
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(128) });
export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email').max(254) });
export const resetSchema = z.object({ password: passwordSchema, confirm: z.string() }).refine((v) => v.password === v.confirm, { message: 'The two passwords do not match', path: ['confirm'] });

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(120),
  phone: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number').optional()),
  marketingConsent: checkbox,
});
export const addressSchema = z.object({
  label: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(40).optional()),
  recipientName: z.string().trim().min(1, 'Enter the recipient name').max(120), phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(1, 'Enter the address').max(160),
  line2: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(160).optional()),
  city: z.string().trim().min(1, 'Enter the city or town').max(80),
  region: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(80).optional()),
  postalCode: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(20).optional()),
  country: z.string().trim().length(2).transform((s) => s.toUpperCase()).refine((s) => /^[A-Z]{2}$/.test(s), 'Choose a country'),
  isDefault: checkbox,
});
export const reviewSchema = z.object({
  productId: z.string().uuid(), rating: z.coerce.number().int().min(1, 'Choose a star rating').max(5),
  title: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(100).optional()),
  body: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().trim().max(2000).optional()),
}).refine((r) => Boolean(r.title || r.body), { message: 'Write a few words about the product', path: ['body'] });
