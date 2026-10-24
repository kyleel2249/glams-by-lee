import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requirePermission } from '@/lib/admin/auth';
import { can } from '@/lib/admin/permissions';
import { formatMoney, type CurrencyCode } from '@/lib/money';
import { nextStatuses, STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, Check, Field, Flash, PageTitle } from '@/components/admin/ui';
import { addNote, changeStatus, completeRefundAction, declineRefundAction, requestRefundAction, resendConfirmation, saveTracking } from './actions';

export const dynamic = 'force-dynamic';
// Staff can set these; payment states are system-controlled and refunds use their own form.
const STAFF_TARGETS: OrderStatus[] = ['processing', 'ready_for_dispatch', 'shipped', 'delivered', 'cancelled'];

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const staff = await requirePermission('orders.view');
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!z.string().uuid().safeParse(id).success) notFound();
  const db = createAdmin();
  const [{ data: o }, { data: items }, { data: pays }, { data: refunds }, { data: ships }, { data: hist }] = await Promise.all([
    db.from('orders').select('*').eq('id', id).maybeSingle(),
    db.from('order_items').select('product_name, variant_sku, variant_attributes, quantity, unit_price_minor, line_total_minor').eq('order_id', id),
    db.from('payments').select('id, provider, reference, status, amount_minor, currency, channel, failure_reason, created_at').eq('order_id', id).order('created_at', { ascending: false }),
    db.from('refunds').select('id, amount_minor, currency, reason, status, created_at').eq('order_id', id).order('created_at', { ascending: false }),
    db.from('shipments').select('carrier, tracking_number, tracking_url, status').eq('order_id', id).order('created_at', { ascending: false }).limit(1),
    db.from('order_status_history').select('from_status, to_status, note, actor_id, created_at').eq('order_id', id).order('id'),
  ]);
  if (!o) notFound();
  const order = o as Record<string, unknown> & { status: OrderStatus; currency: string; total_minor: number };
  const cur = String(order.currency).trim() as CurrencyCode; const m = (n: unknown) => formatMoney(Number(n), cur);
  const addr = (order.shipping_address ?? {}) as Record<string, string | null>;
  const canUpdate = can(staff.roles, 'orders.update'), canRefund = can(staff.roles, 'refunds.manage');
  const targets = nextStatuses(order.status).filter((s) => STAFF_TARGETS.includes(s) && (s !== 'cancelled' || ['pending_payment', 'payment_processing', 'payment_failed'].includes(order.status)));
  const refundRows = (refunds ?? []) as { id: string; amount_minor: number; reason: string | null; status: string; created_at: string }[];
  const committed = refundRows.filter((r) => r.status !== 'failed').reduce((s, r) => s + Number(r.amount_minor), 0);
  const remaining = Number(order.total_minor) - committed;
  const refundable = ['paid', 'processing', 'ready_for_dispatch', 'shipped', 'delivered', 'partially_refunded'].includes(order.status) && remaining > 0;
  const ship = (ships as { carrier: string | null; tracking_number: string | null; tracking_url: string | null; status: string }[] | null)?.[0];

  return (
    <>
      <Link href="/admin/orders" className="text-sm underline">← All orders</Link>
      <PageTitle title={`Order ${order.order_number}`}><span className="badge text-sm">{STATUS_LABEL[order.status]}</span></PageTitle>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-6">
          <Card title="Items">
            <ul className="divide-y divide-line text-sm">{((items ?? []) as { product_name: string; variant_sku: string; variant_attributes: Record<string, unknown>; quantity: number; line_total_minor: number }[]).map((i, k) => (
              <li key={k} className="flex justify-between gap-4 py-2"><span>{i.quantity} × {i.product_name}<span className="block text-xs text-muted">SKU {i.variant_sku} {Object.values(i.variant_attributes ?? {}).join(' · ')}</span></span><span>{m(i.line_total_minor)}</span></li>))}</ul>
            <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{m(order.subtotal_minor)}</dd></div>
              {Number(order.discount_minor) > 0 ? <div className="flex justify-between"><dt>Discount</dt><dd>−{m(order.discount_minor)}</dd></div> : null}
              <div className="flex justify-between"><dt>Delivery ({String(order.shipping_method_name ?? '')})</dt><dd>{m(order.shipping_minor)}</dd></div>
              {Number(order.tax_minor) > 0 ? <div className="flex justify-between"><dt>Tax</dt><dd>{m(order.tax_minor)}</dd></div> : null}
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{m(order.total_minor)}</dd></div>
            </dl>
          </Card>
          <Card title="Payments">
            {(pays ?? []).length ? <ul className="space-y-3 text-sm">{(pays as { id: string; provider: string; reference: string; status: string; amount_minor: number; currency: string; channel: string | null; failure_reason: string | null; created_at: string }[]).map((p) => (
              <li key={p.id} className="border-b border-line pb-3 last:border-0"><span className="font-medium">{p.status}</span> · {m(p.amount_minor)} · {p.provider}{p.channel ? ` (${p.channel})` : ''}<span className="block break-all text-xs text-muted">Ref {p.reference} · {p.created_at.slice(0, 16).replace('T', ' ')}</span>{p.failure_reason ? <span className="block text-xs text-red-800">{p.failure_reason}</span> : null}</li>))}</ul> : <p className="text-sm text-muted">No payment attempts.</p>}
          </Card>
          {canRefund && (refundRows.length || refundable) ? (
            <Card title="Refunds">
              <p className="mb-3 text-xs text-muted">Money is returned in your Paystack dashboard. Record it here so orders, payments and reports stay correct.</p>
              {refundRows.length ? <ul className="mb-4 space-y-3 text-sm">{refundRows.map((r) => (
                <li key={r.id} className="border-b border-line pb-3 last:border-0"><span className="font-medium">{m(r.amount_minor)}</span> · {r.status}{r.reason ? ` · ${r.reason}` : ''}
                  {['requested', 'processing'].includes(r.status) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <form action={completeRefundAction} className="flex items-center gap-3"><input type="hidden" name="orderId" value={id} /><input type="hidden" name="refundId" value={r.id} /><Check name="restock" label="Return items to stock (full refunds)" /><button className="btn-gold !min-h-[36px] !px-4">Mark completed</button></form>
                      <form action={declineRefundAction}><input type="hidden" name="orderId" value={id} /><input type="hidden" name="refundId" value={r.id} /><button className="btn-outline !min-h-[36px] !px-4">Cancel request</button></form>
                    </div>) : null}</li>))}</ul> : null}
              {refundable ? <form action={requestRefundAction} className="grid gap-3"><input type="hidden" name="orderId" value={id} />
                <Field label={`Refund amount (${cur}, up to ${m(remaining)})`}><input name="amount" required inputMode="decimal" defaultValue={(remaining / 100).toFixed(2)} className="field font-normal" /></Field>
                <Field label="Reason"><input name="reason" required minLength={3} maxLength={300} className="field font-normal" /></Field><button className="btn-outline justify-self-start">Record refund request</button></form> : null}
            </Card>) : null}
          <Card title="History">
            <ol className="space-y-2 text-sm">{((hist ?? []) as { from_status: string | null; to_status: string; note: string | null; actor_id: string | null; created_at: string }[]).map((h, k) => (
              <li key={k}>{h.created_at.slice(0, 16).replace('T', ' ')} · {h.from_status ? `${STATUS_LABEL[h.from_status as OrderStatus]} → ` : ''}<strong>{STATUS_LABEL[h.to_status as OrderStatus]}</strong>{h.actor_id ? ' · staff' : ' · system'}{h.note ? ` · ${h.note}` : ''}</li>))}</ol>
          </Card>
        </div>
        <div className="grid h-fit gap-6">
          <Card title="Customer">
            <p className="text-sm">{String(order.email)}<br />{String(order.phone ?? '')}</p>
            <p className="mt-3 text-sm">{[addr.name, addr.line1, addr.line2, addr.city, addr.region, addr.postal_code, addr.country].filter(Boolean).join(', ')}</p>
            {order.customer_note ? <p className="mt-3 border-l-2 border-gold pl-3 text-sm">“{String(order.customer_note)}”</p> : null}
          </Card>
          {canUpdate && targets.length ? (
            <Card title="Update status"><form action={changeStatus} className="grid gap-3"><input type="hidden" name="orderId" value={id} />
              <Field label="Move to"><select name="to" className="field font-normal">{targets.map((t) => <option key={t} value={t}>{STATUS_LABEL[t]}</option>)}</select></Field>
              <Field label="Note (optional)"><input name="note" maxLength={500} className="field font-normal" /></Field><button className="btn-gold">Update</button></form>
              <p className="mt-3 text-xs text-muted">Payment status is set only by verified payments. Paid orders are refunded, not cancelled.</p></Card>) : null}
          {canUpdate ? (
            <Card title="Tracking">{ship ? <p className="mb-3 text-sm">{ship.carrier} · {ship.tracking_number} · {ship.status.replace(/_/g, ' ')}</p> : null}
              <form action={saveTracking} className="grid gap-3"><input type="hidden" name="orderId" value={id} />
                <Field label="Carrier"><input name="carrier" required defaultValue={ship?.carrier ?? ''} className="field font-normal" /></Field>
                <Field label="Tracking number"><input name="trackingNumber" required defaultValue={ship?.tracking_number ?? ''} className="field font-normal" /></Field>
                <Field label="Tracking link (optional, https)"><input name="trackingUrl" type="url" defaultValue={ship?.tracking_url ?? ''} className="field font-normal" /></Field>
                <Check name="markShipped" label="Mark as shipped and email the customer" /><button className="btn-outline">Save tracking</button></form></Card>) : null}
          {canUpdate ? (
            <Card title="Internal notes">{order.internal_notes ? <pre className="mb-3 whitespace-pre-wrap font-sans text-xs text-muted">{String(order.internal_notes)}</pre> : null}
              <form action={addNote} className="grid gap-3"><input type="hidden" name="orderId" value={id} /><textarea name="note" required maxLength={1000} rows={3} className="field py-2" aria-label="New note" /><button className="btn-outline">Add note</button></form></Card>) : null}
          {canUpdate && !['pending_payment', 'cancelled'].includes(order.status) ? (
            <form action={resendConfirmation}><input type="hidden" name="orderId" value={id} /><button className="btn-outline w-full">Re-send payment confirmation email</button></form>) : null}
        </div>
      </div>
    </>
  );
}
