// Helpers tvOS — sûrs à appeler sur iPhone/iPad (retournent false par
// défaut). Posés en avance pour que le reste du code (VideoPlayer, écrans)
// puisse commencer à se brancher avant qu'on ait swappé react-native →
// react-native-tvos. Tant que le swap n'est pas fait, Platform.isTV
// renvoie `undefined` sur RN core, donc `IS_TV` est `false`.
//
// Voir docs/roadmap/apple-tv-strategy.md pour le contexte.

import { Platform } from 'react-native'

export const IS_TV = Platform.isTV === true
export const IS_TVOS = IS_TV && Platform.OS === 'ios'
export const IS_ANDROID_TV = IS_TV && Platform.OS === 'android'

// Features qui n'existent pas / ne marchent pas sur tvOS, à utiliser pour
// gater le code partout où ça compte (HealthKit, notifications, haptics,
// auth Apple, datetimepicker, screen orientation).
export const TV_CAPABILITIES = {
  healthKit: !IS_TV,
  notifications: !IS_TV,
  haptics: !IS_TV,
  appleSignIn: !IS_TV,
  screenOrientationLock: !IS_TV,
  dateTimePickerNative: !IS_TV,
  // RevenueCat wrapper RN a des soucis reportés sur tvOS — à valider sur
  // le premier dev client TV. Pour l'instant on assume false, on flipera
  // une fois la vérif faite.
  revenueCatNative: !IS_TV,
}

// Helper de log non-blocking pour repérer rapidement si on est sur TV.
export function tvLog (...args) {
  if (!IS_TV) return
  if (__DEV__) console.log('[TV]', ...args)
}
