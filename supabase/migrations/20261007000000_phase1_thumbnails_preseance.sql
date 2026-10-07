-- Phase 1 (07.10.2026) : vignettes vidéo par séance + avertissement
-- pré-séance mémorisé côté compte.

-- ---------------------------------------------------------------------------
-- 1. Vignettes : video_assets.thumbnail_time / thumbnail_url
-- ---------------------------------------------------------------------------
-- thumbnail_time : moment (secondes) de la vidéo à utiliser comme vignette.
--   NULL = 30 % de la durée (choix par défaut du script).
-- thumbnail_url  : URL publique (bucket `thumbnails`) écrite par
--   scripts/sync-thumbnails.js. Lisible par le client, comme session_id ;
--   bunny_path (GUID) reste réservé au service role.

alter table public.video_assets
  add column if not exists thumbnail_time numeric,
  add column if not exists thumbnail_url text,
  add column if not exists thumbnail_synced_time numeric;

grant select (session_id, thumbnail_url) on public.video_assets to anon, authenticated;

-- Bucket public : lecture libre via l'URL publique, écriture service role
-- uniquement (aucune policy d'insert pour anon/authenticated).
insert into storage.buckets (id, name, public)
values ('thumbnails', 'thumbnails', true)
on conflict (id) do update set public = true;

-- ---------------------------------------------------------------------------
-- 2. Avertissement « Avant cette séance » : accepté une fois par compte
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists preseance_accepted_at timestamptz,
  add column if not exists preseance_version integer;

-- Le client écrit ces 2 colonnes (cf. lockdown 20260610100000 : privilèges
-- colonne par colonne).
grant insert (preseance_accepted_at, preseance_version) on public.profiles to authenticated;
grant update (preseance_accepted_at, preseance_version) on public.profiles to authenticated;
