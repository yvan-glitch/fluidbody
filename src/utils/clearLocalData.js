// clearLocalUserData
//
// Wipes every AsyncStorage key the app owns except a small allowlist of
// device-level preferences that survive account deletion (display
// language, theme). Called right after delete_my_account succeeds so the
// next launch lands on the onboarding flow with no stale state.

import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys that are device-level, not user-level. Language and theme are
// chosen on first launch and shouldn't reset just because the user
// deleted their account on the same device.
const KEEP_KEYS = ['fluid_lang', 'fluid_theme_mode'];

export async function clearLocalUserData() {
  const all = await AsyncStorage.getAllKeys();
  const toDelete = all.filter((k) => !KEEP_KEYS.includes(k));
  if (toDelete.length === 0) return [];
  await AsyncStorage.multiRemove(toDelete);
  return toDelete;
}

export default clearLocalUserData;
