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
    .concat([['@react-native-tvos/config-tv', { isTV: true }]])

  const ios = { ...(config.ios || {}) }
  delete ios.usesAppleSignIn
  if (ios.entitlements) {
    const ent = { ...ios.entitlements }
    delete ent['com.apple.developer.healthkit']
    ios.entitlements = ent
  }

  return {
    ...config,
    plugins: tvPlugins,
    ios,
  }
}
