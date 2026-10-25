import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAnthropicProvider } from '@/lib/assistant/anthropic';
import { buildKnowledge } from '@/lib/assistant/knowledge';
import { answerQuestion } from '@/lib/assistant/service';
import { getCustomer } from '@/lib/customer/auth';
import { clientIp, rateLimited } from '@/lib/rateLimit';
import { createAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const body = z.object({ messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).min(1).max(30) });

/** Settings and today's AI usage, cached briefly so every chat message does not cost extra database round trips. */
let limits: { at: number; enabled: boolean; dailyLimit: number; usedToday: number } | null = null;
async function readLimits() {
  if (limits && Date.now() - limits.at < 20_000) return limits;
  const db = createAdmin();
  const [{ data: s }, { data: u }] = await Promise.all([db.from('admin_settings').select('key, value').in('key', ['assistant_enabled', 'assistant_daily_limit']), db.rpc('assistant_usage_summary', { p_from: new Date(Date.now() - 86_400_000).toISOString() })]);
  const m = new Map(((s ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
  const lim = Number(m.get('assistant_daily_limit') ?? 300);
  limits = { at: Date.now(), enabled: m.get('assistant_enabled') !== false, dailyLimit: Number.isFinite(lim) && lim >= 0 ? lim : 300, usedToday: Number((u as { today?: number } | null)?.today ?? 0) };
  return limits;
}

async function logUsage(row: { outcome: string; source: string; model?: string; latency?: number; input?: number; output?: number; signedIn: boolean }) {
  try {
    await createAdmin().from('assistant_usage').insert({ outcome: row.outcome, source: row.source, model: row.model ?? null, latency_ms: row.latency ?? null, input_tokens: row.input ?? null, output_tokens: row.output ?? null, signed_in: row.signedIn });
    if (limits && row.source === 'ai') limits.usedToday += 1;
  } catch (e) { console.error('assistant usage log failed', e instanceof Error ? e.message : e); }
}

export async function POST(req: Request) {
  // Same-site requests only, and small bodies.
  const origin = req.headers.get('origin'), host = req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  if (Number(req.headers.get('content-length') ?? 0) > 30_000) return NextResponse.json({ error: 'Message too long.' }, { status: 413 });
  const ip = clientIp(req);
  if (rateLimited(`assistant-min:${ip}`, 12) || rateLimited(`assistant-hour:${ip}`, 80, 3_600_000)) return NextResponse.json({ error: 'You are asking very quickly. Please wait a moment and try again.' }, { status: 429 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Please type a question.' }, { status: 400 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'The assistant is not available yet.' }, { status: 503 });

  try {
    const customer = await getCustomer();
    const [knowledge, lim] = await Promise.all([buildKnowledge(Boolean(customer)), readLimits()]);
    if (!lim.enabled) return NextResponse.json({ error: 'The assistant is switched off right now. Please contact us.', whatsappUrl: knowledge.contact.whatsappUrl }, { status: 503 });

    const key = process.env.ANTHROPIC_API_KEY;
    const overLimit = lim.usedToday >= lim.dailyLimit;
    const provider = key && !overLimit ? createAnthropicProvider({ apiKey: key, model: process.env.ASSISTANT_MODEL || undefined, baseUrl: process.env.ANTHROPIC_BASE_URL || undefined }) : null;
    const reply = await answerQuestion({ messages: parsed.data.messages, knowledge, provider });

    await logUsage({ outcome: overLimit && !reply.usage ? 'limited' : reply.outcome, source: reply.source, model: reply.usage?.model, latency: reply.usage?.latencyMs, input: reply.usage?.inputTokens, output: reply.usage?.outputTokens, signedIn: Boolean(customer) });
    return NextResponse.json({ answer: reply.answer, products: reply.products, handoff: reply.handoff, source: reply.source, whatsappUrl: knowledge.contact.whatsappUrl }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('assistant failed', e instanceof Error ? e.message : e);
    await logUsage({ outcome: 'error', source: 'rules', signedIn: false });
    return NextResponse.json({ error: 'Sorry, I could not answer that. Please try again or contact us.' }, { status: 500 });
  }
}
