# Roadmap — Apple TV : business case

**TL;DR** : Apple TV est le **vrai** différenciateur Fluidbody face à Glo,
Alo Moves, Fluidform et Peloton. C'est la promesse "Pilates dans le salon
devant la télé" — un canal premium que les concurrents directs ne couvrent
pas, ou couvrent mal (apps tvOS de Glo limitées au catalogue vidéo, sans
intégration Watch/HealthKit). Coût d'opportunité de ne **pas** le faire :
laisser ce segment ouvert à un concurrent. Coût direct : ~6 semaines de dev
+ frais Apple Developer existants.

## Le pitch en une phrase

> *"Allume ta télé, pose ton tapis, choisis ta séance — Fluidbody affiche
> ton anneau d'activité et te guide. Pas besoin de regarder ton téléphone
> posé par terre."*

## Pourquoi maintenant

### 1. Le moment marché est bon

- **Apple TV 4K (3e gen, 2022)** est dans les foyers depuis 3 ans → base
  installée mature, Yvan vise iOS 17+ et tvOS 17+ par défaut.
- **Adoption Pilates** post-pandémie reste haute (≈+40 % vs 2019 selon
  ClassPass benchmarks). Le segment "home wellness" est explicitement
  visé par Apple (rebranding Fitness+ qui prend de la place sur tvOS).
- **Aucun concurrent direct n'a une app tvOS de Pilates premium**
  vraiment polish. Glo et Alo Moves ont des apps tvOS basiques (catalogue
  + lecture vidéo). Fluidform (l'app que Yvan a citée comme inspiration
  côté UX) **n'a pas** d'app tvOS. Peloton est généraliste, pas focus
  Pilates.
- Apple TV est l'écran de la pièce de vie. Faire ses exercices devant le
  TV plutôt que le téléphone est l'usage naturel pour le Pilates au
  tapis — exactement le format de Fluidbody.

### 2. Le différenciateur est défendable

Yvan donne lui-même les cours (espace-pilates.ch). L'app est positionnée
premium : production vidéo soignée, traduit en 4 langues, paywall pas
agressif. Sur le marché TV :

- Les apps qui dominent sont **les marketplaces** (Apple Fitness+, Glo). Une
  app **expert-driven** (Yvan = visage de la marque) sur TV a un
  positionnement boutique différent — moins de volume, meilleur LTV.
- L'intégration native iPhone ↔ Apple Watch ↔ Apple TV (lancer la séance
  depuis le téléphone, voir le BPM sur la montre, jouer la vidéo sur la
  TV) est **techniquement faisable** (Continuity Camera, Handoff) et est
  un wow-factor que les concurrents généralistes n'auront pas avant
  longtemps.

### 3. Le coût n'est pas prohibitif

- **Pas de nouveau compte Apple Developer** : le compte iOS existant
  (Team `R5V88AS9MX`) couvre tvOS sans frais additionnels.
- **Pas de nouveau plan RevenueCat** : tvOS est inclus dans le pricing
  RevenueCat actuel (free tier jusqu'à $2.5k MTR, payant ensuite).
- **Pas de nouveau backend** : Supabase + Bunny CDN sont déjà OK pour
  servir une app tvOS (REST + HLS).
- Effort dev unique : ~6 semaines pour MVP soumissionable, ~4 j/an de
  maintenance ensuite (rebasing fork RN à chaque upgrade Expo).

## Target audience tvOS

Profil personae estimé :

1. **L'abonnée fidèle iPhone qui veut grandir l'écran** (60 % du segment).
   Déjà abonnée Fluidbody. Achète une Apple TV ou la possède déjà. Pratique
   à la maison 3-5 fois par semaine. Veut voir Yvan en grand et garder son
   téléphone hors du tapis.
2. **Le couple/famille qui découvre via TV** (25 %). N'utilise pas
   l'app iPhone. Cherche dans l'App Store tvOS "Pilates" / "wellness" et
   trouve Fluidbody. Convertit via le paywall TV directement.
3. **Le sénior qui n'aime pas son téléphone** (15 %). Utilisateur léger
   iPhone, beaucoup de temps libre. Apple TV est l'écran principal. Aime
   "allumer la télé et que ça marche".

## Métriques à instrumenter pour valider le pari

À ajouter dans `analytics` (existant ou nouveau) :

- `tv_app_launched` (par session, anonymisé device_id)
- `tv_seance_started` / `tv_seance_completed` (avec pilier + durée)
- `tv_paywall_shown` / `tv_paywall_purchased` (conversion TV vs iPhone)
- `tv_login_method` (QR code vs magic link vs already-signed-in via family)

Hypothèse à tester en 3 mois post-launch : **20 % des sessions premium ont
au moins une lecture vidéo TV/semaine**. Si oui → c'est un canal viable.
Si < 5 % → reconsidérer maintenance vs sunset.

## Marketing angle "Pilates dans le salon"

Asset à produire pour le launch :

1. **Hero video 30 s** : Yvan dans son salon, allume la TV, slide la
   Siri Remote, choisit une séance, déroule son tapis, commence. Aucun
   téléphone à l'écran.
2. **Tagline FR/EN/ES/IT** : "Le Pilates change de pièce." / "Pilates,
   meet your living room." / "Pilates en tu salón." / "Pilates entra in
   salotto."
3. **App Store tvOS screenshots** (1920×1080 ou 3840×2160) — 5 max,
   focus sur : home screen avec piliers en cards, vidéo plein écran avec
   Yvan en démo, overlay avec timer + nom séance, paywall premium,
   transition entre séances.
4. **Page landing dédiée** `fluidbody.app/tv` ou section dans
   `docs/index.html` actuel — embed la hero video + un CTA App Store tvOS.
5. **Comm Instagram / TikTok** : 3 reels "Fluidbody arrive sur Apple TV"
   pre-launch + 1 reel post-launch "comment ça marche".

## Coût total de possession (TCO) estimé

| Poste | Coût initial | Coût récurrent |
|---|---|---|
| Dev MVP (Yvan, 6 sem solo) | 0 € (cash) / 6 sem opp.cost | — |
| Apple Developer | 0 (déjà payé) | — |
| RevenueCat | 0 | $0-$8/mo selon MTR (free tier large) |
| Bunny CDN bande passante TV (4K HLS) | — | +30-50 % vs iPhone (à monitorer) |
| Sentry events tvOS | 0 | inclus dans tier actuel |
| Maintenance fork RN-tvOS | — | 1-2 j par upgrade SDK Expo (2x/an) |
| App Store Connect tvOS submission | 0 | — |
| Marketing assets (hero video, screenshots) | ~1-2 j prod | — |
| **Total an 1** | **6-7 sem dev** | **~$5-10/mo + 4 j maintenance** |

## Risques

| Risque | Impact | Mitigation |
|---|---|---|
| RevenueCat RN wrapper cassé sur tvOS | bloque paywall = bloque monétisation | Implémenter bridge Swift minimal vers RevenueCat iOS SDK natif (~2 j extra) ou REST API fallback |
| Apple TV install base trop petite chez les abonnées Fluidbody | feature peu utilisée, ROI négatif | Pre-launch poll sur Instagram : "vous avez une Apple TV ?" + analytics post-launch |
| Apple impose modifs UX au review tvOS | délai de submission | Suivre les Apple TV Human Interface Guidelines à la lettre dès phase 2 |
| Rebasing fork-RN devient lourd | dette technique croissante | Surveillé via dépendabot ; si > 1 sem par upgrade, revoir stratégie (peut-être SwiftUI à ce moment-là) |
| Yvan a une période chargée d'enseignement | les 6 sem deviennent 6 mois | Phase 1 = juste valider que ça démarre. Si plus de bande passante, sunset propre via la branche. |

## Décision recommandée

**GO**. Le rapport coût/différenciation est favorable, l'effort initial
est borné, la maintenance est gérable. Le risque principal (RevenueCat)
a un fallback. Aucun concurrent direct n'occupe le terrain → fenêtre
d'opportunité.

**Condition** : pre-launch poll Instagram (1 jour) pour estimer la base
Apple TV de l'audience Fluidbody. Si > 25 % de "oui j'en ai une", GO
immédiat. Si < 10 %, repousser de 6 mois (le marché grandit).
