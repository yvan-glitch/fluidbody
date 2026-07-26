-- Le client doit pouvoir lister quelles séances ont une vidéo pour masquer
-- le reste du catalogue (src/utils/catalogVisibility.js). On expose UNIQUEMENT
-- la colonne session_id : le GUID Bunny (bunny_path) reste réservé au
-- service role via l'edge function sign-video-url.
--
-- Mécanique : policy RLS de lecture pour tous + grant limité à la colonne.
-- Un `select('session_id')` passe ; un `select('bunny_path')` ou `select('*')`
-- échoue avec "permission denied for column".

drop policy if exists "video_assets_list_session_ids" on public.video_assets;
create policy "video_assets_list_session_ids"
  on public.video_assets
  for select
  to anon, authenticated
  using (true);

revoke select on public.video_assets from anon, authenticated;
grant select (session_id) on public.video_assets to anon, authenticated;
