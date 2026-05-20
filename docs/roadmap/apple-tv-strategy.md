# Roadmap — Apple TV (tvOS) : décision technique

**Statut** : décision actée, fondations posées sur la branche
`feat/apple-tv-foundation`. Pas encore mergé. Pas de build tvOS validé sur
device. Effort estimé pour atteindre un **premier dev client tvOS qui démarre
sur device** : **3-5 jours** (hors compte Apple Developer / certificats).
Effort estimé pour une **app tvOS soumissionable** (toutes les écrans
adaptés à la Siri Remote + vidéo plein écran + paywall) : **4-6 semaines**.

> Daté du 2026-05-18. À relire si on saute Expo SDK 55+.

## TL;DR

**Choix retenu : `react-native-tvos` + `@react-native-tvos/config-tv`.**

C'est **le** workflow Expo officiel pour TV (le plugin config-tv est
co-maintenu par Brent Vatne — Expo cofounder — et Doug Lowder, le mainteneur
historique du fork tvOS). Il n'existe **pas** de support tvOS natif dans le
SDK Expo en dehors de ce fork. La doc Expo elle-même renvoie vers ce
package.

Bénéfices :

1. **Une seule codebase RN partagée** entre iPhone, iPad et Apple TV. Le
   split se fait par `Platform.isTV` en JS et par extensions de fichiers
   (`Foo.tsx` vs `Foo.tv.tsx`) — pas de fork de repo.
2. **Versions alignées** : RN 0.81.5 (notre version actuelle) ↔
   `react-native-tvos@0.81.5-2` (tag `0.81-stable`). Drop-in remplacement
   du paquet `react-native` via npm alias.
3. **New Architecture supportée** (Fabric + TurboModules, identique au core
   RN). Notre app tourne déjà avec `newArchEnabled: true` — pas de
   régression à craindre.
4. **Toggle propre via variable d'env `EXPO_TV=1`** au moment du
   `prebuild` et du `eas build`. Tant que `EXPO_TV` n'est pas posé, le
   projet build comme avant pour iPhone — zéro impact sur le pipeline
   App Store actuel (build #57).

Inconvénients (à gérer, pas bloquants) :

- Le swap `react-native` → `react-native-tvos` change le résolveur de
  modules pour TOUS les builds. Le fork est *binary-compatible* avec RN
  core sur iOS/Android, mais en théorie un patch upstream RN 0.81.6+
  pourrait arriver avant que le fork ne soit rebasé. À surveiller à
  chaque upgrade Expo SDK.
- Plusieurs de nos modules natifs **n'existent pas sur tvOS** (HealthKit,
  Sign in with Apple sur tvOS = autre API, expo-screen-orientation,
  expo-apple-authentication, expo-haptics implicite, RevenueCat avec
  caveats). Détaillé plus bas.
- expo-dev-client sur Apple TV : *fonctionne* pour packager local /
  tunnel, mais **pas d'authentification EAS** ni de liste des builds /
  updates. Le hot reload marche, le menu dev marche.

## Comparatif des trois options

| Critère | `react-native-tvos` + Expo | Expo "officiel" natif | SwiftUI séparé |
|---|---|---|---|
| **Disponible mai 2026 ?** | ✅ stable `0.81.5-2` | ❌ n'existe pas hors react-native-tvos | ✅ toujours possible |
| **Compat Expo SDK 54 + New Arch** | ✅ documenté, testé en prod (Netflix, BBC, Plex) | n/a | ✅ (rien à voir avec RN) |
| **Effort initial → dev client qui démarre** | 3-5 jours | n/a | 2-3 semaines (target Xcode, auth Supabase, lecteur vidéo Bunny) |
| **Effort → app soumissionable** | 4-6 semaines | n/a | 8-12 semaines |
| **Codebase partagée avec iOS** | ✅ ~90 % réutilisable | n/a | ❌ 0 % (deux apps) |
| **Maintenance permanente** | rebasing fork à chaque upgrade Expo (1-2 j / SDK) | n/a | deux pipelines distincts à versionner |
| **Modules natifs tvOS-only requis** | non, sauf si on veut focus engine custom | n/a | tout est natif → pas de souci |
| **Polish UI Siri Remote** | bon (`tvParallaxProperties`, `TVFocusGuideView`, `useTVEventHandler`) | n/a | excellent (focus engine natif sans abstraction RN) |
| **Risque tvOS-only crash** | moyen (chaque module à valider, Hermes JSI sur tvOS moins testé) | n/a | bas |
| **Reach marché Apple TV** | identique (les deux soumettent un binaire tvOS) | n/a | identique |
| **Effort si on pivote plus tard** | swap aisé si on veut passer SwiftUI | n/a | irréversible côté SwiftUI |

### Pourquoi pas SwiftUI séparé

Tentant pour le polish, mais :

- Yvan est seul dev → maintenir deux codebases pour la même feature set
  (séances, paywall, profils, Supabase, Bunny, abonnements) double la dette.
- Le différenciateur Fluidbody est le **contenu** (séances Pilates,
  méduse, anneaux activité, paywall premium), pas l'UX TV native ultime.
- On peut toujours migrer SwiftUI plus tard si on hit un mur RN (improbable
  vu le track record de Netflix/BBC/Discovery+ sur ce stack).

### Pourquoi pas attendre Expo SDK 55

SDK 55 est en beta (sortie ciblée été 2026 d'après le changelog Expo). Il
ne change rien à la stratégie TV : il continue à pointer vers
`react-native-tvos`. Aucune raison d'attendre.

## Architecture cible

```
fluidbody/
  App.js                      (entry point, tab navigator existant)
  app.json                    (+ plugin @react-native-tvos/config-tv, gardé "off" sans EXPO_TV)
  eas.json                    (+ profiles development-tv, preview-tv, production-tv)
  package.json                ("react-native": "npm:react-native-tvos@0.81-stable")
  src/
    screens/
      MonCorps.js             → garde version mobile, ajoute MonCorps.tv.js
      Activity.js             → garde
      Bibliotheque.js         → ajoute Bibliotheque.tv.js (grille focusable)
      Profil.js               → garde, masque sections HealthKit côté TV
    components/
      VideoPlayer.js          → ajoute VideoPlayer.tv.js (AVPlayer fullscreen + Siri Remote)
      FocusableCard.tv.js     → composant focus + parallax dédié TV
    utils/
      platformTV.js           → helper `isTV`, capabilities, etc.
  ios/                        (généré par prebuild, .gitignored — pas check-in)
```

Sélection d'écrans par Metro :

- `MonCorps.tv.js` si `Platform.isTV === true`
- `MonCorps.js` sinon

Pas de duplication monstre attendue : les écrans qui ne changent pas (Activity,
Profil) restent uniques avec quelques `if (Platform.isTV)`. Les deux gros
écrans à refondre pour la Siri Remote sont **Bibliothèque** (grille de
séances) et **VideoPlayer** (overlay contrôles).

## Modules : matrice de compatibilité tvOS

Validé sur la doc react-native-tvos + recherche issues GitHub mai 2026.

### ✅ Marchent sans modification

| Module | Notes |
|---|---|
| `@react-navigation/native` | OK sur TV depuis longtemps |
| `@react-navigation/bottom-tabs` | Marche mais à remplacer par un side menu ou top tabs côté TV (UX) |
| `react-native-svg` | OK |
| `react-native-safe-area-context` | OK, no-op sur tvOS |
| `react-native-screens` | OK |
| `expo-image` | OK |
| `expo-linear-gradient` | OK |
| `expo-blur` | OK |
| `expo-localization` | OK |
| `expo-file-system` | OK |
| `expo-keep-awake` | OK |
| `expo-status-bar` | no-op sur tvOS (pas de status bar) |
| `expo-crypto` | OK |
| `expo-device` | OK |
| `expo-updates` | OK |
| `@supabase/supabase-js` | OK (pur JS) |
| `@react-native-async-storage/async-storage` | OK |

### ✅ Marchent avec config / contournement

| Module | Action |
|---|---|
| `expo-av` (Video) | OK sur tvOS, contrôles Siri Remote OK. Considérer migration `expo-video` (cross-platform, mieux pour TV). |
| `@sentry/react-native` | SDK natif Sentry pour tvOS existe ; le wrapper RN devrait fonctionner mais à valider sur premier build TV (capture crash native). |
| `react-native-purchases` (RevenueCat) | Le SDK natif iOS RevenueCat supporte tvOS. Le wrapper RN n'est PAS officiellement supporté sur tvOS — community report d'erreur `Invariant Violation: NativeEventEmitter` sur Expo + tvOS. **Mitigation** : implémenter un wrapper natif minimal (Swift) ou utiliser RevenueCat REST API depuis JS pour TV. |
| `react-native-view-shot` | À vérifier — pas de raison de capture d'écran sur TV, peut être stubbé. |

### ❌ Non disponibles sur tvOS — doivent être exclus du build TV

| Module | Pourquoi | Action |
|---|---|---|
| `@kingstinct/react-native-healthkit` | HealthKit n'existe pas sur tvOS (iOS/watchOS only) | Exclure via Podfile conditional ou stub côté JS. Bloque l'écran HealthKitConnect, l'écran Activity (anneaux), et le live BPM. |
| `expo-apple-authentication` | Sign in with Apple sur tvOS = API différente (AuthenticationServices fournit `ASAuthorizationAppleIDProvider` aussi sur tvOS, mais l'UX est différente — code QR) | Implémenter un flux Magic Link Supabase seul sur TV, ou ajouter QR code login (recommandé). |
| `expo-screen-orientation` | tvOS toujours en landscape | no-op trivial |
| `@react-native-community/datetimepicker` | Pas de calendar picker natif sur tvOS | Stubber côté TV — implémenter un picker custom focusable |
| `expo-notifications` | Apple TV ne supporte pas les push notifications (UNUserNotificationCenter restreint) | Désactiver la branche notifications côté TV |

### 🔄 Adaptables / à concevoir

| Feature | Approche tvOS |
|---|---|
| Auth | QR code login (user scanne avec son iPhone, l'iPhone push le token Supabase via deep link → l'Apple TV poll un endpoint) — UX standard Apple TV (Netflix, Disney+) |
| BPM live | Pas dispo nativement. Option : afficher BPM depuis l'iPhone via Continuity / Companion App si l'iPhone est en proximité (très long à implémenter). MVP : ne pas afficher de BPM live sur TV. |
| Anneaux activité | Read-only depuis HealthKit iCloud n'est pas possible sur tvOS. Afficher les anneaux *calculés localement* sur l'iPhone et synchronisés via Supabase. |
| Paywall RevenueCat | UX = écran custom plein écran + IAP `SKStoreFront` sur tvOS. Si wrapper RN cassé, fallback REST API + StoreKit natif via bridge minimal. |
| Save workout | Côté iPhone, pas TV. Le TV n'écrit pas dans HealthKit. |

## Stratégie de release proposée

1. **Phase 0** (cette branche, en cours) : docs + scaffolding config. Pas de
   build tvOS. Pas de merge.
2. **Phase 1** (3-5 j) : Yvan exécute le setup (Apple Developer, certif,
   provisioning) → `EXPO_TV=1 npx expo prebuild --clean` → premier dev
   client tvOS qui démarre, écran blanc + log "Hello TV". Aucune feature
   adaptée encore.
3. **Phase 2** (1-2 sem) : Login (QR code), home screen TV (Bibliothèque
   focusable), VideoPlayer adapté Siri Remote. Pas de HealthKit, pas de
   paywall encore.
4. **Phase 3** (1-2 sem) : Paywall RevenueCat (ou fallback REST), UX
   polish, copy TV, tests sur Apple TV physique.
5. **Phase 4** (1 sem) : Soumission App Store Connect tvOS app (nouveau
   binaire, même bundle ID ? non — Apple impose un App ID séparé sur
   App Store Connect mais le bundle peut rester `com.ytissot.fluidbody`).

ETA réaliste premier TestFlight tvOS interne : **5-6 semaines** à partir
du moment où Yvan reprend la branche.

## Recommandations non-techniques

- **Avant d'investir 6 semaines** : valider que le marché Apple TV pour
  une app de Pilates est suffisant. Voir `apple-tv-business-case.md`.
- **Apple TV n'a pas d'abonnement universel** (pas d'Apple Family pour
  l'app si pas configuré). À vérifier dans RevenueCat dashboard avant la
  phase 3.
- **Skipper Android TV pour l'instant**. Le marché Android TV pour le
  wellness est négligeable, et chaque feature ajoute du QA cross-platform.

## Sources

- [Build Expo apps for TV — doc Expo officielle](https://docs.expo.dev/guides/building-for-tv/)
- [react-native-tvos repo (master, mai 2026)](https://github.com/react-native-tvos/react-native-tvos)
- [@react-native-tvos/config-tv@0.1.6 sur npm](https://www.npmjs.com/package/@react-native-tvos/config-tv) (publié il y a 1 mois)
- [Expo SDK 54 changelog — mention tvOS expérimental](https://expo.dev/changelog/sdk-54)
- [RevenueCat community : RN purchases sur tvOS](https://community.revenuecat.com/sdks-51/anyone-is-using-revenuecat-for-tvos-with-the-react-native-package-971)
- [Sentry tvOS SDK](https://docs.sentry.io/platforms/apple/guides/tvos/)
