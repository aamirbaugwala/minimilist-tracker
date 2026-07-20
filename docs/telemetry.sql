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

-- Added later: browser/OS were already derivable from the user-agent we receive
-- on every hit, and city/region already arrive in Vercel's edge headers next to
-- the country we were reading. All four were simply being discarded.
-- `add column if not exists` so this stays re-runnable on an existing table.
alter table page_views add column if not exists browser text;
alter table page_views add column if not exists os      text;
alter table page_views add column if not exists city    text;
alter table page_views add column if not exists region  text;

-- Your own browsing is not traffic. Marked rather than deleted so the rows stay
-- auditable, and so a single flag flip can retroactively clean history once an
-- admin's visitor_id is known (see /api/track/identify). Every reporting RPC
-- filters it out.
alter table page_views add column if not exists is_internal boolean not null default false;

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

-- Daily traffic series, with signups overlaid so spikes in traffic can be read
-- against whether they actually converted.
--
-- NOTE: this function gained a `signups` column. Postgres will not CREATE OR
-- REPLACE a function whose return type changed ("cannot change return type of
-- existing function") — and in the Supabase SQL editor that error aborts the
-- whole batch, so everything below would silently never be created. Dropping
-- first makes this file safely re-runnable.
drop function if exists get_traffic_overview(int);
create or replace function get_traffic_overview(days int default 30)
returns table (day date, visitors bigint, sessions bigint, pageviews bigint, signups bigint)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (days * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
  with hits as (
    select pv.created_at::date as d,
           pv.visitor_id as vid,
           pv.session_id as sid
    from page_views pv
    where pv.is_bot = false and pv.is_internal = false and pv.created_at >= since
  ),
  daily as (
    select h.d as d,
           count(distinct h.vid) as v,
           count(distinct h.sid) as s,
           count(*) as pvs
    from hits h group by h.d
  ),
  su as (
    -- ONE SIGNUP = ONE ACCOUNT, dated at its earliest link.
    -- Counting rows would count the same person once per device: every browser
    -- has its own visitor_id and therefore its own visitor_identities row, so a
    -- phone + laptop signin used to read as two signups.
    -- Internal (admin) visitors are excluded so this agrees with the funnel.
    select s.at::date as d, count(*) as n
    from (
      select vi.user_id as uid, min(vi.linked_at) as at
      from visitor_identities vi
      where vi.visitor_id not in (select pv.visitor_id from page_views pv where pv.is_internal)
      group by vi.user_id
    ) s
    where s.at >= since
    group by s.at::date
  )
  select dd.d,
         dd.v::bigint,
         dd.s::bigint,
         dd.pvs::bigint,
         coalesce(su.n, 0)::bigint
  from daily dd
  left join su on su.d = dd.d
  order by dd.d;
end; $$;

-- Headline KPIs WITH the previous equal-length period alongside. A bare count
-- can't tell you whether anything is working; the delta can.
-- Also carries engagement quality (bounce, depth), new vs returning, and how
-- long people lurk before signing up.
create or replace function get_traffic_kpis(days int default 30)
returns table (
  visitors bigint, prev_visitors bigint,
  sessions bigint, prev_sessions bigint,
  pageviews bigint, prev_pageviews bigint,
  signups bigint, prev_signups bigint,
  bounce_pct numeric, prev_bounce_pct numeric,
  pages_per_session numeric,
  new_visitors bigint, returning_visitors bigint,
  median_days_to_signup numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  cur_start timestamptz := now() - (days * interval '1 day');
  prv_start timestamptz := now() - (days * 2 * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
  with cur as (
    select pv.visitor_id as vid, pv.session_id as sid
    from page_views pv
    where pv.is_bot = false and pv.is_internal = false and pv.created_at >= cur_start
  ),
  prv as (
    select pv.visitor_id as vid, pv.session_id as sid
    from page_views pv
    where pv.is_bot = false and pv.is_internal = false
      and pv.created_at >= prv_start and pv.created_at < cur_start
  ),
  cur_sess as (select c.sid as sid, count(*) as hits from cur c group by c.sid),
  prv_sess as (select p.sid as sid, count(*) as hits from prv p group by p.sid),
  -- Earliest sighting per visitor, ever — used to split new from returning.
  first_seen as (
    select pv.visitor_id as vid, min(pv.created_at) as first_at
    from page_views pv
    where pv.is_bot = false and pv.is_internal = false
    group by pv.visitor_id
  ),
  -- Days between a visitor's first page view and the moment they signed up.
  lag_days as (
    select extract(epoch from (vi.linked_at - vi.first_seen_at)) / 86400.0 as gap
    from visitor_identities vi
    where vi.first_seen_at is not null and vi.linked_at >= cur_start
  )
  select
    (select count(distinct c.vid) from cur c)::bigint,
    (select count(distinct p.vid) from prv p)::bigint,
    (select count(distinct c.sid) from cur c)::bigint,
    (select count(distinct p.sid) from prv p)::bigint,
    (select count(*) from cur c)::bigint,
    (select count(*) from prv p)::bigint,
    (select count(*) from (
       select vi.user_id as uid, min(vi.linked_at) as at
       from visitor_identities vi
       where vi.visitor_id not in (select pv.visitor_id from page_views pv where pv.is_internal)
       group by vi.user_id
     ) s where s.at >= cur_start)::bigint,
    (select count(*) from (
       select vi.user_id as uid, min(vi.linked_at) as at
       from visitor_identities vi
       where vi.visitor_id not in (select pv.visitor_id from page_views pv where pv.is_internal)
       group by vi.user_id
     ) s where s.at >= prv_start and s.at < cur_start)::bigint,
    (select case when count(*) = 0 then 0
              else round(100.0 * count(*) filter (where cs.hits = 1) / count(*), 1) end
       from cur_sess cs)::numeric,
    (select case when count(*) = 0 then 0
              else round(100.0 * count(*) filter (where ps.hits = 1) / count(*), 1) end
       from prv_sess ps)::numeric,
    (select case when count(distinct c.sid) = 0 then 0
              else round(count(*)::numeric / count(distinct c.sid), 1) end
       from cur c)::numeric,
    (select count(*) from first_seen fs where fs.first_at >= cur_start)::bigint,
    (select count(distinct c.vid) from cur c
      where c.vid in (select fs.vid from first_seen fs where fs.first_at < cur_start))::bigint,
    (select round(coalesce(percentile_cont(0.5) within group (order by ld.gap), 0)::numeric, 1)
       from lag_days ld)::numeric;
end; $$;

-- Where sessions START, with the bounce rate of each entry point. Top pages
-- tells you what gets read; this tells you which doors people come through and
-- which of those doors they immediately walk back out of.
create or replace function get_entry_pages(days int default 30)
returns table (path text, entries bigint, bounce_pct numeric, signups bigint)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (days * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
  with scoped as (
    select pv.session_id as sid, pv.path as p, pv.created_at as at, pv.user_id as uid
    from page_views pv
    where pv.is_bot = false and pv.is_internal = false and pv.created_at >= since
  ),
  entry as (
    select distinct on (s.sid) s.sid as sid, s.p as p
    from scoped s
    order by s.sid, s.at asc
  ),
  depth as (
    select s.sid as sid, count(*) as hits, max(case when s.uid is not null then 1 else 0 end) as converted
    from scoped s group by s.sid
  )
  select e.p::text,
         count(*)::bigint,
         round(100.0 * count(*) filter (where d.hits = 1) / count(*), 1)::numeric,
         coalesce(sum(d.converted), 0)::bigint
  from entry e
  join depth d on d.sid = e.sid
  group by e.p
  order by 2 desc
  limit 20;
end; $$;

-- Geography. Collected on every hit but never surfaced until now.
create or replace function get_traffic_countries(days int default 30)
returns table (country text, visitors bigint, signups bigint)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (days * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
    select coalesce(nullif(pv.country, ''), 'unknown')::text,
           count(distinct pv.visitor_id)::bigint,
           count(distinct pv.visitor_id) filter (where pv.user_id is not null)::bigint
    from page_views pv
    where pv.is_bot = false and pv.is_internal = false and pv.created_at >= since
    group by 1
    order by 2 desc
    limit 20;
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
           -- distinct ACCOUNTS, not visitors: the column is headed "Signups".
           count(distinct user_id)
    from page_views
    where not is_bot and not is_internal
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
    where not is_bot and not is_internal
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
    where not is_bot and not is_internal
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
    where not is_bot and not is_internal and created_at >= since
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
    where pv.is_bot = false and pv.is_internal = false
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

-- ── GA4-equivalent reports, all computed from data already being stored ─────

-- Exit pages: the LAST page of each session. Entry pages tell you which doors
-- people come through; this tells you which room they leave from.
-- exit_pct mirrors GA's definition: exits / total views of that page.
create or replace function get_exit_pages(days int default 30)
returns table (path text, exits bigint, exit_pct numeric)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (days * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
  with scoped as (
    select pv.session_id as sid, pv.path as p, pv.created_at as at
    from page_views pv
    where pv.is_bot = false and pv.is_internal = false and pv.created_at >= since
  ),
  last_view as (
    select distinct on (s.sid) s.sid as sid, s.p as p
    from scoped s
    order by s.sid, s.at desc
  ),
  views_per_page as (
    select s.p as p, count(*) as n from scoped s group by s.p
  ),
  exits_per_page as (
    select l.p as p, count(*) as n from last_view l group by l.p
  )
  select v.p::text,
         coalesce(e.n, 0)::bigint,
         round(100.0 * coalesce(e.n, 0) / v.n, 1)::numeric
  from views_per_page v
  left join exits_per_page e on e.p = v.p
  order by 2 desc
  limit 20;
end; $$;

-- Session depth and duration.
-- Caveat worth knowing: duration is last-view minus first-view, so a
-- single-page session measures 0. This is the exact limitation Universal
-- Analytics had; GA4 only fixed it by adding engagement-time heartbeats, which
-- would need extra client tracking. sessions_over_30s is the honest proxy.
create or replace function get_engagement_stats(days int default 30)
returns table (
  avg_session_seconds numeric,
  median_session_seconds numeric,
  avg_pages_per_session numeric,
  sessions_over_30s bigint,
  total_sessions bigint
)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (days * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
  with sess as (
    select pv.session_id as sid,
           extract(epoch from (max(pv.created_at) - min(pv.created_at))) as secs,
           count(*) as hits
    from page_views pv
    where pv.is_bot = false and pv.is_internal = false and pv.created_at >= since
    group by pv.session_id
  )
  select round(coalesce(avg(s.secs), 0)::numeric, 1),
         round(coalesce(percentile_cont(0.5) within group (order by s.secs), 0)::numeric, 1),
         round(coalesce(avg(s.hits), 0)::numeric, 1),
         count(*) filter (where s.secs >= 30)::bigint,
         count(*)::bigint
  from sess s;
end; $$;

-- Weekly retention triangle: of the users who signed up in week X, how many
-- were still logging food 1, 2, 3 weeks later. The clearest read on whether the
-- product builds a habit or just gets tried once.
create or replace function get_retention_cohorts(weeks int default 8)
returns table (cohort_week date, users bigint, w0 bigint, w1 bigint, w2 bigint, w3 bigint)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (weeks * 7 * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
  with cohort as (
    select vi.user_id as uid,
           date_trunc('week', vi.linked_at)::date as cw
    from visitor_identities vi
    where vi.linked_at >= since
    group by vi.user_id, date_trunc('week', vi.linked_at)::date
  ),
  logs as (
    -- food_logs.date is TEXT; the regex guard means to_date can never throw on
    -- an unexpected value.
    select f.user_id as uid, to_date(f.date, 'YYYY-MM-DD') as d
    from food_logs f
    where f.date ~ '^\d{4}-\d{2}-\d{2}$'
  ),
  joined as (
    select c.cw as cw,
           c.uid as uid,
           floor((l.d - c.cw) / 7.0) as wk
    from cohort c
    left join logs l on l.uid = c.uid and l.d >= c.cw
  )
  select j.cw,
         count(distinct j.uid)::bigint,
         count(distinct j.uid) filter (where j.wk = 0)::bigint,
         count(distinct j.uid) filter (where j.wk = 1)::bigint,
         count(distinct j.uid) filter (where j.wk = 2)::bigint,
         count(distinct j.uid) filter (where j.wk = 3)::bigint
  from joined j
  group by j.cw
  order by j.cw desc;
end; $$;

-- Browser / OS split.
create or replace function get_traffic_browsers(days int default 30)
returns table (browser text, os text, visitors bigint)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (days * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
    select coalesce(nullif(pv.browser, ''), 'unknown')::text,
           coalesce(nullif(pv.os, ''), 'unknown')::text,
           count(distinct pv.visitor_id)::bigint
    from page_views pv
    where pv.is_bot = false and pv.is_internal = false and pv.created_at >= since
    group by 1, 2
    order by 3 desc
    limit 20;
end; $$;

-- City-level geography.
create or replace function get_traffic_cities(days int default 30)
returns table (city text, region text, country text, visitors bigint)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - (days * interval '1 day');
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
    select coalesce(nullif(pv.city, ''), 'unknown')::text,
           coalesce(nullif(pv.region, ''), '')::text,
           coalesce(nullif(pv.country, ''), '')::text,
           count(distinct pv.visitor_id)::bigint
    from page_views pv
    where pv.is_bot = false and pv.is_internal = false and pv.created_at >= since
    group by 1, 2, 3
    order by 4 desc
    limit 20;
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
  where not is_bot and not is_internal and created_at < now() - interval '90 days'
  group by 1
  on conflict (day) do update
    set visitors  = excluded.visitors,
        sessions  = excluded.sessions,
        pageviews = excluded.pageviews;

  delete from page_views where created_at < now() - interval '90 days';
end; $$;

-- ============================================================================
-- ONE-TIME CLEANUP — retroactively flag traffic already recorded from admin
-- accounts. Placed last so a failure here can't abort function creation.
-- Safe to re-run. Going forward /api/track/identify marks it automatically.
-- Keep the email list in sync with is_admin() above.
-- ============================================================================
update page_views
   set is_internal = true
 where user_id in (
   select u.id from auth.users u
    where coalesce(u.email, '') in ('aamirbaugwala@gmail.com')
 )
    or visitor_id in (
   select vi.visitor_id
     from visitor_identities vi
     join auth.users u on u.id = vi.user_id
    where coalesce(u.email, '') in ('aamirbaugwala@gmail.com')
 );
