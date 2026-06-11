# Audit App Store Readiness — Fluidbody

**Date** : 2026-06-04
**Scope** : repo `/Users/xvan06/fluidbody` (RN/Expo SDK 54, iOS prod target)
**Méthode** : revue statique config + code (app.json, Info.plist, PrivacyInfo, paywall, auth, delete account, RPC Supabase)
**Hors-scope** : vidéos (pas encore filmées), build natif, soumission TestFlight, tests E2E
**Auditeur** : Claude (sub-agent)

---

## Résumé

**Verdict global** : Posture App Store **solide à 80 %**. Une seule chose vraiment bloquante : le bug `delete_my_account` déjà flaggé dans `AUDIT_SECURITY.md` (HIGH-1). Tant qu'il n'est pas fixé, la fonction Apple-required casse pour tout user qui a pairé une Apple TV — rejection garantie au review.

Le reste est essentiellement **propre** :
- Privacy Manifest natif + JSON Expo : présents, cohérents, déclarations Required Reasons + Collected Data en règle.
- Account deletion flow UX complet (double confirm + typed-confirm "SUPPRIMER/DELETE", RC.logOut, supabase.signOut, AsyncStorage wipe).
- Sign in with Apple **présent** (req. obligatoire car Google Sign-In est aussi présent — Guideline 4.8).
- Paywall affiche prix, période, condition de renouvellement, lien CGU + Privacy, bouton Restore.
- Pas de mention "à vie / lifetime / forever", pas de Stripe ni de référence Speir.
- Sentry strippé de PII (email/IP/username avant envoi).
- Aucun URL Bunny en clair côté client (signature server-side).

**Quelques irritants mineurs Apple-bait** : strings de boilerplate non-personnalisées (`NSMicrophoneUsageDescription`, `NSRemindersUsageDescription`), pas de lien Privacy/Terms dans le menu Profil/Préférences (uniquement paywall), `expo-av` tiré pour des permissions audio probablement non utilisées en pratique côté micro, et ES/IT qui retombent silencieusement sur le bundle FR.

| Sévérité | Compte |
|---|---|
| Critical (blocker review) | 1 |
| High (à fixer avant submit) | 3 |
| Medium (Apple peut tiquer) | 5 |
| Low (cosmétique / polish) | 4 |

---

## Checklist Apple — pass/fail par point

| # | Point | État | Détail |
|---|---|---|---|
| 1 | Privacy Manifest (`PrivacyInfo.xcprivacy`) | PASS | Présent dans `ios/FluidBody/PrivacyInfo.xcprivacy` + miroir JSON dans `app.json > expo.ios.privacyManifests`. Required Reasons cohérentes : FileTimestamp (C617.1/0A2A.1/3B52.1 — bundle/file APIs), UserDefaults (CA92.1 — AsyncStorage), SystemBootTime (35F9.1 — RN startup), DiskSpace (E174.1/85F4.1 — download manager). |
| 2 | NSPrivacyCollectedDataTypes complet | PASS | 9 types déclarés : EmailAddress, Name, UserID, Health, Fitness, PurchaseHistory, CrashData, PerformanceData, OtherUsageData. Tous Linked=true sauf Crash/Perf (Sentry anonymisé). Tracking=false partout. |
| 3 | NSPrivacyTracking + TrackingDomains | PASS | `NSPrivacyTracking: false` + domains array vide. App ne fait pas de tracking IDFA. |
| 4 | Info.plist — Permissions iOS (usage descriptions) | PARTIAL | Camera, HealthShare, HealthUpdate, Calendars, CalendarsFullAccess, PhotoLibrary : strings FR+EN détaillées et justifiées. **Problème** : Microphone + Reminders ont les strings boilerplate Expo "Allow $(PRODUCT_NAME) to access your microphone / reminders". Voir HIGH-2. |
| 5 | Account deletion (Guideline 5.1.1(v)) | FAIL | Flow UX + RPC Supabase présents (`src/utils/accountDeletion.js` + migration `20260521000000_delete_account.sql`). MAIS la RPC référence `tv_pairings.user_id` qui n'existe pas (colonne réelle = `redeemed_user_id` seulement). → la fonction THROW si tv_pairings est en prod, donc la suppression échoue. **Bloqueur review.** Voir CRITICAL-1. |
| 6 | Sign in with Apple (Guideline 4.8) | PASS | `expo-apple-authentication` configuré (`usesAppleSignIn: true`), `handleAppleSignIn` dans SignIn.js, plugin dans app.json. Obligatoire car Google Sign-In est aussi présent. |
| 7 | In-App Purchase exclusif (Guideline 3.1.1) | PASS | RevenueCat seul gestionnaire (`react-native-purchases`). Aucune mention de Stripe / paiement externe / URL pricing dans `src/` ni `App.js`. Le CTA paywall route vers RC.purchasePackage uniquement. |
| 8 | Restore Purchases bouton dispo | PASS | `Purchases.restorePurchases()` câblé via `restoreSubscription()` dans App.js (l. 1587-1593). Exposé sur le paywall (`tr.paywall_restore`) ET dans Profil (`onRestorePurchases` prop). |
| 9 | Subscription terms display (Guideline 3.1.2(a)) | PASS | Paywall affiche : prix mensuel + annuel, période ("/mois", "/an"), condition de renouvellement complète ("L'abonnement se renouvelle automatiquement... Réglages > Apple ID > Abonnements"), pill "Annulable depuis Réglages Apple", legal fine print, lien CGU, lien Privacy. Plateforme-aware (Apple vs Google Play). |
| 10 | Privacy Policy URL accessible | PARTIAL | URL `https://yvan-glitch.github.io/fluidbody-privacy/` configurée. Repo local `fluidbody-privacy/` contient `index.html` (FR/EN toggle privacy) — OK. **MAIS** repo local n'a PAS `terms/index.html` ni `terms/en/index.html` ; le paywall pointe vers ces URLs. Soit elles existent côté remote GitHub Pages (ajoutées via web UI), soit elles 404 → liens cassés du paywall. À vérifier avec curl depuis machine connectée. |
| 11 | "À vie" / lifetime claims | PASS | Zero match sur `à vie`, `lifetime`, `forever`, `illimité` dans App.js + src/. |
| 12 | Référence concurrent (Speir) | PASS | Zero match dans le code. Bonus : comparaison paywall = "Studio" générique, pas un concurrent app. |
| 13 | bundleIdentifier cohérent | PASS | `com.ytissot.fluidbody` cohérent entre app.json (iOS+Android), Info.plist ($(PRODUCT_BUNDLE_IDENTIFIER)), eas.json (ascAppId `6761364962`, teamId `R5V88AS9MX`). |
| 14 | Version + buildNumber | PASS | `version: "1.0.0"` dans app.json, MARKETING_VERSION 1.0 dans pbxproj, `CURRENT_PROJECT_VERSION: 1`, EAS gère l'auto-increment (`autoIncrement: true` sur profil production). |
| 15 | ATS — pas de cleartext | PASS | `NSAllowsArbitraryLoads: false`. Exceptions ciblées sur `b-cdn.net` et `supabase.co` avec `NSExceptionAllowsInsecureHTTPLoads: false`. |
| 16 | ITSAppUsesNonExemptEncryption | PASS | `false` déclaré dans Info.plist + app.json (évite la question crypto export à chaque build). |
| 17 | Splash + icon | PASS | `./assets/icon.png` + `./assets/splash-icon.png`, splash storyboard `SplashScreen`, background `#000e18`. |
| 18 | Orientations | PASS | iPhone : portrait + portraitUpsideDown. iPad : 4 orientations (paysage activé via `~ipad`). |
| 19 | Safe area / iPhone 17 Dynamic Island | PARTIAL | `SafeAreaProvider` + `react-native-safe-area-context` au root. Audit `AUDIT_SAFE_AREA.md` existe — pas relu ici, mais récente fix Sabrina (build 94) suggère qu'il reste de la dette. |
| 20 | Localization | PARTIAL | Apple Switzerland/Europe attend FR + EN minimum → OK. **Mais** `T` n'expose que `fr` et `en` (pas d'objets `es:`/`it:`) ; `T[lang] \|\| T['fr']` → user device es/it tombe en FR sans alerte. CLAUDE.md mentionne 4 langues — divergence. Pas un bloqueur Apple (es/it = bonus), mais un mensonge des keywords si annoncé sur l'App Store. |
| 21 | Lien Privacy / Terms dans l'app (hors paywall) | PARTIAL | Privacy + Terms uniquement liés depuis PaywallModal. Aucun lien dans Profil ni Préférences. Apple ne rejette pas pour ça mais c'est une recommandation forte (HIG + Guideline 5.1.1) car certains users n'ouvrent jamais le paywall. |
| 22 | Support contact in-app | PARTIAL | Aucun email mailto: ni page support dans le code. Apple ne le requiert pas (champ Connect suffit), mais c'est un signal de qualité — et utile en cas de bug de suppression de compte. |
| 23 | Medical disclaimer | PASS | `pilier_education_medical_footer`: "Ces informations sont éducatives et ne remplacent pas un avis médical." présent dans `data.js` (l.92). HK strings mentionnent "Pilates / fréquence cardiaque" sans promesse santé. |
| 24 | Age rating / parental | PASS | Pas de contenu sensible, contenu Pilates général ; rating 4+ adéquat (à confirmer côté Connect). Pas d'auth age gate requise. |
| 25 | Sentry / PII | PASS | `beforeSend` strip email + ip_address + username (App.js l.24-31). `Sentry.setUser({ id })` uniquement (l.2617). |
| 26 | Logs en prod | PASS | CLAUDE.md confirme `__DEV__` gating systématique. |
| 27 | Apple TV (séparé) | N/A | Build TV passe par profil `production-tv` séparé. Pas concerné par la submission iPhone immédiate. |

---

## Bloqueurs critiques (rejection probable)

### CRITICAL-1 — `delete_my_account` casse sur `tv_pairings.user_id`

**Fichier** : `supabase/migrations/20260521000000_delete_account.sql:71`
**Symptôme** : la RPC fait `delete from public.tv_pairings where user_id = $1 or redeemed_user_id = $1` mais la colonne `user_id` n'existe pas (cf. `20260518000000_tv_pairings.sql:34-52`). PostgreSQL throw `column user_id does not exist`. Sur un compte qui a interagi avec tv_pairings (utilisateur qui a pairé une TV), la suppression échoue et l'utilisateur reste coincé avec un compte non-supprimable.

**Impact Apple** : reviewer crée un compte, tente "Supprimer mon compte", reçoit l'alert d'erreur localisée (`tr.delete_account_error_message`). Apple guideline 5.1.1(v) = rejection immédiate.

**Fix** : retirer la condition `user_id = $1 or`. La colonne `redeemed_user_id` suffit (la cascade `on delete cascade` sur `auth.users(id)` nettoie le reste automatiquement à la suppression finale).

```sql
execute 'delete from public.tv_pairings where redeemed_user_id = $1' using v_user_id;
```

**Note** : déjà flaggé dans `audits/AUDIT_SECURITY.md` (HIGH-1). Tant qu'il n'est pas patché en migration + déployé, **ne pas soumettre**.

---

## Issues High (à fixer avant submit)

### HIGH-2 — NSMicrophoneUsageDescription + NSRemindersUsageDescription boilerplate

**Fichier** : `ios/FluidBody/Info.plist:85-95`
**Contenu actuel** :
```
NSMicrophoneUsageDescription → "Allow $(PRODUCT_NAME) to access your microphone"
NSRemindersFullAccessUsageDescription → "Allow $(PRODUCT_NAME) to access your reminders"
NSRemindersUsageDescription → "Allow $(PRODUCT_NAME) to access your reminders"
```

**Impact Apple** : Apple's reviewers ont déjà flag des apps pour des purpose strings génériques. Pire : l'app **ne se sert pas** du micro ni des Reminders (zero match sur `recordAsync`, `Audio.Recording`, `Reminders` dans le code applicatif). expo-av tire NSMicrophoneUsageDescription par défaut.

**Fix recommandé** (au choix) :
- A) Retirer expo-av si VideoPlayer peut migrer vers `expo-video` (cleaner) → micro n'est plus demandé.
- B) Override la string dans `app.json > expo.ios.infoPlist`: `"NSMicrophoneUsageDescription": "FluidBody+ n'utilise pas le microphone."` et idem pour Reminders. Apple acceptera tant que la string n'est plus boilerplate, mais c'est un mensonge si Apple inspecte les symboles. Préférer A.

**Sévérité** : High car ce n'est pas un rejection garanti, mais signalé sur la quasi-totalité des apps en post-purpose-string-crackdown (2025+).

### HIGH-3 — URLs `/terms/` et `/terms/en/` peut-être 404

**Fichier** : `app.json:158-159`, `src/constants/legal.js`
**Contexte** : le repo local `fluidbody-privacy/` ne contient QUE `index.html` (privacy). Pas de fichier sous `terms/`. Si ces URLs n'existent pas côté `yvan-glitch.github.io/fluidbody-privacy/terms/`, les liens du paywall pointent vers du 404.

**Impact Apple** : reviewer clique "Conditions d'utilisation" sur le paywall, reçoit une page 404 GitHub Pages. Guideline 1.5 (Developer Information) + 5.1.1. Rejection probable.

**Fix** : vérifier depuis une machine connectée :
```bash
curl -sI https://yvan-glitch.github.io/fluidbody-privacy/terms/
curl -sI https://yvan-glitch.github.io/fluidbody-privacy/terms/en/
```
Si HTTP 200 : OK, juste push manquant dans le clone local. Sinon : créer les fichiers + push GitHub Pages avant submission.

### HIGH-4 — Privacy/Terms inaccessibles hors paywall

**Contexte** : `Linking.openURL(LEGAL.privacyUrl)` n'est appelé QUE depuis `src/components/PaywallModal.js`. Les écrans Profil et Préférences n'ont aucun lien Privacy/Terms.

**Impact Apple** : pas un rejection direct, mais une note App Review classique : "Users must be able to access your privacy policy from within the app at any time, not only during purchase flow". Vu sur des apps similaires.

**Fix** : ajouter une rangée dans Profil > Confidentialité (carte qui existe déjà à `Profil.js:1596-1613`) avec deux liens "Politique de confidentialité" + "Conditions d'utilisation" via `Linking.openURL(LEGAL.privacyUrl)` / `Linking.openURL(getTermsUrl(lang))`.

---

## Issues Medium

### MED-1 — `expo-av` chargé pour rien si Video peut migrer
`expo-av` est deprecated par Expo (recommandation officielle = `expo-video` + `expo-audio`). Il tire `NSMicrophoneUsageDescription` automatiquement. Sur SDK 54+, garder expo-av est OK pour la submission mais Apple va de plus en plus regarder la justification du micro. Migrer post-submit.

### MED-2 — Pas de localisation ES/IT effective
`T` dans `src/constants/data.js` n'a que `fr:` et `en:`. CLAUDE.md affirme 4 langues. Si la fiche App Store annonce ES + IT, c'est trompeur. Soit retirer ES/IT de la fiche App Store Connect, soit ajouter les bundles (lourd). Pas un bloqueur si les langues ne sont pas annoncées.

### MED-3 — Pas de support email in-app
Apple permet de mettre l'email de support uniquement sur la fiche Connect. Mais avoir un `mailto:support@fluidbody.ch` ou similaire dans Profil > Aide signale du sérieux et évite que les reviewers cherchent. Bonus : utilité pour les users qui rencontrent un bug RC ou de suppression de compte.

### MED-4 — `version: "1.0.0"` (3 segments) vs `MARKETING_VERSION: 1.0` (2 segments)
Le store accepte les deux mais EAS pourrait avoir des soucis de cohérence sur l'auto-increment. `app.json` dit 1.0.0, le pbxproj dit 1.0. Pas un blocage technique mais à vérifier que TestFlight affiche bien la version attendue.

### MED-5 — UISupportedInterfaceOrientations~ipad inclut Portrait + Landscape
iPad supporte 4 orientations, iPhone 2 (portrait + upsideDown). Cohérent avec un app Pilates utilisée en yoga mat horizontal. **Mais** : `expo-screen-orientation` est chargé en lazy require (`App.js:97`) — vérifier que VideoPlayer ne force pas landscape en lecture vidéo, ce qui chez Apple = "rotation involontaire" → rejection si pas géré.

---

## Issues Low

### LOW-1 — Pas de "Liens Apple TV" mention dans la description App Store
Si tu annonces la compatibilité Apple TV sur la fiche, il faut un bullet "Apple TV companion app" et avoir l'app TV approuvée séparément. Pas concerné si Apple TV reste hors-scope pour ce submit.

### LOW-2 — `usesAppleSignIn: true` mais Apple Sign-In est UI-conditional
`appleAvailable = !!AppleAuth && Platform.OS === 'ios'` — OK techniquement. Mais si tu shippes un build où `expo-apple-authentication` plugin manque, l'écran SignIn n'affichera pas le bouton et Apple va flagger. À vérifier dans le build de soumission que le bouton est bien rendu.

### LOW-3 — Le bouton "Pre-fill" via Apple `givenName` ne re-fetch que la 1re fois
Apple ne renvoie `fullName` qu'à la PREMIÈRE authentification. Si user retire l'app puis re-signe, `givenName` sera `null`. SignIn.js gère bien ce cas (l.123-130 : skip si vide). RAS, juste à savoir.

### LOW-4 — RevenueCat `info?.entitlements?.active?.[RC_ENTITLEMENT_ID]`
Le check est correct. À s'assurer que `RC_ENTITLEMENT_ID = "Fluidbody Pilates Pro"` (cf. CLAUDE.md) correspond exactement à la valeur configurée dans RevenueCat dashboard (case-sensitive avec espaces).

---

## Tableau récapitulatif

| Item | Pass | Fail | Partial | Notes |
|---|:---:|:---:|:---:|---|
| Privacy Manifest (xcprivacy + JSON) | X | | | Required Reasons + Collected Data complets |
| Account deletion flow UI | X | | | Double confirm + typed-confirm |
| Account deletion RPC | | **X** | | **Bug colonne user_id → CRITICAL-1** |
| Sign in with Apple | X | | | Présent + plugin configuré |
| IAP exclusif (no Stripe) | X | | | RC uniquement |
| Restore Purchases | X | | | Câblé paywall + Profil |
| Subscription terms display | X | | | Prix + période + renouvellement + cancel + CGU + Privacy |
| Privacy URL accessible | | | X | À vérifier que `/terms/` existe vraiment côté Pages |
| Permissions iOS strings | | | X | **Micro + Reminders boilerplate → HIGH-2** |
| ATS / HTTPS | X | | | Pas de cleartext |
| Pas de "à vie" / Speir | X | | | Vérifié grep |
| Sentry PII strip | X | | | beforeSend OK |
| Logs prod | X | | | __DEV__ gating |
| Localization FR+EN | X | | | Apple SUI/UE = OK |
| Localization ES+IT | | | X | T n'a pas es/it → tombe en FR |
| Lien Privacy hors paywall | | | X | À ajouter dans Profil |
| Support email in-app | | | X | Manquant — non bloquant |
| Medical disclaimer | X | | | pilier_education_medical_footer |
| iPad orientations | X | | | 4 orientations iPad |
| Safe area / Dynamic Island | | | X | Audit séparé en cours |

**Score brut** : 13 PASS / 1 FAIL / 7 PARTIAL.

---

## Estimation effort prep complet

| Tâche | Effort | Priorité |
|---|---|---|
| Fix `delete_my_account` (retirer `user_id =` + migration + push prod) | **30 min** + déploiement | **CRITICAL** — avant tout submit |
| Vérifier que `/terms/` et `/terms/en/` répondent 200 sur GitHub Pages | 5 min curl | **HIGH** |
| Override strings micro/reminders dans app.json infoPlist (ou migration expo-video) | 15 min override / 2-4h migration | **HIGH** (override mini-suffisant) |
| Ajouter lien Privacy + Terms dans Profil | 20 min | **HIGH** |
| Audit safe-area dédié (en cours selon mémoire build #94) | en cours | MED |
| Optionnel : ajouter support email + page d'aide | 1 h | LOW |
| Optionnel : peupler T.es et T.it | 4-6 h (rédaction) | LOW |
| Vérifier RC entitlement ID exact match dashboard ↔ code | 5 min | LOW |
| Test E2E suppression compte en compte avec tv_pairing existant | 30 min | CRITICAL (post-fix) |
| Vérifier landscape rotation comportement VideoPlayer iPad | 15 min | MED |

**Effort total minimal pour level "submittable"** : ~2-3 heures de dev + tests sur device + 1 push GitHub Pages.

**Effort total pour level "review-proof, anticipating questions"** : 1 journée (inclut polish lien Privacy hors paywall, support email, vérification visuelle TestFlight sur iPhone 17 Pro Max).

---

## Bottom line

Le seul vrai blocker rejection-grade est **CRITICAL-1** (delete_my_account). Une fois patché, le submit a toutes ses chances de passer. Les HIGH-2/3/4 sont des "Apple va te demander de fixer dans la 1re révision" plutôt que des rejections immédiates — mieux vaut les faire avant.

Vidéos une fois prêtes, la pipeline est essentiellement déjà prête à shipper.
