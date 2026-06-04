-- Parrainage recalibré (2026-06-05) : passe de « +1 mois à CHACUN » à
-- « +7 JOURS, AU PARRAIN UNIQUEMENT » (celui qui partage son code et fait la
-- pub). Le filleul ne reçoit plus de mois gratuit — il garde la séance 1
-- gratuite + le paywall normal. Décision produit : l'ancien modèle était bien
-- trop généreux (2 mois offerts par parrainage).
--
-- Compteur en JOURS désormais (free_days_*). Les anciennes colonnes
-- free_months_* sont laissées en place (non utilisées) pour ne rien casser
-- côté historique ; on pourra les drop plus tard.

alter table public.profiles
  add column if not exists free_days_earned integer not null default 0,
  add column if not exists free_days_used integer not null default 0;

-- Helper read-only : jours gratuits disponibles (earned - used, clampé à 0).
create or replace function public.profile_free_days_available(p_user_id uuid)
returns integer language sql stable as $$
  select greatest(0, coalesce(free_days_earned, 0) - coalesce(free_days_used, 0))
  from public.profiles
  where id = p_user_id
$$;

-- credit_referral_on_first_paid : à appeler après un premier paiement validé.
-- Idempotent via first_paid_subscription_at. Crédite +7 JOURS au PARRAIN
-- uniquement (+1 referrals_count). Le filleul n'est PAS crédité.
create or replace function public.credit_referral_on_first_paid()
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_referred_by_code text;
  v_referrer_id uuid;
  v_already_credited timestamptz;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select first_paid_subscription_at, referred_by_code
    into v_already_credited, v_referred_by_code
    from public.profiles where id = v_user_id;

  if v_already_credited is not null then
    return jsonb_build_object('ok', false, 'error', 'already_credited');
  end if;

  -- On marque toujours le premier paiement (anti double-crédit).
  update public.profiles
    set first_paid_subscription_at = now()
    where id = v_user_id;

  if v_referred_by_code is null then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'no_referrer');
  end if;

  select id into v_referrer_id
    from public.profiles where referral_code = v_referred_by_code;
  if v_referrer_id is null then
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'referrer_gone');
  end if;

  -- Crédit PARRAIN UNIQUEMENT : +7 jours + compteur de parrainages.
  -- (Le filleul ne reçoit aucun crédit.)
  update public.profiles set
    free_days_earned = coalesce(free_days_earned, 0) + 7,
    referrals_count = coalesce(referrals_count, 0) + 1
    where id = v_referrer_id;

  return jsonb_build_object('ok', true, 'credited', true, 'referrer_id', v_referrer_id);
end;
$$;

grant execute on function public.profile_free_days_available(uuid) to authenticated;
