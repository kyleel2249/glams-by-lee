import 'server-only';
import { redirect } from 'next/navigation';
import { createServer } from '@/lib/supabase/server';
import { createAdmin } from '@/lib/supabase/admin';
import { can, STAFF_ROLES, type Permission, type StaffRole } from './permissions';

export interface Staff { userId: string; email: string; roles: StaffRole[] }
export const adminConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('YOUR-PROJECT') && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Signed-in staff member, or null. The session is validated with Supabase (getUser), not just read from a cookie. */
export async function getStaff(): Promise<Staff | null> {
  if (!adminConfigured()) return null;
  const { data: { user } } = await (await createServer()).auth.getUser();
  if (!user) return null;
  const { data, error } = await createAdmin().from('user_roles').select('role').eq('user_id', user.id);
  if (error) throw new Error('Could not load staff roles');
  const roles = ((data ?? []) as { role: string }[]).map((r) => r.role).filter((r): r is StaffRole => (STAFF_ROLES as readonly string[]).includes(r));
  return { userId: user.id, email: user.email ?? '', roles };
}

/** Every admin page, action and export starts here. Not signed in goes to login; signed in without the permission gets the forbidden page. */
export async function requirePermission(permission: Permission): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect('/admin/login');
  if (!can(staff.roles, permission)) redirect('/admin/forbidden');
  return staff;
}
