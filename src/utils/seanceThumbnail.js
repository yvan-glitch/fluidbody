// seanceThumbnail — vignettes réelles des séances (Phase 1, 07.10.2026).
//
// Chaque séance filmée a sa propre image : une image tirée de SA vidéo Bunny
// Stream, au timestamp `video_assets.thumbnail_time` (secondes). Les images
// sont générées par `scripts/sync-thumbnails.js` et déposées dans le bucket
// Supabase public `thumbnails/` ; l'URL publique est écrite dans
// `video_assets.thumbnail_url` (seule colonne exposée au client avec
// session_id). Pas de signature, pas de token : une vignette n'est pas du
// contenu premium, elle s'affiche aussi sur les séances verrouillées.
//
// Tant qu'une séance n'a pas de vignette, on retombe sur la photo actuelle
// (getSeanceImage) : jamais de carte vide.
//
// Requête SÉPARÉE de catalogVisibility : si la migration n'est pas encore
// poussée (colonne absente), seule cette requête échoue, la visibilité du
// catalogue n'est pas impactée.

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../lib/supabase';
import { getSeanceImage } from '../constants/data';

const CACHE_KEY = 'fluid_seance_thumbs_v1';
const FETCH_TIMEOUT_MS = 8000;

let thumbs = {}; // { 'p7_5': 'https://…/thumbnails/p7_5.jpg?v=…' }
let version = 0;
const listeners = new Set();

function notify() {
  version += 1;
  listeners.forEach(function (fn) { try { fn(version); } catch (e) {} });
}

function apply(map) {
  if (!map || typeof map !== 'object') return;
  const keys = Object.keys(map);
  let same = keys.length === Object.keys(thumbs).length;
  if (same) keys.forEach(function (k) { if (thumbs[k] !== map[k]) same = false; });
  thumbs = map;
  if (!same) notify();
}

let primed = false;
export async function primeSeanceThumbnails() {
  if (primed) return;
  primed = true;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) apply(JSON.parse(raw));
  } catch (e) {}
  if (!supabase) return;
  try {
    const fetchP = supabase
      .from('video_assets')
      .select('session_id, thumbnail_url')
      .not('thumbnail_url', 'is', null);
    const timeoutP = new Promise(function (resolve) {
      setTimeout(function () { resolve({ data: null, error: new Error('timeout') }); }, FETCH_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([fetchP, timeoutP]);
    if (!error && Array.isArray(data)) {
      const map = {};
      data.forEach(function (r) {
        if (r && r.session_id && typeof r.thumbnail_url === 'string' && r.thumbnail_url) map[r.session_id] = r.thumbnail_url;
      });
      apply(map);
      try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch (e) {}
    }
  } catch (e) {}
}

export function useSeanceThumbnailsVersion() {
  const [v, setV] = useState(version);
  useEffect(function () {
    primeSeanceThumbnails();
    listeners.add(setV);
    return function () { listeners.delete(setV); };
  }, []);
  return v;
}

export function getSeanceThumbnailUri(pilierKey, idx) {
  return thumbs[pilierKey + '_' + idx] || null;
}

// Source d'image prête pour expo-image : vignette vidéo si dispo, sinon
// photo de repli (fallback explicite, ou getSeanceImage).
export function getSeanceVisual(pilierKey, idx, fallback) {
  const uri = getSeanceThumbnailUri(pilierKey, idx);
  if (uri) return { uri: uri };
  return fallback !== undefined ? fallback : getSeanceImage(pilierKey, idx);
}
