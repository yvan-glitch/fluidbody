-- Vidéo « Mobilisation de hanche II » (p3_7, Préparer) : 2026-11-22
insert into public.video_assets (session_id, bunny_path) values
  ('p3_7', '92d638e0-16cf-4942-bb11-22037b1de293')
on conflict (session_id) do update set bunny_path = excluded.bunny_path;
