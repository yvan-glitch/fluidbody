# Audit Accessibilité — Fluidbody (WCAG 2.2 AA)

**Date** : 4 juin 2026
**Scope** : iOS / iPadOS / tvOS (le web n'est pas distribué)
**Codebase** : `/Users/xvan06/fluidbody` — `App.js` + `src/`
**Auditor** : analyse statique (lint a11y custom + lecture ciblée des écrans/composants critiques)

---

## TL;DR — score global estimé

| Critère WCAG 2.2 AA | Statut | Note |
|---|---|---|
| 1.1.1 Non-text content (images alt, SVG décoratifs) | Échec partiel | Aucun `accessibilityElementsHidden` sur les visuels animés (Méduse, Confetti, LivingBackground) → VoiceOver les annonce comme regroupements vides |
| 1.3.1 Info & relationships | Partiel | Tabs OK (`accessibilityRole="tab"` + `tablist`), modals non isolés |
| 1.4.3 Contraste texte normal | Partiel | `textTertiary: rgba(255,255,255,0.4)` (~3.5:1 sur `#001a2e`) utilisé à fontSize 11-13. Placeholders à `0.3-0.4` également sous le seuil |
| 1.4.4 Resize text 200% | **Échec** | Aucun `allowFontScaling={true}` explicite, mais surtout AUCUN ajustement de layout pour Dynamic Type → la moitié des libellés tronquent dès XL accessibility |
| 1.4.10 Reflow | À risque | Layouts en valeurs absolues (`SCALE` × 390) sans `flexWrap` ni testing à xxx-Large |
| 1.4.11 Non-text contrast | Partiel | Borders 1px à `rgba(255,255,255,0.08)` invisibles. Filtres "active" reposent uniquement sur lime sur dark (OK ~9:1) mais 1px de border vs 0.08 alpha = invisible |
| 2.1.1 Keyboard / TV remote | Partiel | tvOS focus engine utilisé sur écrans principaux ; **pas** sur les onboardings, paywall, profil édition |
| 2.2.2 Pause/stop/hide (animations) | **Échec** | 187 `Animated.*` dans l'app ; seul `LiquidGlassEnhanced` respecte `isReduceMotionEnabled`. Confetti + StreakCelebration + Méduse + LivingBackground ignorent le flag |
| 2.4.6 Headings & labels | Partiel | `accessibilityRole="header"` JAMAIS utilisé. Les titres de section sont des Text bruts |
| 2.5.5 Target Size (Enhanced AAA, AA = 24) | Partiel | Plusieurs touchables 24-28pt sans hitSlop suffisant (volume slider VideoPlayer 24pt, fermer X 28pt avec hitSlop 10 OK) |
| 3.3.2 Labels or instructions | OK | TextInput ont tous `accessibilityLabel` |
| 4.1.2 Name/Role/Value | **Échec partiel** | Coverage VoiceOver label moyenne ~22% sur les Touchables (cf. tableau §1) |
| 4.1.3 Status messages | **Échec** | Aucun appel à `AccessibilityInfo.announceForAccessibility` (success Stripe, erreurs réseau, paywall purchase) |

**Score global estimé : 48/100** — niveau « partial AA, fail Apple App Accessibility nutrition label si revue manuelle ».
Pour atteindre **AA acceptable** (≥ 80/100) : ~2-3 jours focus a11y + sweep côté Sabrina pour valider VoiceOver sur device.

---

## 1. VoiceOver labels — coverage par fichier

Méthode : `grep -c "TouchableOpacity\|Pressable\|GlassPressable\|GlassButton"` vs `grep -c "accessibilityLabel\|accessibilityRole"`.
**Note importante** : `GlassButton` (et `GlassPressable`) auto-injecte `accessibilityLabel` à partir des `children` si c'est une string, et `accessibilityRole="button"` par défaut → la vraie coverage est supérieure au ratio brut. Néanmoins beaucoup d'écrans appellent directement `TouchableOpacity` brut.

| Fichier | Touchables | a11y attribs | % | Severity |
|---|---|---|---|---|
| `src/screens/MonCorps.js` | 92 | 11 | **12%** | Critical (écran d'accueil) |
| `src/screens/Profil.js` | 98 | 23 | 23% | Important |
| `App.js` (onboarding, AuthScreen, OnboardingScreen, MainApp tabs) | 46 | 11 | 24% | Critical (parcours signup) |
| `src/screens/Activity.js` | 18 | 2 | 11% | Important |
| `src/screens/Resume.js` | 11 | 3 | 27% | Important |
| `src/screens/SignIn.js` | 12 | 2 | 16% | Critical (inputs labellisés mais boutons Apple/Google non) |
| `src/screens/Bibliotheque.js` | 15 | 8 | 53% | Minor |
| `src/screens/ProgramBuilder.js` | 12 | 0 | **0%** | Important |
| `src/screens/MyPrograms.js` | 14 | 0 | **0%** | Important |
| `src/screens/Timer.js` (cmp) | 18 | 0 | 0% | Important |
| `src/screens/PaywallModal.js` | 20 | 10 | 50% | Critical (achat) |
| `src/components/VideoPlayer.js` | 27 | 12 | 44% | Critical (CTA principal) |

**Global** : `625 touchables / 156 a11y attribs ≈ 25% coverage`.
En tenant compte de l'auto-derivation `GlassButton/GlassPressable` (qui couvre ~150 instances dans Profil/Bibliotheque/PaywallModal), la coverage réelle est probablement **40-45%** — toujours sous le seuil AA.

### Touchables principaux manquants identifiés
- `App.js:351` — TouchableOpacity onboarding (pilier "Commencer maintenant") — pas de label
- `App.js:2283` — TouchableOpacity "On va créer ton programme" (CTA d'onboarding sur l'écran tension zones) — pas de label
- `App.js:1163,1180` — TouchableOpacity "Pas de compte ? Se connecter" sur AuthScreen — pas de label
- `src/screens/MonCorps.js` orbs / catégories ligne 700+ (tap zone tension du corps) — vérifier individuellement
- `src/components/VideoPlayer.js:874` — bouton PiP/fullscreen — pas de label
- `src/components/VideoPlayer.js:885` — Pressable volume slider 90×24 — pas de label, pas d'`accessibilityValue` (slider muet pour VoiceOver)
- `src/components/Timer.js` — 18 touchables stretch/breath presets, 0 a11y

---

## 2. Contraste couleur

### Brand
| Combo | Ratio | Verdict |
|---|---|---|
| `#FFFFFF` sur `#000a1a` | **18.7:1** | OK (AAA) |
| `#AEEF4D` (accent) sur `#000a1a` | **~13:1** | OK |
| `#AEEF4D` sur `#000e18` | ~9:1 | OK |
| `#E5FF00` (CTA jaune) sur `#000a1a` | ~18:1 | OK |
| `#3E7E00` (accentText light) sur `#FFFFFF` glass | ~5.1:1 | OK (déjà choisi pour AA dans `theme/index.js`) |

### Failures identifiés
| Combo | Ratio approx | Usage | Severity |
|---|---|---|---|
| `rgba(255,255,255,0.45)` sur `#001a2e` | **~3.6:1** | `MonCorps.js:1696,1804,1822,1845` (sous-titres section), `HealthKitConnect:209` (disclaimer privacy) | Critical (texte 13pt < 18pt large) |
| `rgba(255,255,255,0.4)` sur `#000a1a` (= `textTertiary` du dark theme) | **~3.4:1** | Default exporté du theme, utilisé dans Resume `body_neglected` 11pt, MonCorps `search_no_results` 15pt | Critical |
| `rgba(255,255,255,0.3)` sur `#000a1a` | **~2.4:1** | Profil:716 (footer fluidbody.app 9pt), placeholder TextInput Profil édition | Critical (échec même AA large) |
| `rgba(255,255,255,0.35)` sur dark | ~2.9:1 | Profil:1814 (légende admin), MonCorps quotes italiques | Important |
| `rgba(255,255,255,0.5)` sur dark | ~4.4:1 | Profil:712,1779, MonCorps:2000 etc. | Borderline AA — passe pour ≥ 18pt, fail à 12 |
| `rgba(229,255,0,0.25)` sur dark (divider OU) | n/a (border) | SignIn divider | OK (non-text 1.4.11 seuil 3:1 — passe) |
| `rgba(255,140,140,0.95)` (error msg) sur dark | ~5.5:1 | SignIn:316 | OK |
| Borders à `rgba(255,255,255,0.08)` (theme.colors.hairline) | ~1.1:1 | Partout (séparateurs) | Échec 1.4.11 mais cohérent avec liquid glass — acceptable car décoratif si non porteur d'info |

**Conclusion contraste** : le theme dark a `textSecondary: rgba(255,255,255,0.62)` (OK ~5.7:1) mais `textTertiary: 0.4` est en dessous. Les hardcoded `rgba(255,255,255,0.30-0.50)` dispersés dans 50+ lignes contournent même le palier `textTertiary`. **Vrai impact** : utilisateur âgé (50+, c'est la cible Sabrina rappelons-le) ne distingue pas les sous-titres de section dans MonCorps.

---

## 3. Dynamic Type / Font scaling

**Trouvé** :
- `955 fontSize:` codés en dur dans `src/` + `App.js`
- **0** `allowFontScaling`
- **0** `maxFontSizeMultiplier`
- **0** import `PixelRatio.getFontScale()` ou `useWindowDimensions()` pour scaler dynamique

Par défaut RN active `allowFontScaling=true` sur `<Text>`, donc Dynamic Type marche techniquement. **Mais** :
- Aucun layout n'est testé/réservé pour 200% (xxx-Large) → libellés CTA tronquent (Glass button `numberOfLines={1}` → ellipsis silencieux)
- Aucun `maxFontSizeMultiplier` pour clamper → les textes 32pt du hero deviennent 64pt et cassent la mise en page
- `SCALE` (basé largeur 390) est appliqué à `fontSize` mais ne tient pas compte du scaling Dynamic Type

**Recommandation** : poser `maxFontSizeMultiplier={1.5}` sur tous les `<Text>` de hero (fontSize > 24) pour éviter le breakage, **laisser** Dynamic Type opérer sur le body (≤ 18pt) et tester en xxxLarge.

---

## 4. Hit targets (≥ 44pt WCAG 2.5.5 AAA, ≥ 24pt AA)

- `hitSlop` présent **48 fois** dans la codebase.
- `GlassPressable` injecte `hitSlop=8` par défaut → toutes les pills/CTA passent.
- `Pressable` natif (VideoPlayer skip 10s) : hitSlop=14 → OK.

### Touchables sous 44pt sans hitSlop
| Lieu | Taille | hitSlop | Verdict |
|---|---|---|---|
| `VideoPlayer.js:885` volume slider | 90×**24** | aucun | Échec 24pt (passe AA mais inconfortable, surtout en mouvement) |
| `VideoPlayer.js:874` bouton PiP | 28×28 | 10 | OK (48×48) |
| `VideoPlayer.js:871` bouton close | 28×28 | 10 | OK |
| `GlassSheet.js:107` close modal | 30×30 | 8 (default) | OK (46×46) |
| `HeartRatePill.js:112` | 30 height | non vérifié | À auditer |
| `App.js:505` back btn modals | 36×36 | aucun explicite | Borderline — 36pt OK pour AA simple |

**Bottom line** : conformité AA OK sur les hit targets grâce à GlassPressable. Le volume slider VideoPlayer est le seul vrai défaut.

---

## 5. Focus management modal

- **0** `accessibilityViewIsModal` dans toute la codebase
- **0** `accessibilityElementsHidden` sur le contenu sous-jacent lorsqu'un Modal est ouvert
- **0** appel `AccessibilityInfo.setAccessibilityFocus(ref)` pour rediriger le focus VoiceOver sur le titre d'un modal qui s'ouvre

**Impact** : avec VoiceOver, ouvrir `PaywallModal` ou `StreakCelebration` laisse le focus VO sur le bouton qui a déclenché l'ouverture → l'utilisateur ne sait pas qu'un modal est apparu. Quand il swipe, VO peut sortir du modal vers le contenu sous-jacent. **WCAG 2.4.3 fail.**

---

## 6. Reduce motion

```bash
grep "AccessibilityInfo|isReduceMotionEnabled|prefersReducedMotion" → 4 hits, TOUS dans LiquidGlassEnhanced.js
```

**187 animations** identifiées dans `src/components/`. Seul `LiquidGlassEnhanced` réagit à `reduceMotionChanged`.

Animations problématiques pour utilisateurs sensibles au mouvement (vestibular disorder, migraine) :
- `Meduse.js` — méduse animée plein écran fond MonCorps (tentacles + bulles)
- `LivingBackground.js` — gradient/particles animés
- `Confetti.js` — 60 particules en chute, durée 2s, déclenché à chaque fin de séance
- `AnniversaryOverlay.js` — confetti × 45 + apparition
- `StreakCelebration.js` — overlay full-screen avec animations
- `WelcomeAnimation.js` — séquence welcome
- `BreathingCheckIn.js` — respiration animée (utile mais pas désactivable)
- `Confetti` post-session — déclenchement automatique

**WCAG 2.3.3 + 2.2.2 fail.**

---

## 7. Color blind compatibility

Bon point : les états "actif" combinent **couleur + texte + border** (cf. `App.js:2272` tension zones — bg lime alpha, border lime, text lime, fontWeight 700). Pas d'indication purement basée couleur identifiée.

Errors auth = texte rouge + libellé explicite (« Email invalide »).
Success Stripe = pas de feedback couleur seul.

**Verdict** : 1.4.1 Use of color — OK.

---

## 8. Apple TV focus engine

`tvFocusProps` utilisé **41 fois**, `hasTVPreferredFocus` 6 fois (via le helper qui le pose conditionnellement).

Composants TV bien câblés : `TVCard16x9`, `FocusableCardTV`, `HorizontalCarousel`, `TVHeaderBar`, `PilierPanelTV`, `HeroFeatured`, `TwoColLandingTV`, `VideoPlayer` (close, skip10, playPause), `MonCorps` orbs, `TVLoginScreen`.

**Manquant** :
- `PaywallModal` sur tvOS — pas de `tvFocusProps` sur les CTA mensuel/annuel
- `ProfileOnboarding` étapes — n'est pas rendu sur TV (OK)
- `Activity` / `Statistics` — n'utilisent pas `tvFocusProps` (probablement OK si TV affiche un autre écran, à vérifier)
- `TVFocusGuide` — **0 hit** — pas de focus guides pour gérer les "trous" focus

**Risque** : si un écran TV se charge sans `hasTVPreferredFocus={true}` sur un élément, le focus tombe arbitrairement et la Siri Remote ne navigue plus.

---

## 9. Screen reader announcements

`AccessibilityInfo.announceForAccessibility` : **0 hit**.

Manque critique :
- Magic link envoyé (« Lien magique envoyé sur ton email »)
- Achat réussi / restauré
- Erreur réseau
- Séance complétée
- Streak augmenté

Sans annonces, VoiceOver reste muet sur ces transitions = utilisateur ne sait pas que ça a marché.

---

## 10. Form inputs

Tous les `TextInput` identifiés ont un `accessibilityLabel` explicite. **OK 3.3.2.**

À surveiller :
- Pas d'`accessibilityHint` (« Format jour-mois-année », « 4 chiffres minimum »)
- Pas d'`onSubmitEditing` chainé pour passer du champ email → password → submit avec VoiceOver
- `secureTextEntry` OK sur password — VO annonce bien « champ sécurisé »

---

## Top 10 quick wins (estimé < 1 jour à 2 personnes)

1. **Wrapper `AccessibleButton`** — créer `src/components/ui/AccessibleButton.js` qui force `accessibilityRole="button"` + `accessibilityLabel` obligatoire (proptype/TS), import-replace les `TouchableOpacity` les plus criants. Effort : 3h pour le composant + sweep.
2. **Ajouter `accessibilityElementsHidden={true}` et `importantForAccessibility="no-hide-descendants"`** sur `Meduse`, `LivingBackground`, `Confetti`, `WelcomeAnimation` racines View. Effort : 30 min. Impact : VO arrête d'annoncer du vide.
3. **Hooker `useReducedMotion()`** custom hook depuis `LiquidGlassEnhanced.js` (déjà écrit), l'utiliser dans `Confetti`, `StreakCelebration`, `AnniversaryOverlay` pour skip l'anim et flasher juste une opacity 0→1. Effort : 2h.
4. **Replace `textTertiary` `rgba(255,255,255,0.4)` → `0.62`** dans `theme/index.js` darkTheme (passe 5.7:1) — un seul changement, propagation auto.
5. **Audit + remplacement des 17 `rgba(255,255,255,0.45)` et 19 `0.3`** par `textSecondary` ou `textTertiary` via `theme.colors.*`. Effort : 1h grep/replace + relecture.
6. **`accessibilityViewIsModal={true}`** sur le View racine de chaque Modal full-screen (`PaywallModal`, `StreakCelebration`, `AuthScreen`, `OnboardingScreen`, `Profil` édition modals). Effort : 30 min.
7. **`AccessibilityInfo.announceForAccessibility(msg)`** sur 5 transitions critiques (magic link envoyé, achat OK, séance terminée, erreur réseau, streak +1). Effort : 1h.
8. **`accessibilityRole="header"`** sur les `<Text>` titres de section dans MonCorps, Profil, Bibliotheque, Resume. Effort : 1h sweep.
9. **`maxFontSizeMultiplier={1.5}`** sur tous les Text fontSize ≥ 24 (hero, CTA labels). Effort : 1h sweep + test xxxLarge.
10. **Labels des 8 CTA principaux non labellisés identifiés** (App.js:2283 "créer programme", VideoPlayer volume, VideoPlayer PiP, App.js:1163 "Pas de compte", etc.). Effort : 30 min.

---

## Composants utility à créer

| Composant | Rôle | Localisation |
|---|---|---|
| `AccessibleButton` | wrapper qui force label + role, props alignées sur GlassButton mais sans le visuel | `src/components/ui/AccessibleButton.js` |
| `useReducedMotion()` | hook qui retourne le flag + écoute les changements (factorise le code de LiquidGlassEnhanced) | `src/hooks/useReducedMotion.js` |
| `useAnnounce()` | hook qui expose `announce(msg, queue)` — wraps `AccessibilityInfo.announceForAccessibility` avec debounce | `src/hooks/useAnnounce.js` |
| `A11yText` | wrapper Text qui pose `maxFontSizeMultiplier` + `accessibilityRole` selon une prop `variant="header"\|"body"\|"caption"` | `src/components/ui/A11yText.js` |
| `Decorative` | View qui pose `accessibilityElementsHidden` + `importantForAccessibility="no-hide-descendants"` — pour wrapper Méduse/Confetti/etc | `src/components/ui/Decorative.js` |

---

## Estimation effort pour AA acceptable

- **Quick wins (top 10)** : ~1.5 jour focus, par 1 dev qui connaît le code (Yvan ou un sous-traitant junior brieffé).
- **Sweep complet labels Touchables** (passer de 25% à 80%) : 1 jour additionnel.
- **Tests VoiceOver device réels** (Sabrina + 1 testeur âgé) : 0.5 jour + corrections.
- **Tests Dynamic Type xxxLarge** + ajustement layouts cassés : 0.5-1 jour.

**Total réaliste : 3-4 jours** pour passer de l'état actuel à un niveau « AA défendable pour soumission App Store + Apple App Accessibility nutrition label ».

Pour un niveau AAA (Apple Watch Vision Pro-quality) : ajouter 3-4 jours supplémentaires (rotor VO, custom actions, focus order revisé, switch control).

---

## Annexe — checklist priorisée par severity

### Critical (bloquant pour cible 50+ et VoiceOver users)
- [ ] Wrapper `AccessibleButton` + sweep des 75% touchables sans label
- [ ] Fixer `textTertiary` dans le theme + remplacer les rgba alpha < 0.55 dans les 50+ sites
- [ ] `accessibilityViewIsModal` sur PaywallModal, AuthScreen
- [ ] Reduce motion sur Confetti + StreakCelebration

### Important
- [ ] `Decorative` wrapper sur Méduse, LivingBackground, WelcomeAnimation
- [ ] `accessibilityRole="header"` sur titres de section
- [ ] Announcements transitions critiques
- [ ] `maxFontSizeMultiplier` sur hero text
- [ ] Volume slider VideoPlayer : `accessibilityRole="adjustable"` + `accessibilityValue`

### Minor
- [ ] `accessibilityHint` sur TextInput format date
- [ ] Focus VO redirigé sur titre modal au open
- [ ] Audit TVFocusGuide pour les écrans TV qui ont des trous
- [ ] PaywallModal sur tvOS : `tvFocusProps` sur CTA mensuel/annuel
