'use server';
import { revalidatePath } from 'next/cache';
import { back, dbMessage, parseForm } from '@/lib/admin/action';
import { recordAudit } from '@/lib/admin/audit';
import { requirePermission } from '@/lib/admin/auth';
import { settingsSchema } from '@/lib/admin/schemas';
import { createAdmin } from '@/lib/supabase/admin';

export async function saveSettings(fd: FormData) {
  const staff = await requirePermission('settings.write');
  const p = parseForm(settingsSchema, fd);
  if (!p.ok) back('/admin/settings', 'error', p.error);
  const d = p.data, now = new Date().toISOString(), by = staff.userId;
  const social = Object.fromEntries(Object.entries({ instagram: d.instagram, facebook: d.facebook, tiktok: d.tiktok }).filter(([, v]) => v));
  const rows = [
    { key: 'whatsapp_number', value: d.whatsappNumber ?? null, is_public: true }, { key: 'contact_email', value: d.contactEmail ?? null, is_public: true },
    { key: 'support_hours', value: d.supportHours ?? null, is_public: true }, { key: 'social_links', value: social, is_public: true },
    { key: 'tax_rate_bps', value: Math.round(d.taxRatePercent * 100), is_public: false }, { key: 'checkout_enabled', value: d.checkoutEnabled, is_public: true },
    { key: 'assistant_enabled', value: d.assistantEnabled, is_public: true }, { key: 'assistant_daily_limit', value: d.assistantDailyLimit, is_public: false },
  ].map((r) => ({ ...r, updated_by: by, updated_at: now }));
  const { error } = await createAdmin().from('admin_settings').upsert(rows, { onConflict: 'key' });
  if (error) back('/admin/settings', 'error', dbMessage(error));
  await recordAudit(by, 'settings.saved', 'settings', null, { taxRatePercent: d.taxRatePercent, checkoutEnabled: d.checkoutEnabled, assistantEnabled: d.assistantEnabled, whatsappSet: Boolean(d.whatsappNumber) });
  revalidatePath('/', 'layout');
  back('/admin/settings', 'ok', 'Settings saved.');
}
