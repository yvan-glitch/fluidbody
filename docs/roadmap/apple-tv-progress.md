# Roadmap — Apple TV : état d'avancement

> Mis à jour le **2026-05-18** sur la branche `feat/apple-tv-foundation`
> (Phase 1 commits poussés depuis `claude/flamboyant-franklin-ee2a5f`).
> Mettre à jour ce fichier à chaque PR / phase. Reste source de vérité de
> "où on en est".

## État résumé

**Phase 0 — Fondations** : ✅ **Terminée**. Décision technique actée
(`react-native-tvos` + plugin `config-tv`), 4 docs roadmap rédigés, EAS
profiles TV ajoutés, helper `platformTV.js` posé.

**Phase 1 — Swap deps + plugin conditionnel + premiers écrans** : ✅
**Terminée côté code**. Reste à faire un premier prebuild + dev client TV
sur device physique (étape manuelle, voir bloc « Tests manuels » ci-dessous).

Ce qui a changé en Phase 1 (vs phase 0) :

- `package.json` : `react-native@0.81.5` → `npm:react-native-tvos@0.81.5-2`
  (fork drop-in, n'altère pas le build iOS). `@react-native-tvos/config-tv@^0.1.6`
  en devDependency.
- `app.config.js` (nouveau) : wrappe `app.json`. Quand `EXPO_TV` n'est pas
  set, retourne la config inchangée → iOS prod 100 % préservé. Quand
  `EXPO_TV=1`, strip HealthKit / AppleAuth / datetimepicker / notifications
  et injecte le plugin `config-tv`.
- `src/utils/platformTV.js` : ajout de `tvFocusProps(preferred)` (renvoie
  `{}` hors TV) et constante `TV_FOCUS_RING`.
- 3 écrans adaptés au focus engine tvOS :
  - `src/screens/MonCorps.js` — cards pilier 320 px sur TV (vs `SW * 0.45`),
    cards "gratuit du mois" 380×440 px, `hasTVPreferredFocus` sur la
    première card, séances individuelles à 140 px de haut.
  - `src/screens/Bibliotheque.js` — grille passe de 2 cols à 4 cols sur TV,
    `cardHeight` 240 px, focus sur articles + fiches + théorie.
  - `src/components/VideoPlayer.js` — `ScreenOrientation` no-op sur TV,
    pill BPM forcée OFF (pas de HealthKit sur tvOS), bouton X agrandi à
    56 px sur TV avec focus préféré, bouton retry idem.

Validation :
- `npm install` clean (seulement warning peer `react-native-purchases`
  qui demande RN ≥ 0.73 — OK puisque le fork est sur 0.81.5).
- `expo-doctor` : 17/17 en mode iOS standard ET en mode `EXPO_TV=1`.
- `expo config --type public` : iOS → plugins identiques à l'app.json
  d'origine. TV → HealthKit + AppleAuth + datetimepicker + notifications
  retirés, `@react-native-tvos/config-tv` injecté.
- Parse Babel OK sur les 3 fichiers JS modifiés.

**Phases 2-4** : non commencées.

## Ce qui est fait sur cette branche

| Fichier | Type | Impact prod |
|---|---|---|
| `docs/roadmap/apple-tv-strategy.md` | nouveau | aucun |
| `docs/roadmap/apple-tv-business-case.md` | nouveau | aucun |
| `docs/roadmap/apple-tv-setup.md` | nouveau | aucun |
| `docs/roadmap/apple-tv-progress.md` | nouveau (ce fichier) | aucun |
| `eas.json` | +3 profils `*-tv` (extends + `EXPO_TV=1`) | aucun (additif, n'altère pas `development` / `preview` / `production`) |
| `src/utils/platformTV.js` | nouveau helper `IS_TV` + capabilities | aucun (renvoie `false` sur RN core, importé nulle part encore) |

**Modifs Phase 1 (cette session)** :

| Fichier | Type | Impact prod iOS |
|---|---|---|
| `package.json` | swap `react-native` → `react-native-tvos@0.81.5-2`, ajout `@react-native-tvos/config-tv@^0.1.6` | nul — fork drop-in à parité avec RN 0.81.5, `npm:` alias propre, EAS `npm ci` OK |
| `package-lock.json` | régénéré par `npm install` | nul (lockfile en sync) |
| `app.config.js` | nouveau, wrap `app.json` conditionnellement | nul quand `EXPO_TV` unset → returns config inchangée |
| `src/utils/platformTV.js` | +helper `tvFocusProps()` + const `TV_FOCUS_RING` | nul (`tvFocusProps()` retourne `{}` hors TV, et `IS_TV === false` sur iPhone/iPad) |
| `src/screens/MonCorps.js` | sizing conditionné `IS_TV`, `{...tvFocusProps()}` sur 3 cards | nul — `IS_TV === false` sur iOS, donc spread `{}` |
| `src/screens/Bibliotheque.js` | grille 4 cols sur TV, focus sur cards | nul (idem) |
| `src/components/VideoPlayer.js` | `ScreenOrientation` no-op TV, BPM forcée OFF TV, X+retry focus | nul (idem) |

## Ce qui reste à faire — par ordre de priorité

### 🔴 P0 — Bloque tout le reste (Yvan, à faire en premier)

> **Phase 1 code-side DONE** — le swap deps + plugin + écrans est en place
> sur la branche. Ce qui reste P0 :

1. **Tests manuels** (~10 min cumulés) :
   - `unset EXPO_TV && npx expo start` → app iOS doit lancer comme avant
     (non-régression). Si crash ou écran rouge → revert le swap RN.
   - `EXPO_TV=1 npx expo start` → app devrait essayer de lancer en mode
     TV. Probable erreur Metro car aucun simulator/device TV pairé encore,
     mais le bundling doit passer.
2. ~~Lire `apple-tv-strategy.md`~~ (fait)
3. ~~Lire `apple-tv-setup.md`~~ (fait)
4. Pre-launch poll Instagram "vous avez une Apple TV ?" — voir
   `apple-tv-business-case.md`. Sans signal marché, ne pas investir
   les 6 sem. — **1 j de patience**
5. Setup Apple Developer Portal (étapes 1-5 du setup doc : provisioning,
   App ID, App Store Connect record, RevenueCat tvOS) — **~1 h cumulée**
6. **Si GO** : `EXPO_TV=1 npx expo prebuild --clean` puis premier build
   tvOS via `eas build --profile development-tv --platform ios` ou Xcode
   direct, jusqu'à avoir l'écran Metro packager qui tourne sur l'Apple TV
   physique ou simulator — **0.5-2 j**

### 🟠 P1 — Phase 2 (après que P0 marche)

5. Mocker / exclure les modules incompatibles tvOS du Podfile TV (cf.
   `apple-tv-setup.md` étape 8). HealthKit, expo-apple-authentication,
   datetimepicker, notifications. — **0.5-1 j**
6. Écran login TV — UX QR code (l'iPhone scanne, push le token Supabase
   via deep link, l'Apple TV poll un endpoint). Reuse magic link Supabase
   en fallback. — **2-3 j**
7. Refonte écran Bibliothèque pour TV — grille focusable avec
   `TVFocusGuideView`, `tvParallaxProperties` sur les cards, gestion du
   focus initial. Créer `Bibliotheque.tv.js`. — **2 j**
8. VideoPlayer tvOS — adapter pour AVPlayer fullscreen, contrôles Siri
   Remote (swipe horizontal = seek, touch central = pause, menu = back),
   overlays plus gros (vu à 2-3 m). Créer `VideoPlayer.tv.js`. — **3-4 j**
9. Home screen TV (`MonCorps.tv.js`) — simplifié pour TV : juste les
   piliers en grille focusable, pas de body map interactive. — **1-2 j**

### 🟡 P2 — Phase 3 (paywall + polish)

10. Valider que `react-native-purchases` marche sur tvOS dev client. Si
    crash `Invariant Violation: NativeEventEmitter`, basculer Plan B :
    bridge Swift minimal vers RevenueCat iOS SDK (qui supporte tvOS
    nativement). — **0.5 j validation + 2 j si fallback**
11. Écran paywall TV plein écran (custom, focusable). — **2-3 j**
12. Activity / Profil TV — masquer sections HealthKit, afficher anneaux
    calculés serveur-side (Supabase). — **2 j**
13. Adapter copies / traductions pour TV (texte plus court, focus sur
    actions Siri Remote). — **1 j**

### 🟢 P3 — Phase 4 (submission)

14. Tester sur Apple TV physique avec sandbox Apple ID — flow complet
    install → login → souscription → lecture séance → fin. — **1 j**
15. Capturer screenshots App Store Connect tvOS (1920×1080 ou 3840×2160,
    5 max) + hero video 30 s. — **1-2 j**
16. Compléter le record App Store Connect tvOS (descriptions, métadonnées,
    privacy labels — peuvent être copiées d'iOS). — **0.5 j**
17. Soumettre `eas build --profile production-tv` + `eas submit`. — **0.5 j**
18. Review Apple (typiquement 24-72 h pour tvOS). — **passif**

## ETA pour avoir une première version Apple TV testable

| Milestone | Cumul effort dev | ETA si plein temps | ETA réaliste (Yvan, 4 h/j max) |
|---|---|---|---|
| Phase 1 — écran Metro tourne sur Apple TV | 0.5-2 j | 1-3 j | 1 sem |
| Phase 2 — login + 1 séance jouable end-to-end | +6-8 j | 1.5-2 sem | 4 sem |
| Phase 3 — paywall + UX polish, soumissionable | +5-7 j | 1-1.5 sem | 3 sem |
| Phase 4 — TestFlight tvOS interne | +3-5 j | 1 sem | 1.5 sem |
| **TOTAL** | **~15-20 j** | **5-6 sem plein temps** | **~3-4 mois** au rythme cours-le-jour |

## Risques actifs

- **R1 — RevenueCat tvOS RN wrapper instable** (P2 — phase 3 si rencontré).
  Mitigation : bridge Swift ou REST fallback, ~2 j extra.
- **R2 — HealthKit gating cassé partout dans le code** (P1 — phase 2).
  Mitigation : helper `platformTV.js` déjà posé pour faciliter le gating.
  Audit complet des call sites `@kingstinct/react-native-healthkit` à
  faire avant phase 2.
- **R3 — fork react-native-tvos en retard sur RN core**. RN 0.81.5 → fork
  0.81.5-2 (en sync). Mais si on monte à Expo SDK 55 (RN 0.82+), vérifier
  le tag `0.82-stable` du fork avant.
- **R4 — Bunny CDN bande passante 4K HLS** (post-launch). À monitorer
  dans le dashboard Bunny — alerte à $X/mois (Yvan à seuiller selon son
  budget).
- **R5 — Marché Apple TV trop petit** chez les abonnées Fluidbody.
  Mitigation : pre-launch poll Instagram (voir P0 étape 3). Si signal
  faible, sunset propre via cette branche.

## Notes & decisions

- 2026-05-18 — Décision `react-native-tvos` (vs SwiftUI séparé). Voir
  `apple-tv-strategy.md` § comparatif.
- 2026-05-18 — Bundle ID partagé `com.ytissot.fluidbody` (vs `.tvos`
  séparé). Recommandé Apple, Family Sharing OK, RevenueCat unifié. Voir
  `apple-tv-setup.md` étape 2.
- 2026-05-18 — Skipper Android TV pour MVP. Marché négligeable côté
  wellness premium.
- 2026-05-18 — Pas de Continuity / Handoff iPhone↔TV pour MVP. Reportée
  à v2 si succès du MVP TV.
- 2026-05-18 — Phase 1 : choix Option B (app.config.js conditionnel) plutôt
  que d'inscrire le plugin TV directement dans app.json. Raison : zéro
  risque de fuite de config TV vers les builds iOS prod (la fonction
  early-returns sans la moindre transformation quand `EXPO_TV !== '1'`).

## À mettre à jour à chaque PR sur la feature

- État résumé en haut
- Tableau "Ce qui est fait" si nouveaux fichiers touchés
- Cases cochées dans "Ce qui reste à faire"
- Ligne datée dans "Notes & decisions" si choix non trivial
