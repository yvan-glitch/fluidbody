// Live heart-rate hook for in-session display.
//
// Why no HKWorkoutSession here:
//   HKWorkoutSession is a watchOS-only API. From the iPhone side, the closest
//   we can do (without a companion watchOS app) is poll HKHealthStore for the
//   most recent HeartRate samples authored by the Apple Watch and bracket the
//   session with a single HKWorkout record on stop().
//
// What we do:
//   • One-shot Apple-Watch heuristic on mount (7-day HR window, source name
//     contains "Apple Watch" — covers all watch models).
//   • start() captures `startedAt`, starts a 4s polling loop on
//     queryQuantitySamples for HeartRate over the last 30s.
//   • stop() halts the loop and returns a session summary (durationMs,
//     avgBpm, maxBpm, minBpm, sampleCount) so the caller can save it as
//     a workout via saveHealthKitWorkout.
//   • Cleans up on unmount.
//
// Apple Watch privacy quirk: HR samples are authored asynchronously by the
// watch and synced to iPhone with a delay of seconds to ~minutes depending
// on watch state (locked / wrist down / dnd). The 30s lookback window is a
// pragmatic balance between freshness and tolerating short sync gaps.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

// HK désactivé tant que la migration Kingstinct n'est pas validée sur device.
// Sera flipé à false dans le commit "feat(health): re-enable" séparé.
const HEALTHKIT_DISABLED = true;

let HK = null;
try {
  HK = require('@kingstinct/react-native-healthkit');
} catch (e) {}

const HR_ID = 'HKQuantityTypeIdentifierHeartRate';
const POLL_INTERVAL_MS = 4000;
const SAMPLE_LOOKBACK_MS = 30000;
const STALE_THRESHOLD_MS = 15000;
const APPLE_WATCH_PROBE_DAYS = 7;

function sourceNameOf(sample) {
  try {
    if (sample && sample.sourceRevision && sample.sourceRevision.source) {
      return sample.sourceRevision.source.name || null;
    }
  } catch (e) {}
  return null;
}

function isAppleWatchSource(sourceName) {
  if (!sourceName) return false;
  return /apple\s*watch/i.test(sourceName);
}

async function probeAppleWatchPresence() {
  if (HEALTHKIT_DISABLED || !HK || Platform.OS !== 'ios') return false;
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - APPLE_WATCH_PROBE_DAYS * 24 * 3600 * 1000);
    const samples = await HK.queryQuantitySamples(HR_ID, {
      limit: 50,
      ascending: false,
      unit: 'count/min',
      filter: { date: { startDate, endDate } },
    });
    if (!Array.isArray(samples)) return false;
    return samples.some(function (s) { return isAppleWatchSource(sourceNameOf(s)); });
  } catch (e) {
    return false;
  }
}

async function fetchRecentHr() {
  if (HEALTHKIT_DISABLED || !HK || Platform.OS !== 'ios') return null;
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - SAMPLE_LOOKBACK_MS);
    const samples = await HK.queryQuantitySamples(HR_ID, {
      limit: 5,
      ascending: false,
      unit: 'count/min',
      filter: { date: { startDate, endDate } },
    });
    if (!Array.isArray(samples) || samples.length === 0) return null;
    // Préférence : sample Apple Watch le plus récent. Sinon, le plus récent
    // tout court (utile si la watch n'a pas encore re-sync mais qu'un autre
    // device — sleep tracker tiers, par ex. — a posté).
    const watch = samples.find(function (s) { return isAppleWatchSource(sourceNameOf(s)); });
    const chosen = watch || samples[0];
    const bpm = Math.round(Number(chosen.quantity) || 0);
    if (!bpm || bpm < 30 || bpm > 230) return null;
    const measuredAt = chosen.endDate instanceof Date
      ? chosen.endDate.getTime()
      : new Date(chosen.endDate || chosen.startDate).getTime();
    return {
      bpm: bpm,
      source: sourceNameOf(chosen) || 'unknown',
      measuredAt: measuredAt,
    };
  } catch (e) {
    return null;
  }
}

/**
 * @param {Object}   opts
 * @param {boolean=} opts.enabled  When false, the hook never polls. Use this
 *                                 to honor the user's "show HR" setting.
 */
export default function useLiveHeartRate(opts) {
  const enabled = opts ? opts.enabled !== false : true;

  const [bpm, setBpm] = useState(null);
  const [source, setSource] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [hasAppleWatch, setHasAppleWatch] = useState(null); // null = unknown
  const [isActive, setIsActive] = useState(false);

  // Running aggregates for the current session. Re-init on every start().
  const aggRef = useRef({ sum: 0, count: 0, max: 0, min: Infinity, startedAt: null, samples: [] });
  const pollHandleRef = useRef(null);
  const lastMeasuredAtRef = useRef(null);

  // Probe Apple Watch presence on first mount.
  useEffect(function () {
    let cancelled = false;
    probeAppleWatchPresence().then(function (present) {
      if (!cancelled) setHasAppleWatch(!!present);
    });
    return function () { cancelled = true; };
  }, []);

  const tick = useCallback(async function () {
    const s = await fetchRecentHr();
    if (!s) return;
    if (lastMeasuredAtRef.current && s.measuredAt <= lastMeasuredAtRef.current) {
      // Échantillon déjà comptabilisé — ne double pas l'agrégat.
      return;
    }
    lastMeasuredAtRef.current = s.measuredAt;
    setBpm(s.bpm);
    setSource(s.source);
    setLastUpdate(Date.now());
    const a = aggRef.current;
    a.sum += s.bpm;
    a.count += 1;
    if (s.bpm > a.max) a.max = s.bpm;
    if (s.bpm < a.min) a.min = s.bpm;
    // On garde une trace courte pour debug ; 200 points = 13 min à 4s/poll.
    if (a.samples.length < 200) a.samples.push({ bpm: s.bpm, t: s.measuredAt });
  }, []);

  const start = useCallback(function () {
    if (HEALTHKIT_DISABLED || !enabled || !HK || Platform.OS !== 'ios') return;
    if (pollHandleRef.current) return;
    aggRef.current = { sum: 0, count: 0, max: 0, min: Infinity, startedAt: Date.now(), samples: [] };
    lastMeasuredAtRef.current = null;
    setBpm(null);
    setIsActive(true);
    // Premier tick immédiat pour ne pas attendre 4s avant le 1er BPM affiché.
    tick();
    pollHandleRef.current = setInterval(tick, POLL_INTERVAL_MS);
  }, [enabled, tick]);

  const stop = useCallback(function () {
    if (pollHandleRef.current) {
      clearInterval(pollHandleRef.current);
      pollHandleRef.current = null;
    }
    setIsActive(false);
    const a = aggRef.current;
    if (!a.startedAt || a.count === 0) {
      return { durationMs: a.startedAt ? Date.now() - a.startedAt : 0, avgBpm: null, maxBpm: null, minBpm: null, sampleCount: 0 };
    }
    return {
      durationMs: Date.now() - a.startedAt,
      avgBpm: Math.round(a.sum / a.count),
      maxBpm: a.max,
      minBpm: a.min === Infinity ? null : a.min,
      sampleCount: a.count,
    };
  }, []);

  // Hard-stop on unmount — pas de zombie interval qui sonde HealthKit après
  // la dispatch du VideoPlayer.
  useEffect(function () {
    return function () {
      if (pollHandleRef.current) {
        clearInterval(pollHandleRef.current);
        pollHandleRef.current = null;
      }
    };
  }, []);

  // Statut "live" calculé à chaque render mais sans setInterval supplémentaire :
  // VideoPlayer fait déjà un re-render toutes les secondes (timer), donc
  // l'opacity du pill se met à jour naturellement.
  const isLive = useMemo(function () {
    if (!lastUpdate) return false;
    return Date.now() - lastUpdate < STALE_THRESHOLD_MS;
  }, [lastUpdate]);

  return {
    bpm: bpm,
    isLive: isLive,
    hasAppleWatch: hasAppleWatch,
    source: source,
    lastUpdate: lastUpdate,
    isActive: isActive,
    start: start,
    stop: stop,
  };
}
