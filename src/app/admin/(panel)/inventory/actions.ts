'use server';
import { revalidatePath } from 'next/cache';
import { back, dbMessage, parseForm } from '@/lib/admin/action';
import { requirePermission } from '@/lib/admin/auth';
import { adjustSchema } from '@/lib/admin/schemas';
import { createAdmin } from '@/lib/supabase/admin';

export async function adjustStock(fd: FormData) {
  const staff = await requirePermission('inventory.adjust');
  const p = parseForm(adjustSchema, fd);
  if (!p.ok) back('/admin/inventory', 'error', p.error);
  // adjust_stock records who, when, why and refuses to drop stock below what is reserved for open orders.
  const { error } = await createAdmin().rpc('adjust_stock', { p_variant: p.data.variantId, p_delta: p.data.quantity, p_type: p.data.type, p_reason: p.data.reason, p_actor: staff.userId });
  if (error) back('/admin/inventory', 'error', dbMessage(error, 'Could not adjust stock.'));
  revalidatePath('/admin/inventory'); revalidatePath('/shop');
  back('/admin/inventory', 'ok', 'Stock updated and logged.');
}
