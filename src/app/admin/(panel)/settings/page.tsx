import { requirePermission } from '@/lib/admin/auth';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, Check, Field, Flash, PageTitle } from '@/components/admin/ui';
import { saveSettings } from './actions';

export const dynamic = 'force-dynamic';

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission('settings.write');
  const sp = await searchParams;
  const { data } = await createAdmin().from('admin_settings').select('key, value');
  const s = new Map(((data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
  const str = (k: string) => (typeof s.get(k) === 'string' ? (s.get(k) as string) : '');
  const social = (s.get('social_links') ?? {}) as Record<string, string>;
  const bps = Number(s.get('tax_rate_bps') ?? 0);
  return (
    <>
      <PageTitle title="Settings" /><Flash ok={sp.ok} error={sp.error} />
      <form action={saveSettings} className="grid max-w-2xl gap-6">
        <Card title="Contact and support">
          <div className="grid gap-3">
            <Field label="WhatsApp number" hint="International format, e.g. +233241234567. The WhatsApp buttons appear only when this is set."><input name="whatsappNumber" defaultValue={str('whatsapp_number')} className="field font-normal" /></Field>
            <Field label="Contact email"><input name="contactEmail" type="email" defaultValue={str('contact_email')} className="field font-normal" /></Field>
            <Field label="Support hours" hint="e.g. Monday to Saturday, 9am to 6pm GMT"><input name="supportHours" defaultValue={str('support_hours')} className="field font-normal" /></Field>
            <Field label="Instagram link"><input name="instagram" type="url" defaultValue={social.instagram ?? ''} placeholder="https://instagram.com/…" className="field font-normal" /></Field>
            <Field label="Facebook link"><input name="facebook" type="url" defaultValue={social.facebook ?? ''} className="field font-normal" /></Field>
            <Field label="TikTok link"><input name="tiktok" type="url" defaultValue={social.tiktok ?? ''} className="field font-normal" /></Field>
          </div>
        </Card>
        <Card title="Checkout">
          <div className="grid gap-3">
            <Field label="Tax rate (%)" hint="Added on top of the discounted subtotal. Leave at 0 until your accountant confirms what applies to you."><input name="taxRatePercent" inputMode="decimal" defaultValue={String(bps / 100)} className="field font-normal" /></Field>
            <Check name="checkoutEnabled" label="Checkout is open (untick to pause orders)" defaultChecked={s.get('checkout_enabled') !== false} />
          </div>
        </Card>
        <button className="btn-gold justify-self-start">Save settings</button>
      </form>
    </>
  );
}
