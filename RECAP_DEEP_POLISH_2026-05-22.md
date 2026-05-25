# FluidBody+ — Récap deep polish session

**Date** : du 21 au 25 mai 2026 (session continue, multiples jours)
**Branche active** : `claude/peaceful-rubin-f662f9` (puis merge sur `main` au commit `63121e5`)
**App version** : 1.0.0
**Build natif actuel** : build #80 (TV) / iPhone TestFlight existant

---

## Section 1 — État final de l'app

### iPhone

Pour vous (mosaïque + intention + citation Sabrina + favoris + Cette semaine + metadata enrichi)
- **Header** : logo FLUIDBODY+ · "Respirer 60s" · "Bonjour Yvan"
- **Tabs capsule glassy** : Pour vous · Explorer · Programmes · 🔍
- **Modal intention quotidienne** au cold-start (5 cards image Sabrina avec icônes SVG)
- **Citation Sabrina du jour** (30 citations en rotation)
- **Mosaïque 7 cards** des piliers
- **"Mes favoris"** rangée (apparaît si ≥ 1 favori)
- **"Cette semaine"** rangée 7 séances avec badge LUN/MAR/... biaisé selon intention
- **Card "Le Pilates conscient, au quotidien"** avec metadata enrichi : "175 séances · 64 h 20 min de pratique · Avec Sabrina"

PilierPanel (vue d'un pilier)
- Hero image pilier + titre
- 5 cards théorie verticales avec badge GRATUIT / + **bouton download lime à droite** quand vidéo dispo
- Sections Préparer / Exécuter / Évoluer (cards visuellement présentes, en attente de vidéos)

Profil (8 entrées)
- Abonnement
- Minuteur
- **Mes téléchargements** (nouvel écran dédié avec liste + tailles + bouton supprimer)
- **Préférences** (nouvel écran : streaming quality, audio background, HD downloads, Wi-Fi only)
- Notifications
- Supprimer mon compte (account deletion conforme Apple 5.1.1(v))

Paywall iPhone (entièrement refait)
- Titre "Rejoins les fondateurs FluidBody+"
- Sous-titre "Le Pilates conscient de Sabrina, sur tous tes écrans."
- Banner **OFFRE FONDATEUR** : "Mensuel 12.90 CHF/mois les 3 premiers mois, puis 24.90. Annuel 99 CHF la 1re année, puis 199."
- 5 bullets sans emojis (9 piliers · iPhone+TV · Sabrina 30 ans · sous-titres FR/EN au lancement · Sabrina IA à venir)
- Prix barrés (24.90 → 12.90 / 199 → 99) + pill verte "Économise 100 CHF la 1re année"
- CTA : "S'abonner"
- Pill garantie : "Annulable depuis Réglages Apple"
- Aucune mention "à vie", aucune comparaison Speir, aucun emoji
- Mécanisme **Sélection gratuite du mois** (séances découverte sans abonnement)

Téléchargements hors-ligne
- Bouton ↓ lime sur chaque séance théorie (TheorieDetailScreen) avec vidéo dispo
- **ActionSheet qualité au tap** : Économique • iPhone (~36 MB) / Standard • iPad (~72 MB) / HD • Apple TV (~144 MB) — choisis selon ton appareil
- État après download : cercle lime ✓
- Long-press cercle = suppression avec confirmation
- Liste centralisée dans Profil > Mes téléchargements
- Lecture **prioritaire depuis fichier local** quand dispo (instantané, fonctionne hors-ligne)
- Format de stockage : v2 hex encoding (XOR → hex sur disque pour éviter corruption UTF-8)
- Pref "Wi-Fi only" prête (nécessite netinfo dans le binaire = build #81+ pour vrai enforcement)

### Apple TV

Header
- Logo FLUIDBODY+ gauche · pill "Respirer 60s" centre · avatar Sabrina + "Bonjour Yvan" droite
- Tabs capsule : Pour vous · Explorer · Programmes · Respiration · 🔍

Fond
- Dégradé navy quasi-noir (#021222 top) → teal/turquoise lumineux (#55BBC9 bottom) — couleurs samplées pixel-près du splash iPhone
- 3 méduses animées (taille 1.4×) + 6 bulles, animation 14-18s
- BlurView glassmorphism partout (cards, tabs, dropdown)

Pour vous TV
- **Layout 2 colonnes Fitness+** : gauche (titre + sous-titre + CTA "Commencer") | droite (mosaïque 3x3 piliers focusable)
- En bas : carrousel "Types d'activités" (9 piliers en cards verticales)

Autres écrans TV
- Explorer : grille 3 colonnes des piliers
- Programmes : hero programme actif + grille 5 thématiques (Réveil, Mal de dos, Post-travail, Core, Souplesse) + carrousel "Séances courtes" + carte "À propos de Sabrina" + card mauve "Programme personnalisé"
- PilierPanelTV : hero 42% hauteur + grille 3 colonnes des séances avec badges étape
- Bibliothèque, Activité, Résumé : versions TV dédiées
- Respiration : modal avec animation BreathRing + 9 méduses + 15 bulles foreground méditatives
- Recherche : TextInput + grille 3-col résultats

Apple TV n'a aucun paywall (pairing iPhone → l'utilisateur est déjà abonné).

---

## Section 2 — Architecture et utils créés

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `src/utils/iap.js` | Source de vérité IAP (3 phases founder/intermediate/standard) + savings calculations |
| `src/utils/downloadsCache.js` | Cache + pub/sub réactif autour de DownloadManager |
| `src/utils/favorites.js` (étendu) | Synchrone cache + subscribe pour rerender live |
| `src/utils/sessionBadges.js` | `pickBadge(ctx)` retournant Nouveau / Programme / Favori / Reprendre |
| `src/utils/weeklySchedule.js` | `getThisWeekSchedule()` algorithme intelligent 7 jours |
| `src/utils/dailyIntention.js` | Persist + restore l'intention du jour (Calme/Énergique/Ancré/Souple/Léger) |
| `src/utils/reflections.js` | Post-session emoji reflection storage |
| `src/utils/streakMilestones.js` | Détection palier streak (3/7/14/21/30/50/100) |
| `src/utils/userPreferences.js` | Storage + pub/sub des 4 prefs utilisateur |
| `src/utils/withTimeout.js` | Util partagé : Promise.race avec timeout |
| `src/utils/tvImagePool.js` | Rotation déterministe de 33 visuels (9 piliers + 6 programmes + 17 Sabrina + 1 unsplash) |
| `src/constants/sabrinaQuotes.js` | 30 citations en rotation quotidienne |
| `src/components/FluidbodyLogo.js` | Composant logo réutilisable iPhone/TV |
| `src/components/DownloadButton.js` | Bouton circulaire glass + état progression |
| `src/components/Skeleton.js` | Loader shimmer pour video signing |
| `src/components/SeanceCarouselRow.js` | Carrousel iPhone réutilisable (Mes favoris / Cette semaine) |
| `src/components/tv/AquaticBackground.js` | (refactor) gradient + drifters séparés |
| `src/components/tv/TVTopBar.js` | (deprecated) ancien header hamburger |
| `src/components/tv/TVHeaderBar.js` | Nouveau header style iPhone (logo + tabs capsule) |
| `src/components/tv/TVMenuDropdown.js` | (deprecated) dropdown hamburger |
| `src/components/tv/HeroFeatured.js` | Hero Pour vous TV |
| `src/components/tv/HorizontalCarousel.js` | Carrousel TV avec dots pagination |
| `src/components/tv/TVCard16x9.js` | Card 16:9 focusable (scale 1.10 + glow + ring blanc) |
| `src/components/tv/SessionBadge.js` | Pill badge (Nouveau, Favori, Programme...) |
| `src/components/tv/TwoColLandingTV.js` | Layout 2 colonnes Pour vous TV |
| `src/components/tv/PilierPanelTV.js` | Vue pilier TV (séparée de PilierPanel iPhone) |
| `src/components/tv/ExplorerTV.js` | Grille 3-col piliers TV |
| `src/components/tv/ProgrammesTV.js` | Programmes TV (hero + cards) |
| `src/components/tv/RechercheTV.js` | Recherche TV |
| `src/components/tv/StatsTV.js` | Activité/Résumé TV (tuiles glassy) |
| `src/components/tv/BibliothequeTV.js` | Biblio TV (grille piliers avec progression) |
| `src/screens/Preferences.js` | Écran préférences utilisateur (4 toggles + picker) |
| `src/screens/MesTelechargements.js` | Liste téléchargements + suppression |
| `assets/coach/avatar.jpg` | Avatar Sabrina circulaire (480×480) |
| `assets/coach/sabrina_1.jpg → sabrina_17.jpg` | 17 photos studio Sabrina (1920×1080) |
| `assets/coach/meduses_blue.jpg` | Photo méduses (non utilisée actuellement, gardée en réserve) |

### Modifications notables sur fichiers existants

- `App.js` : multitude de wirings (modal Intention, Préférences, MesTelechargements, etc.) + retrait flag `TEMP_UNLOCKED` + DIAGNOSTIC=false + ADMIN_EMAILS allégé
- `src/utils.js` : `getThisWeekSchedule`, `getResumableSession`, parsers durée multi-format, retrait TEMP_UNLOCKED
- `src/screens/MonCorps.js` : énormes ajouts iPhone et branche TV (favoris, Cette semaine, intentions, etc.)
- `src/screens/Profil.js` : nouvelles rows Préférences + Mes téléchargements
- `src/screens/TheorieDetailScreen.js` : intégration boutons download
- `src/screens/AuthScreen.js`, `OnboardingScreen.js`, `SignInScreen.js` : timeouts 15s sur Supabase + 45s sur Apple Sign-In
- `src/components/PaywallModal.js` : refonte complète (founder pricing, sans emoji, sans Speir, sans à vie)
- `src/components/VideoPlayer.js` : auto-prefer local file, JWT refresh sur 401, pref backgroundAudio
- `src/components/DownloadManager.js` : import `expo-file-system/legacy` (fix SDK 54 deprecation), format v2 hex encoding
- `src/utils/videoUrl.js` : retry sur 401, support quality param
- `supabase/functions/sign-video-url/index.ts` : accepte param quality (mapping commenté en attendant variants Bunny)
- `eas.json` : ajout env `EXPO_PUBLIC_SENTRY_DSN` dans profile production
- `app.json` : ajout `NSPhotoLibraryUsageDescription` defensive
- `package.json` : ajout `@react-native-community/netinfo`

---

## Section 3 — OTAs publiés cette session

(Tous sur runtimeVersion 1.0.0, avec `--environment production`)

### iPhone (canal `production`)

| Update Group ID | Description |
|---|---|
| `ce996fbe-b836-4cb8-b5b0-34934a9ab6cb` | 5 polish features (intention/reflection/streak/quote/skeleton) |
| `9d5567be-93f0-42e1-990b-22aef61cfb73` | Header iPhone style + glassmorphism + focus tvOS |
| `dacce1cd-98bf-4f04-aa93-a5fec6dfeeba` | FluidbodyLogo shared |
| `7920638a-9eef-446c-9de0-5fb72890129e` | Badges + Mes favoris + Cette semaine + hero metadata iPhone |
| `86739cd3-d46b-4514-bc5d-133d5a73dd28` | Fix counter "0 séances" |
| `73b10b99-eac1-4306-bd20-eb76fe8cbbb0` | Soften founder urgency wording |
| `bed18586-738b-4b2e-902f-49973e1feef1` | Remove free trial 7 jours |
| `b49983a4-38d4-4f92-ad00-1a87637a7508` | Paywall polish classy/pure |
| `859887cd-8ab2-4875-bd50-3d6c09823508` | Founder pricing structure |
| `6fc10ed1-37da-4db2-ae0c-1bd29771ed08` | Downloads UI iPhone |
| `c9edc7bc-3549-4485-8369-16fcf77ddb25` | PilierEducation download buttons |
| `3c8fa3e0-a7b6-4834-8123-7228c38fc037` | TheorieDetailScreen download buttons |
| `5177dd92-5bc6-42b6-8719-72512b98e796` | Touch isolation + Alert errors |
| `6d4f8620-200c-4606-8f99-22acbd9e2b34` | Fix expo-file-system legacy |
| `0d1894bf-aa8f-449b-a988-bd6ce8877682` | Fix split('|') decryption |
| `eb47e003-5df8-43f4-886d-472ae5be7767` | Format v2 hex encoding |
| `6e393960-ece1-4602-862c-0fb5ea5ebca8` | Mes téléchargements dans Profil + quality menu |
| `d3cffc72-e79d-4f4d-8c42-c06430dad7b4` | Quality menu device-guided |
| `665457a7-6ef1-4984-bcc8-d7424374ab1a` | Préférences user (streaming/HD/Wi-Fi/audio bg) |
| `ab04c684-f6d4-4b51-92af-d1e690b1728b` | Audit fixes (TEMP_UNLOCKED, DIAG, RC logout, admin emails) |
| `7399744c-5ab7-466b-ab63-a370a27d3c87` | Fix introShown — plus de re-login à chaque ouverture |

### Apple TV (canal `production-tv`)

| Update Group ID | Description |
|---|---|
| (multiples updates au cours de la session) | Header iPhone-style, fond turquoise/méduses, glassmorphism, badges, Mes favoris, Cette semaine, Sabrina photos integration, Respiration tab, Programmes recentré, etc. |
| Dernier en date pour TV | À tracer via `eas update:list --channel production-tv` |

---

## Section 4 — Pending TODO pour Yvan

### Avant la soumission App Store (bloquants)

- [ ] **Définir `EXPO_PUBLIC_SENTRY_DSN`** dans EAS Environments (web dashboard ou `eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value "..."`)
- [ ] **Créer `admin@fluidbody.ch`** (email dédié pour le compte demo App Store review)
- [ ] **Configurer Introductory Offers dans App Store Connect** pour `com.fluidbody.app.premium.monthly` et `.yearly` (3 mois à 12.90 / 1 an à 99 CHF) — sans Free Trial !
- [ ] **Activer la plateforme tvOS sur la fiche App Store Connect** si pas encore fait (sinon Apple rejette les binaires tvOS)
- [ ] **Lancer un nouveau build prod** : `eas build --profile production --platform ios` (inclura netinfo + Sentry DSN injecté)
- [ ] **Tester le build TestFlight** sur device :
  - [ ] Sentry capture un crash JS volontaire
  - [ ] Restore Purchases sur fresh install
  - [ ] Account deletion bout en bout (Supabase + RC purges)
  - [ ] Privacy relay Apple Sign-In
  - [ ] HealthKit refus → app continue
  - [ ] Mode avion sur séance non-DL → message clair (pas spinner)
  - [ ] Wi-Fi only download blocking (cellular)
  - [ ] Multi-langue FR + EN switch dans Réglages iPhone
- [ ] **Préparer metadata App Store Connect** : screenshots iPhone 6.7"/6.5"/5.5", age rating 4+, demo account credentials, TOS, Privacy Policy URLs valides, version notes 1.0.0

### Backend (à terme)

- [ ] **Bunny CDN variants** : encoder play_480p.mp4 et play_1080p.mp4 pour servir les 3 qualités. Sinon les 3 choix utilisateur retournent le même fichier.
- [ ] **Déployer `sign-video-url` mise à jour** : `supabase functions deploy sign-video-url` pour activer le param `quality` (lignes commentées dans le code à décommenter)
- [ ] **Configurer rate limiting / quotas Bunny** pour éviter scraping

### Contenu (le grand chantier de Yvan)

- [ ] Filmer les séances pratiques (Préparer / Exécuter / Évoluer pour les 9 piliers) — actuellement 3 vidéos production
- [ ] Créer images haute résolution (1920px+) pour les 9 piliers (les images actuelles font ~800px et sont molles sur 65")
- [ ] Si possible, photos individuelles par séance (vs réutiliser les images de pilier)

### Améliorations futures (nice-to-haves)

- [ ] Sabrina IA (mentionnée dans le paywall comme "à venir") — chatbot conseil ou recommandation personnalisée
- [ ] Apple Watch BPM intégration en temps réel pendant séance (code existe partiellement)
- [ ] Live Activities iOS (timer de séance sur lock screen)
- [ ] Push notifications de rappel quotidien
- [ ] Multi-langue : ajouter ES + IT (FR + EN actifs)
- [ ] Subtitles VTT pour les vidéos (FR + EN)
- [ ] Onglet Recherche sur TV à enrichir (filtres par durée, étape, etc.)
- [ ] DRM réel sur les downloads (remplacer XOR placeholder par expo-secure-store + key per user)

---

## Section 5 — Limites connues / risques

### Téléchargements
- **Encryption XOR + clé dérivée** : casual-tamper deterrent, **pas du DRM**. Suffisant pour 99% des usages mais un tech-savvy user pourrait extraire les fichiers. À muscler avec expo-secure-store si Yvan prend du volume.
- **Stockage Library/Caches** : iOS peut purger ce dossier sous pression mémoire. Les fichiers téléchargés peuvent disparaître. Si problème en pratique, basculer vers `Library/Application Support/` pour persistance garantie.
- **netinfo** ajouté côté `package.json` mais pas encore dans un binaire natif. **Tant que Yvan n'a pas lancé un build #81+, la pref "Wi-Fi only" est cosmétique**.

### Paywall et IAP
- Les **introductory offers** doivent être configurées côté App Store Connect pour que le 3 mois / 1re année soit vraiment appliqué. Le code n'est qu'une promesse — c'est l'IAP product config qui contracte.
- Le 500 premiers membres a été retiré de l'UI. Si Yvan veut le réactiver, juste re-mettre l'interpolation dans `paywall_founder_urgency` data.js.

### Backend Bunny
- L'edge function `sign-video-url` retourne **le même fichier 720p pour toutes les qualités demandées**. Les variants 480p/1080p ne sont pas encore encodés. L'UI marche dès maintenant, le backend suit quand Yvan configurera Bunny.

### TV
- L'app TV est **toujours dépendante du pairing iPhone**. Si l'utilisateur n'a jamais ouvert l'app sur iPhone, il ne peut pas pairer. Pas un bug mais à savoir pour le marketing.
- Les téléchargements ne sont **pas disponibles sur TV** (uniquement streaming). L'Apple TV n'aime pas le stockage local pour ce type d'usage.

### Account deletion
- La fonction Supabase RPC `delete_my_account` doit exister côté backend pour que le bouton fonctionne réellement. Si non déployée, le delete UI marche mais ne purge pas réellement Supabase.

---

## Section 6 — Pointers utiles pour les futures sessions

### Configs critiques
- **Sentry DSN** : à mettre dans EAS Environments + dans `eas.json` ref `${EXPO_PUBLIC_SENTRY_DSN}` au profile production
- **Supabase URL** : déjà inliné automatiquement quand on push avec `--environment production`
- **Bunny Token Auth** : géré via edge function, clés dans Supabase functions secrets
- **RevenueCat API keys** : dans `.env` (EXPO_PUBLIC_RC_API_KEY_IOS) + EAS Environments

### Commandes utiles
```bash
# Build natif iPhone
eas build --profile production --platform ios

# Build natif TV
EXPO_TV=1 eas build --profile production-tv --platform ios

# OTA iPhone
eas update --channel production --environment production --message "..."

# OTA TV
eas update --channel production-tv --environment production --message "..."

# Submit App Store
eas submit --profile production --platform ios

# Soumettre TV (Transporter requis)
# Télécharger l'.ipa depuis Expo, ouvrir Transporter, drag-drop, Distribuer
```

### Outils backend
```bash
# Déployer edge function
supabase functions deploy sign-video-url

# Migrer DB
supabase db push
```

### Stratégie pricing (validée)
- **Phase 1 — Founder** (actuel) : 12.90 CHF/mois les 3 premiers mois, puis 24.90 / 99 CHF la 1re année, puis 199
- **Phase 2 — Intermédiaire** (à venir) : 17.90 / 149 (relance marketing)
- **Phase 3 — Standard** : 24.90 / 199 (régime de croisière)
- Modèle Apple IAP exclusivement (pas de Stripe web). Conscient du -30% Apple mais privilégie conversion + UX premium.

### Modèle pairing TV
- TV utilise le compte iPhone via QR pairing (edge function `tv-pair`)
- Pas de paywall sur TV (l'utilisateur est déjà abonné via iPhone)
- "Un seul abonnement, deux écrans" est le narratif

---

## Section 7 — Dernière action en cours

Au moment de cette sauvegarde :
- **Commit `63121e5` sur main** : `@react-native-community/netinfo` ajouté pour l'enforcement Wi-Fi
- **Prochain step** : `eas build --profile production --platform ios` (qui produira le build #81 ou supérieur)
- Après le build : tester sur TestFlight, valider la checklist pré-submit, puis `eas submit`

---

*Sauvegarde générée le 25 mai 2026. Pour reprendre, lire ce fichier et examiner les fichiers cités. Tout le code est en place, il manque principalement les actions OOB de Yvan (Sentry DSN, admin email, ASC config) et un build natif.*
