# Roadmap — Apple Watch companion app

**Statut** : sketch, à discuter. Pas de code livré. Effort estimé total :
**3-4 semaines** d'ingénieur senior iOS / Swift à temps plein, hors review et
TestFlight.

## Pourquoi

L'intégration HealthKit côté iPhone (live BPM, anneaux Activité, save workout)
nous donne déjà 80 % de la valeur. Un companion watchOS apporterait :

1. **Lancement de séance depuis la montre** (sans sortir le téléphone)
2. **HKWorkoutSession native** — meilleurs samples HR (1 Hz au lieu du polling
   4 s côté iPhone), capteur calibré, l'utilisateur n'a pas besoin de
   déverrouiller son iPhone pour que les données remontent
3. **Contrôle play/pause** (notifications system / Now Playing-like) pendant
   la séance
4. **Affichage BPM + timer** au poignet pendant l'exo

C'est un *gros différenciateur* face à Peloton/Headspace qui n'ont pas
d'expérience watch first-class.

## Contraintes techniques

Expo Go ne supporte pas les targets watchOS. Cela impose **expo prebuild**
(génération native managée → projet `ios/` checké-in et édité à la main).
Concrètement, ça veut dire :

1. Sortir du mode "managed" pur — l'app continue à utiliser Expo SDK et les
   plugins, mais l'iOS project devient édité-à-la-main (workspace `ios/`).
2. Ajouter un target watchOS au workspace Xcode (`ios/Fluidbody.xcworkspace`).
3. Mettre à jour `eas.json` pour builder les deux targets ensemble (EAS
   support deux targets en un seul build depuis 2025).

## Architecture proposée

```
ios/
  Fluidbody/                    (iOS app, RN/Expo)
  FluidbodyWatch/               (watchOS app, SwiftUI pure)
    FluidbodyWatchApp.swift
    Views/
      WorkoutListView.swift     liste des séances du jour, fetched via WatchConnectivity
      WorkoutDetailView.swift   détail séance + bouton Démarrer
      InSessionView.swift       affichage live BPM, timer, controls pause/stop
    Services/
      WatchConnectivityClient.swift   pont avec iOS via WCSession
      HealthKitSession.swift          wrapper HKWorkoutSession (start/stop/state)
      HeartRateMonitor.swift          query HR via HKLiveWorkoutBuilder
    Models/
      Workout.swift             struct mirroir des séances iOS (id, title, duration)
```

## Communication iOS ↔ watchOS

Apple expose **WatchConnectivity** (`WCSession`) pour pousser des messages
entre les deux apps. Deux usages :

1. **Côté iPhone → Watch** : push la liste des séances disponibles (avec
   métadonnées : durée, miniature, pilier) quand le user ouvre l'app, et la
   re-push à chaque changement (nouveau pilier débloqué, séance complétée).
   API: `WCSession.default.transferUserInfo` (background, FIFO, fiable).

2. **Côté Watch → iPhone** : à la fin d'une séance lancée depuis la montre,
   pousser le summary `{durationMs, avgBpm, maxBpm, energyKcal}` au téléphone
   pour qu'il appelle `saveWorkoutSample` (et marque la séance done dans
   l'AsyncStorage). API : `WCSession.default.sendMessage` (live, requires
   reachable phone) avec fallback sur `transferUserInfo`.

Pas d'API JS pour WatchConnectivity côté Expo — il faut écrire un **Expo
Module en Swift** qui expose les deux méthodes en TS depuis l'app RN. ~200
lignes de Swift + ~50 lignes de JS bindings.

## Authentification / abonnement

Le watchOS companion utilise les mêmes credentials Supabase + le même statut
RevenueCat que l'iPhone. Deux approches :

1. **Mirror simple** : la watch n'authentifie pas elle-même. Au lancement,
   elle demande à l'iPhone (via WCSession) si l'user est subscriber. Si oui,
   liste complète. Sinon, première séance free de chaque pilier seulement.
   *Recommandé* : simple, pas de cycle d'authent à gérer côté watch.

2. **Standalone** : la watch se connecte directement à Supabase (RevenueCat
   et Supabase ont tous deux des SDKs watchOS). Plus complexe — Sign in with
   Apple sur watch est OK mais magic link email ne marche pas.

## HKWorkoutSession + HKLiveWorkoutBuilder

Le composant clé côté watch. Pseudo-code Swift :

```swift
let config = HKWorkoutConfiguration()
config.activityType = .pilates
config.locationType = .indoor

let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
let builder = session.associatedWorkoutBuilder()
builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)

session.delegate = self          // didChangeTo state
builder.delegate = self          // workoutBuilder didCollect types

session.startActivity(with: Date())
try await builder.beginCollection(at: Date())

// callback `workoutBuilder(_:didCollectDataOf:)` reçoit les HR samples en live (~1 Hz).
// On les lit, on met à jour @State, l'UI SwiftUI se re-render.

// À la fin :
session.end()
try await builder.endCollection(at: Date())
let workout = try await builder.finishWorkout()
// → pousser le summary à l'iPhone via WCSession
```

Tout est natif, *pas* de polling JS. Précision ×10 vs notre setup actuel.

## Plan de livraison

| Sprint | Contenu |
| --- | --- |
| **S1 (1 sem)** | Setup : `expo prebuild --clean`, vérifier que l'iOS build reste vert. Ajouter un target watchOS minimal SwiftUI ("Hello"). Build sur device. |
| **S2 (1 sem)** | WatchConnectivity bridge (iOS ↔ watch). Liste des séances pushée depuis l'iPhone, affichée sur la watch. Pas de HK encore. |
| **S3 (1 sem)** | HKWorkoutSession + HKLiveWorkoutBuilder côté watch. Affichage BPM live + timer pendant l'exo. Pause/stop. |
| **S4 (0.5 sem)** | Push du summary à l'iPhone à la fin. Save côté iPhone via `saveHealthKitWorkout`. Mark séance done. |
| **S4 (0.5 sem)** | Polish UI watchOS (Digital Crown scroll, Complications optionnel, watchOS 10+ Smart Stack). TestFlight watchOS. |

## Risques

1. **expo prebuild churn** : passer d'un app.json-only setup à un `ios/`
   checké-in change le workflow pour toute l'équipe (chaque modif de plugin
   nécessite `npx expo prebuild`). À évaluer si ça vaut le coût.
2. **EAS build dual-target** : marche bien mais les sourcemaps/dSYMs Sentry
   ne sont auto pour le watch target — il faut wirer `sentry-cli` manuellement.
3. **Pilates ne supporte pas le GPS** : `locationType = .indoor` est OK mais
   on ne peut pas afficher un parcours, etc. (pas un besoin pour nous).
4. **Apple Watch SE** : pas de SpO2, pas d'ECG. Les zones HR fonctionnent.

## Alternative low-effort (à considérer avant de commiter au companion)

Une option intermédiaire : **garder le polling iPhone actuel**, mais
exposer une **Live Activity** (iOS 16.1+, Dynamic Island) sur l'écran de
verrouillage iPhone pendant la séance. C'est beaucoup plus simple (pas de
target watchOS), demande ~3 jours de dev, et donne 60 % de la valeur "BPM
visible sans regarder l'app".

À discuter.
