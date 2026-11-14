-- Vidéo « Le matériel » (information, hors piliers) : 2026-11-14
-- Id `materiel_0` : l'index 0 la rend gratuite pour tout compte connecté
-- (règle « index 0 gratuit » de sign-video-url). Carte : src/components/MaterielCard.js
insert into public.video_assets (session_id, bunny_path) values
  ('materiel_0', '6fe065b9-f14a-4e03-b59d-9825e8b67dbd')
on conflict (session_id) do update set bunny_path = excluded.bunny_path;
