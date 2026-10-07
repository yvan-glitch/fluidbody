// Cible watchOS FLUIDBODY+ (Phase 3, 07.10.2026) — @bacons/apple-targets.
// Prebuild (`npx expo prebuild -p ios --clean`) génère la cible dans Xcode à
// partir de ce dossier. Info.plist (même dossier) porte les textes HealthKit
// et le mode d'arrière-plan « workout-processing ».
// Exclue du build Apple TV (cf. PLUGINS_INCOMPATIBLE_WITH_TVOS, app.config.js).

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  name: 'FluidBodyWatch',
  displayName: 'FLUIDBODY+',
  bundleIdentifier: 'com.ytissot.fluidbody.watchkitapp',
  // watchOS 10 : symbolEffect, HKLiveWorkoutBuilder, WKApplicationDelegate.
  deploymentTarget: '10.0',
  icon: '../../assets/icon.png',
  colors: {
    $accent: '#AEEF4D',
  },
  frameworks: ['HealthKit', 'WatchConnectivity'],
  entitlements: {
    'com.apple.developer.healthkit': true,
    'com.apple.developer.healthkit.access': [],
  },
};
