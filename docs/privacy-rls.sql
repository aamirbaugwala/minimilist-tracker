-- privacy-rls.sql — close the open read on user_profiles.
--
-- Before: policy "Public profiles are viewable by everyone" let ANY signed-in
-- user read EVERY profile (email, weight, health conditions, allergies,
-- activity_sync_token).
-- After: you can read your own profile, plus the profile of anyone you have a
-- friendship row with (pending or accepted) — exactly what Social needs to
-- show requests and score friends. Friend invites keep working: the
-- send_friend_request() RPC is SECURITY DEFINER and looks people up in
-- auth.users, not through this policy. Server code using the service role
-- (cron, Coach, account export/delete) is unaffected.
--
-- Run once in Supabase → SQL Editor. Safe to re-run.

drop policy if exists "Public profiles are viewable by everyone" on public.user_profiles;
drop policy if exists "Profiles visible to self and friends" on public.user_profiles;

create policy "Profiles visible to self and friends"
  on public.user_profiles
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships f
      where (f.user_id = auth.uid() and f.friend_id = user_profiles.user_id)
         or (f.friend_id = auth.uid() and f.user_id = user_profiles.user_id)
    )
  );
