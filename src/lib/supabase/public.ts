import { createClient } from '@supabase/supabase-js';

/** Anonymous read-only client for public catalogue data. Returns null when Supabase is not configured. */
export function createPublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('YOUR-PROJECT')) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
