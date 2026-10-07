// preSeance — avertissement « Avant cette séance » (Phase 1, 07.10.2026).
//
// Affiché UNE seule fois (1re séance pratique lancée), puis mémorisé :
//   1. en local (AsyncStorage `fluid_preseance_accepted_v`) ;
//   2. dans Supabase (`profiles.preseance_accepted_at` + `preseance_version`)
//      si l'utilisateur est connecté, pour ne pas le réafficher sur un
//      nouvel appareil.
// PRESEANCE_VERSION : à incrémenter si le texte juridique change, ce qui
// réaffiche l'avertissement une fois à tout le monde.

import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';

export const PRESEANCE_VERSION = 1;
const KEY = 'fluid_preseance_accepted_v';
const SERVER_TIMEOUT_MS = 3000;

let acceptedCache = false; // vrai dès qu'on sait que c'est accepté

function withTimeout(p, ms) {
  return Promise.race([
    p,
    new Promise(function (resolve) { setTimeout(function () { resolve(null); }, ms); }),
  ]);
}

async function getUserId() {
  if (!supabase) return null;
  try {
    const res = await withTimeout(supabase.auth.getSession(), SERVER_TIMEOUT_MS);
    const s = res && res.data && res.data.session;
    return s && s.user ? s.user.id : null;
  } catch (e) {
    return null;
  }
}

// Lecture synchrone (après un premier appel async) : évite un flash de la
// modale quand on lance une 2e séance dans la même session.
export function isPreSeanceAcceptedSync() {
  return acceptedCache;
}

export async function isPreSeanceAccepted() {
  if (acceptedCache) return true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw && parseInt(raw, 10) >= PRESEANCE_VERSION) {
      acceptedCache = true;
      return true;
    }
  } catch (e) {}
  // Nouvel appareil : l'acceptation a peut-être été enregistrée côté compte.
  const uid = await getUserId();
  if (!uid) return false;
  try {
    const res = await withTimeout(
      supabase.from('profiles').select('preseance_version').eq('id', uid).maybeSingle(),
      SERVER_TIMEOUT_MS,
    );
    const v = res && !res.error && res.data ? res.data.preseance_version : null;
    if (v != null && v >= PRESEANCE_VERSION) {
      acceptedCache = true;
      try { await AsyncStorage.setItem(KEY, String(v)); } catch (e) {}
      return true;
    }
  } catch (e) {}
  return false;
}

export async function acceptPreSeance() {
  acceptedCache = true;
  try { await AsyncStorage.setItem(KEY, String(PRESEANCE_VERSION)); } catch (e) {}
  const uid = await getUserId();
  if (!uid) return;
  try {
    await withTimeout(
      supabase
        .from('profiles')
        .update({ preseance_accepted_at: new Date().toISOString(), preseance_version: PRESEANCE_VERSION })
        .eq('id', uid),
      SERVER_TIMEOUT_MS,
    );
  } catch (e) {}
}
