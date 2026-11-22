-- Correction (22.11.2026) : la migration 20261122175612 a lié par erreur la
-- séance p3_7 « Mobilisation de hanche II » à la vidéo de p3_22 « Échauffement »
-- (commande d'exemple lancée telle quelle). On remet la vidéo d'origine de
-- p3_7, celle de l'état final du 10.10.2026.
update public.video_assets
   set bunny_path = 'd88fef23-062d-41b2-8e30-bdaae423abde'
 where session_id = 'p3_7';
