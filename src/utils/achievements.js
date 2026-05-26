// achievements: système de badges/trophées auto-détectés.
//
// Inspiré de `streakMilestones`/`fluid_milestones_seen` côté toggleDone :
// on évalue à chaque session si un nouveau badge est débloqué, on note
// l'unlock dans AsyncStorage (`fluid_achievements_v1`) et on renvoie les
// deltas pour permettre au caller d'afficher une célébration.
//
// API :
//   ACHIEVEMENTS          — catalogue (icône, titres FR/EN)
//   getUnlockedSync()     — cache synchrone (préchargé via prime())
//   evaluateUnlocked(ctx) — calcule l'état à partir du done/streak courant
//   detectNewUnlocks(ctx) — async : compare au cache et persiste les deltas
//   subscribe(fn)         — pub/sub pour rerender live
//
// Aucun nouveau dep, juste AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = 'fluid_achievements_v1';
// Sibling store: { [id]: ISO date string } captured at first unlock.
// Backfilled on best-effort basis — IDs unlocked before this store existed
// simply have no date and the UI degrades to "Débloqué" without a date.
const DATES_KEY = 'fluid_achievement_dates_v1';

// Catalogue de 15 badges. Ordre = ordre d'affichage dans la grille.
// Mapping pilier : p1 Épaules, p2 Dos, p3 Mobilité, p4 Posture,
// p5 Eldoa, p6 Golf, p7 Mat Pilates, p8 Office, p9 Ménopause.
export const ACHIEVEMENTS = [
  {
    id: 'first_seance',
    icon: '🌱',
    titleFr: 'Première séance',
    titleEn: 'First session',
    descFr: 'Bienvenue dans la pratique.',
    descEn: 'Welcome to the practice.',
  },
  {
    id: 'streak_3',
    icon: '🔥',
    titleFr: '3 jours d\'affilée',
    titleEn: '3-day streak',
    descFr: 'Trois jours consécutifs de pratique.',
    descEn: 'Three consecutive days of practice.',
  },
  {
    id: 'streak_7',
    icon: '⚡',
    titleFr: 'Une semaine !',
    titleEn: 'One full week!',
    descFr: '7 jours consécutifs — l\'habitude prend.',
    descEn: '7 days in a row — the habit is forming.',
  },
  {
    id: 'streak_30',
    icon: '🌟',
    titleFr: '30 jours rituel',
    titleEn: '30-day ritual',
    descFr: 'Un mois de pratique continue. Sabrina est fière.',
    descEn: 'A full month of continuous practice. Sabrina is proud.',
  },
  {
    id: 'count_10',
    icon: '🪼',
    titleFr: '10 séances',
    titleEn: '10 sessions',
    descFr: 'Tu as posé les fondations.',
    descEn: 'Foundations are in place.',
  },
  {
    id: 'count_50',
    icon: '🏔️',
    titleFr: '50 séances',
    titleEn: '50 sessions',
    descFr: 'La pratique devient ton terrain.',
    descEn: 'The practice has become your ground.',
  },
  {
    id: 'count_100',
    icon: '👑',
    titleFr: '100 séances',
    titleEn: '100 sessions',
    descFr: 'Tu fais partie du cercle des fidèles.',
    descEn: 'You belong to the inner circle.',
  },
  {
    id: 'pilier_tour',
    icon: '🌍',
    titleFr: 'Tour des piliers',
    titleEn: 'Pillar tour',
    descFr: 'Au moins une séance dans chaque pilier.',
    descEn: 'At least one session in every pillar.',
  },
  {
    id: 'specialist_mat',
    icon: '🧘‍♀️',
    titleFr: 'Spécialiste Mat Pilates',
    titleEn: 'Mat Pilates specialist',
    descFr: '5 séances de Mat Pilates complétées.',
    descEn: '5 Mat Pilates sessions completed.',
  },
  {
    id: 'specialist_back',
    icon: '🦴',
    titleFr: 'Spécialiste Dos',
    titleEn: 'Back specialist',
    descFr: '5 séances de Dos complétées.',
    descEn: '5 Back sessions completed.',
  },
  {
    id: 'specialist_mobility',
    icon: '💧',
    titleFr: 'Spécialiste Mobilité',
    titleEn: 'Mobility specialist',
    descFr: '5 séances de Mobilité complétées.',
    descEn: '5 Mobility sessions completed.',
  },
  {
    id: 'specialist_posture',
    icon: '🌿',
    titleFr: 'Spécialiste Posture',
    titleEn: 'Posture specialist',
    descFr: '5 séances de Posture complétées.',
    descEn: '5 Posture sessions completed.',
  },
  {
    id: 'early_bird',
    icon: '🌅',
    titleFr: 'Lève-tôt',
    titleEn: 'Early bird',
    descFr: 'Une séance avant 8h du matin.',
    descEn: 'A session before 8 AM.',
  },
  {
    id: 'night_owl',
    icon: '🌙',
    titleFr: 'Couche-tard',
    titleEn: 'Night owl',
    descFr: 'Une séance après 21h.',
    descEn: 'A session after 9 PM.',
  },
  {
    id: 'explorer',
    icon: '🧭',
    titleFr: 'Exploratrice',
    titleEn: 'Explorer',
    descFr: '3 piliers différents en une semaine.',
    descEn: '3 different pillars in a single week.',
  },
];

const ACHIEVEMENT_INDEX = ACHIEVEMENTS.reduce(function (acc, a) { acc[a.id] = a; return acc; }, {});

export function getAchievementById(id) {
  return ACHIEVEMENT_INDEX[id] || null;
}

// ─────── Cache synchrone + pub/sub ───────
// Préchargé par prime() au boot pour permettre un rendu instantané.

let _cache = [];
let _dates = {};
let _primed = false;
const _subs = new Set();

export function getUnlockedSync() {
  return _cache.slice();
}

export function isUnlockedSync(id) {
  return _cache.indexOf(id) !== -1;
}

export function getUnlockDateSync(id) {
  return (id && _dates[id]) || null;
}

export function getUnlockDatesSync() {
  return Object.assign({}, _dates);
}

export function subscribe(fn) {
  if (typeof fn !== 'function') return function () {};
  _subs.add(fn);
  return function () { _subs.delete(fn); };
}

function _notify() {
  _subs.forEach(function (fn) { try { fn(_cache.slice()); } catch (e) {} });
}

export async function prime() {
  if (_primed) return _cache.slice();
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) _cache = parsed.filter(function (id) { return typeof id === 'string'; });
    }
  } catch (e) {}
  try {
    const rawDates = await AsyncStorage.getItem(DATES_KEY);
    if (rawDates) {
      const parsedDates = JSON.parse(rawDates);
      if (parsedDates && typeof parsedDates === 'object' && !Array.isArray(parsedDates)) {
        _dates = parsedDates;
      }
    }
  } catch (e) {}
  _primed = true;
  _notify();
  return _cache.slice();
}

async function _persist(ids) {
  _cache = ids.slice();
  try { await AsyncStorage.setItem(STORE_KEY, JSON.stringify(_cache)); } catch (e) {}
  _notify();
}

async function _persistDates() {
  try { await AsyncStorage.setItem(DATES_KEY, JSON.stringify(_dates)); } catch (e) {}
}

// ─────── Évaluation ───────
//
// ctx attendu :
//   done    : { p1: [bool…], p2: [bool…], …, p9: [bool…] }
//   streak  : nombre (jours consécutifs)
//   nowHour : optionnel — heure courante 0-23 (forcée par caller pour
//             tester early_bird / night_owl à l'instant T de la complétion)
//   recentPiliers : optionnel — set/array des piliers utilisés sur les
//             7 derniers jours (pour explorer)
//
// Renvoie un array d'IDs débloqués (selon l'état actuel — pas un delta).

export function evaluateUnlocked(ctx) {
  const done = (ctx && ctx.done) || {};
  const streak = (ctx && ctx.streak) || 0;
  const nowHour = ctx && typeof ctx.nowHour === 'number' ? ctx.nowHour : new Date().getHours();
  const recentPiliers = ctx && (Array.isArray(ctx.recentPiliers) || ctx.recentPiliers instanceof Set)
    ? Array.from(ctx.recentPiliers)
    : [];

  let total = 0;
  const counts = {};
  const piliersUsed = new Set();
  Object.keys(done).forEach(function (k) {
    const arr = done[k] || [];
    let n = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]) n++;
    }
    counts[k] = n;
    total += n;
    if (n > 0) piliersUsed.add(k);
  });

  // p1..p9 expected
  const allPiliers = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'];
  const tourComplete = allPiliers.every(function (k) { return piliersUsed.has(k); });

  const out = [];
  if (total >= 1) out.push('first_seance');
  if (streak >= 3) out.push('streak_3');
  if (streak >= 7) out.push('streak_7');
  if (streak >= 30) out.push('streak_30');
  if (total >= 10) out.push('count_10');
  if (total >= 50) out.push('count_50');
  if (total >= 100) out.push('count_100');
  if (tourComplete) out.push('pilier_tour');
  if ((counts.p7 || 0) >= 5) out.push('specialist_mat');
  if ((counts.p2 || 0) >= 5) out.push('specialist_back');
  if ((counts.p3 || 0) >= 5) out.push('specialist_mobility');
  if ((counts.p4 || 0) >= 5) out.push('specialist_posture');
  if (nowHour < 8) out.push('early_bird');
  if (nowHour >= 21) out.push('night_owl');
  if (recentPiliers.length >= 3) out.push('explorer');

  return out;
}

// Compare l'état évalué au cache courant : persiste les nouveaux IDs et
// renvoie l'array d'IDs nouvellement débloqués (pour célébration).
export async function detectNewUnlocks(ctx) {
  await prime();
  const current = evaluateUnlocked(ctx);
  const known = _cache;
  const known_set = new Set(known);
  const fresh = current.filter(function (id) { return !known_set.has(id); });
  if (fresh.length === 0) return [];
  const merged = known.slice();
  const nowIso = new Date().toISOString();
  fresh.forEach(function (id) {
    merged.push(id);
    if (!_dates[id]) _dates[id] = nowIso;
  });
  await _persist(merged);
  await _persistDates();
  return fresh;
}

// Reset (sign-out / reset complet).
export async function clearAchievements() {
  try { await AsyncStorage.removeItem(STORE_KEY); } catch (e) {}
  try { await AsyncStorage.removeItem(DATES_KEY); } catch (e) {}
  _cache = [];
  _dates = {};
  _primed = true;
  _notify();
}

// ─────── Recent piliers (7 derniers jours) ───────
// Persisté côté caller via AsyncStorage `fluid_recent_piliers_v1`. On stocke
// les ts de complétion par pilier ; getRecentPiliers garde les 7 derniers jours.

const RECENT_KEY = 'fluid_recent_piliers_v1';

export async function recordPilierUsage(pilierKey) {
  if (!pilierKey) return;
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ p: pilierKey, t: Date.now() });
    const cutoff = Date.now() - 7 * 86400000;
    const trimmed = arr.filter(function (e) { return e && typeof e.t === 'number' && e.t >= cutoff; }).slice(-50);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
  } catch (e) {}
}

export async function getRecentPiliers() {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    const cutoff = Date.now() - 7 * 86400000;
    const set = new Set();
    arr.forEach(function (e) {
      if (e && typeof e.t === 'number' && e.t >= cutoff && typeof e.p === 'string') set.add(e.p);
    });
    return Array.from(set);
  } catch (e) { return []; }
}
