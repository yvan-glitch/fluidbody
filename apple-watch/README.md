# apple-watch/ — Échafaudage de l'app Apple Watch FluidBody+

**Rien ici n'est branché dans le build.** C'est une base de départ écrite la nuit
du 3 juin 2026 pour démarrer vite, ensemble, au réveil. Lis d'abord `PLAN.md`.

## Ce qu'il y a dedans

```
apple-watch/
├── PLAN.md                       ← architecture + décisions + honnêteté périmètre (À LIRE)
├── watch-app/                    ← l'app montre (SwiftUI + HealthKit)
│   ├── FluidBodyWatchApp.swift       point d'entrée
│   ├── WorkoutView.swift             écran poignet : compte à rebours, timer, BPM, boutons
│   ├── WorkoutManager.swift          HKWorkoutSession + HR temps réel (le cœur)
│   └── WatchConnectivityManager.swift  pont montre ↔ téléphone
├── ios-bridge/                   ← côté iPhone, module natif RN
│   ├── WatchSessionBridge.swift      lance la séance montre + remonte les BPM à RN
│   └── WatchSessionBridge.m           expose le module à JavaScript
├── rn/
│   └── useWatchWorkout.js            hook RN à utiliser dans VideoPlayer.js
└── expo-config/
    └── expo-target.config.js         gabarit @bacons/apple-targets pour injecter la cible
```

## Plan d'intégration (à faire ENSEMBLE)

1. **Installer le plugin** : `npm install @bacons/apple-targets` + l'ajouter aux `plugins` de `app.json`.
2. **Créer la cible** : dossier `targets/watch/` → y copier les `.swift` de `watch-app/` + le `expo-target.config.js` (en adaptant le bundle id).
3. **Brancher le module iPhone** : copier `ios-bridge/WatchSessionBridge.*` dans la cible iPhone (via le plugin ou un dossier natif), copier `rn/useWatchWorkout.js` dans `src/hooks/`.
4. **Câbler VideoPlayer.js** : au début d'une séance, `startOnWatch({ title, plannedDuration })` ; à la fin, `stopOnWatch()` ; afficher `watchBpm` à l'écran.
5. **Prebuild** : `npx expo prebuild -p ios` → vérifier que la cible « FluidBody+ Watch » apparaît dans Xcode.
6. **Build dev** : `eas build -p ios --profile development` → installer sur l'iPhone → l'app montre se déploie sur l'Apple Watch appairée.
7. **Tester au poignet** : lancer une séance sur le téléphone → compte à rebours + BPM temps réel sur la montre → fin → vérifier l'entraînement dans Apple Santé.

## Avertissements honnêtes
- Code **non compilé** (pas de Xcode ici) : attends-toi à 2-3 ajustements à la première compilation (signatures d'API HealthKit/WatchConnectivity selon la version watchOS).
- **Test sur appareil réel obligatoire** : le simulateur ne donne pas de vraie fréquence cardiaque.
- Chaque build = **crédit EAS**. On validera un maximum à froid avant de builder.

## Recommandation
Avant d'attaquer la cible montre (lourde), faire la **phase 1** décrite dans `PLAN.md` :
timer + affichage BPM **dans l'app iPhone/TV** (via le hook existant `useLiveHeartRate`).
C'est rapide, testable en un seul build, et ça donne déjà l'effet FitOn.
