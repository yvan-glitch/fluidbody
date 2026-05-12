# Live Activity (iOS) — scope & estimate

**Statut :** roadmap. Non implémenté dans `feat/premium-indispensable` car requiert :
- une dépendance native (`expo-live-activity` ou `@bacons/apple-targets` + ActivityKit Swift),
- un app target/extension Swift compilé via EAS development build,
- un alignement Expo SDK 54 ⇄ ActivityKit (iOS 16.1+) qui n'est pas validé dans le codebase actuel.

## Objectif

Pendant qu'une séance Fluidbody est en cours (le user a appuyé Play sur une vidéo),
afficher une Live Activity iOS :

- **Lock screen / Standby :** carte avec nom du pilier, nom de la séance, timer
  écoulé/total, mini anneau de progression. BPM live si `useLiveHeartRate` renvoie
  une mesure récente.
- **Dynamic Island :**
  - compact leading = jellyfish jaune-vert,
  - compact trailing = `mm:ss` écoulé,
  - expanded = pilier + séance + ring + bpm.
- **Tap →** ouvre l'app via deep link `fluidbody://session/<pilier>/<seanceIdx>`,
  remonte sur le `<VideoPlayer>` correspondant.

## Données poussées

ContentState (struct Swift) :

```swift
struct FluidSessionAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var elapsedSec: Int
    var totalSec: Int          // 0 si stretch infini
    var bpm: Int?              // null si HK off
    var progress: Double       // 0..1
  }
  var pilierLabel: String
  var seanceLabel: String
  var pilierColor: String      // hex
}
```

Mise à jour côté JS toutes les 5 s (Activity widgets sont rate-limited à
~1 update/s côté ActivityKit, et iOS coalesce de toute façon).

## Effort estimé

| Bloc | Effort | Notes |
| --- | --- | --- |
| Swift target Widget + Live Activity | 1.5 j | Skeleton via `npx create-target` ou template Xcode |
| Pont JS↔natif (start/update/end) | 0.5 j | Wrapper `NativeModule`, gérer permissions iOS 16.1+ |
| Câblage `<VideoPlayer>` (start on play, update on tick, end on close/complete) | 0.5 j | Réutiliser `elapsedSec` déjà calculé |
| Deep link → MonCorps → ouvrir la bonne séance | 0.5 j | Linking déjà partiellement en place |
| Polish glyph + ring + bpm color | 0.5 j | SVG → SwiftUI Shapes |
| EAS build + smoke test physical device | 0.5 j | iOS 16.1+ requis |

**Total : ~4 j ingénieur** (sans QA exhaustif). Pas raisonnable pour ce sprint sans
préparer l'app target Xcode d'abord.

## Pré-requis bloquants

1. Décision EAS : créer un second target iOS (LiveActivity widget extension).
   Implique modifier `app.json` `ios.entitlements` et passer en development build
   permanent (plus de Expo Go). À aligner avec la migration HealthKit qui tourne
   en parallèle — elle a déjà cassé la compat Expo Go.
2. Bundle ID du widget : `com.fluidbody.app.LiveActivity` (ou similaire), provisioning profile dédié.
3. iOS 16.1 minimum cohérent avec le `deploymentTarget` actuel (vérifier `app.json`).

## Alternative low-effort (à reconsidérer)

`expo-notifications` peut afficher une notification "live" persistante avec un timer
côté iOS (`category: 'session-running'`). Pas une vraie Live Activity (pas de Dynamic
Island, pas de ring), mais 1h d'effort pour un proxy visuel sur le lock screen.

→ Si Live Activity full est repoussée, on peut shipper cette version dégradée
en attendant. Décision à prendre par Yvan.

## Liens

- Apple : https://developer.apple.com/documentation/activitykit
- Lib Expo : https://github.com/expo/expo/tree/main/packages/expo-live-activity (encore alpha en SDK 54)
- Référence design : Strava, Apple Fitness+, Calm — tous ont une Live Activity séance.
