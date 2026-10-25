'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back } from '@/lib/admin/action';
import { recordAudit } from '@/lib/admin/audit';
import { requirePermission } from '@/lib/admin/auth';
import { createAdmin } from '@/lib/supabase/admin';

const P = '/admin/privacy';

/**
 * Deletes the customer's account. Their saved addresses, wishlist, cart, profile and reviews go with it.
 * Order records stay (accounting and legal needs) but are unlinked from the account. Marketing emails stop.
 */
export async function deleteCustomerAccount(fd: FormData) {
  const staff = await requirePermission('privacy.manage');
  const id = z.string().uuid().safeParse(fd.get('userId'));
  if (!id.success) back(P, 'error', 'Customer not found.');
  const db = createAdmin();
  const { data: prof } = await db.from('profiles').select('deletion_requested_at').eq('id', id.data).maybeSingle();
  if (!(prof as { deletion_requested_at: string | null } | null)?.deletion_requested_at) back(P, 'error', 'This customer has not asked to be deleted.');
  const { data: u } = await db.auth.admin.getUserById(id.data);
  const email = u.user?.email;
  const { count: staffRoles } = await db.from('user_roles').select('id', { count: 'exact', head: true }).eq('user_id', id.data);
  if ((staffRoles ?? 0) > 0) back(P, 'error', 'This account has staff access. Remove its roles on the Team page first.');
  if (email) await db.from('newsletter_subscriptions').update({ unsubscribed_at: new Date().toISOString() }).eq('email', email);
  const { error } = await db.auth.admin.deleteUser(id.data);
  if (error) { console.error('account deletion failed', error.message); back(P, 'error', 'Could not delete the account. Please try again.'); }
  await recordAudit(staff.userId, 'privacy.account_deleted', 'user', id.data);   // the audit entry holds the id only, not the email
  revalidatePath(P);
  back(P, 'ok', 'Account deleted.');
}
