# Roadmap — Apple TV : état d'avancement

> Mis à jour le **2026-05-18** sur la branche
> `claude/flamboyant-franklin-ee2a5f` (Phase 2 livrée).
> Mettre à jour ce fichier à chaque PR / phase. Reste source de vérité de
> "où on en est".

## État résumé

**Phase 0 — Fondations** : ✅ **Terminée**. Décision technique actée
(`react-native-tvos` + plugin `config-tv`), 4 docs roadmap rédigés, EAS
profiles TV ajoutés, helper `platformTV.js` posé.

**Phase 1 — Swap deps + plugin conditionnel + premiers écrans** : ✅
**Terminée côté code**. Reste à faire un premier prebuild + dev client TV
sur device physique (étape manuelle, voir bloc « Tests manuels » ci-dessous).

**Phase 2 — Login QR + écrans TV bout-en-bout** : ✅ **Terminée côté
code, attente runtime check sur device**. Ajouts (cf. section
"Phase 2 — Ce qui a changé" en bas) :

- DB : table `tv_pairings` + RLS strict + `purge_expired_tv_pairings()`.
- Edge function `tv-pair` (init / redeem / poll), anti-rejeu via
  `tv_secret` + nulled tokens au premier poll réussi.
- Deps : `react-native-qrcode-svg` + `expo-camera` (camera strippée
  du build TV).
- TV : `TVLoginScreen`, `ProfilTV` simplifié, `PilierPanel` layout
  horizontal, `PaywallModal` layout horizontal + CTA focusable.
- iPhone : card "Pairer une Apple TV" dans Profil, écran scanner +
  fallback saisie manuelle.
- Root nav : `IS_TV && !supaUser` → TVLoginScreen ; logué → MonCorps
  fullscreen + bouton "Mon compte" corner-pinned. Pas de tab bar TV.
- Doc protocole : `docs/roadmap/apple-tv-pairing-protocol.md`.

**Phase 3 — Polish, optimisations, submission App Store** : 🟠 **À
faire**. Voir section "Ce qui reste".

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

**Phase 3 — Polish, optimisations, submission App Store** : non
commencée. Voir P2 ci-dessous.

## Ce qui est fait sur cette branche

| Fichier | Type | Impact prod |
|---|---|---|
| `docs/roadmap/apple-tv-strategy.md` | nouveau | aucun |
| `docs/roadmap/apple-tv-business-case.md` | nouveau | aucun |
| `docs/roadmap/apple-tv-setup.md` | nouveau | aucun |
| `docs/roadmap/apple-tv-progress.md` | nouveau (ce fichier) | aucun |
| `eas.json` | +3 profils `*-tv` (extends + `EXPO_TV=1`) | aucun (additif, n'altère pas `development` / `preview` / `production`) |
| `src/utils/platformTV.js` | nouveau helper `IS_TV` + capabilities | aucun (renvoie `false` sur RN core, importé nulle part encore) |

**Modifs Phase 1 (session précédente)** :

| Fichier | Type | Impact prod iOS |
|---|---|---|
| `package.json` | swap `react-native` → `react-native-tvos@0.81.5-2`, ajout `@react-native-tvos/config-tv@^0.1.6` | nul — fork drop-in à parité avec RN 0.81.5, `npm:` alias propre, EAS `npm ci` OK |
| `package-lock.json` | régénéré par `npm install` | nul (lockfile en sync) |
| `app.config.js` | nouveau, wrap `app.json` conditionnellement | nul quand `EXPO_TV` unset → returns config inchangée |
| `src/utils/platformTV.js` | +helper `tvFocusProps()` + const `TV_FOCUS_RING` | nul (`tvFocusProps()` retourne `{}` hors TV, et `IS_TV === false` sur iPhone/iPad) |
| `src/screens/MonCorps.js` | sizing conditionné `IS_TV`, `{...tvFocusProps()}` sur 3 cards | nul — `IS_TV === false` sur iOS, donc spread `{}` |
| `src/screens/Bibliotheque.js` | grille 4 cols sur TV, focus sur cards | nul (idem) |
| `src/components/VideoPlayer.js` | `ScreenOrientation` no-op TV, BPM forcée OFF TV, X+retry focus | nul (idem) |

**Modifs Phase 2 (cette session)** :

| Fichier | Type | Impact prod iOS |
|---|---|---|
| `supabase/migrations/20260518000000_tv_pairings.sql` | nouveau, table + RLS strict + purge helper | aucun — table additive, RLS denies tout par défaut |
| `supabase/functions/tv-pair/{index.ts,deno.json}` | nouvelle edge function 3 actions (init/redeem/poll) | aucun — endpoint additif, isolé |
| `package.json` | +`react-native-qrcode-svg` (pur JS) + `expo-camera` | nul iPhone (camera plugin ajouté, NSCameraUsageDescription présent). nul TV : `expo-camera` strippé via `PLUGINS_INCOMPATIBLE_WITH_TVOS` |
| `app.json` | +entry plugin `expo-camera` avec permission string FR/EN | nul (permission demandée seulement si on ouvre PairAppleTV) |
| `app.config.js` | `expo-camera` ajouté à la liste excluded TV | nul iPhone, nul TV (filtré au prebuild) |
| `src/utils/tvPair.js` | nouveau, helper client init/poll/redeem + parsePairingPayload | nul (utilisé seulement par TVLoginScreen et PairAppleTV, deux fichiers nouveaux) |
| `src/screens/TVLoginScreen.js` | nouveau, QR + polling, focus-aware retry | nul iPhone — jamais rendered (gate `IS_TV`) |
| `src/screens/PairAppleTV.js` | nouveau, scanner QR iPhone + fallback saisie manuelle | nul tant que pas ouvert depuis Profil ; expo-camera require dynamique |
| `src/screens/ProfilTV.js` | nouveau, profil simplifié 4 cards focusables | nul iPhone (jamais importé sur iPhone, sauf via App.js gate TV) |
| `src/screens/Profil.js` | +card "Pairer une Apple TV" + Modal lazy require PairAppleTV | additif iPhone — visible seulement si supaUser != null |
| `src/screens/MonCorps.js` | PilierPanel layout horizontal sur TV, FocusableCard glow + scale, sizing étendu | nul iPhone (toutes les `IS_TV ?` falsy) |
| `src/components/PaywallModal.js` | TVPaywallView dédié en début de fichier (gate `if (IS_TV)`), iPhone render strictement inchangé | nul iPhone |
| `src/constants/data.js` | +`tv_pair_btn` + `tv_pair_sub` FR/EN | nul (strings additionnelles) |
| `App.js` | TVMainView wrapper, root nav `IS_TV && !supaUser` → TVLoginScreen, gate Tab.Navigator pour TV | nul iPhone (toutes les branches `IS_TV` sont skip) |
| `docs/roadmap/apple-tv-pairing-protocol.md` | nouveau doc protocole avec diagramme | aucun |

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

### 🟠 P1 — Phase 2 (livrée côté code, validation runtime à faire)

Phase 2 code-side complète. Les items 5-9 ci-dessous sont historiques :

5. ~~Mocker / exclure les modules incompatibles tvOS~~ — fait via
   `app.config.js` + `PLUGINS_INCOMPATIBLE_WITH_TVOS`.
6. ~~Écran login TV (QR code + polling)~~ — fait. Voir
   `apple-tv-pairing-protocol.md`.
7. ~~Bibliothèque TV~~ — fait phase 1.
8. ~~VideoPlayer tvOS~~ — fait phase 1 (X / retry focus, BPM off,
   orientation no-op). Affiner contrôles Siri Remote (seek swipe,
   long-press menu, etc.) à faire phase 3 si retour utilisateur.
9. ~~Home screen TV (MonCorps)~~ — phase 1 (focus pilier cards). Le
   layout body-map d'origine est conservé pour cohérence visuelle.

### 🟡 P2 — Phase 3 (paywall full RC + polish + submit)

Phase 3 = polish runtime + validation Apple TV physique + submit
TestFlight.

10. **Validation runtime** sur Apple TV physique ou simulator :
    `EXPO_TV=1 npx expo prebuild --clean && cd ios && pod install &&
    open *.xcworkspace`, sélectionner cible tvOS, build & run. — **0.5 j**
11. Valider que `react-native-purchases` se charge sans crash sur tvOS
    dev client. Si crash `NativeEventEmitter`, basculer Plan B : REST
    fallback (`react-native-purchases` REST mode via `Purchases.configure({useStoreKit2IfAvailable})`).
    À ce stade le paywall TV affiche les prix hard-codés en attendant.
    — **0.5 j validation + 2 j si fallback**
12. Tests pairing end-to-end :
    - Init côté TV → QR affiché lisible 1.20 m
    - Scan iPhone → redeem OK, retour TV en < 5 s
    - Manuel : tape le code à la main → fonctionne
    - Expiry : laisse 6 min sans rien faire → bouton Retry focusable
    - Re-login depuis ProfilTV.signOut → re-affiche TVLoginScreen
    — **0.5 j**
13. Adapter copies / traductions pour TV (texte plus court, focus sur
    actions Siri Remote). — **0.5-1 j**
14. Optimisations runtime tvOS : profiler le bundle TV (taille,
    modules chargés), tester en ralenti CPU, vérifier que les
    animations Bulle/FloatingMedusas ne saturent pas le GPU sur Apple
    TV HD (modèle bas de gamme à 2 GB RAM). — **0.5-1 j**

### 🟢 P4 — Submission

15. Tester sur Apple TV physique avec sandbox Apple ID — flow complet
    install → QR pair → lecture séance → fin. — **1 j**
16. Capturer screenshots App Store Connect tvOS (1920×1080 ou 3840×2160,
    5 max) + hero video 30 s. — **1-2 j**
17. Compléter le record App Store Connect tvOS (descriptions, métadonnées,
    privacy labels — copier d'iOS, ajouter mention "ne collecte rien sur
    Apple TV"). — **0.5 j**
18. Soumettre `eas build --profile production-tv` + `eas submit`. — **0.5 j**
19. Review Apple (typiquement 24-72 h pour tvOS). — **passif**

## ETA pour avoir une première version Apple TV testable

| Milestone | Cumul effort dev | Statut |
|---|---|---|
| Phase 1 — écran Metro tourne sur Apple TV | 0.5-2 j | ✅ code-side, runtime à valider |
| Phase 2 — login + 1 séance jouable end-to-end | +6-8 j | ✅ **code-side livré cette session** |
| Phase 3 — paywall full RC + polish, soumissionable | +5-7 j | 🟠 à faire |
| Phase 4 — TestFlight tvOS interne | +3-5 j | 🟢 à faire |
| **TOTAL restant** | **~8-12 j** | runtime + Plan B RC + submit |

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
- 2026-05-18 — Phase 2 : choix QR pairing (vs magic link e-mail).
  Raison : la Siri Remote rend la saisie e-mail très pénible. Le pairing
  délègue tout au flow iPhone déjà familier. Fallback saisie manuelle
  12 chars conservé pour les cas où le scanner caméra ne marche pas.
- 2026-05-18 — Phase 2 : choix tokens éphémères (consumed_at + nulled)
  plutôt que JWT signé envoyé par la TV. Raison : si quelqu'un capture
  le poll response (TLS compromis hypothétique), il a la session
  complète ; avec consumption une seule fois, un replay attack échoue.
- 2026-05-18 — Phase 2 : choix `expo-camera` strippé du build TV (pas
  juste gated en JS). Raison : éviter de linker un binaire natif iOS
  inutile sur tvOS, et plus propre pour les audits Apple.

## Tests manuels Phase 2 (à faire après prebuild TV)

Côté iPhone (build iOS standard, non-régression) :

1. `unset EXPO_TV && npx expo start --clear` → app boote normalement.
2. Ouvrir Profil → vérifier la nouvelle card "Pairer une Apple TV"
   présente sous "Mon compte" (seulement si logué). Pas de crash.
3. Tap dessus → PairAppleTV s'ouvre. Si caméra autorisée : viseur
   visible. Sinon : message "Caméra requise" + lien saisie manuelle.
4. Mode saisie manuelle : tape un code random → "Code non reconnu".
   Tape "ABCD2EFG3JKL" (12 chars) → tente le redeem → erreur
   "Code introuvable" (normal, pas de nonce côté DB).

Côté Apple TV (prebuild + dev client) :

5. Premier launch → `TVLoginScreen` avec QR + code 12 chars sous le QR.
6. Sur l'iPhone Profil → Pairer → scanner le QR (ou taper le code).
   Vérifier qu'en < 5 s la TV bascule sur `MonCorps`.
7. Sur la TV : Siri Remote flèches → focus se déplace sur les pilier
   cards avec glow border + scale. Tap → ouvre `PilierPanel` en layout
   horizontal (hero gauche / séances droite).
8. Tap sur une séance → `VideoPlayer` plein écran. Bouton Menu de la
   Siri Remote → ferme la vidéo (RN tvOS natif `onRequestClose`).
9. Retour MonCorps. Focus sur le bouton "👤 Mon compte" en haut à
   droite → tap → `ProfilTV` avec 4 cards focusables. Tap déconnexion →
   Alert → confirme → retour `TVLoginScreen` (le `setSession`
   `signOut` casse l'auth → root nav réagit).
10. Cas d'erreur : laisse le QR affiché > 6 min sans rien faire → la
    TV affiche "Code expiré" + bouton Réessayer focusable.

Edge function (depuis n'importe où) :

```bash
# Smoke test — init
curl -X POST \
  -H "content-type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  https://$SUPABASE_REF.supabase.co/functions/v1/tv-pair \
  -d '{"action":"init"}'
# → { ok:true, nonce:"...", tv_secret:"...", expires_at:"..." }

# Poll avec mauvais tv_secret → not-found (volontairement opaque)
curl -X POST ... -d '{"action":"poll","nonce":"<NONCE>","tv_secret":"WRONG"}'
# → 404 { error:"not-found" }
```

## À mettre à jour à chaque PR sur la feature

- État résumé en haut
- Tableau "Ce qui est fait" si nouveaux fichiers touchés
- Cases cochées dans "Ce qui reste à faire"
- Ligne datée dans "Notes & decisions" si choix non trivial
