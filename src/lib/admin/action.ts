import { redirect } from 'next/navigation';
import type { ZodType, ZodTypeDef } from 'zod';

/** Flat object from a submitted form. Unchecked checkboxes are simply absent. */
export const formObject = (fd: FormData): Record<string, string> => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;

export function parseForm<T>(schema: ZodType<T, ZodTypeDef, unknown>, fd: FormData): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(formObject(fd));
  if (r.success) return { ok: true, data: r.data };
  const issue = r.error.issues[0];
  const field = issue.path.length ? `${String(issue.path[0])}: ` : '';
  return { ok: false, error: `${field}${issue.message}` };
}

/** Redirect back with a one-line message. Call OUTSIDE try/catch: redirect() works by throwing. */
export function back(path: string, kind: 'ok' | 'error', message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(message.slice(0, 200))}`);
}

/** Friendly text for known database error codes; anything else is logged and kept generic. */
export function dbMessage(e: { code?: string; message?: string }, fallback = 'Could not save. Please try again.'): string {
  const map: Record<string, string> = {
    '23505': 'That value is already in use (SKU, slug or code must be unique).', '23503': 'That item is still used elsewhere.', '23514': 'That change is not allowed.',
    P0001: 'Not enough stock for that change.', P0002: 'Item not found.', P0005: 'Payment status is controlled by verified payments only.', P0006: 'That action is not allowed for this order.', P0007: 'You cannot remove the last owner.',
  };
  if (e.code && map[e.code]) return map[e.code];
  console.error('admin db error', e.code, e.message);
  return fallback;
}
