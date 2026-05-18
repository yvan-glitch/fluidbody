// referrals: helpers client pour le système de parrainage (MVP).
//
// Toutes les fonctions encapsulent les RPC Supabase déclarées dans
// `supabase/migrations/20260513000000_referrals.sql`. Elles tolèrent un
// supabase null (mode offline / Expo Go sans env) en renvoyant des
// valeurs sentinelles plutôt qu'en lançant — le caller doit gérer la
// branche « pas de donnée à afficher ».
//
// Cache léger : le code utilisateur lui-même est mis en cache dans
// AsyncStorage (`fluid_my_referral_code`) car il ne change jamais après
// la première génération. Les stats sont fetch-on-demand, sans cache,
// car elles évoluent (le filleul vient de payer = +1 dans la liste).
//
// Le code de parrainage *en attente* (capturé via deep link avant que
// l'utilisateur ait un compte Supabase) est aussi en AsyncStorage sous
// `fluid_pending_referral_code` et consommé par ProfileOnboarding.

import AsyncStorage from '@react-native-async-storage/async-storage';

const MY_CODE_KEY = 'fluid_my_referral_code';
const PENDING_CODE_KEY = 'fluid_pending_referral_code';

// Normalisation côté client identique à celle de la RPC : trim + upper.
// On expose la fonction pour l'écran d'onboarding qui veut afficher le
// code prefillé dans le bon format.
export function normalizeReferralCode(code) {
  if (typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}

// Génère (ou récupère) le code de parrainage du user courant.
// Idempotent côté serveur — appelable plusieurs fois. Cache local après
// le 1er succès.
export async function getMyReferralCode(supabase) {
  try {
    const cached = await AsyncStorage.getItem(MY_CODE_KEY);
    if (cached) return cached;
  } catch (e) {}

  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc('ensure_my_referral_code');
    if (error || !data) return null;
    const code = String(data);
    try { await AsyncStorage.setItem(MY_CODE_KEY, code); } catch (e) {}
    return code;
  } catch (e) {
    return null;
  }
}

// Pose `referred_by_code` sur le profil courant. Renvoie un objet
// { ok, error?, referrer_code? } pour que l'UI puisse afficher un
// feedback précis (code inconnu vs déjà claim vs auto-parrainage).
export async function claimReferralCode(supabase, code) {
  const normalized = normalizeReferralCode(code);
  if (!normalized || normalized.length < 4) {
    return { ok: false, error: 'invalid_code' };
  }
  if (!supabase) return { ok: false, error: 'offline' };
  try {
    const { data, error } = await supabase.rpc('claim_referral_code', { p_code: normalized });
    if (error) return { ok: false, error: 'rpc_error', detail: error.message || String(error) };
    if (!data || typeof data !== 'object') return { ok: false, error: 'bad_response' };
    return data;
  } catch (e) {
    return { ok: false, error: 'rpc_throw', detail: e?.message || String(e) };
  }
}

// À appeler une fois le `Purchases.purchasePackage` validé côté RC.
// Idempotent — la RPC checke `first_paid_subscription_at` et no-op si
// déjà crédité.
export async function creditReferralOnPaid(supabase) {
  if (!supabase) return { ok: false, error: 'offline' };
  try {
    const { data, error } = await supabase.rpc('credit_referral_on_first_paid');
    if (error) return { ok: false, error: 'rpc_error', detail: error.message || String(error) };
    return data || { ok: false, error: 'bad_response' };
  } catch (e) {
    return { ok: false, error: 'rpc_throw', detail: e?.message || String(e) };
  }
}

// Fetch les stats parrainage du user courant. Renvoie un objet stable
// pour que l'UI puisse afficher 0 partout en cas d'échec / offline.
export async function getReferralStats(supabase, userId) {
  const empty = {
    referrals_count: 0,
    free_months_earned: 0,
    free_months_used: 0,
    free_months_available: 0,
    referral_code: null,
    referred_by_code: null,
  };
  if (!supabase || !userId) return empty;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('referral_code, referred_by_code, referrals_count, free_months_earned, free_months_used')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return empty;
    const earned = Number.isFinite(data.free_months_earned) ? data.free_months_earned : 0;
    const used = Number.isFinite(data.free_months_used) ? data.free_months_used : 0;
    return {
      referrals_count: Number.isFinite(data.referrals_count) ? data.referrals_count : 0,
      free_months_earned: earned,
      free_months_used: used,
      free_months_available: Math.max(0, earned - used),
      referral_code: data.referral_code || null,
      referred_by_code: data.referred_by_code || null,
    };
  } catch (e) {
    return empty;
  }
}

// Code en attente — stocké quand un deep link `fluidbody://invite?code=X`
// est ouvert AVANT que l'utilisateur ait une session Supabase. Consommé
// par ProfileOnboarding au prochain mount.
export async function savePendingReferralCode(code) {
  const normalized = normalizeReferralCode(code);
  if (!normalized || normalized.length < 4) return false;
  try {
    await AsyncStorage.setItem(PENDING_CODE_KEY, normalized);
    return true;
  } catch (e) {
    return false;
  }
}

export async function readPendingReferralCode() {
  try {
    return await AsyncStorage.getItem(PENDING_CODE_KEY);
  } catch (e) {
    return null;
  }
}

export async function clearPendingReferralCode() {
  try {
    await AsyncStorage.removeItem(PENDING_CODE_KEY);
  } catch (e) {}
}

// Parse une URL de type `fluidbody://invite?code=XYZ-1234` ou
// `https://fluidbody.app/invite?code=...`. Retourne le code normalisé
// ou null. Permissif sur le path (accepte /invite/, /i/, /r/) — on a
// peu de control sur ce qu'un parrain va coller dans iMessage.
export function parseReferralCodeFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const m = url.match(/[?&]code=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    const code = normalizeReferralCode(decodeURIComponent(m[1]));
    if (code.length < 4) return null;
    return code;
  } catch (e) {
    return null;
  }
}
