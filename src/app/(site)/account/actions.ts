'use server';
import { cookies, headers } from 'next/headers';
import { CART_COOKIE } from '@/lib/cartToken';
import { redirect } from 'next/navigation';
import { formObject } from '@/lib/admin/action';
import { customerAuthConfigured, getCustomer } from '@/lib/customer/auth';
import { safeNext } from '@/lib/customer/next';
import { forgotSchema, loginSchema, registerSchema, resetSchema } from '@/lib/customer/schemas';
import { rateLimited } from '@/lib/rateLimit';
import { createAdmin } from '@/lib/supabase/admin';
import { createServer } from '@/lib/supabase/server';

const site = () => (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
function go(path: string, kind: 'error' | 'ok', msg: string, extra = ''): never { redirect(`${path}?${kind}=${encodeURIComponent(msg)}${extra}`); }
const ip = async () => (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
const nextParam = (fd: FormData) => safeNext(fd.get('next'));
const keep = (n: string) => (n !== '/account' ? `&next=${encodeURIComponent(n)}` : '');

/** Orders placed as a guest with this email become visible in the account, but only once the email is verified. */
async function claimIfVerified() {
  const c = await getCustomer();
  if (c?.emailVerified && process.env.SUPABASE_SERVICE_ROLE_KEY) await createAdmin().rpc('claim_guest_orders', { p_user: c.id, p_email: c.email });
}

export async function registerAction(fd: FormData) {
  const next = nextParam(fd);
  if (rateLimited(`register:${await ip()}`, 6)) go('/account/register', 'error', 'Too many attempts. Please wait a minute.', keep(next));
  if (!customerAuthConfigured()) go('/account/register', 'error', 'Accounts are not available yet.', keep(next));
  const p = registerSchema.safeParse(formObject(fd));
  if (!p.success) go('/account/register', 'error', p.error.issues[0].message, keep(next));
  const supabase = await createServer();
  const { error } = await supabase.auth.signUp({
    email: p.data.email, password: p.data.password,
    options: { data: { full_name: p.data.name, marketing_consent: p.data.marketingConsent }, emailRedirectTo: `${site()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error && error.status && error.status >= 500) go('/account/register', 'error', 'Something went wrong. Please try again.', keep(next));
  if (error && /password/i.test(error.message)) go('/account/register', 'error', 'Choose a stronger password.', keep(next));
  // Same message whether or not the email already has an account, so this form cannot be used to find customers.
  const signedIn = await getCustomer();
  if (signedIn) { await claimIfVerified(); redirect(next); }
  go('/account/login', 'ok', 'Almost there. Check your email and confirm your address, then sign in.', keep(next));
}

export async function loginAction(fd: FormData) {
  const next = nextParam(fd);
  if (rateLimited(`login:${await ip()}`, 10)) go('/account/login', 'error', 'Too many attempts. Please wait a minute.', keep(next));
  if (!customerAuthConfigured()) go('/account/login', 'error', 'Accounts are not available yet.', keep(next));
  const p = loginSchema.safeParse(formObject(fd));
  if (!p.success) go('/account/login', 'error', 'Incorrect email or password.', keep(next));
  const { error } = await (await createServer()).auth.signInWithPassword(p.data);
  if (error) go('/account/login', 'error', error.code === 'email_not_confirmed' ? 'Please confirm your email first. Check your inbox for the link.' : 'Incorrect email or password.', keep(next));
  await claimIfVerified();
  redirect(next);
}

export async function logoutAction() {
  if (customerAuthConfigured()) await (await createServer()).auth.signOut();
  (await cookies()).delete(CART_COOKIE);
  redirect('/');
}

export async function forgotAction(fd: FormData) {
  if (rateLimited(`forgot:${await ip()}`, 5)) go('/account/forgot-password', 'error', 'Too many attempts. Please wait a minute.');
  const p = forgotSchema.safeParse(formObject(fd));
  if (!p.success) go('/account/forgot-password', 'error', p.error.issues[0].message);
  if (customerAuthConfigured()) await (await createServer()).auth.resetPasswordForEmail(p.data.email, { redirectTo: `${site()}/auth/callback?next=${encodeURIComponent('/account/reset-password')}` });
  go('/account/forgot-password', 'ok', 'If that email has an account, a reset link is on its way.');
}

export async function resetAction(fd: FormData) {
  const p = resetSchema.safeParse(formObject(fd));
  if (!p.success) go('/account/reset-password', 'error', p.error.issues[0].message);
  if (!(await getCustomer())) go('/account/forgot-password', 'error', 'That link has expired. Request a new one.');
  const { error } = await (await createServer()).auth.updateUser({ password: p.data.password });
  if (error) go('/account/reset-password', 'error', 'Could not update your password. Request a new link and try again.');
  go('/account', 'ok', 'Password updated.');
}
