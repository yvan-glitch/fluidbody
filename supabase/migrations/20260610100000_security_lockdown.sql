-- Security lockdown (audit 2026-06-10, findings C-1 / C-2 / E-1).
--
-- C-1 : la policy RLS `profiles_update_own` + le GRANT table-level par défaut
--       permettaient à tout utilisateur authentifié de faire
--       `update profiles set is_subscriber = true where id = auth.uid()`
--       → bypass complet du paywall (l'edge function sign-video-url lit ce
--       flag comme 2e niveau d'entitlement, et c'est la SOURCE PRINCIPALE
--       sur tvOS où RevenueCat n'existe pas).
-- C-2 : idem pour les colonnes de parrainage (free_days_earned…) +
--       `credit_referral_on_first_paid()` appelable par `authenticated`
--       sans aucune preuve de paiement.
-- E-1 : `delete_my_account()` référençait `tv_pairings.user_id` (colonne
--       inexistante) → exception → suppression de compte cassée (Apple
--       guideline 5.1.1(v)).
--
-- Stratégie :
--   1. REVOKE INSERT/UPDATE table-level sur profiles pour anon+authenticated,
--      puis GRANT colonne par colonne uniquement sur ce que le client écrit
--      légitimement (cf. src/utils/profileSync.js ASYNC_KEYS + upserts App.js
--      / Profil.js : prenom, lang, tension_idxs, données d'onboarding, rings).
--      Les colonnes d'entitlement (is_subscriber, subscription_expires_at,
--      rc_app_user_id) et de parrainage (referral_code, referred_by_code,
--      referrals_count, free_days_*, free_months_*, first_paid_subscription_at)
--      deviennent inaccessibles en écriture directe — elles ne sont écrites
--      que par les fonctions SECURITY DEFINER (claim_referral_code,
--      ensure_my_referral_code) ou par le service_role (edge function
--      confirm-purchase).
--      NB : les policies RLS existantes restent inchangées — les privilèges
--      colonne s'appliquent EN PLUS de la RLS.
--   2. `credit_referral_on_first_paid` n'est plus exécutable que par
--      service_role, avec un paramètre p_user explicite : elle est désormais
--      appelée par l'edge function `confirm-purchase` APRÈS vérification du
--      paiement via l'API RevenueCat (clé secrète server-side).
--   3. `delete_my_account` : fix du one-liner tv_pairings.

-- ---------------------------------------------------------------------------
-- 1. Privilèges colonne sur public.profiles
-- ---------------------------------------------------------------------------

revoke insert, update on table public.profiles from anon, authenticated;

-- Colonnes que le client a le droit d'insérer (création de sa ligne via
-- upsert : id + données de profil).
grant insert (
  id, prenom, lang, tension_idxs,
  gender, birth_date, height_cm, weight_kg,
  practice_level, goals, frequency,
  onboarding_completed, onboarding_completed_at,
  ring_goal_move_kcal, ring_goal_exercise_min, ring_goal_stand_hours,
  rings_streak_count, rings_streak_last_date,
  updated_at
) on public.profiles to authenticated;

-- Colonnes que le client a le droit de mettre à jour. `id` DOIT figurer dans
-- la liste : l'upsert PostgREST génère `ON CONFLICT (id) DO UPDATE SET id =
-- EXCLUDED.id, ...` — sans le privilège UPDATE(id), TOUS les upserts profiles
-- existants échoueraient en 42501. Sans risque : la policy RLS
-- `with check (auth.uid() = id)` interdit de toute façon de changer l'id.
grant update (
  id, prenom, lang, tension_idxs,
  gender, birth_date, height_cm, weight_kg,
  practice_level, goals, frequency,
  onboarding_completed, onboarding_completed_at,
  ring_goal_move_kcal, ring_goal_exercise_min, ring_goal_stand_hours,
  rings_streak_count, rings_streak_last_date,
  updated_at
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. credit_referral_on_first_paid → service_role only, paiement vérifié
--    en amont par l'edge function confirm-purchase (API RevenueCat).
-- ---------------------------------------------------------------------------

-- L'ancienne signature zéro-argument doit être droppée explicitement :
-- un `create or replace` avec un nouveau paramètre créerait une SURCHARGE
-- et laisserait l'ancienne fonction appelable par authenticated.
drop function if exists public.credit_referral_on_first_paid();

create or replace function public.credit_referral_on_first_paid(p_user uuid)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_referred_by_code text;
  v_referrer_id uuid;
  v_already_credited timestamptz;
begin
  if p_user is null then
    raise exception 'missing p_user';
  end if;

  select first_paid_subscription_at, referred_by_code
    into v_already_credited, v_referred_by_code
    from public.profiles where id = p_user;

  if v_already_credited is not null then
    return jsonb_build_object('ok', false, 'error', 'already_credited');
  end if;

  -- On marque toujours le premier paiement (anti double-crédit).
  update public.profiles
    set first_paid_subscription_at = now()
    where id = p_user;

  if v_referred_by_code is null then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'no_referrer');
  end if;

  select id into v_referrer_id
    from public.profiles where referral_code = v_referred_by_code;
  if v_referrer_id is null then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'referrer_gone');
  end if;

  -- Crédit PARRAIN UNIQUEMENT : +7 jours + compteur de parrainages.
  update public.profiles set
    free_days_earned = coalesce(free_days_earned, 0) + 7,
    referrals_count = coalesce(referrals_count, 0) + 1
    where id = v_referrer_id;

  return jsonb_build_object('ok', true, 'credited', true, 'referrer_id', v_referrer_id);
end;
$$;

revoke execute on function public.credit_referral_on_first_paid(uuid) from public;
revoke execute on function public.credit_referral_on_first_paid(uuid) from anon;
revoke execute on function public.credit_referral_on_first_paid(uuid) from authenticated;
grant  execute on function public.credit_referral_on_first_paid(uuid) to service_role;

comment on function public.credit_referral_on_first_paid(uuid) is
  'Crédite +7 jours au parrain après un PREMIER paiement vérifié. Appelable uniquement par service_role (edge function confirm-purchase qui vérifie l''entitlement via l''API RevenueCat). Idempotent via first_paid_subscription_at.';

-- ---------------------------------------------------------------------------
-- 3. delete_my_account : fix tv_pairings (user_id n'existe pas)
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted_progression integer := 0;
  v_deleted_programs    integer := 0;
  v_deleted_favorites   integer := 0;
  v_deleted_pairings    integer := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  if to_regclass('public.progression') is not null then
    execute 'delete from public.progression where user_id = $1' using v_user_id;
    get diagnostics v_deleted_progression = row_count;
  end if;

  if to_regclass('public.user_programs') is not null then
    execute 'delete from public.user_programs where user_id = $1' using v_user_id;
    get diagnostics v_deleted_programs = row_count;
  end if;

  if to_regclass('public.user_favorites') is not null then
    execute 'delete from public.user_favorites where user_id = $1' using v_user_id;
    get diagnostics v_deleted_favorites = row_count;
  end if;

  -- FIX 2026-06-10 : la table tv_pairings n'a PAS de colonne user_id
  -- (seulement redeemed_user_id) — l'ancienne requête levait
  -- `column "user_id" does not exist` et cassait toute la suppression
  -- de compte (Apple 5.1.1(v)).
  if to_regclass('public.tv_pairings') is not null then
    execute 'delete from public.tv_pairings where redeemed_user_id = $1' using v_user_id;
    get diagnostics v_deleted_pairings = row_count;
  end if;

  delete from public.profiles where id = v_user_id;

  delete from auth.users where id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'deleted', jsonb_build_object(
      'progression', v_deleted_progression,
      'programs',    v_deleted_programs,
      'favorites',   v_deleted_favorites,
      'tv_pairings', v_deleted_pairings
    )
  );
end;
$$;

revoke execute on function public.delete_my_account() from public;
revoke execute on function public.delete_my_account() from anon;
grant  execute on function public.delete_my_account() to authenticated;
