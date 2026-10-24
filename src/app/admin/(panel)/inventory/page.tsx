import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { can } from '@/lib/admin/permissions';
import { safeQuery } from '@/lib/admin/query';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, Field, Flash, PageTitle, Table } from '@/components/admin/ui';
import { adjustStock } from './actions';

export const dynamic = 'force-dynamic';
interface Row { id: string; sku: string; length_inches: number | null; color: string | null; low_stock_threshold: number; allow_backorder: boolean; is_active: boolean; products: { name: string }; inventory: { on_hand: number; reserved: number } | { on_hand: number; reserved: number }[] | null }

export default async function Inventory({ searchParams }: { searchParams: Promise<{ q?: string; show?: string; ok?: string; error?: string }> }) {
  const staff = await requirePermission('inventory.view');
  const sp = await searchParams, q = safeQuery(sp.q), canAdjust = can(staff.roles, 'inventory.adjust');
  const db = createAdmin();
  let query = db.from('product_variants').select('id, sku, length_inches, color, low_stock_threshold, allow_backorder, is_active, products!inner(name), inventory(on_hand, reserved)').order('sku').limit(300);
  if (q) query = query.ilike('sku', `%${q}%`);
  const [{ data, error }, { data: moves }] = await Promise.all([query, db.from('inventory_movements').select('id, variant_id, movement_type, quantity_delta, reason, created_at, product_variants(sku)').order('id', { ascending: false }).limit(25)]);
  if (error) throw new Error('Inventory query failed');
  const all = ((data ?? []) as unknown as Row[]).map((r) => { const inv = Array.isArray(r.inventory) ? r.inventory[0] : r.inventory; const onHand = inv?.on_hand ?? 0, reserved = inv?.reserved ?? 0; return { ...r, onHand, reserved, available: onHand - reserved }; });
  const rows = all.filter((r) => (sp.show === 'low' ? !r.allow_backorder && r.available > 0 && r.available <= r.low_stock_threshold : sp.show === 'out' ? !r.allow_backorder && r.available <= 0 : true));
  const tab = (key: string, label: string) => <Link href={`/admin/inventory${key ? `?show=${key}` : ''}`} aria-current={(sp.show ?? '') === key ? 'page' : undefined} className={`min-h-[44px] border px-4 py-2.5 text-sm ${(sp.show ?? '') === key ? 'border-ink bg-ink text-ivory' : 'border-line bg-white'}`}>{label}</Link>;
  return (
    <>
      <PageTitle title="Inventory" /><Flash ok={sp.ok} error={sp.error} />
      <div className="mb-4 flex flex-wrap gap-2">{tab('', 'All')}{tab('low', 'Low stock')}{tab('out', 'Out of stock')}</div>
      <form className="mb-4 flex max-w-md gap-2" role="search"><label className="sr-only" htmlFor="sq">Search by SKU</label><input id="sq" name="q" defaultValue={q} placeholder="SKU" className="field" /><button className="btn-outline">Search</button></form>
      {rows.length ? <Table head={['Product', 'SKU', 'On hand', 'Reserved', 'Available', 'Alert at']}>{rows.map((r) => (
        <tr key={r.id} className={r.is_active ? '' : 'opacity-60'}><td className="px-3 py-2">{r.products.name}<span className="block text-xs text-muted">{[r.length_inches ? `${r.length_inches} in` : null, r.color].filter(Boolean).join(' · ')}</span></td>
          <td className="px-3 py-2">{r.sku}</td><td className="px-3 py-2">{r.onHand}</td><td className="px-3 py-2">{r.reserved}</td>
          <td className="px-3 py-2 font-medium">{r.available}{r.allow_backorder ? ' (backorder on)' : r.available <= 0 ? ' · out' : r.available <= r.low_stock_threshold ? ' · low' : ''}</td><td className="px-3 py-2">{r.low_stock_threshold}</td></tr>))}</Table>
        : <p className="border border-line bg-white p-6 text-center text-muted">Nothing to show. Add variants to products first.</p>}
      {canAdjust && all.length ? (
        <div className="mt-6"><Card title="Adjust stock">
          <form action={adjustStock} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Variant"><select name="variantId" required className="field font-normal">{all.map((r) => <option key={r.id} value={r.id}>{r.sku} · {r.products.name}</option>)}</select></Field>
            <Field label="Type"><select name="type" className="field font-normal"><option value="received">Stock received (+)</option><option value="returned">Customer return (+)</option><option value="damaged">Damaged or lost (−)</option><option value="adjusted">Count correction (+ or −)</option></select></Field>
            <Field label="Quantity" hint="Use a minus sign to remove stock"><input name="quantity" type="number" required className="field font-normal" /></Field>
            <Field label="Reason"><input name="reason" required minLength={3} maxLength={200} className="field font-normal" /></Field>
            <button className="btn-gold justify-self-start">Update stock</button>
          </form></Card></div>) : null}
      <div className="mt-6"><Card title="Recent stock movements">
        <ul className="space-y-1 text-sm">{((moves ?? []) as unknown as { id: number; movement_type: string; quantity_delta: number; reason: string | null; created_at: string; product_variants: { sku: string } | null }[]).map((m) => (
          <li key={m.id}>{m.created_at.slice(0, 16).replace('T', ' ')} · {m.product_variants?.sku ?? 'deleted variant'} · {m.movement_type} {m.quantity_delta > 0 ? '+' : ''}{m.quantity_delta}{m.reason ? ` · ${m.reason}` : ''}</li>))}</ul>
        {!(moves ?? []).length ? <p className="text-sm text-muted">No movements yet.</p> : null}
      </Card></div>
    </>
  );
}
