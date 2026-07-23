# Audit senior complet — FluidBody (2026-07-23)

Objectif fixé par Yvan : fondations ultra-saines et solides, UI/UX cohérente, app « très simple pour le cerveau humain ». Trois audits parallèles (fondations, UX, UI) menés sur tout le code, preuves en fichier:ligne. Le rapport perf du même jour (`AUDIT_PERF_2026-07-23.md`) reste valable et ses correctifs sont déjà appliqués.

## Verdict d'ensemble

L'app a une **excellente colonne vertébrale produit** (gating paywall clair et sain, design system Liquid Glass bien conçu, sécurité vidéo serveur solide, RLS verrouillée) mais souffre de trois maladies typiques d'une app qui a grandi vite : (1) **duplication** — 3 flux d'auth, 2 catalogues, 2 moteurs de recherche, 3 écrans de progression, 2 design systems verre ; (2) **sous-adoption de ses propres fondations** — 1 081 couleurs en dur pour 158 tokens, 0 GlassPressable pour 263 TouchableOpacity, profileSync.js contourné par 8 upserts directs ; (3) **absence de filet** — 0 test, 0 linter, ~236 catch vides silencieux. Rien d'irrécupérable : la plupart des fixes consistent à **converger vers ce qui existe déjà**.

---

## FONDATIONS — constats majeurs

**F1. CRITIQUE — Pas de webhook RevenueCat.** `confirm-purchase` n'est appelée que par le client (App.js:1635/1665) ; résiliations/remboursements ne redescendent jamais → `profiles.is_subscriber` périmé, accès TV maintenu (`expires_at null` = accès indéfini, App.js:1694). TODO explicite dans confirm-purchase/index.ts:121.

**F2. CRITIQUE — Auth tripliquée avec divergence CGU (risque légal).** AuthScreen (App.js:574), OnboardingScreen (App.js:901), SignIn.js — `handleAppleSignIn` ×3, `handleGoogleSignIn` ×3. Seul AuthScreen bloque sur la case CGU ; SignIn.js n'a AUCUNE mention CGU. Selon la porte d'entrée, un compte se crée sans acceptation traçable.

**F3. ÉLEVÉ — expo-av déprécié porte le lecteur vidéo (le produit payant).** VideoPlayer.js:3, Timer.js:11, AudioRitualPlayer.js:39. Le prochain bump SDK casse la lecture. Migrer vers expo-video/expo-audio.

**F4. ÉLEVÉ — ~236 catch vides / 463, 6 captures Sentry.** Les upserts `profiles` échouent en silence (App.js:1029, 1064, SignIn.js:129, 174) : l'utilisateur croit son profil sauvé.

**F5. ÉLEVÉ — 0 test, 0 linter, tsconfig vide.** Tout refactor est aveugle sur une base de 3 000 lignes + flux de paiement.

**F6. ÉLEVÉ — 5 sources de vérité pour l'abonnement.** RC entitlement, `fluid_sub`, `is_subscription_active` (clé morte, écrite jamais relue, App.js:1604), `profiles.is_subscriber`, allowlist admin. 3 effets concurrents font `setIsSubscriber` ; le fetch TV ne pose jamais `false`.

**F7. App.js = 3 049 lignes.** Extractions : AuthScreen (574-899), OnboardingScreen (901-1360), useSubscription (1364+1600-1775+1821-1910), TVMainView, bootstrap (2700-2990). Cible : < 400 lignes.

**F8. 74 clés AsyncStorage sans registre ni versioning** (littéraux éparpillés, `fluidbody_done` hors namespace). **F9.** Upserts Supabase dispersés malgré profileSync.js. **F10.** Doublons GlassButton/GlassCard racine vs ui/. **F11.** var/const et FR/EN mêlés ; `getPiliers(lang)` recalculé sur 20+ sites. **F12.** Allowlist admin dans le bundle client + XOR « DRM » placeholder (assumé) ; aucune clé secrète en dur (bon point).

---

## UX — la charge cognitive

**Carte actuelle** : 5 onglets (FluidBody+ · Activité · Résumé · Biblio · Profil) + 4 sous-onglets dans le premier + ~15 modales racine dont 7 accrochées à Profil.

**U1. 10-12 chemins distincts pour démarrer une séance.** Le cerveau doit apprendre plusieurs modèles pour LA même action.

**U2. Deux moteurs de recherche concurrents** : MonCorps>recherche (MonCorps.js:2118) vs Biblio (Bibliotheque.js:514-521). L'utilisateur ne sait pas où chercher.

**U3. Trois surfaces de progression** : Activité, Résumé, Statistics (modale). Le streak est affiché sur 3 écrans, les badges sur 2 (Activité + modale Achievements).

**U4. Onboarding : ~7-8 écrans/overlays avant la première séance jouable** (Onboarding auth → ProfileOnboarding → zones de tension → HealthKit → WelcomeAnimation → MedicalDisclaimer → CoachWelcome). Trop avant le premier moment de valeur.

**U5. L'onglet catalogue s'appelle « FluidBody+ »** (nom de marque) — ne dit rien de son contenu. **U6.** « Résumé » n'est pas un résumé (c'est un dashboard). **U7.** MonCorps : 4 sous-onglets + 6 sections empilées sur le premier écran vu. **U8.** Badges dupliqués (Activité + modale). **U9.** Culs-de-sac enfouis derrière Profil (SabrinaProfile, Statistics, Téléchargements). **U10.** États vides/chargement incohérents (Resume : aucun ; Biblio/Activité : bien).

**Point sain à ne pas toucher** : le gating paywall (cartes verrouillées opacity 0.4, contenu gratuit découvrable, déclenchement au tap verrouillé / fin de démo) est le meilleur parcours de l'app.

### LA restructuration : 5 onglets → 3

1. **Séances** (MonCorps renommé ; 2 sous-onglets Pour toi / Explorer ; absorbe la recherche unique et la Biblio)
2. **Progrès** (fusion Activité + Résumé ; Statistics = « voir plus » ; Badges + Téléchargements promus ici)
3. **Profil** (compte, coach, préférences, abonnement)

Élimine d'un coup U1, U2, U3, U8 et la moitié de U9.

---

## UI — la cohérence visuelle

Le système (`src/components/ui`, glassTokens, thème) est **bon** — il n'est juste pas utilisé : ~1 081 couleurs en dur vs 158 tokens ; 8 écrans/20 importent useTheme ; 263 TouchableOpacity vs 0 GlassPressable.

**I1. Deux verts de marque** : `#AEEF4D` (token, 235×) vs `#E5FF00` (SignIn, ProgramBuilder, 25×). **I2.** Resume/Biblio/MonCorps quasi sans tokens. **I3.** 26 tailles de police (8→72), cluster 11/12/13/14 interchangeables. **I4.** 27 rayons de bordure dont « 12 » (47×) qui n'est dans aucun token. **I5.** Cartes média reconstruites à la main (26 LinearGradient inline dans MonCorps) → extraire un `MediaCard`. **I6.** Press feedback du DS jamais appliqué aux écrans. **I7.** 8 rouges d'erreur différents ; palette « éléments » redéfinie avec des valeurs divergentes par fichier. **I8.** Accessibilité partielle (labels ~13/20 écrans, contrastes 0.4 sur images). **I9.** 7 poids de police → 3 suffisent (400/600/800). **I10.** Restes de vouvoiement (data.js:1510, MonCorps.js:1700, Profil.js:1644-1648, SabrinaProfile.js:2,119).

### Contrat de tokens (dérivé du dominant existant — pas une nouvelle identité)

Palette : accent `#AEEF4D` · accentDeep `#00BDD0` · text blanc · textSecondary 0.62 · textTertiary 0.4 (≥0.6 sur média) · danger `#FF3B30` unique · elements {eau, air, éther, feu, terre} centralisés.
Typo : 12 / 14 / 16 / 20 / 26 / 34 — poids 400/600/800 — labels uppercase letterSpacing 1.5 fixe.
Rayons : = GLASS_RADII (14/20/24/28/999), bannir les littéraux.
Espacement : échelle 4 pt (4/8/12/16/20/24).
Interaction : GlassPressable partout, cible min 44 pt, accessibilityLabel obligatoire.

---

## PLAN D'ACTION PRIORISÉ

### Phase 0 — Filet de sécurité (préalable à tout, ~1 jour)
1. ESLint + eslint-plugin-react-hooks + prettier ; `no-var`/`prefer-const` en autofix.
2. Jest sur la logique pure (utils/statistics, programs, achievements, canAccessSeanceIndex).

### Phase 1 — Correctness & légal (~2-3 jours)
3. Webhook RevenueCat (F1) — le seul bug qui coûte de l'argent/l'équité d'accès.
4. Auth unifiée avec CGU bloquante partout (F2).
5. Helper `reportError()` (Sentry + toast) sur les I/O critiques (F4).
6. `useSubscription()` unique ; supprimer la clé morte (F6).

### Phase 2 — Simplicité cognitive (~1 semaine, LE chantier « cerveau humain »)
7. 5 onglets → 3 (Séances / Progrès / Profil) ; recherche unique ; badges/stats fusionnés.
8. Onboarding raccourci : prénom + disclaimer médical seulement avant la 1re séance ; profil/HealthKit/coach différés après.
9. Renommages : « Séances », « Progrès » ; tutoiement complet (I10).

### Phase 3 — Cohérence visuelle (~3-4 jours, mécanique)
10. Tuer `#E5FF00`, unifier les rouges, centraliser la palette éléments (I1, I7).
11. Tokens dans Resume/Biblio/MonCorps ; échelle typo 6 crans ; rayons GLASS_RADII (I2-I4, I9).
12. `MediaCard` partagé + GlassPressable (I5, I6) ; EmptyState/Skeleton uniforme (U10).

### Phase 4 — Dette de fond (continu)
13. Migration expo-video/expo-audio (F3). 14. Extraction App.js < 400 lignes (F7). 15. Registre storageKeys + profileSync partout (F8, F9). 16. Dédoublonner Glass* et factoriser phone/TV (F10).

Chaque phase est livrable indépendamment ; les phases 0-1 ne touchent pas l'UI (zéro risque visuel), la phase 2 est celle qui change la vie de l'utilisateur, la phase 3 celle qui rend l'app « cohérente à l'œil ».
