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

// Props à étaler sur <TouchableOpacity> / <Pressable> pour rendre l'élément
// focusable par la Siri Remote. Sur iPhone/iPad, on retourne un objet vide
// (zéro overhead). `preferred` met `hasTVPreferredFocus` pour le premier
// élément interactif d'un écran, donnant le focus initial.
export function tvFocusProps (preferred = false) {
  if (!IS_TV) return {}
  return {
    hasTVPreferredFocus: preferred,
    tvParallaxProperties: {
      enabled: true,
      magnification: 1.06,
      pressMagnification: 1.0,
    },
    // RN tvOS appelle ces handlers quand le focus engine entre/quitte
    // l'élément. Pour réagir visuellement, le composant utilise un state
    // local `focused` + style conditionnel (border + scale).
    // Voir MonCorps / Bibliotheque pour le pattern.
  }
}

// Style additionnel à merger sur la card focusée. Bordure jaune Fluidbody
// + ombre lumineuse, lisible à 2-3 m.
export const TV_FOCUS_RING = {
  borderWidth: 4,
  borderColor: '#E5FF00',
  shadowColor: '#E5FF00',
  shadowOpacity: 0.9,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 0 },
}
