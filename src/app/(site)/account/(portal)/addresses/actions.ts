'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { formObject } from '@/lib/admin/action';
import { requireCustomer } from '@/lib/customer/auth';
import { addressSchema } from '@/lib/customer/schemas';
import { createServer } from '@/lib/supabase/server';

const P = '/account/addresses';
function go(kind: 'ok' | 'error', msg: string): never { redirect(`${P}?${kind}=${encodeURIComponent(msg)}`); }

export async function saveAddress(fd: FormData) {
  const c = await requireCustomer(P);
  const id = z.string().uuid().safeParse(fd.get('id') || undefined);
  const p = addressSchema.safeParse(formObject(fd));
  if (!p.success) go('error', p.error.issues[0].message);
  const d = p.data;
  const row = { label: d.label ?? null, recipient_name: d.recipientName, phone: d.phone, line1: d.line1, line2: d.line2 ?? null, city: d.city, region: d.region ?? null, postal_code: d.postalCode ?? null, country_code: d.country, is_default: d.isDefault };
  const db = await createServer();   // row-level security: only this customer's rows can be touched
  if (d.isDefault) await db.from('addresses').update({ is_default: false }).eq('user_id', c.id);
  const { error } = id.success ? await db.from('addresses').update(row).eq('id', id.data).eq('user_id', c.id) : await db.from('addresses').insert({ ...row, user_id: c.id });
  if (error) go('error', 'Could not save the address. Please try again.');
  revalidatePath(P);
  go('ok', 'Address saved.');
}

export async function deleteAddress(fd: FormData) {
  const c = await requireCustomer(P);
  const id = z.string().uuid().safeParse(fd.get('id'));
  if (!id.success) go('error', 'Address not found.');
  const { error } = await (await createServer()).from('addresses').delete().eq('id', id.data).eq('user_id', c.id);
  if (error) go('error', 'Could not delete the address.');
  revalidatePath(P);
  go('ok', 'Address deleted.');
}
