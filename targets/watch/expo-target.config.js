// targets/watch/expo-target.config.js
// Décrit la cible Apple Watch pour @bacons/apple-targets.
// Lu automatiquement par le plugin lors de `npx expo prebuild -p ios`.
//
// ⚠️ N'a d'effet QUE si @bacons/apple-targets est installé ET ajouté aux
//    plugins de app.json. Tant que ce n'est pas le cas, ce fichier est inerte.

/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'watch',
  name: 'FluidBody+',
  bundleIdentifier: 'com.ytissot.fluidbody.watchkitapp',
  deploymentTarget: '10.0',
  // HealthKit : indispensable pour la séance d'entraînement + la fréquence
  // cardiaque temps réel au poignet.
  entitlements: {
    'com.apple.developer.healthkit': true,
    'com.apple.developer.healthkit.background-delivery': true,
  },
  infoPlist: {
    NSHealthShareUsageDescription:
      "FluidBody+ lit ta fréquence cardiaque pendant la séance pour l'afficher en temps réel.",
    NSHealthUpdateUsageDescription:
      'FluidBody+ enregistre ta séance de Pilates dans Apple Santé.',
    // Lie la montre à l'app iPhone (companion).
    WKCompanionAppBundleIdentifier: 'com.ytissot.fluidbody',
    WKBackgroundModes: ['workout-processing'],
  },
};
