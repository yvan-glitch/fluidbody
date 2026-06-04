// expo-target.config.js — EXEMPLE pour @bacons/apple-targets.
//
// Lors de l'intégration : créer un dossier `targets/watch/` à la racine du
// projet, y déposer ce fichier + les .swift de ../watch-app/, et installer
//   npm install @bacons/apple-targets
// puis ajouter "@bacons/apple-targets" aux plugins de app.json.
// `npx expo prebuild -p ios` génèrera alors la cible watchOS dans Xcode.
//
// Réf : https://github.com/EvanBacon/expo-apple-targets
//
// ⚠️ NE PAS placer ce fichier tel quel dans le projet sans avoir installé le
// plugin — sinon prebuild ne saura pas quoi en faire. C'est un gabarit.

/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'watch',
  name: 'FluidBody+',
  // Bundle id de la montre = bundle iPhone + suffixe (.watchkitapp est la
  // convention attendue par le companion).
  bundleIdentifier: 'com.ytissot.fluidbody.watchkitapp',
  deploymentTarget: '10.0',
  // Entitlements HealthKit pour la cible montre (la séance temps réel en a besoin).
  entitlements: {
    'com.apple.developer.healthkit': true,
    'com.apple.developer.healthkit.background-delivery': true,
  },
  // Permissions affichées sur la montre.
  infoPlist: {
    NSHealthShareUsageDescription:
      "FluidBody+ lit ta fréquence cardiaque pendant la séance pour l'afficher en temps réel.",
    NSHealthUpdateUsageDescription:
      'FluidBody+ enregistre ta séance de Pilates dans Apple Santé.',
    WKCompanionAppBundleIdentifier: 'com.ytissot.fluidbody',
    WKWatchOnly: false,
    WKBackgroundModes: ['workout-processing'],
  },
};
