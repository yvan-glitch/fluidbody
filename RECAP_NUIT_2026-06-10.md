# Récap nuit du 10-11 juin 2026 — Audit complet + correctifs

Salut Yvan ! Pendant ta nuit : audit complet (rapport dans `audits/AUDIT_COMPLET_2026-06-10.md`), puis correction de tout ce qui était critique/élevé. Chaque correctif a été passé en review adversariale par un second agent, qui a trouvé 1 bug bloquant + 3 points importants dans mes propres correctifs — tous corrigés ensuite. **Rien n'est commité ni déployé** : tout t'attend en local pour relecture.

---

## ⚠️ CE QUE TU DOIS FAIRE TOI (rien n'est déployé)

1. **Relire le diff** (`git diff` + les 4 nouveaux fichiers non trackés), puis commit.
2. **Tester sur staging PUIS pousser les migrations** : `supabase db push`
   → ⚠️ La migration `20260610100000_security_lockdown.sql` change les privilèges d'écriture sur `profiles`. **Avant de pousser en prod, teste sur staging qu'un upsert profil client marche encore** (modifier le prénom dans l'app suffit). Le reviewer a identifié — et j'ai corrigé — un piège (`UPDATE(id)` requis par les upserts PostgREST), mais ni lui ni moi n'avons pu exécuter de vrai Postgres dans la sandbox.
3. **Déployer les edge functions** :
   `supabase functions deploy confirm-purchase` (nouvelle) et `supabase functions deploy tv-pair` (modifiée)
   → `confirm-purchase` exige le secret `REVENUECAT_SECRET_API_KEY` (déjà documenté pour sign-video-url — vérifie qu'il est bien posé : `supabase secrets list`).
4. **Dashboard EAS (expo.dev)** : définis `EXPO_PUBLIC_SENTRY_DSN` comme variable d'env du projet (profils production + production-tv). J'ai retiré le `"$EXPO_PUBLIC_SENTRY_DSN"` littéral de eas.json — **ton Sentry prod était très probablement aveugle jusqu'ici** (EAS n'expanse pas les `$VAR`, et le `.env` gitignoré n'est jamais uploadé aux builds EAS, contrairement à ce que dit BUILD_96_PENDING.md). Profite-en pour vérifier que les vars Supabase/RC y sont aussi. Puis : build TestFlight → déclenche une erreur → vérifie l'arrivée de l'event sur sentry.io.
5. **Dashboard Bunny** : confirme que la **Token Authentication est bien activée** sur la pull-zone `vz-1a4e2cac-0dc` — 3 GUIDs vidéo sont en clair dans une migration committée ; sans Token Auth, ces vidéos sont publiques. Non vérifiable depuis le code.

---

## 🔴 Corrigé : les 2 failles critiques (bypass paywall + parrainage)

**Le problème** : la policy RLS de `profiles` + les GRANT par défaut permettaient à tout utilisateur authentifié (clé anon publique + son JWT) de faire `update profiles set is_subscriber = true` → catalogue premium gratuit (et c'est la source principale d'entitlement sur tvOS). Idem pour `free_days_earned` (abonnement gratuit illimité), et la RPC `credit_referral_on_first_paid` était appelable sans aucune preuve de paiement.

**Le fix** (`supabase/migrations/20260610100000_security_lockdown.sql` + `supabase/functions/confirm-purchase/index.ts`) :
- Privilèges **par colonne** sur `profiles` : le client ne peut plus écrire que les colonnes de profil légitimes (prenom, lang, tensions, onboarding, rings…). Les colonnes d'entitlement et de parrainage sont verrouillées. Les policies RLS existantes sont inchangées.
- `credit_referral_on_first_paid` : désormais exécutable **uniquement par service_role**, avec `p_user` explicite (l'ancienne signature est droppée).
- Nouvelle edge function **`confirm-purchase`** : le client l'appelle après achat/restore ; elle **vérifie le paiement à la source via l'API RevenueCat** (clé secrète server-side), puis pose `is_subscriber` / `subscription_expires_at` / `rc_app_user_id` et crédite le parrain. Bonus important : **ça peuple enfin `profiles.is_subscriber` et `rc_app_user_id`**, que RIEN n'alimentait jusqu'ici (le flux TV reposait sur un flag que seul un admin pouvait poser à la main, et le fallback RC de sign-video-url ne se déclenchait jamais faute de `rc_app_user_id`).
- Côté client : `creditReferralOnPaid()` appelle l'edge function (referrals.js), et `App.js` la déclenche après `purchaseSubscription` ET `restoreSubscription` (nouveau `syncEntitlementServerSide()`, fire-and-forget).

**Limites assumées (documentées dans le code)** : pas encore de webhook RC (le vrai fix long terme — renouvellements/résiliations automatiques) ; binding `rc_app_user_id` premier-arrivé-premier-lié (cas de vol d'ID RC avant liaison → déliage manuel support).

## 🟠 Corrigé : le reste

| Fix | Fichier(s) |
|---|---|
| `delete_my_account` cassée (colonne `user_id` inexistante → rejet Apple 5.1.1(v), P0 depuis le 04/06) | migration `20260610100000` (§3) |
| ReferenceError sur « Modifier le profil » → modal bloquée, sauvegarde perdue | `App.js` : `handleProfileSetupSave` passé en prop `onProfileSave` aux 2 `<MainApp>`, + try/catch garantissant la fermeture de la modal |
| Tous les utilisateurs Apple « Masquer mon e-mail » salués « Yvan » | `App.js` (retourne `''`) |
| `<LivingBackground />` rendu 2× dans le modal créer-programme (12 loops + 6 blobs GPU doublés) | `MonCorps.js:883` |
| Sentry DSN littéral `"$VAR"` bundlé en prod | `eas.json` (+ action 4 ci-dessus) |
| Rate-limit poll TV promis depuis mai mais jamais implémenté | migration `20260610100500` (+ `tv-pair/index.ts`) — et le reviewer a attrapé un DoS dans ma 1ère version (stamp avant vérif du secret) : corrigé, le secret est vérifié d'abord |
| TV : un abonné résilié gardait l'accès à vie (`is_subscriber` lu sans expiry) | `App.js` fetchTvSub : check `subscription_expires_at` |
| A11y du disclaimer médical (écran légal) : checkbox invisible pour VoiceOver, app navigable derrière l'overlay | `MedicalDisclaimerOverlay.js` : `accessibilityViewIsModal`, role/state checkbox, role link |

**Note redeem TV (E-5 de l'audit)** : non « corrigé » car c'est inhérent au design — exiger le `tv_secret` au redeem obligerait à le mettre dans le QR, ce qui détruirait la protection du poll contre les photos du QR. Le risque résiduel (confusion de pairage pendant les 5 min de vie du QR, pas de vol de session) est documenté honnêtement dans le commentaire de `tv-pair/index.ts`.

## 🟡 i18n (15 clés ajoutées, parité fr/en vérifiée : 729 = 729)

- `tr.etapes` enfin branchée : chips/badges d'étape traduits (MonCorps, Bibliothèque) — la valeur FR reste la clé interne de filtre.
- Durées EN fausses corrigées : p2[0] `1'59''`, p2[1] `2'29''` (alignées sur FR — un utilisateur EN voyait « 12 min » pour une vidéo de 2 min).
- Badge `NOUVEAU` → `pickBadge(...)` (affiche NEW en EN) ; « Prépare-toi » → `video_get_ready` ; lien « Politique de confidentialité » → clé existante ; ~9 alerts FR (`err_*`) keyées fr/en ; durées des 5 cartes Programmes (`prog_*_duree`) keyées, iPhone + tvOS.
- Découverte au passage : `auth_apple_unavailable` était utilisée dans App.js mais n'existait dans aucune langue — ajoutée.
- Restes signalés non traités (mineurs) : « Respire… on commence. » (VideoPlayer:794), la phrase autour du lien CGU (App.js:1147).

## ✅ Vérifications effectuées

- Review adversariale complète du diff par un agent indépendant (a trouvé : grant `UPDATE(id)` manquant **bloquant**, DoS du rate-limit TV, `.maybeSingle()` bypassable dans confirm-purchase, expiry TV — tous corrigés ensuite).
- Parse Babel OK sur les 8 fichiers JS/JSX modifiés, JSON eas.json valide, parité i18n re-vérifiée programmatiquement.
- `Purchases.getAppUserID()` confirmé dans les typings de react-native-purchases.
- SQL relu : le `drop function` matche bien les 2 anciennes signatures zéro-arg, aucun autre call-site de la RPC dans le code livré, `service_role` non affecté par les REVOKE.

## 📋 Toujours ouvert (depuis l'audit — rien d'urgent cette nuit)

Par ordre de valeur : purpose strings placeholder micro/Reminders (risque rejet à la prochaine soumission), unification de l'auth tripliquée (~700 lignes, dérive CGU réelle), FlatList/memo (0 dans toute l'app), sweep a11y global (top-10 de `audits/AUDIT_A11Y.md`), migration expo-av → expo-video avant SDK 55, assets −2 MB, `.claude/worktrees` = 2,8 GB à purger, `FluidBody.saver` (binaire) à sortir de git, réécrire CLAUDE.md (il décrit une app qui n'existe plus — dangereux pour les futurs agents), webhook RevenueCat, décision Android (pas d'IAP configuré).

Bonne journée ! 🪼
