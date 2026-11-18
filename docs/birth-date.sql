-- birth-date.sql — store a birthday so age is calculated, not typed once and
-- left to go stale. The app keeps writing `age` too (age as of each save) and
-- falls back to it for people who never entered a birthday.
--
-- Run once in Supabase → SQL Editor. Safe to re-run. Until it's run the app
-- still works: saves quietly drop birth_date and keep the computed age.

alter table public.user_profiles add column if not exists birth_date date;
