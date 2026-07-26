-- Audit sécu 26/07 : durcissement de la purge tv_pairings.
--
-- Avant : les lignes expirées n'étaient supprimées qu'à expires_at + 1 h,
-- et si la TV ne pollait jamais (crash, réseau), les access/refresh tokens
-- d'un utilisateur réel restaient EN CLAIR dans la table pendant ce délai
-- (voire plus, la purge n'étant appelée que sporadiquement).
--
-- Après : les tokens sont nullés dès l'expiration (première étape), la
-- suppression physique garde le délai +1 h pour que les polls tardifs
-- reçoivent « expired » plutôt que « unknown-nonce ».

create or replace function public.purge_expired_tv_pairings()
returns integer language plpgsql security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  -- 1. Neutraliser immédiatement les tokens des lignes expirées.
  update public.tv_pairings
     set access_token = null, refresh_token = null
   where expires_at < now()
     and (access_token is not null or refresh_token is not null);

  -- 2. Supprimer les lignes vraiment mortes (délai de grâce 1 h conservé).
  delete from public.tv_pairings
    where expires_at < now() - interval '1 hour'
       or (consumed_at is not null and consumed_at < now() - interval '1 hour');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_tv_pairings() from public;
grant execute on function public.purge_expired_tv_pairings() to service_role;
