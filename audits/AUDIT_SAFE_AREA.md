# Audit Safe Area / Dynamic Island — Fluidbody iPhone

**Date**: 2026-06-04
**Contexte**: Suite au bug trouvé dans `src/screens/SabrinaProfile.js` (back button à `top: 56` hardcodé, passait sous la dynamic island sur iPhone 17 Pro Max où `safeAreaInsets.top` ~ 59–65 px), balayage de tout le codebase iPhone (screens + components + App.js) pour identifier les usages de `top:` / `paddingTop:` hardcodés à risque.

**Méthode**: ripgrep sur `src/screens/`, `src/components/`, `App.js`, filtré pour exclure les fichiers tvOS et les `top: 0` (full-screen overlays sans impact).

**Référence du fix appliqué** (SabrinaProfile.js):
```js
const insets = useSafeAreaInsets();
const backTop = IS_TV ? 60 : Math.max((insets.top || 0) + 8, 56);
```

---

## Résumé exécutif

**16 findings** au total :
- **6 HIGH risk** — tap targets (close/back/skip) ou wordmark + tap target dans modals `presentationStyle="fullScreen"` à `top: 56–58 / paddingTop: 56–58`.
- **6 MEDIUM risk** — headers à `paddingTop: 60–62` (borderline sur Pro Max où inset ~59–65 ; risque visuel sur le titre/wordmark, pas critique pour les taps).
- **4 LOW risk** — positions décoratives à `top: 64–128` (Meduse, wordmark animé) ou `top: 54` derrière un VideoPlayer fullscreen.

**Causes systémiques**:
1. Les modals `presentationStyle="fullScreen"` ne héritent PAS du `SafeAreaProvider` parent — `useSafeAreaInsets()` retourne 0 dedans sauf si on wrap explicitement.
2. Le code a été écrit avant le iPhone 17 Pro Max (dynamic island plus haute que les modèles précédents : ~59 px contre ~54 px sur 14 Pro/15 Pro).
3. Plusieurs écrans suivent déjà le bon pattern (`Activity.js`, `MyPrograms.js`, `ProgramBuilder.js`, `ProfileOnboarding.js`, `SabrinaProfile.js`) — preuve que le pattern existe mais n'a pas été propagé.

---

## Tableau des findings

| # | Fichier:Ligne | Composant | Écran utilisateur | Valeur | Risque |
|---|---|---|---|---|---|
| 1 | `App.js:505` | Back button `top: 56` dans `SeanceDetailModal` (fullScreen Modal) | Modal "Séance du jour" (carte gratuite home) | `top: 56` | **HIGH** |
| 2 | `src/components/PaywallModal.js:499` | Close button `top: 56, right: 20` dans Modal slide | Paywall (abonnement) | `top: 56` | **HIGH** |
| 3 | `src/components/BreathingCheckIn.js:285` | StyleSheet `topBar` `top: 60` dans Modal fade fullScreen | Modal respiration 60s (depuis MonCorps pill) | `top: 60` | **HIGH** |
| 4 | `src/components/Timer.js:159` | Header `paddingTop: 58` avec wordmark + close button dans Modal fullScreen | StretchTimerModal (timer Stretching/Eldoa) | `paddingTop: 58` | **HIGH** |
| 5 | `src/screens/HealthKitConnect.js:182` | Header `paddingTop: 56` avec wordmark + skip button | Écran HealthKit (onboarding ou settings) | `paddingTop: 56` | **HIGH** |
| 6 | `src/screens/MonCorps.js:580` (PilierDetail) | Header `paddingTop: 54` avec wordmark + back button (FocusableCard) | Détail pilier (liste séances) | `paddingTop: 54` | **HIGH** |
| 7 | `src/components/VideoPlayer.js:765,784,869,884` | Overlays HUD timer/HR/close à `top: 50` / `top: 56` (portrait possible — `unlockAsync`) | Lecteur vidéo (théorie ou séance en portrait) | `top: 50/56` | MEDIUM |
| 8 | `App.js:704` (AuthScreen) | Header `paddingTop: 58` avec wordmark + skip button | Modal d'auth Google/Apple | `paddingTop: 58` | MEDIUM |
| 9 | `App.js:2253` (WelcomeIntroScreen) | Wordmark `paddingTop: 58` | Premier lancement (welcome) | `paddingTop: 58` | MEDIUM |
| 10 | `src/screens/Bibliotheque.js:261,294` | Header `paddingTop: 58` avec back link + wordmark (ArticleDetail / FicheDetail) | Détail article ou fiche | `paddingTop: 58` | MEDIUM |
| 11 | `src/screens/Statistics.js:177` | Header `paddingTop: 62` avec back arrow + title | Modal statistiques | `paddingTop: 62` | MEDIUM |
| 12 | `src/screens/PilierEducation.js:339` | ScrollView `paddingTop: 60` avec close button | Modal "Comprendre" un pilier | `paddingTop: 60` | MEDIUM |
| 13 | `src/screens/Bibliotheque.js:802` | Header `paddingTop: 62` avec titre + wordmark | Onglet Bibliothèque (liste) | `paddingTop: 62` | LOW |
| 14 | `src/screens/Resume.js:463` / `Profil.js:614` | Wordmark + avatar `paddingTop: 62` | Onglets Résumé et Profil | `paddingTop: 62` | LOW |
| 15 | `src/screens/MonCorps.js:1332` (`logoRow` top: 54) + `2289` | Tabs strip + wordmark home MonCorps | Onglet Mon Corps (home) | `top: 54/105` | LOW (contenu non critique) |
| 16 | `src/components/CoachWelcomeOverlay.js:130` + `src/screens/SignIn.js:202` | Wordmark décoratif `top: 64/128` | Overlay welcome coach / écran SignIn | `top: 64/128` | LOW |

**Écrans à `paddingTop: 60` non listés** (`Preferences.js:125`, `Achievements.js:78`, `MesTelechargements.js:128`) — utilisent un texte `← Retour` *à l'intérieur du ScrollView*, donc scrollable et pas critique. Le wording du retour reste lisible mais peut chevaucher visuellement le bord de l'island sur Pro Max. **Risque très faible** car (a) c'est du texte pas un bouton stylé, (b) c'est scrollable. Pas inclus dans le tableau pour rester focus.

---

## Proposition de fix groupé

### Pattern réutilisable (déjà éprouvé dans SabrinaProfile.js)

```js
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// dans le composant
const insets = useSafeAreaInsets();
const headerTop = IS_TV ? 60 : Math.max((insets.top || 0) + 8, 56);
// ou pour un paddingTop :
const headerPad = IS_TV ? 60 : Math.max((insets.top || 0) + 12, 58);
```

**Pourquoi `Math.max(..., 56)`** : garantit un minimum sur les vieux iPhones (8/SE 2/3) où `insets.top` = 20 px et où on veut garder l'espacement design d'origine.

**Pourquoi `+8` / `+12`** : marge visuelle entre la fin de l'island et le bouton/texte.

### Pièges à gérer

1. **Modals `presentationStyle="fullScreen"`** : sur iOS, les insets ne sont PAS hérités automatiquement de l'app root. Deux options :
   - Wrap le contenu dans `<SafeAreaProvider>` à l'intérieur du Modal (lourd à propager partout).
   - **Recommandé** : importer `useSafeAreaInsets` dans le composant — sur iOS récents les modals fullScreen exposent quand même les insets via la racine RN. Si jamais ça renvoie 0 dedans (à tester sur device), fallback sur `Math.max(_, 56)` qui sauve.

2. **VideoPlayer (finding #7)** : le player unlock l'orientation au mount. En portrait, les contrôles à `top: 50/56` peuvent toucher l'island. Mais visuellement ils sont à `left: 16` / `right: 16` — hors zone centrale de l'island. Le fix devrait conditionner :
   ```js
   const isPortrait = dims.height > dims.width;
   const overlayTop = isPortrait ? Math.max((insets.top || 0) + 8, 50) : 50;
   ```

3. **App.js (findings #1, #8, #9)** : App.js est gros (~3765 lignes). Le fix doit être localisé aux 3 sites, pas refactor global.

### Plan de fix par phase

**Phase 1 — Critique (HIGH risk, ~2h)** :
- Fix #1 `SeanceDetailModal` (App.js:505)
- Fix #2 `PaywallModal` (close button)
- Fix #3 `BreathingCheckIn` (topBar style — passer en inline computed style)
- Fix #4 `Timer` (StretchTimerModal header)
- Fix #5 `HealthKitConnect` (header)
- Fix #6 `MonCorps PilierDetail` (paddingTop 54 → safe)

**Phase 2 — Polish (MEDIUM risk, ~1h)** :
- Fix #7 `VideoPlayer` (avec branche portrait/landscape)
- Fix #8 `AuthScreen` header
- Fix #9 `WelcomeIntroScreen` wordmark
- Fix #10 `Bibliotheque` ArticleDetail/FicheDetail
- Fix #11 `Statistics` header
- Fix #12 `PilierEducation` ScrollView

**Phase 3 — Cosmétique (LOW risk, optionnel ~30min)** :
- Findings #13–16 si visuellement gênant après QA sur device Pro Max.

### Estimation effort total

- **Phase 1 seule** : ~2h (6 fixes ciblés, pattern identique)
- **Phase 1 + 2** : ~3h
- **QA device** : 30 min sur iPhone 17 Pro Max physique (vérifier que chaque écran ouvre proprement, back button cliquable au-dessus de l'island).

### Notes additionnelles

- Considérer extraire un hook `useHeaderInsets()` dans `src/utils/` qui retourne `{ top, headerTop, headerPad }` pour éviter de répéter `Math.max(...)` à 12 endroits. ROI faible si on ne touche pas plus tard, mais utile si Apple change encore la taille de l'island (iPhone 18).
- Les screens `Activity.js`, `MyPrograms.js`, `ProgramBuilder.js`, `ProfileOnboarding.js`, `SabrinaProfile.js` sont déjà conformes — peuvent servir de référence visuelle pour homogénéiser.
- Sur Android, `insets.top` retourne la hauteur de la status bar (24–48 px selon device) — le pattern `Math.max(_, 56)` reste valide et évite les régressions Android.
