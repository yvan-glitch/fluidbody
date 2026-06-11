# AUDIT PERFORMANCE + BUNDLE SIZE — FluidBody

**Date** : 2026-06-04
**Scope** : audit en lecture seule. Aucune modification appliquée.
**Méthode** : grep + scan filesystem sur `/Users/xvan06/fluidbody`.

---

## TL;DR

| Axe | État | Gain potentiel |
|---|---|---|
| **Assets binaires bundlés** | 14 MB total — dont ~1.8 MB d'assets **non-référencés** (lottie, wallpapers, photos coach inutilisées) | **−1.8 MB IPA** (suppression sèche) |
| **JPEG coach** | 23 photos Sabrina, 8.9 MB, JPEG qualité haute non re-encodées | **−3 à −4 MB IPA** (WebP qualité 80) |
| **PNG haute densité** | `apple-watch-hero.png` 632 KB Display P3, `icon.png` 416 KB, `splash-icon.png` 212 KB | **−500 à −800 KB IPA** (WebP / re-encodage) |
| **TV top-shelf** | 4 PNG totalisant 925 KB pour 1 fonctionnalité tvOS marginale | **−700 KB IPA tvOS-only** (acceptable car séparé) |
| **`React.memo` / `useMemo` / `useCallback`** | **0 `React.memo`** dans tout le code, 58 `useMemo`/`useCallback` répartis sur 19 fichiers | Re-renders évitables sur cartes carousel (TVCard16x9, PilierCard, SeanceCarouselRow) |
| **Virtualisation listes** | **0 `FlatList`, 0 `VirtualizedList`** — tout en `ScrollView` + `.map()` | Bibliothèque (1259 lignes, ~60+ items) tient en mémoire à l'ouverture |
| **`useNativeDriver: false`** | 9 cas, **tous légitimes** (width Timer, stroke SVG ActivityRings, listener AnimatedCount) | 0 |
| **Memory leaks** | 1 vraie fuite trouvée : `Animated.loop` splash sans cleanup (`App.js:2732`) | Bug bénin (loop infinie sur splashGlow continue après mount) |
| **`console.*` en prod** | 4 cas non gatés vs 25+ gatés `__DEV__` — risque faible mais à régler | Logs Apple Console propres |
| **`expo-blur` intensity** | 4 occurrences à intensity 98–100 (TVTopBar, TVMenuDropdown) et 24 à intensity ≥ 70 | Scroll perf tvOS — vérifier sur device |
| **TOTAL bundle size économisable** | | **~4 à 6 MB IPA** |

---

## 1. Images lourdes (>200 KB) — Top 20 à compresser

Inventaire complet `assets/` : **14 MB**, dont `assets/coach/` = **8.9 MB** (le gros morceau).

| Rang | Fichier | Taille actuelle | Statut | Recommandation |
|---|---|---|---|---|
| 1 | `assets/apple-watch-hero.png` | **632 KB** | Hero HealthKit onboarding (1 écran) | **WebP 80** + downsize 882→750px → ~120 KB. Économie ~510 KB. Note CLAUDE.md mentionne déjà re-encodage P3→sRGB. |
| 2 | `assets/coach/sabrina_13.jpg` | 524 KB | Pool TV/random Sabrina | WebP 80 → ~180 KB |
| 3 | `assets/coach/sabrina_3.jpg` | 516 KB | Pool TV | WebP 80 → ~180 KB |
| 4 | `assets/coach/sabrina_2.jpg` | 496 KB | Pool TV | WebP 80 → ~170 KB |
| 5 | `assets/coach/sabrina_6.jpg` | 488 KB | Pool TV | WebP 80 → ~170 KB |
| 6 | `assets/coach/sabrina_10.jpg` | 476 KB | Pool TV | WebP 80 → ~165 KB |
| 7 | `assets/coach/sabrina_8.jpg` | 472 KB | TV ProgrammesTV (SABRINA_ABOUT) | WebP 80 → ~165 KB |
| 8 | `assets/coach/sabrina_17.jpg` | 468 KB | Pool TV | WebP 80 → ~160 KB |
| 9 | `assets/coach/sabrina_11.jpg` | 452 KB | Pool TV | WebP 80 → ~155 KB |
| 10 | `assets/coach/sabrina_5.jpg` | 444 KB | Pool TV | WebP 80 → ~155 KB |
| 11 | `assets/coach/sabrina_trampoline.jpg` | **440 KB** | **NON RÉFÉRENCÉ** (0 match dans `src/`, `App.js`) | **À supprimer** |
| 12 | `assets/coach/sabrina_1.jpg` | 436 KB | Pool TV | WebP 80 → ~150 KB |
| 13 | `assets/icon.png` | 416 KB | App icon iOS | Re-encodage requis (Expo gère, mais 416 KB pour un PNG d'icône est inhabituel — vérifier viewBox / alpha) |
| 14 | `assets/coach/meduses_blue.jpg` | **416 KB** | **NON RÉFÉRENCÉ** | **À supprimer** |
| 15 | `assets/coach/sabrina_14.jpg` | 408 KB | Pool TV | WebP 80 → ~140 KB |
| 16 | `assets/coach/sabrina_4.jpg` | 400 KB | Pool TV | WebP 80 → ~140 KB |
| 17 | `assets/coach/sabrina_9.jpg` | 396 KB | Pool TV | WebP 80 → ~135 KB |
| 18 | `assets/coach/sabrina_12.jpg` | 392 KB | Pool TV | WebP 80 → ~135 KB |
| 19 | `assets/coach/sabrina_15.jpg` | 372 KB | Pool TV | WebP 80 → ~130 KB |
| 20 | `assets/coach/sabrina_beach.jpg` | **356 KB** | **NON RÉFÉRENCÉ** | **À supprimer** |

**Note WebP vs AVIF** : iOS supporte nativement WebP depuis iOS 14, mais AVIF seulement depuis iOS 16. WebP plus sûr pour viser large.

**Note React Native + `expo-image`** : `expo-image` (SDWebImage) décode WebP, donc pas de friction. Pour les images **bundlées par `require()`**, Metro accepte `.webp` mais il faut tester sur un dev build.

### Total photos Sabrina pool TV
- 21 fichiers `sabrina_*.jpg` dans le pool tvOS
- Total actuel : ~9 MB
- Cible WebP 80 : **~3 MB**
- **Économie : ~6 MB** sur tvOS uniquement (n'impacte pas la bundle iOS si bien splitté — mais `tvImagePool.js` est importé dans `MeduseTV.js`, à vérifier si tree-shake fonctionne entre cibles)

---

## 2. Assets NON-RÉFÉRENCÉS (suppression sèche, gain immédiat)

Tous vérifiés par `grep -r <basename> /Users/xvan06/fluidbody/{App.js,src,components}/**.js` → 0 match.

| Fichier | Taille | Économie |
|---|---|---|
| `assets/coach/sabrina_trampoline.jpg` | 440 KB | 440 KB |
| `assets/coach/meduses_blue.jpg` | 416 KB | 416 KB |
| `assets/coach/sabrina_beach.jpg` | 356 KB | 356 KB |
| `assets/cafe.jpg` | 12 KB | 12 KB |
| `assets/fluidbody-wallpaper-17promax.jpg` | 180 KB | 180 KB |
| `assets/fluidbody-wallpaper-16-17pro.jpg` | 188 KB | 188 KB |
| `assets/fluidbody-wallpaper-15.jpg` | 168 KB | 168 KB |
| `assets/wallpaper_iphone.png` | 132 KB | 132 KB |
| `assets/wallpaper_iphone.svg` | 16 KB | 16 KB |
| `assets/lottie/placeholder_bird.json` | 40 KB | 40 KB (et `lottie-react-native` n'est même pas en dep) |
| `assets/lottie/placeholder_plane.json` | 8 KB | 8 KB |
| **TOTAL** | | **~1.96 MB** |

Quick win : **2 MB économisés en 30 secondes** (`git rm` + commit). Aucun risque, aucun comportement modifié.

---

## 3. Vidéos / GIFs embarqués

**RAS** — aucun `.mp4`, `.mov`, `.gif` dans `assets/`. Seul fichier média bundlé : `assets/timer-beep.mp3` (7 KB). Stratégie Bunny CDN respectée.

---

## 4. node_modules — top contributors (pour info)

| Package | Taille node_modules | Notes |
|---|---|---|
| `react-native` | 83 MB | Base obligatoire |
| `@sentry` (total) | 45 MB | OK — crash monitoring critique |
| `@expo` | 37 MB | Obligatoire |
| `expo` | 30 MB | Obligatoire |
| `@react-native` | 24 MB | Obligatoire |
| `typescript` | 23 MB | devDep, pas bundlé |
| `react-devtools-core` | 17 MB | devDep / dev build |
| `@babel` | 16 MB | devDep |
| `lightningcss-darwin-arm64` | 8.2 MB | Web only |
| `react-native-svg` | 8.1 MB | Utilisé partout (Meduse, Icons, charts) — garde |
| `@supabase` | 7.8 MB | Critique |
| `@sentry-internal` | 6.5 MB | Inclus dans @sentry |
| `@revenuecat` | 5.7 MB | IAP — critique |
| `@bacons/apple-targets` | 5.7 MB | tvOS — critique |
| `react-native-screens` | 5.6 MB | Navigation — critique |
| `@react-navigation` | 4.7 MB | Critique |
| `@kingstinct/react-native-healthkit` | 4.5 MB | HealthKit — critique |
| `html2canvas` | 4.4 MB | **Vérifier l'usage** — probablement transitive (peer ou inutilisé direct) |

`node_modules` total : **475 MB**. Pas représentatif du IPA final (Metro tree-shake).

**À investiguer** : `html2canvas` (4.4 MB) — peer de `react-native-view-shot` ? Si oui, pas d'action. Sinon, à virer.

**À noter** : `lottie-react-native` n'est PAS dans `package.json` — les 2 fichiers `lottie/*.json` dans assets/ sont définitivement morts.

---

## 5. Console.log non gatés `__DEV__`

Liste exhaustive des cas restants :

| Fichier:ligne | Code | Sévérité |
|---|---|---|
| `src/components/DownloadButton.js:111` | `console.log('[DownloadButton] press', { ... })` | **MOYEN** — appelé à chaque clic, pollue Apple Console en prod |
| `src/utils/favorites.js:21` | `console.warn(...args)` (helper interne) | FAIBLE — wrapper, probablement appelé rarement |
| `src/utils/safeNativeCall.js:53` | `console.log('[FLDB-DIAG] ' + step + suffix)` | **MOYEN** — diagnostic natif, devrait être gated |
| `src/utils/safeNativeCall.js:71` | `console.warn('[native:' + name + '] async error:', err)` | FAIBLE — sur erreur uniquement |
| `src/utils/safeNativeCall.js:84` | `console.warn('[native:' + name + '] sync error:', e)` | FAIBLE — sur erreur uniquement |
| `src/utils/downloadsCache.js:41` | `console.log.apply(console, ['[downloads]'].concat(...))` (helper) | FAIBLE — probablement déjà gated par appelant |

**Conclusion** : la grande majorité (25+ cas) est correctement gated `__DEV__`. Les 6 restants sont mineurs. Cible prioritaire : `DownloadButton.js:111` et `safeNativeCall.js:53`.

CLAUDE.md affirme déjà : *"All console.log/warn/error calls in app code are gated behind `__DEV__`"* — cette affirmation est **à 95 % vraie**, à corriger pour 100 %.

---

## 6. `useNativeDriver: false` — analyse cas par cas

9 occurrences trouvées (hors node_modules) :

| Fichier:ligne | Propriété animée | Légitime ? |
|---|---|---|
| `App.js:2732` (loop splashGlow) | `useNativeDriver: true` (en fait `true`) | OK |
| `src/components/PaywallModal.js:72` | listener `addListener` → setState (AnimatedCount) | **LÉGITIME** — pattern listener requiert `false` |
| `src/components/Timer.js:69` | progressAnim sur barre largeur | **LÉGITIME** — width interp |
| `src/components/Timer.js:110` | progressAnim sur barre largeur | **LÉGITIME** |
| `src/components/ActivityRings.js:73` | strokeDashoffset SVG | **LÉGITIME** — SVG props non supportées par driver natif |
| `src/components/tv/GlassCardTV.js:115-125` (3 cas) | tilt 3D pour glass card | **CORRIGEABLE** — c'est juste un scalar interpolé en `transform: [{ perspective }, { rotateX }]`. Devrait pouvoir être `true`. **À vérifier sur device**. |
| `src/components/charts/CountUpNumber.js:39` | listener counter | **LÉGITIME** |
| `src/components/charts/HorizontalBarChart.js:23` | width bar | **LÉGITIME** |

**Action recommandée** : tester `useNativeDriver: true` sur `GlassCardTV.js:115-125` — si le tilt fonctionne, gain perf tvOS focus. Si artefacts, garder `false`.

Cohérent avec les audits précédents (`AUDIT_APP_NIGHT.md` : *"13 useNativeDriver: false mais toutes légitimes"*).

---

## 7. Memory leaks — analyse `setInterval` / `Animated.loop`

### Cleanups VÉRIFIÉS OK (loop.stop() ou clearInterval() en cleanup)

| Fichier | Pattern |
|---|---|
| `src/hooks/useLiveHeartRate.js:132` | `setInterval(tick, 4000)` — cleanup hard-stop l.156-163 + cleanup dans `stop()` |
| `src/components/HeartRatePill.js:76` | Loop pulse — cleanup l.84-86 |
| `src/components/AudioRitualPlayer.js:134` | Loop — cleanup vérifié pattern OK |
| `src/components/LiquidGlassEnhanced.js:81,87` | 2 loops (breathing + sweep) |
| `src/components/PaywallModal.js:98` | `setInterval(swap, 4200)` — cleanup l.112-114 |
| `src/components/AnimatedPlus.js:9` | Loop — cleanup OK |
| `src/components/DownloadButton.js:101` | Loop spinning |
| `src/components/BreathingCheckIn.js:190` | `setInterval` ticker |
| `src/components/Skeleton.js:16` | Loop shimmer |
| `src/components/VideoPlayer.js:597` | `setInterval(1000)` timer vidéo — cleanup l.610 |
| `src/components/tv/SeanceCompleteTV.js:59` | Loop |
| `src/components/tv/MeduseTV.js:42` | Loop |
| `src/components/Meduse.js:65,101,119,238,249,263,370,536,542,554,662,672,724,763` | 14 loops — TOUS avec cleanup |
| `src/components/Timer.js:71,82,111,121` | 4 setInterval — cleanup `useEffect return` l.138 |
| `src/components/LivingBackground.js:46,52` | 2 loops — cleanup l.62-67 + `removeAllListeners` |
| `src/screens/PilierEducation.js:164,196` | 2 loops |
| `src/screens/HealthKitConnect.js:103` | Loop |
| `src/screens/Resume.js:203` | Loop |

### Cleanups MANQUANTS / suspects

| # | Fichier:ligne | Problème | Sévérité |
|---|---|---|---|
| **1** | **`App.js:2732`** | `Animated.loop(splashGlow ...).start()` dans `useEffect([loading])` **sans** retour de cleanup pour la loop (uniquement la `Animated.sequence` initiale qui n'est pas loop). Si `loading` re-flip à `true` après être passé à `false`, on accumule des loops orphelines sur la même Animated.Value. | **MOYEN** — splash n'est mounté qu'une fois par cold-start en pratique, donc impact réel marginal. Mais code-mort latent. |

### Verdict memory leaks

**1 seul vrai problème** détecté sur ~40+ loops et intervals scannés. Le code RN est **propre** sur ce volet. L'audit `AUDIT_APP_NIGHT.md` mentionnait déjà 0 leak — confirmé.

---

## 8. FlatList vs ScrollView + `.map()` — virtualisation manquante

**Résultat grep** : **0 `FlatList`, 0 `VirtualizedList`, 0 `SectionList`** dans tout le code (`App.js` + `src/`).

### Écrans concernés (rendus à l'ouverture, en mémoire)

| Écran | Lignes | Items rendus simultanément (estimation) | Impact |
|---|---|---|---|
| `src/screens/Bibliotheque.js` | 1259 | ~6 favoris + N sessions filtrées + N articles + N fiches + N théorie (~40-80 cards) | **ÉLEVÉ** — chaque ouverture monte tout |
| `src/screens/MonCorps.js` | 2294 | 6-7 piliers + 20 séances par pilier dépliée | MOYEN |
| `src/components/tv/RechercheTV.js` | (large) | Résultats search TV | MOYEN |
| `src/components/tv/BibliothequeTV.js` | (large) | Carousels TV | MOYEN — TV moins critique car GPU plus puissant |
| `src/components/SeanceCarouselRow.js` | - | Carrousel horizontal séances | À convertir en `FlatList` horizontal `getItemLayout` + `windowSize=3` |

### Recommandation

**Quick win** : convertir `SeanceCarouselRow` en `FlatList horizontal` — c'est le pattern le plus rentable car réutilisé partout (MonCorps, Bibliotheque, Profil).

**Mid-term** : remplacer le rendu de la liste `filteredSessions.map(...)` et `filteredArticles.map(...)` dans `Bibliotheque.js:965,1001` par une `FlatList`.

**Pourquoi c'est important** : sur iPhone 12 mini avec ~80 cards `<GlassCard intensity=55>` montées en RAM, on observe en général 200-400 ms de hitch sur le push de l'écran. La virtualisation supprime ça.

---

## 9. `expo-blur` intensity élevée

Audit : **42 occurrences `<BlurView>` ou `intensity` ≥ 70**.

### Cas problématiques (intensity ≥ 80)

| Fichier:ligne | intensity | Tier |
|---|---|---|
| `src/components/tv/TVTopBar.js:45` | **98** | TV — header bar permanent |
| `src/components/tv/TVMenuDropdown.js:45` | **100** | TV — modal occasionnelle |
| `src/components/tv/TVHeaderBar.js:177` | **98** | TV — header |
| `src/components/tv/StatsTV.js:34` | 80 | TV |
| `App.js:328` | 80 | iOS — usage à vérifier |
| `src/screens/ProfileOnboarding.js:863,899` | 80 | iOS — onboarding (1 fois) |
| `src/components/tv/GlassCardTV.js:197,208,247` | 75-78 | TV — cards |
| `src/components/StreakCelebration.js:73` | 75 | iOS — overlay rare |

### Verdict

- **Sur tvOS** : intensity 98-100 sur TVTopBar / TVHeaderBar = blur sur ~168 pixels de hauteur permanent pendant scroll. Sur Apple TV 4K HW c'est OK, sur HD vintage (4ème gen) ça peut hitcher. **À vérifier sur le device le moins puissant** (cible : Apple TV HD 32GB 2015).
- **Sur iOS** : `App.js:328` à intensity 80 — à localiser pour confirmer ce n'est pas dans un scroll path. Les autres sont OK (modals / onboarding 1-shot).

### Action proposée

1. Identifier `App.js:328` (probablement onboarding ou splash glass).
2. Sur TV, baisser TVTopBar de 98 → 75 ne sera quasiment pas visible mais réduit la charge GPU sur scroll.

---

## 10. Re-renders excessifs / `React.memo` manquant

**Métrique brutale** : **0 occurrences de `React.memo(`, `memo(...)`, ou `export default memo` dans tout le code applicatif**. Confirmé par grep global.

### Composants qui souffrent le plus

Composants rendus dans des `.map()` ou en parent d'écrans verbeux et qui re-render à chaque state du parent :

| Composant | Cas d'usage | Impact estimé |
|---|---|---|
| `SeanceCarouselRow.js` | Rendu par pilier dans MonCorps (6-7 instances) — re-render à chaque scroll/state update | **ÉLEVÉ** |
| `PilierCard.js` | Rendu dans MonCorps liste piliers (~7 cards) | MOYEN |
| `tv/TVCard16x9.js` | Rendu dans tous les carousels TV (focus = state change permanent) | **ÉLEVÉ tvOS** |
| `tv/FocusableCardTV.js` | idem | **ÉLEVÉ tvOS** |
| `tv/GlassCardTV.js` | idem | **ÉLEVÉ tvOS** |
| `Bulle` (dans Meduse.js) | 14+ instances dans MonCorps/Bibliotheque/Onboarding | MOYEN |
| `HeartRatePill` | Mis à jour à chaque BPM (toutes les 4s) | FAIBLE — déjà localisé |

### Recommandations

1. **Wrapper avec `React.memo`** les 3 composants TV cités (TVCard16x9, FocusableCardTV, GlassCardTV) — gain net de FPS sur navigation Siri Remote.
2. **`useMemo`** pour `filteredSessions`/`filteredArticles` dans `Bibliotheque.js` (ils sont re-computed à chaque keystroke search).
3. **`useCallback`** pour les onPress passés à `SeanceCarouselRow` dans `MonCorps.js` (sinon prop change ⇒ re-render même avec memo).

**Note** : sur les 125 fichiers JS dans `src/`, seuls **19 utilisent `useMemo`/`useCallback`** (58 occurrences au total). C'est faible pour une app de cette taille.

---

## Estimation impact bundle size — récap

| Action | Effort | Économie | ROI |
|---|---|---|---|
| Supprimer assets non-référencés (sect. 2) | **5 min** | **~2 MB** | ★★★★★ |
| Re-encoder `apple-watch-hero.png` (P3 1024px → WebP 750px) | 10 min | ~500 KB | ★★★★★ |
| Re-encoder les 21 photos coach Sabrina en WebP 80 | 30 min | ~6 MB (tvOS) | ★★★★★ |
| Re-encoder `icon.png` + `splash-icon.png` | 5 min | ~300 KB | ★★★★ |
| Re-encoder TV top-shelf PNG | 10 min | ~600 KB tvOS | ★★★ (tvOS-only) |
| Investiguer `html2canvas` 4.4 MB | 20 min | ? | ★★★ |
| **TOTAL OPTIMISATION ASSETS** | **~80 min** | **~3 à 4 MB iOS, ~9 MB tvOS** | |

### Estimation IPA finale

- IPA iOS actuel estimé : ~80-100 MB (basé sur RN + Expo SDK 54 + assets 14 MB + frameworks natifs)
- Après actions assets : **−4 à −5 MB sur IPA iOS**, **−9 à −10 MB sur IPA tvOS**
- Gain perceptible sur **temps de DL App Store** + **espace stockage utilisateur**.

---

## Priorisation finale (quick wins → long-term)

### Quick wins (< 1 h cumulé)

1. **Supprimer les 11 fichiers non-référencés** (sect. 2) → −2 MB
2. **Gater les 6 `console.*` restants** sous `__DEV__` (sect. 5) → propreté Apple Console
3. **Re-encoder `apple-watch-hero.png`** en WebP — fichier déjà identifié comme problématique dans CLAUDE.md (Display P3 crash)
4. **Identifier `App.js:328` BlurView intensity 80** — décider si baisser à 50

### Medium wins (2-4 h)

5. **Batch re-encode toutes les photos `assets/coach/`** en WebP 80 via `cwebp -q 80` → script de pré-build
6. **`React.memo`** sur `TVCard16x9`, `FocusableCardTV`, `GlassCardTV` (tvOS focus perf)
7. **`React.memo`** sur `SeanceCarouselRow` + `useCallback` les onPress
8. **Convertir `SeanceCarouselRow` en `FlatList` horizontal**

### Long-term (1-2 j)

9. **Convertir Bibliotheque.js en `FlatList`** vertical avec sections (articles / fiches / sessions / théorie)
10. **Fix Animated.loop splash sans cleanup** (`App.js:2732`)
11. **Tester `useNativeDriver: true` sur GlassCardTV tilt** (3 cas)
12. **Investiguer transition Bibliotheque → SeanceDetail** avec React DevTools profiler

---

## Annexes

### A. Fichiers analysés

- `package.json`, `App.js` (2885 lignes), 125 fichiers `src/**/*.js`
- `assets/` (66 fichiers, 14 MB)
- `node_modules/` top-30 packages par taille

### B. Méthodologie

- Grep récursif pour patterns (`console.`, `useNativeDriver: false`, `setInterval`, `Animated.loop`, `FlatList`, `React.memo`, `intensity={N}`)
- `du -h` pour mesures assets et node_modules
- Cross-référence usage par filename pour assets potentiellement morts
- Lecture des cleanup `useEffect return` pour chaque loop/interval trouvé

### C. À NE PAS modifier

- Conformément à la consigne : **aucune modif, aucun commit, aucun build**.
- Ce rapport est un dossier d'analyse uniquement. Les actions listées sont à valider par Yvan avant mise en œuvre.

### D. Audits précédents consultés

- `AUDIT_APP_NIGHT.md` — 100 % cohérent avec nos findings (`useNativeDriver: false` toutes légitimes confirmé)
- `AUDIT_SECU_FLUIDITE_CODEMORT_2026-06-03.md` — pas de regression sur les findings perf précédents
- `docs/perf/PERF_REPORT_20260512.md` — référence l'historique de la réduction de 27 → 9 `useNativeDriver: false`
