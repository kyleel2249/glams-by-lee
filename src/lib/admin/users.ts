import 'server-only';
import { createAdmin } from '@/lib/supabase/admin';

/** id -> email for staff display. Pages through Supabase Auth users (small shop: a handful of pages at most). */
export async function userEmails(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const db = createAdmin();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) break;
    data.users.forEach((u) => map.set(u.id, u.email ?? u.id));
    if (data.users.length < 200) break;
  }
  return map;
}
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (const [id, e] of await userEmails()) if (e.toLowerCase() === target) return id;
  return null;
}
