-- ============================================================================
-- MEDICAL REPORT VAULT
-- Store the ORIGINAL uploaded PDF alongside its extracted markers, so the
-- Medical Reports page becomes a private vault of every report in one place.
-- Run once in the Supabase SQL editor.
-- ============================================================================

-- 1) Track where the original file lives + its size, on each report row.
alter table medical_reports add column if not exists file_path text;
alter table medical_reports add column if not exists file_size bigint;

-- 2) Private bucket to hold the PDFs (not publicly readable — access is only
--    ever via short-lived signed URLs generated server-side for the owner).
insert into storage.buckets (id, name, public)
values ('medical-reports', 'medical-reports', false)
on conflict (id) do nothing;

-- 3) RLS on the objects: a user may only touch files under their own
--    "<user_id>/..." folder. foldername(name)[1] is the first path segment.
drop policy if exists "own medical files insert" on storage.objects;
create policy "own medical files insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'medical-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own medical files select" on storage.objects;
create policy "own medical files select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own medical files delete" on storage.objects;
create policy "own medical files delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'medical-reports'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
