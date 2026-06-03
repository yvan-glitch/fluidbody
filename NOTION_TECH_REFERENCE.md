# 🪼 FluidBody · Espace Pilates — Référence Technique Complète

> 💡 **Document maître d'infrastructure.** Tout ce qui tourne pour les projets de Yvan : sites web, app iOS/tvOS, emails, Instagram, services tiers. Conçu pour import / copier-coller dans Notion (markdown compatible).
>
> **Dernière mise à jour :** 2026-05-31 · **Mainteneur :** Yvan Tissot · **Statut :** vivant — à compléter au fil des changements.

> 🔐 **Sécurité.** Ce document ne contient **aucun secret** (mot de passe, clé API, token). Il liste uniquement les **noms** des variables d'environnement et où les retrouver. Ne jamais coller de valeur de secret ici.

---

## 📑 Sommaire

1. [Vue d'ensemble](#1--vue-densemble)
2. [espace-pilates.ch](#2--espace-pilatesch)
3. [fluidbody.ch + fluidbody.app](#3--fluidbodych--fluidbodyapp)
4. [App FluidBody+ (iOS + tvOS)](#4--app-fluidbody-ios--tvos)
5. [Infrastructure email](#5--infrastructure-email)
6. [Instagram](#6--instagram)
7. [Wallpapers + Screensaver Mac](#7--wallpapers--screensaver-mac)
8. [Variables d'environnement critiques](#8--variables-denvironnement-critiques)
9. [Procédures opérationnelles](#9--procédures-opérationnelles)
10. [Comptes & accès](#10--comptes--accès)
11. [Limites connues & TODO](#11--limites-connues--todo)
12. [Glossaire](#12--glossaire)

---

## 1 · Vue d'ensemble

### Projets & statut

| Projet | Type | Hébergement | Statut |
|---|---|---|---|
| **espace-pilates.ch** | Site marketing studio + boutique | Vercel | 🟡 Prêt, bascule DNS en attente (apex encore sur Odoo) |
| **pro.espace-pilates.ch** | Boutique/portail Odoo (legacy) | Odoo SaaS | 🟢 Actif (sous-domaine pendant/après bascule) |
| **fluidbody.ch** | Site vitrine de l'app | Vercel | 🟢 En ligne |
| **fluidbody.app** | Domaine alias → fluidbody.ch | Vercel | 🟢 Redirige vers fluidbody.ch |
| **App FluidBody+ iOS** | App React Native / Expo | EAS / TestFlight | 🟡 Build #86 sur TestFlight, soumission App Store **en pause** (vidéos) |
| **App FluidBody+ tvOS** | Build Apple TV séparé | EAS | 🟡 Build TV en cours (#88+) |
| **@fluidbody.plus** | Instagram principal | Meta | 🟢 Créé le 31 mai 2026 |
| **@fluidbody.ch** | Instagram défensif | Meta | 🟡 Parking, 2FA à activer |
| **FluidBody.saver** | Screensaver macOS | Local | 🔴 Non fonctionnel — utiliser WebViewScreenSaver |

### Architecture haut-niveau (qui parle à qui)

```
┌─────────────────────────────────────────────────────────────┐
│                         UTILISATEURS                          │
└───────┬───────────────────┬───────────────────┬─────────────┘
        │                   │                   │
   Navigateur          Navigateur            App iOS/tvOS
        │                   │                   │
        ▼                   ▼                   ▼
 espace-pilates.ch    fluidbody.ch        FluidBody+ (Expo)
   (Vercel static)   (Vercel static)            │
        │                   │          ┌─────────┼──────────┐
   ┌────┴────┐         ┌────┴───┐      ▼         ▼          ▼
   ▼         ▼         ▼        ▼   Supabase  RevenueCat  HealthKit
 Stripe   Resend    Resend  (veille)  │         │        (Apple)
 (LIVE)   (email)   (email)           ▼         ▼
   │                                Bunny    Apple IAP
   ▼                              CDN (vidéo)
pro.espace-                          │
pilates.ch                    edge fn sign-video-url
(Odoo shop)                   (token-auth 30 min)

         Sentry (Frankfurt) ◄── crash reporting ── App + sites
```

- **Sites web** : statiques sur Vercel, serverless functions pour contact (Resend) et boutique (Stripe).
- **App** : Expo single-file, backend Supabase (auth + profils + mapping vidéos), vidéos premium signées via edge function pointant Bunny CDN, abonnements via RevenueCat (Apple IAP).
- **Email** : tout passe par **Resend** (`fluidbody.ch`) et **Google Workspace** (`espace-pilates.ch`).

### Coûts mensuels estimés des services

> 💡 Estimation indicative — vérifier les factures réelles. La plupart des services sont sur tier gratuit ou pay-as-you-go à faible volume.

| Service | Plan | Coût estimé / mois |
|---|---|---|
| Vercel (2 projets) | Hobby/Pro | 0 – 20 CHF |
| Supabase | Free / Pro | 0 – 25 USD |
| Bunny CDN | Pay-as-you-go (stockage + bande passante) | ~5 – 20 USD selon trafic vidéo |
| RevenueCat | Free (< 2,5k$ MTR) | 0 USD au lancement |
| Resend | Free (3k emails/mois) | 0 USD |
| Sentry | Developer / Team | 0 – 26 USD |
| EAS / Expo | Pay-as-you-go (crédits build épuisés) | variable par build |
| Apple Developer | Annuel | 99 USD / an (~8 USD/mois) |
| Google Workspace | Business Starter | ~6 CHF / utilisateur |
| Infomaniak (domaines/DNS) | Annuel | ~10 CHF / domaine / an |
| Stripe | Pay-per-transaction | 2,9 % + frais par vente |
| **Total récurrent estimé** | | **~30 – 90 CHF/mois** hors builds & transactions |

---

## 2 · espace-pilates.ch

> 💡 **Stack :** site statique vanilla HTML/CSS/JS, **sans build step**, déployé sur Vercel. Repo local : `/Users/xvan06/espace-pilates-web/`. Projet Vercel : `espace-pilates-web`.

### 2.1 — DNS (Infomaniak → Vercel)

> ⚠️ **Bascule DNS pas encore effectuée.** L'apex pointe encore vers Odoo. Le plan complet est dans `MIGRATION.md`. **Ne jamais basculer l'apex avant** que `pro.espace-pilates.ch` soit live sur Odoo avec SSL et que tous les liens email/factures soient mis à jour.

**Cible DNS post-bascule :**

| Sous-domaine | Type | Valeur | Notes |
|---|---|---|---|
| `@` (apex) | A | `76.76.21.21` | Vercel apex |
| `www` | CNAME | `cname.vercel-dns.com.` | Vercel www |
| `pro` | CNAME | host Odoo (`<db>.odoo.com`) | Reste sur Odoo |
| `@` | MX | Google Workspace | **inchangé** |
| `@` | TXT | SPF / DKIM / DMARC | **inchangé** |

> 💡 Le doc `MIGRATION.md` mentionne aussi l'apex Vercel `216.198.79.1` selon la génération de config. Vérifier dans le dashboard Vercel → Domains la valeur A exacte demandée au moment de la bascule (Vercel peut indiquer `76.76.21.21` **ou** `216.198.79.1`).

**Runbook bascule (résumé `MIGRATION.md`) :**
1. **Phase 0** — Valider le site Vercel (contenu, formulaire contact, Lighthouse ≥ 90 perf).
2. **Phase 1** — Créer `pro.espace-pilates.ch` sur Odoo, migrer tous les liens internes Odoo (réglages, templates email, portails).
3. **Phase 2** — Ajouter apex + www dans Vercel Domains, baisser le TTL DNS à 300 s.
4. **Phase 3** — Basculer apex A + www CNAME chez Infomaniak.
5. **Phase 4** — Rollback possible en < 5 min (grâce au TTL bas).
6. **Phase 5** — Monitoring 48 h (emails, commandes, logs).
7. **Phase 6** — Cleanup (Google Business, réseaux, signatures, supports imprimés).

### 2.2 — Hébergement & structure

- **Vercel projet :** `espace-pilates-web` (ID `prj_tUjJPE0WmdPTqu8A4AqQEOKvY3T9`).
- **Deux générations de design coexistent** :
  - **Home FR** (`index.html`) : V3 redesign — palette teal + lime, fonts Plus Jakarta Sans + Instrument Serif, Lenis smooth scroll, curseur custom, particules océan. CSS `/css/styles.css`, JS `/js/script.js`.
  - **Home EN + pages légales** (`en/index.html`, `privacy.html`, `terms.html`) : thème antérieur terracotta/sage, fonts Cormorant Garamond + Inter. CSS `/styles/main.css`, JS `/scripts/main.js`.
- **Pages :** Home FR + EN, Boutique FR (`/boutique`) + EN (`/en/boutique`), Privacy/Terms FR + EN, 404.
- **Local dev :** `python3 -m http.server 4000` ou `npx serve -p 4000`.

### 2.3 — Sous-domaines

| Sous-domaine | Destination | Usage |
|---|---|---|
| `pro.espace-pilates.ch` | Odoo SaaS | Boutique legacy, facturation, portail client |
| `send.espace-pilates.ch` | Resend (prévu) | Sous-domaine d'envoi email (voir §5) |

### 2.4 — Boutique Stripe (mode LIVE)

> 🔐 **Stripe en mode LIVE** (vrais paiements). Clé via env var `STRIPE_SECRET_KEY`. Pas de clé test bundlée.

- **Endpoint :** `/api/checkout.js` (serverless). Crée une Stripe Checkout Session via l'API REST (pas de SDK npm).
- **Le client n'envoie que** `{ items: [{ id, qty }], locale }` — **les prix et noms produits sont décidés côté serveur** (anti-tampering).
- **19 produits chaussettes**, tous à **CHF 15.00**, noms bilingues FR/EN (IDs Odoo 157→183 : Lemon Fresh, Mint Harmony, Ocean Dream, Sunrise Glow, Tropical Peach, Lavande Douce, Rose Velours, Olive Nature, Blanc Confort, Noir Performance, Violet Flow, Gris Motion, Rose Vitalité, Lilas Harmony, Gris Perle, Noir Élite, Menthe Sage, Blanc Neige, Rose Poudré).
- **Mode** `payment` (one-time), devise `chf`, méthodes auto (carte + TWINT pour comptes CHF suisses).
- **Limites panier :** max 20 unités/article, 50 articles total.
- **Rate-limit :** 12 requêtes / 5 min / IP.
- **URLs retour :** succès `?paid=1`, annulation `?canceled=1` (suffixe `/shop` ou `/en/shop`).

> 💡 Le brief mentionne « 6 forfaits » : à confirmer côté Stripe Dashboard. Le code `checkout.js` ne référence actuellement que les 19 chaussettes — les forfaits cours sont peut-être gérés directement dans le dashboard Stripe ou via Odoo.

### 2.5 — Formulaire de contact (Resend)

- **Endpoint :** `/api/contact.js`. Envoie via Resend.
- **Anti-spam :** honeypot `_gotcha` (succès silencieux si rempli) + rate-limit **3 req / 5 min / IP**.
- **Validation :** longueurs max (name 200, email 200, phone 50, message 5000), regex email, échappement HTML.
- **CORS autorisé :** `espace-pilates.ch`, `www.espace-pilates.ch`, `espace-pilates-web.vercel.app`.
- **Destinataire fallback :** `info@espace-pilates.ch`. Sujet : `[Site web] Nouveau message de {name}`. Reply-To = email du visiteur.

### 2.6 — Redirects Vercel (préservation liens Odoo legacy)

> 💡 Tous en **307 (temporaire)** pour l'instant — passer en 308 (permanent) **seulement après** bascule réussie.

**Redirects marketing/ancres :** `/methode`→`/#pratique`, `/equipe`→`/#sabrina`, `/cours`→`/#pratique`, `/studio`→`/#identite`, `/app`→`/#fluidbody`, `/fluidbody`→`https://fluidbody.ch`, `/contactus`→`/#contact`, `/golf`→`/#cours`, `/about-us`→`/#equipe`.

**Redirects boutique Odoo (préservent les liens factures/emails) :** `/my/*`, `/web/login`, `/web/signup`, `/web/reset_password`, `/web/session/*`, `/web/database/*`, `/odoo/*`, `/payment/*`, `/shop` → tous vers `https://pro.espace-pilates.ch/...`.

**Rewrites :** `/shop`→`/boutique`, `/en/shop`→`/en/boutique`.

### 2.7 — Headers de sécurité & cache (vercel.json)

| Header | Valeur |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| Cache `/assets/*` | `max-age=31536000, immutable` (1 an) |
| Cache `/styles/*` `/scripts/*` | `max-age=86400, must-revalidate` (24 h) |
| `/css/*` `/js/*` | pas de cache header — busting via query string `?v=...` |

### 2.8 — Schema.org (@graph)

JSON-LD avec **HealthAndBeautyBusiness** (`#business`) : "Espace Pilates 1814", légal "Espace Pilates Sàrl", fondé 2003, Rue du Château 1, 1814 La Tour-de-Peilz VD, +41795449362, info@espace-pilates.ch, horaires Lun–Ven 08:00–13:00 & 17:00–20:00, paiements Cash/CB/Virement/TWINT, fondatrice **Person Sabrina Tissot** (`#sabrina`), employés Yvan Tissot + Natalia Teyssier, Instagram `@espacepilates1814`. Plus **6 Service Offers** (privé, semi-privé, Eldoa, Pilates Golf, Office, Ménopause) + **WebSite**.

### 2.9 — SEO

- `robots.txt` allow-all + référence sitemap.
- `sitemap.xml` : home FR (1.0), home EN (0.9), pages légales (0.3), tous avec `hreflang` (fr/en/x-default), lastmod 2026-05-29.
- Open Graph (`fr_CH` / `en_GB`) + Twitter Card summary_large_image, image `og-image.png` 1200×630.
- Canonical + `hreflang` par page.

### 2.10 — Splash vacances été 2026

- Modal `#splash` (role dialog, aria-modal) : "Vacances d'été · Du 13 juillet au 14 août 2026 · Le studio sera fermé."
- Animations `splash__drops` (gouttes) + `splash__bubbles`. Image `splash/vacances-ete-2026.webp` (+ .jpg fallback), protégée `.protected-img`.
- One-shot par session via `sessionStorage` + fix BFCache.

### 2.11 — Protection images

- Classe `.protected-img` : `user-drag: none`, overlay `::after` transparent, pas de drag-drop.
- Images sensibles (galerie, équipe, offres) protégées. WebP + JPG fallback partout.

### 2.12 — Méduses (SVG inline animé)

- SVG : `meduse-ep.svg`, `meduse-ep-short.svg`, `meduse-ep-mini.svg` (+ variantes raster lime/fluo/teal).
- Conteneur `#oceanJellies` : 5 méduses animées (FR + EN + boutique). IntersectionObserver met en pause hors viewport (économie GPU). Durées randomisées 12–28 s.
- Palette teal/terracotta studio.

### 2.13 — Liens / nav

- Capsule menu nav + FAB téléphone/WhatsApp.

---

## 3 · fluidbody.ch + fluidbody.app

> 💡 **Stack :** site statique vanilla, **sans build step**, Vercel. Repo local : `/Users/xvan06/fluidbody-web/`. Projet Vercel : `fluidbody-web`. Dépendance unique : `resend@^6.12.4`.

> ⚠️ **`fluidbody-web` n'a PAS de remote git.** Pas de déploiement auto par push. **Deploy manuel via `vercel --prod`** depuis le dossier local.

### 3.1 — DNS (Infomaniak → Vercel)

- **`fluidbody.ch`** : apex primary sur Vercel.
- **`fluidbody.app`** : domaine alias → **308 redirect** vers `fluidbody.ch`.
- `vercel.json` **ne définit pas** de redirect apex/www — géré au niveau Domains/DNS Vercel.

### 3.2 — Hébergement & structure

```
fluidbody-web/
├── index.html              # Home FR (hero, 9 piliers, pricing, newsletter, contact)
├── en/index.html           # Home EN
├── en/screensaver.html     # Écran de veille EN (QR + méduses + lagon turquoise)
├── privacy.html / terms.html  # Légal FR+EN (switch via legal.js)
├── 404.html
├── api/contact.js          # Endpoint Resend
├── styles/main.css         # 1513 lignes — tout le style (Liquid Glass v2)
├── scripts/main.js         # 331 lignes — interactions, contact, curseur, nav
├── aquatic.js              # Fond méduses + bulles (IIFE)
├── legal.js                # Pages légales : scroll + switch FR/EN
└── assets/                 # piliers, badges, meduse.svg, og-image, sabrina, screens
```

- **Pages :** Home FR + EN, Veille FR (`/veille`) + Screensaver EN (`/en/screensaver`).
- `vercel.json` : `cleanUrls: true`, `trailingSlash: false`, mêmes headers sécurité que espace-pilates, cache assets 1 an / CSS-JS 24 h.

> 💡 Le brief référence `/veille` (FR). L'inspection a confirmé `en/screensaver.html` (EN) ; la version FR `/veille` est servie via cleanUrls (fichier `veille.html` à la racine). Le screensaver Mac pointe vers `https://fluidbody.ch/veille`.

### 3.3 — Liquid Glass v2 (CSS `styles/main.css` ~L168-213)

- **Cursor highlight** : JS met à jour les CSS vars `--mx`/`--my` (coords %) sur mousemove ; `.glass::after` / `.pilier-photo::after` = radial gradient lime (500px, 13 % opacité) centré sur le curseur.
- **Multi-layer halo** (box-shadow) : reflet top blanc inset, reflet bottom lime inset, ombre externe 8/32, halo turquoise diffus 60px, halo lime far-field 100px.
- **Specular breathing** (`.price__specular`) : animation `breathe-specular 6s` infinie, opacité 0.4↔0.75, scale 1↔1.08, désactivée si reduced-motion.
- **Backdrop** : `blur(38px) saturate(140%)` (+ `-webkit-`). Border gradient animée via `-webkit-mask` XOR.

### 3.4 — Contact form (Resend)

- `/api/contact.js` : POST `{name, email, message, _gotcha}`. Honeypot + rate-limit 3/5min/IP. Validation + échappement HTML.
- **CORS :** `fluidbody.ch`, `www.fluidbody.ch`, `fluidbody.app`, `fluidbody-web.vercel.app`.
- **From :** `FluidBody+ <jellyfish@fluidbody.ch>` (via `CONTACT_FROM`). **To :** `info@espace-pilates.ch` (via `CONTACT_RECIPIENT`). Sujet `[FluidBody+] Nouveau message de {name}`.

### 3.5 — Méduses (SVG aquatic signature)

- SVG `/assets/meduse.svg` (6,7 KB) réutilisé. Fond `scripts/main.js` : 10 méduses (7 turquoise, 3 lime), 16 bulles, optimisé tactile (5 méduses sur iPad). Drift/sway/pulse, durées 9–17 s.
- Curseur custom lime (dot + ring, lerp 18 %), bulles au mousemove (throttle 80ms, max 30).

### 3.6 — Écran de veille / Screensaver

- `en/screensaver.html` : lagon turquoise (gradient 5 stops), halos flottants, caustics animées.
- 3 grandes méduses SVG inline (bell breathing 5 s, ondulation tentacules, halo glow), 6 bulles montantes.
- **QR code** bas-droite (104×104px) → téléchargement app. Wordmark FluidBody+, rotateur de messages.
- `noindex`, `cursor: none`, aria-hidden sur SVG décoratifs.

### 3.7 — Email (noreply / jellyfish)

- Envoi via Resend depuis `jellyfish@fluidbody.ch` (DKIM + MX send sur `fluidbody.ch`). Voir §5.

### 3.8 — Schema.org

JSON-LD `@graph` : **WebSite** (fr-CH + en) · **MobileApplication** (iOS/tvOS, HealthApplication, download `apps.apple.com/app/id6761364962`, 9 piliers en featureList, 2 offres Founder mensuel CHF 12.90 / annuel CHF 99, 3 screenshots) · **Person** Sabrina Tissot (EPFL, Espace Pilates Sàrl) · **Organization** Espace Pilates Sàrl (fondé 2003).

---

## 4 · App FluidBody+ (iOS + tvOS)

> 💡 **Stack :** React Native + Expo SDK 54, **single-file** `App.js` (~3765 lignes) + `src/` modulaire. Repo : `/Users/xvan06/fluidbody/`. Fork tvOS de React Native (`react-native-tvos@0.81.5-2`) pour le support Apple TV.

### 4.1 — Identité & versions

| Clé | Valeur |
|---|---|
| Nom | FluidBody+ |
| Slug | fluidbody |
| Version | 1.0.0 |
| Bundle ID (iOS) | `com.ytissot.fluidbody` |
| Package (Android) | `com.ytissot.fluidbody` |
| EAS Project ID | `c94beda1-885e-48cd-83ca-2a1e2f10da79` |
| ASC App ID (iOS) | `6761364962` |
| Apple Team ID | `R5V88AS9MX` |
| Expo SDK | 54.0.34 · React 19.1.0 |
| Langues | FR (défaut), EN, ES, IT — auto-détection locale |

### 4.2 — Dépendances clés

| Package | Version | Rôle |
|---|---|---|
| `expo` | 54.0.34 | Framework |
| `react-native` | tvos 0.81.5-2 | Core (fork tvOS) |
| `@supabase/supabase-js` | ^2.101.1 | Auth + DB |
| `react-native-purchases` (+`-ui`) | ^9.15.0 | RevenueCat IAP + paywall |
| `@kingstinct/react-native-healthkit` | ^14.0.0 | HealthKit (Nitro Modules) |
| `@sentry/react-native` | ~7.2.0 | Crash monitoring |
| `expo-av` | ~16.0.8 | Lecteur vidéo HLS |
| `expo-updates` | ~29.0.17 | OTA |
| `react-native-qrcode-svg` | ^6.3.21 | Pairing Apple TV |
| `react-native-nitro-modules` | ^0.35.6 | New Arch interop |

### 4.3 — Backend Supabase

- **Auth :** magic link email + Sign in with Apple. Table `profiles`. Persistance session via AsyncStorage.
- **Edge functions :**
  - `sign-video-url/index.ts` — vérifie JWT → lookup `video_assets.bunny_path` → check entitlement (admin allowlist → `profiles.is_subscriber` → fallback RevenueCat live) → mint URL Bunny Token-Auth TTL 30 min.
  - `tv-pair/index.ts` — flow pairing Apple TV.
- **Migrations (8) :** `video_security`, `profile_fields`, `referrals`, `tv_pairings`, `user_programs`, `user_favorites`, `audio_rituals`, `delete_account`.
- **Tables clés :** `video_assets(session_id, bunny_path)`, `profiles(rc_app_user_id, is_subscriber, subscription_expires_at)`, `tv_pairings`, `user_programs`, `user_favorites`, `audio_rituals`.

### 4.4 — Vidéos sécurisées (Bunny CDN)

> 🔐 **Les URLs Bunny premium ne sont JAMAIS bundlées.** Le GUID Bunny vit uniquement dans Supabase `video_assets`.

1. `src/constants/data.js` flag une séance ayant une vidéo (index 3 du tuple = `true`).
2. `src/utils/videoUrl.js#getSignedVideoUrl(sessionId, kind, lang?)` appelle l'edge function avec le JWT.
3. L'edge function vérifie JWT + entitlement et mint une URL Token-Auth (TTL 30 min).
4. `VideoPlayer` + `DownloadManager` consomment des URLs signées uniquement (cache mémoire re-signe ~1 min avant expiry).

- **Convention session id :** `${pilierKey}_${seanceIndex}`.
- **Bunny pull zone host (défaut) :** `vz-1a4e2cac-0dc.b-cdn.net` (override via `BUNNY_PULL_ZONE_HOST`).

> ⚠️ `DownloadManager.js` chiffre par XOR à seed dérivé = **anti-tamper casual, PAS du DRM**. Marqué placeholder dans le fichier — à remplacer par `expo-secure-store` + clé dérivée par user avant de le traiter comme une vraie protection.

### 4.5 — Abonnements (RevenueCat)

- IAP mensuel/annuel, entitlement **`Fluidbody Pilates Pro`** (env `REVENUECAT_ENTITLEMENT_ID`). **Apple IAP exclusivement.**
- Config produits : `src/constants/iap.js`. Paywall : `src/components/PaywallModal.js` + `react-native-purchases-ui`.

### 4.6 — Sentry (crash monitoring)

- DSN via `EXPO_PUBLIC_SENTRY_DSN`, région **Frankfurt**. Vide → no-op.
- `Sentry.setUser({ id })` câblé sur l'auth Supabase — **seul l'ID** est envoyé, `beforeSend` strip email/IP/username.
- `ErrorBoundary` forward les erreurs JS. Logs `console.*` gatés derrière `__DEV__`.

### 4.7 — HealthKit (`@kingstinct/react-native-healthkit` v14, Nitro)

- A remplacé `react-native-health` 1.19 (mai 2026) qui crashait en NSException sur iOS 26.5 + New Arch.
- **Kill switch** `HEALTHKIT_DISABLED` (défaut `false`) hoisté dans `App.js`, `healthkit.js`, `useLiveHeartRate.js` — flip à `true` sans rebuild natif si régression iOS future.
- **Heart rate live :** `useLiveHeartRate.js` poll 4 s, lookback 30 s, match source Apple Watch.
- **Read (11) :** HeartRate, ActiveEnergy, BasalEnergy, ExerciseTime, StandTime, BodyMass, Height, StepCount, DistanceWalkingRunning, FlightsClimbed, DateOfBirth, BiologicalSex, Workout. **Write (5) :** ActiveEnergy, HeartRate, BodyMass, Height, Workout. Background delivery activé.
- Workout enregistré : `HKWorkoutActivityType.pilates = 66`.

### 4.8 — Liquid Glass natif (iOS 26)

- Module Swift `LiquidGlassView` (`ios/FluidBody/LiquidGlass/`) wrappe `UIGlassEffect` iOS 26 (style regular/clear, tintColor, isInteractive). Fallback `UIBlurEffect(.systemThinMaterial)` si iOS < 26.
- Border lumineux gradient, intensité/tint/corner configurables.
- Plugin custom `plugins/withLiquidGlass.js` sélectionne les sources iOS vs tvOS selon `EXPO_TV`.
- Bridge JS `src/components/LiquidGlass.js` route vers `LiquidGlassTVView` si `Platform.isTV`, sinon `LiquidGlassView`.

### 4.9 — Apple TV (tvOS)

- **Build séparé** via profils EAS `*-tv` (`EXPO_TV=1`). `app.config.js` conditionnel.
- Module `LiquidGlassTVView.swift` : `UIGlassEffect` natif tvOS 26 (confirmé WWDC25), **fallback `UIBlurEffect(.dark)`** si tvOS < 26 ; sheen spéculaire animé, reflet top, intensité focus-aware, accent lime/cyan.
- **Plugins strippés pour tvOS** (incompatibles) : HealthKit, Apple Authentication, datetimepicker, notifications, camera. New Arch désactivé (`newArchEnabled: false`).
- Écrans TV : `ProfilTV.js`, `TVLoginScreen.js`, `PairAppleTV.js`, `GlassCardTV.js`. Utils `tvPair.js`, `platformTV.js`.
- Assets TV : icônes large/small, top-shelf (standard + wide, @2x).

### 4.10 — Builds & OTA

| Profil EAS | Channel | Env / notes |
|---|---|---|
| `development` | development | dev client |
| `preview` | preview | — |
| `production` | production | `EXPO_PUBLIC_SENTRY_DSN`, auto-increment |
| `development-tv` / `preview-tv` / `production-tv` | `*-tv` | `EXPO_TV=1` |

- **Statut builds (≈ fin mai 2026) :** iPhone **#86** sur TestFlight ; tvOS **#88+** en compilation. *(Le brief évoque #87 et TV #90 — numéros mouvants, vérifier `eas build:list`.)*
- **OTA :** `eas update --channel production` (iPhone) / `--channel production-tv` (TV).

### 4.11 — Statut & stratégie

> ⚠️ **Soumission App Store EN PAUSE** — pas avant le tournage des vidéos. L'app annonce 175 séances / 64h20 ; MVP de **19 séances** (2-3 par pilier × 9) requis pour soumettre (~10-15h tournage). Plan détaillé : `SPRINT_CONTENU_VIDEOS_2026-05-29.md`.

- **Pricing :** Founder **12.90/mois · 99/an** → cible **24.90/199**. **Pas de "à vie", pas de Speir.**
- Légal : privacy `yvan-glitch.github.io/fluidbody-privacy/`, terms FR + EN.

---

## 5 · Infrastructure email

> 💡 Deux domaines, deux fournisseurs : **Resend** pour `fluidbody.ch` (transactionnel app/site), **Google Workspace** pour `@espace-pilates.ch` (boîtes mail humaines).

| Domaine | DNS | Envoi | Réception |
|---|---|---|---|
| `fluidbody.ch` | Infomaniak | **Resend** (DKIM + MX send + TXT send) | forward Infomaniak |
| `espace-pilates.ch` | Infomaniak | Google Workspace | Google Workspace (MX) |

- **From addresses :** `noreply@fluidbody.ch` & `jellyfish@fluidbody.ch` (Resend) · `info@espace-pilates.ch` (Google Workspace).
- **Redirection :** `jellyfish@fluidbody.ch` → `info@espace-pilates.ch` (forward Infomaniak).
- **Resend domaine `fluidbody.ch` :** verified (DKIM + enregistrements MX/TXT pour le sous-domaine d'envoi `send`).
- **SPF / DKIM / DMARC :**
  - `espace-pilates.ch` : SPF Google + DKIM Google — **ne pas toucher** pendant la bascule Vercel.
  - `fluidbody.ch` : SPF/DKIM Resend sur le sous-domaine d'envoi.

> 🔐 Les clés `RESEND_API_KEY` vivent dans les env vars Vercel des deux projets (jamais en `EXPO_PUBLIC_*`, jamais ici).

---

## 6 · Instagram

| Compte | Rôle | Email | Statut |
|---|---|---|---|
| **@fluidbody.plus** | Principal | `jellyfish@fluidbody.ch` | 🟢 Créé 31 mai 2026 |
| **@fluidbody.ch** | Défensif (parking anti-squat) | Espace Comptes Meta | 🟡 À protéger 2FA |

- **Type :** Compte Professionnel.
- **Bio (FR, variation recommandée) :**
  > 🪼 Pilates conscient
  > Sabrina dans ta poche · 10 à 25 min/jour
  > Espace Pilates · La Tour-de-Peilz 🇨🇭
  > ↓ fluidbody.ch
- **Lien bio :** `https://fluidbody.ch` (champ "Site web", pas dans le texte).
- **Photo de profil :** icône méduse de l'app (`assets/icon.png`, navy + turquoise).
- **Kit marketing :** `/Users/xvan06/fluidbody/marketing/instagram/` (README, bio FR/EN, usernames-disponibles, hashtags, plan-30-jours, launch-post FR/EN, stories-templates, comptes-à-follow + dossiers `posts/` & `visuels/`).

> ⚠️ **2FA à activer sur les 2 comptes** (SMS + app authenticator). Réserver les variantes proches (`@fluidbodyplus`, `@fluidbody.app`) en parking anti-squat.

---

## 7 · Wallpapers + Screensaver Mac

### Wallpapers

- **Dossier :** `/Users/xvan06/fluidbody/marketing/wallpapers/` — formats Apple TV 4K, iPad Pro 11"/12.9" (portrait + paysage), branded + clean. Générés via `_generate.js`.
- **v2 :** `wallpapers/v2-pilates-more/` (5 PNG) — iPhone Pro / Pro Max, iPad 12.9" portrait/paysage, MacBook Pro 16". Générés via `_generate_v2.js`.

### Screensaver Mac

> 🔴 **`FluidBody.saver` n'est PAS fonctionnel.** Binaire compilé en `.dylib` au lieu de bundle `MH_BUNDLE` + signature ad-hoc sans Team ID → rejeté par macOS 26 (Tahoe). Fix = recompiler `swiftc -bundle` + notarisation.

> 💡 **Solution recommandée :** utiliser **WebViewScreenSaver.saver** (déjà installé) pointant vers `https://fluidbody.ch/veille`.
> Réglages → Économiseur d'écran → WebViewScreenSaver → Options → coller l'URL. (Détails : `SCREENSAVER_INSTRUCTIONS.md`.)

---

## 8 · Variables d'environnement critiques

> 🔐 **Noms uniquement.** Aucune valeur n'est listée ici. Les valeurs vivent dans les dashboards (Vercel / Supabase / EAS) — ne jamais les copier dans ce document ni dans le repo.

### Vercel — `espace-pilates-web` (prod)

| Variable | Sensible | Usage |
|---|---|---|
| `RESEND_API_KEY` | 🔐 | Email contact |
| `CONTACT_FROM` | 🔐 | Expéditeur |
| `CONTACT_RECIPIENT` | 🔐 | Destinataire (alias `CONTACT_RECEPIENT` / `CONTACT_TO`) |
| `STRIPE_SECRET_KEY` | 🔐 LIVE | Boutique |
| `STRIPE_WEBHOOK_SECRET` | 🔐 | Webhook Stripe (si configuré) |

### Vercel — `fluidbody-web` (prod)

| Variable | Sensible |
|---|---|
| `RESEND_API_KEY` | 🔐 |
| `CONTACT_FROM` | 🔐 |
| `CONTACT_RECIPIENT` | 🔐 |

### EAS / App (production)

| Variable | Sensible | Notes |
|---|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | public (bundlé) | vide en local |
| `EXPO_PUBLIC_SUPABASE_URL` | public (bundlé) | |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | public (bundlé) | |
| Apple ASC API key (.p8) | 🔐 | submit |
| Apple app-specific password | 🔐 | submit |

### Supabase (function secrets — jamais `EXPO_PUBLIC_*`)

| Variable | Sensible | Défaut / note |
|---|---|---|
| `SUPABASE_URL` | auto | injecté runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔐 auto | injecté runtime |
| `BUNNY_TOKEN_KEY` | 🔐 | token-auth Bunny |
| `BUNNY_PULL_ZONE_HOST` | — | `vz-1a4e2cac-0dc.b-cdn.net` |
| `SIGNED_URL_TTL_SECONDS` | — | `1800` (30 min) |
| `REVENUECAT_SECRET_API_KEY` | 🔐 | optionnel |
| `REVENUECAT_ENTITLEMENT_ID` | — | `Fluidbody Pilates Pro` |
| `ADMIN_EMAILS` | — | allowlist (optionnel) |

---

## 9 · Procédures opérationnelles

### Deploy site espace-pilates.ch (git → Vercel auto)

```bash
cd /Users/xvan06/espace-pilates-web
git add . && git commit -m "..." && git push origin main
# Vercel auto-deploy via webhook
```

### Deploy site fluidbody.ch (PAS de git remote)

> ⚠️ `fluidbody-web` n'a **pas** de remote git → déploiement **manuel**.

```bash
cd /Users/xvan06/fluidbody-web
vercel --prod
```

### OTA app (sans rebuild natif)

```bash
cd /Users/xvan06/fluidbody
eas update --channel production --environment production --message "..."
eas update --channel production-tv --environment production --message "... TV"
```

### Build app (rebuild natif)

```bash
cd /Users/xvan06/fluidbody
eas build --profile production --platform ios       # iPhone
eas build --profile production-tv --platform ios    # Apple TV
```

### Soumission App Store

> ⚠️ **EN PAUSE** — pas avant le tournage des vidéos (MVP 19 séances). Une fois prêt : `eas submit --profile production --platform ios`.

### Modifier DNS

- Login **Infomaniak** → Domaines → DNS → `fluidbody.ch` ou `espace-pilates.ch`.
- ⚠️ Ne pas toucher MX/SPF/DKIM/DMARC pendant la bascule Vercel d'espace-pilates.ch.

### Déployer une edge function Supabase

```bash
cd /Users/xvan06/fluidbody
supabase functions deploy sign-video-url
supabase db push   # appliquer les migrations
```

---

## 10 · Comptes & accès

> 🔐 Credentials dans le gestionnaire de mots de passe de Yvan. Ce tableau **ne liste pas** les secrets — juste qui possède quoi et l'état 2FA.

| Service | Compte / identifiant | Owner | 2FA |
|---|---|---|---|
| Vercel | yvan@… | Yvan | ❓ à vérifier |
| Supabase | yvan@… | Yvan | ❓ à vérifier |
| Bunny CDN | yvan@… (pull zone `vz-1a4e2cac-0dc`) | Yvan | ❓ à vérifier |
| RevenueCat | yvan@… (entitlement `Fluidbody Pilates Pro`) | Yvan | ❓ à vérifier |
| Resend | yvan@… (domaine `fluidbody.ch`) | Yvan | ❓ à vérifier |
| Infomaniak | yvan@espace-pilates.ch | Yvan | ❓ à vérifier |
| Google Workspace | yvan@espace-pilates.ch | Yvan | ❓ à vérifier |
| Stripe | yvan@… (LIVE) | Yvan | ❓ à vérifier |
| Apple Developer | yvan@… (Team `R5V88AS9MX`) | Yvan | ✅ requis Apple |
| Sentry | yvan@… (région Frankfurt) | Yvan | ❓ à vérifier |
| EAS / Expo | `ytissot` | Yvan | ❓ à vérifier |
| GitHub | `yvan-glitch` | Yvan | ❓ à vérifier |
| Instagram @fluidbody.plus | `jellyfish@fluidbody.ch` | Yvan | 🟡 à activer |
| Instagram @fluidbody.ch | Espace Comptes Meta | Yvan | 🟡 à activer |
| Notion | yvan@… | Yvan | ❓ à vérifier |

> 💡 **Action :** auditer l'état 2FA de chaque service et remplir la colonne. Prioriser Stripe, Apple, Vercel, Supabase, GitHub (impact max).

---

## 11 · Limites connues & TODO

> ⚠️ Liste honnête des dettes & chantiers ouverts.

- [ ] **App Store soumission en pause** — bloquée tant que les vidéos ne sont pas tournées (MVP 19 séances).
- [ ] **Sentry : symbolication crashes natifs iOS non câblée** — wirer `sentry-cli` (upload dSYM/sourcemap) en hook post-publish EAS.
- [ ] **DownloadManager XOR ≠ DRM** — remplacer par `expo-secure-store` + clé dérivée par user.
- [ ] **WebViewScreenSaver Mac** — configurer l'URL `https://fluidbody.ch/veille` (FluidBody.saver natif KO).
- [ ] **Instagram 2FA** — activer sur @fluidbody.plus + @fluidbody.ch.
- [ ] **Bascule DNS espace-pilates.ch** — exécuter le runbook `MIGRATION.md` (apex encore sur Odoo).
- [ ] **Redirects 307 → 308** — passer en permanent après bascule réussie.
- [ ] **Forfaits Stripe (6)** — confirmer leur gestion (dashboard vs code `checkout.js` qui ne couvre que les 19 chaussettes).
- [ ] **Colonne 2FA (§10)** — auditer et remplir.
- [ ] **Builds** — vérifier les numéros réels via `eas build:list` (numéros mouvants).
- [ ] **Pricing** — exécuter la transition Founder 12.90/99 → 24.90/199 au bon moment.

---

## 12 · Glossaire

| Terme | Définition |
|---|---|
| **EAS** | Expo Application Services — pipeline de build & submit pour apps Expo. |
| **OTA** | Over-The-Air update — push de code JS sans rebuild natif ni passage App Store. |
| **Expo SDK** | Ensemble de libs natives pré-intégrées à React Native (version 54 ici). |
| **HLS** | HTTP Live Streaming — format vidéo adaptatif `.m3u8` (Bunny CDN). |
| **Token-Auth (Bunny)** | URL vidéo signée avec expiration (30 min) — bloque le hotlinking. |
| **Entitlement** | Droit d'accès payant côté RevenueCat (`Fluidbody Pilates Pro`). |
| **IAP** | In-App Purchase — achat intégré Apple (App Store prend ~15-30 %). |
| **JWT** | JSON Web Token — jeton d'auth signé (Supabase) prouvant l'identité user. |
| **Edge function** | Fonction serverless Supabase (Deno) exécutée près de l'utilisateur. |
| **Magic link** | Auth sans mot de passe — lien de connexion envoyé par email. |
| **Nitro Modules** | Nouvelle interface native RN (bypass l'ancien bridge TurboModule). |
| **New Arch** | Nouvelle architecture React Native (Fabric + TurboModules). |
| **UIGlassEffect** | API native iOS/tvOS 26 « Liquid Glass » (matériau translucide). |
| **DKIM / SPF / DMARC** | Standards anti-spoofing email (signature, expéditeurs autorisés, politique). |
| **Resend** | Service d'envoi d'emails transactionnels via API. |
| **Schema.org** | Vocabulaire de données structurées (JSON-LD) pour le SEO / rich results. |
| **Open Graph** | Métadonnées de partage social (titre/image/desc) pour liens. |
| **hreflang** | Balise SEO indiquant la langue/région alternative d'une page. |
| **sessionStorage** | Stockage navigateur effacé à la fermeture de l'onglet (≠ localStorage). |
| **BFCache** | Back/Forward Cache — snapshot de page restauré au bouton retour. |
| **cleanUrls** | Option Vercel masquant les `.html` dans les URLs. |
| **TTL** | Time To Live — durée de validité (DNS, URL signée, cache). |
| **Honeypot** | Champ caché anti-bot — rempli = spam détecté. |
| **CORS** | Politique navigateur autorisant/bloquant les requêtes cross-domaine. |
| **MTR (RevenueCat)** | Monthly Tracked Revenue — seuil de facturation RevenueCat. |
| **dSYM** | Fichier de symboles iOS pour décoder les crashes natifs (Sentry). |
| **Pull zone (Bunny)** | Point de distribution CDN tirant le contenu depuis l'origine. |

---

> 💡 **Fin du document.** Garder ce fichier à jour à chaque changement d'infra. Les sections les plus volatiles : numéros de build (§4.10), statut App Store (§4.11), bascule DNS (§2.1), colonne 2FA (§10).
