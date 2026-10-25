'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formObject } from '@/lib/admin/action';
import { requireCustomer } from '@/lib/customer/auth';
import { profileSchema } from '@/lib/customer/schemas';
import { createServer } from '@/lib/supabase/server';

const P = '/account/profile';
function go(kind: 'ok' | 'error', msg: string): never { redirect(`${P}?${kind}=${encodeURIComponent(msg)}`); }

export async function saveProfile(fd: FormData) {
  const c = await requireCustomer(P);
  const p = profileSchema.safeParse(formObject(fd));
  if (!p.success) go('error', p.error.issues[0].message);
  const db = await createServer();
  const { data: cur } = await db.from('profiles').select('marketing_consent').eq('id', c.id).maybeSingle();
  const was = Boolean((cur as { marketing_consent: boolean } | null)?.marketing_consent);
  // The consent timestamp only moves when the choice changes, so it stays an honest record of when they opted in.
  const update = { full_name: p.data.name, phone: p.data.phone ?? null, marketing_consent: p.data.marketingConsent, ...(p.data.marketingConsent !== was ? { marketing_consent_at: p.data.marketingConsent ? new Date().toISOString() : null } : {}) };
  const { error } = await db.from('profiles').update(update).eq('id', c.id);
  if (error) go('error', 'Could not save your details. Please try again.');
  revalidatePath(P);
  go('ok', 'Details saved.');
}

export async function requestDeletion() {
  const c = await requireCustomer(P);
  const { error } = await (await createServer()).from('profiles').update({ deletion_requested_at: new Date().toISOString() }).eq('id', c.id);
  if (error) go('error', 'Could not record your request. Please try again or contact us.');
  revalidatePath(P);
  go('ok', 'We have your request. Your account will be deleted shortly, and we will keep only what the law requires us to (such as order records).');
}

export async function cancelDeletion() {
  const c = await requireCustomer(P);
  await (await createServer()).from('profiles').update({ deletion_requested_at: null }).eq('id', c.id);
  revalidatePath(P);
  go('ok', 'Deletion request cancelled.');
}
