-- État final des vidéos au 10.10.2026, idempotent. À rejouer tel quel dans le
-- SQL Editor Supabase si un doute subsiste : il pose exactement la liste des 12
-- vidéos présentes dans la bibliothèque Bunny 627513 (export bunny-videos.csv).
--
-- Contexte : la migration 20261008000000 (faite depuis le clone périmé du Mac
-- bureau) avait écrasé le mapping du 07.10 (p3_10 Squat au lieu du pyramidal,
-- p3_15 au lieu de p3_16...). Ce fichier remet l'état du 07.10 et supprime
-- p3_0 (« Comprendre la hanche »), dont la vidéo n'existe plus dans Bunny.

delete from public.video_assets
where session_id in ('p3_0', 'p3_10', 'p3_11', 'p3_15', 'p3_16', 'p3_17', 'p3_18', 'p3_20', 'p7_6', 'p7_7');

insert into public.video_assets (session_id, bunny_path) values
  ('p2_0',  '02edcbb8-ca7c-4b58-8e64-719ad457bf92'), -- Le dos expliqué
  ('p2_1',  '7494838a-4ca1-4066-be77-5fff62b0ae1a'), -- Pourquoi le dos souffre
  ('p3_5',  '7cdb02b6-dad1-4619-af2e-c3d7790a49d1'), -- Mobilisation de hanche I
  ('p3_7',  'd88fef23-062d-41b2-8e30-bdaae423abde'), -- Mobilisation de hanche II
  ('p3_10', 'f40ae853-efae-4316-b1f7-fc1857e0ac03'), -- Étirement du pyramidal
  ('p3_11', 'bc784f99-0a0a-4b01-89ca-fad03e72dd8e'), -- Squat conscient I
  ('p3_16', '4f25c4bc-1914-4ea5-8ebd-66d278dded97'), -- Mobilité & Pilates I
  ('p3_17', '9b765dd0-b947-48dc-8b77-371a60c07e18'), -- Profondeur de hanche
  ('p7_5',  '2e58a4cd-5dc1-4f2f-a032-135af9094a06'), -- Le Hundred : initiation
  ('p7_6',  '99e5a072-174c-48e5-a3bb-2a1ea80fca6c'), -- Roll-Up conscient
  ('p7_7',  '40f6eb5f-7976-476e-9fb2-db73f6d7914c'), -- Single Leg Circle
  ('p9_5',  'f8028b90-35cd-4b62-804b-89c9e5ccb2de')  -- Réveil hormonal
on conflict (session_id) do update set bunny_path = excluded.bunny_path;

-- Exécutée en prod le 10.10.2026 12:40 via le SQL Editor (12 lignes OK).
-- Contrôle : 12 lignes attendues.
select session_id, bunny_path from public.video_assets order by session_id;
