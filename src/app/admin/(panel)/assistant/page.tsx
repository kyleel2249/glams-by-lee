import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { createAdmin } from '@/lib/supabase/admin';
import { Card, PageTitle, Stat } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';
interface S { total: number; by_outcome: Record<string, number>; ai_requests: number; avg_latency_ms: number; p95_latency_ms: number; input_tokens: number; output_tokens: number; today: number }
const OUTCOME: Record<string, string> = { answered: 'AI answered', fallback: 'Instant answer (AI off, busy or over its limit)', blocked: 'AI answer replaced by a checked answer', limited: 'Daily limit reached', error: 'Errors', disabled: 'Switched off' };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requirePermission('assistant.view');
  const days = ({ '7': 7, '30': 30, '90': 90 } as Record<string, number>)[(await searchParams).range ?? ''] ?? 30;
  const db = createAdmin();
  const [{ data, error }, { data: lim }] = await Promise.all([db.rpc('assistant_usage_summary', { p_from: new Date(Date.now() - days * 86_400_000).toISOString() }), db.from('admin_settings').select('key, value').in('key', ['assistant_enabled', 'assistant_daily_limit'])]);
  if (error) throw new Error('Assistant usage failed');
  const s = data as S, m = new Map(((lim ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
  const keySet = Boolean(process.env.ANTHROPIC_API_KEY);
  const rate = (name: string) => { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : null; };
  const inRate = rate('ASSISTANT_PRICE_INPUT_PER_MILLION'), outRate = rate('ASSISTANT_PRICE_OUTPUT_PER_MILLION');
  const cost = inRate !== null && outRate !== null ? (Number(s.input_tokens) / 1e6) * inRate + (Number(s.output_tokens) / 1e6) * outRate : null;
  return (
    <>
      <PageTitle title="Shopping assistant">
        <nav aria-label="Period" className="flex gap-2 text-sm">{[7, 30, 90].map((d) => <Link key={d} href={`/admin/assistant?range=${d}`} aria-current={d === days ? 'page' : undefined} className={`min-h-[44px] border px-4 py-2.5 ${d === days ? 'border-ink bg-ink text-ivory' : 'border-line bg-white'}`}>{d} days</Link>)}</nav>
      </PageTitle>
      <p className="mb-4 max-w-2xl text-sm text-muted">{keySet ? 'AI answers are on.' : 'No AI key is set, so visitors get free instant answers built from your shop information.'} {m.get('assistant_enabled') === false ? 'The assistant is currently hidden on the website.' : 'The assistant is visible on the website.'} Change the daily cap or switch it off in <Link href="/admin/settings" className="underline">Settings</Link>. Conversations are not stored; only counts and timing are.</p>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Questions" value={s.total} /><Stat label="AI answers today" value={`${s.today} / ${Number(m.get('assistant_daily_limit') ?? 300)}`} note="Cap resets at midnight UTC" />
        <Stat label="Average reply time" value={`${(Number(s.avg_latency_ms) / 1000).toFixed(1)}s`} note={`Slowest 5%: ${(Number(s.p95_latency_ms) / 1000).toFixed(1)}s`} />
        <Stat label="Tokens used" value={`${Number(s.input_tokens) + Number(s.output_tokens)}`} note={cost !== null ? `Estimated cost ${cost.toFixed(2)} (your set rates)` : 'Set price-per-million env vars to see a cost estimate'} />
      </dl>
      <div className="mt-6"><Card title="What happened to each question">
        {Object.keys(s.by_outcome).length ? <ul className="space-y-2 text-sm">{Object.entries(s.by_outcome).map(([k, n]) => <li key={k} className="flex justify-between"><span>{OUTCOME[k] ?? k}</span><span className="font-medium">{n}</span></li>)}</ul> : <p className="text-sm text-muted">No questions yet.</p>}
        <p className="mt-4 text-xs text-muted">“Replaced by a checked answer” means the AI wrote something (such as a price or discount) that did not match your shop information, so the safe answer was shown instead. A high number here is worth a look.</p>
      </Card></div>
    </>
  );
}
