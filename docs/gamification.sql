-- ============================================================================
-- GAMIFICATION — lifetime XP per user (level is derived from it in the client).
-- Run once in the Supabase SQL editor.
--
-- Quests are computed on the fly from today's food_logs + targets, so they need
-- no storage and reset at midnight for free. Only the XP total is persisted.
-- Streak already comes from food_logs dates (calculateStreak in the app).
-- ============================================================================

create table if not exists user_gamification (
  user_id    uuid        primary key references auth.users on delete cascade,
  total_xp   integer     not null default 0,
  updated_at timestamptz not null default now()
);

alter table user_gamification enable row level security;

-- Users read + write only their own XP row.
drop policy if exists "own xp" on user_gamification;
create policy "own xp" on user_gamification
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Atomic increment so concurrent logs can't clobber each other's XP.
create or replace function add_xp(amount integer)
returns integer
language plpgsql security definer set search_path = public as $$
declare new_total integer;
begin
  -- Clamp the RESULTING total at 0 (not the delta), so a negative amount from
  -- Undo actually decrements the stored XP instead of being floored to +0 and
  -- silently drifting above what the UI shows.
  insert into user_gamification (user_id, total_xp, updated_at)
  values (auth.uid(), greatest(0, amount), now())
  on conflict (user_id) do update
    set total_xp = greatest(0, user_gamification.total_xp + amount),
        updated_at = now()
  returning total_xp into new_total;
  return new_total;
end; $$;
