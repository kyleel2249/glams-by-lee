'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminConfigured, getStaff } from '@/lib/admin/auth';
import { rateLimited } from '@/lib/rateLimit';
import { createServer } from '@/lib/supabase/server';

export async function loginAction(formData: FormData) {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(`admin-login:${ip}`, 8)) redirect('/admin/login?error=' + encodeURIComponent('Too many attempts. Please wait a minute.'));
  if (!adminConfigured()) redirect('/admin/login?error=' + encodeURIComponent('The admin area is not configured yet.'));
  const email = String(formData.get('email') ?? '').trim().toLowerCase(), password = String(formData.get('password') ?? '');
  const supabase = await createServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // One message for every failure so the form cannot be used to discover which emails have accounts.
  if (error) redirect('/admin/login?error=' + encodeURIComponent('Incorrect email or password.'));
  const staff = await getStaff();
  if (!staff || staff.roles.length === 0) { await supabase.auth.signOut(); redirect('/admin/login?error=' + encodeURIComponent('This account does not have admin access.')); }
  redirect('/admin');
}

export async function logoutAction() {
  await (await createServer()).auth.signOut();
  redirect('/admin/login');
}
