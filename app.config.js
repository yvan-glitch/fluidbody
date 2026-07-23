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
  // Google Sign-In : module iOS/Android only, pas de cible tvOS → strippé du
  // build TV (l'Apple TV se connecte par pairing, pas par compte Google).
  '@react-native-google-signin/google-signin',
  '@react-native-community/datetimepicker',
  'expo-notifications',
  // expo-camera n'existe pas sur tvOS (pas de capteur). Strippé du build
  // TV pour éviter un linker error / crash. Le code JS qui l'importe est
  // gated derrière `IS_TV` (cf. PairAppleTV.js), donc rien à mocker côté
  // bundle — l'import statique sera juste remplacé par un dynamic
  // require inside un `if (!IS_TV)` block (cf. src/screens/PairAppleTV.js).
  'expo-camera',
  // withLiquidGlass : N'EST PLUS exclu sur tvOS.
  //
  // Historique : on excluait ce plugin du build TV en pensant que
  // UIGlassEffect était iOS-only. La recherche (WWDC25) confirme que
  // UIGlassEffect ship aussi sur tvOS 26 — même API UIVisualEffect +
  // tintColor/isInteractive. On a donc un module tvOS natif valide
  // (LiquidGlassTVView, cf. plugins/LiquidGlass/LiquidGlassTVView.swift)
  // qui remplace l'ancien fallback BlurView JS. Le plugin détecte
  // EXPO_TV=1 et copie le bon jeu de fichiers Swift (cf.
  // plugins/withLiquidGlass.js).
]

// Connexion Google native (@react-native-google-signin) : le plugin a besoin
// de l'« iosUrlScheme » (= l'ID client iOS inversé, ex.
// com.googleusercontent.apps.123456-abc). On le lit depuis la variable
// d'environnement EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME pour ne JAMAIS coder en dur
// d'identifiant et pour qu'une correction ne nécessite pas de toucher au code.
// Si la variable n'est pas encore définie, on n'ajoute pas le plugin (le build
// passe quand même ; Google sera simplement inactif sur iOS tant que non
// configuré). Android n'a pas besoin de ce scheme.
const GOOGLE_IOS_URL_SCHEME = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME || ''

function withGoogleSignIn(cfg) {
  if (!GOOGLE_IOS_URL_SCHEME) return cfg
  const plugins = Array.isArray(cfg.plugins) ? cfg.plugins.slice() : []
  const already = plugins.some((p) => (Array.isArray(p) ? p[0] : p) === '@react-native-google-signin/google-signin')
  if (!already) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: GOOGLE_IOS_URL_SCHEME }])
  }
  return { ...cfg, plugins }
}

module.exports = ({ config }) => {
  const isTV = process.env.EXPO_TV === '1'

  if (!isTV) {
    return withGoogleSignIn(config)
  }

  const basePlugins = Array.isArray(config.plugins) ? config.plugins : []

  const tvPlugins = basePlugins
    .filter((p) => {
      const name = Array.isArray(p) ? p[0] : p
      return !PLUGINS_INCOMPATIBLE_WITH_TVOS.includes(name)
    })
    .map((p) => {
      // Les extraPods iOS (GoogleUtilities/RecaptchaInterop en modular
      // headers, requis par AppCheckCore ← GoogleSignIn) n'ont pas de sens
      // sur tvOS : Google Sign-In y est strippé, et RecaptchaInterop ne
      // déclare pas de cible tvOS → les garder ferait échouer le
      // `pod install` du build TV. On les retire du bloc expo-build-properties.
      if (Array.isArray(p) && p[0] === 'expo-build-properties' && p[1] && p[1].ios) {
        const iosProps = { ...p[1].ios }
        delete iosProps.extraPods
        return ['expo-build-properties', { ...p[1], ios: iosProps }]
      }
      return p
    })
    .concat([
      // Plugin officiel — passer `appleTVImages` génère les TVAppIcon.brandassets
      // ET configure ASSETCATALOG_COMPILER_APPICON_NAME=TVAppIcon dans le projet
      // Xcode, donc Xcode compile vraiment nos brandassets (au lieu d'AppIcon.appiconset
      // iOS qu'il ignore pour tvOS). C'est ce point manquant qui causait les rejets
      // "Missing Image Asset. Home Screen Icon / App Store Icon" d'altool.
      ['@react-native-tvos/config-tv', {
        isTV: true,
        appleTVImages: {
          icon: './assets/tv/icon-large.png',              // 1280x768 — App Store Icon
          iconSmall: './assets/tv/icon-small.png',         // 400x240 — Home Screen Icon @1x
          iconSmall2x: './assets/tv/icon-small@2x.png',    // 800x480 — Home Screen Icon @2x
          topShelf: './assets/tv/top-shelf.png',           // 1920x720 @1x
          topShelf2x: './assets/tv/top-shelf@2x.png',      // 3840x1440 @2x
          topShelfWide: './assets/tv/top-shelf-wide.png',  // 2320x720 @1x
          topShelfWide2x: './assets/tv/top-shelf-wide@2x.png', // 4640x1440 @2x
        },
      }],
      // Patch tvOS Podfile pour gérer fmt 11 consteval + warnings -Werror.
      // Sans ce plugin, les patches sont wipés à chaque prebuild.
      './plugins/withTVPodfilePatch.js',
      // Note : withTVAssets.js (mon plugin custom) est DÉSACTIVÉ.
      // Il créait des brandassets dans Images.xcassets mais sans
      // ASSETCATALOG_COMPILER_APPICON_NAME, Xcode les ignorait.
      // Le plugin officiel ci-dessus fait les deux choses (assets +
      // build settings) — c'est ça la solution.
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
