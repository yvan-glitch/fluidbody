-- Vidéo « Énergie & vitalité » (pilier Ménopause, index 12) — 2026-11-01
insert into public.video_assets (session_id, bunny_path) values
  ('p9_12', '68e737d4-e18f-45c2-b8b9-321268ff0212')
on conflict (session_id) do update set bunny_path = excluded.bunny_path;
