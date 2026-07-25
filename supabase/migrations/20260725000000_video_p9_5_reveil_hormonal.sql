-- Vidéo « Réveil hormonal » (pilier Ménopause, séance 6) — 2026-07-25
insert into public.video_assets (session_id, bunny_path) values
  ('p9_5', 'f8028b90-35cd-4b62-804b-89c9e5ccb2de')
on conflict (session_id) do update set bunny_path = excluded.bunny_path;
