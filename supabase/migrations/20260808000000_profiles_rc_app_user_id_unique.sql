-- Unicité de profiles.rc_app_user_id (audit 2026-08-08, findings F3/F6/F7/F8).
--
-- confirm-purchase liait un rc_app_user_id à un profil via un pré-check
-- read-then-write NON atomique : deux requêtes concurrentes pouvaient toutes
-- deux passer le SELECT « déjà lié ? » puis écrire le même id sur deux profils
-- (TOCTOU). Sans contrainte d'unicité en base, l'invariant « un rc_app_user_id
-- ↔ un seul profil » n'était garanti par RIEN au niveau du stockage.
--
-- On pose donc un index UNIQUE partiel (les NULL n'entrent pas dans l'index :
-- les profils sans achat ne se gênent pas), et on retire l'index non-unique
-- redondant `profiles_rc_app_user_id_idx` (le nouvel index unique sert aussi
-- de couverture pour les lookups). confirm-purchase peut alors faire un upsert
-- atomique et laisser Postgres refuser (23505) toute seconde liaison.
--
-- Garde-fou : s'il existe DÉJÀ des doublons en base (état antérieur au bug),
-- la création de l'index unique échouerait avec un message peu lisible. On
-- lève donc une exception explicite AVANT, pour que l'exploitant les résolve
-- manuellement (déliage support) plutôt que de voir la migration planter.

do $$
declare
  dup_count integer;
begin
  select count(*) into dup_count
  from (
    select rc_app_user_id
    from public.profiles
    where rc_app_user_id is not null
    group by rc_app_user_id
    having count(*) > 1
  ) as dups;

  if dup_count > 0 then
    raise exception
      'Impossible de poser l''index unique : % rc_app_user_id en double dans profiles. Résoudre les liaisons dupliquées (déliage support) avant de rejouer cette migration.',
      dup_count;
  end if;
end $$;

drop index if exists public.profiles_rc_app_user_id_idx;

create unique index if not exists profiles_rc_app_user_id_key
  on public.profiles (rc_app_user_id)
  where rc_app_user_id is not null;
