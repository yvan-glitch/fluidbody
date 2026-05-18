-- referrals: parrainage / affiliation MVP.
--
-- Modèle : chaque profil possède un `referral_code` unique (auto-généré
-- lazy via `ensure_my_referral_code`). À l'inscription, l'utilisateur
-- peut « claim » un code via `claim_referral_code`, qui pose le
-- `referred_by_code` sur son profil. Quand le filleul effectue son
-- premier paiement, le client appelle `credit_referral_on_first_paid`,
-- qui crédite +1 mois à chacun et incrémente `referrals_count` côté
-- parrain. La RPC est idempotente (vérifie `first_paid_subscription_at`).
--
-- Sécurité : toutes les RPC sont `SECURITY DEFINER` mais opèrent
-- uniquement sur le profil de `auth.uid()`. Aucune RPC ne lit ou écrit
-- un autre profil sauf pour résoudre le code parrain (jointure read-only
-- sur `referral_code`, UPDATE limité au compteur du parrain).
--
-- À noter (TODO post-MVP) :
--   - la consommation effective des `free_months_earned` se fera plus tard
--     via un webhook RevenueCat → edge function qui posera des
--     promotional offers (cf. README). Pour l'instant on tient juste le
--     compteur visible côté app pour motiver l'achat.
--   - aucune protection fraude (rate-limit, IP, email check) — modèle
--     organique avec ~100 utilisateurs, à durcir si abus.

alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by_code text,
  add column if not exists referrals_count integer not null default 0,
  add column if not exists free_months_earned integer not null default 0,
  add column if not exists free_months_used integer not null default 0,
  add column if not exists first_paid_subscription_at timestamptz;

create index if not exists idx_profiles_referral_code
  on public.profiles (referral_code);
create index if not exists idx_profiles_referred_by_code
  on public.profiles (referred_by_code);

-- Petit helper expose en read-only : combien de mois gratuits le user a
-- de disponibles maintenant (earned - used, clampe a 0). Utile cote
-- client pour afficher le bandeau bonus sur le paywall.
create or replace function public.profile_free_months_available(p_user_id uuid)
returns integer language sql stable as $$
  select greatest(0, coalesce(free_months_earned, 0) - coalesce(free_months_used, 0))
  from public.profiles
  where id = p_user_id
$$;

-- ensure_my_referral_code : retourne le code du user courant, en le
-- générant la première fois si absent. Idempotent : un user qui a déjà
-- un code récupère le sien sans regénération. Format : `<PRENOM4>-XXXX`
-- (4 lettres du prénom upper, ou USER si prénom indisponible).
create or replace function public.ensure_my_referral_code()
returns text language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing text;
  v_code text;
  v_prenom text;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select referral_code into v_existing
    from public.profiles where id = v_user_id;
  if v_existing is not null then
    return v_existing;
  end if;

  select coalesce(prenom, 'USER') into v_prenom
    from public.profiles where id = v_user_id;
  v_prenom := upper(regexp_replace(left(v_prenom, 4), '[^A-Za-z]', '', 'g'));
  if length(v_prenom) < 2 then
    v_prenom := 'USER';
  end if;

  -- Boucle générer-jusqu'à-unique. Avec 4 chars hex (16^4 = 65k) et
  -- ~100 utilisateurs, collision quasi nulle, mais on prend la garantie.
  loop
    v_code := v_prenom || '-' ||
      upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    exit when not exists (
      select 1 from public.profiles where referral_code = v_code
    );
  end loop;

  update public.profiles
    set referral_code = v_code
    where id = v_user_id;
  return v_code;
end;
$$;

-- claim_referral_code : pose `referred_by_code` sur le profil du user
-- courant. Renvoie un JSON { ok, error?, referrer_code? }. Bloque les
-- doubles claim, l'auto-parrainage et les codes inconnus.
create or replace function public.claim_referral_code(p_code text)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized text := upper(trim(p_code));
  v_referrer_id uuid;
  v_already text;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if v_normalized is null or length(v_normalized) < 4 then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select referred_by_code into v_already
    from public.profiles where id = v_user_id;
  if v_already is not null then
    return jsonb_build_object('ok', false, 'error', 'already_claimed', 'code', v_already);
  end if;

  select id into v_referrer_id
    from public.profiles where referral_code = v_normalized;
  if v_referrer_id is null then
    return jsonb_build_object('ok', false, 'error', 'code_not_found');
  end if;
  if v_referrer_id = v_user_id then
    return jsonb_build_object('ok', false, 'error', 'self_referral');
  end if;

  update public.profiles
    set referred_by_code = v_normalized
    where id = v_user_id;

  return jsonb_build_object('ok', true, 'referrer_code', v_normalized);
end;
$$;

-- credit_referral_on_first_paid : à appeler depuis le client juste après
-- un `Purchases.purchasePackage` réussi. Idempotent — la 2e exécution
-- court-circuite via `first_paid_subscription_at`. Crédite +1 mois au
-- filleul ET au parrain, incrémente `referrals_count` côté parrain.
-- Si pas de referrer, marque simplement `first_paid_subscription_at`.
--
-- Note : ce trigger client est un MVP. Le bon design est un webhook
-- RevenueCat → edge function (server-side, idempotent sur transaction_id),
-- mais ça demande un peu plus de plomberie qu'on tranchera après.
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

  if v_referred_by_code is null then
    update public.profiles
      set first_paid_subscription_at = now()
      where id = v_user_id;
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'no_referrer');
  end if;

  select id into v_referrer_id
    from public.profiles where referral_code = v_referred_by_code;

  if v_referrer_id is null then
    update public.profiles
      set first_paid_subscription_at = now()
      where id = v_user_id;
    return jsonb_build_object('ok', true, 'credited', false, 'reason', 'referrer_gone');
  end if;

  -- Crédit filleul : +1 mois + horodatage du premier paiement.
  update public.profiles set
    free_months_earned = coalesce(free_months_earned, 0) + 1,
    first_paid_subscription_at = now()
    where id = v_user_id;

  -- Crédit parrain : +1 mois et +1 dans referrals_count.
  update public.profiles set
    free_months_earned = coalesce(free_months_earned, 0) + 1,
    referrals_count = coalesce(referrals_count, 0) + 1
    where id = v_referrer_id;

  return jsonb_build_object('ok', true, 'credited', true, 'referrer_id', v_referrer_id);
end;
$$;

grant execute on function public.ensure_my_referral_code() to authenticated;
grant execute on function public.claim_referral_code(text) to authenticated;
grant execute on function public.credit_referral_on_first_paid() to authenticated;
grant execute on function public.profile_free_months_available(uuid) to authenticated;
