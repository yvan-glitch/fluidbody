-- video_security: protect premium video URLs behind a signing edge function.
--
-- `video_assets` maps the client-side session id (e.g. 'p2_0') to the Bunny
-- video GUID. Only the edge function (service-role) reads it.
--
-- `profiles` gains a cached subscription flag fed by the RevenueCat webhook,
-- and an optional `rc_app_user_id` so the edge function can fall back to a
-- live RC lookup when the cache is stale or missing.

create table if not exists public.video_assets (
  session_id text primary key,
  bunny_path text not null,
  created_at timestamptz not null default now()
);

alter table public.video_assets enable row level security;
-- Intentionally no policies: only the service role (edge function) reads.

alter table public.profiles
  add column if not exists is_subscriber boolean not null default false,
  add column if not exists rc_app_user_id text,
  add column if not exists subscription_expires_at timestamptz;

create index if not exists profiles_rc_app_user_id_idx
  on public.profiles (rc_app_user_id);

-- Seed the three videos that were previously hot-linkable in the bundled JS.
insert into public.video_assets (session_id, bunny_path) values
  ('p2_0', '02edcbb8-ca7c-4b58-8e64-719ad457bf92'),
  ('p2_1', '7494838a-4ca1-4066-be77-5fff62b0ae1a'),
  ('p3_0', '596e732b-fa75-4606-aa8a-45fb034d2e0b')
on conflict (session_id) do nothing;
