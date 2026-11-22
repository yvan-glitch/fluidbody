-- Vidéo « Équilibre statique I » (pilier Golf, Préparer, index 5) : 2026-11-22
insert into public.video_assets (session_id, bunny_path) values
  ('p6_5', '8fadde90-5df2-4895-91c0-2eefd4f376dc')
on conflict (session_id) do update set bunny_path = excluded.bunny_path;
