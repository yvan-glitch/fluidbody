// Health Connect helper — équivalent ANDROID de healthkit.js.
//
// Lit (fréquence cardiaque, calories actives, pas, distance, étages, séances,
// poids, taille) et écrit (poids, taille, séances) via Health Connect, le hub
// santé de Google (react-native-health-connect, matinzd).
//
// ⚠️ Exporte EXACTEMENT les mêmes fonctions et formats de retour que
// healthkit.js, pour que les consommateurs (Activity, profileSync, etc.)
// marchent à l'identique via la façade src/utils/health.js. Les notions très
// « Apple » sans équivalent Health Connect (heures « Lever », date de
// naissance, sexe biologique) renvoient des valeurs neutres.
//
// Non compilé ici — base à valider à la 1re compilation (les noms d'API HC
// peuvent varier d'une version à l'autre).

import { Platform } from 'react-native';

// Require protégé : si la lib native n'est pas présente (build sans Health
// Connect, iOS, Expo Go), tout devient no-op — aucun crash.
let HC = null;
try {
  HC = require('react-native-health-connect');
} catch (e) {}

const READ_TYPES = [
  'HeartRate', 'Steps', 'ActiveCaloriesBurned', 'TotalCaloriesBurned',
  'Distance', 'FloorsClimbed', 'ExerciseSession', 'Weight', 'Height',
];
const WRITE_TYPES = ['Weight', 'Height', 'ActiveCaloriesBurned', 'ExerciseSession', 'HeartRate'];

let initialised = false;
let initInFlight = null;

function isSupported() {
  return Platform.OS === 'android' && !!HC;
}

async function sdkAvailable() {
  if (!isSupported()) return false;
  try {
    // SDK_AVAILABLE = 3 dans react-native-health-connect.
    const status = await HC.getSdkStatus();
    const ok = HC.SdkAvailabilityStatus
      ? status === HC.SdkAvailabilityStatus.SDK_AVAILABLE
      : status === 3;
    return ok;
  } catch (e) {
    return false;
  }
}

/**
 * Initialise Health Connect + demande les permissions. Idempotent.
 * Même signature/retour que ensureHealthKitInit côté iOS : `{ ok, reason? }`.
 */
export function ensureHealthKitInit() {
  if (!isSupported()) return Promise.resolve({ ok: false, reason: 'unsupported' });
  if (initialised) return Promise.resolve({ ok: true });
  if (initInFlight) return initInFlight;
  initInFlight = (async function () {
    try {
      const available = await sdkAvailable();
      if (!available) {
        initInFlight = null;
        return { ok: false, reason: 'sdk-unavailable' };
      }
      const ok = await HC.initialize();
      if (!ok) { initInFlight = null; return { ok: false, reason: 'init-failed' }; }
      const perms = []
        .concat(READ_TYPES.map(function (t) { return { accessType: 'read', recordType: t }; }))
        .concat(WRITE_TYPES.map(function (t) { return { accessType: 'write', recordType: t }; }));
      await HC.requestPermission(perms);
      initialised = true;
      initInFlight = null;
      return { ok: true };
    } catch (e) {
      initInFlight = null;
      return { ok: false, reason: 'init-error', error: e };
    }
  })();
  return initInFlight;
}

export function isHealthKitReady() {
  return initialised;
}

function dayRange(forDate) {
  const d = forDate || new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return {
    operator: 'between',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  };
}

async function read(recordType, timeRangeFilter) {
  try {
    const res = await HC.readRecords(recordType, { timeRangeFilter: timeRangeFilter });
    if (res && Array.isArray(res.records)) return res.records;
    return Array.isArray(res) ? res : [];
  } catch (e) {
    return [];
  }
}

// ── Date de naissance / sexe : Health Connect ne les stocke pas de façon
// fiable → on renvoie null (l'onboarding bascule sur la saisie manuelle). ──
export async function readDateOfBirth() { return null; }
export async function readBiologicalSex() { return null; }

/** Poids le plus récent en kg, ou null. */
export async function readLatestWeightKg() {
  if (!initialised) return null;
  try {
    // Fenêtre large (1 an) puis on prend le plus récent.
    const now = new Date();
    const yearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
    const recs = await read('Weight', { operator: 'between', startTime: yearAgo.toISOString(), endTime: now.toISOString() });
    if (!recs.length) return null;
    recs.sort(function (a, b) { return new Date(b.time) - new Date(a.time); });
    const kg = recs[0].weight && recs[0].weight.inKilograms;
    if (!isFinite(kg) || kg <= 0) return null;
    return Math.round(kg * 10) / 10;
  } catch (e) { return null; }
}

/** Taille la plus récente en cm, ou null. */
export async function readLatestHeightCm() {
  if (!initialised) return null;
  try {
    const now = new Date();
    const yearAgo = new Date(now.getTime() - 365 * 24 * 3600 * 1000);
    const recs = await read('Height', { operator: 'between', startTime: yearAgo.toISOString(), endTime: now.toISOString() });
    if (!recs.length) return null;
    recs.sort(function (a, b) { return new Date(b.time) - new Date(a.time); });
    const m = recs[0].height && recs[0].height.inMeters;
    if (!isFinite(m) || m <= 0) return null;
    return Math.round(m * 100);
  } catch (e) { return null; }
}

export async function writeWeightKg(weightKg) {
  if (!initialised || !isFinite(weightKg) || weightKg <= 0) return { ok: false };
  try {
    const now = new Date().toISOString();
    await HC.insertRecords([{ recordType: 'Weight', time: now, weight: { value: weightKg, unit: 'kilograms' } }]);
    return { ok: true };
  } catch (e) { return { ok: false, error: e }; }
}

export async function writeHeightCm(heightCm) {
  if (!initialised || !isFinite(heightCm) || heightCm <= 0) return { ok: false };
  try {
    const now = new Date().toISOString();
    await HC.insertRecords([{ recordType: 'Height', time: now, height: { value: heightCm / 100, unit: 'meters' } }]);
    return { ok: true };
  } catch (e) { return { ok: false, error: e }; }
}

function sumActiveKcal(records) {
  let t = 0;
  for (let i = 0; i < records.length; i++) {
    const v = records[i].energy && records[i].energy.inKilocalories;
    if (isFinite(v)) t += v;
  }
  return t;
}

function sumExerciseMinutes(sessions) {
  let m = 0;
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const start = new Date(s.startTime).getTime();
    const end = new Date(s.endTime).getTime();
    if (isFinite(start) && isFinite(end) && end > start) m += (end - start) / 60000;
  }
  return m;
}

/**
 * Totaux des anneaux du jour : { moveKcal, exerciseMin, standHours }.
 * standHours : Health Connect n'a pas d'équivalent au « Lever » Apple → 0.
 */
export async function readActivitySummary(forDate) {
  if (!initialised) return { moveKcal: 0, exerciseMin: 0, standHours: 0 };
  const range = dayRange(forDate);
  const [active, sessions] = await Promise.all([
    read('ActiveCaloriesBurned', range),
    read('ExerciseSession', range),
  ]);
  return {
    moveKcal: Math.round(sumActiveKcal(active)),
    exerciseMin: Math.round(sumExerciseMinutes(sessions)),
    standHours: 0,
  };
}

function sumField(records, getter) {
  let t = 0;
  for (let i = 0; i < records.length; i++) {
    const v = getter(records[i]);
    if (isFinite(v)) t += v;
  }
  return t;
}

export async function readDayDetails(forDate) {
  if (!initialised) {
    return { steps: 0, distanceKm: 0, flights: 0, totalKcal: 0, avgHr: null, maxHr: null };
  }
  const range = dayRange(forDate);
  const [steps, distance, floors, active, total, hr] = await Promise.all([
    read('Steps', range),
    read('Distance', range),
    read('FloorsClimbed', range),
    read('ActiveCaloriesBurned', range),
    read('TotalCaloriesBurned', range),
    read('HeartRate', range),
  ]);
  // HR : chaque record HeartRate contient une liste `samples` { beatsPerMinute }.
  let hrSum = 0, hrCount = 0, hrMax = 0;
  for (let i = 0; i < hr.length; i++) {
    const samples = Array.isArray(hr[i].samples) ? hr[i].samples : [];
    for (let j = 0; j < samples.length; j++) {
      const v = Math.round(Number(samples[j].beatsPerMinute) || 0);
      if (v < 30 || v > 230) continue;
      hrSum += v; hrCount += 1;
      if (v > hrMax) hrMax = v;
    }
  }
  const totalKcal = total.length
    ? sumField(total, function (r) { return r.energy && r.energy.inKilocalories; })
    : sumActiveKcal(active);
  return {
    steps: Math.round(sumField(steps, function (r) { return r.count; })),
    distanceKm: Math.round(sumField(distance, function (r) { return r.distance && r.distance.inMeters; }) / 100) / 10,
    flights: Math.round(sumField(floors, function (r) { return r.floors; })),
    totalKcal: Math.round(totalKcal),
    avgHr: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    maxHr: hrMax || null,
  };
}

export async function readDayWorkouts(forDate) {
  if (!initialised) return [];
  const range = dayRange(forDate);
  const sessions = await read('ExerciseSession', range);
  return sessions.map(function (s) {
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    const durMin = (end.getTime() - start.getTime()) / 60000;
    return {
      id: s.metadata && s.metadata.id ? s.metadata.id : (start.toISOString() + '_' + end.toISOString()),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      durationMin: isFinite(durMin) ? Math.max(1, Math.round(durMin)) : null,
      energyKcal: null,
      activity: s.exerciseType != null ? String(s.exerciseType) : 'Workout',
      source: s.metadata && s.metadata.dataOrigin ? s.metadata.dataOrigin : null,
    };
  });
}

export async function readActivityHistory(days) {
  const n = Math.max(1, Math.min(60, days || 7));
  const tasks = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    tasks.push({
      date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
      dateObj: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    });
  }
  if (!initialised) {
    return tasks.map(function (t) { return { date: t.date, moveKcal: 0, exerciseMin: 0, standHours: 0 }; });
  }
  const results = await Promise.all(tasks.map(function (t) { return readActivitySummary(t.dateObj); }));
  return tasks.map(function (t, i) {
    return { date: t.date, moveKcal: results[i].moveKcal, exerciseMin: results[i].exerciseMin, standHours: results[i].standHours };
  });
}

/**
 * Lecture ponctuelle du dernier BPM (pour la pastille cœur en séance).
 * Renvoie { bpm, measuredAt } ou null. Fenêtre de 30 s comme côté iOS.
 */
export async function readRecentHeartRate() {
  if (!initialised) return null;
  try {
    const now = new Date();
    const start = new Date(now.getTime() - 30000);
    const recs = await read('HeartRate', { operator: 'between', startTime: start.toISOString(), endTime: now.toISOString() });
    let best = null;
    for (let i = 0; i < recs.length; i++) {
      const samples = Array.isArray(recs[i].samples) ? recs[i].samples : [];
      for (let j = 0; j < samples.length; j++) {
        const bpm = Math.round(Number(samples[j].beatsPerMinute) || 0);
        const t = new Date(samples[j].time).getTime();
        if (bpm < 30 || bpm > 230) continue;
        if (!best || t > best.measuredAt) best = { bpm: bpm, measuredAt: t };
      }
    }
    return best;
  } catch (e) { return null; }
}

export default {
  ensureHealthKitInit,
  isHealthKitReady,
  readDateOfBirth,
  readBiologicalSex,
  readLatestWeightKg,
  readLatestHeightCm,
  writeWeightKg,
  writeHeightCm,
  readActivitySummary,
  readDayDetails,
  readDayWorkouts,
  readActivityHistory,
  readRecentHeartRate,
};
