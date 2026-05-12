// Live heart-rate hook for in-session display.
//
// Why no HKWorkoutSession here:
//   HKWorkoutSession is a watchOS-only API. From the iPhone side, the closest
//   we can do (without a companion watchOS app) is poll HKHealthStore for the
//   most recent HeartRate samples authored by the Apple Watch and bracket the
//   session with a single HKWorkout record on stop().
//   react-native-health doesn't expose HKWorkoutBuilder (iOS 17+) yet, so
//   `saveWorkout` after-the-fact is the only path.
//
// What we do:
//   • One-shot Apple-Watch heuristic on mount (7-day HR window, sourceName
//     contains "Apple Watch" — covers all watch models).
//   • start() captures `startedAt`, starts a 4s polling loop on
//     getHeartRateSamples({ last 30s window }).
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

// HK désactivé globalement après le crash NSException de build #43 sur
// iOS 26.5 + New Arch (cf. App.js HEALTHKIT_DISABLED). Tant que ce flag
// est true, aucun appel natif AppleHealthKit.* n'est émis depuis le hook.
const HEALTHKIT_DISABLED = true;

let AppleHealthKit = null;
try {
  AppleHealthKit = require('react-native-health').default || require('react-native-health');
} catch (e) {}

const POLL_INTERVAL_MS = 4000;
const SAMPLE_LOOKBACK_MS = 30000;
const STALE_THRESHOLD_MS = 15000;
const APPLE_WATCH_PROBE_DAYS = 7;

function isAppleWatchSource(sourceName) {
  if (!sourceName) return false;
  return /apple\s*watch/i.test(sourceName);
}

function probeAppleWatchPresence() {
  return new Promise(function (resolve) {
    if (HEALTHKIT_DISABLED || !AppleHealthKit || Platform.OS !== 'ios') {
      resolve(false);
      return;
    }
    try {
      const end = new Date();
      const start = new Date(end.getTime() - APPLE_WATCH_PROBE_DAYS * 24 * 3600 * 1000);
      AppleHealthKit.getHeartRateSamples(
        { startDate: start.toISOString(), endDate: end.toISOString(), limit: 50, ascending: false },
        function (err, samples) {
          if (err || !Array.isArray(samples)) {
            resolve(false);
            return;
          }
          const seen = samples.some(function (s) { return isAppleWatchSource(s.sourceName); });
          resolve(seen);
        },
      );
    } catch (e) {
      resolve(false);
    }
  });
}

function fetchRecentHr() {
  return new Promise(function (resolve) {
    if (HEALTHKIT_DISABLED || !AppleHealthKit || Platform.OS !== 'ios') {
      resolve(null);
      return;
    }
    try {
      const end = new Date();
      const start = new Date(end.getTime() - SAMPLE_LOOKBACK_MS);
      AppleHealthKit.getHeartRateSamples(
        { startDate: start.toISOString(), endDate: end.toISOString(), limit: 5, ascending: false },
        function (err, samples) {
          if (err || !Array.isArray(samples) || samples.length === 0) {
            resolve(null);
            return;
          }
          // Préférence : sample Apple Watch le plus récent. Sinon, le plus
          // récent tout court (utile si la watch n'a pas encore re-sync mais
          // qu'un autre device — sleep tracker tiers, par ex. — a posté).
          const watch = samples.find(function (s) { return isAppleWatchSource(s.sourceName); });
          const chosen = watch || samples[0];
          const bpm = Math.round(Number(chosen.value) || 0);
          if (!bpm || bpm < 30 || bpm > 230) {
            resolve(null);
            return;
          }
          resolve({
            bpm: bpm,
            source: chosen.sourceName || 'unknown',
            measuredAt: new Date(chosen.endDate || chosen.startDate).getTime(),
          });
        },
      );
    } catch (e) {
      resolve(null);
    }
  });
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
    if (HEALTHKIT_DISABLED || !enabled || !AppleHealthKit || Platform.OS !== 'ios') return;
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

  // Hard-stop on unmount — pas de zombie interval qui sondé HealthKit après
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
