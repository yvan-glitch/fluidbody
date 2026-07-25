// videoDurations — cache des durées RÉELLES des vidéos (2026-07-25).
//
// Problème : les durées affichées sur les cards viennent de data.js (saisies
// à la main) et peuvent différer de la vidéo réelle (ex. « Réveil hormonal »
// annoncé 15 min, vidéo de 13 min). La vraie durée n'est connue qu'une fois
// la vidéo chargée (status.durationMillis d'expo-av).
//
// Solution : VideoPlayer appelle saveVideoDurationMin() dès que la durée est
// connue ; les écrans passent leur libellé statique dans
// getRealDurationLabel() qui le remplace si une durée réelle est en cache.
// Persistance AsyncStorage + pub/sub pour re-render (même pattern que
// downloadsCache).

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fluid_video_durations_v1';

let map = null; // { 'p9_5': 13, ... } minutes arrondies
let primed = false;
const listeners = new Set();

function notify() {
  listeners.forEach(function (fn) {
    try { fn(); } catch (e) {}
  });
}

export function subscribeDurations(fn) {
  listeners.add(fn);
  return function () { listeners.delete(fn); };
}

export async function primeDurationsCache() {
  if (primed) return;
  primed = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    map = raw ? JSON.parse(raw) : {};
  } catch (e) {
    map = {};
  }
  notify();
}

/**
 * Libellé durée pour une séance : durée réelle si connue, sinon fallback
 * (le libellé statique de data.js).
 */
export function getRealDurationLabel(pilierKey, idx, fallback) {
  if (!map || pilierKey == null || idx == null) return fallback;
  const min = map[pilierKey + '_' + idx];
  return typeof min === 'number' && min > 0 ? min + ' min' : fallback;
}

/**
 * Appelé par VideoPlayer dès que durationMillis est connu. Arrondit à la
 * minute (>= 1). No-op si identique au cache.
 */
export function saveVideoDurationMin(pilierKey, idx, durationMillis) {
  if (pilierKey == null || idx == null) return;
  if (!durationMillis || !Number.isFinite(durationMillis)) return;
  const min = Math.max(1, Math.round(durationMillis / 60000));
  if (!map) map = {};
  const key = pilierKey + '_' + idx;
  if (map[key] === min) return;
  map[key] = min;
  notify();
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map)).catch(function () {});
}
