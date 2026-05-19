# Audit pré-submission App Store — 19 mai 2026

> Audit complet en vue d'une soumission première à l'App Store. Mené sur
> la branche `audit/pre-app-store-submission`, fork de `main` après le
> build #61 (qui inclut p9 Ménopause, programmes algorithmiques,
> statistiques avancées, biblio search/filter, Apple Calendar).
>
> Mission : déterminer la roadmap claire pour soumettre dans 1–2
> semaines sans rejet.

---

## Résumé exécutif

| Indicateur | Valeur |
|---|---|
| Verdict | ⚠️ **PAS prêt aujourd'hui** — 2 bloqueurs Apple certains, gérables en 2–4 jours |
| Bloqueurs Apple (rejet quasi-garanti) | **2** (account deletion, terms of service) |
| Issues à régler avant submission | **6** (compliance + correctness) |
| Issues secondaires | **12** (UX / debt / nice-to-have) |
| Auto-fix appliqués sur la branche | **5 commits** (~80 LOC, voir plus bas) |
| expo-doctor | ✅ 17/17 |

**Estimation effort restant** : **3–5 jours-homme**
- 2 j pour l'account deletion (UI + Supabase RPC + cascade cleanup + RC offboarding)
- 0.5 j pour les Terms of Service + hosting
- 1 j pour aligner ASC questionnaire / privacy + i18n cleanup
- 1 j pour les screenshots App Store + métadonnées + dernière passe TestFlight

**Verdict "soumettre dans 1 semaine ?"** : **oui, faisable** si les
deux bloqueurs sont attaqués lundi.

---

## 🚫 Bloqueurs Apple (rejet quasi-certain)

### B1. Suppression de compte in-app — ABSENTE
- **Guideline** : 5.1.1(v) — Apple exige depuis juin 2022 que les apps
  avec création de compte permettent la suppression complète depuis
  l'app.
- **État actuel** : grep dans tout le code (`src/screens/Profil.js`
  inclus) → **aucune** UI ni route ni RPC pour supprimer le compte.
  Seuls existent : "Réinitialiser toutes les données" (local, et
  conditionné `!supaUser`), et "Se déconnecter".
- **Risque** : 100 % de rejet à la première soumission.
- **Plan** :
  1. Ajouter un bouton "Supprimer mon compte" dans `Profil.js` (visible
     uniquement quand `supaUser`), avec Alert de confirmation
     explicite mentionnant *définitive*.
  2. Edge function Supabase `delete-user` (service-role) qui :
     - Supprime les rows liées dans `profiles`, `user_programs`,
       `user_favorites`, `referrals`, `video_assets` (si refs perso).
     - Appelle `supabase.auth.admin.deleteUser(uid)`.
     - Optionnel : `Purchases.logOut()` côté RC pour anonymiser
       l'utilisateur RC (le compte App Store gère le refund séparément).
  3. AsyncStorage : nuker toutes les clés `fluid_*` après succès.
  4. Rediriger vers l'écran d'onboarding.
- **Effort** : ~1.5 jour.

### B2. Terms of Service (EULA) — Aucun lien
- **Guideline** : 3.1.2(a) — pour les apps avec subscription
  auto-renewing, le paywall doit afficher *Privacy Policy* **et** *Terms
  of Use*. EULA standard Apple suffit si vous ne définissez pas le
  vôtre, mais il faut **un lien dans le paywall**.
- **État actuel** : `src/components/PaywallModal.js:498-504` n'affiche
  qu'un lien Privacy Policy. `App.js:1146` ("En continuant tu acceptes
  nos Conditions d'utilisation et notre Politique de confidentialité")
  est du texte plat, *sans URL pour les CGU*.
- **Risque** : rejet certain au premier round.
- **Plan** :
  1. Publier des CGU sur `yvan-glitch.github.io/fluidbody-terms/` (ou
     même domaine que la privacy policy). Standard ASLA-EULA suffit
     pour démarrer.
  2. Ajouter `tr.paywall_terms_link` (FR + EN) et un `GlassPressable`
     sur le paywall qui ouvre l'URL.
  3. Idem au-dessus du `auto-signup` form (App.js:1146) : transformer
     "Conditions d'utilisation" en `<Text onPress>` lien cliquable.
- **Effort** : ~3–4 h (CGU + integration).

---

## 🟠 Important (à régler avant la submission)

### I1. ES / IT — ni implémentés ni revendiqués proprement
- `CLAUDE.md` revendique 4 langues (fr/en/es/it). `T.fr` (526 keys) et
  `T.en` (526 keys) sont complets. **`T.es` et `T.it` n'existent
  pas** — tout fallback vers `T.fr`.
- Si vous avez déclaré `es` / `it` dans les *App Store Localizations*,
  Apple peut rejeter pour "feature claimed not delivered".
- **Plan** : soit ajouter `T.es` + `T.it` (gros effort, ~2 jours de
  traduction par un humain), soit retirer es/it de la liste des langues
  dans App Store Connect ET mettre à jour `CLAUDE.md` à "fr, en".
  Recommandation : **lancer fr/en seulement**, ajouter es/it post-MVP.
- **Effort** : 15 min pour aligner (ou 2 j pour traduire).

### I2. Disclaimer "pas un avis médical" sur le pilier Ménopause (p9)
- `src/constants/pilierContent.js` contient des phrases comme
  "Prévention contre l'ostéoporose" sur le pilier Ménopause.
  Borderline pour la guideline 1.4.1 (medical claims).
- **Plan** : ajouter un disclaimer dans `PilierEducation.js` quand
  `pilier.key === 'p9'` : "Ce contenu est éducatif et non médical. Ne
  remplace pas un avis de votre médecin." + équivalent EN.
- **Effort** : 30 min.

### I3. Privacy questionnaire ASC ↔ app.json — Name non déclaré
- `app.json > privacyManifests.NSPrivacyCollectedDataTypes` déclare
  Email + UserID + Health + PurchaseHistory + CrashData +
  PerformanceData.
- **Le prénom (collecté via onboarding, écrit dans `profiles.prenom`)
  n'est pas déclaré** comme `NSPrivacyCollectedDataTypeName`.
- Apple compare les déclarations avec le questionnaire — différence =
  retour reviewer.
- **Plan** : ajouter une entrée `NSPrivacyCollectedDataTypeName` (Linked
  to user, App Functionality, Not Tracking) dans `app.json`.
- **Effort** : 5 min. Voir `docs/privacy/data-flow.md` pour le détail.

### I4. Locale dates / nombres incohérente
- `src/screens/Activity.js:62` — `toLocaleString(undefined, ...)`
  utilise la locale du device, pas la lang choisie dans l'app.
- `src/screens/Activity.js:629` — `toLocaleString()` sans argument.
- (`src/components/PaywallModal.js:76` — déjà corrigé sur la branche
  via auto-fix.)
- **Plan** : passer la langue de l'app (FR / EN) plutôt que `undefined`
  / `'fr-FR'` en dur.
- **Effort** : 15 min.

### I5. Icône d'app 416 KB — vérifier le pipeline Apple
- `assets/icon.png` fait 425 KB en source. Apple recompresse, mais une
  source moins lourde aide la review automatique. Optionnel.
- **Plan** : passer `icon.png` à travers ImageOptim (sans perte) →
  attendu ~150 KB.
- **Effort** : 5 min.

### I6. Apple Watch hero — 632 KB
- `assets/apple-watch-hero.png` (HealthKitConnect screen). PNG en
  Display P3, déjà reéncoded sRGB pour éviter le crash RCTImageLoader
  (CLAUDE.md). Mais la taille fichier reste lourde.
- **Plan** : recompresser (PNG → 200–250 KB attendu). Pas un bloqueur.
- **Effort** : 5 min.

---

## 🟡 Findings secondaires (post-launch OK ou tracking debt)

### N1. ~170 boutons sans `accessibilityLabel`
Audit a11y systématique (`src/screens/MonCorps.js`, `Bibliotheque.js`,
`Profil.js`, `Statistics.js`, `Activity.js`, `MyPrograms.js`,
`PilierEducation.js`). VoiceOver-hostile.
- Pas un bloqueur Apple mais une mauvaise UX pour utilisateurs
  malvoyants. À budgéter post-launch.

### N2. Police hardcodée (707 occurrences `fontSize:` numérique)
- Pas de `allowFontScaling` global, pas de `PixelRatio.getFontScale()`.
  Les utilisateurs avec "Texte plus grand" dans Réglages iOS ne
  bénéficient pas du scale.
- Plan idéal : Theme provider exporte un `scaledFontSize()` helper.
- Effort réel : ~1 jour pour passer toute la base.

### N3. TODOs résiduels (3 occurrences)
- `App.js:1471` — TODO webhook RC côté edge function (post-MVP, OK).
- `src/constants/pilierContent.js:9` — placeholder Sabrina quote (OK).
- `src/components/PaywallModal.js:365` — TODO promotional offer
  référral (post-MVP).
Aucun n'est bloquant — laisser.

### N4. Wallpaper assets non référencés
- `assets/wallpaper_iphone.{png,svg}` — 133 KB, jamais utilisés en code.
- `assets/fluidbody-wallpaper-15.jpg`, `fluidbody-wallpaper-16-17pro.jpg`,
  `fluidbody-wallpaper-17promax.jpg` — 168/192/183 KB, jamais utilisés
  en code.
- **Question à Yvan** : ce sont des marketing assets pour l'App Store
  (screenshots / wallpapers) ou de la dette ? Si dette → supprimer
  (j'ai laissé exprès pour décision).

### N5. 36 worktrees orphelins
- `/Users/xvan06/fluidbody/.claude/worktrees/` contient 36 répertoires
  Claude. Beaucoup sont sur des branches déjà mergées (`feat/apple-calendar`,
  `feat/programs-algorithmic`, `feat/advanced-stats`,
  `feat/biblio-search-filter`, `feat/pilier-comprendre` — toutes
  dans `git log main` récent).
- Nettoyer avec `git worktree prune` puis `rm -rf` sur les répertoires
  sans branche active.
- Pas urgent.

### N6. VideoPlayer setTimeout sans cleanup explicite
- `src/components/VideoPlayer.js:469` — `setTimeout(() => setResumeHint(null), 2800)`.
  Pas de variable de référence ; l'unmount cancel le composant donc le
  setState échouera silencieusement, pas un vrai leak. À nettoyer
  proprement post-launch.

### N7. CoachWelcomeOverlay encore placeholder
- `src/components/CoachWelcomeOverlay.js` attend toujours la vidéo
  Sabrina (35s vertical). En attendant, render un placeholder.
  Non-bloquant, le composant est tagué dans le fichier.

### N8. `DownloadManager.js` — XOR encryption
- Encryption "casual-tamper deterrent, not DRM" (le fichier le dit
  lui-même). Pour le contenu payant, à upgrader vers
  `expo-secure-store` + clé dérivée par user post-launch. Apple ne
  vérifie pas l'encryption en review.

### N9. Hardcoded font sizes — listé N2 (doublon, à fusionner).

### N10. SignIn — error messages techniques en FR uniquement
- `src/screens/SignIn.js:80, 81, 88, 111, 113` : alerts comme
  `'Module expo-apple-authentication non chargé'` ou `'Erreur Supabase'`.
  Visibles uniquement en cas de panne — risque faible mais cosmétique.

### N11. Hardcoded UI strings dans modals coach mode (admin only)
- `src/screens/Profil.js:1326-1363` — les outils admin "COACH MODE"
  sont en FR pur ("Outils admin", "Séances cochées", "Reset jalons…").
  N'est exposé qu'aux comptes admin (5 taps sur prénom) donc OK.

### N12. Bibliotheque.js — partiel ES/PT contenu dans articles ?
- `src/screens/Bibliotheque.js:102-132` contient des extraits en ES et
  PT pour certaines fiches. Vérifier si ces langues sont activées dans
  T (non) — sinon ce code est dead.

---

## ✅ Fixes auto-appliqués sur cette branche

5 commits, vérifiés `node --check` + `npx expo-doctor` (17/17).

### Commit `6aa8a49` — `fix(prod)`
- **`src/utils.js`** : retiré `TEMP_UNLOCKED = new Set(['p2_0','p2_1'])`
  qui déverrouillait gratuitement les séances p2_0 et p2_1. **Fuite de
  contenu payant** — réviseur Apple aurait pu voir des séances
  premium accessibles sans abonnement.
- **`src/utils/safeNativeCall.js`** : `DIAGNOSTIC_NATIVE_CALLS = false`.
  Le crash legacy était fixé dans build #61 — les logs `[FLDB-DIAG]`
  n'ont plus de raison d'être en prod.

### Commit `95314d6` — `fix(animations)`
- `AnimatedFaceIcon` (App.js:520) : `Animated.loop` et la chaîne
  `setTimeout` de clignement étaient lancées sans nettoyage. Loop +
  blinkTimer maintenant stockés ; `mounted` flag pour annuler la
  chaîne récursive ; cleanup au démontage.
- Splash glow (App.js:2740) : `Animated.loop` orpheline après
  `loading → false`. Loop + intro séquence maintenant arrêtées dans
  le cleanup du useEffect.

### Commit `9215710` — `i18n+a11y`
- `PaywallModal` : a11y label "Fermer le paywall" passé par `tr.`.
  AnimatedCount accepte une `locale` prop (était hardcodé `'fr-FR'`).
- `Profil.js` : "Se déconnecter" et deux "Fermer" passés par `tr.`,
  a11y labels ajoutés.
- `Bibliotheque.js` : suppression de l'antipattern `lang === 'en' ? ...`
  pour le bouton clear-search.
- `ErrorBoundary.js` : détection de la langue device via
  `expo-localization`, FR/EN dispatch, accessibilityRole + label sur le
  bouton retry. (Avant : tout en FR.)
- `data.js` : 7 nouvelles clés (`a11y_close_paywall`, `a11y_clear_search`,
  `profil_signout`, `coach_modal_close`, `profile_edit_close`,
  `error_boundary_{title,sub,retry}`) en FR + EN.

### Commit `f9d1b95` — `chore: drop unused assets`
Supprimé (~430 KB) : `assets/cafe.jpg`, `assets/lottie/placeholder_*.json`,
`assets/logo_web.{png,svg}`, `assets/programs/vitaly-gariev-…unsplash.jpg`,
`src/components/PilierCard.js`. Tous confirmés sans importeur.

### Commit `215071a` — `copy: fix inaccurate privacy claim`
- `T.fr.profil_donnees_desc` et `T.en.profil_donnees_desc` disaient
  "aucune donnée envoyée à des serveurs tiers" — c'était faux : on
  envoie email + prénom + progress à Supabase EU, des crash reports
  anonymisés à Sentry, et purchase metadata à RevenueCat. Texte mis
  à jour pour décrire fidèlement le data-flow.
- HealthKit summary : "HealthKit lecture uniquement, jamais partagées"
  → "HealthKit : lecture (FC, calories), écriture des séances Pilates"
  (l'app écrit aussi des workouts).

---

## 📝 Recommandations priorisées

1. **🚫 J-7** — Attaquer l'account deletion (B1). C'est le bloqueur
   #1. Plan détaillé dans la section B1 ci-dessus.
2. **🚫 J-6** — Publier des Terms of Use sur GitHub Pages + ajouter le
   lien dans le paywall + onboarding (B2).
3. **🟠 J-5** — Aligner `app.json` `NSPrivacyCollectedDataTypes` avec
   le data-flow réel (ajouter `Name`). Voir `docs/privacy/data-flow.md`.
4. **🟠 J-5** — Décision sur ES/IT (cf. I1). Recommandation : ne pas
   les déclarer dans ASC pour ce premier release.
5. **🟠 J-4** — Disclaimer "pas un avis médical" pilier p9 (I2).
6. **🟢 J-3** — Fixes locale `Activity.js` (I4), compression `icon.png`
   et `apple-watch-hero.png` (I5/I6).
7. **🟢 J-2** — Préparer les 5 screenshots App Store (iPhone 6.9"
   obligatoire pour iOS 18+, 6.5" optionnel) + description FR + EN.
   Pas trouvé de screenshots préparés ; à faire.
8. **🟢 J-1** — Build production + cold-start QA sur device physique
   (vérifier que `TEMP_UNLOCKED` removal n'a rien cassé) + smoke test
   paywall + restore + sign-in Apple + signout + flow nouveau (calendar
   permission) + flow account deletion.

---

## Annexes

- `docs/privacy/data-flow.md` — inventaire exhaustif des données et
  des flux. À utiliser pour remplir le questionnaire ASC.
- `docs/audit-pre-submission-2026-05-14.md` — audit précédent (la
  plupart de ses findings sont résolus depuis ; à archiver ou laisser
  comme historique).

---

**Audit produit par Claude Opus 4.7 (1M context), 19 mai 2026, sur
worktree `hardcore-darwin-162598`, branche
`audit/pre-app-store-submission`.**
