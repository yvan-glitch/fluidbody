// Ambient sound singleton — plays one looping track at low volume during
// a session. Designed to be safe to call from any screen: each public
// method tolerates missing assets, unmounted state, and Expo Go (where
// expo-av may be partially available but interruption modes are flaky).
//
// Storage:
//   - `fluid_ambient_sound`  : selected track slug ('silence' | 'ocean' | 'medusae' | 'forest')
//   - `fluid_ambient_volume` : 0.0 → 1.0 (default 0.3)
//
// Assets live in `assets/ambient/{ocean,medusae,forest}.m4a`. If a file
// is missing (current state — see docs/assets/ambient-sound.md), the
// require() returns undefined; we treat that as silence rather than
// throwing, so the UI still works for picking + persisting a preference.
//
// IMPORTANT: this util is intentionally *not* wired into VideoPlayer in
// this branch (see INTEGRATION_NOTES.md). The Profil setting persists a
// preference that the player will read once the integration is unblocked.

import AsyncStorage from '@react-native-async-storage/async-storage';

// Lazy-require expo-av so the util never throws at import time in
// environments where the native module is missing (Expo Go on some
// platforms, web preview, jest).
var _Audio = null;
try {
  _Audio = require('expo-av').Audio;
} catch (e) {
  _Audio = null;
}

export var STORAGE_KEY_SOUND = 'fluid_ambient_sound';
export var STORAGE_KEY_VOLUME = 'fluid_ambient_volume';

// Track manifest. Slugs match the doc (`docs/assets/ambient-sound.md`).
// `asset` is the require() result — undefined means the file isn't
// bundled yet, in which case `play()` is a no-op.
export var AMBIENT_TRACKS = (function () {
  function tryRequire(spec) {
    try { return spec(); } catch (e) { return undefined; }
  }
  return [
    { slug: 'silence', asset: null },
    { slug: 'ocean', asset: tryRequire(function () { return require('../../assets/ambient/ocean.m4a'); }) },
    { slug: 'medusae', asset: tryRequire(function () { return require('../../assets/ambient/medusae.m4a'); }) },
    { slug: 'forest', asset: tryRequire(function () { return require('../../assets/ambient/forest.m4a'); }) },
  ];
})();

export var DEFAULT_VOLUME = 0.3;
export var DEFAULT_SLUG = 'silence';

// Internal singleton state. Exported as `_state` for tests / debugging
// only — production code goes through the named functions below.
var _state = {
  sound: null,        // the active Audio.Sound instance (or null)
  slug: DEFAULT_SLUG, // currently playing slug
  volume: DEFAULT_VOLUME,
  loading: false,     // guards against overlapping createAsync calls
};

function trackBySlug(slug) {
  for (var i = 0; i < AMBIENT_TRACKS.length; i++) {
    if (AMBIENT_TRACKS[i].slug === slug) return AMBIENT_TRACKS[i];
  }
  return null;
}

function devWarn(msg, err) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[ambientSound] ' + msg, err || '');
  }
}

// Restore the user's preference (track + volume) from AsyncStorage.
// Returns `{ slug, volume }` with sane defaults — never rejects.
export async function loadPreference() {
  var slug = DEFAULT_SLUG;
  var volume = DEFAULT_VOLUME;
  try {
    var raw = await AsyncStorage.getItem(STORAGE_KEY_SOUND);
    if (raw && trackBySlug(raw)) slug = raw;
  } catch (e) {}
  try {
    var rawV = await AsyncStorage.getItem(STORAGE_KEY_VOLUME);
    if (rawV != null) {
      var parsed = parseFloat(rawV);
      if (isFinite(parsed)) volume = Math.max(0, Math.min(1, parsed));
    }
  } catch (e) {}
  return { slug: slug, volume: volume };
}

// Persist `slug` and immediately reflect it in the running player if any.
// Use this from settings UIs.
export async function setPreference(slug) {
  if (!trackBySlug(slug)) return;
  try { await AsyncStorage.setItem(STORAGE_KEY_SOUND, slug); } catch (e) {}
  // If something is already playing, swap to the new track. If the new
  // slug is 'silence', this collapses to a stop.
  if (_state.sound) {
    await play(slug);
  } else {
    _state.slug = slug;
  }
}

export async function setVolume(volume) {
  var v = Math.max(0, Math.min(1, isFinite(volume) ? volume : DEFAULT_VOLUME));
  _state.volume = v;
  try { await AsyncStorage.setItem(STORAGE_KEY_VOLUME, String(v)); } catch (e) {}
  if (_state.sound) {
    try { await _state.sound.setVolumeAsync(v); } catch (e) {}
  }
}

// Start (or swap to) the track identified by `slug`. Silently no-ops if
// `slug === 'silence'`, expo-av is unavailable, or the asset is missing.
export async function play(slug) {
  if (!_Audio) return;
  if (_state.loading) return;
  _state.loading = true;
  try {
    // Always tear down whatever's currently playing first — simpler than
    // tracking which file is loaded vs requested.
    await _stopInternal();

    var resolvedSlug = slug || _state.slug || DEFAULT_SLUG;
    _state.slug = resolvedSlug;
    if (resolvedSlug === 'silence') return;

    var track = trackBySlug(resolvedSlug);
    if (!track || !track.asset) {
      devWarn('asset missing for slug=' + resolvedSlug + ' — see docs/assets/ambient-sound.md');
      return;
    }

    // We deliberately do NOT call Audio.setAudioModeAsync here. The
    // VideoPlayer / Timer modules set their own audio modes; trampling
    // theirs would either silence the coach voice or mute on lock. Once
    // the VideoPlayer integration lands it owns the audio mode and we
    // just overlay this sound on top.
    var result = await _Audio.Sound.createAsync(
      track.asset,
      { isLooping: true, volume: _state.volume, shouldPlay: true }
    );
    _state.sound = result.sound;
  } catch (e) {
    devWarn('play() failed', e);
    _state.sound = null;
  } finally {
    _state.loading = false;
  }
}

// Pause without releasing the buffer — `resume()` is cheap afterwards.
export async function pause() {
  if (!_state.sound) return;
  try { await _state.sound.pauseAsync(); } catch (e) {}
}

export async function resume() {
  if (!_state.sound) return;
  try { await _state.sound.playAsync(); } catch (e) {}
}

// Stop, unload, and drop the singleton reference. Call from the consumer
// at unmount — we don't want a phantom loop continuing into the next
// screen.
async function _stopInternal() {
  if (!_state.sound) return;
  var prev = _state.sound;
  _state.sound = null;
  try { await prev.stopAsync(); } catch (e) {}
  try { await prev.unloadAsync(); } catch (e) {}
}

export async function stop() {
  await _stopInternal();
  // We deliberately keep `_state.slug` so a subsequent `play()` without
  // arguments resumes the user's last choice.
}

export function isPlaying() {
  return !!_state.sound;
}

export function getCurrentSlug() {
  return _state.slug;
}

export function getCurrentVolume() {
  return _state.volume;
}

export default {
  AMBIENT_TRACKS: AMBIENT_TRACKS,
  DEFAULT_SLUG: DEFAULT_SLUG,
  DEFAULT_VOLUME: DEFAULT_VOLUME,
  STORAGE_KEY_SOUND: STORAGE_KEY_SOUND,
  STORAGE_KEY_VOLUME: STORAGE_KEY_VOLUME,
  loadPreference: loadPreference,
  setPreference: setPreference,
  setVolume: setVolume,
  play: play,
  pause: pause,
  resume: resume,
  stop: stop,
  isPlaying: isPlaying,
  getCurrentSlug: getCurrentSlug,
  getCurrentVolume: getCurrentVolume,
};
