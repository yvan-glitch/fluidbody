-- audio_rituals : table miroir de video_assets pour les rituels audio courts
-- (v1.2 feature). Pourquoi pas une table unifiée avec un type column ?
--   - Les politiques RLS/sign URL diffèrent un peu (audio peut être plus
--     ouvert, ex: gratuit aux non-abonnés en preview).
--   - Permet de retirer/ajouter sans toucher au video_assets prod.
--   - Plus simple à requêter ("SELECT * FROM audio_assets").
--
-- Sécurité : même flow que video_assets — l'edge function sign-audio-url
-- (à créer) vérifie le JWT + entitlement RC, mint une URL Bunny avec
-- Token Authentication TTL 30 min. Pas de URL brute exposée côté client.

create table if not exists public.audio_assets (
  -- session_id format : "${categoryKey}_${index}", ex: "respiration_0"
  -- Mirror naming convention de video_assets.
  session_id text primary key,

  -- Path Bunny CDN, sans bucket prefix.
  -- Ex: "audio/respiration_0/coherence-cardiaque-5min.mp3"
  bunny_path text not null,

  -- Suffix pour disambiguation (audio principal vs subtitles si applicable).
  kind text not null default 'audio' check (kind in ('audio', 'subtitles')),

  -- Métadonnées pour stats / cleanup. Pas obligatoire pour le sign flow.
  duration_seconds integer,
  language text default 'fr',

  -- Premium gate. true = nécessite abonnement actif. false = preview gratuite
  -- (utilisable comme "tease" pour attirer des conversions).
  is_premium boolean not null default true,

  -- Horodatages standards.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index pour lookups par catégorie (extraite du session_id).
create index if not exists idx_audio_assets_session_id
  on public.audio_assets (session_id);

-- RLS : par défaut, tout est interdit. Seul service_role (edge function)
-- peut lire pour signer les URLs. Aucun accès client direct à la table.
alter table public.audio_assets enable row level security;

-- Trigger update_at pour suivre les modifs (utile pour cache invalidation).
create or replace function public.touch_audio_assets_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_audio_assets_updated_at on public.audio_assets;
create trigger trg_audio_assets_updated_at
  before update on public.audio_assets
  for each row execute function public.touch_audio_assets_updated_at();

-- Seed placeholder rows for the 17 planned rituals (RITUALS_FR in
-- src/constants/audioRituals.js). bunny_path est null pour l'instant,
-- l'edge function retournera "not-ready" jusqu'à ce que Sabrina enregistre
-- et qu'on remplisse bunny_path.
--
-- L'app cliente peut donc déjà afficher les rituels dans l'UI (titres,
-- durées) avec un badge "Bientôt" tant que bunny_path is null.
--
-- Commenté pour l'instant — décommenter quand Sabrina commence à
-- enregistrer et qu'on a au moins 1 fichier sur Bunny.
/*
insert into public.audio_assets (session_id, bunny_path, duration_seconds, is_premium) values
  ('respiration_0', null, 300, true),
  ('respiration_1', null, 210, true),
  ('respiration_2', null, 255, true),
  ('respiration_3', null, 360, true),
  ('reveil_0', null, 180, false),       -- preview gratuite (gateway)
  ('reveil_1', null, 330, true),
  ('reveil_2', null, 240, true),
  ('pause_0', null, 180, false),        -- preview gratuite
  ('pause_1', null, 150, true),
  ('pause_2', null, 105, true),
  ('endormissement_0', null, 480, true),
  ('endormissement_1', null, 600, true),
  ('endormissement_2', null, 450, true),
  ('meditation_0', null, 300, false),   -- preview gratuite
  ('meditation_1', null, 240, true),
  ('meditation_2', null, 480, true)
on conflict (session_id) do nothing;
*/

-- À déployer avec : npx supabase db push
-- Puis créer l'edge function sign-audio-url (mirror de sign-video-url).
