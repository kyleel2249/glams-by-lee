import { createBrowserClient } from '@supabase/ssr';

/** Browser client: anon key only. Row-level security decides what it can see. */
export const createBrowser = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
