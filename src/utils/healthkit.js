// HealthKit helper — reads (DOB, sex, height, weight, calories, exercise,
// stand) and writes (height, weight) the data the new onboarding + Activity
// screen need.
//
// Powered by @kingstinct/react-native-healthkit v14 (Nitro Modules). Replaces
// the legacy react-native-health 1.19 binding, which crashed with NSException
// on iOS 26.5 + New Arch. The new binding bypasses the ObjC TurboModule
// bridge entirely (Swift / Nitro) so the crash class is gone by construction.
//
// All exports keep the same {ok, reason?} or value-or-null shape as before so
// the Activity / ProfileOnboarding / profileSync consumers are untouched.

import { Platform } from 'react-native';

// HK kill-switch — à garder pour pouvoir désactiver HealthKit côté JS sans
// rebuild natif si un nouveau crash apparaît sur une version iOS future.
const HEALTHKIT_DISABLED = false;

let HK = null;
try {
  HK = require('@kingstinct/react-native-healthkit');
} catch (e) {}

// Identifiants HealthKit. Strings au lieu d'enums pour limiter le coût d'un
// import et garder un fichier sans dépendances de type compile-time.
const ID = {
  HeartRate: 'HKQuantityTypeIdentifierHeartRate',
  ActiveEnergyBurned: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  BasalEnergyBurned: 'HKQuantityTypeIdentifierBasalEnergyBurned',
  AppleExerciseTime: 'HKQuantityTypeIdentifierAppleExerciseTime',
  AppleStandTime: 'HKQuantityTypeIdentifierAppleStandTime',
  BodyMass: 'HKQuantityTypeIdentifierBodyMass',
  Height: 'HKQuantityTypeIdentifierHeight',
  StepCount: 'HKQuantityTypeIdentifierStepCount',
  DistanceWalkingRunning: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  FlightsClimbed: 'HKQuantityTypeIdentifierFlightsClimbed',
  DateOfBirth: 'HKCharacteristicTypeIdentifierDateOfBirth',
  BiologicalSex: 'HKCharacteristicTypeIdentifierBiologicalSex',
  Workout: 'HKWorkoutTypeIdentifier',
  WorkoutEffortScore: 'HKQuantityTypeIdentifierWorkoutEffortScore',
};

// HKQuantityTypeIdentifierWorkoutEffortScore n'existe qu'à partir d'iOS 18 —
// le référencer dans requestAuthorization sur iOS 17 ferait échouer TOUTE la
// demande d'autorisations. Gate strict par version.
const EFFORT_SCORE_AVAILABLE = Platform.OS === 'ios' && parseInt(Platform.Version, 10) >= 18;

const READ_PERMS = [
  ID.HeartRate,
  ID.ActiveEnergyBurned,
  ID.BasalEnergyBurned,
  ID.AppleExerciseTime,
  ID.AppleStandTime,
  ID.BodyMass,
  ID.Height,
  ID.StepCount,
  ID.DistanceWalkingRunning,
  ID.FlightsClimbed,
  ID.DateOfBirth,
  ID.BiologicalSex,
  ID.Workout,
];

const WRITE_PERMS = [
  ID.ActiveEnergyBurned,
  ID.HeartRate,
  ID.BodyMass,
  ID.Height,
  ID.Workout,
];
if (EFFORT_SCORE_AVAILABLE) WRITE_PERMS.push(ID.WorkoutEffortScore);

let initialised = false;
let initInFlight = null;

function isSupported() {
  if (HEALTHKIT_DISABLED) return false;
  if (Platform.OS !== 'ios') return false;
  if (!HK) return false;
  try {
    return HK.isHealthDataAvailable ? !!HK.isHealthDataAvailable() : true;
  } catch (e) {
    return false;
  }
}

/**
 * Lazily initialise HealthKit. Calling more than once is cheap (singleton).
 * Returns `{ ok, reason? }`.
 */
export function ensureHealthKitInit() {
  if (!isSupported()) return Promise.resolve({ ok: false, reason: 'unsupported' });
  if (initialised) return Promise.resolve({ ok: true });
  if (initInFlight) return initInFlight;
  initInFlight = (async function () {
    try {
      // Kingstinct retourne true si l'utilisateur a vu la feuille (qu'il ait
      // accepté ou non). Sur HealthKit, READ status n'est jamais fiable par
      // confidentialité ; WRITE status l'est — les écrans (HealthKitConnect)
      // probent eux-mêmes via authorizationStatusFor.
      await HK.requestAuthorization({ toShare: WRITE_PERMS, toRead: READ_PERMS });
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

function dateBounds(forDate) {
  const d = forDate || new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { startDate: start, endDate: end };
}

async function queryAll(identifier, startDate, endDate, unit) {
  try {
    const opts = {
      limit: 0,
      ascending: false,
      filter: { date: { startDate, endDate } },
    };
    if (unit) opts.unit = unit;
    const samples = await HK.queryQuantitySamples(identifier, opts);
    return Array.isArray(samples) ? samples : [];
  } catch (e) {
    return [];
  }
}

function sumQuantity(samples) {
  let total = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Number(samples[i].quantity);
    if (Number.isFinite(v)) total += v;
  }
  return total;
}

/** Date of birth as `YYYY-MM-DD` string, or null. */
export async function readDateOfBirth() {
  if (!initialised) return null;
  try {
    const d = HK.getDateOfBirthAsync ? await HK.getDateOfBirthAsync() : HK.getDateOfBirth();
    if (!d) return null;
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime()) || date.getFullYear() < 1900) return null;
    return date.getFullYear() + '-'
      + String(date.getMonth() + 1).padStart(2, '0') + '-'
      + String(date.getDate()).padStart(2, '0');
  } catch (e) {
    return null;
  }
}

/** Biological sex normalised to {female|male|nonbinary|null}. */
export async function readBiologicalSex() {
  if (!initialised) return null;
  try {
    // BiologicalSex enum: notSet=0, female=1, male=2, other=3
    const v = HK.getBiologicalSexAsync ? await HK.getBiologicalSexAsync() : HK.getBiologicalSex();
    if (v === 1 || v === 'female') return 'female';
    if (v === 2 || v === 'male') return 'male';
    if (v === 3 || v === 'other') return 'nonbinary';
    return null;
  } catch (e) {
    return null;
  }
}

/** Most-recent body mass in kg, or null. */
export async function readLatestWeightKg() {
  if (!initialised) return null;
  try {
    const sample = await HK.getMostRecentQuantitySample(ID.BodyMass, 'kg');
    if (!sample) return null;
    const kg = Number(sample.quantity);
    if (!isFinite(kg) || kg <= 0) return null;
    return Math.round(kg * 10) / 10;
  } catch (e) {
    return null;
  }
}

/** Most-recent height in cm, or null. */
export async function readLatestHeightCm() {
  if (!initialised) return null;
  try {
    const sample = await HK.getMostRecentQuantitySample(ID.Height, 'm');
    if (!sample) return null;
    const m = Number(sample.quantity);
    if (!isFinite(m) || m <= 0) return null;
    return Math.round(m * 100);
  } catch (e) {
    return null;
  }
}

/** Save a weight sample (kg). Resolves `{ ok, error? }`. */
export async function writeWeightKg(weightKg) {
  if (!initialised || !isFinite(weightKg) || weightKg <= 0) return { ok: false };
  try {
    const now = new Date();
    await HK.saveQuantitySample(ID.BodyMass, 'kg', weightKg, now, now);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/** Save a height sample (cm). Resolves `{ ok, error? }`. */
export async function writeHeightCm(heightCm) {
  if (!initialised || !isFinite(heightCm) || heightCm <= 0) return { ok: false };
  try {
    const now = new Date();
    await HK.saveQuantitySample(ID.Height, 'm', heightCm / 100, now, now);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/**
 * Save a workout-effort score (échelle Apple 1-10) sur la plage horaire de la
 * séance qui vient de se terminer. iOS 18+ uniquement (type inexistant avant).
 *
 * NB (2026-07-25) : kingstinct v14 n'expose pas encore
 * `relateWorkoutEffortSample` (la liaison officielle score ↔ workout). On
 * écrit donc le sample sur la même plage horaire que le workout — il apparaît
 * dans Santé (« Effort d'exercice ») ; la liaison native viendra quand la lib
 * l'ajoutera. Resolves `{ ok, reason?, error? }`.
 */
export async function writeWorkoutEffortScore(score, startDate, endDate) {
  if (!EFFORT_SCORE_AVAILABLE) return { ok: false, reason: 'unsupported-ios' };
  if (!isSupported()) return { ok: false, reason: 'unsupported' };
  const v = Math.round(Number(score));
  if (!isFinite(v) || v < 1 || v > 10) return { ok: false, reason: 'bad-score' };
  try {
    // Demande d'autorisation ciblée : no-op si déjà déterminée, sinon la
    // feuille ne liste que ce type (utilisateurs existants post-OTA — leur
    // init du lancement peut avoir précédé l'ajout du type à WRITE_PERMS).
    await HK.requestAuthorization({ toShare: [ID.WorkoutEffortScore], toRead: [] });
    const end = endDate instanceof Date ? endDate : new Date();
    const start = startDate instanceof Date ? startDate : new Date(end.getTime() - 60000);
    await HK.saveQuantitySample(ID.WorkoutEffortScore, 'appleEffortScore', v, start, end);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'save-error', error: e };
  }
}

/**
 * Today's Activity-ring totals: { moveKcal, exerciseMin, standHours }.
 * Each metric is summed independently and resolves to 0 on any failure
 * so callers can render an empty state without branching.
 */
export async function readActivitySummary(forDate) {
  if (!initialised) return { moveKcal: 0, exerciseMin: 0, standHours: 0 };
  const { startDate, endDate } = dateBounds(forDate);
  const [active, exercise, stand] = await Promise.all([
    queryAll(ID.ActiveEnergyBurned, startDate, endDate, 'kcal'),
    queryAll(ID.AppleExerciseTime, startDate, endDate, 'min'),
    queryAll(ID.AppleStandTime, startDate, endDate, 'min'),
  ]);
  // AppleStandTime émet un sample par heure où l'utilisateur s'est levé ≥1 min.
  // L'anneau "Lever" compte les heures distinctes — cap à 24.
  const standHours = Math.min(24, stand.filter(function (s) { return Number(s.quantity) > 0; }).length);
  return {
    moveKcal: Math.round(sumQuantity(active)),
    exerciseMin: Math.round(sumQuantity(exercise)),
    standHours: standHours,
  };
}

/**
 * Extra "Détails du jour" stats: steps, distance (km), flights climbed,
 * basal+active calories, avg + max HR.
 */
export async function readDayDetails(forDate) {
  if (!initialised) {
    return { steps: 0, distanceKm: 0, flights: 0, totalKcal: 0, avgHr: null, maxHr: null };
  }
  const { startDate, endDate } = dateBounds(forDate);
  const [steps, distance, flights, active, basal, hrSamples] = await Promise.all([
    queryAll(ID.StepCount, startDate, endDate, 'count'),
    queryAll(ID.DistanceWalkingRunning, startDate, endDate, 'm'),
    queryAll(ID.FlightsClimbed, startDate, endDate, 'count'),
    queryAll(ID.ActiveEnergyBurned, startDate, endDate, 'kcal'),
    queryAll(ID.BasalEnergyBurned, startDate, endDate, 'kcal'),
    (async function () {
      try {
        const samples = await HK.queryQuantitySamples(ID.HeartRate, {
          limit: 500,
          ascending: false,
          unit: 'count/min',
          filter: { date: { startDate, endDate } },
        });
        return Array.isArray(samples) ? samples : [];
      } catch (e) { return []; }
    })(),
  ]);
  let hrSum = 0;
  let hrCount = 0;
  let hrMax = 0;
  for (let i = 0; i < hrSamples.length; i++) {
    const v = Math.round(Number(hrSamples[i].quantity) || 0);
    if (v < 30 || v > 230) continue;
    hrSum += v;
    hrCount += 1;
    if (v > hrMax) hrMax = v;
  }
  return {
    steps: Math.round(sumQuantity(steps)),
    distanceKm: Math.round(sumQuantity(distance) / 100) / 10,
    flights: Math.round(sumQuantity(flights)),
    totalKcal: Math.round(sumQuantity(active) + sumQuantity(basal)),
    avgHr: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    maxHr: hrMax || null,
  };
}

/** Workouts authored by us (or any source) for a given day. */
export async function readDayWorkouts(forDate) {
  if (!initialised) return [];
  const { startDate, endDate } = dateBounds(forDate);
  try {
    const samples = await HK.queryWorkoutSamples({
      limit: 50,
      ascending: false,
      filter: { date: { startDate, endDate } },
    });
    if (!Array.isArray(samples)) return [];
    return samples.map(function (s) {
      const start = s.startDate instanceof Date ? s.startDate : new Date(s.startDate);
      const end = s.endDate instanceof Date ? s.endDate : new Date(s.endDate);
      const durMin = (end.getTime() - start.getTime()) / 60000;
      let energy = null;
      try {
        // WorkoutSample.totalEnergyBurned is a Quantity { quantity, unit }
        if (s.totalEnergyBurned && typeof s.totalEnergyBurned.quantity === 'number') {
          energy = Math.round(s.totalEnergyBurned.quantity);
        }
      } catch (e) {}
      const sourceName = s.sourceRevision && s.sourceRevision.source ? s.sourceRevision.source.name : null;
      return {
        id: s.uuid || (start.toISOString() + '_' + end.toISOString()),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        durationMin: isFinite(durMin) ? Math.max(1, Math.round(durMin)) : null,
        energyKcal: energy,
        activity: s.workoutActivityType != null ? String(s.workoutActivityType) : 'Workout',
        source: sourceName,
      };
    });
  } catch (e) {
    return [];
  }
}

/**
 * Daily aggregates over the last N days. Returns an array of
 * `{ date: 'YYYY-MM-DD', moveKcal, exerciseMin, standHours }` ordered
 * oldest → newest. Used for the week tracker + trends sparklines.
 */
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
    return tasks.map(function (t) {
      return { date: t.date, moveKcal: 0, exerciseMin: 0, standHours: 0 };
    });
  }
  const results = await Promise.all(tasks.map(function (t) { return readActivitySummary(t.dateObj); }));
  return tasks.map(function (t, i) {
    return {
      date: t.date,
      moveKcal: results[i].moveKcal,
      exerciseMin: results[i].exerciseMin,
      standHours: results[i].standHours,
    };
  });
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
  writeWorkoutEffortScore,
  readActivitySummary,
  readDayDetails,
  readDayWorkouts,
  readActivityHistory,
};
