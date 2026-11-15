-- Vidéo « Réveil musculaire avec softball » (pilier Mobilité, Évoluer, index 21) : 2026-11-15
insert into public.video_assets (session_id, bunny_path) values
  ('p3_21', '9cafc827-e101-40dd-ade2-dbf35e018218')
on conflict (session_id) do update set bunny_path = excluded.bunny_path;
