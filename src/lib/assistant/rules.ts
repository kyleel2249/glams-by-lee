import { selectProducts } from './retrieve';
import type { Knowledge, KProduct, ProductRef } from './types';

export const toRef = (p: KProduct): ProductRef => ({ name: p.name, slug: p.slug, priceText: p.priceText, availability: p.availability });
const AVAIL: Record<string, string> = { in_stock: 'in stock', low_stock: 'low stock', backorder: 'available to order', out_of_stock: 'out of stock' };
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s);

export const COMPLAINT = /\b(refund|wrong item|damaged|broken|not received|never arrived|charged twice|payment failed|scam|angry|complain|cancel my order|speak to|human|agent|person)\b/i;

/**
 * Free, instant answers built only from the shop's own data. Used when AI is switched off, over its daily limit, unreachable,
 * or when an AI answer fails the fact check.
 */
export function ruleBasedAnswer(q: string, k: Knowledge): { answer: string; products: ProductRef[]; handoff: boolean } {
  const text = q.toLowerCase();
  const contact = [k.contact.whatsappUrl ? 'WhatsApp' : null, k.contact.email].filter(Boolean).join(' or ');

  if (/\b(track|where is my order|order status|my order|parcel)\b/.test(text)) {
    if (k.orders === null) return { answer: 'To see your order status, sign in to your account and open Orders, or use the link in your order confirmation email. I cannot look up orders for guests.', products: [], handoff: true };
    if (!k.orders.length) return { answer: 'I cannot see any orders on your account yet.', products: [], handoff: false };
    const lines = k.orders.map((o) => `${o.number}: ${o.status}${o.tracking?.carrier ? `, shipped with ${o.tracking.carrier}${o.tracking.number ? ` (tracking ${o.tracking.number})` : ''}` : ''}`);
    return { answer: `Here are your latest orders. ${lines.join('. ')}.`, products: [], handoff: false };
  }
  if (/\b(ship|shipping|deliver|delivery|courier|dispatch|send to)\b/.test(text)) {
    if (!k.shipping.length) return { answer: 'Delivery options are still being set up, so I cannot quote them yet. Please contact us and we will help directly.', products: [], handoff: true };
    const parts = k.shipping.map((z) => `${z.name} (${z.countries.join(', ')}): ${z.rates.map((r) => `${r.name} ${r.costText}${r.days ? `, ${r.days}` : ''}${r.freeOverText ? `, free ${r.freeOverText}` : ''}`).join('; ')}`);
    const duties = k.shipping.flatMap((z) => z.rates.map((r) => r.dutiesNote)).find(Boolean);
    return { answer: `We deliver to: ${parts.join('. ')}.${duties ? ` ${duties}` : ''} Exact costs are confirmed at checkout.`, products: [], handoff: false };
  }
  if (/\b(return|returns|refund|exchange|money back)\b/.test(text)) {
    const p = k.policies.returns;
    return p ? { answer: `${clip(p.body, 600)} See the full returns policy for details.`, products: [], handoff: /refund/.test(text) } : { answer: 'Our returns policy is being finalised, so I cannot state it yet. Please contact us and we will help directly.', products: [], handoff: true };
  }
  if (/\b(pay|payment|momo|mobile money|card|visa|mastercard|paystack)\b/.test(text)) {
    return { answer: 'You pay on our payment provider’s secure page at checkout, and the payment options shown there are the ones available to you. We never see or store your card details. If a payment fails, nothing is charged and you can try again from your order page.', products: [], handoff: /fail|charged|twice/.test(text) };
  }
  if (/\b(contact|whatsapp|call|email|human|agent|speak|talk to)\b/.test(text)) {
    return { answer: contact ? `You can reach us on ${contact}.${k.contact.hours ? ` ${k.contact.hours}.` : ''}` : 'Our contact details are being set up. Please check the Contact page shortly.', products: [], handoff: true };
  }
  if (/\b(cheap|cheapest|affordable|inexpensive|budget|lowest price|least expensive)\b/.test(text) && !/\d{3,}/.test(text)) {
    const cheapest = k.products.filter((p) => p.minPriceMinor !== null && p.availability !== 'out_of_stock').sort((a, b) => a.minPriceMinor! - b.minPriceMinor!).slice(0, 3);
    if (cheapest.length) return { answer: `Our most affordable options right now: ${cheapest.map((p) => `${p.name} (${p.priceText})`).join('; ')}. Tell me your budget and I can narrow it down.`, products: cheapest.map(toRef), handoff: false };
  }
  const found = selectProducts(q, k.products, 4);
  if (/\b(care|wash|maintain|maintenance|style|styling|heat|brush|store)\b/.test(text)) {
    const withCare = found.filter((p) => p.care);
    if (withCare.length) return { answer: `${withCare[0].name}: ${clip(withCare[0].care!, 400)}`, products: [toRef(withCare[0])], handoff: false };
    return { answer: 'I do not have care instructions for that yet. The product page lists them when available, or ask us directly.', products: found.map(toRef), handoff: true };
  }
  if (found.length) {
    const lines = found.map((p) => `${p.name}${p.priceText ? ` (${p.priceText})` : ''}${p.texture ? `, ${p.texture}` : ''}${p.construction ? `, ${p.construction}` : ''}, ${AVAIL[p.availability] ?? p.availability}`);
    return { answer: `These look like a good match: ${lines.join('; ')}. Tap one to see sizes and colours.`, products: found.map(toRef), handoff: false };
  }
  return { answer: 'I could not find a match for that. You can browse the shop, try the Wig Finder to match your style, or contact us and we will help directly.', products: [], handoff: true };
}
