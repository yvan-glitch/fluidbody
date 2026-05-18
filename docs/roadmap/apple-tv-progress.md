# Roadmap — Apple TV : état d'avancement

> Mis à jour le **2026-05-18** sur la branche `feat/apple-tv-foundation`.
> Mettre à jour ce fichier à chaque PR / phase. Reste source de vérité de
> "où on en est".

## État résumé

**Phase 0 — Fondations** : ✅ **Terminée** (cette branche).
Décision technique actée (`react-native-tvos` + plugin `config-tv`), 4 docs
roadmap rédigés, EAS profiles TV ajoutés, helper `platformTV.js` posé. Le
code reste 100 % compatible iOS — aucune dépendance changée, aucun
prebuild lancé.

**Phase 1 — Premier dev client tvOS qui démarre** : ⏳ **En attente**.
Bloqué sur 4 actions manuelles de Yvan (voir `apple-tv-setup.md`,
étapes 1-9). ETA si Yvan a 1 jour bloqué : 3-5 j cumulés.

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

**Pas touché** (volontairement, pour ne pas casser le build iOS #57+) :

- `package.json` / `package-lock.json` — le swap `react-native` →
  `react-native-tvos` et l'ajout de `@react-native-tvos/config-tv` doivent
  être faits par Yvan localement (cf. `apple-tv-setup.md` étape 6),
  parce que EAS Build utilise `npm ci` et exige que les deux fichiers
  soient en sync. Faire ça dans un worktree autonome sans `npm install`
  qui passe → risque de produire un lockfile bancal.
- `app.json` — l'ajout du plugin `@react-native-tvos/config-tv` doit se
  faire en même temps que l'install npm de ce plugin, sinon `expo config`
  / `expo prebuild` échouent. Yvan le fait localement.
- `App.js` et écrans — aucun gating `Platform.isTV` ajouté pour l'instant.
  Inutile tant qu'il n'y a pas de build TV.

## Ce qui reste à faire — par ordre de priorité

### 🔴 P0 — Bloque tout le reste (Yvan, à faire en premier)

1. Lire `apple-tv-strategy.md` (décision + matrice modules) — **30 min**
2. Lire `apple-tv-setup.md` (étapes manuelles) — **15 min**
3. Pre-launch poll Instagram "vous avez une Apple TV ?" — voir
   `apple-tv-business-case.md`. Sans signal marché, ne pas investir
   les 6 sem. — **1 j de patience**
4. **Si GO** : exécuter étapes 1-9 du setup, jusqu'à avoir l'écran Metro
   packager qui tourne sur l'Apple TV physique ou simulator — **0.5-2 j**

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

## À mettre à jour à chaque PR sur la feature

- État résumé en haut
- Tableau "Ce qui est fait" si nouveaux fichiers touchés
- Cases cochées dans "Ce qui reste à faire"
- Ligne datée dans "Notes & decisions" si choix non trivial
