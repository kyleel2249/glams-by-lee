import { createHash, randomBytes } from 'node:crypto';

export const CART_COOKIE = 'gbl_cart';
export const newCartToken = () => randomBytes(32).toString('base64url');
/** Only this hash is stored; a database leak cannot be replayed as a cart cookie. */
export const hashCartToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const isPlausibleToken = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);
