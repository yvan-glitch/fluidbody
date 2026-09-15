insert into video_assets (session_id, bunny_path)
values
  ('p3_5', '7cdb02b6-dad1-4619-af2e-c3d7790a49d1'),
  ('p3_7', 'd88fef23-062d-41b2-8e30-bdaae423abde')
on conflict (session_id) do nothing;
