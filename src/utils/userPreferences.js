// userPreferences — config app niveau utilisateur, persistée via AsyncStorage.
//
// Couvre quatre toggles/choix accessibles depuis Profil > Préférences :
//   - streamQuality       ('auto' | 'eco' | 'standard' | 'hd')
//   - hdDownloadsAlways   (bool) — skip le picker de qualité au tap ↓
//   - wifiOnlyDownload    (bool, default true) — bloque les DL hors Wi-Fi
//   - backgroundAudio     (bool) — Audio.setAudioModeAsync staysActiveInBackground
//
// API :
//   - getPref(key) / setPref(key, value) — async, AsyncStorage
//   - getAllPrefs() — async, retourne tout l'objet
//   - getCachedPrefs() / getCachedPref(key) — sync, depuis le cache mémoire
//   - primePreferencesCache() — async, à appeler au mount de l'app
//   - subscribePrefs(fn) — retourne unsub, notifié à chaque setPref
//
// Cache mémoire synchronisé pour permettre aux composants critiques
// (VideoPlayer audio mode, getSignedVideoUrl) de lire sans round-trip
// AsyncStorage. Toutes les écritures notifient les abonnés.

import AsyncStorage from '@react-native-async-storage/async-storage';

export const PREF_KEYS = {
  streamQuality:     'fluid_pref_stream_quality_v1',
  hdDownloadsAlways: 'fluid_pref_hd_downloads_v1',
  wifiOnlyDownload:  'fluid_pref_wifi_only_v1',
  backgroundAudio:   'fluid_pref_bg_audio_v1',
};

export const PREFS_DEFAULTS = {
  streamQuality: 'auto',
  hdDownloadsAlways: false,
  wifiOnlyDownload: true,
  backgroundAudio: false,
};

export const STREAM_QUALITY_OPTIONS = ['auto', 'eco', 'standard', 'hd'];

let _cache = Object.assign({}, PREFS_DEFAULTS);
const _subs = new Set();

function _notify() { _subs.forEach(function (fn) { try { fn(_cache); } catch (e) {} }); }

function _coerce(name, raw) {
  // Coerce raw AsyncStorage strings vers le type attendu.
  if (raw == null) return PREFS_DEFAULTS[name];
  if (name === 'streamQuality') {
    return STREAM_QUALITY_OPTIONS.indexOf(raw) !== -1 ? raw : PREFS_DEFAULTS.streamQuality;
  }
  // bools persistés comme '1' / '0'.
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return PREFS_DEFAULTS[name];
}

function _serialize(name, value) {
  if (name === 'streamQuality') {
    return STREAM_QUALITY_OPTIONS.indexOf(value) !== -1 ? value : PREFS_DEFAULTS.streamQuality;
  }
  return value ? '1' : '0';
}

export async function primePreferencesCache() {
  try {
    const names = Object.keys(PREF_KEYS);
    const storageKeys = names.map(function (n) { return PREF_KEYS[n]; });
    const pairs = await AsyncStorage.multiGet(storageKeys);
    const next = Object.assign({}, PREFS_DEFAULTS);
    pairs.forEach(function (p, i) {
      const name = names[i];
      next[name] = _coerce(name, p[1]);
    });
    _cache = next;
    _notify();
  } catch (e) { /* keep defaults */ }
}

export function getCachedPrefs() { return _cache; }
export function getCachedPref(name) {
  if (name in _cache) return _cache[name];
  return PREFS_DEFAULTS[name];
}

export async function getAllPrefs() {
  await primePreferencesCache();
  return _cache;
}

export async function getPref(name) {
  if (!(name in PREF_KEYS)) return PREFS_DEFAULTS[name];
  try {
    const raw = await AsyncStorage.getItem(PREF_KEYS[name]);
    const v = _coerce(name, raw);
    _cache = Object.assign({}, _cache, { [name]: v });
    return v;
  } catch (e) {
    return PREFS_DEFAULTS[name];
  }
}

export async function setPref(name, value) {
  if (!(name in PREF_KEYS)) return;
  try {
    await AsyncStorage.setItem(PREF_KEYS[name], _serialize(name, value));
    _cache = Object.assign({}, _cache, { [name]: value });
    _notify();
  } catch (e) {}
}

export function subscribePrefs(fn) {
  _subs.add(fn);
  return function () { _subs.delete(fn); };
}
