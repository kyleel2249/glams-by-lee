'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, dbMessage } from '@/lib/admin/action';
import { recordAudit } from '@/lib/admin/audit';
import { requirePermission } from '@/lib/admin/auth';
import { STAFF_ROLES } from '@/lib/admin/permissions';
import { findUserIdByEmail } from '@/lib/admin/users';
import { createAdmin } from '@/lib/supabase/admin';

const P = '/admin/team';

export async function grantRole(fd: FormData) {
  const staff = await requirePermission('roles.manage');
  const p = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(STAFF_ROLES) }).safeParse({ email: fd.get('email'), role: fd.get('role') });
  if (!p.success) back(P, 'error', 'Enter the person’s email and choose a role.');
  const userId = await findUserIdByEmail(p.data.email);
  if (!userId) back(P, 'error', 'No account with that email. Ask them to be added in Supabase Authentication (Users → Add user) first.');
  const { error } = await createAdmin().from('user_roles').insert({ user_id: userId, role: p.data.role, granted_by: staff.userId });
  if (error) back(P, 'error', error.code === '23505' ? 'They already have that role.' : dbMessage(error));
  await recordAudit(staff.userId, 'role.granted', 'user', userId, { role: p.data.role, email: p.data.email });
  revalidatePath(P);
  back(P, 'ok', 'Role granted.');
}

export async function revokeRole(fd: FormData) {
  const staff = await requirePermission('roles.manage');
  const id = z.string().uuid().safeParse(fd.get('id'));
  if (!id.success) back(P, 'error', 'Role not found.');
  const db = createAdmin();
  const { data } = await db.from('user_roles').select('user_id, role').eq('id', id.data).maybeSingle();
  const { error } = await db.from('user_roles').delete().eq('id', id.data);   // a database trigger refuses to remove the last owner
  if (error) back(P, 'error', dbMessage(error));
  const r = data as { user_id: string; role: string } | null;
  await recordAudit(staff.userId, 'role.revoked', 'user', r?.user_id ?? null, { role: r?.role });
  revalidatePath(P);
  back(P, 'ok', 'Role removed.');
}
