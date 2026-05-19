# Live Activity — Stratégie technique (sprint v1.1)

**Statut :** fondations posées (branche `feat/live-activity-foundation`).
**Cible release :** v1.1 post-launch v1.0 (build #63 actuellement en review).
**Min iOS :** 16.2 (ContentState `Codable`, Dynamic Island stable, frozen layout).
Voir aussi : [live-activity.md](./live-activity.md) (notes d'estimation initiales) et
[live-activity-progress.md](./live-activity-progress.md) (état du scaffolding et étapes manuelles).

## Décision

**Stack retenue : `@bacons/apple-targets` (config plugin Expo) + Widget Extension Swift custom + bridge RN minimal écrit à la main.**

Pas de dépendance JS qui encapsule ActivityKit. La couche JS appelle directement un `NativeModule` Swift résident dans le main app target, avec safe-resolve à la `safeNativeCall.js`.

## Pourquoi pas les alternatives

### `expo-live-activity` (Software Mansion, v0.4.2)
- ✅ Bridge JS↔ActivityKit prêt à l'emploi, MIT, sans deps.
- ❌ UI du widget pré-imposée. On veut un Liquid Glass cohérent avec l'app
  (méduse jaune-vert, BPM ring, palette aquatique) — non négociable côté design.
- ❌ Dernière release `0.4.2` il y a 6 mois ; `0.5.0-alpha1` non testé en SDK 54.
- ❌ Couple notre v1.1 à leur roadmap. Si Apple change l'API en iOS 27,
  on attend un PR upstream.

### `@heojeongbo/expo-live-activity`
- ❌ Mainteneur unique, bundle 257 MB (!), pas de signal communautaire.
- ❌ Hard pass.

### Swift natif "from scratch" sans config plugin
- ❌ Casse `expo prebuild --clean`. Chaque migration SDK obligerait Yvan à
  reconstruire le target Xcode à la main. Anti-pattern dans un projet
  Expo managed (même partiellement).

### Notification "live" via `expo-notifications` (fallback du doc initial)
- À garder en plan B documenté mais pas l'objectif de cette branche.
- Pas de Dynamic Island, pas de progression visuelle, expérience downgradée.

## Pourquoi `@bacons/apple-targets`

- ✅ Lib la plus active sur ce créneau (publiée il y a 6 jours au moment de la
  décision, 49 versions, mainteneur Evan Bacon — ex-Expo lead).
- ✅ Génère un vrai target Xcode Widget Extension à chaque `expo prebuild`,
  donc compatible avec notre flux EAS et la migration SDK.
- ✅ Découple totalement la couche UI (Swift/SwiftUI dans `targets/live-activity/`)
  du runtime JS — on choisit le style qu'on veut.
- ✅ S'aligne avec ce qu'on fait déjà pour HealthKit (Nitro Modules, custom
  native module) : on est déjà sortis d'Expo Go, donc le coût marginal est nul.

## Architecture cible

```
┌──────────────────────────────────────────────────────────────────┐
│  JS (RN 0.81, New Arch)                                          │
│                                                                  │
│  src/utils/liveActivity.js                                       │
│    ├─ startSessionActivity({ sessionTitle, pillarName, total })  │
│    ├─ updateSessionActivity({ elapsedSec, bpm?, progress })      │
│    └─ endSessionActivity({ finalTime, bpm? })                    │
│                                                                  │
│  Safe-resolve NativeModules.FluidLiveActivity                    │
│  (no-op silencieux sur Android / Expo Go / iOS <16.2)            │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼ JSI
┌──────────────────────────────────────────────────────────────────┐
│  Main iOS app target — FluidLiveActivityModule.swift             │
│                                                                  │
│   • Vérifie ActivityAuthorizationInfo().areActivitiesEnabled     │
│   • Encode payload JS → FluidSessionAttributes.ContentState      │
│   • Activity<>.request / .update / .end                          │
│   • Garde l'ID de l'activité en mémoire (1 séance live à la fois)│
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼ App Group (group.com.ytissot.fluidbody.shared)
┌──────────────────────────────────────────────────────────────────┐
│  Widget Extension target — targets/live-activity/                │
│                                                                  │
│   FluidSessionAttributes.swift  (ActivityAttributes + State)     │
│   FluidLiveActivityWidget.swift (Widget bundle)                  │
│   FluidLockScreenView.swift     (lock screen + StandBy)          │
│   FluidDynamicIslandView.swift  (compact/minimal/expanded)       │
│   Assets.xcassets               (méduse, palette aqua)           │
└──────────────────────────────────────────────────────────────────┘
```

## ContentState

```swift
struct FluidSessionAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var elapsedSec: Int        // toujours envoyé
    var totalSec: Int          // 0 si stretch infini / pas de durée
    var bpm: Int?              // nil si HK off ou pas de sample <30s
    var progress: Double       // 0..1, clamped côté Swift
  }
  var sessionTitle: String     // "Le dos expliqué"
  var pillarLabel: String      // "Comprendre son dos"
  var pillarColorHex: String   // "#AEEF4D" (lime méduse) ou variante pilier
  var startedAt: Date          // pour Text(timerInterval:) côté widget
}
```

`startedAt` permet d'utiliser `Text(timerInterval: ..., countsDown: false)`
côté SwiftUI : le widget incrémente le timer **sans push update** (Apple
budgétise dur les updates ActivityKit). On garde `elapsedSec` dans l'update
JS uniquement pour resynchroniser après un pause/reprise.

## Cadence des updates

- iOS budgète environ 1 update/seconde par activity, et coalesce.
- On envoie `update` toutes les **5 secondes** (timer côté widget tourne tout
  seul entre deux updates).
- Update BPM only quand la valeur change de ≥3 BPM (déjà fait dans
  `useLiveHeartRate`).

## Deep link

Tap sur la Live Activity → URL `fluidbody://session/<pilierKey>/<seanceIndex>`.
Routing déjà partiellement en place via `scheme: "fluidbody"` dans `app.json`.
Pas wiré dans cette branche ; ticket dédié pour la v1.1.

## Entitlements & capabilities

| Endroit | Entrée | Pourquoi |
| --- | --- | --- |
| `app.json` `ios.infoPlist` | `NSSupportsLiveActivities: true` | Active ActivityKit côté app |
| `app.json` `ios.infoPlist` | `NSSupportsLiveActivitiesFrequentUpdates: true` | Permet une cadence plus haute si Apple Watch active |
| `app.json` `ios.entitlements` | `com.apple.security.application-groups: [group.com.ytissot.fluidbody.shared]` | Partage data app ↔ widget |
| `targets/live-activity/expo-target.config.js` | App group identique | Widget lit le même groupe |
| Apple Developer portal | App Group `group.com.ytissot.fluidbody.shared` créé + assigné au bundle ID principal et au widget bundle ID | Sans ça, EAS build échoue |

## Hors scope de cette branche

- Smart Stack widget iOS 17+ (`supplementalActivityFamilies`).
- watchOS companion (déjà tracké dans [watchos-companion.md](./watchos-companion.md)).
- Interactive widgets (`AppIntent`-driven boutons pause/resume) — possible mais
  pousse à iOS 17+ et reload des séances depuis le widget.
- Localisation FR/EN/ES/IT des strings widget : v1.1.1.

## Effort restant après cette branche

| Bloc | Effort | Qui |
| --- | --- | --- |
| `expo prebuild --clean` + ouverture Xcode + signature target widget | 1 h | Yvan |
| Création App Group dans Apple Developer portal | 15 min | Yvan |
| Test fonctionnel Live Activity sur device iOS 16.2+ | 2 h | Yvan |
| Wiring deep link → MonCorps → bonne séance | 0.5 j | dev |
| Localisation strings widget | 2 h | dev |
| EAS build + TestFlight | 1 h | Yvan |

**Total restant : ~1-1.5 j dev + ~3 h Yvan.**
