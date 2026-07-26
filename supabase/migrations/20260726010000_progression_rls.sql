-- Audit sécu 26/07 : la table `progression` (done par pilier, upsert depuis
-- App.js) a été créée à la main dans le dashboard, sans migration dans le
-- repo, donc sans garantie RLS versionnée. Sans RLS, le GRANT par défaut de
-- Supabase donne ALL à `authenticated` : tout utilisateur connecté pourrait
-- lire ou écraser l'historique de séances de n'importe qui.
--
-- Idempotent : le create ne fait rien si la table existe déjà en prod ;
-- enable RLS + policy own-only s'appliquent dans tous les cas.

create table if not exists public.progression (
  user_id uuid primary key references auth.users(id) on delete cascade,
  done jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.progression enable row level security;

drop policy if exists progression_own on public.progression;
create policy progression_own on public.progression
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
