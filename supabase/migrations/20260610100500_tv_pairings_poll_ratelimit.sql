-- Rate-limit du poll TV (audit 2026-06-10, M-2 — promis dans le commentaire
-- de tv-pair/index.ts depuis mai mais jamais implémenté).
--
-- La TV polle toutes les 2 s ; on tolère 1 req/s par nonce. Vérification
-- "lazy" côté edge function : si last_poll_at < 1 s, la fonction répond 429
-- sans toucher à la ligne. Freine le brute-force du tv_secret (déjà
-- infaisable à 80 bits, mais defense in depth + le code ne ment plus).

alter table public.tv_pairings
  add column if not exists last_poll_at timestamptz;
