// catalogVisibility — source de vérité unique pour « cette séance a-t-elle
// une vidéo ? » et « faut-il la montrer ? ».
//
// Pourquoi : pour la soumission App Store, rien de visible ne doit être
// injouable (guideline 2.1). Le catalogue complet (175 séances) reste dans
// data.js ; ce module décide de ce qui s'affiche.
//
// Deux sources, fusionnées :
//   1. Bundle : flag `true` en 4e position du tuple séance (data.js).
//   2. Remote : table Supabase `video_assets` (colonne session_id seule,
//      exposée par la migration 20260726000000_video_assets_public_list.sql).
//      Rafraîchie au lancement, cachée en AsyncStorage. Une vidéo ajoutée en
//      DB apparaît donc dans l'app sans OTA ni rebuild.
//
// Interrupteur produit : HIDE_UNFILMED.
//   false (aujourd'hui) — comportement historique, tout le catalogue visible.
//   true (build de soumission) — les séances sans vidéo sont masquées, les
//   piliers sans aucune vidéo disparaissent des listes. Un seul endroit à
//   flipper, tous les écrans suivent.
//
// Convention d'id : `${pilierKey}_${index}` — l'index est TOUJOURS celui du
// tableau source dans data.js. Les helpers renvoient des paires {seance, idx}
// pour que le filtrage ne renumérote jamais rien.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import { SEANCES_FR } from '../constants/data';

export const HIDE_UNFILMED = false;

const CACHE_KEY = 'fluid_video_sessions_v1';
const FETCH_TIMEOUT_MS = 8000;

// --- Source 1 : flags du bundle -------------------------------------------

const bundledSet = (function () {
  const s = new Set();
  try {
    Object.keys(SEANCES_FR || {}).forEach(function (pk) {
      (SEANCES_FR[pk] || []).forEach(function (t, i) {
        if (t && t[3] === true) s.add(pk + '_' + i);
      });
    });
  } catch (e) {}
  return s;
})();

// --- Source 2 : liste remote (cache + refresh) -----------------------------

let remoteSet = null; // Set<string> des session_id présents dans video_assets
let version = 0; // incrémenté à chaque changement, pour les re-renders
const listeners = new Set();

function notify() {
  version += 1;
  listeners.forEach(function (fn) {
    try { fn(version); } catch (e) {}
  });
}

function applyRemoteIds(ids) {
  if (!Array.isArray(ids)) return;
  const next = new Set(ids.filter(function (x) { return typeof x === 'string' && x; }));
  // Ne notifie que si le contenu change vraiment.
  let same = remoteSet && next.size === remoteSet.size;
  if (same) {
    next.forEach(function (id) { if (!remoteSet.has(id)) same = false; });
  }
  remoteSet = next;
  if (!same) notify();
}

let primed = false;
export async function primeCatalogVisibility() {
  if (primed) return;
  primed = true;
  // 1. Cache local d'abord (démarrage hors-ligne).
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) applyRemoteIds(JSON.parse(raw));
  } catch (e) {}
  // 2. Refresh réseau best-effort.
  if (!supabase) return;
  try {
    const fetchP = supabase.from('video_assets').select('session_id');
    const timeoutP = new Promise(function (resolve) {
      setTimeout(function () { resolve({ data: null, error: new Error('timeout') }); }, FETCH_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([fetchP, timeoutP]);
    if (!error && Array.isArray(data)) {
      const ids = data.map(function (r) { return r && r.session_id; }).filter(Boolean);
      applyRemoteIds(ids);
      try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(ids)); } catch (e) {}
    }
  } catch (e) {}
}

export function subscribeCatalogVisibility(fn) {
  listeners.add(fn);
  return function () { listeners.delete(fn); };
}

// Hook de commodité : re-render quand la liste remote arrive/change.
export function useCatalogVersion() {
  const [v, setV] = useState(version);
  useEffect(function () { return subscribeCatalogVisibility(setV); }, []);
  return v;
}

// --- Prédicats -------------------------------------------------------------

export function hasVideo(pilierKey, idx) {
  const id = pilierKey + '_' + idx;
  if (bundledSet.has(id)) return true;
  return !!(remoteSet && remoteSet.has(id));
}

export function isSeanceVisible(pilierKey, idx) {
  if (!HIDE_UNFILMED) return true;
  return hasVideo(pilierKey, idx);
}

// [{seance, idx}] — idx = index du tableau source, jamais renuméroté.
export function visibleSeances(seances, pilierKey) {
  const out = [];
  (seances || []).forEach(function (s, i) {
    if (isSeanceVisible(pilierKey, i)) out.push({ seance: s, idx: i });
  });
  return out;
}

export function countVisible(seances, pilierKey) {
  if (!HIDE_UNFILMED) return (seances || []).length;
  let n = 0;
  (seances || []).forEach(function (s, i) {
    if (isSeanceVisible(pilierKey, i)) n += 1;
  });
  return n;
}

export function pilierHasContent(pilierKey, seancesByKey) {
  if (!HIDE_UNFILMED) return true;
  return countVisible((seancesByKey || {})[pilierKey], pilierKey) > 0;
}

// Réservé aux tests.
export function __resetForTests(ids) {
  primed = false;
  remoteSet = Array.isArray(ids) ? new Set(ids) : null;
}
