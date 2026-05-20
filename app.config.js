// Conditional Expo config — wraps app.json.
//
// When EXPO_TV is NOT set (i.e. `EXPO_TV !== '1'`), this file returns the
// app.json config unchanged. The iOS production pipeline (TestFlight build
// #57, eas profiles `development` / `preview` / `production`) is therefore
// 100 % unaffected.
//
// When EXPO_TV=1 (set by the EAS profiles `*-tv` in eas.json), we:
//   - inject the `@react-native-tvos/config-tv` plugin
//   - strip plugins / capabilities that don't exist on tvOS (HealthKit,
//     Apple Sign In, datetimepicker, push notifications)
//   - leave the iOS Info.plist health entitlements alone, because the
//     config-tv plugin rewrites the project for tvOS and those keys are
//     silently ignored.
//
// See docs/roadmap/apple-tv-strategy.md § matrice modules for the
// rationale behind each exclusion.

const PLUGINS_INCOMPATIBLE_WITH_TVOS = [
  '@kingstinct/react-native-healthkit',
  'expo-apple-authentication',
  '@react-native-community/datetimepicker',
  'expo-notifications',
  // expo-camera n'existe pas sur tvOS (pas de capteur). Strippé du build
  // TV pour éviter un linker error / crash. Le code JS qui l'importe est
  // gated derrière `IS_TV` (cf. PairAppleTV.js), donc rien à mocker côté
  // bundle — l'import statique sera juste remplacé par un dynamic
  // require inside un `if (!IS_TV)` block (cf. src/screens/PairAppleTV.js).
  'expo-camera',
]

module.exports = ({ config }) => {
  const isTV = process.env.EXPO_TV === '1'

  if (!isTV) {
    return config
  }

  const basePlugins = Array.isArray(config.plugins) ? config.plugins : []

  const tvPlugins = basePlugins
    .filter((p) => {
      const name = Array.isArray(p) ? p[0] : p
      return !PLUGINS_INCOMPATIBLE_WITH_TVOS.includes(name)
    })
    .concat([
      ['@react-native-tvos/config-tv', { isTV: true }],
      // Patch tvOS Podfile pour gérer fmt 11 consteval + warnings -Werror.
      // Sans ce plugin, les patches sont wipés à chaque prebuild.
      './plugins/withTVPodfilePatch.js',
    ])

  const ios = { ...(config.ios || {}) }
  delete ios.usesAppleSignIn
  if (ios.entitlements) {
    const ent = { ...ios.entitlements }
    delete ent['com.apple.developer.healthkit']
    ios.entitlements = ent
  }

  // tvOS: désactive New Architecture (Fabric/TurboModules).
  // Certaines libs (react-native-svg, screens, gesture-handler, etc.) ne
  // fournissent pas les Fabric component views pour tvOS → la dictionary
  // RCTThirdPartyComponentsProvider contient des Class Nil → crash natif
  // au boot. Old Arch fonctionne avec les bridges legacy.
  return {
    ...config,
    plugins: tvPlugins,
    ios,
    newArchEnabled: false,
  }
}
