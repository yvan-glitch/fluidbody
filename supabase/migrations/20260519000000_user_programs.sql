-- user_programs: stocke les programmes algorithmiques générés pour chaque
-- utilisateur (durée 1-12 semaines, fréquence ajustable, objectifs choisis).
--
-- Modèle :
--   - `schedule` est le plan généré (tableau JSON immuable) :
--       [{ "week": 1, "day": 1, "pilier_key": "p2", "session_index": 0,
--          "etape": "Comprendre", "type": "guided" | "recovery" }, ...]
--   - `progress` trace l'avancement par slot :
--       { "1-1": "done", "1-2": "skipped", "2-1": "done", ... }
--     Clé = `${week}-${day}`. On garde un JSONB plat plutôt qu'une table
--     enfant — ~30 entrées par programme max, lecture/update atomique côté
--     client, pas besoin de jointure.
--   - `started_at` est nullable : un programme peut être créé puis démarré
--     plus tard. `completed_at` est posé quand tout le progress est "done"
--     (calculé côté client puis écrit).
--
-- Sécurité : RLS standard "auth.uid() = user_id" pour SELECT/INSERT/UPDATE/
-- DELETE. Pas de RPC ; le client gère les writes directement via le SDK.
--
-- Pas d'index supplémentaire pour l'instant : la requête principale est
-- "programmes de l'user courant" qui passe déjà par la clé primaire +
-- user_id (indexé via la FK). Avec ~100 utilisateurs et <10 programmes
-- chacun, un scan filtré reste trivial.

create table if not exists public.user_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  goal text,
  duration_weeks integer not null default 4 check (duration_weeks between 1 and 12),
  sessions_per_week integer not null default 3 check (sessions_per_week between 1 and 7),
  difficulty text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  generated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  schedule jsonb not null,
  progress jsonb not null default '{}'::jsonb
);

create index if not exists idx_user_programs_user_id
  on public.user_programs (user_id, generated_at desc);

alter table public.user_programs enable row level security;

-- Une seule policy "ALL" couvre tous les verbs : un user ne voit/écrit que
-- ses propres programmes. Pas de cas où l'admin ou un autre user doit
-- lire ces données — si ça change, ajouter une policy ciblée.
drop policy if exists "users manage own programs" on public.user_programs;
create policy "users manage own programs"
  on public.user_programs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.user_programs to authenticated;
