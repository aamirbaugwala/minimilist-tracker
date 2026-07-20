-- ============================================================================
-- LLM COST TRACKING
-- Run once in the Supabase SQL editor. Requires is_admin() from telemetry.sql.
--
-- Answers: what is this app costing me in Gemini calls, which features burn the
-- budget, and which users are expensive relative to everyone else.
--
-- Cost is computed in app/lib/llmCost.js at write time rather than here, so the
-- historical figure is whatever the rate was WHEN the call happened — repricing
-- the model later won't silently rewrite the past.
-- ============================================================================

create table if not exists llm_usage (
  id            bigserial   primary key,
  user_id       uuid        references auth.users on delete set null,
  route         text        not null,     -- agent | medical | recipes | coach | weekly | transcribe
  model         text        not null,
  input_tokens  int         not null default 0,
  cached_tokens int         not null default 0,   -- subset of input_tokens, billed at ~25%
  output_tokens int         not null default 0,
  total_tokens  int         not null default 0,
  cost_usd      numeric(12, 6) not null default 0,
  latency_ms    int,
  ok            boolean     not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists llm_usage_created_idx on llm_usage (created_at desc);
create index if not exists llm_usage_user_idx    on llm_usage (user_id, created_at desc);
create index if not exists llm_usage_route_idx   on llm_usage (route, created_at desc);

-- No policies: writes come from the service role, reads only via the
-- security-definer functions below.
alter table llm_usage enable row level security;

-- ── Headline spend, with the previous equal period for comparison ───────────
create or replace function get_llm_cost_summary(days int default 30)
returns table (
  total_cost numeric, prev_total_cost numeric,
  calls bigint, prev_calls bigint,
  total_tokens bigint,
  cached_tokens bigint,
  avg_cost_per_call numeric,
  users_served bigint,
  cost_per_user numeric,
  failed_calls bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  cur_start timestamptz := now() - (days * interval '1 day');
  prv_start timestamptz := now() - (days * 2 * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
  with cur as (
    select * from llm_usage lu where lu.created_at >= cur_start
  ),
  prv as (
    select * from llm_usage lu
     where lu.created_at >= prv_start and lu.created_at < cur_start
  )
  select
    round(coalesce((select sum(c.cost_usd) from cur c), 0), 4),
    round(coalesce((select sum(p.cost_usd) from prv p), 0), 4),
    (select count(*) from cur c)::bigint,
    (select count(*) from prv p)::bigint,
    coalesce((select sum(c.total_tokens) from cur c), 0)::bigint,
    coalesce((select sum(c.cached_tokens) from cur c), 0)::bigint,
    round(coalesce((select avg(c.cost_usd) from cur c), 0), 6),
    (select count(distinct c.user_id) from cur c where c.user_id is not null)::bigint,
    round(
      case
        when (select count(distinct c.user_id) from cur c where c.user_id is not null) = 0 then 0
        else coalesce((select sum(c.cost_usd) from cur c), 0)
             / (select count(distinct c.user_id) from cur c where c.user_id is not null)
      end, 4),
    (select count(*) from cur c where c.ok = false)::bigint;
end; $$;

-- ── Which feature burns the budget ──────────────────────────────────────────
create or replace function get_llm_cost_by_route(days int default 30)
returns table (route text, calls bigint, cost numeric, share_pct numeric, avg_latency_ms numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := now() - (days * interval '1 day');
  grand numeric;
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  select coalesce(sum(lu.cost_usd), 0) into grand
    from llm_usage lu where lu.created_at >= since;

  return query
    select lu.route::text,
           count(*)::bigint,
           round(sum(lu.cost_usd), 4),
           case when grand = 0 then 0 else round(100.0 * sum(lu.cost_usd) / grand, 1) end,
           round(coalesce(avg(lu.latency_ms), 0), 0)
    from llm_usage lu
    where lu.created_at >= since
    group by lu.route
    order by 3 desc;
end; $$;

-- ── Per-user spend. The point: spotting the few users who cost real money. ──
create or replace function get_llm_cost_by_user(days int default 30, limit_n int default 25)
returns table (user_id uuid, email text, calls bigint, tokens bigint, cost numeric)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (days * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
    select lu.user_id,
           coalesce(u.email, 'anonymous')::text,
           count(*)::bigint,
           coalesce(sum(lu.total_tokens), 0)::bigint,
           round(sum(lu.cost_usd), 4)
    from llm_usage lu
    left join auth.users u on u.id = lu.user_id
    where lu.created_at >= since
    group by lu.user_id, u.email
    order by 5 desc
    limit limit_n;
end; $$;

-- ── Daily spend, for spotting a runaway before the invoice arrives ──────────
create or replace function get_llm_cost_daily(days int default 30)
returns table (day date, cost numeric, calls bigint)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (days * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
    select lu.created_at::date,
           round(sum(lu.cost_usd), 4),
           count(*)::bigint
    from llm_usage lu
    where lu.created_at >= since
    group by lu.created_at::date
    order by 1;
end; $$;
