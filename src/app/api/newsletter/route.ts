import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdmin } from '@/lib/supabase/admin';

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

// Small in-memory limiter: slows casual abuse per server instance. Add an edge/KV limiter before heavy traffic.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(); const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now); hits.set(ip, recent); return recent.length > 5;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (limited(ip)) return NextResponse.json({ error: 'Too many attempts. Please wait a minute.' }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('YOUR-PROJECT')) {
    return NextResponse.json({ error: 'Sign-up is not available yet.' }, { status: 503 });
  }
  const { error } = await createAdmin().from('newsletter_subscriptions').upsert(
    { email: parsed.data.email, consent_source: 'footer_form', unsubscribed_at: null },
    { onConflict: 'email' },
  );
  if (error) { console.error('newsletter signup failed', error.code); return NextResponse.json({ error: 'Could not sign you up. Please try again.' }, { status: 500 }); }
  return NextResponse.json({ message: 'Thank you. You are on the list.' });
}
