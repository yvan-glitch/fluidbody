-- « Tourné à… » (22.11.2026) : lieu de tournage d'une vidéo, lisible par le
-- client. Renseigné par scripts/publier-video.js --lieu "Minorque".
alter table public.video_assets add column if not exists location text;
grant select (session_id, created_at, location) on public.video_assets to anon, authenticated;
