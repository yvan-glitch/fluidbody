# FluidBody — Perf pass (branche `perf/fluidity-pass`)

> Ce document trace l'état **avant** et **après** le pass de fluidité.
> Il sera supprimé/déplacé avant merge.

## État des lieux (avant)

### Métriques

| Métrique | Valeur initiale |
| --- | --- |
| `App.js` lignes | 2461 |
| `src/components/Meduse.js` | 765 lignes |
| `src/components/VideoPlayer.js` | 902 lignes |
| `src/screens/MonCorps.js` | 1284 lignes |
| `src/screens/Resume.js` | 765 lignes |
| `Animated.loop` total | ~30 occurrences (App.js + src/) |
| `useNativeDriver: false` | 27 occurrences (35% des animations) |
| `ImageBackground` (react-native) | 9 instances dans 7 fichiers |
| `<Image>` (expo-image) | 2 fichiers |
| `console.log` non-gated | 0 (tous `__DEV__`) ✓ |
| Splash minimum forcé | **3000 ms** (App.js:2239) |
| `TEMP DEV` force-re-onboarding | 2 (App.js:2042, 2086) |
| Code mort identifié | `my-app/`, `LiveClasses.js`, `Partage.js`, `generate_icon.js` |
| Asset > 500 KB | 2 (`apple-watch-hero.png` 646 KB, `Capture d'écran…png` 1.19 MB inutilisé) |
| Asset profil P3 (autre que apple-watch déjà fix) | `icon.old.png` (mais legacy, non bundlé probablement) |

### Goulots identifiés

**Démarrage**
- Splash forcé minimum 3 secondes (App.js:2237) — pénalise le ressenti dès la première seconde
- `TEMP DEV` force le re-onboarding et re-profile setup à CHAQUE démarrage (App.js:2042, 2086)
- `Meduse` composant utilise un `setInterval(36ms)` qui déclenche `setState` à ~28 Hz — re-render SVG complet à chaque tick (Meduse.js:105, 222)
- Init Supabase, Sentry, RC, etc. : tous synchrones au top du module App.js

**Animations**
- `FloatingMedusas` (Meduse.js:565) : 7 méduses × 4 animations chacune en parallèle = 28 timing loops, toutes `useNativeDriver: false` car animent `left`/`top` au lieu de `transform`
- `BulleDescendante` × 24, `MeduseRain` × 18, `FloatingMedusas` × 7 = 50+ animations simultanées possibles
- Mêmes patterns dans `App.js` (lignes 901-902), `SignIn.js`, `MonCorps.js` (174-175)
- `LivingMedusa` (Meduse.js:509-526) : 3 loops sur `floatAnim`/`glowAnim`/`particles` en `useNativeDriver: false` alors qu'aucune raison structurelle ne l'impose (juste flou)

**Images**
- 9 `ImageBackground` de react-native (pas d'`expo-image`) :
  - `App.js` (×3 : Progresser, SeanceDetailModal, ProfileSetupScreen)
  - `Profil.js` (×5)
  - `Resume.js` (×3)
  - `TheorieDetailScreen.js` (×1)
  - `PaywallModal.js` (×1)
  - `LiveClasses.js`, `Partage.js` (mort)
- `cachePolicy` non explicite ailleurs

**Listes**
- Liste `seances` (jusqu'à 20 par pilier) actuellement rendue via `.map()` dans des ScrollView (App.js:1657, 1867). Plusieurs piliers = max ~120 items
- `MonCorps.js` calendrier 28 jours `.map()` + flexWrap → acceptable
- Pas d'usage de FlatList pour les vraies listes

**Code mort**
- `my-app/` : scaffold Expo Router non utilisé
- `generate_icon.js` (root) : script de build d'icône — peut être déplacé
- `src/screens/LiveClasses.js`, `src/screens/Partage.js` : pas dans le tab navigator
- `assets/Capture d'écran 2026-04-01 à 09.41.42.png` (1.19 MB) : référencé nulle part (recherché — 0 hits dans App.js et src/)
- `assets/icon.old.png` (189 KB) : remplacé par `icon.png`
- `assets/icon_new.png` (288 KB, identique à `icon.png`) : doublon

### Plan d'action (par ordre d'impact perçu)

1. **Démarrage**
   1. Retirer les `TEMP DEV` force-onboarding/profile-setup
   2. Réduire le minimum splash à 800–1000 ms
   3. Retirer LivingBackground + BULLES du splash (visuels lourds pour 1 sec)
   4. Différer (`InteractionManager.runAfterInteractions`) l'init RC et la souscription auth state
2. **Animations**
   1. Migrer toutes les `Animated.Value(left/top)` des méduses vers `transform: translateX/Y` + `useNativeDriver: true`
   2. Throttler ou supprimer le `setInterval(36ms)` qui pilote `tickRef` dans `Meduse` et `MeduseCornerIcon`
   3. Plafonner `FloatingMedusas` à un nombre raisonnable
3. **Listes** : convertir le rendu vertical de piliers et `seances` en `FlatList` avec `getItemLayout`
4. **Images** : migrer les 9 `ImageBackground` vers `expo-image` (`<Image>` en absolute + content overlay)
5. **VideoPlayer** : prefetch HLS dès tap sur séance, fade-in poster propre
6. **Re-renders** : `React.memo` + `useCallback` sur `PilierCard`, mémos sur les calculs lourds (déjà partiel)
7. **Code mort** : suppression `my-app/`, fichiers orphelins, assets inutiles
8. **Bundle** : audit final

---

## Modifications appliquées

_(Mis à jour au fil des commits)_

## État final (après)

_(Mesures à remplir à la fin)_
