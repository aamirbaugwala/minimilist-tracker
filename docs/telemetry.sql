-- ============================================================================
-- FIRST-PARTY WEB TELEMETRY
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Tracks anonymous visitors AND stitches them to users once they sign up, so
-- acquisition source can be joined to long-term retention — the one thing a
-- third-party analytics tool cannot do without exporting your user data.
--
-- Privacy: no IP address and no PII are stored. IP is used transiently by the
-- ingest route for country/bot detection and then discarded. Referrers are
-- reduced to a host ("google.com"), never the full URL, which can carry query
-- strings.
-- ============================================================================

-- ── RAW EVENTS ──────────────────────────────────────────────────────────────
create table if not exists page_views (
  id            bigserial primary key,
  visitor_id    uuid        not null,              -- stable across visits
  session_id    uuid        not null,              -- 30-min idle window
  user_id       uuid        references auth.users on delete set null,
  path          text        not null,
  referrer_host text,                              -- 'google.com', not full URL
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  device        text,                              -- mobile | tablet | desktop
  display_mode  text,                              -- browser | standalone (PWA)
  country       text,
  is_bot        boolean     not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists page_views_created_idx  on page_views (created_at desc) where is_bot = false;
create index if not exists page_views_visitor_idx  on page_views (visitor_id, created_at);
create index if not exists page_views_session_idx  on page_views (session_id);
create index if not exists page_views_user_idx     on page_views (user_id) where user_id is not null;

-- ── ANONYMOUS → IDENTIFIED STITCH ───────────────────────────────────────────
create table if not exists visitor_identities (
  visitor_id    uuid        not null,
  user_id       uuid        not null references auth.users on delete cascade,
  first_seen_at timestamptz,                       -- their very first anonymous hit
  linked_at     timestamptz not null default now(),
  primary key (visitor_id, user_id)
);
create index if not exists visitor_identities_user_idx on visitor_identities (user_id);

-- ── DAILY ROLLUP (retention policy, see bottom) ─────────────────────────────
create table if not exists daily_traffic (
  day       date primary key,
  visitors  int not null default 0,
  sessions  int not null default 0,
  pageviews int not null default 0
);

-- RLS on, and deliberately NO policies: clients get zero direct access.
-- Writes happen through the service role in /api/track; reads happen only
-- through the security-definer functions below, which check is_admin().
alter table page_views        enable row level security;
alter table visitor_identities enable row level security;
alter table daily_traffic     enable row level security;

-- ============================================================================
-- ADMIN GUARD
-- !! EDIT THIS to match however you already gate your other get_admin_* RPCs.
-- Without it, any authenticated user could read your whole traffic history.
-- ============================================================================
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') in (
    'aamirbaugwala@gmail.com'
  );
$$;

-- ============================================================================
-- REPORTING RPCs  (mirror the existing get_admin_* naming)
-- ============================================================================

-- Daily traffic series.
create or replace function get_traffic_overview(days int default 30)
returns table (day date, visitors bigint, sessions bigint, pageviews bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
    select created_at::date,
           count(distinct visitor_id),
           count(distinct session_id),
           count(*)
    from page_views
    where not is_bot
      and created_at >= now() - (days * interval '1 day')
    group by 1
    order by 1;
end; $$;

-- Where visitors come from, and how many of each source converted.
create or replace function get_traffic_sources(days int default 30)
returns table (source text, visitors bigint, signups bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
    select coalesce(nullif(utm_source, ''), nullif(referrer_host, ''), 'direct')::text,
           count(distinct visitor_id),
           count(distinct visitor_id) filter (where user_id is not null)
    from page_views
    where not is_bot
      and created_at >= now() - (days * interval '1 day')
    group by 1
    order by 2 desc;
end; $$;

-- Most-visited paths.
create or replace function get_traffic_pages(days int default 30)
returns table (path text, views bigint, visitors bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
    select page_views.path,
           count(*),
           count(distinct visitor_id)
    from page_views
    where not is_bot
      and created_at >= now() - (days * interval '1 day')
    group by 1
    order by 2 desc
    limit 50;
end; $$;

-- Device / installed-PWA split.
create or replace function get_traffic_devices(days int default 30)
returns table (device text, display_mode text, visitors bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
    select coalesce(page_views.device, 'unknown')::text,
           coalesce(page_views.display_mode, 'browser')::text,
           count(distinct visitor_id)
    from page_views
    where not is_bot
      and created_at >= now() - (days * interval '1 day')
    group by 1, 2
    order by 3 desc;
end; $$;

-- Visitor → signup → activated funnel.
create or replace function get_signup_funnel(days int default 30)
returns table (visitors bigint, signups bigint, activated bigint)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (days * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
  with v as (
    select distinct visitor_id from page_views
    where not is_bot and created_at >= since
  ),
  s as (
    select distinct vi.user_id from visitor_identities vi
    join v on v.visitor_id = vi.visitor_id
    where vi.linked_at >= since
  )
  select (select count(*) from v),
         (select count(*) from s),
         (select count(distinct fl.user_id) from food_logs fl where fl.user_id in (select user_id from s));
end; $$;

-- THE ONE THAT MATTERS: which acquisition source produces users who stick.
-- retained = has logged food within the last 7 days.
create or replace function get_acquisition_cohorts(days int default 90)
returns table (source text, signups bigint, activated bigint, retained bigint)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (days * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
  -- Every column is aliased to a name that cannot collide with the OUT
  -- parameters (source/signups/activated/retained). plpgsql turns those into
  -- variables and substitutes them into the SQL, so a matching column name
  -- silently becomes a variable reference.
  with first_touch as (
    -- Each visitor's earliest recorded source: credit acquisition to where they
    -- FIRST arrived, not the last page they happened to land on.
    select distinct on (pv.visitor_id)
           pv.visitor_id as vid,
           coalesce(nullif(pv.utm_source, ''), nullif(pv.referrer_host, ''), 'direct') as src
    from page_views pv
    where pv.is_bot = false
    order by pv.visitor_id, pv.created_at asc
  ),
  linked as (
    select ft.src as src, vi.user_id as uid
    from visitor_identities vi
    join first_touch ft on ft.vid = vi.visitor_id
    where vi.linked_at >= since
  ),
  -- One row per (source, user) carrying plain 0/1 flags. Deliberately boring:
  -- a LEFT JOIN with max(case ...) avoids correlated subqueries, EXISTS inside
  -- aggregate FILTER clauses, and SELECT DISTINCT over booleans — all of which
  -- behave inconsistently across Postgres versions.
  per_user as (
    select l.src as src,
           l.uid as uid,
           max(case when f.id is not null then 1 else 0 end) as ever_logged,
           -- food_logs.date is TEXT ('YYYY-MM-DD'), not a date — the app writes
           -- toISOString().slice(0,10) and queries it with string equality. So
           -- compare as text: ISO dates sort chronologically, and unlike
           -- f.date::date this can never throw on an unexpected value.
           max(case when f.date::text >= to_char(current_date - 7, 'YYYY-MM-DD')
                    then 1 else 0 end) as recent
    from linked l
    left join food_logs f on f.user_id = l.uid
    group by l.src, l.uid
  )
  select p.src::text,
         count(*)::bigint,
         coalesce(sum(p.ever_logged), 0)::bigint,
         coalesce(sum(p.recent), 0)::bigint
  from per_user p
  group by p.src
  order by 2 desc;
end; $$;

-- ============================================================================
-- RETENTION  (Phase 7) — raw rows must not grow forever.
-- Rolls days older than 90 into daily_traffic, then deletes the raw rows.
-- Schedule with pg_cron:  select cron.schedule('roll-traffic','0 3 * * *',
--                           $$select roll_up_traffic()$$);
-- ============================================================================
create or replace function roll_up_traffic()
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into daily_traffic (day, visitors, sessions, pageviews)
  select created_at::date,
         count(distinct visitor_id),
         count(distinct session_id),
         count(*)
  from page_views
  where not is_bot and created_at < now() - interval '90 days'
  group by 1
  on conflict (day) do update
    set visitors  = excluded.visitors,
        sessions  = excluded.sessions,
        pageviews = excluded.pageviews;

  delete from page_views where created_at < now() - interval '90 days';
end; $$;
