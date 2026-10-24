'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, dbMessage, parseForm } from '@/lib/admin/action';
import { recordAudit } from '@/lib/admin/audit';
import { requirePermission } from '@/lib/admin/auth';
import { rateSchema, zoneSchema } from '@/lib/admin/schemas';
import { createAdmin } from '@/lib/supabase/admin';

const P = '/admin/shipping';
const done = () => { revalidatePath(P); revalidatePath('/checkout'); revalidatePath('/'); };
const uuid = (fd: FormData, k = 'id') => z.string().uuid().safeParse(fd.get(k) || undefined);

export async function saveZone(fd: FormData) {
  const staff = await requirePermission('shipping.write');
  const id = uuid(fd), p = parseForm(zoneSchema, fd);
  if (!p.ok) back(P, 'error', p.error);
  const r = { name: p.data.name, country_codes: p.data.countryCodes, regions: p.data.regions, is_active: p.data.isActive };
  const db = createAdmin();
  const { error } = id.success ? await db.from('shipping_zones').update(r).eq('id', id.data) : await db.from('shipping_zones').insert(r);
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, id.success ? 'shipping_zone.updated' : 'shipping_zone.created', 'shipping_zone', id.success ? id.data : null, { name: p.data.name });
  done(); back(P, 'ok', 'Zone saved.');
}

export async function deleteZone(fd: FormData) {
  const staff = await requirePermission('shipping.write');
  const id = uuid(fd); if (!id.success) back(P, 'error', 'Zone not found.');
  const { error } = await createAdmin().from('shipping_zones').delete().eq('id', id.data);
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, 'shipping_zone.deleted', 'shipping_zone', id.data);
  done(); back(P, 'ok', 'Zone and its rates deleted. Past orders keep their shipping details.');
}

export async function saveRate(fd: FormData) {
  const staff = await requirePermission('shipping.write');
  const id = uuid(fd), p = parseForm(rateSchema, fd);
  if (!p.ok) back(P, 'error', p.error);
  const d = p.data;
  const r = { zone_id: d.zoneId, name: d.name, method_code: d.methodCode, currency: d.currency, flat_rate_minor: d.flatRate, per_kg_minor: d.perKg, min_subtotal_minor: d.minSubtotal ?? null, max_subtotal_minor: d.maxSubtotal ?? null,
    free_over_subtotal_minor: d.freeOver ?? null, estimated_days_min: d.daysMin ?? null, estimated_days_max: d.daysMax ?? null, duties_note: d.dutiesNote ?? null, is_active: d.isActive };
  const db = createAdmin();
  const { error } = id.success ? await db.from('shipping_rates').update(r).eq('id', id.data) : await db.from('shipping_rates').insert(r);
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, id.success ? 'shipping_rate.updated' : 'shipping_rate.created', 'shipping_rate', id.success ? id.data : null, { name: d.name, flat_minor: d.flatRate });
  done(); back(P, 'ok', 'Rate saved.');
}

export async function deleteRate(fd: FormData) {
  const staff = await requirePermission('shipping.write');
  const id = uuid(fd); if (!id.success) back(P, 'error', 'Rate not found.');
  const { error } = await createAdmin().from('shipping_rates').delete().eq('id', id.data);
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, 'shipping_rate.deleted', 'shipping_rate', id.data);
  done(); back(P, 'ok', 'Rate deleted.');
}
