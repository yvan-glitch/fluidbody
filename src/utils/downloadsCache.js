// downloadsCache — couche réactive au-dessus de DownloadManager.
//
// DownloadManager.js gère le téléchargement, le chiffrement XOR, le stockage.
// Mais il n'est pas branché à un système d'abonnement, donc les cards qui
// affichent l'état "téléchargé / en cours / pas téléchargé" doivent toutes
// re-poller. On encapsule ici :
//   - un cache mémoire `{ [pilierKey_idx]: { status, progress, size, date } }`
//   - un pub/sub minimal pour rafraîchir les UI quand l'état change
//   - les helpers `startDownload`, `removeDownload`, `removeAll` qui
//     mettent à jour le cache à chaque étape de l'opération
//
// Le cache se prime au mount root via `primeDownloadsCache()` (cf. App.js
// ou MonCorps.js). Les composants appellent `subscribeDownloads(fn)` +
// `getCachedDownloads()` pour rendre vite, ou `getDownloadEntry(id)`
// directement pour une card unique.
//
// Convention session id : `${pilierKey}_${seanceIndex}` — même clé que
// favorites/resume/video_assets.

import { Alert } from 'react-native';

import {
  downloadVideo,
  deleteDownload,
  deleteAllDownloads,
  getDownloads,
  getStorageUsed,
  formatBytes,
} from '../components/DownloadManager';
import { getCachedPref } from './userPreferences';

// NetInfo : non installé en hard-dep (cf. package.json). Safe-require pour
// dégrader gracieusement — si le module n'est pas dispo, on autorise tous
// les downloads (préférence Wi-Fi-only sans effet, message log dev).
let _NetInfo = null;
try { _NetInfo = require('@react-native-community/netinfo').default; } catch (e) {}

function devLog() {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log.apply(console, ['[downloads]'].concat(Array.prototype.slice.call(arguments)));
  }
}

// État local cache : map id → { status, progress (0..1), size, date, error }.
// status ∈ 'idle' | 'downloading' | 'done' | 'error'.
let _cache = {};
let _storageBytes = 0;
const _subs = new Set();

function _notify() {
  _subs.forEach(function (fn) { try { fn(); } catch (e) {} });
}

function _idFor(pilierKey, idx) {
  if (!pilierKey || typeof idx !== 'number') return null;
  return pilierKey + '_' + idx;
}

export function subscribeDownloads(fn) {
  _subs.add(fn);
  return function () { _subs.delete(fn); };
}

// Snapshot synchrone du cache. Utiliser pour rerender côté composant.
export function getCachedDownloads() { return _cache; }

// Bytes totaux téléchargés (mis à jour au mount/refresh + après chaque
// download/delete). Pour l'UI "234 MB téléchargés".
export function getCachedStorageBytes() { return _storageBytes; }

// Helper d'affichage exposé directement pour ne pas dupliquer ailleurs.
export { formatBytes };

export function getDownloadEntry(pilierKey, idx) {
  const id = _idFor(pilierKey, idx);
  if (!id) return null;
  return _cache[id] || null;
}

export function isDownloadedCached(pilierKey, idx) {
  const e = getDownloadEntry(pilierKey, idx);
  return !!(e && e.status === 'done');
}

// Lit l'état persistant + recalcule storage. Appelé au cold start et
// après les opérations qui touchent le filesystem.
export async function primeDownloadsCache() {
  try {
    const data = await getDownloads();
    _cache = data || {};
    _storageBytes = await getStorageUsed();
    _notify();
  } catch (e) {
    // Silent — un cache vide est OK comme fallback.
  }
}

// Démarre un download. Met le status à 'downloading' immédiatement, notify
// l'UI, puis lance l'opération réelle (DownloadManager) avec callback de
// progression qui met à jour `progress` (0..1).
//
// Sur erreur (signing, réseau, FileSystem), surface un Alert.alert au lieu
// de fail silencieusement — sinon l'utilisateur tape, rien ne semble se
// passer et le bug est invisible.
export async function startDownload(pilierKey, idx, quality) {
  const id = _idFor(pilierKey, idx);
  devLog('startDownload', pilierKey, idx, 'q=', quality, '→ id', id);
  if (!id) {
    Alert.alert('Téléchargement', 'Identifiant de séance invalide (' + pilierKey + ' / ' + idx + ')');
    return false;
  }
  // Pas de double-launch sur un download déjà en cours.
  if (_cache[id] && _cache[id].status === 'downloading') {
    devLog('startDownload', id, 'already downloading - no-op');
    return false;
  }

  // Préf "Télécharger uniquement en Wi-Fi" — check NetInfo si dispo.
  // Si le module n'est pas installé, on log et autorise (préférence sans effet).
  if (getCachedPref('wifiOnlyDownload')) {
    if (_NetInfo && _NetInfo.fetch) {
      try {
        const state = await _NetInfo.fetch();
        const isWifi = state && state.type === 'wifi';
        devLog('startDownload', id, 'wifiOnly check - type=', state && state.type);
        if (!isWifi) {
          Alert.alert(
            'Téléchargement bloqué',
            'L\'option « Télécharger uniquement en Wi-Fi » est active. Connecte-toi en Wi-Fi ou désactive l\'option dans Profil > Préférences.',
            [{ text: 'OK' }]
          );
          return false;
        }
      } catch (e) {
        devLog('startDownload', id, 'NetInfo.fetch threw - allowing download', e && e.message);
      }
    } else {
      devLog('startDownload', id, 'NetInfo unavailable, ignoring wifiOnly pref');
    }
  }
  _cache[id] = { status: 'downloading', progress: 0, quality: quality || 'standard', date: new Date().toISOString() };
  _notify();
  try {
    devLog('startDownload', id, 'calling downloadVideo…');
    await downloadVideo(pilierKey, idx, function (p) {
      // Mise à jour progressive (sans spam : on agrège à 1% près).
      const prev = (_cache[id] && _cache[id].progress) || 0;
      if (p - prev >= 0.01 || p === 1) {
        _cache[id] = Object.assign({}, _cache[id], { status: 'downloading', progress: p });
        _notify();
      }
    }, quality);
    devLog('startDownload', id, 'success - re-priming cache');
    // Re-prime pour récupérer la taille finale + status 'done' depuis disque.
    await primeDownloadsCache();
    return true;
  } catch (e) {
    const msg = (e && e.message) || 'Erreur inconnue';
    devLog('startDownload', id, 'FAILED →', msg);
    _cache[id] = { status: 'error', progress: 0, date: new Date().toISOString(), error: msg };
    _notify();
    Alert.alert(
      'Téléchargement impossible',
      msg + '\n\nVérifie ta connexion ou ton abonnement, puis réessaie.',
      [{ text: 'OK' }]
    );
    return false;
  }
}

export async function removeDownload(pilierKey, idx) {
  const id = _idFor(pilierKey, idx);
  if (!id) return;
  try {
    await deleteDownload(pilierKey, idx);
  } catch (e) {}
  delete _cache[id];
  try { _storageBytes = await getStorageUsed(); } catch (e) {}
  _notify();
}

export async function removeAllDownloads() {
  try { await deleteAllDownloads(); } catch (e) {}
  _cache = {};
  _storageBytes = 0;
  _notify();
}
