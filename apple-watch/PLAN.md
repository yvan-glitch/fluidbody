# FluidBody+ — App Apple Watch · Plan d'architecture

> Posé pendant la nuit du 3 juin 2026. **Tout ce dossier `apple-watch/` est un échafaudage : rien n'est encore branché dans le build.** Aucun risque pour ton app actuelle. On assemblera ensemble, au calme.

## L'objectif (inspiré de FitOn)

Une montre qui se connecte à l'app :
1. Sur le téléphone, tu lances une séance → la montre affiche un **compte à rebours** puis le **timer** de la séance.
2. La montre montre ta **fréquence cardiaque en temps réel** (gros chiffre BPM) + les calories.
3. Un bouton **Démarrer / Pause / Terminer** au poignet.
4. À la fin, la séance est enregistrée dans **Apple Santé** (déjà partiellement fait côté app via `saveHealthKitWorkout`).

## La réalité technique (à savoir)

- **Expo ne gère pas nativement watchOS.** Il faut ajouter une **cible watchOS** (un vrai mini-projet SwiftUI) au projet Xcode généré par `expo prebuild`. La façon moderne et propre : le config plugin **`@bacons/apple-targets`** (d'Evan Bacon, le créateur d'Expo Router) qui injecte des cibles Apple (widgets, watch…) dans le projet à chaque prebuild, sans éjecter.
- **Le temps réel de la fréquence cardiaque** (comme FitOn) **exige que la montre lance une `HKWorkoutSession`** active. C'est la séance d'entraînement watchOS qui (a) garde l'app montre éveillée écran allumé, (b) donne un flux HR fréquent (~1/sec) au lieu des relevés épars du fond. C'est LE cœur du projet.
- **La communication montre ↔ téléphone** passe par le framework **WatchConnectivity** (`WCSession`) : le téléphone envoie « démarre la séance X » → la montre ; la montre renvoie HR + temps écoulé → le téléphone (pour afficher les BPM aussi dans l'app, comme FitOn le fait sur les deux écrans).
- **Test obligatoire sur appareil réel** : le simulateur watchOS ne fournit pas de vraie fréquence cardiaque. Il faut une Apple Watch appairée à ton iPhone + un build de dev. Tu en as une (vue dans les captures) — parfait.
- **Builds = crédits EAS.** Chaque itération native coûte. On limitera les allers-retours en validant un maximum « à froid » avant de builder.

## Architecture cible

```
┌─────────────────────────┐         WatchConnectivity (WCSession)         ┌──────────────────────────┐
│   iPhone — app RN/Expo   │  ── "start session {pilier,seance,duree}" ──▶ │   Apple Watch — SwiftUI   │
│                          │                                               │                          │
│  VideoPlayer (séance)    │  ◀── "tick {bpm, elapsed, kcal}" (1/sec) ──── │  WorkoutManager           │
│   │                      │                                               │   • HKWorkoutSession      │
│   ├─ WatchSessionBridge  │  ◀── "finished {duree, kcal, avgBpm}" ─────── │   • HKLiveWorkoutBuilder  │
│   │   (module natif iOS) │                                               │   • live HR (1/sec)       │
│   └─ affiche BPM en live │                                               │  WorkoutView (UI poignet) │
└─────────────────────────┘                                               └──────────────────────────┘
```

### Côté montre (watchOS, SwiftUI) — `watch-app/`
- **`FluidBodyWatchApp.swift`** : point d'entrée de l'app montre.
- **`WorkoutManager.swift`** : démarre/arrête `HKWorkoutSession` + `HKLiveWorkoutBuilder`, publie `heartRate`, `elapsed`, `activeCalories` en `@Published` (temps réel).
- **`WorkoutView.swift`** : l'écran au poignet — compte à rebours, timer, gros BPM, calories, boutons Pause/Terminer.
- **`WatchConnectivityManager.swift`** : reçoit l'ordre « démarre » du téléphone, renvoie les ticks HR.

### Côté téléphone (iOS natif) — `ios-bridge/`
- **`WatchSessionBridge.swift` + `.m`** : module natif exposé à React Native. Méthodes : `startWatchWorkout(sessionInfo)`, événements `onWatchHeartRate`, `onWatchWorkoutEnded`. C'est ce que `VideoPlayer` appellera au lancement d'une séance, et qui alimentera l'affichage BPM dans l'app.

### Côté Expo — `expo-config/`
- **`expo-target.config.js`** (exemple) : décrit la cible watchOS pour `@bacons/apple-targets`.
- Notes pour `app.json` : entitlements HealthKit déjà présents côté iPhone ; il faut les déclarer aussi pour la cible montre + l'`WKCompanionAppBundleIdentifier`.

### Côté RN (app, testable AVANT la montre) — phase 1 recommandée
Indépendamment de la montre, on peut d'abord livrer dans l'app (iPhone + Apple TV) :
- un **compte à rebours + timer** pendant la séance (pur JS, aucun natif) ;
- l'**affichage des BPM** via le hook existant `src/hooks/useLiveHeartRate.js` (HealthKit, best-effort sans la montre, temps réel dès que la montre fait tourner une workout).
C'est rapide, testable tout de suite, et ça donne déjà l'effet FitOn sur le téléphone. **Je recommande de faire cette phase 1 en premier** (un seul build), puis d'attaquer la cible montre.

## Étapes d'intégration (à faire ENSEMBLE, au réveil)

1. `npm install @bacons/apple-targets` (config plugin) + l'ajouter à `app.json`.
2. Créer le dossier `targets/watch/` attendu par le plugin et y copier les fichiers SwiftUI de `watch-app/`.
3. Déclarer les entitlements HealthKit + background pour la cible montre.
4. `npx expo prebuild -p ios` pour générer la cible dans Xcode, vérifier qu'elle apparaît.
5. Brancher `WatchSessionBridge` dans `VideoPlayer.js` (lancer la workout montre au début d'une séance).
6. `eas build -p ios --profile development` (dev client) → installer sur iPhone → l'app montre se déploie sur l'Apple Watch appairée.
7. Tester au poignet : compte à rebours, BPM temps réel, fin de séance → vérifier dans Santé.

## Décisions à valider avec toi
- **Type de workout HealthKit** : `.pilates` (66) — cohérent avec `saveHealthKitWorkout` existant. ✅ proposé.
- **La montre peut-elle démarrer une séance seule** (sans le téléphone) ou seulement « suivre » une séance lancée sur le téléphone ? FitOn permet les deux ; je propose **phase A = la montre suit le téléphone** (plus simple), **phase B = démarrage autonome**.
- **Nom + icône** de l'app montre (réutilise la méduse ?).

## Honnêteté sur le périmètre
Cette nuit j'ai écrit **le plan + tout le code de départ**. Ce code est réaliste et commenté, mais il **n'a pas été compilé** (pas de Xcode ici) : il servira de base solide qu'on ajuste à la première compilation. Le vrai « ça tourne au poignet » se fera avec toi, sur ta montre. Pas de magie nocturne — mais une grosse longueur d'avance.
