-- foods-schema.sql — the new food catalog (see docs/food-database-design.md).
--
-- One row per FOOD (no portion in the name), nutrition per 100 g / 100 ml
-- (or per 1 serving for old custom foods with no known weight), plus portions.
-- Built-in foods have owner_id = null and are shared; a user's own foods are
-- private (owner_id = that user). Built-ins are written only by the service
-- role (Admin → Foods → "Load built-in foods").
--
-- Run once in Supabase → SQL Editor. Safe to re-run. The app keeps working
-- before this is run (it falls back to the bundled food list).

create table if not exists public.foods (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique,                       -- built-ins only, e.g. "chicken-tikka"
  name          text not null,                     -- display name, no portion
  family        text,                              -- browse grouping, e.g. "Biryani"
  category      text,
  aliases       text[] not null default '{}',
  basis         text not null default 'g' check (basis in ('g', 'ml', 'serving')),
  kcal          numeric not null default 0,        -- per 100 g / 100 ml, or per 1 serving
  protein       numeric not null default 0,
  carbs         numeric not null default 0,
  fat           numeric not null default 0,
  fiber         numeric not null default 0,
  owner_id      uuid references auth.users(id) on delete cascade,  -- null = built-in
  source        text not null default 'user' check (source in ('builtin', 'user', 'web', 'barcode', 'ai')),
  barcode       text,
  verified      boolean not null default false,
  status        text not null default 'active' check (status in ('active', 'hidden', 'merged')),
  merged_into   uuid references public.foods(id) on delete set null,
  review_state  text check (review_state in ('kept', 'promoted')),
  legacy_keys   text[] not null default '{}',      -- old names that should resolve to this food
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.food_portions (
  id          uuid primary key default gen_random_uuid(),
  food_id     uuid not null references public.foods(id) on delete cascade,
  label       text not null,                       -- "1 bowl", "1 pc", "100 g"
  amount      numeric not null,                    -- grams (g foods), ml (ml foods) or servings
  is_default  boolean not null default false,
  legacy_key  text,                                -- old full name for this exact portion
  sort        int not null default 0
);

create index if not exists foods_owner_idx on public.foods (owner_id);
create index if not exists foods_updated_idx on public.foods (updated_at desc);
create index if not exists food_portions_food_idx on public.food_portions (food_id);

-- updated_at on change (also bumps the catalog version clients cache against)
create or replace function public.touch_food() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists foods_touch on public.foods;
create trigger foods_touch before update on public.foods for each row execute function public.touch_food();

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.foods enable row level security;
alter table public.food_portions enable row level security;

drop policy if exists "foods readable" on public.foods;
create policy "foods readable" on public.foods for select to authenticated
  using ((owner_id is null and status = 'active') or owner_id = auth.uid());

drop policy if exists "own foods insert" on public.foods;
create policy "own foods insert" on public.foods for insert to authenticated
  with check (owner_id = auth.uid() and source <> 'builtin');

drop policy if exists "own foods update" on public.foods;
create policy "own foods update" on public.foods for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid() and source <> 'builtin');

drop policy if exists "own foods delete" on public.foods;
create policy "own foods delete" on public.foods for delete to authenticated
  using (owner_id = auth.uid());

drop policy if exists "portions readable" on public.food_portions;
create policy "portions readable" on public.food_portions for select to authenticated
  using (exists (select 1 from public.foods f where f.id = food_id
                 and ((f.owner_id is null and f.status = 'active') or f.owner_id = auth.uid())));

drop policy if exists "own portions write" on public.food_portions;
create policy "own portions write" on public.food_portions for all to authenticated
  using (exists (select 1 from public.foods f where f.id = food_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from public.foods f where f.id = food_id and f.owner_id = auth.uid()));

-- ── Logs point at the food (name + macros stay as a snapshot) ───────────────
alter table public.food_logs add column if not exists food_id uuid references public.foods(id) on delete set null;
alter table public.food_logs add column if not exists portion text;   -- "1 bowl"
alter table public.food_logs add column if not exists amount numeric; -- total grams / ml / servings logged
create index if not exists food_logs_food_idx on public.food_logs (food_id);
