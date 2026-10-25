-- GLAMS BY LEE — 0010 shopping assistant usage tracking
-- Stores NO conversation text: only counts, timing and token totals, so cost and quality can be watched without keeping customer messages.

create table assistant_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  outcome text not null check (outcome in ('answered','fallback','blocked','limited','error','disabled')),
  source text not null default 'ai' check (source in ('ai','rules')),
  model text,
  latency_ms int check (latency_ms is null or latency_ms >= 0),
  input_tokens int check (input_tokens is null or input_tokens >= 0),
  output_tokens int check (output_tokens is null or output_tokens >= 0),
  signed_in boolean not null default false
);
create index assistant_usage_created_idx on assistant_usage(created_at desc);
alter table assistant_usage enable row level security;   -- no policies: only the server (service role) can read or write

insert into admin_settings (key, value, is_public) values
 ('assistant_enabled', 'true', true),
 ('assistant_daily_limit', '300', false)          -- AI answers per day before the free rule-based answers take over (cost cap)
on conflict (key) do nothing;

create or replace function assistant_usage_summary(p_from timestamptz) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total', (select count(*)::int from assistant_usage where created_at >= p_from),
    'by_outcome', coalesce((select jsonb_object_agg(outcome, n) from (select outcome, count(*)::int as n from assistant_usage where created_at >= p_from group by outcome) x), '{}'::jsonb),
    'ai_requests', (select count(*)::int from assistant_usage where created_at >= p_from and source = 'ai'),
    'avg_latency_ms', (select coalesce(round(avg(latency_ms))::int, 0) from assistant_usage where created_at >= p_from and latency_ms is not null),
    'p95_latency_ms', (select coalesce(round(percentile_cont(0.95) within group (order by latency_ms))::int, 0) from assistant_usage where created_at >= p_from and latency_ms is not null),
    'input_tokens', (select coalesce(sum(input_tokens), 0)::bigint from assistant_usage where created_at >= p_from),
    'output_tokens', (select coalesce(sum(output_tokens), 0)::bigint from assistant_usage where created_at >= p_from),
    'today', (select count(*)::int from assistant_usage where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' and source = 'ai')
  );
$$;
revoke all on function assistant_usage_summary(timestamptz) from public, anon, authenticated;
grant execute on function assistant_usage_summary(timestamptz) to service_role;
