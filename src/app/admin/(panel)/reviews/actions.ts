'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, dbMessage } from '@/lib/admin/action';
import { recordAudit } from '@/lib/admin/audit';
import { requirePermission } from '@/lib/admin/auth';
import { createAdmin } from '@/lib/supabase/admin';

export async function moderateReview(fd: FormData) {
  const staff = await requirePermission('reviews.moderate');
  const p = z.object({ id: z.string().uuid(), decision: z.enum(['approved', 'rejected', 'pending']) }).safeParse({ id: fd.get('id'), decision: fd.get('decision') });
  if (!p.success) back('/admin/reviews', 'error', 'Review not found.');
  const db = createAdmin();
  const { data, error } = await db.from('reviews').update({ status: p.data.decision, moderated_by: staff.userId, moderated_at: new Date().toISOString() }).eq('id', p.data.id).select('products(slug)').single();
  if (error) back('/admin/reviews', 'error', dbMessage(error));
  await recordAudit(staff.userId, `review.${p.data.decision}`, 'review', p.data.id);
  const slug = (data as unknown as { products: { slug: string } | null } | null)?.products?.slug;
  revalidatePath('/admin/reviews'); if (slug) revalidatePath(`/products/${slug}`); revalidatePath('/shop');
  back('/admin/reviews', 'ok', `Review ${p.data.decision}.`);
}
