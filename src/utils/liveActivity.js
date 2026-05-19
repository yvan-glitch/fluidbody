// liveActivity.js — JS bridge to the FluidLiveActivity native module.
//
// iOS-only (Live Activities don't exist on Android). All entry points are
// safe to call from any platform : Android and Expo Go return immediately
// with a benign value. The native module itself is wrapped in
// safeNativeCall so a transient ActivityKit error never throws into the
// VideoPlayer render path.
//
// Lifecycle (matches a séance) :
//   • startSessionActivity(...)   when the user hits Play on the VideoPlayer
//   • updateSessionActivity(...)  every ~5s while playing (timer ticks itself
//                                 inside the widget — see startedAt in attrs)
//   • endSessionActivity(...)     when the video ends, the user closes the
//                                 player, or the app goes through a hard
//                                 teardown (cf. AppState change)
//
// `bpm` is optional ; pass `undefined` to leave the previous value untouched,
// pass `null` to explicitly clear it (e.g. Apple Watch sample expired).

import { NativeModules, Platform } from 'react-native';
import { safeNativeCall } from './safeNativeCall';

const NativeMod = (Platform.OS === 'ios')
  ? (NativeModules && NativeModules.FluidLiveActivity) || null
  : null;

/** True when the native module is loaded AND the user hasn't disabled
 *  Live Activities in Settings. Reflects the `constantsToExport` snapshot
 *  taken at app launch — not live. */
export function isLiveActivitySupported() {
  if (Platform.OS !== 'ios') return false;
  if (!NativeMod) return false;
  try {
    return !!NativeMod.supported;
  } catch (_) {
    return false;
  }
}

function clampProgress(p) {
  if (typeof p !== 'number' || !isFinite(p)) return 0;
  return Math.max(0, Math.min(1, p));
}

/**
 * Start a Live Activity for the current séance. Resolves with the activity
 * id (string) or null if Live Activities aren't supported.
 *
 * @param {object} opts
 * @param {string} opts.sessionTitle    e.g. "Le dos expliqué"
 * @param {string} opts.pillarName      e.g. "Comprendre son dos"
 * @param {string} [opts.pillarColorHex] e.g. "#AEEF4D" (defaults to méduse)
 * @param {number} [opts.totalDurationSec]
 * @param {number} [opts.elapsedSec]    if resuming mid-session
 * @param {number} [opts.bpm]
 * @param {number} [opts.progress]      0..1
 */
export function startSessionActivity(opts) {
  if (!isLiveActivitySupported()) return Promise.resolve(null);
  const payload = {
    sessionTitle: String(opts.sessionTitle || ''),
    pillarLabel: String(opts.pillarName || ''),
    pillarColorHex: String(opts.pillarColorHex || '#AEEF4D'),
    totalSec: Math.max(0, Math.floor(opts.totalDurationSec || 0)),
    elapsedSec: Math.max(0, Math.floor(opts.elapsedSec || 0)),
    progress: clampProgress(opts.progress),
  };
  if (typeof opts.bpm === 'number' && isFinite(opts.bpm)) {
    payload.bpm = Math.round(opts.bpm);
  }
  return safeNativeCall(
    'FluidLiveActivity.start',
    () => NativeMod.start(payload),
    null,
  );
}

/**
 * Push an update to the running Live Activity. No-op if no activity is
 * running. iOS coalesces updates so calling this every 1s is fine ; we
 * recommend every ~5s to stay well under the ActivityKit budget.
 *
 * @param {object} opts
 * @param {number} opts.elapsedSec
 * @param {number} [opts.totalSec]
 * @param {number} [opts.progress] 0..1
 * @param {number|null} [opts.bpm] number = update, null = clear, undefined = keep
 */
export function updateSessionActivity(opts) {
  if (!isLiveActivitySupported()) return Promise.resolve(null);
  const payload = {
    elapsedSec: Math.max(0, Math.floor(opts.elapsedSec || 0)),
  };
  if (typeof opts.totalSec === 'number') {
    payload.totalSec = Math.max(0, Math.floor(opts.totalSec));
  }
  if (typeof opts.progress === 'number') {
    payload.progress = clampProgress(opts.progress);
  }
  // Distinguish "not passed" vs. "explicitly null" : the native module
  // reads `payload.bpm is NSNull` to clear vs. `payload.bpm == nil` to keep.
  if (opts.bpm === null) {
    payload.bpm = null;
  } else if (typeof opts.bpm === 'number' && isFinite(opts.bpm)) {
    payload.bpm = Math.round(opts.bpm);
  }
  return safeNativeCall(
    'FluidLiveActivity.update',
    () => NativeMod.update(payload),
    null,
  );
}

/**
 * End the running Live Activity. Always safe to call (no-op if nothing
 * running). The widget is dismissed immediately ; if we ever want a
 * lingering "session done" card, flip the Swift side to .after(...).
 *
 * @param {object} [opts]
 * @param {number} [opts.finalTime]  elapsed seconds at completion
 * @param {number} [opts.totalSec]
 * @param {number} [opts.bpm]
 */
export function endSessionActivity(opts) {
  if (!isLiveActivitySupported()) return Promise.resolve(null);
  const o = opts || {};
  const payload = {};
  if (typeof o.finalTime === 'number') payload.elapsedSec = Math.max(0, Math.floor(o.finalTime));
  if (typeof o.totalSec === 'number') payload.totalSec = Math.max(0, Math.floor(o.totalSec));
  if (typeof o.bpm === 'number' && isFinite(o.bpm)) payload.bpm = Math.round(o.bpm);
  return safeNativeCall(
    'FluidLiveActivity.end',
    () => NativeMod.end(payload),
    null,
  );
}

export default {
  isLiveActivitySupported,
  startSessionActivity,
  updateSessionActivity,
  endSessionActivity,
};
