-- Relie les vidéos Bunny (bibliothèque 627513) aux séances de l'app.
-- session_id = '<pilier>_<index de la séance dans data.js>'.
insert into public.video_assets (session_id, bunny_path) values
  ('p3_5',  '7cdb02b6-dad1-4619-af2e-c3d7790a49d1'), -- Mobilisation de hanche I
  ('p3_7',  'd88fef23-062d-41b2-8e30-bdaae423abde'), -- Mobilisation de hanche II
  ('p3_10', 'bc784f99-0a0a-4b01-89ca-fad03e72dd8e'), -- Squat conscient
  ('p3_15', '4f25c4bc-1914-4ea5-8ebd-66d278dded97'), -- Mobilité & Pilates I
  ('p3_16', '9b765dd0-b947-48dc-8b77-371a60c07e18'), -- Profondeur de hanche
  ('p7_5',  '2e58a4cd-5dc1-4f2f-a032-135af9094a06'), -- Hundred : Initiation
  ('p7_6',  '99e5a072-174c-48e5-a3bb-2a1ea80fca6c'), -- Roll up Conscient
  ('p7_7',  '40f6eb5f-7976-476e-9fb2-db73f6d7914c')  -- Single Leg Circle
on conflict (session_id) do update set bunny_path = excluded.bunny_path;

-- « Comprendre la hanche » pointait vers une vidéo qui n'existe plus dans Bunny.
delete from public.video_assets where session_id = 'p3_0';

-- Contrôle : doit lister 10 lignes.
select session_id, bunny_path from public.video_assets order by session_id;
