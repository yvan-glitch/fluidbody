// profileSync — single funnel for writing profile data.
//
// Goals:
//   • Always update AsyncStorage immediately (UI feels instant, offline-safe).
//   • Try to upsert to Supabase next; if it fails, queue the pending columns
//     and re-attempt on the next call or at next app start via
//     `flushPendingProfileSync()`.
//   • Mirror physical metrics (weight, height) into HealthKit when supported.
//   • Capture repeated remote failures to Sentry so we know about silent
//     desync in TestFlight / prod.
//
// Shape of a write `patch` (all keys optional):
//   {
//     prenom, gender, birth_date, height_cm, weight_kg,
//     practice_level, goals, frequency, lang, tension_idxs,
//     onboarding_completed, onboarding_completed_at,
//     ring_goal_move_kcal, ring_goal_exercise_min, ring_goal_stand_hours,
//     rings_streak_count, rings_streak_last_date,
//   }

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import supabase from '../lib/supabase';
import {
  ensureHealthKitInit,
  writeWeightKg,
  writeHeightCm,
} from './health';

let Sentry = null;
try { Sentry = require('@sentry/react-native'); } catch (e) {}

const PENDING_KEY = 'fluid_profile_pending_sync_v1';

const ASYNC_KEYS = {
  prenom: 'fluid_prenom',
  gender: 'fluid_profile_gender',
  birth_date: 'fluid_birth_date',
  height_cm: 'fluid_height_cm',
  weight_kg: 'fluid_weight_kg',
  practice_level: 'fluid_practice_level',
  goals: 'fluid_goals',
  frequency: 'fluid_frequency',
  lang: 'fluid_lang',
  tension_idxs: 'fluid_tension_idxs',
  onboarding_completed: 'fluid_onboarding_completed',
  onboarding_completed_at: 'fluid_onboarding_completed_at',
  ring_goal_move_kcal: 'fluid_ring_goal_move_kcal',
  ring_goal_exercise_min: 'fluid_ring_goal_exercise_min',
  ring_goal_stand_hours: 'fluid_ring_goal_stand_hours',
  rings_streak_count: 'fluid_rings_streak_count',
  rings_streak_last_date: 'fluid_rings_streak_last_date',
};

const SUPABASE_COLUMNS = Object.freeze(Object.keys(ASYNC_KEYS));

function stringify(v) {
  if (v == null) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}

function parseStored(key, raw) {
  if (raw == null) return null;
  if (key === 'goals' || key === 'tension_idxs') {
    try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : null; }
    catch (e) { return null; }
  }
  if (key === 'onboarding_completed') return raw === '1' || raw === 'true';
  if (key === 'height_cm' || key === 'ring_goal_move_kcal' || key === 'ring_goal_exercise_min' || key === 'ring_goal_stand_hours' || key === 'rings_streak_count') {
    const n = parseInt(raw, 10);
    return isFinite(n) ? n : null;
  }
  if (key === 'weight_kg') {
    const n = parseFloat(raw);
    return isFinite(n) ? n : null;
  }
  return raw;
}

/** Read the cached profile from AsyncStorage. Always resolves an object. */
export async function readCachedProfile() {
  const pairs = await AsyncStorage.multiGet(Object.values(ASYNC_KEYS));
  const map = {};
  pairs.forEach(function ([key, value]) { map[key] = value; });
  const out = {};
  Object.keys(ASYNC_KEYS).forEach(function (col) {
    out[col] = parseStored(col, map[ASYNC_KEYS[col]]);
  });
  return out;
}

async function writeCache(patch) {
  const ops = [];
  Object.keys(patch).forEach(function (col) {
    const key = ASYNC_KEYS[col];
    if (!key) return;
    const val = patch[col];
    if (val == null) {
      ops.push(['remove', key]);
    } else {
      ops.push(['set', key, stringify(val)]);
    }
  });
  if (!ops.length) return;
  const setOps = ops.filter(function (o) { return o[0] === 'set'; }).map(function (o) { return [o[1], o[2]]; });
  const removeKeys = ops.filter(function (o) { return o[0] === 'remove'; }).map(function (o) { return o[1]; });
  const tasks = [];
  if (setOps.length) tasks.push(AsyncStorage.multiSet(setOps));
  if (removeKeys.length) tasks.push(AsyncStorage.multiRemove(removeKeys));
  await Promise.all(tasks);
}

async function loadPending() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) { return null; }
}

async function savePending(obj) {
  try {
    if (!obj || Object.keys(obj).length === 0) {
      await AsyncStorage.removeItem(PENDING_KEY);
      return;
    }
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(obj));
  } catch (e) {}
}

function sanitizeForSupabase(patch) {
  const row = {};
  SUPABASE_COLUMNS.forEach(function (col) {
    if (Object.prototype.hasOwnProperty.call(patch, col)) {
      row[col] = patch[col];
    }
  });
  return row;
}

// Garde-fou : empêche une requête Supabase de bloquer l'UI à l'infini.
// (Vécu à l'onboarding : un upsert profiles qui ne répondait jamais laissait
//  « Enregistrement… » tourner pour toujours et figeait le bouton Suivant.)
function withTimeoutP(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () { reject(new Error((label || 'op') + '-timeout-' + ms + 'ms')); }, ms);
    }),
  ]);
}

async function getSessionUserId() {
  if (!supabase) return null;
  try {
    const { data: { session } } = await withTimeoutP(supabase.auth.getSession(), 6000, 'getSession');
    return session?.user?.id || null;
  } catch (e) { return null; }
}

let remoteFailureStreak = 0;
const REMOTE_FAILURE_REPORT_THRESHOLD = 3;

function reportRemoteFailure(error, context) {
  remoteFailureStreak += 1;
  if (remoteFailureStreak < REMOTE_FAILURE_REPORT_THRESHOLD) return;
  if (!Sentry) return;
  try {
    Sentry.withScope(function (scope) {
      scope.setExtra('streak', remoteFailureStreak);
      scope.setExtra('context', context || {});
      Sentry.captureException(error instanceof Error ? error : new Error(String(error?.message || error)));
    });
  } catch (e) {}
}

async function attemptRemoteUpsert(userId, patch) {
  if (!supabase || !userId) return { ok: false, reason: 'no-user' };
  const row = sanitizeForSupabase(patch);
  if (Object.keys(row).length === 0) return { ok: true, reason: 'noop' };
  row.id = userId;
  row.updated_at = new Date().toISOString();
  try {
    const res = await withTimeoutP(supabase.from('profiles').upsert(row), 8000, 'upsert');
    if (res.error) {
      reportRemoteFailure(res.error, { operation: 'upsert', columns: Object.keys(row) });
      return { ok: false, reason: 'error', error: res.error };
    }
    remoteFailureStreak = 0;
    return { ok: true };
  } catch (e) {
    // Timeout OU vraie erreur réseau → on ne bloque pas l'UI : le patch est
    // déjà en cache local et sera remis en file pour un prochain essai.
    reportRemoteFailure(e, { operation: 'upsert-throw' });
    return { ok: false, reason: 'throw', error: e };
  }
}

/**
 * Sync a profile patch. Writes AsyncStorage immediately, attempts a
 * Supabase upsert, queues on failure, and mirrors weight/height into
 * HealthKit when the patch contains them and `opts.writeToHealthKit` is true.
 *
 * Returns `{ ok, remote: 'success' | 'queued' | 'no-user' | 'no-supabase' }`.
 */
export async function syncProfilePatch(patch, opts) {
  const options = opts || {};
  if (!patch || typeof patch !== 'object') return { ok: false, remote: 'invalid' };

  // 1) Always write the local cache first. This guarantees the UI sees the
  //    new value immediately even if remote/HK fails below.
  try {
    await writeCache(patch);
  } catch (e) {}

  // 2) HealthKit mirror — best effort. We only ask for HK init if the
  //    caller explicitly asked us to mirror, which matches the user's
  //    consent moment (they typed a weight; they expect HK to see it).
  if (options.writeToHealthKit && Platform.OS === 'ios') {
    try {
      const initRes = await ensureHealthKitInit();
      if (initRes && initRes.ok) {
        if (isFinite(patch.weight_kg) && patch.weight_kg > 0) {
          await writeWeightKg(patch.weight_kg);
        }
        if (isFinite(patch.height_cm) && patch.height_cm > 0) {
          await writeHeightCm(patch.height_cm);
        }
      }
    } catch (e) {}
  }

  // 3) Supabase upsert (+ any pending columns from previous failed attempts).
  if (!supabase) return { ok: true, remote: 'no-supabase' };
  const userId = options.userId || (await getSessionUserId());
  if (!userId) {
    // User isn't authenticated yet — queue what we have so it lands when
    // they sign up/in. (Note: pending columns are unscoped to a user id;
    // when we flush we apply them to whoever is signed in. That's fine
    // because the queue lives on-device per logged-out user.)
    const existing = (await loadPending()) || {};
    Object.assign(existing, sanitizeForSupabase(patch));
    await savePending(existing);
    return { ok: true, remote: 'queued' };
  }

  // Merge any previously-queued patch into the current write so a single
  // RTT settles everything.
  const queued = (await loadPending()) || {};
  const merged = Object.assign({}, queued, sanitizeForSupabase(patch));
  const remote = await attemptRemoteUpsert(userId, merged);
  if (remote.ok) {
    await savePending(null);
    return { ok: true, remote: 'success' };
  }
  // Failure → keep the merged patch queued for retry.
  await savePending(merged);
  return { ok: true, remote: 'queued', error: remote.error };
}

/**
 * Flush the pending queue. Safe to call at startup (after the auth session
 * is restored). Resolves `{ ok, remote }` — same shape as syncProfilePatch.
 */
export async function flushPendingProfileSync(opts) {
  if (!supabase) return { ok: true, remote: 'no-supabase' };
  const queued = await loadPending();
  if (!queued || Object.keys(queued).length === 0) {
    return { ok: true, remote: 'noop' };
  }
  const userId = (opts && opts.userId) || (await getSessionUserId());
  if (!userId) return { ok: true, remote: 'queued' };
  const remote = await attemptRemoteUpsert(userId, queued);
  if (remote.ok) {
    await savePending(null);
    return { ok: true, remote: 'success' };
  }
  return { ok: true, remote: 'queued', error: remote.error };
}

/** Pull authoritative remote profile and refresh the local cache. */
export async function refreshFromRemote(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    const patch = {};
    SUPABASE_COLUMNS.forEach(function (col) {
      if (Object.prototype.hasOwnProperty.call(data, col)) patch[col] = data[col];
    });
    await writeCache(patch);
    return patch;
  } catch (e) { return null; }
}

/** Hard-clear cached profile (logout / reset flow). */
export async function clearCachedProfile() {
  try {
    await AsyncStorage.multiRemove(Object.values(ASYNC_KEYS).concat([PENDING_KEY]));
  } catch (e) {}
}

export const PROFILE_ASYNC_KEYS = ASYNC_KEYS;
export const PROFILE_PENDING_KEY = PENDING_KEY;
