// useAppleWatchPresence — lightweight one-shot probe for an Apple Watch on the
// user's account. Mirrors the heuristic used by `useLiveHeartRate` (7-day
// HeartRate sample window, source-name match on /apple\s*watch/i) but never
// starts a polling loop, so it can sit at the top of Activity / Profil to
// show a discreet connection indicator without taxing HealthKit.

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const HEALTHKIT_DISABLED = false;

let HK = null;
try { HK = require('@kingstinct/react-native-healthkit'); } catch (e) {}

const HR_ID = 'HKQuantityTypeIdentifierHeartRate';
const PROBE_DAYS = 7;

function sourceOf(s) {
  try { return (s && s.sourceRevision && s.sourceRevision.source) || null; }
  catch (e) { return null; }
}

function isWatch(srcName) {
  if (!srcName) return false;
  return /apple\s*watch/i.test(srcName);
}

async function probe() {
  if (HEALTHKIT_DISABLED || !HK || Platform.OS !== 'ios') return { present: false, model: null };
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - PROBE_DAYS * 24 * 3600 * 1000);
    const samples = await HK.queryQuantitySamples(HR_ID, {
      limit: 50,
      ascending: false,
      unit: 'count/min',
      filter: { date: { startDate, endDate } },
    });
    if (!Array.isArray(samples)) return { present: false, model: null };
    let model = null;
    for (let i = 0; i < samples.length; i++) {
      const src = sourceOf(samples[i]);
      const name = src && src.name;
      if (isWatch(name)) { model = name; break; }
    }
    return { present: !!model, model };
  } catch (e) {
    return { present: false, model: null };
  }
}

export default function useAppleWatchPresence() {
  // null = unknown / still probing, true|false = settled.
  const [hasAppleWatch, setHasAppleWatch] = useState(null);
  const [model, setModel] = useState(null);

  useEffect(function () {
    let cancelled = false;
    probe().then(function (res) {
      if (cancelled) return;
      setHasAppleWatch(!!res.present);
      setModel(res.model || null);
    });
    return function () { cancelled = true; };
  }, []);

  return { hasAppleWatch, model };
}
