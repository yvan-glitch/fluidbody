// favorites: gestion des séances favorites (cœur dans la Bibliothèque).
//
// Stratégie : cache AsyncStorage prioritaire pour un rendu instantané
// hors-ligne ; Supabase comme source de vérité cross-device. Toute
// modification est écrite localement (optimistic), puis pushée en
// background. La lecture (`getFavorites`) renvoie le cache et, si un
// supabase est fourni, déclenche un resync async qui met à jour le
// cache pour la prochaine lecture.
//
// `session_id` suit la convention partagée (`${pilierKey}_${seanceIndex}`),
// même clé que video_assets et DownloadManager — on évite donc d'introduire
// une 3e nomenclature.

import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'fluid_favorites';

function devWarn(...args) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }
}

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (typeof id !== 'string' || !id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function readCache() {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeIds(parsed);
  } catch (e) {
    return [];
  }
}

async function writeCache(ids) {
  try {
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(normalizeIds(ids)));
  } catch (e) {
    devWarn('[favorites] writeCache failed', e?.message || e);
  }
}

// Resync from Supabase: lit la liste serveur, met à jour le cache
// localement. Renvoie la liste fraîche (array d'IDs) ou null si la
// resync n'a pas pu aboutir (offline, pas de user, etc.) — le caller
// fallback alors sur le cache.
async function fetchRemoteFavorites(supabase, userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_favorites')
      .select('session_id, favorited_at')
      .eq('user_id', userId)
      .order('favorited_at', { ascending: false });
    if (error || !Array.isArray(data)) return null;
    return data.map((r) => r.session_id).filter(Boolean);
  } catch (e) {
    return null;
  }
}

// API publique ─────────────────────────────────────────────────────────

// Renvoie la liste de favoris (array d'IDs). Pull from cache d'abord ;
// si supabase + userId fournis, déclenche un resync background et
// renvoie la version la plus fraîche disponible synchronously.
export async function getFavorites(supabase, userId) {
  const cached = await readCache();
  if (!supabase || !userId) return cached;
  const remote = await fetchRemoteFavorites(supabase, userId);
  if (remote) {
    await writeCache(remote);
    return remote;
  }
  return cached;
}

// Toggle idempotent. Renvoie la liste à jour pour permettre au caller
// de mettre à jour son state local sans relire le cache.
export async function toggleFavorite(supabase, userId, sessionId) {
  if (!sessionId) return null;
  const current = await readCache();
  const has = current.indexOf(sessionId) !== -1;
  const next = has
    ? current.filter((id) => id !== sessionId)
    : [sessionId, ...current];
  await writeCache(next);

  // Optimistic remote write (best-effort, non-bloquant pour l'UI).
  if (supabase && userId) {
    try {
      if (has) {
        await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('session_id', sessionId);
      } else {
        await supabase
          .from('user_favorites')
          .upsert(
            { user_id: userId, session_id: sessionId },
            { onConflict: 'user_id,session_id', ignoreDuplicates: true },
          );
      }
    } catch (e) {
      devWarn('[favorites] remote write failed', e?.message || e);
    }
  }

  return next;
}

export function isFavorite(favorites, sessionId) {
  if (!sessionId || !Array.isArray(favorites)) return false;
  return favorites.indexOf(sessionId) !== -1;
}

// Helper pour bâtir l'ID séance partagé avec video_assets / DownloadManager.
export function buildFavoriteId(pilierKey, seanceIndex) {
  if (!pilierKey || typeof seanceIndex !== 'number') return null;
  return `${pilierKey}_${seanceIndex}`;
}

// Reset local — utile au sign-out pour purger les préférences précédentes.
export async function clearLocalFavorites() {
  try {
    await AsyncStorage.removeItem(FAVORITES_KEY);
  } catch (e) {}
}

// ── Couche cache synchrone (Apple TV) ───────────────────────────────────
// La TV n'a pas de Supabase câblé ; on garde un cache mémoire synchrone +
// un pub/sub pour que les cœurs des cards se mettent à jour instantanément.
// Le toggle écrit en local (best-effort, sans remote). Additif → iPhone safe.
let _favCache = [];
const _favSubs = new Set();
function _notifyFav() { _favSubs.forEach(function (fn) { try { fn(); } catch (e) {} }); }

export function getCachedFavorites() { return _favCache; }
export function isFavoriteCached(sessionId) { return !!sessionId && _favCache.indexOf(sessionId) !== -1; }
export function subscribeFavorites(fn) { _favSubs.add(fn); return function () { _favSubs.delete(fn); }; }

export function primeFavoritesCache() {
  getFavorites().then(function (ids) { _favCache = Array.isArray(ids) ? ids : []; _notifyFav(); }).catch(function () {});
}

// Toggle local-only (TV) : écrit le cache AsyncStorage partagé, met à jour le
// cache mémoire et notifie les abonnés. Pas de remote (supabase indispo TV).
export async function toggleFavoriteLocal(sessionId) {
  const next = await toggleFavorite(undefined, undefined, sessionId);
  if (Array.isArray(next)) { _favCache = next; _notifyFav(); }
  return _favCache;
}
