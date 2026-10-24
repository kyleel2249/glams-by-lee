'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, dbMessage, parseForm } from '@/lib/admin/action';
import { recordAudit } from '@/lib/admin/audit';
import { requirePermission } from '@/lib/admin/auth';
import { announcementSchema, policySchema } from '@/lib/admin/schemas';
import { createAdmin } from '@/lib/supabase/admin';

const P = '/admin/content';
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const POLICIES = ['shipping', 'returns', 'privacy', 'terms'] as const;

async function put(key: string, value: unknown, actor: string) {
  const { error } = await createAdmin().from('site_content').upsert({ key, value, is_published: true, updated_by: actor, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return error;
}
const refresh = () => { revalidatePath(P); revalidatePath('/', 'layout'); };
const blank = (v: FormDataEntryValue | null) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const rel = z.string().regex(/^\/[A-Za-z0-9/_?=&#.-]*$/, 'Links must start with / (for example /shop)');

export async function saveAnnouncement(fd: FormData) {
  const staff = await requirePermission('content.write');
  const p = parseForm(announcementSchema, fd);
  if (!p.ok) back(P, 'error', p.error);
  if (p.data.enabled && !p.data.text) back(P, 'error', 'Add the announcement text, or turn it off.');
  const error = await put('announcement_bar', { enabled: p.data.enabled, text: p.data.text ?? '' }, staff.userId);
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, 'content.announcement_saved', 'site_content', 'announcement_bar', { enabled: p.data.enabled });
  refresh(); back(P, 'ok', 'Announcement bar saved.');
}

export async function saveHero(fd: FormData) {
  const staff = await requirePermission('content.write');
  const parsed = z.object({
    headline: z.string().trim().min(1).max(120), subtext: z.string().trim().max(300), p_label: z.string().trim().min(1).max(40), p_href: rel, s_label: z.string().trim().min(1).max(40), s_href: rel,
  }).safeParse({ headline: fd.get('headline'), subtext: fd.get('subtext') ?? '', p_label: fd.get('primaryLabel'), p_href: fd.get('primaryHref'), s_label: fd.get('secondaryLabel'), s_href: fd.get('secondaryHref') });
  if (!parsed.success) back(P, 'error', parsed.error.issues[0].message);
  const db = createAdmin();
  const { data: cur } = await db.from('site_content').select('value').eq('key', 'hero').maybeSingle();
  let imageUrl = ((cur as { value: { image_url?: string | null } } | null)?.value.image_url) ?? null;
  const file = fd.get('image');
  if (file instanceof File && file.size > 0) {
    const ext = IMAGE_TYPES[file.type];
    if (!ext) back(P, 'error', 'The hero photo must be JPG, PNG, WebP or AVIF.');
    if (file.size > 5 * 1024 * 1024) back(P, 'error', 'The hero photo is over 5 MB.');
    const objectPath = `site/hero-${crypto.randomUUID()}.${ext}`;
    const up = await db.storage.from('product-images').upload(objectPath, file, { contentType: file.type });
    if (up.error) back(P, 'error', 'Photo upload failed. Check that the product-images storage bucket exists.');
    imageUrl = db.storage.from('product-images').getPublicUrl(objectPath).data.publicUrl;
  } else if (fd.get('removeImage') === 'on') imageUrl = null;
  const d = parsed.data;
  const error = await put('hero', { headline: d.headline, subtext: d.subtext, image_url: imageUrl, primary_cta: { label: d.p_label, href: d.p_href }, secondary_cta: { label: d.s_label, href: d.s_href } }, staff.userId);
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, 'content.hero_saved', 'site_content', 'hero');
  refresh(); back(P, 'ok', 'Homepage banner saved.');
}

export async function savePage(fd: FormData) {
  const staff = await requirePermission('content.write');
  const key = z.enum(['about', 'care_guide']).safeParse(fd.get('key'));
  if (!key.success) back(P, 'error', 'Unknown page.');
  const title = blank(fd.get('title')), body = blank(fd.get('body'));
  if (!body) {
    const { error } = await createAdmin().from('site_content').delete().eq('key', key.data);
    if (error) back(P, 'error', dbMessage(error));
    refresh(); back(P, 'ok', 'Cleared. The default text is shown again.');
  }
  const value = key.data === 'care_guide' ? { title: title ?? 'Wig care guide', body } : { title: title ?? 'About GLAMS BY LEE', body };
  const error = await put(key.data, value, staff.userId);
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, 'content.page_saved', 'site_content', key.data);
  refresh(); revalidatePath('/about'); back(P, 'ok', 'Saved.');
}

export async function savePolicy(fd: FormData) {
  const staff = await requirePermission('content.write');
  const slug = z.enum(POLICIES).safeParse(fd.get('slug'));
  if (!slug.success) back(P, 'error', 'Unknown policy.');
  const p = parseForm(policySchema, fd);
  if (!p.ok) back(P, 'error', p.error);
  const error = await put(`policy_${slug.data}`, { title: p.data.title, body: p.data.body, updated: p.data.updated ?? new Date().toISOString().slice(0, 10) }, staff.userId);
  if (error) back(P, 'error', dbMessage(error));
  await recordAudit(staff.userId, 'content.policy_saved', 'site_content', `policy_${slug.data}`);
  revalidatePath(`/policies/${slug.data}`); revalidatePath(P);
  back(P, 'ok', 'Policy saved. Have it reviewed by a lawyer before launch.');
}
