import { requirePermission } from '@/lib/admin/auth';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, Check, Field, Flash, PageTitle } from '@/components/admin/ui';
import { deleteDiscount, saveDiscount } from './actions';

export const dynamic = 'force-dynamic';
interface D { id: string; code: string; discount_type: string; percentage_off: number | null; amount_off_minor: number | null; currency: string | null; min_subtotal_minor: number; starts_at: string | null; expires_at: string | null; usage_limit: number | null; per_customer_limit: number | null; is_active: boolean }
const day = (s: string | null) => (s ? s.slice(0, 10) : '');

function DiscountForm({ d }: { d?: D }) {
  return (
    <form action={saveDiscount} className="grid gap-3 sm:grid-cols-3">
      {d ? <input type="hidden" name="id" value={d.id} /> : null}
      <Field label="Code"><input name="code" required defaultValue={d?.code} className="field font-normal uppercase" /></Field>
      <Field label="Type"><select name="discountType" defaultValue={d?.discount_type ?? 'percentage'} className="field font-normal"><option value="percentage">Percentage off</option><option value="fixed">Fixed amount off</option><option value="free_shipping">Free shipping</option></select></Field>
      <Field label="Percentage (if percentage)"><input name="percentageOff" inputMode="decimal" defaultValue={d?.percentage_off ?? ''} className="field font-normal" /></Field>
      <Field label="Amount off (if fixed)"><input name="amountOff" inputMode="decimal" defaultValue={d?.amount_off_minor ? (d.amount_off_minor / 100).toFixed(2) : ''} className="field font-normal" /></Field>
      <Field label="Currency (if fixed)"><input name="currency" maxLength={3} defaultValue={d?.currency ?? 'GHS'} className="field font-normal uppercase" /></Field>
      <Field label="Minimum spend"><input name="minSubtotal" inputMode="decimal" defaultValue={d ? (d.min_subtotal_minor / 100).toFixed(2) : '0'} className="field font-normal" /></Field>
      <Field label="Starts"><input type="date" name="startsAt" defaultValue={day(d?.starts_at ?? null)} className="field font-normal" /></Field>
      <Field label="Expires"><input type="date" name="expiresAt" defaultValue={day(d?.expires_at ?? null)} className="field font-normal" /></Field>
      <Field label="Total uses allowed"><input name="usageLimit" type="number" min="1" defaultValue={d?.usage_limit ?? ''} className="field font-normal" /></Field>
      <Field label="Uses per customer"><input name="perCustomerLimit" type="number" min="1" defaultValue={d?.per_customer_limit ?? ''} className="field font-normal" /></Field>
      <Check name="isActive" label="Active" defaultChecked={d ? d.is_active : true} />
      <div className="flex gap-3 sm:col-span-3"><button className="btn-gold !min-h-[40px]">{d ? 'Save' : 'Create discount'}</button>{d ? <button formAction={deleteDiscount} className="btn-outline !min-h-[40px]">Delete</button> : null}</div>
    </form>
  );
}

export default async function Discounts({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission('discounts.write');
  const sp = await searchParams, db = createAdmin();
  const [{ data }, { data: used }] = await Promise.all([db.from('discount_codes').select('*').order('created_at', { ascending: false }), db.from('discount_redemptions').select('discount_code_id')]);
  const counts = new Map<string, number>(); ((used ?? []) as { discount_code_id: string }[]).forEach((r) => counts.set(r.discount_code_id, (counts.get(r.discount_code_id) ?? 0) + 1));
  return (
    <>
      <PageTitle title="Discounts" /><Flash ok={sp.ok} error={sp.error} />
      <p className="mb-4 text-sm text-muted">Codes are checked on the server when a customer checks out. Limits count only orders that still hold the code (cancelled unpaid orders free it).</p>
      <div className="grid gap-6">
        <Card title="Create a discount"><DiscountForm /></Card>
        {((data ?? []) as D[]).map((d) => <Card key={d.id} title={`${d.code} · used ${counts.get(d.id) ?? 0}${d.usage_limit ? ` of ${d.usage_limit}` : ''} times`}><DiscountForm d={d} /></Card>)}
      </div>
    </>
  );
}
