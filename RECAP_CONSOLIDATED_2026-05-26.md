# FluidBody+ — Récap consolidé après merge

**Date** : 26 mai 2026 (mis à jour en soirée)
**Branche `main`** : commit `9f64c2d` (post-merge + Profil reorg + Achievements + Icons SVG + tab MonCorps text-only)
**App version** : 1.0.0
**Build natif en TestFlight** : #83 (soumis le 25 mai)

---

## 🌐 Site web FluidBody+ (déployé 26 mai après-midi)

**URL prod** : https://fluidbody-web.vercel.app
**Dossier source** : `/Users/xvan06/fluidbody-web/` (séparé du repo de l'app)
**Plateforme** : Vercel, plan Hobby (gratuit), compte `yvan-glitch`

**Contenu** :
- Hero plein écran avec méduse animée + FLUIDBODY+ + tagline + bouton App Store
- Section Sabrina (photo studio + bio 30 ans)
- Grille 9 piliers
- 3 propositions de valeur
- CTA final + footer
- Pages `/privacy.html` + `/terms.html` (FR + EN)
- 5 méduses fluo lime + 11 bulles animées en background sur toutes les pages
- SEO complet (Open Graph, Twitter Card, JSON-LD)
- Vercel Analytics activé

**Pour redéployer après modif** :
```bash
cd ~/fluidbody-web
vercel --prod
```

**À faire** : acheter `fluidbody.ch` (~9 CHF/an Cloudflare Registrar, ou ~14 CHF Infomaniak) puis brancher via Vercel Settings → Domains.

---

## 🆕 Updates post-merge (26 mai après-midi + soirée)

### `5df8c36` — Profil iPhone réorganisé en 5 sections
- 🧑 VOTRE COACH · 📊 MON ACTIVITÉ · ⚙️ RÉGLAGES · 💳 COMPTE · ℹ️ À PROPOS

### `aa648e0` — Écran Achievements dédié
- Accessible depuis Profil > Mon activité
- Grille 2-col 15 badges avec date de déblocage

### `5f162fa`, `b5dfe69`, `86de8a4` — Bibliothèque centrale d'icônes SVG
- Nouveau fichier `src/components/Icons.js` (~50 icônes Lucide-outline)
- **TOUS les emojis** remplacés sur iPhone + TV
- 145 emojis → SVG custom (achievements, intentions, réflexions, UI génériques)
- Couleur paramétrable (défaut lime `#AEEF4D`), taille paramétrable, stroke 1.7

### `7697dea`, `471c930` — IconJellyfish raffinée
- Silhouette élégante : cloche festonée (5 scallops), 5 tentacules Bézier fluides, canaux radiaires fins
- Plus d'yeux ni de face cartoon
- Fond translucide lime 15%

### `1ba5ec5` puis `9f64c2d` — Tab bar Mon Corps simplifiée
- Test option B (méduse flottante seule, pas de label) : pas concluant pour Yvan
- Retour à option A : juste "FluidBody+" en texte, pas d'icône
- Cohérent avec les 4 autres tabs (Activité, Pour vous, Bibliothèque, Profil)

**OTAs actifs** :
- iPhone : https://expo.dev/accounts/ytissot/projects/fluidbody/updates/475f8125-a33c-4e05-8d4d-0eb0623d54a5 (commit `9f64c2d`)
- TV : https://expo.dev/accounts/ytissot/projects/fluidbody/updates/4a4929c2-cc03-47f1-95aa-2fabab0d5520 (commit `471c930`)

---

---

## 🆕 Updates après le merge (26 mai après-midi)

**`5df8c36 refactor(profil): reorganize iPhone Profile in clear sections`**
Profil iPhone réordonné en 5 sections claires :
- 🧑 VOTRE COACH (Sabrina hero)
- 📊 MON ACTIVITÉ (Statistiques · Mes accomplissements · Mes téléchargements · Minuteur)
- ⚙️ RÉGLAGES (Pairer Apple TV · Préférences · Rappels groupés · Pendant la séance · Connexions Apple Santé · Planification Calendrier · Apparence · Téléchargements espace)
- 💳 COMPTE (Abonnement · Mes infos · Se déconnecter · Supprimer mon compte)
- ℹ️ À PROPOS (Mon compte · Confidentialité · Développeur)

Tous les `onOpen*` props préservés, structure UI uniquement.

**`aa648e0 feat(achievements): dedicated Achievements screen accessible from Profil > Mon activité`**
- Nouveau `src/screens/Achievements.js` : grille 2-col plein-écran des 15 badges, débloqués (emoji + titre + "Débloqué le DD MMM") ou verrouillés (🔒 + objectif)
- Nouveau row 🏆 "Mes accomplissements" dans Profil > Mon activité avec sous-titre live "X badges débloqués"
- Sibling store `fluid_achievement_dates_v1` pour tracker la date de déblocage (backward-compat avec format existant)
- Wired dans App.js (showAchievements + Modal)

**OTAs actifs** :
- iPhone : https://expo.dev/accounts/ytissot/projects/fluidbody/updates/2f2021f3-91a9-491e-a675-567a9015fb6c (Achievements screen, ÉCRASE celui du merge)
- TV : https://expo.dev/accounts/ytissot/projects/fluidbody/updates/4fb21be2-4977-4562-8f33-58ce49ddf6cc (merge consolidé, inchangé depuis matin)

---

---

## 🎯 État final de l'app (résumé)

L'app est passée par 3 phases successives :
1. **Deep polish** (21-25 mai) → 25+ OTAs sur `claude/peaceful-rubin-f662f9` : downloads, préférences, audit pré-submit, fix introShown, Sabrina photos studio, glassmorphism, méduses turquoise, etc.
2. **Overnight features** (25-26 mai) → 5 commits sur `main` : analyse concurrentielle, page Sabrina dédiée, badges achievements, filtrage durée, rappel quotidien
3. **Merge consolidé** (26 mai) → toutes les phases réunies sur `main` au commit `884f83f`

**⚠️ Leçon importante** : le travail de la phase 1 n'a JAMAIS été merge dans `main` avant la phase 2. Quand l'overnight a poussé une OTA depuis `main`, elle a écrasé le polish sur les iPhones (les utilisateurs ont perdu downloads + préférences pour quelques heures). Toujours **merger les branches workspace dans `main` AVANT de lancer un build ou des OTAs depuis main**.

---

## 📦 État sur `main` actuel (`884f83f`)

### Features iPhone

**Pour vous**
- Modal Intention quotidienne au cold-start (5 cards image Sabrina + SVG icônes)
- Citation Sabrina du jour (30 citations rotation)
- Chip INTENTION → pilier suggéré
- Mosaïque 7 cards pilières
- **Section "Mes favoris"** (si ≥ 1 favori, sub-mosaïque sous la mosaïque)
- **Section "Cette semaine"** (7 cards LUN/MAR/... biaisé selon intention)
- Card "Le Pilates conscient, au quotidien" avec metadata "175 séances · 64 h 20 min · Avec Sabrina" + CTA "Commencer"

**PilierPanel iPhone**
- Hero pilier + titre
- 5 cards théorie verticales avec badge GRATUIT et **bouton download lime** quand vidéo dispo
- Sections Préparer / Exécuter / Évoluer (cards visuellement présentes)

**Profil**
- **VOTRE COACH Sabrina** : avatar + nom + "30 ans d'expérience" + bio + "En savoir plus" → page Sabrina dédiée
- Statistiques (graphes)
- Minuteur Stretching & Eldoa
- **Mes téléchargements** (écran dédié avec liste + tailles + qualités + bouton supprimer)
- **Préférences** (streaming quality, audio background, HD downloads, Wi-Fi only)
- **Rappel quotidien** toggle + heure
- Phrase du jour de Sabrina toggle + heure
- Pauses actives au bureau
- Pendant la séance (Apple Watch BPM, etc.)
- Notifications
- Mes accomplissements (15 badges achievements)
- Supprimer mon compte

**Paywall iPhone**
- Titre "Rejoins les fondateurs FluidBody+"
- Banner **OFFRE FONDATEUR** sans emojis : "Mensuel 12.90 CHF/mois les 3 premiers mois, puis 24.90. Annuel 99 CHF la 1re année, puis 199."
- Prix barrés (24.90 → 12.90 / 199 → 99) + pill verte "Économise 100 CHF la 1re année"
- 5 bullets sans emojis (9 piliers · iPhone+TV · Sabrina 30 ans · FR+EN sous-titrés au lancement · Sabrina IA à venir)
- CTA "S'abonner"
- Pill "Annulable depuis Réglages Apple"
- Aucune mention "à vie", aucune comparaison Speir
- Aucun free trial

**Téléchargements iPhone**
- Bouton ↓ lime sur chaque séance théorie avec vidéo dispo
- **ActionSheet qualité** : Économique • iPhone (~36 MB) / Standard • iPad (~72 MB) / HD • Apple TV (~144 MB) — choisis selon ton appareil
- État téléchargé : cercle lime ✓
- Confirmation suppression à la confirmation
- Liste dans Profil > Mes téléchargements
- Lecture prioritaire depuis fichier local (instantané, fonctionne mode avion)
- Format v2 hex encoding (XOR → hex sur disque, UTF-8 safe)

**Préférences iPhone**
- Qualité de streaming (Auto / Économique / Standard / HD)
- Lecture audio en arrière-plan (toggle)
- Téléchargements HD systématiques (toggle, skip le picker au tap ↓)
- Télécharger uniquement en Wi-Fi (toggle, ON par défaut, `@react-native-community/netinfo` ajouté pour enforcement)

### Features Apple TV

**Header**
- Logo FLUIDBODY+ gauche · pill "Respirer 60s" centre · avatar Sabrina + "Bonjour Yvan" droite
- Tabs capsule : Pour vous · Explorer · Programmes · Respiration · 🔍

**Fond**
- Dégradé navy `#021222` → turquoise `#55BBC9` (samplé pixel-près du splash iPhone)
- 3 méduses animées (taille 1.4×) + 6 bulles, cycle 14-18s
- BlurView glassmorphism partout

**Pour vous TV**
- Layout 2 colonnes Fitness+ : gauche (titre + sous-titre + CTA "Commencer") | droite (mosaïque 3x3 piliers focusable)
- Carrousel "Types d'activités" en bas

**Autres écrans TV**
- Explorer : grille 3 colonnes piliers
- Programmes : hero programme actif + grille 5 thématiques + carrousel séances courtes + card mauve "Programme personnalisé" + card "À propos Sabrina"
- PilierPanelTV : hero 42% + grille 3 colonnes séances avec badges étape
- Bibliothèque, Activité, Résumé : versions TV dédiées
- Respiration : modal méditation BreathRing + 9 méduses + 15 bulles foreground
- Recherche : TextInput + grille 3 colonnes résultats

**TV n'a JAMAIS de paywall** (pairing iPhone → utilisateur déjà abonné).

---

## 📁 Architecture (fichiers clés)

### Nouveaux composants/utils créés
- `src/utils/iap.js` — Source de vérité IAP (3 phases founder/intermediate/standard)
- `src/utils/downloadsCache.js` — Cache + pub/sub pour DownloadManager
- `src/utils/favorites.js` (étendu)
- `src/utils/sessionBadges.js` — pickBadge() Nouveau/Programme/Favori/Reprendre
- `src/utils/weeklySchedule.js` — getThisWeekSchedule() algorithme intelligent
- `src/utils/dailyIntention.js` — Intention du jour persist
- `src/utils/reflections.js` — Post-session emoji reflection
- `src/utils/streakMilestones.js` — Streak palier detection
- `src/utils/achievements.js` — 15 badges auto-detection
- `src/utils/userPreferences.js` — Storage + pub/sub user prefs
- `src/utils/withTimeout.js` — Promise.race timeout util
- `src/utils/tvImagePool.js` — Rotation 33 visuels
- `src/constants/sabrinaQuotes.js` — 30 citations
- `src/components/FluidbodyLogo.js`
- `src/components/DownloadButton.js`
- `src/components/Skeleton.js`
- `src/components/SeanceCarouselRow.js`
- `src/components/tv/AquaticBackground.js` (gradient + drifters)
- `src/components/tv/TVHeaderBar.js`
- `src/components/tv/HeroFeatured.js`
- `src/components/tv/HorizontalCarousel.js`
- `src/components/tv/TVCard16x9.js`
- `src/components/tv/SessionBadge.js`
- `src/components/tv/TwoColLandingTV.js`
- `src/components/tv/PilierPanelTV.js`
- `src/components/tv/ExplorerTV.js`
- `src/components/tv/ProgrammesTV.js`
- `src/components/tv/RechercheTV.js`
- `src/components/tv/StatsTV.js`
- `src/components/tv/BibliothequeTV.js`
- `src/screens/Preferences.js`
- `src/screens/MesTelechargements.js`
- `src/screens/SabrinaProfile.js`
- `assets/coach/avatar.jpg` + `sabrina_1.jpg → sabrina_17.jpg`

### Documents
- `RECAP_DEEP_POLISH_2026-05-22.md` (état post-deep-polish)
- `RECAP_NIGHT_2026-05-25.md` (état post-overnight)
- `RECAP_CONSOLIDATED_2026-05-26.md` (présent document)
- `docs/competitive-analysis-2026-05.md` (analyse 8 services concurrents)

---

## ⏳ Pending pour la submission App Store

### Bloquants
- [ ] **Définir `EXPO_PUBLIC_SENTRY_DSN`** dans EAS Environments (web dashboard → Environment Variables → Production)
- [ ] **Créer `admin@fluidbody.ch`** (email demo pour Apple review)
- [ ] **Configurer Introductory Offers** sur `com.fluidbody.app.premium.monthly` + `.yearly` dans ASC : 3 mois à 12.90 / 1 an à 99 (PAS de Free Trial)
- [ ] **Vérifier plateforme tvOS** sur la fiche App Store Connect si soumission TV envisagée
- [ ] **Lancer un nouveau build natif** : `eas build --profile production --platform ios` après les actions ci-dessus
- [ ] **Tester checklist sur TestFlight** :
  - Sentry capture un crash JS volontaire
  - Restore Purchases sur fresh install
  - Account deletion bout en bout
  - Privacy relay Apple Sign-In
  - HealthKit refus → app continue
  - Mode avion sur séance non-DL → message clair
  - Wi-Fi only download blocking (cellular)
  - Switch FR ↔ EN dans Réglages iPhone

### Backend
- [ ] **Bunny CDN variants** : encoder play_480p.mp4 + play_1080p.mp4 pour servir les 3 qualités (sinon les 3 retournent le même fichier 720p)
- [ ] **Déployer `sign-video-url` edge function** mise à jour : `supabase functions deploy sign-video-url` pour activer `quality` param

### Contenu (Sabrina filme)
- [ ] Filmer Préparer / Exécuter / Évoluer pour les 9 piliers (actuellement 3 vidéos production)
- [ ] Photos haute résolution (1920px+) pour les 9 piliers si possible

### Améliorations futures (nice-to-have)
- Sabrina IA (chatbot conseil)
- Apple Watch BPM intégration temps réel
- Live Activities iOS (timer séance sur lock screen)
- Multi-langue ES + IT
- Subtitles VTT pour vidéos
- Vrai DRM (remplacer XOR placeholder par expo-secure-store + key per user)

---

## 📡 OTAs publiés

(Tous sur runtimeVersion 1.0.0, avec `--environment production`)

### Dernier OTA iPhone (`production` channel)
- `b103f4e4-f808-4d20-b569-43a0d3c7d2d0` (commit `884f83f`) — **MERGE polish + overnight + tagline TV consolidé**

### Dernier OTA TV (`production-tv` channel)
- `4fb21be2-4977-4562-8f33-58ce49ddf6cc` (commit `884f83f`) — **MERGE polish + overnight + tagline TV consolidé**

Les versions précédentes (deep polish + overnight séparés) sont obsolètes — l'OTA consolidé les remplace tous les deux.

---

## 🛠️ Stratégie pricing (validée par Yvan)

| Phase | Mensuel | Annuel | Quand |
|---|---|---|---|
| **Founder** (actuel) | 12.90 CHF/mois (3 premiers mois) puis 24.90 | 99 CHF (1re année) puis 199 | Launch |
| **Intermédiaire** | 17.90 / 149 | Relance marketing (optionnel) |
| **Standard** | 24.90 / 199 | Régime de croisière |

- **Apple IAP exclusivement** (refus de Stripe web)
- Pas de "à vie", pas de free trial, pas de comparaison Speir, pas de chiffre "500 premiers" (qualitatif seulement tant que pas prêt)
- Founder pricing à activer via Introductory Offers ASC

---

## 🎬 Modèle TV ↔ iPhone

- TV utilise le compte iPhone via QR pairing (edge function `tv-pair`)
- TV n'a JAMAIS de paywall (l'utilisateur est déjà abonné via iPhone)
- "Un seul abonnement, deux écrans" est le narratif marketing
- Pas de download sur TV (uniquement streaming)

---

## 🔍 Pointers utiles

### Commandes essentielles
```bash
# Build natif iPhone
eas build --profile production --platform ios

# Build natif TV
EXPO_TV=1 eas build --profile production-tv --platform ios

# OTA iPhone
eas update --channel production --environment production --message "..."

# OTA TV
eas update --channel production-tv --environment production --message "..."

# Submit iPhone à App Store Connect
eas submit --profile production --platform ios --latest

# Submit TV (Transporter manuel requis car EAS submit ne route pas vers tvOS)
# Télécharger l'.ipa depuis Expo → ouvrir Transporter → drag-drop → Deliver

# Déployer edge function
supabase functions deploy sign-video-url

# Migrer DB
supabase db push
```

### Variables d'environnement EAS
À vérifier dans https://expo.dev/accounts/ytissot/projects/fluidbody → Environment Variables :
- `EXPO_PUBLIC_SUPABASE_URL` ✅ Production
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` ✅ Production
- `EXPO_PUBLIC_RC_API_KEY_IOS` ✅ Production
- `SENTRY_DISABLE_AUTO_UPLOAD` ✅ Production
- **`EXPO_PUBLIC_SENTRY_DSN`** ⚠️ À ajouter (manque pour crash reporting actif)

### Comptes & accès
- Apple Developer : yvan.tissot@gmail.com (team Espace Pilates Sarl, R5V88AS9MX)
- ASC App ID : 6761364962
- Bundle ID : com.ytissot.fluidbody
- Provider Apple : Espace Pilates Sarl (117738794)
- Distribution cert : valide jusqu'à mai 2027
- Provisioning profile : Developer Portal ID 5778JVC2LS, active jusqu'à mai 2027

---

*Sauvegarde générée le 26 mai 2026 après la consolidation merge → main. Pour reprendre dans un futur contexte : lire ce fichier + `docs/competitive-analysis-2026-05.md`. Tout le code est sur `main` au commit `884f83f`.*
