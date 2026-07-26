# Audit sécurité et polish, 26 juillet 2026

Audit complet mené par 4 passes parallèles : secrets et hygiène du repo, Supabase (RLS, edge functions, migrations), client React Native (crypto, auth, stockage, logs), et polish (lint, tests, i18n, cohérence produit). Ce document liste ce qui a été corrigé aujourd'hui, ce que tu dois vérifier ou déployer toi-même, et ce qui reste à décider.

Verdict global : aucun secret serveur dans le code, RLS `profiles` verrouillée correctement (colonnes d'abonnement inécrivables par le client), edge function `sign-video-url` solide (validation stricte, JWT vérifié serveur, expiry honorée), crypto v3 saine (CSPRNG, IV par fichier, Keychain). Les problèmes trouvés sont réels mais tous rattrapables.

## Corrigé aujourd'hui (dans le code, committé)

1. **MP4 déchiffrés jamais nettoyés (le point le plus sérieux).** Après chaque lecture hors-ligne, une copie en clair de la vidéo premium restait indéfiniment dans le cache, à côté de son `.enc` chiffré. Ajout d'un sweep au démarrage (`sweepTempVideos`, différé 3 s) qui purge tous les `play_*.mp4` et `dl_temp_*.mp4` des sessions précédentes. Pas de suppression au unmount du player (race avec expo-av, choix documenté conservé).
2. **Traces de debug visibles en prod.** Les deux `Alert` du VideoPlayer qui affichaient `Débug : ...` aux utilisateurs sont maintenant gatés par `__DEV__`.
3. **Déconnexion incomplète.** Au logout (iPhone et TV), le profil caché (prénom, date de naissance, poids, taille, genre) et la file de sync en attente sont maintenant purgés (`clearCachedProfile`). Avant, sur un appareil partagé, le compte suivant héritait des données du précédent, et la file pending pouvait pousser les données de l'ancien compte dans le nouveau profil.
4. **Badge « Bientôt » erroné sur p9_5.** `isComingSoon` retourne maintenant false pour toute séance p9 qui a réellement sa vidéo (Réveil hormonal était badgée « Bientôt » alors que sa vidéo est en prod depuis le 25/07). Test ajouté.
5. **Race sur la clé de chiffrement.** `getOrCreateKey` mémoïse la promesse en cours : deux appels concurrents ne peuvent plus générer deux clés dont la seconde écrasait la première dans le Keychain (fichier fraîchement chiffré devenu illisible).
6. **tv-pair durci** (effet au prochain déploiement) : les messages d'erreur Postgres bruts (`detail`) ne sont plus renvoyés aux appelants anonymes ; les tokens d'une ligne expirée sont nullés dès le premier poll tardif ; la purge tourne à chaque init (avant : 1 fois sur 10) ; nouvelle migration qui nulle les tokens dès `expires_at` dans la fonction de purge.
7. **RLS de la table `progression`.** La table (créée à la main dans le dashboard, aucune migration) porte l'historique de séances de chaque utilisateur. Nouvelle migration `20260726010000_progression_rls.sql` : RLS + policy own-only, idempotente.
8. **Hygiène du repo.** `eas-local-build.log` et `eas-last-builds.json` (Apple ID perso dedans) retirés du suivi git ; fichier fantôme `.fuse_hidden...` (copie périmée de SeanceCompleteTV trackée par erreur) retiré ; règles `.gitignore` ajoutées (`eas-*.log`, `.fuse_hidden*`).
9. **Polish.** Message d'erreur audio anglais « Coming soon » remplacé par « Not available yet » (un échec de connexion s'affichait comme une feature à venir) ; double déclaration `var cached` dans App.js dédoublonnée ; imports morts retirés de PaywallModal.

## À faire par toi (vérifications et déploiements)

1. **Vérifier que le lockdown du 10/06 est bien appliqué en prod** (le point le plus important de tout l'audit). Dans le SQL Editor Supabase :
   `select column_name from information_schema.column_privileges where table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE';`
   Si `is_subscriber` apparaît dans le résultat, n'importe quel compte gratuit peut se donner l'abonnement : lancer immédiatement `supabase db push`.
2. **Déployer les 3 migrations en attente** : `supabase db push` (video_assets_public_list du matin, progression_rls, tv_pairings_purge_tokens).
3. **Redéployer les edge functions modifiées** : `supabase functions deploy sign-video-url` (en attente depuis le 25/07 pour la sélection gratuite 2 vidéos) et `supabase functions deploy tv-pair` (durcissements du jour).
4. **Historique git : un .ipa de 45 Mo** (build-1784977327664.ipa) est resté dans les objets git et est poussé sur GitHub. Aucun secret exploitable dedans, mais chaque clone le télécharge. Si tu veux purger : `git filter-repo --path build-1784977327664.ipa --invert-paths` puis force push (à faire un jour calme, réécrit l'historique). Acceptable de ne rien faire tant que le repo reste privé.
5. **`npm audit fix`** au prochain cycle : 34 vulnérabilités dans la toolchain de build (2 critical), aucune dans le code embarqué sur l'appareil.
6. **App Privacy / politique de confidentialité** : le préremplissage d'onboarding envoie poids, taille, date de naissance et sexe (lus depuis HealthKit, validés par l'utilisateur) dans la table `profiles`. À déclarer dans la fiche App Privacy (« Health & Fitness » collecté) avant la soumission App Store.

## À décider (pas de correctif sans ton arbitrage)

1. **Divergence gratuité client/serveur.** Le client rend gratuite toute la théorie (Comprendre/Ressentir), le serveur ne libère que l'index 0 et la sélection du mois. Cas concret : p2_1 apparaît déverrouillée mais le serveur répond 403. Pas de perte de revenu (le serveur est plus strict), mais bug UX. Soit ouvrir la théorie côté serveur (décision produit), soit resserrer le client.
2. **Apple/Google Sign In sans nonce.** Correctif connu (nonce aléatoire, SHA-256 vers Apple, brut vers Supabase) mais je ne l'ai pas appliqué : toute erreur casserait la connexion et ça doit se tester sur device. À faire ensemble.
3. **confirm-purchase : liaison RevenueCat premier arrivé premier servi.** Fenêtre de détournement théorique avant la première liaison d'un `rc_app_user_id`. Le TODO existe déjà dans le code ; le vrai fix est `Purchases.logIn(supabaseUid)` côté client.
4. **Pairing TV : pas de confirmation à l'écran.** Quelqu'un qui photographie le QR pendant ses 5 minutes peut appairer la TV sur SON compte. Fix simple : afficher le prénom du compte sur la TV avant d'activer la session.
5. **Rate limiting** : aucun sur `sign-video-url`, `tv-pair init` et `confirm-purchase`. Faible urgence à ton échelle, à prévoir avant une vraie audience.
6. **Fallback XOR v2 atteignable en prod** (pas seulement Expo Go) : si le chiffrement AES échoue, le téléchargement retombe sur le XOR legacy. La migration v3 à la première lecture rattrape, mais une retentative différée serait plus propre.
7. **CLAUDE.md dit 4 langues, la réalité est fr/en** (les blocs es/it n'existent pas dans data.js, `SUPPORTED_APP_LANGS = ['fr','en']`, un appareil es/it retombe sur le français). Cohérent dans le code, mais à trancher pour le marketing App Store et le CLAUDE.md.
8. **Dette lint** : 1287 warnings, 0 erreur. 657 `no-var` auto-fixables (`npx eslint --fix`), ~99 deps de hooks à trier, une trentaine d'imports morts dans App.js/MonCorps. Gros diff cosmétique, à faire hors période de tournage.
9. **32 clés `tr.*` référencées mais absentes de T**, toutes protégées par un fallback en dur français ou anglais (ex. « Bientôt » affiché à un anglophone). Liste dans le code en cherchant les `tr.x || '...'`.

## Ce qui est sain (vérifié explicitement)

Aucune clé service_role, Bunny ou RevenueCat secrète dans le code ni dans l'historique ; `.env` jamais commité, `.gitignore` solide ; ATS strict, permissions toutes justifiées, `NSPrivacyTracking: false`. RLS own-only correcte sur profiles, user_programs, user_favorites ; colonnes d'abonnement de `profiles` inécrivables par le client ; `video_assets.bunny_path` inaccessible (la migration du matin n'expose que `session_id`, mécanique de grant par colonne validée). `sign-video-url` : entrées validées par regex stricte, aucun GUID dans le bundle, URLs signées jamais persistées (le token est strippé avant sauvegarde de la position de reprise). Suppression de compte conforme (données Supabase purgées, cascade auth). Crypto v3 : clé CSPRNG 32 octets en Keychain, IV unique par fichier, pas de réutilisation de keystream. Webhook RevenueCat authentifié et fail-closed. Règle onAuthStateChange (pas d'await réseau dans le callback) respectée partout. Pas de WebView, pas d'eval, deep links validés. Sentry sans PII (beforeSend strip email/IP/username, tracesSampleRate 0). Tests : 6 suites, 49 tests verts.
