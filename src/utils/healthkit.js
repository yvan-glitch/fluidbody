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
};

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

// ── Récap de séance (analyse des zones de FC) ───────────────────────────────
// HKWorkoutActivityType.pilates = 66. NOTRE app écrit aussi un workout Pilates
// (66) à la fin d'une vidéo (cf. App.js saveHealthKitWorkout). Pour le récap on
// veut UNIQUEMENT le workout mesuré par l'Apple Watch (celui qui porte la FC),
// pas le nôtre — on les distingue donc par SOURCE (bundle id), pas par type.
const WORKOUT_ACTIVITY_PILATES = 66;
const OUR_SOURCE_BUNDLE_ID = 'com.ytissot.fluidbody';
// Le client lance/arrête rarement le workout pile au début/fin de la séance
// in-app : on élargit la fenêtre de recherche de ±15 min.
const MATCH_BUFFER_MS = 15 * 60 * 1000;
// Les samples FC sont quasi instantanés : on attribue à chaque mesure le temps
// jusqu'à la suivante, plafonné (un trou plus long = capteur perdu, on n'inonde
// pas une zone).
const HR_MAX_GAP_S = 15;

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

// ── FCmax : réglage explicite ou estimation selon l'âge ─────────────────────

/**
 * Valide une FCmax saisie par l'utilisateur (réglages). `||` est volontaire en
 * aval : 0 / NaN / négatif sont des FCmax invalides et doivent retomber sur le
 * défaut. Retourne un entier 120–220, ou null si hors plage.
 */
export function clampHrMax(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 120 && n <= 220 ? Math.round(n) : null;
}

/**
 * FCmax estimée par défaut depuis la date de naissance (formule de Tanaka,
 * 207 − 0.7·âge — plus juste que 220−âge sur un public âgé, ce qui est notre
 * cas). `birthDate` accepte un Date ou une string 'YYYY-MM-DD'. Fallback 190
 * si absente/invalide.
 */
export function defaultHrMax(birthDate) {
  const FALLBACK = 190;
  if (!birthDate) return FALLBACK;
  const d = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (isNaN(d.getTime())) return FALLBACK;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  if (!Number.isFinite(age) || age < 10 || age > 100) return FALLBACK;
  return Math.round(207 - 0.7 * age);
}

// ── Zones de fréquence cardiaque ────────────────────────────────────────────

/**
 * Modèle 3 zones (Récup / Modéré / Intense). Les bornes sont calculées À PARTIR
 * de `hrMax` (65 % et 80 %), pas en dur, pour pouvoir les exposer plus tard
 * dans les réglages. Répartit le temps entre mesures consécutives (gap plafonné
 * à HR_MAX_GAP_S). 0 échantillon → toutes les secondes à zéro (l'UI gère le
 * vide). Retourne `[{ key, label, seconds }]`.
 */
export function computeZones(samples, hrMax) {
  const max = clampHrMax(hrMax) || 190;
  const loThreshold = max * 0.65;
  const hiThreshold = max * 0.80;
  const acc = { recup: 0, modere: 0, intense: 0 };

  const pts = (Array.isArray(samples) ? samples : [])
    .map(function (s) {
      const t = (s.startDate instanceof Date ? s.startDate : new Date(s.startDate)).getTime();
      return { t: t, bpm: Number(s.quantity) };
    })
    .filter(function (p) { return Number.isFinite(p.t) && Number.isFinite(p.bpm) && p.bpm > 0; })
    .sort(function (a, b) { return a.t - b.t; });

  for (let i = 0; i < pts.length; i++) {
    const next = pts[i + 1];
    const dt = next ? Math.min((next.t - pts[i].t) / 1000, HR_MAX_GAP_S) : 5;
    if (dt <= 0) continue;
    const bpm = pts[i].bpm;
    const zone = bpm < loThreshold ? 'recup' : (bpm < hiThreshold ? 'modere' : 'intense');
    acc[zone] += dt;
  }

  return [
    { key: 'recup', label: 'Récupération', seconds: Math.round(acc.recup) },
    { key: 'modere', label: 'Modéré', seconds: Math.round(acc.modere) },
    { key: 'intense', label: 'Intense', seconds: Math.round(acc.intense) },
  ];
}

/**
 * Cherche le workout Pilates de la montre qui chevauche le plus la séance
 * in-app, sur [start−15 min, end+15 min]. Garde uniquement les workouts de type
 * Pilates (66) qui NE viennent PAS de notre app (on exclut par bundle id, sinon
 * on matcherait le workout qu'on écrit nous-mêmes). Retourne le WorkoutProxy
 * @kingstinct, ou null.
 */
export async function getPilatesWorkoutForSession(sessionStart, sessionEnd) {
  const init = await ensureHealthKitInit();
  if (!init.ok || !sessionStart || !sessionEnd) return null;

  const startDate = new Date(sessionStart.getTime() - MATCH_BUFFER_MS);
  const endDate = new Date(sessionEnd.getTime() + MATCH_BUFFER_MS);
  let workouts;
  try {
    workouts = await HK.queryWorkoutSamples({
      limit: 0,
      ascending: false,
      filter: { date: { startDate, endDate } },
    });
  } catch (e) {
    return null;
  }
  if (!Array.isArray(workouts) || !workouts.length) return null;

  const ss = sessionStart.getTime();
  const se = sessionEnd.getTime();
  let best = null;
  for (let i = 0; i < workouts.length; i++) {
    const w = workouts[i];
    if (w.workoutActivityType !== WORKOUT_ACTIVITY_PILATES) continue;
    const src = w.sourceRevision && w.sourceRevision.source ? w.sourceRevision.source : null;
    const bundle = src ? src.bundleIdentifier : null;
    // Exclure le workout écrit par NOTRE app (même type 66) — on ne veut que
    // celui mesuré par la montre, qui porte les samples de FC.
    if (bundle && bundle.indexOf(OUR_SOURCE_BUNDLE_ID) === 0) continue;
    const ws = (w.startDate instanceof Date ? w.startDate : new Date(w.startDate)).getTime();
    const we = (w.endDate instanceof Date ? w.endDate : new Date(w.endDate)).getTime();
    const overlap = Math.min(we, se) - Math.max(ws, ss);
    if (overlap > 0 && (!best || overlap > best.overlap)) best = { w: w, overlap: overlap };
  }
  return best ? best.w : null;
}

/**
 * Vrai s'il existe déjà un workout Pilates mesuré par la montre (≠ notre app)
 * chevauchant [start, end]. Utilisé par App.js pour ne PAS écrire notre propre
 * workout en doublon (sinon double entrée dans l'app Forme / Santé).
 */
export async function hasWatchPilatesWorkout(sessionStart, sessionEnd) {
  const w = await getPilatesWorkoutForSession(sessionStart, sessionEnd);
  return !!w;
}

/**
 * Construit le récap d'une séance à partir du workout Pilates de la montre.
 * Lit la FC via queryQuantitySamples sur la FENÊTRE PROPRE du workout, scopée à
 * SA source (même périmètre que getStatistic) → le badge FC moy/max et la barre
 * de zones restent cohérents. Retourne `{ durationMin, calories, avgBpm,
 * maxBpm, zones, source }`, ou null si aucun workout Pilates montre trouvé.
 */
export async function buildSessionRecap(sessionStart, sessionEnd, hrMax) {
  const workout = await getPilatesWorkoutForSession(sessionStart, sessionEnd);
  if (!workout) return null;

  const wStart = workout.startDate instanceof Date ? workout.startDate : new Date(workout.startDate);
  const wEnd = workout.endDate instanceof Date ? workout.endDate : new Date(workout.endDate);
  const source = workout.sourceRevision && workout.sourceRevision.source ? workout.sourceRevision.source : null;

  // FC moy/max : statistique scopée au workout lui-même (sa source, sa fenêtre).
  let avgBpm = null;
  let maxBpm = null;
  try {
    const stat = workout.getStatistic ? await workout.getStatistic(ID.HeartRate, 'count/min') : null;
    if (stat) {
      if (stat.averageQuantity && Number.isFinite(stat.averageQuantity.quantity)) avgBpm = Math.round(stat.averageQuantity.quantity);
      if (stat.maximumQuantity && Number.isFinite(stat.maximumQuantity.quantity)) maxBpm = Math.round(stat.maximumQuantity.quantity);
    }
  } catch (e) {}

  // Échantillons FC bruts (même fenêtre + même source) pour le temps-en-zone.
  let hrSamples = [];
  try {
    const opts = {
      limit: 0,
      ascending: true,
      unit: 'count/min',
      filter: { date: { startDate: wStart, endDate: wEnd } },
    };
    if (source) opts.filter.sources = [source];
    const s = await HK.queryQuantitySamples(ID.HeartRate, opts);
    hrSamples = Array.isArray(s) ? s : [];
  } catch (e) {}

  // Secours : si getStatistic n'a rien renvoyé, calcule avg/max depuis les samples.
  if ((avgBpm == null || maxBpm == null) && hrSamples.length) {
    let sum = 0;
    let cnt = 0;
    let mx = 0;
    for (let i = 0; i < hrSamples.length; i++) {
      const v = Math.round(Number(hrSamples[i].quantity) || 0);
      if (v < 30 || v > 230) continue;
      sum += v; cnt += 1; if (v > mx) mx = v;
    }
    if (cnt) {
      if (avgBpm == null) avgBpm = Math.round(sum / cnt);
      if (maxBpm == null) maxBpm = mx;
    }
  }

  const durationMin = Math.max(1, Math.round((wEnd.getTime() - wStart.getTime()) / 60000));
  let calories = null;
  if (workout.totalEnergyBurned && Number.isFinite(workout.totalEnergyBurned.quantity)) {
    calories = Math.round(workout.totalEnergyBurned.quantity);
  }

  return {
    durationMin: durationMin,
    calories: calories,
    avgBpm: avgBpm,
    maxBpm: maxBpm,
    zones: computeZones(hrSamples, hrMax),
    source: source ? source.name : null,
  };
}

/**
 * Anti-doublon Apple Forme (« write now, clean up later »). On écrit notre
 * workout Pilates dès la fin de séance (App.js), mais l'Apple Watch synchronise
 * le sien avec un délai. Au chargement de l'écran Activité, on rattrape : pour
 * `forDate`, si un workout Pilates écrit par NOTRE app chevauche un workout
 * Pilates mesuré par la montre, on supprime le nôtre (la montre porte la FC, sa
 * version est canonique). Supprime par uuid via deleteObjects. Retourne le
 * nombre de workouts supprimés.
 */
export async function cleanupDuplicatePilatesWorkouts(forDate) {
  const init = await ensureHealthKitInit();
  if (!init.ok) return 0;
  const { startDate, endDate } = dateBounds(forDate);

  let workouts;
  try {
    workouts = await HK.queryWorkoutSamples({
      limit: 0,
      ascending: false,
      filter: { date: { startDate, endDate } },
    });
  } catch (e) {
    return 0;
  }
  if (!Array.isArray(workouts) || !workouts.length) return 0;

  const ours = [];
  const watch = [];
  for (let i = 0; i < workouts.length; i++) {
    const w = workouts[i];
    if (w.workoutActivityType !== WORKOUT_ACTIVITY_PILATES) continue;
    const bundle = w.sourceRevision && w.sourceRevision.source ? w.sourceRevision.source.bundleIdentifier : null;
    if (bundle && bundle.indexOf(OUR_SOURCE_BUNDLE_ID) === 0) ours.push(w);
    else watch.push(w);
  }
  if (!ours.length || !watch.length) return 0;

  const span = function (w) {
    return {
      s: (w.startDate instanceof Date ? w.startDate : new Date(w.startDate)).getTime(),
      e: (w.endDate instanceof Date ? w.endDate : new Date(w.endDate)).getTime(),
    };
  };

  let removed = 0;
  for (let i = 0; i < ours.length; i++) {
    const o = span(ours[i]);
    const overlapsWatch = watch.some(function (w) {
      const ws = span(w);
      return Math.min(o.e, ws.e) - Math.max(o.s, ws.s) > 0;
    });
    if (!overlapsWatch || !ours[i].uuid) continue;
    try {
      const n = await HK.deleteObjects(ID.Workout, { uuid: ours[i].uuid });
      removed += typeof n === 'number' ? n : 1;
    } catch (e) {}
  }
  return removed;
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
  clampHrMax,
  defaultHrMax,
  computeZones,
  getPilatesWorkoutForSession,
  hasWatchPilatesWorkout,
  buildSessionRecap,
  cleanupDuplicatePilatesWorkouts,
};
