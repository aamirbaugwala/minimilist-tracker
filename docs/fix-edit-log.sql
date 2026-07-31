-- ============================================================================
-- FIX: editing a logged food's quantity (e.g. 2 → 2.5 boiled eggs) didn't save.
-- Two possible causes, both fixed here. Run once in the Supabase SQL editor.
-- ============================================================================

-- 1) Quantities can be fractional (half an egg, 2.5 rotis, 0.5 servings), but if
--    food_logs.qty is an INTEGER column the value 2.5 is rejected. Make it
--    numeric. Safe + idempotent: integers convert cleanly and re-running is a
--    no-op if it's already numeric.
alter table food_logs alter column qty type numeric using qty::numeric;

-- 2) In-app editing issues an UPDATE. If the table's row-level-security policy
--    predates that feature it may only permit insert/select/delete, so an
--    UPDATE returns no error but changes ZERO rows — a silent no-op. Ensure an
--    owner-scoped UPDATE policy exists (additive; won't clash with a broader
--    "for all" policy if one is already present).
drop policy if exists "own food_logs update" on food_logs;
create policy "own food_logs update" on food_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
