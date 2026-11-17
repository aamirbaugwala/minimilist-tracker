-- ============================================================================
-- LOG SOURCE — how each food log was made, so we can see which logging
-- methods people actually use (and which features are worth the effort).
--
--   sheet      food sheet search / browse / saved meals
--   quick_add  Today's quick-add chips        nudge     Coach nudge chip on Today
--   water      Today's water "+"              shortcut  home-screen "Add water"
--   custom     "create a food" + add now      snap      Snap-a-plate photo
--   repeat     "Same as yesterday"            barcode   barcode scanner
--   coach      Coach chat                      voice     voice mode
--   recipe     Recipe Studio "Log 1 serving"
--
-- Run once in the Supabase SQL editor. Safe to run before or after deploying:
-- until the column exists the app simply saves logs without it.
-- Requires is_admin() from telemetry.sql.
-- ============================================================================

alter table food_logs add column if not exists source text;

-- Admin portal: logs and distinct users per source over the last N days.
create or replace function get_log_sources(days int default 30)
returns table (source text, logs bigint, users bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'not authorised'; end if;
  return query
  select coalesce(f.source, 'before tracking') as source,
         count(*)                as logs,
         count(distinct f.user_id) as users
  from food_logs f
  where f.created_at >= now() - (days * interval '1 day')
  group by 1
  order by 2 desc;
end $$;

grant execute on function get_log_sources(int) to authenticated;
