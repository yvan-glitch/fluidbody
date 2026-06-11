# Audit sécurité — Fluidbody

**Date** : 2026-06-04
**Scope** : repo `/Users/xvan06/fluidbody` (app React Native + Expo SDK 54, Supabase edge functions, migrations Postgres)
**Méthode** : revue statique du code, historique git complet, configuration EAS/Expo, migrations RLS, edge functions Bunny + tv-pair
**Auditeur** : Claude (sub-agent)

---

## Résumé

**Verdict global : posture solide, 1 bug fonctionnel bloquant, 3 gaps mineurs à durcir.**

L'app applique systématiquement les bons réflexes :

- Bunny CDN derrière une edge function `sign-video-url` qui vérifie JWT + entitlement avant de minter un Token-Auth URL TTL 30 min — aucun GUID Bunny n'est bundlé côté client (purgé en mai 2026, cf. migration `20260511000000_video_security.sql`).
- RLS activée sur 100 % des tables sensibles (`profiles`, `video_assets`, `audio_assets`, `tv_pairings`, `user_programs`, `user_favorites`). Tables backend-only (`video_assets`, `audio_assets`, `tv_pairings`) sont en deny-by-default (RLS on, zéro policy → seul service_role lit).
- Sentry `beforeSend` strippe email/IP/username avant envoi (`App.js:24-31`).
- 100 % des `console.*` du code applicatif sont gated derrière `__DEV__`, `devLog`, `devWarn` ou un flag de diagnostic explicite.
- Pas de `EXPO_PUBLIC_*` exposant un secret côté client (toutes les variables sont des clés publiques par design : anon Supabase, RC SDK iOS public, DSN Sentry, Google OAuth client IDs).
- Pas de domaine externe non whitelisté dans les `fetch()` du code applicatif.

**1 issue critique fonctionnelle** : `delete_my_account` référence une colonne `tv_pairings.user_id` qui n'existe pas → la RPC Apple-required va échouer si `tv_pairings` est présent en prod (cf. issue HIGH-1).

| Sévérité | Compte |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 3 |
| Low | 3 |
| Info / positif | nombreux |

---

## Findings

| # | Sévérité | Fichier:ligne | Description | Recommandation |
|---|---|---|---|---|
| H-1 | **High** | `supabase/migrations/20260521000000_delete_account.sql:71` | `delete from public.tv_pairings where user_id = $1 or redeemed_user_id = $1` — la colonne `user_id` n'existe pas dans `tv_pairings` (schéma : `nonce, tv_secret, expires_at, redeemed_user_id, …` cf. migration `20260518000000_tv_pairings.sql`). Conséquence : sur tout environnement qui a déployé `tv_pairings`, l'appel `delete_my_account()` jette une exception Postgres (`column "user_id" does not exist`), bloquant la suppression de compte. Apple 5.1.1(v) est cassé. | Remplacer la clause par `delete from public.tv_pairings where redeemed_user_id = $1`. Tester en supprimant un compte qui a pairé une TV. |
| M-1 | Medium | `supabase/functions/tv-pair/index.ts:27` (commentaire) vs `handlePoll` 165-224 | Le commentaire promet un rate-limit poll à 1 req/sec/nonce (`vérif last_poll_at lazy`) — non implémenté. La table `tv_pairings` n'a pas de colonne `last_poll_at` et `handlePoll` n'enforce rien. Un attaquant qui devine un nonce + tv_secret peut hammer la fonction. L'impact réel est limité (tv_secret = 80 bits d'entropie, fenêtre 5 min, anti-rejeu via `consumed_at`), mais le code ment au lecteur. | Soit implémenter (colonne `last_poll_at timestamptz`, refus si `now() - last_poll_at < 1s`), soit retirer la mention. Bonus : ajouter rate-limit côté Edge function via Deno KV ou un compteur in-memory simple. |
| M-2 | Medium | historique git (commits `00396e1` et antérieurs, déplacé hors code par `6c7bdad`) | Une clé Supabase `anon` JWT (rôle `anon`, projet `ctvtjeidkqpdsmhsjsij`) ainsi qu'une clé RevenueCat iOS publique (`appl_*`) ont été hardcodées dans `App.js` avant d'être déplacées vers `process.env.EXPO_PUBLIC_*`. Elles RESTENT dans l'historique git. Risque : la clé anon est publique par design (protégée par RLS), donc l'impact réel est faible — mais cela permet d'identifier le projet Supabase exact et d'attaquer la RLS si une nouvelle table sans policy était introduite. | Évaluation à froid : pas besoin de rewrite l'historique (l'anon est publique, RLS bien faite). Mais : (a) auditer régulièrement les nouvelles tables pour confirmer la RLS ; (b) considérer une rotation du projet Supabase si le repo devient public un jour ; (c) ne JAMAIS commit un secret server-only (`service_role`, `BUNNY_TOKEN_KEY`, `REVENUECAT_SECRET_API_KEY`) — l'historique en serait irrécupérable. |
| M-3 | Medium | `supabase/functions/tv-pair/index.ts:165-224` | L'edge function tv-pair `poll` retourne `access_token` + `refresh_token` en clair sur n'importe quel canal HTTPS, et **un seul** `tv_secret` à 80 bits protège le poll. Si l'attaquant fait le man-in-the-middle entre Apple TV et Supabase (pas trivial, ATS strict côté iPhone mais pas vérifiable pour TV non-jailbreak) il peut drainer la session. Mitigations en place : TTL 5 min, anti-rejeu, secret jamais transmis au client iPhone. Risque résiduel : faible. | Acceptable en l'état. Pour aller plus loin : binder le `refresh_token` à un fingerprint de device TV (UDID hashé) côté edge, refuser si différent ; ou : forcer un nouveau login iPhone après 30 jours côté TV (déjà sans doute le cas via Supabase refresh expiry). |
| L-1 | Low | `src/components/DownloadManager.js:22` | `ENCRYPTION_SEED` constant et dérivable depuis le bundle JS — documenté comme placeholder anti-tampering, pas DRM. Pas une issue tant que le label "casual tamper deterrent" reste affiché à qui touche au code. | Quand le contenu deviendra business-critical (= quand Sabrina aura tourné les 6 piliers complets), remplacer par `expo-secure-store` + clé dérivée par-user. Tracker comme dette technique. |
| L-2 | Low | `app.json:25-34` (NSExceptionDomains) | `NSExceptionDomains` pour `b-cdn.net` et `supabase.co` désactivent partiellement ATS sur ces domaines, ce qui est nécessaire mais à surveiller : `NSIncludesSubdomains: true` couvre tout sous-domaine pull-zone Bunny, donc un sous-domaine compromis ou typo (`b-cdn.net` est un domaine partagé entre tous les clients Bunny) reste accessible. Risque : faible (Bunny TLS valide). | Préciser le host exact si possible : `vz-1a4e2cac-0dc.b-cdn.net` au lieu du wildcard. Réduit la surface d'attaque si un autre client Bunny CDN est compromis et accède au cert TLS. |
| L-3 | Low | `supabase/migrations/20260513000000_referrals.sql` | Le commentaire dit explicitement « aucune protection fraude (rate-limit, IP, email check) — modèle organique avec ~100 utilisateurs ». Si le programme parrainage scale (recalibré 2026-06-05 : +7 jours au parrain), un attaquant peut générer N comptes burner pour farmer les jours gratuits. | Risque accepté à 100 utilisateurs ; à durcir dès qu'on dépasse ~500. Suggestion : webhook RevenueCat → edge function avec idempotence sur `transaction_id` Apple (déjà mentionné comme TODO dans le code) + soft cap `referrals_count <= 10` par mois. |

---

## Ce qui est CORRECT (mention positive)

**Architecture vidéo premium** :
- `supabase/functions/sign-video-url/index.ts` : vérifie JWT, regex strict sur `session_id` (`/^[a-z0-9]+_\d+$/i`), entitlement à 3 niveaux (admin email → cache `profiles.is_subscriber` avec expiration → fallback live RevenueCat), TTL signed URL 30 min, secret `BUNNY_TOKEN_KEY` jamais renvoyé au client. Logique séance 0 gratuite cohérente avec `src/utils.js:38-47` (`canAccessSeanceIndex`).
- `src/utils/videoUrl.js` : cache in-memory avec re-sign 1 min avant expiry, coalescing des requêtes concurrentes, retry une fois sur 401 via `supabase.auth.refreshSession()`. Aucune URL Bunny brute bundlée.

**RLS Postgres** :
- `profiles` : trois policies `auth.uid() = id` pour SELECT/INSERT/UPDATE.
- `user_programs`, `user_favorites` : policy "ALL" avec `auth.uid() = user_id`.
- `video_assets`, `audio_assets`, `tv_pairings` : RLS activée, zéro policy → seul service_role peut lire (commentaires explicites en SQL).
- `delete_my_account` : `SECURITY DEFINER`, `set search_path = public, auth`, opère uniquement sur `auth.uid()`, REVOKE explicite sur `public`/`anon`, GRANT sur `authenticated` uniquement.
- Fonctions de référence : `SECURITY DEFINER` + `set search_path` partout, vérification `auth.uid()` au début, JSON return sans throw.

**Identification & secrets** :
- `.gitignore` : couvre `.env`, `credentials.json`, `KEY/`, `*.p8`, `*.p12`, `.mobileprovision`, `*.jks`. Vérifié : ces fichiers existent localement (`KEY/AuthKey_X884KDJ2RA.p8`, `credentials.json`) mais ne sont pas trackés.
- `app.json` : aucun secret server-only exposé ; seules les clés publiques transitent via `EXPO_PUBLIC_*`.
- `app.config.js` : structure propre, plugins conditionnels EXPO_TV.

**ATS / Réseau** :
- `NSAppTransportSecurity.NSAllowsArbitraryLoads = false`. Exceptions explicitement bornées à `b-cdn.net` et `supabase.co` avec `NSExceptionAllowsInsecureHTTPLoads: false`.
- Aucun fetch externe non-whitelist dans le code applicatif (recherche exhaustive : seul VTT subtitles via signed Bunny URL et tv-pair vers Supabase).

**Sentry / PII** :
- `beforeSend` strippe `email`, `ip_address`, `username` (`App.js:24-31`).
- `Sentry.setUser({ id })` uniquement, pas de profil complet (`App.js:2615-2618`).
- `tracesSampleRate: 0` (aucune trace performance).
- Production logs gated : `if (!__DEV__)` avec global handler qui envoie à Sentry et affiche un message générique sans stack.

**Apple compliance** :
- Privacy manifest (NSPrivacyAccessedAPITypes) déclaré pour FileTimestamp, UserDefaults, SystemBootTime, DiskSpace.
- NSPrivacyCollectedDataTypes : email, name, userID, health, fitness, purchaseHistory déclarés, tous avec `Tracking: false`.
- `NSPrivacyTracking: false`, `NSPrivacyTrackingDomains: []`.
- `delete_my_account` RPC en place (modulo bug HIGH-1).

**IAP / Paywall** :
- Pas de bypass paywall détectable : `canAccessSeanceIndex` côté client miroir de l'edge function (séance 0 gratuite + théorie "Comprendre"/"Ressentir" libre). RevenueCat est l'oracle de souscription, pas d'overrides hardcodés.
- Prix fallback (`CHF 12.90` / `CHF 99.00`) cohérents avec la stratégie founder mémorisée. Aucune contradiction avec App Store Connect.
- `PRODUCT_IDS` = `com.fluidbody.app.premium.{monthly,yearly}` (canonique).

**Logs production** :
- 0 `console.*` non-gated trouvé dans le code applicatif. Tous les loggers (`devLog`, `devWarn`, `safeNativeCall.diag`) sont protégés par `__DEV__` ou un flag explicite (`DIAGNOSTIC_NATIVE_CALLS = false`).

**Apple TV pairing** :
- `tv_secret` 16 chars d'alphabet 32-symboles = ~80 bits d'entropie, `crypto.getRandomValues` côté Deno.
- Nonce 12 chars = ~60 bits.
- Tokens nulled au premier poll réussi (`consumed_at`), anti-rejeu robuste.
- `tv-pair/poll` : ne révèle pas la cause précise d'un échec (`not-found` pour mauvais secret ET pour nonce inconnu) → pas d'oracle de discrimination.

---

## Notes opérationnelles

- Aucune modification effectuée. Audit pur.
- Le repo a un dossier `audits/` qui était vide ; ce rapport est le premier fichier qui y atterrit.
- Plusieurs documents d'audit précédents existent à la racine (`AUDIT_NIGHT_2026-05-31.md`, `AUDIT_APP_NIGHT.md`, `AUDIT_SECU_FLUIDITE_CODEMORT_2026-06-03.md`) — ce rapport est focalisé sécurité et complète plutôt que remplacer.
- Pas de Stripe webhook dans ce repo : l'app utilise Apple IAP via RevenueCat exclusivement. Un futur RevenueCat webhook handler (mentionné comme TBD dans `supabase/README.md:90`) devra vérifier la signature `Authorization` HMAC RevenueCat avant traitement.

---

## Action prioritaire

1. **Fixer HIGH-1** : corriger `delete_my_account` migration → patch SQL one-liner, ré-appliquer via `supabase db push`. Sans ça, la suppression de compte casse côté prod et Apple peut rejeter une mise à jour future si le bug est signalé.
2. Décider sur MEDIUM-1 : implémenter le rate-limit poll TV ou retirer la promesse du commentaire.
3. Confirmer que les futurs schémas ajoutent toujours une policy RLS explicite (lint check possible via Supabase advisor).
