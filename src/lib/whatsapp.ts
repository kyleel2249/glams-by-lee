/** Accepts a merchant-configured number in international format; returns digits only, or null if it looks invalid. */
export function normaliseWhatsAppNumber(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const compact = raw.replace(/[\s()-]/g, '');
  if (!/^\+?[1-9]\d{7,14}$/.test(compact)) return null;
  return compact.replace('+', '');
}

/** Click-to-chat link. Message text must never contain addresses, payment details or other personal data. */
export function whatsAppLink(rawNumber: unknown, message?: string): string | null {
  const n = normaliseWhatsAppNumber(rawNumber);
  if (!n) return null;
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
