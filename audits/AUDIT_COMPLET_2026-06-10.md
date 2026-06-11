# Audit complet FluidBody — iOS / tvOS / Android

**Date** : 10 juin 2026
**Périmètre** : sécurité, qualité de code & architecture, config builds/stores, i18n, accessibilité, performance
**Méthode** : revue statique complète (App.js 2 914 lignes, src/ ~124 fichiers, supabase/, configs natifs, historique git), confrontation avec les audits précédents (31/05, 03/06, 04/06), vérification manuelle de chaque finding critique.

---

## Résumé exécutif

L'app est dans un état globalement **sain et en nette amélioration** : architecture assainie (App.js réduit, src/ bien découpé), pipeline tvOS propre et isolé, conformité stores solide (privacy manifest, ATS, export compliance), hygiène hooks/mémoire exemplaire, secrets correctement gitignorés.

**MAIS deux failles critiques nouvelles ont été découvertes côté Supabase** : la RLS de `profiles` permet à n'importe quel utilisateur authentifié de **s'auto-attribuer le premium et des mois gratuits illimités** avec la seule clé anon publique. C'est le risque business n°1 et il est exploitable aujourd'hui.

Par ailleurs, **3 corrections promises par les audits précédents ne sont toujours pas appliquées**, dont le fix P0 `delete_my_account` (conformité Apple) identifié le 4 juin.

| Sévérité | Nombre | Exemples |
|---|---|---|
| 🔴 Critique | 2 | Bypass paywall via RLS, auto-crédit parrainage |
| 🟠 Élevée | 7 | delete_my_account cassé, Sentry DSN prod, ReferenceError édition profil, redeem TV, auth tripliquée, a11y disclaimer médical, 0 FlatList |
| 🟡 Moyenne | ~14 | i18n FR hardcodé, purpose strings, permissions Android, CORS, GUIDs Bunny |
| ⚪ Faible | ~15 | hygiène repo, code mort, assets non optimisés |

---

## 1. 🔴 CRITIQUE — Sécurité Supabase (NOUVEAU)

### C-1. Bypass de paywall : auto-attribution de `is_subscriber`

**Fichiers** : `supabase/migrations/20260512000000_profile_fields.sql:83-86` + `20260511000000_video_security.sql:19-22`
**Vérifié manuellement** ✅

La policy `profiles_update_own` autorise `UPDATE` sur sa propre ligne **sans restriction de colonne**, et aucun `REVOKE` colonne n'existe. Tout utilisateur authentifié (clé anon publique + son JWT) peut exécuter :

```sql
update profiles set is_subscriber = true, subscription_expires_at = '2099-01-01' where id = auth.uid();
```

L'edge function `sign-video-url` lit `profiles.is_subscriber` comme 2ᵉ niveau d'entitlement → **accès gratuit à tout le catalogue premium**, paywall contourné côté serveur. Sur tvOS, ce flag est même la source principale (pas de RevenueCat sur TV).

### C-2. Auto-attribution des crédits de parrainage

**Fichiers** : mêmes policies + `20260513000000_referrals.sql:27-29, 147-200`, `20260605120000_referrals_7days_referrer_only.sql`

Même cause : `referrals_count`, `free_days_earned`, `free_months_earned` sont self-writables (`update profiles set free_days_earned = 99999 ...`). De plus, la RPC `credit_referral_on_first_paid()` (SECURITY DEFINER, grant à `authenticated`) est appelée côté client **sans vérification serveur qu'un paiement a eu lieu** — un client modifié l'appelle directement et crédite +1 mois au parrain et au filleul.

### Correction (commune, prioritaire absolue)

```sql
revoke update on public.profiles from authenticated;
grant update (prenom, gender, birth_year, ...colonnes non sensibles...) on public.profiles to authenticated;
```

Ou déplacer les flags d'abonnement/crédit dans une table dédiée écrite uniquement par `service_role`. Migrer le crédit parrainage vers un **webhook RevenueCat server-side** idempotent sur `transaction_id` (le TODO existe déjà en commentaire SQL). Verrouiller aussi `rc_app_user_id`.

> ⚠️ Tant que C-1/C-2 ne sont pas corrigés, la clé anon présente dans l'historique git (point connu M-2 du 04/06, normalement bénin) devient un vecteur d'exploitation trivial.

---

## 2. 🟠 ÉLEVÉE

### E-1. `delete_my_account` cassée — P0 App Store, **identifié le 04/06, toujours non corrigé**

**Fichier** : `supabase/migrations/20260521000000_delete_account.sql:71` — **vérifié** ✅

```sql
delete from public.tv_pairings where user_id = $1 or redeemed_user_id = $1
```

La colonne `user_id` **n'existe pas** dans `tv_pairings` (seulement `redeemed_user_id`). Dès que la table est déployée, la suppression de compte lève une exception → **non-conformité Apple 5.1.1(v)**. Fix one-liner : `where redeemed_user_id = $1` + `supabase db push`.

### E-2. Sentry DSN probablement inopérant en production (NOUVEAU)

**Fichier** : `eas.json:20` — **vérifié** ✅ : `"EXPO_PUBLIC_SENTRY_DSN": "$EXPO_PUBLIC_SENTRY_DSN"`

EAS ne fait **pas** d'expansion `$VAR` : le bundle prod contient la chaîne littérale `"$EXPO_PUBLIC_SENTRY_DSN"` (DSN invalide → init no-op silencieux). De plus, cette entrée **écrase** toute variable du dashboard EAS de même nom, et `.env` gitignoré n'est jamais uploadé aux workers EAS (la croyance dans `BUILD_96_PENDING.md` est erronée). **Le monitoring de crash TestFlight/prod est probablement aveugle.**
**Fix** : supprimer l'entrée de eas.json, définir le DSN dans le dashboard EAS (profil production + production-tv), déclencher une erreur depuis un build TestFlight et vérifier l'arrivée de l'event. Noter aussi que `SENTRY_DISABLE_AUTO_UPLOAD` = pas de symbolication (dSYM/sourcemaps) — à câbler avant le lancement.

### E-3. ReferenceError sur la sauvegarde du profil édité (NOUVEAU)

**Fichier** : `App.js:2133` vs `App.js:2409` — **vérifié** ✅

La modal `editingProfile` (dans `MainApp`) appelle `handleProfileSetupSave(payload)`, fonction définie **dans `App()`** et jamais passée en prop à `MainApp`. Chemin : Profil → Modifier le profil → Enregistrer → ReferenceError non catchée → **modal bloquée, sauvegarde cloud perdue**. Fix : passer la fonction en prop (comme `onAccountDeleted`).

### E-4. Prénom « Yvan » hardcodé pour tous les utilisateurs Apple private relay (NOUVEAU)

**Fichier** : `App.js:2509` — **vérifié** ✅ : tout client s'inscrivant avec « Masquer mon adresse » sans prénom sera salué « Yvan ». Reste de debug à retirer (retourner `''`).

### E-5. Pairage TV : `redeem` ne vérifie pas le `tv_secret` (NOUVEAU)

**Fichier** : `supabase/functions/tv-pair/index.ts:110-163`. Seul `poll` vérifie le secret (80 bits — solide). Un nonce volé (photo du QR) permet de détourner/confondre un pairage en cours. Pas de vol de session direct, mais le `redeem` est la seule étape non protégée. Exiger le `tv_secret` (ou son hash) aussi au redeem. Le rate-limit poll promis en commentaire (ligne 27) n'existe toujours pas (connu du 04/06).

### E-6. Authentification tripliquée (~700 lignes) (NOUVEAU)

Apple + Google + email implémentés 3× quasi identiques : `App.js:534-856` (AuthScreen), `App.js:861-1202` (OnboardingScreen), `src/screens/SignIn.js`. Dérive déjà réelle : **seul AuthScreen exige l'acceptation des CGU**, et l'upsert du prénom diffère. Extraire un module `AuthProviders` partagé.

### E-7. Accessibilité du MedicalDisclaimerOverlay (NOUVEAU, écran légal)

**Fichier** : `src/components/MedicalDisclaimerOverlay.js:174-192` (ajouté le 5 juin). La checkbox de contre-indications n'a ni `accessibilityRole="checkbox"` ni `accessibilityState` → un utilisateur VoiceOver ne peut pas franchir le gate médical (CTA reste disabled sans explication). Pas d'`accessibilityViewIsModal` : VO navigue dans l'app derrière le disclaimer. Sur un écran de protection juridique, à corriger en priorité.

### E-8. Performance : 0 FlatList, 0 React.memo (connu, non corrigé)

`Bibliotheque.js` : 14 `.map()` dans un ScrollView ; `MonCorps.js` : 28 `.map()`. Les 5 `Tab.Screen` utilisent des children inline recréés à chaque render de `MainApp` → chaque update de `done`/`streak` re-rend l'écran focalisé entier (MonCorps = 2 294 lignes non mémoïsées). Priorité : carrousels → FlatList, memo sur les cards TV.

**+ Bug nouveau vérifié** ✅ : `MonCorps.js:882-883` — `<LivingBackground />` rendu **deux fois** (duplication évidente, indentation cassée) dans le modal de création de programme : 2× 12 Animated.loop + 6 blobs `shadowRadius: 90` superposés. Fix d'une ligne.

---

## 3. 🟡 MOYENNE

### Sécurité
- **GUIDs Bunny en clair dans une migration committée** (`20260511000000_video_security.sql:28-32`) : 3 GUIDs dans git. Sans Token Auth activée sur la pull-zone Bunny (étape dashboard manuelle, non vérifiable depuis le code), ces vidéos sont publiques. **À confirmer côté dashboard Bunny.**
- **CORS `*`** sur les deux edge functions — acceptable pour du mobile (auth Bearer), à documenter.
- **`ADMIN_EMAILS` hardcodé client** (`App.js:1424`) — entitlement vidéo reste vérifié serveur, risque limité.
- **Clé anon + clé RC dans l'historique git** (connu) — bénin une fois C-1/C-2 corrigés.

### Config / stores
- **Purpose strings placeholder anglais** (`ios/FluidBody/Info.plist`) : micro et Reminders en « Allow $(PRODUCT_NAME)... » injectés par expo-av/expo-calendar → risque rejet 5.1.1. Désactiver (`microphonePermission: false`, `remindersPermission: false`) ou fournir des textes réels.
- **Purpose strings non localisés es/it** : chaîne « FR — EN » unique, pas de `InfoPlist.strings`.
- **Permissions Android excessives** : `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, storage legacy dans le manifest généré → `android.blockedPermissions` dans app.json avant la data-safety review Play.
- **Android sans IAP** : RevenueCat est gaté iOS-only (`App.js:1549`), pas de clé RC Android. Bloqueur de toute release Play Store (cohérent tant qu'Android n'est pas distribué).
- **Duplication des purpose strings HealthKit** (app.json 2×) — risque de drift.
- **expo-av déprécié** (VideoPlayer, Timer, AudioRitualPlayer) — retiré en SDK 55+, migration expo-video/expo-audio à planifier (décision ouverte depuis le 04/06).
- **Cible Apple Watch dormante** : `@bacons/apple-targets` en dépendance + `targets/watch/` versionné mais plugin absent des `plugins` → non générée (intentionnel d'après `apple-watch/PLAN.md`), mais piège si activée par erreur sur un build prod sans provisioning watch.

### i18n (es/it ont disparu : `T` ne contient que fr/en, parité 100 % — 714 clés chacune)
- **`tr.etapes` jamais branchée** : chips de filtre et badges étape affichent les libellés français en dur même en EN (`MonCorps.js:2092-2126`). La map traduite existe, 0 call-site.
- **Durées fr/en incohérentes** : p2[0] FR `1'59''` vs EN `12 min`, p2[1] FR `2'29''` vs EN `15 min` → durée fausse + bucket de filtre différent selon la langue.
- **FR hardcodé pour les utilisateurs EN** (connu du 04/06, non corrigé) : badge `NOUVEAU`, sous-titres/durées des 5 cartes Programmes (`MonCorps.js:1705-1790`, `tv/ProgrammesTV.js:39-43`), « Prépare-toi » (`VideoPlayer.js:792`), plusieurs `Alert.alert` (`App.js:2055-2072`...), « Politique de confidentialité » (`App.js:1148` alors que la clé existe).
- **CLAUDE.md annonce 4 langues** : faux — `SUPPORTED_APP_LANGS = ['fr','en']` ; es/it dans ARTICLES/FICHES = code mort.

### Accessibilité
- **Labels VoiceOver du VideoPlayer en français hardcodé** (`'Pause'`, `'Lecture'`...) + barre de progression `adjustable` sans `accessibilityValue` ni actions → slider muet.
- **0 `accessibilityViewIsModal`, 0 `announceForAccessibility`, 0 clamp Dynamic Type** dans toute l'app (inchangé depuis le 04/06). Couverture labels ~20 % brute (~40 % avec GlassButton). Écrans muets : MonCorps (86 touchables/11 labels), Timer (18/0).
- **Reduce motion ignoré** partout sauf LiquidGlassEnhanced (Méduse : 13 loops, blobs plein écran).
- **Contrastes sous AA** : `textTertiary rgba(255,255,255,0.4)` ≈ 3.4:1 — cible 50+, impact réel. Remonter à ~0.62.

---

## 4. ⚪ FAIBLE / hygiène

- **`.claude/worktrees/` = 2,8 GB** de worktrees obsolètes dans le dossier projet — à purger.
- **`FluidBody.saver/`** : binaire macOS compilé **tracké dans git** — à sortir du repo.
- **Secrets locaux en clair** (non versionnés — vérifié `git ls-files` ✅) : `KEY/AuthKey_*.p8`, `credentials/ios/dist-cert.p12`, et surtout le **password du .p12 en clair dans `credentials.json`**. Déplacer hors du repo / gestionnaire de secrets.
- **DownloadManager XOR** : placeholder toujours en place (connu), possiblement code mort — trancher.
- **ErrorBoundary affiche `error.message` brut en prod** (`components/ErrorBoundary.js:31-35`) — gater par `__DEV__`.
- **Code mort** : clé AsyncStorage `is_subscription_active` écrite/jamais lue ; `expo-system-ui` inutilisé ; `withTimeout` et `devLog/devWarn` redéfinis localement (3×) ; loop splash sans `stop()` (`App.js:2761`, connu) ; `console.log` non gaté `DownloadButton.js:111` (connu).
- **Assets : 14 MB** dont `coach/` 8.9 MB non compressé et ~1.6 MB jamais référencés (quick win −2 MB du 04/06 toujours pas appliqué).
- **ATS exception sur `b-cdn.net` entier** au lieu de la pull-zone précise.
- **~15 fichiers RECAP/AUDIT *.md à la racine** — déplacer dans `docs/recaps/`.
- **`src/utils.js` coexiste avec `src/utils/`** — confusion d'imports.
- Liste `p1..p8` dupliquée en dur à 3 endroits d'App.js alors que `src/utils.js` connaît déjà p9.

---

## 5. ✅ Ce qui est bien (à mettre au crédit du projet)

- **Edge function `sign-video-url`** : JWT vérifié, regex stricte sur session_id, entitlement 3 niveaux, TTL 30 min, clé Bunny jamais exposée. Bien conçue (la faille vient de la RLS en amont, pas de la fonction).
- **Aucun secret dans git** : `.env`, KEY/, credentials, .p8/.p12 tous gitignorés et non trackés (vérifié). Aucun secret server-only dans le bundle.
- **Sentry** : PII strippée (`beforeSend` retire email/IP/username), `setUser({id})` only.
- **Pipeline tvOS exemplaire** : fork react-native-tvos + `EXPO_TV=1` + app.config.js wrapper conditionnel, plugins strippés, canaux OTA séparés (production vs production-tv → pas de risque New Arch croisé), brandassets présents, abstraction `platformTV.js` propre.
- **CNG intégral** : ios/ et android/ régénérés, source de vérité = app config — zéro conflit app.json/app.config.js.
- **Conformité stores** : privacy manifest iOS exhaustif, `NSPrivacyTracking: false` (pas d'ATT requis), export compliance, ATS strict, privacy policy + CGU fr/en + disclaimer médical en place.
- **Hygiène hooks/mémoire quasi parfaite** : tous les intervals/listeners/subscriptions vérifiés sont nettoyés ; `withTimeout`/`safeNativeCall` systématiques sur Supabase/RevenueCat ; fallback offline RC ; splash safety timer.
- **Health multi-plateforme propre** : HealthKit iOS / Health Connect Android séparés, kill-switch JS, polling heart-rate bien implémenté.
- **Dates/nombres correctement localisés** (locale explicite partout, `Intl.NumberFormat` CHF).
- **Améliorations constatées depuis le 04/06** : my-app/ supprimé, 87 imports morts purgés, SABRINA_QUOTES bilingue, tvFocusProps sur le Paywall, parité i18n maintenue à 100 % malgré +21 clés.

---

## 6. Plan d'action priorisé

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | **Verrouiller les colonnes sensibles de `profiles`** (REVOKE/GRANT colonne) + migrer le crédit parrainage vers un webhook RevenueCat | 2-4 h | 🔴 Ferme le bypass paywall/parrainage |
| 2 | **Fix `delete_my_account`** (`redeemed_user_id`) + `supabase db push` | 5 min | 🟠 Conformité Apple, P0 depuis 6 jours |
| 3 | **Réparer la livraison du DSN Sentry** (dashboard EAS, retirer le `$VAR` de eas.json) + vérifier un event TestFlight | 30 min | 🟠 Monitoring prod aveugle sinon |
| 4 | **Passer `handleProfileSetupSave` en prop de MainApp** + retirer `'Yvan'` (App.js:2509) | 15 min | 🟠 Bug bloquant édition profil |
| 5 | **Supprimer le `<LivingBackground />` dupliqué** (MonCorps.js:883) | 1 min | 🟠 Perf modal |
| 6 | **A11y MedicalDisclaimerOverlay** (role/state checkbox + viewIsModal) | 30 min | 🟠 Écran légal |
| 7 | Purpose strings placeholder (micro/Reminders) avant prochaine soumission | 30 min | 🟡 Risque rejet |
| 8 | Brancher `tr.etapes` + durées EN + strings FR hardcodées (cartes Programmes, NOUVEAU, alerts) | 2 h | 🟡 UX utilisateurs EN |
| 9 | Vérifier Token Auth Bunny activée + `tv_secret` au redeem | 1 h | 🟡 Sécurité vidéos/TV |
| 10 | Ménage : worktrees 2,8 GB, FluidBody.saver hors git, assets −2 MB, CLAUDE.md à réécrire (décrit une app qui n'existe plus) | 2 h | ⚪ Hygiène + fiabilité des futurs agents |

**Moyen terme** : unifier l'auth (−500 lignes, supprime la dérive CGU), scinder MonCorps.js (2 294 l.) et Profil.js (1 842 l.), FlatList + memo sur les grilles, migration expo-av → expo-video/audio avant SDK 55, sweep a11y (top-10 de `audits/AUDIT_A11Y.md`, toujours valable), trancher Android (clé RC + data safety) avant toute release Play.
