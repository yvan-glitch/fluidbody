-- Vidéo « Renforcement complet » (pilier Ménopause, index 10) — 2026-11-01
insert into public.video_assets (session_id, bunny_path) values
  ('p9_10', '0bf81a14-9cb5-49d5-81b2-5227fb3093ab')
on conflict (session_id) do update set bunny_path = excluded.bunny_path;
