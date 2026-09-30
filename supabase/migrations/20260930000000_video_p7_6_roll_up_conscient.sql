-- Vidéo « Roll-Up conscient » (p7_6, Mat Pilates). Insert déjà exécuté en prod via SQL Editor le 30.09.2026.
insert into video_assets (session_id, bunny_path)
values ('p7_6', '99e5a072-174c-48e5-a3bb-2a1ea80fca6c')
on conflict do nothing;
