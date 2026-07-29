-- ============================================================================
-- MEAL BIFURCATION — file each food log under a meal the user picks at log time
-- (Breakfast / Lunch / Snacks / Dinner). The client groups the day's timeline
-- by this column; older rows with a null meal fall back to their time-of-day
-- bucket, so this is backward compatible.
--
-- Run once in the Supabase SQL editor. REQUIRED — until this column exists the
-- app sends `meal` on every food insert and those inserts will be rejected.
-- ============================================================================

alter table food_logs add column if not exists meal text;
