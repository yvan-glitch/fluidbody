# Audit nuit — Sécurité · Fluidité · Code mort (iPhone / iPad / tvOS)
**Nuit du 2 → 3 juin 2026**

Périmètre : les 3 cibles (iPhone, iPad, tvOS) partagent le même code (`App.js` +
`src/`). Tout a donc été audité d'un bloc. Principe directeur : **je n'efface que
ce qui est sûr à 100 %, je signale le reste pour qu'on tranche ensemble.**

---

## ✅ 1. Sécurité — RAS de critique

| Vérification | Résultat |
|---|---|
| Secrets hardcodés dans `src/` / config | **Aucun** |
| `.env` versionné ? | Non — `.gitignore` couvre `.env*`. Seul `.env.example` est tracé (normal). |
| Clés exposées côté client | Uniquement `EXPO_PUBLIC_SUPABASE_URL` + `ANON_KEY` → **c'est correct** (la clé anon est publique par design, protégée par la RLS). |
| Edge functions (`sign-video-url`, `tv-pair`) | Secrets lus via `Deno.env` (jamais bundlés). JWT vérifié (`admin.auth.getUser`), contrôle d'entitlement, URL Bunny signée à TTL court (30 min). **Bien conçu.** |
| JWT / service_role hardcodés | **Aucun** dans le client. |
| `eval`, `new Function`, `dangerouslySetInnerHTML`, `http://` non-TLS | **Aucun.** |
| Logs (`console.*`) | Les 30 occurrences sont **toutes gardées** par `__DEV__` / `devLog` / flag diagnostic `DIAGNOSTIC_NATIVE_CALLS` (= `false` en prod). Pas de fuite de PII. |
| Stockage local | Rien de sensible en clair ajouté par l'app ; la session Supabase est gérée par `supabase-js` (standard). |

**Point d'attention (déjà connu, non bloquant) :** le `xorCrypt` de
`DownloadManager.js` est un *placeholder* anti-bidouille, **pas du vrai chiffrement**
(c'est documenté dans `CLAUDE.md`). À remplacer par `expo-secure-store` avant de le
considérer comme une vraie protection. À noter : il ressort aussi comme **non utilisé**
(voir §3) — donc aujourd'hui le téléchargement n'est même pas « chiffré » du tout.

---

## ✅ 2. Fluidité — bon état, 1 axe d'amélioration

- **`useNativeDriver: false` (13 cas)** → **légitimes** : ils animent largeur /
  couleur / progression (barres, charts, count-up) que le driver natif ne supporte
  pas. Rien à corriger.
- **Focus tvOS** → passé en `spring` cette nuit (cf. recap iPad/tvOS) = ressenti
  plus premium.
- **⚠️ Axe principal — listes non virtualisées.** L'app n'utilise **aucune
  `FlatList`** (133 `ScrollView`). Pour la plupart des sections (bornées) c'est OK,
  mais **2 grilles montent toutes leurs cartes d'un coup** :
  - `MonCorps` onglet *Recherche* (`allResults` = jusqu'à ~180 séances)
  - `Bibliotheque` grille de résultats
  Sur iPad surtout (plus de cartes visibles), ça peut saccader au scroll.
  **Reco :** convertir ces 2 grilles en `FlatList` (`numColumns`, `windowSize`,
  `removeClippedSubviews`). C'est un refacto ciblé que je préfère faire **avec un
  test sur device** plutôt qu'en aveugle cette nuit. À planifier ensemble.

---

## ✅ 3. Code mort

### Fait cette nuit (sûr & vérifié) — 87 imports inutilisés supprimés
Retirés sur **27 fichiers** via un réécriture AST (lignes `import` uniquement).
Détection conservatrice (un symbole n'est retiré que s'il n'apparaît **qu'une fois**,
dans l'import lui-même). **Vérifié : les 124 fichiers parsent, 0 import inutilisé
restant.** Les imports `React` ont été laissés volontairement (inoffensifs, runtime
JSX automatique).

Exemples : `Share`, `useMemo`, `ResizeMode`, `Audio`, `activateKeepAwakeAsync`,
`LogBox` (App.js) ; nombreux imports `react-native-svg` morts ; helpers
`downloadsCache` non utilisés dans `MonCorps`, etc.

### À valider avec toi (NON supprimé) — 42 déclarations de niveau module inutilisées
Détectées par analyse de portée (`@babel/traverse`). Je ne les efface pas seul car
certaines révèlent un **nettoyage d'archi** (composants superseded) qui mérite ton œil.

**A. Données / constantes inertes (suppression très sûre)**
`U_STAR`, `U_SEED`, `U_DROP` (App.js) · `SCALE` (App.js:473 — l'ancien facteur iPad,
remplacé par l'approche colonne centrée d'hier) · `ALL_PRODUCT_IDS` · `styles`
(App.js:3268) · `SW`/`SH` non utilisés dans MyPrograms, HealthKitConnect, TVLoginScreen,
ProfileOnboarding, AnniversaryOverlay, CoachWelcomeOverlay, ProgrammesTV, StatsTV ·
`SABRINA_HERO`, `SABRINA_BEACH`, `U_STAR` (MonCorps) · `ETAPE_COLORS`, `SKIP_BTN`
(VideoPlayer) · `BODY_ZONES` (Resume) · `ICONS` (Bibliotheque) · `GOAL_KEYS`
(ProfileOnboarding) · `SIDE` (ProgrammesTV).

**B. Fonctions / composants inutilisés (à confirmer — peut-être superseded)**
`Progresser` (App.js:593, écran entier) · `ProfileSetupScreen` (App.js:2394) ·
`TabIconMonCorps`, `TabIconProgresser`, `AnimatedFaceIcon`, `streakCountValue` (App.js) ·
`ZoneIcon` (MonCorps:967) · `getStreakStatus`, `getSmartRecommendation` (Resume) ·
`VideoSkipChevrons` (VideoPlayer) · `StretchTimerInline` (Timer) · `TVPaywallView`
(PaywallModal) · `xorCrypt` (DownloadManager — cf. §1) · `trigDate` (notifications).

**C. Garde-fous safe-require — NE PAS toucher**
`HapticsMod`, `ScreenOrientation`, `ViewShot` (App.js) sont des `require` optionnels
volontaires (dégradation gracieuse en Expo Go). À garder.

### Fichiers candidats (NON supprimés)
- `src/components/PilierCard.js` — semble remplacé par des tuiles inline. **Confirmer.**
- `src/constants/audioRituals.js` + `src/components/AudioRitualPlayer.js` — **PAS du
  code mort** : fondation d'une feature planifiée (commit « rituels audio v1.2 »).
  **À garder.**

---

## Vérifications techniques effectuées
- Réécriture des imports : 100 % AST, lignes `import` seulement.
- **Re-parse des 124 fichiers → OK** (aucune erreur de syntaxe).
- Re-scan post-nettoyage → **0 import inutilisé restant**.
- Aucun fichier temporaire laissé dans le repo.

## Statut Git
Tout est **non commité**, prêt pour ta relecture (`git diff`). Inclut aussi les
correctifs iPad + le polish focus tvOS d'hier.

## Pour notre point demain
1. Je te lis la liste B/C ci-dessus → tu dis go/no-go et j'efface en un coup.
2. On planifie la virtualisation des 2 grilles (FlatList) avec un test iPad.
3. Si tu veux, je remplace le `xorCrypt` placeholder par `expo-secure-store`.

Bon repos 🌙
