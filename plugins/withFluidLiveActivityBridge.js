/**
 * Config plugin — copie les sources Swift/Obj-C du bridge ActivityKit
 * (FluidLiveActivityModule.swift + FluidLiveActivity.m + FluidSessionAttributes.swift)
 * depuis `ios-native/FluidLiveActivity/` vers le main iOS app target
 * pendant `expo prebuild`.
 *
 * Pourquoi pas un Expo Module ? Trop de scaffolding pour 3 méthodes.
 * Pourquoi pas un fichier Swift posé direct ? Casse à chaque
 * `expo prebuild --clean` (qui régénère le projet Xcode).
 *
 * ⚠️ Cette version COPIE les fichiers mais ne les ajoute pas
 * automatiquement au .pbxproj. Yvan doit, après le premier prebuild :
 *   1. Ouvrir ios/fluidbody.xcworkspace
 *   2. Drag-drop le dossier ios/fluidbody/FluidLiveActivity/ dans le
 *      target principal "fluidbody" (cocher "Copy items if needed" = NON,
 *      "Create groups" = YES, target membership = fluidbody)
 *   3. Si bridging header pas encore en place, Xcode propose de le créer
 *      automatiquement quand on ajoute le .swift (accepter)
 *
 * Ces 3 clics sont stables : on ne les refait que si le .pbxproj est
 * recréé from scratch (ce qui est rare en pratique).
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const SOURCE_DIR = path.resolve(__dirname, '..', 'ios-native', 'FluidLiveActivity');
const DEST_SUBDIR = 'FluidLiveActivity';

const withFluidLiveActivityBridge = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosRoot = config.modRequest.platformProjectRoot;
      // Layout standard Expo : ios/<appName>/...
      const appName = config.modRequest.projectName || 'fluidbody';
      const destDir = path.join(iosRoot, appName, DEST_SUBDIR);

      if (!fs.existsSync(SOURCE_DIR)) {
        // Pas d'erreur dure : on warn, le widget peut tourner sans bridge
        // (no-op silencieux côté JS via safe-resolve).
        console.warn(
          '[fluid-live-activity] source dir not found:',
          SOURCE_DIR,
        );
        return config;
      }

      fs.mkdirSync(destDir, { recursive: true });

      for (const file of fs.readdirSync(SOURCE_DIR)) {
        const src = path.join(SOURCE_DIR, file);
        const dst = path.join(destDir, file);
        fs.copyFileSync(src, dst);
      }

      console.log(
        `[fluid-live-activity] copied bridge sources → ios/${appName}/${DEST_SUBDIR}/`,
      );
      console.log(
        '[fluid-live-activity] ⚠️  add the folder to the Xcode target manually (one-time)',
      );

      return config;
    },
  ]);
};

module.exports = withFluidLiveActivityBridge;
