# Audit pré-submission App Store — 14 mai 2026

> Audit en lecture seule. Aucun fichier source modifié. Travail effectué après les commits `497dde1` (p9 Ménopause), `3de7679` (polish Resume + filter fix), `e198bd4` (docs roadmap).

---

## Résumé exécutif

- **État global** : ❌ **PAS prêt à soumettre AS-IS**
- **Nombre de bloqueurs** : **1** (crash immédiat sur écran d'accueil)
- **Important** : 6 findings (rejet Apple potentiel + UX/i18n)
- **Nice-to-have** : 10 findings (debt non bloquante)
- **Temps estimé pour "submit-ready"** : ~30-45 min pour le bloqueur + 2 importants critiques (PrivacyManifest, i18n parity)
- **Verdict "ce soir possible ?"** : **OUI** si tu corriges le bloqueur App.js:610 (2 min) + ajustes le PrivacyManifest (5 min) avant `eas build`. Sans ça : crash garanti.

---

## 🔴 Bloqueurs (à fixer absolument)

### 1. `App.js:610` — Crash identique à celui fixé dans Resume.js, NON corrigé

- **Fichier/ligne** : `App.js:610`
- **Code** :
  ```js
  const count = Math.min(done[p.key].filter(v => v === true || v === 'true').length, 5);
  ```
- **Description** : Avec l'ajout de p9 dans `PILIERS_BASE` (commit 497dde1), `sortedPiliers` itère sur les 9 piliers, mais `done['p9']` est `undefined` pour tout utilisateur n'ayant aucune séance Ménopause (= 100% des users aujourd'hui). Résultat : `undefined.filter(...)` → crash `TypeError`. **Ce code se trouve dans le rendu de l'écran "AU TOTAL > Par pilier"** — c'est-à-dire le premier écran après login. Crash immédiat sur cold start.
- **Effort estimé** : 2 minutes
- **Suggestion de fix** : ajouter `|| []` comme déjà fait dans Resume.js ligne 654. C'est rigoureusement le même bug, copy-pasté il y a longtemps.

---

## 🟠 Important (Apple peut rejeter / crash en prod)

### 2. `ios/FluidBody/PrivacyInfo.xcprivacy` — `NSPrivacyCollectedDataTypes` vide alors que l'app collecte des données

- **Fichier** : `ios/FluidBody/PrivacyInfo.xcprivacy` ligne ~42
- **État actuel** : `<key>NSPrivacyCollectedDataTypes</key><array/>` (vide)
- **Description** : L'app collecte au minimum :
  - Email (Supabase Auth)
  - HealthKit (heart rate, workouts) — déclarés ailleurs mais pas dans ce manifest
  - Achats (RevenueCat)
  - User ID (Sentry, même avec PII stripping)
  - Profil prénom (Supabase profiles table)
  
  Apple compare cette déclaration avec celle d'App Store Connect (privacy questionnaire). Mismatch = rejet ou demande de clarification.
- **Effort estimé** : 15-20 min (ajouter les `NSPrivacyCollectedDataType` correspondants : EmailAddress, HealthAndFitness, PurchaseHistory, UserID, OtherUserContent)
- **Suggestion** : compléter le tableau avec les data types collectées + leurs purposes (AppFunctionality / Analytics).

### 3. T.fr / T.en — 12 clés manquantes en EN

- **Fichier** : `src/constants/data.js`
- **Clés présentes en FR, absentes en EN** :
  - `prog_core`, `prog_core_sub`
  - `prog_dos`, `prog_dos_sub`
  - `prog_posttravail`, `prog_posttravail_sub`
  - `prog_reveil`, `prog_reveil_sub`
  - `prog_souplesse`, `prog_souplesse_sub`
  - `prog_thematiques_sub`, `prog_thematiques_title`
- **Description** : Utilisateurs anglophones verront `undefined` ou un fallback vide quand ces clés sont accédées via `tr.prog_dos` etc.
- **Effort estimé** : 10 min (12 traductions courtes)
- **Suggestion** : ajouter les pendants EN sous la même structure dans T.en.

### 4. `VideoPlayer.js:305` — `fetch()` sans timeout

- **Fichier/ligne** : `src/components/VideoPlayer.js:305`
- **Code** : `return fetch(url).then(function(r) { if (r.ok) return r.text(); throw new Error('no vtt'); });`
- **Description** : Récupération des sous-titres VTT sans timeout. Si Bunny CDN met >30s à répondre (ou ne répond pas), la promesse reste pendante. Pas un crash mais peut bloquer l'UX vidéo.
- **Effort estimé** : 3 min
- **Suggestion** : wrapper avec `withTimeout(fetch(url), 5000, 'vtt-fetch')` (helper déjà existant via le pattern du commit 6734bec splash).

### 5. CLAUDE.md déclare 4 langues mais seulement FR/EN existent

- **Fichier** : `CLAUDE.md` ligne 6 + `src/constants/data.js`
- **Description** : Doc dit "4 languages (fr, en, es, it)" mais T n'a que `fr` et `en`. Tous les `T[lang] || T.fr` fallback ES/IT vers FR. Non-bloquant pour la submission (l'app fonctionne, juste en FR pour ces utilisateurs), mais doc trompeuse — si tu as déclaré le support ES/IT dans App Store Connect Métadonnées, Apple peut rejeter pour "fonctionnalité non livrée".
- **Effort estimé** : 5 min
- **Suggestion** : soit corriger CLAUDE.md + métadonnées Store en "FR/EN only", soit ajouter les blocs T.es et T.it (~2-3h de traduction).

### 6. `src/screens/Bibliotheque.js:422` — anti-pattern comparaison de string traduite

- **Fichier/ligne** : `src/screens/Bibliotheque.js:422`
- **Code** : `{tr.tab_piliers === 'The 6 pillars' ? 'Activity Types' : "Types d'activités"}`
- **Description** : Détecte la langue en comparant la valeur d'une string traduite. Si quelqu'un modifie `tab_piliers` en EN (ex. "The 9 pillars" — d'ailleurs cohérent avec l'ajout p9), le test casse silencieusement et l'utilisateur EN voit "Types d'activités".
- **Effort estimé** : 1 min
- **Suggestion** : comparer `lang === 'en'` directement (variable disponible dans le scope).

### 7. `tab_piliers: 'Les 6 piliers'` (data.js:110) — texte hardcodé inexact

- **Fichier/ligne** : `src/constants/data.js:110` (FR) + `:538` (EN)
- **Description** : Dit "Les 6 piliers" / "The 6 pillars" alors qu'il y en a maintenant 9 (p1-p9). Texte trompeur visible dans le tab Biblio.
- **Effort estimé** : 1 min
- **Suggestion** : remplacer par "Les piliers" / "The pillars" (sans nombre) ou adapter dynamiquement.

---

## 🟡 Nice-to-have (post-launch OK)

### 8. `App.js` fait 2784 lignes

- Refactor candidate prioritaire : extraire `AuthScreen`, `OnboardingScreen`, `MainApp`, `App` racine dans `src/screens/` (déjà existant). Pas bloquant pour la submission, mais accumule la dette.

### 9. `CoachWelcomeOverlay.js` est un placeholder

- **Fichier** : `src/components/CoachWelcomeOverlay.js`
- **Description** : Toujours actif dans le onboarding (App.js:1822). Le commentaire en tête dit "The video asset (Sabrina, 35s vertical) doesn't exist yet — see `docs/assets/coach-welcome.md` for the tournage specs. Until then this component renders a placeholder". Donc fonctionnel mais en attente du vrai contenu vidéo. Non-bloquant.

### 10. 3 fichiers untracked dans `assets/`

- `assets/fluidbody-wallpaper-15.jpg`, `fluidbody-wallpaper-16-17pro.jpg`, `fluidbody-wallpaper-17promax.jpg`
- Aucune référence dans le code. Soit à supprimer, soit à commiter avec leur usage.

### 11. WIP stash obsolète

- `stash@{0}: WIP: hourglass silhouette Resume.js` — la silhouette hourglass est maintenant sur main + nettement améliorée (commit 3de7679 : bras, capteurs, de-turquoise). Peut être droppé.

### 12. Dossiers untracked locaux

- `.claude/` et `supabase/.temp/` — à ajouter dans `.gitignore` ou nettoyer.

### 13. `DownloadManager.js` — XOR encryption "casual-tamper deterrent, not DRM"

- Le commentaire dans le fichier le dit explicitement. Pour des séances gratuites c'est OK ; pour le contenu payant Apple ne va pas vérifier mais c'est techniquement faible. Pas un bloqueur, mais à upgrader plus tard (`expo-secure-store` + clé dérivée par user).

### 14. Accessibility labels FR-only

- `src/components/VideoPlayer.js:922` : "Barre de progression de la vidéo"
- `src/components/PaywallModal.js:323` : "Fermer le paywall"
- Utilisateurs EN avec VoiceOver entendent du français. Pas un rejet Apple mais polish accessibilité manqué.

### 15. 23 `console.*` au total dans src/

- Tous correctement gated derrière `__DEV__` sauf 3 dans `src/utils/safeNativeCall.js` (lignes 49, 67, 80) — intentionnels (flag `DIAGNOSTIC_NATIVE_CALLS=true` pour debugger les crashs natifs en TestFlight). À flipper à `false` avant App Store si tu veux des logs propres en prod.

### 16. Aucun TODO/FIXME/HACK dans le code

- Surprenamment propre. Soit vraiment clean, soit conventions de commentaires différentes — j'ai grep agressivement, pas vu de marqueur.

### 17. Apple Watch hero image 631KB

- `assets/apple-watch-hero.png` — le seul asset > 500KB. Compression PNG → 200-300KB possible. Non critique.

---

## 🟢 OK (vérifié et conforme)

### Sécurité
- ✅ **Aucun `.env` jamais commité** dans l'historique git (seul `.env.example` apparaît)
- ✅ `.gitignore` correct : `.env`, `node_modules/`, `/ios`, `/android`, `*.p8`, `*.p12`, `*.key`, `*.mobileprovision`, `.DS_Store`
- ✅ Toutes les `EXPO_PUBLIC_*` sont des clés publiables :
  - `EXPO_PUBLIC_SENTRY_DSN` (DSN publique)
  - `EXPO_PUBLIC_RC_API_KEY_IOS` (RevenueCat public API key)
  - `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon = OK)
- ✅ Aucune `SUPABASE_SERVICE_ROLE_KEY` ou `ANTHROPIC_API_KEY` dans le code frontend
- ✅ Bunny CDN URLs signées server-side via edge function (commit 8de4608)

### Stabilité
- ✅ `ErrorBoundary` enveloppe `App` racine (App.js:2745) avec hook Sentry
- ✅ `safeNativeCall` wrapper pour tous les appels TurboModule (Haptics, Notifications, RC, etc.)
- ✅ Splash protection 3 couches (timeout getSession + fetchProfile + 8s safety net, commit 6734bec)
- ✅ Resume.js silhouette + filter guard (commit 3de7679)

### Configuration App Store
- ✅ `version: 1.0.0`
- ✅ `bundleIdentifier: com.ytissot.fluidbody` (iOS + Android cohérents)
- ✅ `usesAppleSignIn: true`
- ✅ `supportsTablet: true`
- ✅ `ITSAppUsesNonExemptEncryption: false` (export compliance)
- ✅ ATS bien configurée (b-cdn.net + supabase.co exceptions)
- ✅ `runtimeVersion.policy: "appVersion"` (OTA scoping safe)
- ✅ `eas.json` : `autoIncrement: true` (buildNumber géré automatiquement)
- ✅ `ascAppId: "6761364962"` + `appleTeamId: "R5V88AS9MX"` configurés
- ✅ Plugins propres : `expo-localization`, `expo-apple-authentication`, `@kingstinct/react-native-healthkit`, `expo-notifications`, `@react-native-community/datetimepicker`, `@sentry/react-native`
- ✅ `newArchEnabled: true` cohérent avec Nitro Modules (HealthKit v14)

### Permissions iOS
- ✅ `NSHealthShareUsageDescription` bilingue FR/EN explicite (raison Apple Watch + Pilates)
- ✅ `NSHealthUpdateUsageDescription` bilingue FR/EN explicite
- ✅ HealthKit entitlement déclaré + background delivery
- ✅ Pas de permission excessive (pas de Camera, Photos, Mic, Location, Calendar — non demandées car non utilisées)

### Privacy Manifest
- ✅ `PrivacyInfo.xcprivacy` présent dans `ios/FluidBody/`
- ✅ Required Reason APIs déclarées avec codes :
  - `FileTimestamp` (C617.1, 0A2A.1, 3B52.1)
  - `UserDefaults` (CA92.1)
  - `SystemBootTime` (35F9.1)
  - `DiskSpace` (E174.1, 85F4.1)
- ✅ `NSPrivacyTracking: false` (pas de tracking)
- ⚠️ `NSPrivacyCollectedDataTypes: []` — **incohérent**, voir finding #2

### Privacy Policy
- ✅ URL `https://yvan-glitch.github.io/fluidbody-privacy/` retourne 200 OK
- ✅ Contenu bilingue FR/EN, daté du 10 mai 2026

### Dépendances
- ✅ React Native 0.81.5 / Expo SDK 54.0.34 (current stable)
- ✅ Aucune dépendance lourde (pas de lodash, moment, axios)
- ✅ Nitro Modules (HealthKit v14) — évite le crash legacy ObjC TurboModule iOS 26.5

### Assets
- ✅ `assets/` totalise 3.4 MB (raisonnable)
- ✅ Un seul fichier > 500KB (`apple-watch-hero.png`, 631KB)
- ✅ Icônes (`icon.png`, `adaptive-icon.png`, `favicon.png`, `splash-icon.png`) présentes

### Repo
- ✅ 2 commits ahead of origin, prêts à push
- ✅ Historique git linéaire propre (10 derniers commits cohérents)
- ✅ Pas de merge commits orphelins récents

---

## Recommandations pour la suite (priorisées)

1. **🔴 IMMÉDIAT — Fixer `App.js:610`** (2 min). Sans ça : crash garanti dès le premier login après push de p9. Même fix que Resume.js : `(done[p.key] || []).filter(...)`.

2. **🟠 AVANT BUILD — Compléter `PrivacyInfo.xcprivacy` NSPrivacyCollectedDataTypes** (15 min). Aligner avec ce qui est déclaré dans App Store Connect côté questionnaire.

3. **🟠 AVANT PUBLIC LAUNCH — Ajouter les 12 clés manquantes dans T.en** (10 min). Sinon utilisateurs EN voient `undefined` sur les écrans Programmes.

4. **🟠 MIDDLE TERM — Ajouter timeout sur le `fetch()` VTT** + corriger `tab_piliers` "Les 6 piliers" → 9, et l'anti-pattern Bibliotheque.js:422.

5. **🟡 POST-LAUNCH — Refactor App.js** (split en modules) + drop stash WIP + nettoyer wallpapers untracked.

---

## Vérifications additionnelles recommandées AVANT submission

- [ ] Tester un build TestFlight (`eas build --profile production --platform ios`) et faire un cold-start sur un device physique avec compte vierge → vérifier que le crash App.js:610 ne survient pas après le fix
- [ ] Aligner App Store Connect Privacy Questionnaire avec le PrivacyInfo.xcprivacy corrigé
- [ ] Vérifier les screenshots App Store (5.5" et 6.7" iPhone, 12.9" iPad si supportsTablet=true)
- [ ] Préparer description App Store FR + EN (les 12 clés manquantes en EN suggèrent que la description anglaise n'est pas non plus prête)
- [ ] Confirmer que les achats In-App (RevenueCat) sont configurés en sandbox + production sur App Store Connect

---

**Audit produit en lecture seule, sans modification du code. Findings cités avec fichier:ligne pour permettre triage immédiat.**
