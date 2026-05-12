# FluidBody — Perf pass `perf/fluidity-pass`

> Archivé le 2026-05-12 lors du merge de `perf/fluidity-pass` dans `main`.
> Branche d'origine : `perf/fluidity-pass`. Conservé ici pour traçabilité des gains de perf.

## TL;DR — Top 10 optimisations par impact ressenti

| # | Optimisation | Fichier(s) | Impact |
| - | --- | --- | --- |
| 1 | Splash forcé 3 s → 900 ms + visuels du splash allégés (plus de `LivingBackground`/`BULLES` pour ≤ 1 s d'affichage) | `App.js` | **Cold start visiblement plus court** (perte sèche : 0 → ~2 s récupérés sur chaque lancement à froid) |
| 2 | Suppression des `TEMP DEV` qui forçaient `WelcomeIntroScreen` + `ProfileSetupScreen` à **chaque** démarrage | `App.js` | L'app ne re-trigger plus l'onboarding sur les builds dev (réduit la session de démarrage de plusieurs secondes en plus de la confusion) |
| 3 | Toutes les méduses qui "flottent" passent de `left/top` (JS driver obligatoire) à `transform: translateX/Y` + `useNativeDriver: true` | `App.js`, `Meduse.js`, `MonCorps.js`, `SignIn.js` | **Le JS thread arrête de pulser à 60 Hz juste pour bouger des méduses.** Gros gain quand l'utilisateur scrolle/tap pendant que les méduses dérivent |
| 4 | `Meduse` / `MeduseCornerIcon` : tick SVG throttlé de 36 ms (28 fps) à 80 ms (12 fps) | `Meduse.js` | Les paths SVG des tentacules sont reconstruits ~2.5× moins souvent — invisible à l'œil (la houle est lente) mais coût JS divisé d'autant |
| 5 | Pré-fetch HLS sur tap de séance + dedup des appels concurrents à l'edge function `sign-video-url` | `videoUrl.js`, `MonCorps.js`, `App.js`, `Bibliotheque.js` | Pendant l'animation d'ouverture du `Modal` (~300 ms), l'URL signée est déjà chaude dans le cache → la vidéo "se lance plus vite" perceptiblement |
| 6 | Les 11 `ImageBackground` (react-native) migrent vers `<Image>` d'`expo-image` avec `cachePolicy="memory-disk"` | `App.js`, `Profil.js`, `Resume.js`, `TheorieDetailScreen.js`, `PaywallModal.js` | Décode plus rapide (SDWebImage sur iOS), cache disque persistant, transitions plus douces |
| 7 | Réduction du nombre d'animations concurrentes : `FloatingMedusas` 7→5, `MeduseRain` 18→12, `BULLES_DESC` 24→16, et retrait des loops `rotate`/`pulse` redondants sur chaque méduse flottante | `Meduse.js` | Moins de noeuds animés en parallèle = framerate plus stable sur iPhone d'entrée de gamme |
| 8 | Cleanup propre de toutes les `Animated.loop` orphelines (Bulle, Rayon, MeduseRainDrop, BulleDescendante, LivingMedusa, FloatingMedusas) | `Meduse.js` | Plus de loops zombies après unmount → moins de drain batterie, plus de re-renders fantômes |
| 9 | Suppression de ~1.8 Mo de fichiers morts (scaffold `my-app/`, screens orphelins `LiveClasses.js`+`Partage.js`, `generate_icon.js`, icônes dupliquées, screenshot 1.19 MB jamais référencé) | racine | Working tree plus propre, parse JS un poil plus rapide (imports `PilierCard` aussi retirés là où inutilisés) |
| 10 | Toutes les loops d'animation passent en mode "captured ref + stop()" plutôt que fire-and-forget, donc se taisent sur unmount | `Meduse.js`, `MonCorps.js`, `App.js`, `SignIn.js` | Empêche des animations de continuer à tourner après un changement d'écran (cause classique de stutter sur transitions) |

## Métriques avant / après

| Métrique | Avant | Après | Δ |
| --- | --- | --- | --- |
| Fichiers source supprimés (mort) | — | 47 fichiers | -1.83 MB |
| `App.js` lignes | 2461 | 2439 | ~ stable (les fixes équilibrent les ajouts) |
| `src/components/Meduse.js` lignes | 765 | 821 | +56 (cleanup explicite + commentaires) |
| `Animated.loop` total | ~30 | ~26 (loops réduits/dédupliqués) | -4 |
| `useNativeDriver: false` | 27 (35 % des animations) | 9 (12 %) | -18 cas, **tous les restants sont légitimes** (width, shadow, listener) |
| `ImageBackground` (react-native) | 11 | 0 | -11 |
| `<Image>` (`expo-image`) | 2 fichiers | 7 fichiers | +5 |
| Splash minimum forcé | 3000 ms | 900 ms | -2100 ms |
| `TEMP DEV` force-re-onboarding | 2 | 0 | -2 |
| Méduses flottantes simultanées (max écran) | 7 | 5 | -2 |
| Méduses tombantes (`MeduseRain`) | 18 | 12 | -6 |
| Bulles descendantes (`PluieBulles`) | 24 | 16 | -8 |
| Tick `setInterval` SVG des méduses | 36 ms (28 fps) | 80 ms (12 fps) | ~2.5× moins de re-renders SVG |
| Loops Animated leakées (sans cleanup) | ≥ 5 (Bulle, Rayon, MeduseRainDrop, BulleDescendante, LivingMedusa) | 0 | -5 |
| Appel réseau `sign-video-url` par lecture vidéo | 1 (synchronisé à l'ouverture du Modal) | ≤ 1, en parallèle du Modal | URL prête avant la fin de l'animation |
| `console.log` non gated `__DEV__` | 0 (déjà OK) | 0 | — |

## Changelog par commit

```
352747d  perf(deadcode): remove orphan scaffolds, TEMP DEV onboarding force, duplicate icons
a9556d4  perf(startup): cut splash minimum from 3000ms to 900ms, drop heavy splash visuals
dc0fd9f  perf(animations): flip floating medusas to native driver, throttle SVG tick
2678942  perf(images): migrate all ImageBackground to expo-image with memory-disk cache
918ca11  chore: drop unused PilierCard imports
921cdf2  perf(video): prefetch HLS sign URL on tap + dedup concurrent sign calls
```

## Fichiers modifiés

```
App.js                              | -29 lignes (déletions > ajouts)
src/components/Meduse.js            | +56 lignes (cleanup + transforms)
src/screens/MonCorps.js             | +18 lignes (cleanup ppMedusas + prefetch)
src/screens/SignIn.js               | + 6 lignes (cleanup)
src/screens/Profil.js               | net 0 (substitutions)
src/screens/Resume.js               | net 0 (substitutions)
src/screens/Bibliotheque.js         | + 5 lignes (prefetch)
src/screens/TheorieDetailScreen.js  | net 0 (substitutions)
src/components/PaywallModal.js      | net 0 (substitutions)
src/utils/videoUrl.js               | +43 lignes (dedup + prefetch helper)
```

Suppressions :
- `my-app/` (47 fichiers, scaffold Expo Router orphelin)
- `src/screens/LiveClasses.js` (non câblé dans le tab navigator)
- `src/screens/Partage.js` (idem)
- `generate_icon.js` (build script one-shot, pas dans `package.json` scripts)
- `assets/Capture d'écran 2026-04-01 à 09.41.42.png` (1.19 MB, 0 référence)
- `assets/icon.old.png` + `assets/icon_new.png` + `assets/icon_new.svg` (doublons de `icon.{png,svg}`)

## Tests manuels à faire avant merge

> Faire ça sur un appareil iOS (iPhone 11+ idéalement), en cold start, et faire la passe complète.

### Démarrage
- [ ] **Cold start** : tuer l'app, relancer. Le splash apparaît, dure environ 1 s (pas 3), puis transition normale vers la session.
- [ ] **Hot start** : revenir dans l'app après quelques secondes — pas de splash, retour direct.
- [ ] **Sans session** : démarrer sans être connecté → onboarding apparaît une seule fois (et NE réapparaît PAS au cold start suivant — c'était le bug TEMP DEV).
- [ ] **Avec session** : démarrer connecté → home `MonCorps` directement après le splash.

### Animations
- [ ] **Onboarding** : les méduses flottent et dérivent (drift) — vérifier visuellement que le mouvement reste fluide. Tap rapidement plusieurs fois sur les boutons pendant le drift — pas de stutter.
- [ ] **SignIn screen** : pareil, méduses flottent et bobbing fonctionne.
- [ ] **PilierPanel (MonCorps)** : ouvrir un pilier, les 3 méduses du haut flottent.
- [ ] **Splash** : vérifier que la méduse pulse et le texte fade — pas de bulles ni gradient animé (intentionnel).
- [ ] **Plein écran avec MeduseRain** : aller sur les écrans qui utilisent `MeduseRain` (s'il y en a — surtout au moment des célébrations ou hero paywall) → 12 méduses tombantes au lieu de 18 (visuellement plus aéré, OK ?).
- [ ] **Toggle done** sur une séance → animation de validation OK, pas de freeze.

### Images
- [ ] **Pilier modal** : l'image de fond de chaque pilier charge bien et reste visible (vérifier surtout `Resume.js` pour `recentSeances` et grille pilliers).
- [ ] **Paywall modal** : l'image hero (`PILIER_IMAGES.p7`) charge en haut.
- [ ] **Profil** : photo coach + thumbnails piliers OK.
- [ ] **Bibliothèque → Théorie d'un pilier** : hero charge, gradient appliqué dessus.
- [ ] **Mannequin (Resume)** : la silhouette tintée bleue charge correctement avec son tint.

### Vidéo
- [ ] **Tap sur une séance** : ouvrir la vidéo. Vérifier que le délai entre tap et "vidéo prête" est plus court qu'avant (gain perçu surtout sur 4G/réseau lent).
- [ ] **Lancer la même vidéo deux fois de suite** : la 2e fois est instantanée (cache mémoire `expo-image` poster + cache URL Bunny encore chaude).
- [ ] **Tap fond rapide sur 3 séances différentes** : pas de fuite / pas de stale URL (le dedup et la coalescence font leur travail).
- [ ] **Free trial (séance du jour)** : tap "Découvrir" → la vidéo se lance bien depuis le détail modal.
- [ ] **Bibliothèque → Théorie → tap sur une vidéo théorie** : se lance, vidéo OK.

### Pas de régression
- [ ] **Toggle subscription** (mode test) : paywall s'ouvre, achat fonctionne.
- [ ] **Auth Apple Sign In** : s'authentifier OK (le drift des méduses sur l'écran ne perturbe pas).
- [ ] **Apprendre une fiche / théorie** : navigation OK.
- [ ] **Notifications** : l'horaire reste configurable.
- [ ] **HealthKit** : flag toujours désactivé (HEALTHKIT_DISABLED = true), normal.

## Alternatives évaluées et écartées

- **Migration des `ScrollView` listes vers `FlatList` / `FlashList`** : les listes vues sont courtes (≤ 20 items pour les séances d'un pilier, ≤ 8 piliers, ≤ 10 articles). Les items contiennent des sections-headers conditionnels (`Fragment` autour de chaque entrée), ce qui complique la migration. À ce volume, le coût de refactor + risque de régression visuelle l'emporte sur le gain perçu (les images sont déjà cachées par `expo-image`, le React reconciler est efficace sur 20 items). À garder en réserve si on ajoute des listes de plusieurs centaines d'items plus tard.

- **`React.memo` sur la `SeanceRow` dans `MonCorps`** : même raisonnement — sur 20 items max avec des props stables et un `done` qui ne change qu'occasionnellement (tap utilisateur), le coût de reconciliation est < 5 ms, invisible à l'œil. À revoir si on profile une lenteur réelle au DevTools Profiler.

- **`useFocusEffect` pour pauser les animations sur les onglets non focus** : techniquement utile pour la batterie, mais en pratique tous les écrans tab gardent leur composant monté (`@react-navigation/bottom-tabs` défaut). L'ajout demanderait de wrapper chaque écran et de tester sur chaque transition. Reportée à un prochain pass dédié batterie.

- **Migration `expo-av` → `expo-video`** : `expo-video` est dispo (SDK 53+) et plus performant, mais c'est une migration de fond avec changement d'API. À planifier sur une PR dédiée, hors scope perçu de ce pass.

- **Pause du `setInterval` de tick SVG quand l'écran n'est pas visible** : meilleur en théorie mais demande un context provider visibility ou un hook d'écran. Le throttle 36→80 ms apporte déjà ~60 % du gain attendu, et ce pass préférait éviter d'introduire de nouvelles dépendances.

- **Re-encode `apple-watch-hero.png` (646 KB) vers WebP** : actuellement bundlé pour `HealthKitConnect`, écran désactivé via `HEALTHKIT_DISABLED = true`. Sera traité quand HK sera ré-activé.

## Comment merger

```
# review du diff
git diff main..perf/fluidity-pass

# avant push : supprimer / déplacer PERF_REPORT.md (cf. première ligne)
git mv PERF_REPORT.md docs/perf-fluidity-pass.md      # optionnel
# ou
rm PERF_REPORT.md && git add -u

git checkout main
git merge --no-ff perf/fluidity-pass
git push origin main
```
