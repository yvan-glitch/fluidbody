# 🌙 Audit nocturne app FluidBody+ iOS & tvOS

> Rapport consolidé des audits effectués sur l'app FluidBody+ (iOS + Apple TV) en mode **OTA-friendly strict** : aucun rebuild natif, aucune submit, garde-fous max.

---

## 📊 Résumé

| Volet | Statut |
|---|---|
| **iOS — perf + polish** | ✅ Branche feature pushée, **pas mergée**, **pas déployée OTA** |
| **Apple TV — focus + perf** | ✅ Audit terminé — **aucune modif** car code déjà très bon |
| **Sécurité / monitoring** | ✅ Sentry breadcrumbs ajoutés, npm audit 0 HIGH/CRITICAL |

---

## ✅ iOS — Branche `feat/app-night-audit-iOS` (commit `988cdb4`)

### Bundle & dépendances
- **node_modules : 467 Mo**
- Top 5 : `react-native` 83M, `@sentry` 44M, `@expo` 37M, `expo` 30M, `typescript+@react-native` ~23M (dev-only)
- **Rien d'anormal** — pas de package surdimensionné côté runtime

### Console.log en prod
- **0 ungated**. Les 7 hits trouvés sont tous gatés (`__DEV__`, wrappers `devLog/devWarn`, ou flag `DIAGNOSTIC_NATIVE_CALLS=false`). ✅ RAS

### Animations
- **13 `useNativeDriver: false`** mais **toutes légitimes** (largeur progress bar Timer/charts, stroke SVG ActivityRings, count-up par listener PaywallModal)
- Aucune corrigeable sans casser l'anim
- **Pas de fuite mémoire** : intervals/listeners tous nettoyés dans cleanup

### Liquid Glass v3 amplifié
- `GlassView` → `glassStyle: "clear"` (lens-warp natif iOS 26) par défaut sur iOS 26+ quand `enhanced`
- `tintIntensity` 0.10 → **0.14**
- `breathingHighlight` amplifié 0.3 → **0.7** (flag `amplify`, **iPhone seulement**, tvOS #88 intact)
- Booste globalement : Paywall, MonCorps orbs, CTAs enhanced
- **Pas** d'`enhanced` ajouté sur les listes Bibliothèque/Profil (2 `Animated.loop` par carte → coût FPS scrolling)

### Haptics
- Ajouté : **light haptic sur play/pause vidéo** (seul CTA sans haptic ; le reste — Démarrer séance, programmes, breathing — en avait déjà via `hapticLight`/GlassButton)

### Sentry breadcrumbs
- Nouveau helper : `src/utils/breadcrumb.js` (no-op si DSN vide, safe)
- Câblé sur : **Login, Logout, Started session, Completed session, Video error, Bunny URL fetch error, Subscribe tapped**

### npm audit
- 24 vulnérabilités totales (**0 HIGH / 0 CRITICAL**)
- 5 low + 19 moderate, toutes dans l'outillage build Expo, **hors bundle runtime**
- **Aucun fix appliqué** — éviter de toucher au lockfile/Expo version sans nécessité

### État
- Branche `feat/app-night-audit-iOS` poussée sur GitHub
- **PAS mergée sur main**
- **PAS d'OTA déployé**
- Pour tester sur ton iPhone : `eas update --channel preview --environment production --message "Night audit iOS polish"`

---

## ✅ Apple TV (tvOS) — Audit code review pur

### Verdict honnête : le code TV est déjà très solide

**Aucune modification appliquée** car les findings réels ne nécessitent pas de fix urgent OTA.

### Audit point par point

| Item | État réel |
|---|---|
| **FlatList perf** | ⚠️ **Aucune FlatList dans le code TV** — tout est `ScrollView` + `.map()` ou flex-wrap grid. Le checklist FlatList n'a aucune cible. |
| **Focus engine** | ✅ **Déjà solide et cohérent**. `tvFocusProps()` + `TV_FOCUS_RING` dans `platformTV.js`. Tous les focusables (TVCard16x9, GlassCardTV, FocusableCardTV, SeanceCardTV, HeroPillButton, TabPill, FocusableSurface) wirent `onFocus`/`onBlur` → scale 1.06-1.10 + ring blanc 3px + glow, `useNativeDriver: true`. Premier item a `hasTVPreferredFocus`. |
| **Liquid Glass TV** | ✅ `GlassCardTV` route vers `LiquidGlass` natif avec `glassStyle="clear"`, drive `tintColor`/`focused` selon focus state, `isInteractive: true`. Match parfait avec le brief. |
| **Animations** | ✅ `useNativeDriver: true` **partout**. 2 `Animated.loop` (MeduseTV breathing, SeanceCompleteTV confetti) intentionnels, montés seulement quand visible. |
| **Top shelf** | ✅ **Présent et correctement wiré**. `assets/tv/top-shelf{,@2x,-wide,-wide@2x}.png` passés à `appleTVImages` dans `app.config.js`. |
| **Wiring / focus chain** | ✅ TV live : `App.js` → `if (IS_TV) return <TVLoginScreen>`. Chaîne QR-pair → home → pilier → vidéo → SeanceCompleteTV intacte. |

### Seul finding réel (recommandation future, pas urgent)

Les grilles TV — surtout **`RechercheTV`** qui peut rendre TOUTES les séances correspondantes en single `ScrollView` + flex-wrap sans virtualization — rendent toutes les cards eagerly.

Pour ~9 piliers c'est fin, pour une recherche large ça rend des dizaines de cards `<Image>` simultanément.

**Pourquoi je n'ai pas livré ce fix** :
- Conversion à `FlatList` avec `numColumns` grid + `windowSize` + `removeClippedSubviews` + `getItemLayout` = vrai gain perf
- MAIS sur tvOS old-arch, `removeClippedSubviews` + focus engine peut unmount des cellules focusables → focus jump/loss
- Ça **nécessite vérification sur un Apple TV physique** avant d'envoyer en OTA
- Le brief excluait device testing — donc skip pour éviter casse en prod

**Suggestion future** : convertir `RechercheTV` en FlatList grid behind dev client Apple TV, valider que focus engine walk correctement la grille, puis rouler le même pattern à `BibliothequeTV`/`ExplorerTV`/`PilierPanelTV`.

---

## 🎯 Décisions à prendre (matinée)

### iOS

- [ ] **Tester la branche `feat/app-night-audit-iOS`** sur ton iPhone TestFlight
  - Lancer : `cd /Users/xvan06/fluidbody && git checkout feat/app-night-audit-iOS && eas update --channel preview --environment production --message "iOS polish preview"`
  - Vérifier que Paywall/MonCorps/CTAs ont l'effet glassy amplifié
  - Confirmer que les haptics play/pause vidéo fonctionnent
- [ ] Si OK → merger sur main + OTA production
- [ ] Si pas OK → me dire ce qui ne va pas

### tvOS

- [ ] **Décider** si tu veux convertir `RechercheTV` → FlatList grid (gain perf scrolling sur larges recherches)
- [ ] Si oui → fix prudent avec test sur Apple TV physique (dev client)
- [ ] Sinon → laisser tel quel, c'est déjà bon

### Sentry (les 2)

- [ ] Créer projet Sentry "fluidbody-mobile" sur sentry.io
- [ ] Mettre `EXPO_PUBLIC_SENTRY_DSN` dans EAS env vars production
- [ ] Les breadcrumbs commenceront à remonter automatiquement
- [ ] Pour symbolication crashes natifs iOS : wirer `sentry-cli` upload dSYM en hook post-publish EAS (cf. CLAUDE.md TODO)

---

## ⚠️ Limites & rappels

- **App Store soumission EN PAUSE** — pas avant tournage vidéos (cf. `SPRINT_CONTENU_VIDEOS_2026-05-29.md`)
- **DownloadManager XOR ≠ DRM** — remplacer par `expo-secure-store` avant traitement DRM réel
- **Sentry symbolication iOS native pas wirée** — `sentry-cli` post-publish EAS à câbler
- **EAS crédits dépassés** ce mois-ci — prochains builds pay-as-you-go

---

## 🔧 Fichiers modifiés (branche `feat/app-night-audit-iOS`)

| Fichier | Changement |
|---|---|
| `src/components/ui/GlassView.js` | Liquid Glass v3 : `glassStyle="clear"` iOS 26+, `tintIntensity` 0.10→0.14, `breathingHighlight` 0.7 |
| `src/utils/breadcrumb.js` | **NOUVEAU** — helper Sentry breadcrumbs no-op safe |
| `src/components/VideoPlayer.js` | Haptics play/pause + Sentry breadcrumbs video error / Bunny URL error |
| `App.js` | Sentry breadcrumbs Login / Logout / Started session / Completed session / Subscribe tap |
| (autres surfaces) | `enhanced={amplify}` câblé sur surfaces premium |

---

## 🪼 Conclusion

**iOS** : 1 branche feature avec polish v3 amplifié + Sentry breadcrumbs + haptics, prête à tester. À toi de valider.

**tvOS** : code déjà excellent, rien à patcher en urgence. Seul axe d'amélioration future = virtualization grilles via FlatList, mais nécessite test physique.

**Sécurité** : 0 HIGH/CRITICAL, RLS Supabase audited OK la session précédente, Stripe webhook signed.

Repose-toi. Tout est en place côté code, **rien n'est merged ni déployé sans ton OK**.
