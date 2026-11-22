-- Rangée « Nouveautés » (22.11.2026) : le client lit aussi la date de
-- publication d'une vidéo. Le GUID Bunny (bunny_path) reste réservé au
-- service role.
grant select (session_id, created_at) on public.video_assets to anon, authenticated;
