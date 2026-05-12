// HealthKit helper — reads (DOB, sex, height, weight, calories, exercise,
// stand) and writes (height, weight) the data the new onboarding + Activity
// screen need.
//
// All calls are promise-based wrappers around the imperative
// `react-native-health` API. The module is safe to require everywhere:
// outside iOS or when the native module isn't linked (Expo Go), every
// function resolves to `{ ok: false, reason: 'unsupported' }` so callers
// can branch without try/catch.
//
// Initialisation:
//   `ensureHealthKitInit()` is a singleton-style lazy init. It builds the
//   permission scope lazily — accessing `AppleHealthKit.Constants` at module
//   load time has been observed to crash via NSException when HK is not yet
//   initialised on iPhone (see App.js comment block on the same topic).

import { Platform } from 'react-native';

// HK désactivé globalement après le crash NSException de build #43 sur
// iOS 26.5 + New Arch (cf. App.js HEALTHKIT_DISABLED). isSupported() le
// reflète, donc ensureHealthKitInit() résout sur { ok: false } et toutes
// les lectures/écritures retournent leur valeur "vide" sans toucher
// react-native-health.
const HEALTHKIT_DISABLED = true;

let AppleHealthKit = null;
try {
  AppleHealthKit = require('react-native-health').default || require('react-native-health');
} catch (e) {}

let initialised = false;
let initInFlight = null;

function isSupported() {
  if (HEALTHKIT_DISABLED) return false;
  return !!AppleHealthKit && Platform.OS === 'ios';
}

function buildPermissions() {
  if (!AppleHealthKit) return null;
  try {
    const C = (AppleHealthKit.Constants && AppleHealthKit.Constants.Permissions) || {};
    return {
      permissions: {
        read: [
          C.HeartRate,
          C.ActiveEnergyBurned,
          C.AppleExerciseTime,
          C.AppleStandTime,
          C.Workout,
          C.WorkoutRoute,
          C.BodyMass,
          C.Height,
          C.DateOfBirth,
          C.BiologicalSex,
          C.StepCount,
          C.DistanceWalkingRunning,
          C.FlightsClimbed,
          C.BasalEnergyBurned,
        ].filter(Boolean),
        write: [
          C.ActiveEnergyBurned,
          C.Workout,
          C.HeartRate,
          C.BodyMass,
          C.Height,
        ].filter(Boolean),
      },
    };
  } catch (e) {
    return null;
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
  const perms = buildPermissions();
  if (!perms) return Promise.resolve({ ok: false, reason: 'no-permissions' });
  initInFlight = new Promise(function (resolve) {
    try {
      AppleHealthKit.initHealthKit(perms, function (err) {
        if (err) {
          initInFlight = null;
          resolve({ ok: false, reason: 'init-error', error: err });
          return;
        }
        initialised = true;
        initInFlight = null;
        resolve({ ok: true });
      });
    } catch (e) {
      initInFlight = null;
      resolve({ ok: false, reason: 'init-throw', error: e });
    }
  });
  return initInFlight;
}

export function isHealthKitReady() {
  return initialised;
}

/** Date of birth as `YYYY-MM-DD` string, or null. */
export function readDateOfBirth() {
  return new Promise(function (resolve) {
    if (!initialised) { resolve(null); return; }
    try {
      AppleHealthKit.getDateOfBirth(null, function (err, res) {
        if (err || !res) { resolve(null); return; }
        const value = res.value || res.dateOfBirth;
        if (!value) { resolve(null); return; }
        const d = new Date(value);
        if (isNaN(d.getTime())) { resolve(null); return; }
        const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        resolve(iso);
      });
    } catch (e) { resolve(null); }
  });
}

/** Biological sex normalised to {female|male|other|null}. */
export function readBiologicalSex() {
  return new Promise(function (resolve) {
    if (!initialised) { resolve(null); return; }
    try {
      AppleHealthKit.getBiologicalSex(null, function (err, res) {
        if (err || !res) { resolve(null); return; }
        const v = (res.value || '').toString().toLowerCase();
        if (v === 'female') resolve('female');
        else if (v === 'male') resolve('male');
        else if (v === 'other') resolve('nonbinary');
        else resolve(null);
      });
    } catch (e) { resolve(null); }
  });
}

/** Most-recent body mass in kg, or null. */
export function readLatestWeightKg() {
  return new Promise(function (resolve) {
    if (!initialised) { resolve(null); return; }
    try {
      AppleHealthKit.getLatestWeight({ unit: 'gram' }, function (err, res) {
        if (err || !res) { resolve(null); return; }
        const grams = Number(res.value);
        if (!isFinite(grams) || grams <= 0) { resolve(null); return; }
        resolve(Math.round((grams / 1000) * 10) / 10);
      });
    } catch (e) { resolve(null); }
  });
}

/** Most-recent height in cm, or null. */
export function readLatestHeightCm() {
  return new Promise(function (resolve) {
    if (!initialised) { resolve(null); return; }
    try {
      AppleHealthKit.getLatestHeight({ unit: 'meter' }, function (err, res) {
        if (err || !res) { resolve(null); return; }
        const meters = Number(res.value);
        if (!isFinite(meters) || meters <= 0) { resolve(null); return; }
        resolve(Math.round(meters * 100));
      });
    } catch (e) { resolve(null); }
  });
}

/** Save a weight sample (kg) to HK. Resolves `{ ok, error? }`. */
export function writeWeightKg(weightKg) {
  return new Promise(function (resolve) {
    if (!initialised || !isFinite(weightKg) || weightKg <= 0) {
      resolve({ ok: false }); return;
    }
    try {
      AppleHealthKit.saveWeight({ value: weightKg, unit: 'kilogram' }, function (err) {
        if (err) { resolve({ ok: false, error: err }); return; }
        resolve({ ok: true });
      });
    } catch (e) { resolve({ ok: false, error: e }); }
  });
}

/** Save a height sample (cm). Resolves `{ ok, error? }`. */
export function writeHeightCm(heightCm) {
  return new Promise(function (resolve) {
    if (!initialised || !isFinite(heightCm) || heightCm <= 0) {
      resolve({ ok: false }); return;
    }
    try {
      AppleHealthKit.saveHeight({ value: heightCm / 100, unit: 'meter' }, function (err) {
        if (err) { resolve({ ok: false, error: err }); return; }
        resolve({ ok: true });
      });
    } catch (e) { resolve({ ok: false, error: e }); }
  });
}

function dayBoundsLocal(date) {
  const d = date || new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Today's Activity-ring totals: { moveKcal, exerciseMin, standHours }.
 * Each metric is summed independently and resolves to 0 on any failure
 * so callers can render an empty state without branching.
 */
export function readActivitySummary(forDate) {
  return new Promise(function (resolve) {
    if (!initialised) { resolve({ moveKcal: 0, exerciseMin: 0, standHours: 0 }); return; }
    const { start, end } = dayBoundsLocal(forDate);
    const opts = { startDate: start, endDate: end };
    const out = { moveKcal: 0, exerciseMin: 0, standHours: 0 };
    let remaining = 3;
    function done() { remaining--; if (remaining <= 0) resolve(out); }
    try {
      AppleHealthKit.getActiveEnergyBurned(opts, function (err, res) {
        if (!err && Array.isArray(res)) {
          out.moveKcal = Math.round(res.reduce(function (s, r) { return s + (Number(r.value) || 0); }, 0));
        }
        done();
      });
    } catch (e) { done(); }
    try {
      AppleHealthKit.getAppleExerciseTime(opts, function (err, res) {
        if (!err && Array.isArray(res)) {
          out.exerciseMin = Math.round(res.reduce(function (s, r) { return s + (Number(r.value) || 0); }, 0));
        }
        done();
      });
    } catch (e) { done(); }
    try {
      AppleHealthKit.getAppleStandTime(opts, function (err, res) {
        if (!err && Array.isArray(res)) {
          // AppleStandTime returns *minutes per stand event*; the visible
          // ring count is the number of distinct stand hours, which the API
          // already represents as one entry per hour the user stood ≥1 min.
          out.standHours = res.filter(function (r) { return (Number(r.value) || 0) > 0; }).length;
          // Cap at 24 just in case of duplicate hourly samples.
          if (out.standHours > 24) out.standHours = 24;
        }
        done();
      });
    } catch (e) { done(); }
  });
}

/**
 * Extra "Details du jour" stats: steps, distance (km), flights climbed,
 * basal+active calories, average + max HR.
 */
export function readDayDetails(forDate) {
  return new Promise(function (resolve) {
    if (!initialised) {
      resolve({ steps: 0, distanceKm: 0, flights: 0, totalKcal: 0, avgHr: null, maxHr: null });
      return;
    }
    const { start, end } = dayBoundsLocal(forDate);
    const opts = { startDate: start, endDate: end };
    const out = { steps: 0, distanceKm: 0, flights: 0, totalKcal: 0, avgHr: null, maxHr: null };
    let remaining = 6;
    function done() { remaining--; if (remaining <= 0) resolve(out); }
    try {
      AppleHealthKit.getStepCount(opts, function (err, res) {
        if (!err && res && res.value != null) out.steps = Math.round(Number(res.value) || 0);
        done();
      });
    } catch (e) { done(); }
    try {
      AppleHealthKit.getDistanceWalkingRunning(opts, function (err, res) {
        if (!err && res && res.value != null) {
          // Default unit metres.
          out.distanceKm = Math.round((Number(res.value) || 0) / 100) / 10;
        }
        done();
      });
    } catch (e) { done(); }
    try {
      AppleHealthKit.getFlightsClimbed(opts, function (err, res) {
        if (!err && res && res.value != null) out.flights = Math.round(Number(res.value) || 0);
        done();
      });
    } catch (e) { done(); }
    try {
      AppleHealthKit.getActiveEnergyBurned(opts, function (err, res) {
        if (!err && Array.isArray(res)) {
          out.totalKcal += Math.round(res.reduce(function (s, r) { return s + (Number(r.value) || 0); }, 0));
        }
        done();
      });
    } catch (e) { done(); }
    try {
      AppleHealthKit.getBasalEnergyBurned(opts, function (err, res) {
        if (!err && Array.isArray(res)) {
          out.totalKcal += Math.round(res.reduce(function (s, r) { return s + (Number(r.value) || 0); }, 0));
        }
        done();
      });
    } catch (e) { done(); }
    try {
      AppleHealthKit.getHeartRateSamples({ startDate: start, endDate: end, limit: 500, ascending: false }, function (err, samples) {
        if (!err && Array.isArray(samples) && samples.length > 0) {
          let sum = 0; let max = 0;
          for (let i = 0; i < samples.length; i++) {
            const v = Math.round(Number(samples[i].value) || 0);
            if (v < 30 || v > 230) continue;
            sum += v;
            if (v > max) max = v;
          }
          if (samples.length > 0) {
            out.avgHr = Math.round(sum / samples.length) || null;
            out.maxHr = max || null;
          }
        }
        done();
      });
    } catch (e) { done(); }
  });
}

/** Workouts authored by us (or any source) for a given day. */
export function readDayWorkouts(forDate) {
  return new Promise(function (resolve) {
    if (!initialised) { resolve([]); return; }
    const { start, end } = dayBoundsLocal(forDate);
    try {
      AppleHealthKit.getSamples(
        {
          startDate: start,
          endDate: end,
          type: 'Workout',
          limit: 50,
          ascending: false,
        },
        function (err, samples) {
          if (err || !Array.isArray(samples)) { resolve([]); return; }
          resolve(samples.map(function (s) {
            const dur = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000;
            return {
              id: s.id || (s.startDate + '_' + s.endDate),
              startDate: s.startDate,
              endDate: s.endDate,
              durationMin: isFinite(dur) ? Math.max(1, Math.round(dur)) : null,
              energyKcal: s.totalEnergyBurned != null ? Math.round(Number(s.totalEnergyBurned)) : null,
              activity: s.activityName || s.workoutActivityType || 'Workout',
              source: s.sourceName || null,
            };
          }));
        }
      );
    } catch (e) { resolve([]); }
  });
}

/**
 * Daily aggregates over the last N days. Returns an array of
 * `{ date: 'YYYY-MM-DD', moveKcal, exerciseMin, standHours }` ordered
 * oldest → newest. Used for the week tracker + trends sparklines.
 */
export function readActivityHistory(days) {
  const n = Math.max(1, Math.min(60, days || 7));
  return new Promise(function (resolve) {
    if (!initialised) {
      const empty = [];
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        empty.push({
          date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
          moveKcal: 0, exerciseMin: 0, standHours: 0,
        });
      }
      resolve(empty);
      return;
    }
    const tasks = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      tasks.push({
        date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
        dateObj: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
      });
    }
    let remaining = tasks.length;
    const out = tasks.map(function () { return null; });
    if (remaining === 0) { resolve([]); return; }
    tasks.forEach(function (t, idx) {
      readActivitySummary(t.dateObj).then(function (summary) {
        out[idx] = {
          date: t.date,
          moveKcal: summary.moveKcal,
          exerciseMin: summary.exerciseMin,
          standHours: summary.standHours,
        };
        remaining--;
        if (remaining <= 0) resolve(out);
      });
    });
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
  readActivitySummary,
  readDayDetails,
  readDayWorkouts,
  readActivityHistory,
};
