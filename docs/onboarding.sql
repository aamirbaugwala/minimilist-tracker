-- ============================================================================
-- ONBOARDING / HEALTH PROFILE — extra user_profiles columns.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- health_conditions feeds the SAME condition engine as uploaded blood reports
-- (see lib/conditions.js → conditionsFromProfile), so a self-reported diagnosis
-- adjusts macro targets immediately — before any lab data exists.
-- ============================================================================

alter table user_profiles
  add column if not exists health_conditions text[] default '{}';

alter table user_profiles
  add column if not exists dietary_pattern text;            -- veg | nonveg | eggetarian | vegan | jain

alter table user_profiles
  add column if not exists allergies text[] default '{}';
