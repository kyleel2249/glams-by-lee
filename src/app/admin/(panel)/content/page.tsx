import { requirePermission } from '@/lib/admin/auth';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, Check, Field, Flash, PageTitle } from '@/components/admin/ui';
import { saveAnnouncement, saveHero, savePage, savePolicy } from './actions';

export const dynamic = 'force-dynamic';
const POLICIES = [['shipping', 'Shipping policy'], ['returns', 'Returns and refunds policy'], ['privacy', 'Privacy policy'], ['terms', 'Terms and conditions']] as const;
type V = Record<string, unknown>;

export default async function Content({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission('content.write');
  const sp = await searchParams;
  const { data } = await createAdmin().from('site_content').select('key, value');
  const c = new Map(((data ?? []) as { key: string; value: V }[]).map((r) => [r.key, r.value]));
  const bar = (c.get('announcement_bar') ?? {}) as { enabled?: boolean; text?: string };
  const hero = (c.get('hero') ?? {}) as { headline?: string; subtext?: string; image_url?: string | null; primary_cta?: { label?: string; href?: string }; secondary_cta?: { label?: string; href?: string } };
  const about = (c.get('about') ?? {}) as { title?: string; body?: string }, care = (c.get('care_guide') ?? {}) as { title?: string; body?: string };
  return (
    <>
      <PageTitle title="Content" /><Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6">
        <Card title="Announcement bar"><form action={saveAnnouncement} className="grid max-w-xl gap-3"><Check name="enabled" label="Show the bar" defaultChecked={bar.enabled} />
          <Field label="Text" hint="Only advertise offers and delivery you have approved."><input name="text" maxLength={160} defaultValue={bar.text ?? ''} className="field font-normal" /></Field><button className="btn-gold justify-self-start">Save</button></form></Card>
        <Card title="Homepage banner"><form action={saveHero} className="grid max-w-xl gap-3">
          <Field label="Headline"><input name="headline" required maxLength={120} defaultValue={hero.headline ?? 'Your Glam. Your Style. Your Confidence.'} className="field font-normal" /></Field>
          <Field label="Supporting text"><textarea name="subtext" rows={2} maxLength={300} defaultValue={hero.subtext ?? ''} className="field py-2 font-normal" /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Main button text"><input name="primaryLabel" required maxLength={40} defaultValue={hero.primary_cta?.label ?? 'Shop Wigs'} className="field font-normal" /></Field><Field label="Main button link"><input name="primaryHref" required defaultValue={hero.primary_cta?.href ?? '/shop'} className="field font-normal" /></Field>
            <Field label="Second button text"><input name="secondaryLabel" required maxLength={40} defaultValue={hero.secondary_cta?.label ?? 'Find Your Style'} className="field font-normal" /></Field><Field label="Second button link"><input name="secondaryHref" required defaultValue={hero.secondary_cta?.href ?? '/find-your-wig'} className="field font-normal" /></Field></div>
          <Field label="Banner photo (JPG, PNG, WebP or AVIF, up to 5 MB)" hint={hero.image_url ? 'A photo is set. Upload another to replace it.' : 'Use a photo you own or are licensed to use.'}><input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" className="field py-2 font-normal" /></Field>
          {hero.image_url ? <Check name="removeImage" label="Remove the current photo" /> : null}<button className="btn-gold justify-self-start">Save banner</button></form></Card>
        {([['about', 'About page', about], ['care_guide', 'Wig care guide (shown on the homepage when filled in)', care]] as const).map(([key, label, v]) => (
          <Card key={key} title={label}><form action={savePage} className="grid max-w-2xl gap-3"><input type="hidden" name="key" value={key} />
            <Field label="Title"><input name="title" maxLength={120} defaultValue={v.title ?? ''} className="field font-normal" /></Field>
            <Field label="Text" hint="Separate paragraphs with a blank line. Leave empty to use the default."><textarea name="body" rows={6} maxLength={20000} defaultValue={v.body ?? ''} className="field py-2 font-normal" /></Field><button className="btn-gold justify-self-start">Save</button></form></Card>))}
        {POLICIES.map(([slug, label]) => { const v = (c.get(`policy_${slug}`) ?? {}) as { title?: string; body?: string; updated?: string };
          return (<Card key={slug} title={label}><form action={savePolicy} className="grid max-w-2xl gap-3"><input type="hidden" name="slug" value={slug} />
            <Field label="Title"><input name="title" required defaultValue={v.title ?? label} className="field font-normal" /></Field>
            <Field label="Policy text" hint="Until this is filled in, customers see a polite “being finalised” notice. Get legal review before launch."><textarea name="body" required rows={8} maxLength={20000} defaultValue={v.body ?? ''} className="field py-2 font-normal" /></Field>
            <Field label="Last updated (shown to customers)"><input name="updated" defaultValue={v.updated ?? ''} placeholder="2026-10-24" className="field font-normal" /></Field><button className="btn-gold justify-self-start">Save policy</button></form></Card>); })}
      </div>
    </>
  );
}
