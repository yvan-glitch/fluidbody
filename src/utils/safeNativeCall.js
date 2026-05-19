// safeNativeCall — defensive wrapper for ObjC TurboModule calls.
//
// Context: build #46 on iOS 26.4.2 crashes with EXC_BAD_ACCESS in
// `convertNSExceptionToJSError` after the WelcomeIntro confetti → MainApp
// mount transition. The crash is in the RN TurboModule queue and predates
// the HealthKit migration, so the culprit is another native module that
// throws an NSException whose conversion to a JS error corrupts memory.
//
// We can't fix the converter from JS, but we can:
//   1. Catch the JS-side throw / rejection so it doesn't bubble.
//   2. Forward to Sentry with a `native:<name>` tag so we know which module
//      misbehaved next time.
//   3. Optionally log to the device console so Yvan can read the last call
//      before the SIGSEGV via Xcode Console.app / `log stream`.
//
// Use it around any call that crosses the bridge into an ObjC TurboModule:
// expo-haptics, expo-notifications, react-native-purchases, expo-av, etc.
// AsyncStorage and pure-JS modules don't need it.

import { Platform } from 'react-native';

// Flip to `false` once the crash is identified to silence the breadcrumbs.
// Kept hard-coded (not env-driven) so it ships in the TestFlight build
// without needing a rebuild dance.
// 2026-05-19: crash root-caused (legacy react-native-health), Nitro HK ships
// stable in build #61. Turning off so App Store production builds don't spew
// `[FLDB-DIAG]` to the device console.
export const DIAGNOSTIC_NATIVE_CALLS = false;

let _Sentry = null;
try { _Sentry = require('@sentry/react-native'); } catch (e) {}

function _captureNative(name, error) {
  if (!_Sentry) return;
  try {
    _Sentry.withScope(function (scope) {
      scope.setTag('native', name);
      scope.setLevel('error');
      _Sentry.captureException(error instanceof Error ? error : new Error(String((error && error.message) || error)));
    });
  } catch (_) {}
}

// `diag(step, phase?)` writes a console line that survives in Xcode Console
// even on a release build, because RN's console plumbing forwards through
// the bridge. Phases are typically 'start' / 'done' / 'error'.
export function diag(step, phase) {
  if (!DIAGNOSTIC_NATIVE_CALLS) return;
  try {
    var suffix = phase ? ' ' + phase : '';
    // eslint-disable-next-line no-console
    console.log('[FLDB-DIAG] ' + step + suffix);
  } catch (_) {}
}

// safeNativeCall(name, () => fn(), fallback)
//   • Synchronous throws → caught, reported, fallback returned.
//   • Promise rejections → caught, reported, fallback returned.
//   • Anything else      → passed through verbatim.
export function safeNativeCall(name, fn, fallback) {
  diag(name, 'start');
  try {
    var result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(
        function (value) { diag(name, 'done'); return value; },
        function (err) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[native:' + name + '] async error:', err);
          }
          _captureNative(name, err);
          diag(name, 'error');
          return fallback;
        }
      );
    }
    diag(name, 'done');
    return result;
  } catch (e) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[native:' + name + '] sync error:', e);
    }
    _captureNative(name, e);
    diag(name, 'error');
    return fallback;
  }
}

// Same as safeNativeCall but for fire-and-forget native calls (haptics,
// notification handler setup, etc.). Returns undefined, never throws.
export function safeNativeFire(name, fn) {
  if (Platform.OS === 'web') return;
  safeNativeCall(name, fn, undefined);
}

export default safeNativeCall;
