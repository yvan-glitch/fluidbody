-- Remise en ordre des vidéos Mobilité (p3) et Mat (p7), 07.10.2026.
--
-- Contexte : les migrations de septembre ont été en partie appliquées à la
-- main, avec deux fichiers au même numéro de version, une migration de
-- réordonnancement (reorder_p3_pyramidal) non rejouable, et la vidéo
-- « Mobilité & Pilates I » insérée en p3_15 alors que data.js la place en
-- p3_16. Cette migration pose l'état final attendu, quel que soit l'état de
-- départ (idempotente) :
--   p3_10 Étirement du pyramidal   p3_11 Squat conscient I
--   p3_16 Mobilité & Pilates I     p3_17 Profondeur de hanche
--   p7_6  Roll-Up conscient        p7_7  Single Leg Circle


delete from public.video_assets
where session_id in ('p3_10', 'p3_11', 'p3_15', 'p3_16', 'p3_17', 'p3_20', 'p7_6', 'p7_7');

insert into public.video_assets (session_id, bunny_path) values
  ('p3_10', 'f40ae853-efae-4316-b1f7-fc1857e0ac03'),
  ('p3_11', 'bc784f99-0a0a-4b01-89ca-fad03e72dd8e'),
  ('p3_16', '4f25c4bc-1914-4ea5-8ebd-66d278dded97'),
  ('p3_17', '9b765dd0-b947-48dc-8b77-371a60c07e18'),
  ('p7_6',  '99e5a072-174c-48e5-a3bb-2a1ea80fca6c'),
  ('p7_7',  '40f6eb5f-7976-476e-9fb2-db73f6d7914c');

