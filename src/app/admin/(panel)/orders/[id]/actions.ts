'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { back, dbMessage, parseForm } from '@/lib/admin/action';
import { recordAudit } from '@/lib/admin/audit';
import { requirePermission } from '@/lib/admin/auth';
import { refundSchema, statusSchema, trackingSchema } from '@/lib/admin/schemas';
import { resendPaymentConfirmation, sendShippedNotification } from '@/lib/email/notify';
import { createAdmin } from '@/lib/supabase/admin';

const here = (id: string) => `/admin/orders/${id}`;
const idOf = (fd: FormData) => { const r = z.string().uuid().safeParse(fd.get('orderId')); return r.success ? r.data : null; };

export async function changeStatus(fd: FormData) {
  const staff = await requirePermission('orders.update');
  const p = parseForm(statusSchema, fd);
  if (!p.ok) back('/admin/orders', 'error', p.error);
  const path = here(p.data.orderId);
  const { error } = await createAdmin().rpc('admin_set_order_status', { p_order: p.data.orderId, p_to: p.data.to, p_actor: staff.userId, p_note: p.data.note ?? null });
  if (error) back(path, 'error', dbMessage(error, 'That status change is not allowed.'));
  revalidatePath(path);
  back(path, 'ok', 'Status updated.');
}

export async function saveTracking(fd: FormData) {
  const staff = await requirePermission('orders.update');
  const id = idOf(fd); if (!id) back('/admin/orders', 'error', 'Order not found.');
  const path = here(id);
  const p = parseForm(trackingSchema, fd);
  if (!p.ok) back(path, 'error', p.error);
  const db = createAdmin();
  const { data: o } = await db.from('orders').select('status').eq('id', id).single();
  const status = (o as { status: string } | null)?.status;
  if (!status || !['paid', 'processing', 'ready_for_dispatch', 'shipped', 'delivered'].includes(status)) back(path, 'error', 'Tracking can only be added to paid orders.');
  const { data: ex } = await db.from('shipments').select('id').eq('order_id', id).order('created_at', { ascending: false }).limit(1);
  const existing = (ex as { id: string }[] | null)?.[0]?.id;
  const shipping = p.data.markShipped && status === 'ready_for_dispatch';
  const row = { order_id: id, carrier: p.data.carrier, tracking_number: p.data.trackingNumber, tracking_url: p.data.trackingUrl ?? null, status: shipping || status === 'shipped' ? 'in_transit' : 'label_created', ...(shipping ? { shipped_at: new Date().toISOString() } : {}) };
  const res = existing ? await db.from('shipments').update(row).eq('id', existing).select('id').single() : await db.from('shipments').insert(row).select('id').single();
  if (res.error || !res.data) back(path, 'error', dbMessage(res.error ?? {}));
  await db.from('shipment_events').insert({ shipment_id: (res.data as { id: string }).id, status: row.status, description: `Tracking ${p.data.trackingNumber} saved`, source: 'manual', actor_id: staff.userId });
  let message = 'Tracking saved.';
  if (p.data.markShipped) {
    if (status !== 'ready_for_dispatch') message = 'Tracking saved. Move the order to Ready for dispatch first, then mark it shipped.';
    else {
      const { error } = await db.rpc('admin_set_order_status', { p_order: id, p_to: 'shipped', p_actor: staff.userId, p_note: 'Tracking added' });
      if (error) back(path, 'error', dbMessage(error));
      await sendShippedNotification(id).catch((e) => console.error('shipped email failed', e instanceof Error ? e.message : e));
      message = 'Tracking saved and order marked as shipped.';
    }
  }
  await recordAudit(staff.userId, 'shipment.saved', 'order', id, { carrier: p.data.carrier, markShipped: p.data.markShipped });
  revalidatePath(path);
  back(path, 'ok', message);
}

export async function addNote(fd: FormData) {
  const staff = await requirePermission('orders.update');
  const id = idOf(fd); if (!id) back('/admin/orders', 'error', 'Order not found.');
  const path = here(id);
  const note = z.string().trim().min(1).max(1000).safeParse(fd.get('note'));
  if (!note.success) back(path, 'error', 'Write a note first.');
  const db = createAdmin();
  const { data } = await db.from('orders').select('internal_notes').eq('id', id).single();
  const prev = (data as { internal_notes: string | null } | null)?.internal_notes ?? '';
  const line = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')} ${staff.email}] ${note.data}`;
  const { error } = await db.from('orders').update({ internal_notes: prev ? `${prev}\n${line}` : line }).eq('id', id);
  if (error) back(path, 'error', dbMessage(error));
  revalidatePath(path);
  back(path, 'ok', 'Note added.');
}

export async function requestRefundAction(fd: FormData) {
  const staff = await requirePermission('refunds.manage');
  const p = parseForm(refundSchema, fd);
  if (!p.ok) back('/admin/orders', 'error', p.error);
  const path = here(p.data.orderId);
  const { error } = await createAdmin().rpc('request_refund', { p_order: p.data.orderId, p_amount_minor: p.data.amount, p_reason: p.data.reason, p_actor: staff.userId });
  if (error) back(path, 'error', dbMessage(error, 'Could not record the refund.'));
  revalidatePath(path);
  back(path, 'ok', 'Refund recorded as pending. Send the money back in your Paystack dashboard, then mark it completed here.');
}

export async function completeRefundAction(fd: FormData) {
  const staff = await requirePermission('refunds.manage');
  const id = idOf(fd), refundId = z.string().uuid().safeParse(fd.get('refundId'));
  if (!id || !refundId.success) back('/admin/orders', 'error', 'Refund not found.');
  const path = here(id);
  const { error } = await createAdmin().rpc('complete_refund', { p_refund: refundId.data, p_actor: staff.userId, p_restock: fd.get('restock') === 'on' });
  if (error) back(path, 'error', dbMessage(error, 'Could not complete the refund.'));
  revalidatePath(path);
  back(path, 'ok', 'Refund marked as completed.');
}

export async function declineRefundAction(fd: FormData) {
  const staff = await requirePermission('refunds.manage');
  const id = idOf(fd), refundId = z.string().uuid().safeParse(fd.get('refundId'));
  if (!id || !refundId.success) back('/admin/orders', 'error', 'Refund not found.');
  const path = here(id);
  const { error } = await createAdmin().rpc('decline_refund', { p_refund: refundId.data, p_actor: staff.userId });
  if (error) back(path, 'error', dbMessage(error));
  revalidatePath(path);
  back(path, 'ok', 'Refund request cancelled.');
}

export async function resendConfirmation(fd: FormData) {
  const staff = await requirePermission('orders.update');
  const id = idOf(fd); if (!id) back('/admin/orders', 'error', 'Order not found.');
  const path = here(id);
  let sent = false;
  try { sent = await resendPaymentConfirmation(id); } catch (e) { console.error('resend failed', e instanceof Error ? e.message : e); }
  await recordAudit(staff.userId, 'order.confirmation_resent', 'order', id, { sent });
  back(path, sent ? 'ok' : 'error', sent ? 'Confirmation email re-sent (if email is configured it goes out now; otherwise it is queued).' : 'No successful payment found to confirm.');
}
