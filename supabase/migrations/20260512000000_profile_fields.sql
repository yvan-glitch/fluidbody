-- profile_fields: client-data columns collected during the new multi-step
-- onboarding (genre, DOB, mensurations, niveau, objectifs, fréquence) plus
-- closed-rings streak tracking and onboarding completion flags.
--
-- Constraints + RLS:
--   - `gender` is a controlled set ('female' | 'male' | 'nonbinary' | 'undisclosed').
--   - `practice_level` ('beginner' | 'intermediate' | 'advanced').
--   - `frequency` ('1-2' | '3-4' | '5+').
--   - `goals` is a text[] with a row-level check (max 2 entries) and an
--     application-level allowlist enforced by the client.
--   - SELECT + UPDATE policies restrict each profile row to its owner
--     (`auth.uid() = id`). INSERT is allowed for own row only.

alter table public.profiles
  add column if not exists gender text,
  add column if not exists birth_date date,
  add column if not exists height_cm smallint,
  add column if not exists weight_kg numeric(5,2),
  add column if not exists practice_level text,
  add column if not exists goals text[] default '{}'::text[],
  add column if not exists frequency text,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists ring_goal_move_kcal smallint default 350,
  add column if not exists ring_goal_exercise_min smallint default 30,
  add column if not exists ring_goal_stand_hours smallint default 12,
  add column if not exists rings_streak_count integer not null default 0,
  add column if not exists rings_streak_last_date date;

-- Drop any pre-existing CHECK so this migration is idempotent across reruns.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_gender_check') then
    alter table public.profiles drop constraint profiles_gender_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'profiles_practice_level_check') then
    alter table public.profiles drop constraint profiles_practice_level_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'profiles_frequency_check') then
    alter table public.profiles drop constraint profiles_frequency_check;
  end if;
  if exists (select 1 from pg_constraint where conname = 'profiles_goals_max_check') then
    alter table public.profiles drop constraint profiles_goals_max_check;
  end if;
end $$;

alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender in ('female','male','nonbinary','undisclosed')),
  add constraint profiles_practice_level_check
  check (practice_level is null or practice_level in ('beginner','intermediate','advanced')),
  add constraint profiles_frequency_check
  check (frequency is null or frequency in ('1-2','3-4','5+')),
  add constraint profiles_goals_max_check
  check (goals is null or array_length(goals, 1) is null or array_length(goals, 1) <= 2);

-- Enable RLS (no-op if already enabled).
alter table public.profiles enable row level security;

-- Drop the policies if they exist, then recreate. `create policy if not exists`
-- is not supported in older Postgres, so this is the portable form.
do $$
begin
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own') then
    drop policy profiles_select_own on public.profiles;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_own') then
    drop policy profiles_insert_own on public.profiles;
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own') then
    drop policy profiles_update_own on public.profiles;
  end if;
end $$;

create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

create policy profiles_insert_own
  on public.profiles for insert
  with check (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Helpful index for streak queries (rare, but cheap).
create index if not exists profiles_rings_streak_last_date_idx
  on public.profiles (rings_streak_last_date);
