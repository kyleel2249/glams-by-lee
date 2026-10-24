import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';

/**
 * Service-role client: BYPASSES row-level security. Use only in trusted server code
 * (checkout, webhooks, admin actions) after you have authorised the caller yourself.
 */
export function createAdmin() {
  const env = serverEnv();
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
