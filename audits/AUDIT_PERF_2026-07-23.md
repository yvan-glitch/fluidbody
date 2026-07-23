# Audit performance — Fluidité générale (2026-07-23)

Symptôme rapporté : manque de fluidité général, tous appareils (iPhone prod/dev, iPad, Apple TV).
Constats vérifiés dans le code (grep) : **0 `React.memo` et 0 `FlatList` dans tout `src/`**, aucun `freezeOnBlur`/`detachInactiveScreens`, timers Méduse à 80 ms confirmés.

## Cause racine n°1 — Cascade de re-renders depuis MainApp

`MainApp` (App.js:1411) détient ~30 `useState` et rend directement le `Tab.Navigator` avec des render-props et callbacks **inline** (App.js:2081-2097). Aucun écran n'est mémoïsé. Conséquence : n'importe quel `setState` (paywall, overlay, confetti, et surtout `setDone` après **chaque séance cochée**) re-rend les 5 onglets + ~15 modales.

Aggravant : `toggleDone` (App.js:1881-1966) enchaîne en `await` séquentiels ~8 lectures/écritures AsyncStorage + un upsert Supabase — le chemin le plus chaud de l'app bloque le retour visuel.

## Cause racine n°2 — Charge JS permanente des méduses

`Meduse.js:130` et `:249` : **chaque** méduse a son propre `setInterval(80 ms)` + `setState` qui reconstruit 13 paths SVG béziers par tick. `FloatingMedusas` = 5 instances, `MeduseRain` = 12, `PluieBulles` = 16. Sur MonCorps on dépasse 60 reconstructions de paths/seconde sur le thread JS, en concurrence directe avec le scroll. Aucun fond animé n'est mis en pause hors focus (pas de `useIsFocused` sauf VideoPlayer/OtaUpdateBanner).

## Cause racine n°3 — Listes non virtualisées

100 % des listes sont `ScrollView` + `.map()`. Jusqu'à ~160 cartes (8 piliers × 20 séances) montées d'un coup, chacune avec `expo-image` + `LinearGradient` 6 stops :
- MonCorps Recherche (MonCorps.js:2084-2135) : `allResults` reconstruit **dans le render** à chaque frappe, sans `useMemo`.
- MonCorps Explorer (1927-2033) : IIFE recalculée à chaque render.
- MonCorps PilierPage (616-712) : calcul O(n²) des en-têtes de section à chaque render.
- Bibliotheque (966-980) : ~160 cartes, `SeanceCard` non mémoïsé, callbacks recréés.
- Resume (434-453) : `totalDone`/`recentSeances`/`sortedPiliers` recalculés sans `useMemo`.

## Cause racine n°4 — Blurs temps réel en zones scrollées (violations de la règle du 07/07)

- **Statistics.js:84, 232, 244, 270, 310, 332** : 6 `GlassCard` intensity 55-70 dans le ScrollView.
- **PilierEducation.js:398-518** : jusqu'à 5 `GlassView` intensity 55-70 dans le ScrollView.
- **App.js:328** : tab bar `GlassView intensity={80}` permanente — flou recompositer à chaque frame de scroll de n'importe quel écran.
- **HeartRatePill.js:101** : BlurView 70 pendant la lecture vidéo, re-rendu par 3 `setState` par tick HR (useLiveHeartRate.js:109-111).

## Points conformes (à préserver)

LivingBackground rastérisé + native driver ; Profil en `intensity={0}` ; inits natives (HealthKit/RevenueCat/notifs) différées après le premier rendu ; expo-image partout avec dimensions/cache ; pas d'ombre animée frame par frame.

## Plan de correction priorisé (coût → impact)

1. **Ticker partagé des méduses** (Meduse.js) : un seul `setInterval` module-level diffusé aux instances (ou Reanimated). ~1 fichier, gain immédiat partout. **Impact : très fort.**
2. **Pause hors focus** : `useIsFocused()`/`AppState` pour stopper loops et intervals de LivingBackground/Meduse/Rayon/Bulle quand l'écran est masqué. **Impact : fort.**
3. **Stabiliser MainApp** : `useCallback` sur `toggleDone`/`openPaywall`/`onLogout`, extraire les render-props des `Tab.Screen` en composants stables, `React.memo` sur les 5 écrans, `freezeOnBlur: true` + `detachInactiveScreens` sur le Navigator. **Impact : très fort.**
4. **`toggleDone` non bloquant** : persistance fire-and-forget + regroupement des lectures streak/calendar/milestones. **Impact : fort (ressenti au cocher).**
5. **Blurs** : Statistics + PilierEducation → `intensity={0}` comme Profil ; tab bar → 40-50 ou substrat rastérisé. **Impact : fort sur iPhone pré-iOS 26.**
6. **`useMemo` manquants** : MonCorps Recherche/Explorer/PilierPage, Resume. Correctifs rapides. **Impact : moyen-fort.**
7. **Virtualisation** : `FlatList numColumns` sur Bibliotheque et MonCorps Recherche. Plus invasif — après 1-6. **Impact : fort sur le catalogue.**
8. tvOS : réduire/pré-rendre les halos focus `shadowRadius: 40` (GlassCardTV, FocusableCardTV). **Impact : moyen, TV only.**

Note dev : le mode dev/Expo est naturellement 2-5× plus lent — juger la fluidité sur un build TestFlight après correctifs.
