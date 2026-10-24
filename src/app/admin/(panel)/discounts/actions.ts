'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, dbMessage, parseForm } from '@/lib/admin/action';
import { recordAudit } from '@/lib/admin/audit';
import { requirePermission } from '@/lib/admin/auth';
import { discountSchema } from '@/lib/admin/schemas';
import { createAdmin } from '@/lib/supabase/admin';

const P = '/admin/discounts';
const row = (d: ReturnType<typeof discountSchema.parse>) => ({
  code: d.code, discount_type: d.discountType, percentage_off: d.discountType === 'percentage' ? d.percentageOff ?? null : null,
  amount_off_minor: d.discountType === 'fixed' ? d.amountOff ?? null : null, currency: d.discountType === 'fixed' ? d.currency ?? null : null,
  min_subtotal_minor: d.minSubtotal, starts_at: d.startsAt ? new Date(d.startsAt).toISOString() : null, expires_at: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
  usage_limit: d.usageLimit ?? null, per_customer_limit: d.perCustomerLimit ?? null, is_active: d.isActive,
});

export async function saveDiscount(fd: FormData) {
  const staff = await requirePermission('discounts.write');
  const id = z.string().uuid().safeParse(fd.get('id') || undefined);
  const p = parseForm(discountSchema, fd);
  if (!p.ok) back(P, 'error', p.error);
  const db = createAdmin();
  const { error } = id.success ? await db.from('discount_codes').update(row(p.data)).eq('id', id.data) : await db.from('discount_codes').insert(row(p.data));
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, id.success ? 'discount.updated' : 'discount.created', 'discount', id.success ? id.data : null, { code: p.data.code, type: p.data.discountType, active: p.data.isActive });
  revalidatePath(P);
  back(P, 'ok', id.success ? 'Discount saved.' : 'Discount created.');
}

export async function deleteDiscount(fd: FormData) {
  const staff = await requirePermission('discounts.write');
  const id = z.string().uuid().safeParse(fd.get('id'));
  if (!id.success) back(P, 'error', 'Discount not found.');
  const db = createAdmin();
  const { count } = await db.from('discount_redemptions').select('id', { count: 'exact', head: true }).eq('discount_code_id', id.data);
  if ((count ?? 0) > 0) back(P, 'error', 'This code has been used on orders, so it cannot be deleted. Untick "Active" to stop it working.');
  const { error } = await db.from('discount_codes').delete().eq('id', id.data);
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, 'discount.deleted', 'discount', id.data);
  revalidatePath(P);
  back(P, 'ok', 'Discount deleted.');
}
