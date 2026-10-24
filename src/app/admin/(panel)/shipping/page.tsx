import { requirePermission } from '@/lib/admin/auth';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, Check, Field, Flash, PageTitle } from '@/components/admin/ui';
import { deleteRate, deleteZone, saveRate, saveZone } from './actions';

export const dynamic = 'force-dynamic';
interface Z { id: string; name: string; country_codes: string[]; regions: string[]; is_active: boolean }
interface R { id: string; zone_id: string; name: string; method_code: string; currency: string; flat_rate_minor: number; per_kg_minor: number; min_subtotal_minor: number | null; max_subtotal_minor: number | null; free_over_subtotal_minor: number | null; estimated_days_min: number | null; estimated_days_max: number | null; duties_note: string | null; is_active: boolean }
const major = (n: number | null) => (n === null ? '' : (Number(n) / 100).toFixed(2));

function ZoneForm({ z }: { z?: Z }) {
  return (
    <form action={saveZone} className="grid gap-3 sm:grid-cols-2">{z ? <input type="hidden" name="id" value={z.id} /> : null}
      <Field label="Zone name"><input name="name" required defaultValue={z?.name} placeholder="e.g. Ghana, United Kingdom" className="field font-normal" /></Field>
      <Field label="Country codes" hint="2-letter codes separated by commas, e.g. GH or GB, IE"><input name="countryCodes" required defaultValue={z?.country_codes.map((c) => c.trim()).join(', ')} className="field font-normal" /></Field>
      <Field label="Only these regions (optional)" hint="Comma-separated, e.g. Greater Accra. A region zone wins over a country-wide zone."><input name="regions" defaultValue={z?.regions.join(', ')} className="field font-normal" /></Field>
      <Check name="isActive" label="Active" defaultChecked={z ? z.is_active : true} />
      <div className="flex gap-3 sm:col-span-2"><button className="btn-gold !min-h-[40px]">{z ? 'Save zone' : 'Add zone'}</button>{z ? <button formAction={deleteZone} className="btn-outline !min-h-[40px]">Delete zone</button> : null}</div>
    </form>
  );
}
function RateForm({ zoneId, r }: { zoneId: string; r?: R }) {
  return (
    <form action={saveRate} className="grid gap-3 border border-line p-4 sm:grid-cols-3"><input type="hidden" name="zoneId" value={zoneId} />{r ? <input type="hidden" name="id" value={r.id} /> : null}
      <Field label="Name shown to customers"><input name="name" required defaultValue={r?.name} placeholder="Accra courier" className="field font-normal" /></Field>
      <Field label="Method"><select name="methodCode" defaultValue={r?.method_code ?? 'courier'} className="field font-normal"><option value="courier">Courier</option><option value="collection">Collection</option><option value="international">International</option></select></Field>
      <Field label="Currency"><input name="currency" required maxLength={3} defaultValue={r?.currency.trim() ?? 'GHS'} className="field font-normal uppercase" /></Field>
      <Field label="Flat rate"><input name="flatRate" required inputMode="decimal" defaultValue={major(r?.flat_rate_minor ?? null)} className="field font-normal" /></Field>
      <Field label="Extra per kg"><input name="perKg" inputMode="decimal" defaultValue={r ? major(r.per_kg_minor) : '0'} className="field font-normal" /></Field>
      <Field label="Free over (blank = never)" hint="Only set if you approve a free-shipping offer"><input name="freeOver" inputMode="decimal" defaultValue={major(r?.free_over_subtotal_minor ?? null)} className="field font-normal" /></Field>
      <Field label="Only if order is at least"><input name="minSubtotal" inputMode="decimal" defaultValue={major(r?.min_subtotal_minor ?? null)} className="field font-normal" /></Field>
      <Field label="Only if order is at most"><input name="maxSubtotal" inputMode="decimal" defaultValue={major(r?.max_subtotal_minor ?? null)} className="field font-normal" /></Field>
      <Check name="isActive" label="Active" defaultChecked={r ? r.is_active : true} />
      <Field label="Estimated days (from)"><input name="daysMin" type="number" min="0" defaultValue={r?.estimated_days_min ?? ''} className="field font-normal" /></Field>
      <Field label="Estimated days (to)"><input name="daysMax" type="number" min="0" defaultValue={r?.estimated_days_max ?? ''} className="field font-normal" /></Field>
      <Field label="Customs / duties note"><input name="dutiesNote" maxLength={300} defaultValue={r?.duties_note ?? ''} placeholder="Import duties may be payable by the recipient." className="field font-normal" /></Field>
      <div className="flex gap-3 sm:col-span-3"><button className="btn-gold !min-h-[40px]">{r ? 'Save rate' : 'Add rate'}</button>{r ? <button formAction={deleteRate} className="btn-outline !min-h-[40px]">Delete</button> : null}</div>
    </form>
  );
}

export default async function Shipping({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission('shipping.write');
  const sp = await searchParams, db = createAdmin();
  const [{ data: zones }, { data: rates }] = await Promise.all([db.from('shipping_zones').select('*').order('created_at'), db.from('shipping_rates').select('*').order('sort_order')]);
  return (
    <>
      <PageTitle title="Shipping" /><Flash ok={sp.ok} error={sp.error} />
      <p className="mb-4 text-sm text-muted">Customers can only check out to countries covered by an active zone with at least one rate. Only promise delivery times you can keep.</p>
      <div className="grid gap-6">
        <Card title="Add a delivery zone"><ZoneForm /></Card>
        {((zones ?? []) as Z[]).map((z) => (
          <Card key={z.id} title={z.name}><ZoneForm z={z} />
            <h3 className="mb-3 mt-6 font-sans text-sm font-semibold">Rates for {z.name}</h3>
            <div className="grid gap-4">{((rates ?? []) as R[]).filter((r) => r.zone_id === z.id).map((r) => <RateForm key={r.id} zoneId={z.id} r={r} />)}</div>
            <details className="mt-4"><summary className="cursor-pointer text-sm font-medium underline">Add a rate</summary><div className="mt-3"><RateForm zoneId={z.id} /></div></details>
          </Card>))}
      </div>
    </>
  );
}
