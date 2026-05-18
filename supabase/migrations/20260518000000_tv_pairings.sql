-- TV pairing : table éphémère qui sert d'aiguillage entre une Apple TV
-- (sans clavier) et un iPhone déjà loggé. Flux :
--   1. La TV génère un `nonce` (POST /tv-pair { action: init }) — edge
--      function insert ligne (nonce, expires_at = now() + 5 min).
--   2. La TV affiche un QR code qui encode l'URL `…/tv-pair/{nonce}`.
--   3. L'utilisateur scanne le QR depuis l'app iPhone (déjà logguée), qui
--      appelle (POST /tv-pair { action: redeem, nonce, jwt }) — edge
--      function valide le JWT, met `redeemed_user_id` + `access_token` +
--      `refresh_token` sur la ligne.
--   4. La TV poll (POST /tv-pair { action: poll, nonce }) toutes les
--      2 s ; quand la ligne contient des tokens, la TV s'auto-loggue
--      via `supabase.auth.setSession(...)`. La ligne est `consumed_at`
--      et les tokens sont nulled à la première lecture réussie pour
--      empêcher tout rejeu.
--
-- Cette table est uniquement écrite/lue par l'edge function `tv-pair`
-- (service_role). Aucun accès depuis le client RN normal, donc la RLS
-- bloque tout par défaut. Si la flow change un jour pour autoriser un
-- client auth normal à valider lui-même (peu probable), il faudra
-- ajouter explicitement une policy ici.
--
-- Sécurité :
--   - nonce 12 chars alphanum, généré côté edge function avec
--     `crypto.getRandomValues` (96 bits d'entropie).
--   - TTL strict : `expires_at` à now() + 5 min. L'edge function refuse
--     toute action quand `now() > expires_at`.
--   - Tokens éphémères : nulled dès qu'ils sont lus une première fois
--     par la TV (la TV envoie un `tv_secret` retourné au init, sinon
--     n'importe qui ayant le nonce pourrait drainer la session).
--   - Auto-cleanup : index + GC manuel (cron pg_cron facultatif, sinon
--     simple `delete where expires_at < now()` exécuté périodiquement
--     par l'edge function elle-même au début de chaque init).

create table if not exists public.tv_pairings (
  nonce text primary key,
  -- secret connu seulement de la TV qui a initié le pairage. Sert à
  -- empêcher qu'un attaquant ayant intercepté le nonce (ex: photo du
  -- QR code) puisse polling et drainer la session avant la TV
  -- légitime. La TV envoie le secret à chaque poll ; l'edge function
  -- vérifie qu'il matche.
  tv_secret text not null,
  -- horodatages
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- état une fois redeem
  redeemed_user_id uuid references auth.users (id) on delete cascade,
  redeemed_at timestamptz,
  -- tokens transitoires posés par redeem, nulled au premier poll réussi
  access_token text,
  refresh_token text,
  consumed_at timestamptz
);

create index if not exists idx_tv_pairings_expires_at
  on public.tv_pairings (expires_at);

-- RLS : tout est interdit aux anon / authenticated. Seul service_role
-- (utilisé par l'edge function) peut lire et écrire. On active RLS
-- explicitement pour que la table soit refusée par défaut.
alter table public.tv_pairings enable row level security;

-- Pas de policy donnée → toute requête non service_role retourne 0
-- lignes (RLS denies). Documenté ici pour qu'on n'ajoute pas par erreur
-- une policy plus permissive sans réfléchir.

-- Helper purge : à appeler depuis l'edge function pour garder la table
-- petite. Idempotent, retourne le nombre de lignes supprimées.
create or replace function public.purge_expired_tv_pairings()
returns integer language plpgsql security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.tv_pairings
    where expires_at < now() - interval '1 hour'
       or (consumed_at is not null and consumed_at < now() - interval '1 hour');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- service_role exécute, pas besoin de grant pour anon/authenticated.
revoke all on function public.purge_expired_tv_pairings() from public;
grant execute on function public.purge_expired_tv_pairings() to service_role;
