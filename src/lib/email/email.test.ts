import { describe, it, expect, vi } from 'vitest';
import { esc, paymentConfirmationEmail, type EmailOrder } from './templates';
import { sendEmail } from './send';

const order: EmailOrder = {
  orderNumber: 'GBL-2610-001001', currency: 'GHS', subtotalMinor: 200000, discountMinor: 20000, shippingMinor: 5000, taxMinor: 0, totalMinor: 185000,
  items: [{ name: 'Body <b>Wave</b> & Co', attributes: ['18 in', 'Natural black'], quantity: 2, lineTotalMinor: 200000 }],
  shippingMethod: 'Accra courier', deliveryTo: 'Ama <script>x</script>, Accra, GH', orderUrl: 'https://shop.test/orders/GBL-1?t=abc', whatsappUrl: 'https://wa.me/233240000000',
};

describe('payment confirmation email', () => {
  const e = paymentConfirmationEmail(order);
  it('escapes customer-controlled text', () => { expect(e.html).not.toContain('<script>'); expect(e.html).not.toContain('<b>Wave</b>'); expect(e.html).toContain('&lt;b&gt;Wave'); });
  it('includes order number, totals and the order link', () => { expect(e.subject).toContain('GBL-2610-001001'); expect(e.html).toMatch(/1,850\.00/); expect(e.html).toContain('https://shop.test/orders/GBL-1?t=abc'); expect(e.text).toContain('Total paid'); });
  it('omits the WhatsApp line when not configured', () => expect(paymentConfirmationEmail({ ...order, whatsappUrl: null }).html).not.toContain('wa.me'));
  it('esc handles quotes', () => expect(esc(`"'<>&`)).toBe('&quot;&#39;&lt;&gt;&amp;'));
});

describe('sendEmail', () => {
  const msg = { to: 'a@b.co', subject: 's', html: '<p>h</p>', text: 't' };
  it('posts to the provider with a bearer key', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
    expect(await sendEmail(msg, { apiKey: 'k', from: 'GLAMS BY LEE <o@x.test>' }, f)).toEqual({ ok: true });
    expect(f).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer k' }) }));
  });
  it('reports provider and network failures without throwing', async () => {
    expect(await sendEmail(msg, { apiKey: 'k', from: 'f' }, async () => ({ ok: false, status: 422, text: async () => '' }))).toMatchObject({ ok: false });
    expect(await sendEmail(msg, { apiKey: 'k', from: 'f' }, async () => { throw new Error('offline'); })).toMatchObject({ ok: false, error: 'offline' });
  });
});
