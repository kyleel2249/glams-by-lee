'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, dbMessage, parseForm } from '@/lib/admin/action';
import { recordAudit } from '@/lib/admin/audit';
import { requirePermission } from '@/lib/admin/auth';
import { categorySchema } from '@/lib/admin/schemas';
import { createAdmin } from '@/lib/supabase/admin';

const P = '/admin/categories';
const refresh = () => { revalidatePath(P); revalidatePath('/shop'); revalidatePath('/'); };
const row = (d: ReturnType<typeof categorySchema.parse>) => ({ name: d.name, slug: d.slug, description: d.description ?? null, parent_id: d.parentId ?? null, sort_order: d.sortOrder, is_visible: d.isVisible });

export async function saveCategory(fd: FormData) {
  const staff = await requirePermission('categories.write');
  const id = z.string().uuid().safeParse(fd.get('id') || undefined);
  const p = parseForm(categorySchema, fd);
  if (!p.ok) back(P, 'error', p.error);
  if (id.success && p.data.parentId === id.data) back(P, 'error', 'A category cannot be its own parent.');
  const db = createAdmin();
  const { error } = id.success ? await db.from('categories').update(row(p.data)).eq('id', id.data) : await db.from('categories').insert(row(p.data));
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, id.success ? 'category.updated' : 'category.created', 'category', id.success ? id.data : null, { name: p.data.name });
  refresh();
  back(P, 'ok', id.success ? 'Category saved.' : 'Category added.');
}

/** Deleting a category that still holds products or sub-categories would orphan them, so it is refused. Hide it instead. */
export async function deleteCategory(fd: FormData) {
  const staff = await requirePermission('categories.write');
  const id = z.string().uuid().safeParse(fd.get('id'));
  if (!id.success) back(P, 'error', 'Category not found.');
  const db = createAdmin();
  const [{ count: products }, { count: children }] = await Promise.all([
    db.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id.data),
    db.from('categories').select('id', { count: 'exact', head: true }).eq('parent_id', id.data),
  ]);
  if ((products ?? 0) > 0 || (children ?? 0) > 0) back(P, 'error', `This category still has ${products ?? 0} product(s) and ${children ?? 0} sub-categor${children === 1 ? 'y' : 'ies'}. Move them first, or hide the category instead.`);
  const { error } = await db.from('categories').delete().eq('id', id.data);
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, 'category.deleted', 'category', id.data);
  refresh();
  back(P, 'ok', 'Category deleted.');
}
