// withHealthConnectDelegate.js — config plugin Expo.
//
// react-native-health-connect exige que la MainActivity enregistre son
// lanceur de permission AU DÉMARRAGE (onCreate), via
//   HealthConnectPermissionDelegate.setPermissionDelegate(this)
// Sinon, au moment de demander les permissions, on a un crash natif :
//   UninitializedPropertyAccessException: lateinit property requestPermission
//   has not been initialized  (HealthConnectPermissionDelegate.launchPermissionsDialog)
//
// Le plugin officiel de la lib n'ajoute QUE l'intent-filter de justification ;
// il n'injecte PAS ce code. Comme la MainActivity est régénérée à chaque
// `expo prebuild` / build EAS, on l'injecte par config plugin.
//
// Réf : README de react-native-health-connect (« add the following code into
// your MainActivity.kt within the onCreate method »).

const { withMainActivity } = require('@expo/config-plugins');

const IMPORT_LINE = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const DELEGATE_CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

module.exports = function withHealthConnectDelegate(config) {
  return withMainActivity(config, (cfg) => {
    // Kotlin uniquement (les MainActivity Expo récentes sont en .kt).
    if (cfg.modResults.language !== 'kt') return cfg;
    let src = cfg.modResults.contents;

    // 1) Import (après la ligne `package …`).
    if (!src.includes(IMPORT_LINE)) {
      src = src.replace(/^(package .*\r?\n)/m, `$1\n${IMPORT_LINE}\n`);
    }

    // 2) Enregistrement du delegate, juste après `super.onCreate(...)`.
    if (!src.includes(DELEGATE_CALL)) {
      src = src.replace(/(super\.onCreate\([^)]*\))/, `$1\n    ${DELEGATE_CALL}`);
    }

    cfg.modResults.contents = src;
    return cfg;
  });
};
