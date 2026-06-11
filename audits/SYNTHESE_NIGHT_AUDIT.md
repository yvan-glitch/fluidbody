# Synthèse — Audit nocturne FluidBody

**Date** : 2026-06-04 (nuit) · 7 audits · lecture seule, aucun fix appliqué
**Build #95 iOS prod** : lancé + auto-submit programmé → https://expo.dev/accounts/ytissot/projects/fluidbody/builds/f878aa06-3bb6-4df9-89e2-50f6d5f99a64

---

## 1. TL;DR — top 3 par audit

**Safe Area / Dynamic Island** — 16 findings (6 HIGH). Modals fullScreen n'héritent pas des insets → boutons close/back à `top:56` passent sous l'island sur 17 Pro Max. Pattern de fix déjà éprouvé (SabrinaProfile). HIGH les plus chauds : SeanceDetailModal, PaywallModal close, BreathingCheckIn, Timer, HealthKitConnect, MonCorps PilierDetail.

**Sécurité** — Posture **solide**. 0 critique sécu, 1 HIGH **fonctionnel** : `delete_my_account` casse (colonne `tv_pairings.user_id` inexistante). RLS 100%, aucun secret bundlé, Bunny signé server-side, Sentry sans PII.

**i18n** — App = **fr/en uniquement** (CLAUDE.md ment, dit 4 langues). FR↔EN à 100%. ~10 strings FR hardcodées régressent côté EN (cartes Programmes MonCorps, badge NOUVEAU, "Politique de confidentialité").

**Perf / Bundle** — ~2 MB d'assets morts supprimables en 5 min ; ~4-6 MB IPA récupérables (WebP photos Sabrina). 0 `React.memo`, 0 `FlatList` (tout en ScrollView+map). 1 vraie fuite mineure (loop splash sans cleanup, App.js:2732).

**App Store** — Submittable à **80%**. 1 seul vrai blocker rejection = le bug delete_my_account. HIGH : strings micro/reminders boilerplate, URLs `/terms/` peut-être 404, Privacy/Terms inaccessibles hors paywall.

**OTA** — Cause root **non prouvée**. Piste #1 : build #93 livré sans header `expo-channel-name=production` → client ne demande pas le bon manifest, masqué par silent-catch du banner. Aussi : OTA s'applique au **2e** cold start, pas au 1er.

**A11y** — Score ~48/100 (partial AA). VoiceOver labels ~25-45%. 0 reduce-motion (sauf LiquidGlass), 0 `accessibilityViewIsModal`, contrastes `rgba blanc 0.3-0.45` sous seuil — **critique pour cible 50+**.

---

## 2. Bloqueurs CRITIQUES (rejet App Store / sécu réelle)

1. **`delete_my_account` cassé** (`20260521000000_delete_account.sql:71`) — référence `tv_pairings.user_id` inexistant → THROW pour tout user ayant pairé une TV. **Apple 5.1.1(v) = rejet garanti.** Cité par 2 audits (SECURITY H-1, APP_STORE CRITICAL-1). **Fix = one-liner SQL** : `delete ... where redeemed_user_id = $1` + `supabase db push`.

2. **URLs `/terms/` et `/terms/en/` peut-être en 404** — paywall y pointe ; repo local privacy n'a que `index.html`. À vérifier par `curl -sI` avant submit (sinon rejet 1.5 / 5.1.1).

> Aucun autre bloqueur rejection-grade. Le reste = "Apple demandera de fixer en révision 1".

---

## 3. Quick wins consolidés (< 30 min chacun)

- **Fix SQL delete_my_account** (~5 min + push) — débloque le submit.
- **Corriger CLAUDE.md** : 4 langues → fr/en (évite que tout agent cherche es/it fantômes).
- **Supprimer 11 assets non-référencés** (`git rm`) → **−2 MB IPA**, 0 risque.
- **Override strings micro/reminders** dans `app.json infoPlist` (boilerplate Expo → texte honnête).
- **Gater les 6 `console.*` restants** (`DownloadButton:111`, `safeNativeCall:53`…) — CLAUDE.md affirme 100% gated, c'est ~95%.
- **`accessibilityElementsHidden`** sur Méduse/LivingBackground/Confetti (VO arrête d'annoncer du vide).
- **theme `textTertiary` 0.4 → 0.62** (un seul changement, passe contraste AA partout).
- **~12 clés i18n** pour cartes Programmes + helper `sessionBadges` pour "NOUVEAU".
- **Curl `/terms/`** pour trancher HIGH-3.

---

## 4. Recommandations priorisées

| Prio | Action | Effort |
|---|---|---|
| **P0** | Fix SQL `delete_my_account` + déployer + test E2E suppression avec TV pairée | 35 min |
| **P0** | Vérifier 200 sur `/terms/` et `/terms/en/` GitHub Pages | 5 min |
| **P1** | Strings micro/reminders + lien Privacy/Terms dans Profil (hors paywall) | 35 min |
| **P1** | Phase 1 Safe Area : 6 fixes HIGH (modals fullScreen) | ~2 h |
| **P1** | i18n : strings FR hardcodées qui régressent en EN + CLAUDE.md | 30 min |
| **P2** | Quick wins assets morts + console + WebP `apple-watch-hero` | 45 min |
| **P2** | A11y critiques : labels CTA, reduce-motion Confetti/Streak, modal isolation, contrastes | 1.5 j |
| **P2** | OTA : Test A (lire Expo.plist IPA) + Patch P1/P4 dans build #95 pour trace Sentry | 1 h |
| **P3** | Perf mid-term : `React.memo` cartes TV, `FlatList` SeanceCarouselRow/Bibliotheque, WebP batch photos | 1-2 j |
| **P3** | A11y sweep complet (25%→80% labels) + tests VoiceOver/Dynamic Type device | 2-3 j |

**Effort minimal "submittable"** : ~2-3 h dev + 1 push Pages.

---

## 5. Décisions à prendre par Yvan

1. **es/it : on drop officiellement ?** Reco audit i18n = oui (cible = Suisse romande FR + EN filet). Sinon stub ou vraie trad (~1400 strings).
2. **OTA : stratégie** — acter "OTA = confort, pas garantie" ? Fix critiques → build natif, contenu → OTA. + intégrer bouton "Force OTA check" dans Profil (diagnostic permanent).
3. **expo-av → expo-video** : migrer maintenant (supprime besoin micro) ou override la string et migrer post-submit ?
4. **A11y : niveau visé** — AA défendable (3-4 j) vs polish minimal pré-submit (top-10 quick wins, 1.5 j) ? Cible 50+ rend le contraste/VoiceOver plus qu'un nice-to-have.
5. **Photos coach WebP** — script de pré-build ou re-encode manuel ? (−6 MB tvOS).

---

## 6. Ce qui est solide / positif

- **Sécurité exemplaire** : RLS sur 100% des tables sensibles, deny-by-default sur tables backend, Bunny signé server-side (TTL 30 min, aucun GUID bundlé), Sentry strip PII, ATS HTTPS-only, 0 secret server-only exposé.
- **Compliance Apple quasi-complète** : Privacy Manifest + Collected Data en règle, Sign in with Apple présent, IAP RevenueCat exclusif (0 Stripe), Restore + terms d'abo affichés, disclaimer médical, ITSAppUsesNonExemptEncryption=false.
- **i18n FR↔EN à 100%** (693 clés, 0 manquante). Formats dates/prix localisés proprement.
- **Code RN propre** : ~40 loops/intervals scannés, 1 seule fuite mineure. `useNativeDriver:false` tous légitimes.
- **A11y bons points** : pas d'info portée par la couleur seule, hit targets OK via GlassPressable, inputs tous labellisés, focus tvOS bien câblé sur écrans principaux.
- **Pas de "à vie", pas de Speir, pas de claim trompeur.**

---

**Bottom line** : un seul caillou bloque vraiment le submit — le bug SQL `delete_my_account`. Patché + `/terms/` vérifié, l'app passe la review. Le reste est de la dette priorisable, pas du rouge.
