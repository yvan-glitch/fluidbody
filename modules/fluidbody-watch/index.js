// fluidbody-watch — façade JS du module natif FluidbodyWatch (Phase 3).
// requireOptionalNativeModule : renvoie null dans Expo Go, sur Android, sur
// un ancien build sans le module (OTA) → toutes les fonctions deviennent des
// no-op. Aucune exception ne remonte.

import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

let Native = null;
try {
  Native = Platform.OS === 'ios' && !Platform.isTV ? requireOptionalNativeModule('FluidbodyWatch') : null;
} catch (e) {
  Native = null;
}

const NO_WATCH = { supported: false, activated: false, paired: false, installed: false, reachable: false };

export function isWatchModuleAvailable() {
  return !!Native;
}

export function getWatchStatus() {
  if (!Native) return NO_WATCH;
  try { return Native.getStatus() || NO_WATCH; } catch (e) { return NO_WATCH; }
}

export async function startWatchWorkout(title) {
  if (!Native) return { launched: false, error: 'unavailable' };
  try { return (await Native.startWorkout(String(title || 'Pilates'))) || { launched: false }; } catch (e) { return { launched: false, error: String(e && e.message) }; }
}

export function sendWatchCommand(cmd) {
  if (!Native) return false;
  try { return !!Native.sendCommand(cmd); } catch (e) { return false; }
}

export function addWatchListener(fn) {
  if (!Native || typeof Native.addListener !== 'function') return { remove: function () {} };
  try { return Native.addListener('onWatchMessage', fn); } catch (e) { return { remove: function () {} }; }
}
