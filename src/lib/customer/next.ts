/** Where to send someone after sign-in. Only same-site paths are allowed, so a crafted link can never bounce a customer to another website. */
export function safeNext(raw: unknown, fallback = '/account'): string {
  if (typeof raw !== 'string') return fallback;
  const v = raw.trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\') || /[\r\n\t]/.test(v) || v.includes('://')) return fallback;
  if (v.startsWith('/admin')) return fallback;
  return v.slice(0, 300);
}
