// Live heart-rate hook for in-session display.
//
// Reads HR samples via HealthKit (Apple Santé). Data source can be any device
// feeding HK — Apple Watch is the most common but iPhone-only setups, 3rd-party
// chest straps, or sleep trackers also work as long as they post HR to HK.
//
// What we do:
//   • start() captures `startedAt`, starts a 4s polling loop on
//     queryQuantitySamples for HeartRate over the last 30s.
//   • stop() halts the loop and returns a session summary (durationMs,
//     avgBpm, maxBpm, minBpm, sampleCount) so the caller can save it as
//     a workout via saveHealthKitWorkout.
//   • Cleans up on unmount.
//
// HK sync timing: HR samples can lag by seconds to ~minutes depending on the
// authoring device's state (Watch locked / wrist down / dnd). The 30s lookback
// window is a pragmatic balance between freshness and tolerating short sync gaps.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { readRecentHeartRate as hcReadRecentHr } from '../utils/health';

// HK kill-switch — à garder pour pouvoir désactiver HealthKit côté JS sans
// rebuild natif si un nouveau crash apparaît sur une version iOS future.
const HEALTHKIT_DISABLED = false;

let HK = null;
try {
  HK = require('@kingstinct/react-native-healthkit');
} catch (e) {}

const HR_ID = 'HKQuantityTypeIdentifierHeartRate';
const POLL_INTERVAL_MS = 4000;
const SAMPLE_LOOKBACK_MS = 30000;
const STALE_THRESHOLD_MS = 15000;

function sourceNameOf(sample) {
  try {
    if (sample && sample.sourceRevision && sample.sourceRevision.source) {
      return sample.sourceRevision.source.name || null;
    }
  } catch (e) {}
  return null;
}

async function fetchRecentHr() {
  if (HEALTHKIT_DISABLED) return null;
  // Android → Health Connect (lecture du dernier BPM récent via la façade).
  if (Platform.OS === 'android') {
    try {
      const r = hcReadRecentHr ? await hcReadRecentHr() : null;
      if (!r || !r.bpm) return null;
      return { bpm: r.bpm, source: 'Health Connect', measuredAt: r.measuredAt };
    } catch (e) { return null; }
  }
  if (!HK || Platform.OS !== 'ios') return null;
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
    const chosen = samples[0];
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
  const [isActive, setIsActive] = useState(false);

  // Running aggregates for the current session. Re-init on every start().
  const aggRef = useRef({ sum: 0, count: 0, max: 0, min: Infinity, startedAt: null, samples: [] });
  const pollHandleRef = useRef(null);
  const lastMeasuredAtRef = useRef(null);

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
    if (HEALTHKIT_DISABLED || !enabled) return;
    if (Platform.OS === 'ios' && !HK) return;          // iOS sans HealthKit
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return; // ni iOS ni Android (ex. web)
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
    source: source,
    lastUpdate: lastUpdate,
    isActive: isActive,
    start: start,
    stop: stop,
  };
}
