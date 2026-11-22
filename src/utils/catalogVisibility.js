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
//   true (depuis le 13.11.2026) — les séances sans vidéo sont masquées, les
//   piliers sans aucune vidéo disparaissent des listes. Tous les écrans suivent.
//   false — comportement historique, tout le catalogue visible.
//
// Exception admin (13.11.2026) : les comptes admin (Yvan, Sabrina) gardent le
// catalogue complet, qui leur sert de plan de tournage. App.js appelle
// setCatalogAdminMode(isAdmin) ; les séances sans vidéo portent alors le
// badge « À filmer ».
//
// Convention d'id : `${pilierKey}_${index}` — l'index est TOUJOURS celui du
// tableau source dans data.js. Les helpers renvoient des paires {seance, idx}
// pour que le filtrage ne renumérote jamais rien.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import { SEANCES_FR, SEANCE_DISPLAY_FIRST } from '../constants/data';

export const HIDE_UNFILMED = true;

let adminSeeAll = false;
export function isCatalogAdminMode() { return adminSeeAll; }
// Vrai quand les séances sans vidéo doivent être masquées pour CE compte.
export function isHidingUnfilmed() { return HIDE_UNFILMED && !adminSeeAll; }

const CACHE_KEY = 'fluid_video_sessions_v1';
const DATES_KEY = 'fluid_video_dates_v1';
const PLACES_KEY = 'fluid_video_places_v1';
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

// Dates de publication (video_assets.created_at), pour la rangée « Nouveautés ».
let remoteDates = {}; // { session_id: ISO }
function applyRemoteDates(map) {
  if (!map || typeof map !== 'object') return;
  const same = JSON.stringify(map) === JSON.stringify(remoteDates);
  remoteDates = map;
  if (!same) notify();
}

// Ids des séances de piliers publiées depuis moins de `days` jours, la plus
// récente d'abord. Pur (testable) : tout vient des arguments.
export function pickRecentIds(dates, now, days, max) {
  const limit = (days || 14) * 86400000;
  const t0 = now.getTime();
  return Object.keys(dates || {})
    .filter(function (id) { return /^p\d+_\d+$/.test(id); })
    .map(function (id) { return { id: id, t: Date.parse(dates[id]) }; })
    .filter(function (x) { return Number.isFinite(x.t) && t0 - x.t <= limit && x.t - t0 < 86400000; })
    .sort(function (a, b) { return b.t - a.t || (a.id < b.id ? -1 : 1); })
    .slice(0, max || 8)
    .map(function (x) { return x.id; });
}

// Lieux de tournage (video_assets.location) : { session_id: 'Minorque' }.
let remotePlaces = {};
function applyRemotePlaces(map) {
  if (!map || typeof map !== 'object') return;
  const same = JSON.stringify(map) === JSON.stringify(remotePlaces);
  remotePlaces = map;
  if (!same) notify();
}
export function getVideoPlace(pilierKey, idx) {
  return remotePlaces[pilierKey + '_' + idx] || null;
}
// [{ place, ids: [...] }] pour les lieux qui comptent au moins `min` vidéos
// de piliers, le lieu le plus fourni d'abord. Pur.
export function groupByPlace(places, min) {
  const by = {};
  Object.keys(places || {}).forEach(function (id) {
    const p = places[id];
    if (!p || !/^p\d+_\d+$/.test(id)) return;
    (by[p] = by[p] || []).push(id);
  });
  return Object.keys(by)
    .filter(function (p) { return by[p].length >= (min || 2); })
    .map(function (p) { return { place: p, ids: by[p].sort() }; })
    .sort(function (a, b) { return b.ids.length - a.ids.length || (a.place < b.place ? -1 : 1); });
}
export function videoPlaces(min) { return groupByPlace(remotePlaces, min); }

export function recentVideoIds(days, max) {
  return pickRecentIds(remoteDates, new Date(), days, max);
}

let primed = false;
export async function primeCatalogVisibility() {
  if (primed) return;
  primed = true;
  // 1. Cache local d'abord (démarrage hors-ligne).
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) applyRemoteIds(JSON.parse(raw));
    const rawDates = await AsyncStorage.getItem(DATES_KEY);
    if (rawDates) applyRemoteDates(JSON.parse(rawDates));
    const rawPlaces = await AsyncStorage.getItem(PLACES_KEY);
    if (rawPlaces) applyRemotePlaces(JSON.parse(rawPlaces));
  } catch (e) {}
  // 2. Refresh réseau best-effort.
  if (!supabase) return;
  try {
    const timeoutP = new Promise(function (resolve) {
      setTimeout(function () { resolve({ data: null, error: new Error('timeout') }); }, FETCH_TIMEOUT_MS);
    });
    // created_at n'est lisible qu'après la migration 20261122020000 ; tant
    // qu'elle n'est pas poussée, la requête échoue et on retombe sur
    // session_id seul (pas de rangée « Nouveautés », rien d'autre ne change).
    // Même principe pour `location` (migration 20261122180000).
    let res = await Promise.race([supabase.from('video_assets').select('session_id, created_at, location'), timeoutP]);
    if (!res || res.error || !Array.isArray(res.data)) {
      res = await Promise.race([supabase.from('video_assets').select('session_id, created_at'), timeoutP]);
    }
    if (!res || res.error || !Array.isArray(res.data)) {
      res = await Promise.race([supabase.from('video_assets').select('session_id'), timeoutP]);
    }
    const data = res && res.data;
    const error = res && res.error;
    if (!error && Array.isArray(data)) {
      const ids = data.map(function (r) { return r && r.session_id; }).filter(Boolean);
      applyRemoteIds(ids);
      try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(ids)); } catch (e) {}
      const dates = {};
      data.forEach(function (r) { if (r && r.session_id && r.created_at) dates[r.session_id] = r.created_at; });
      if (Object.keys(dates).length > 0) {
        applyRemoteDates(dates);
        try { await AsyncStorage.setItem(DATES_KEY, JSON.stringify(dates)); } catch (e) {}
      }
      if (data.length > 0 && data[0] && 'location' in data[0]) {
        const places = {};
        data.forEach(function (r) { if (r && r.session_id && r.location) places[r.session_id] = String(r.location).trim(); });
        applyRemotePlaces(places);
        try { await AsyncStorage.setItem(PLACES_KEY, JSON.stringify(places)); } catch (e) {}
      }
    }
  } catch (e) {}
}

export function setCatalogAdminMode(on) {
  const next = !!on;
  if (next === adminSeeAll) return;
  adminSeeAll = next;
  notify();
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
  if (!isHidingUnfilmed()) return true;
  return hasVideo(pilierKey, idx);
}

// Index du tableau source dans l'ordre d'affichage : les séances de
// SEANCE_DISPLAY_FIRST[pilierKey] d'abord, puis les autres dans l'ordre.
export function displayOrder(pilierKey, n) {
  const first = ((SEANCE_DISPLAY_FIRST && SEANCE_DISPLAY_FIRST[pilierKey]) || []).filter(function (i) { return i >= 0 && i < n; });
  const out = first.slice();
  for (let i = 0; i < n; i++) if (first.indexOf(i) === -1) out.push(i);
  return out;
}

// [{seance, idx}] — idx = index du tableau source, jamais renuméroté.
export function visibleSeances(seances, pilierKey) {
  const out = [];
  const list = seances || [];
  displayOrder(pilierKey, list.length).forEach(function (i) {
    if (isSeanceVisible(pilierKey, i)) out.push({ seance: list[i], idx: i });
  });
  return out;
}

export function countVisible(seances, pilierKey) {
  if (!isHidingUnfilmed()) return (seances || []).length;
  let n = 0;
  (seances || []).forEach(function (s, i) {
    if (isSeanceVisible(pilierKey, i)) n += 1;
  });
  return n;
}

// Nombre de séances réellement filmées (pour le compteur admin).
export function countFilmed(seances, pilierKey) {
  let n = 0;
  (seances || []).forEach(function (s, i) {
    if ((s && s[3] === true) || hasVideo(pilierKey, i)) n += 1;
  });
  return n;
}

export function pilierHasContent(pilierKey, seancesByKey) {
  if (!isHidingUnfilmed()) return true;
  return countVisible((seancesByKey || {})[pilierKey], pilierKey) > 0;
}

// Réservé aux tests.
export function __resetForTests(ids) {
  primed = false;
  adminSeeAll = false;
  remoteSet = Array.isArray(ids) ? new Set(ids) : null;
}
