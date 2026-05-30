# Récap — Liquid Glass natif tvOS (2026-05-30)

## 1. Accompli
- **Recherche tvOS 26** : `UIGlassEffect` est bien dispo sur tvOS 26 (WWDC25,
  même API `UIVisualEffect` + `tintColor`/`isInteractive` que iOS 26). Donc
  **approche native directe**, pas de simulation pure.
- **Module natif tvOS créé** (`plugins/LiquidGlass/`, tout en `#if os(tvOS)`):
  - `LiquidGlassTVView.swift` — `UIGlassEffect` (tvOS 26) avec fallback
    `UIBlurEffect(.systemUltraThinMaterialDark)` (tvOS <26), + sheen spéculaire
    animé (CABasicAnimation), top reflection 1pt, bordure lumineuse lime/cyan,
    intensification au focus via prop `glassFocused`. Props: glassIntensity,
    glassTint, borderStyle, accent, glassFocused, glassCornerRadius.
  - `LiquidGlassTVViewManager.swift` + `LiquidGlassTV.m` (bridge RCT).
- **`plugins/withLiquidGlass.js`** : sélectionne `TV_SOURCE_FILES` vs
  `IOS_SOURCE_FILES` selon `process.env.EXPO_TV === '1'`. Logique
  d'enregistrement Xcode (path) inchangée (déjà corrigée build #84→#86).
- **`app.config.js`** : `withLiquidGlass` retiré de
  `PLUGINS_INCOMPATIBLE_WITH_TVOS` → compilé dans le binaire tvOS.
- **`src/components/LiquidGlass.js`** : route `Platform.isTV` →
  `LiquidGlassTVView`, sinon `LiquidGlassView`. Export `IS_TV_GLASS`.
  Forward `focused`/`accent`→`glassFocused`/`accent` (TV) vs
  `glassStyle`/`tintIntensity`/`interactive` (iOS). API v2 iPhone préservée.
- **`src/components/tv/GlassCardTV.js`** : utilise `<LiquidGlass>` natif quand
  `HAS_LIQUID_GLASS`, sinon `BlurView` (sécurité Android TV/old tvOS).
- Vérifs : plugin parse (EXPO_TV=1), app.config inclut le plugin en TV et reste
  inchangé hors TV, swiftc -parse OK, babel transform OK sur les 2 JS.

## 2. Branche / commits (poussés sur origin)
Branche `feat/liquid-glass-v2-native` (partagée avec la task iPhone) :
- `877e14a` glass-tv: module natif tvOS (mon 1er commit)
- `a5db9f7` glass v2 iPhone (task iPhone — a écrasé mon LiquidGlass.js)
- `da7b5a4` fix: retire withLiquidGlass de l'exclusion tvOS
- `b8a45f9` **re-merge du routing tvOS dans LiquidGlass.js v2** (HEAD)

⚠️ Piège rencontré : la task iPhone éditait `LiquidGlass.js` en parallèle ;
mes 2 premiers edits ont échoué ("File modified since read") et son commit
v2 a écrasé mon routing → re-mergé proprement en `b8a45f9`. Tous mes autres
fichiers (Swift, plugin, app.config, GlassCardTV) ont survécu.

## 3. Build EAS TV
- Profil utilisé : **`production-tv`** (eas.json — extends production, EXPO_TV=1,
  credentialsSource local, channel production-tv). PAS de flag `--target`.
- 1er lancement annulé par le harness (erreur babel dans le même batch parallèle)
  → AUCUN build erroné soumis (vérifié : dernier production-tv = #85 du 27/05).
- 2e lancement confirmé sur EAS :
  - **profil `production-tv`, build #88, commit `d5282c2`, status IN_PROGRESS**
  - id : `c940190a-1932-4d16-9b45-c8bf7518f3f7`
  - **URL : https://expo.dev/accounts/ytissot/projects/fluidbody/builds/c940190a-1932-4d16-9b45-c8bf7518f3f7**

## 4. Reste à faire / à surveiller
- **Confirmer que le build production-tv est bien parti** avec le bon commit
  (`b8a45f9`) et build# > 85 :
  `eas build:list --platform ios --limit 1 --non-interactive --json`
- Surveiller la fin du build sur l'URL EAS. Risque connu : registration des
  sources Swift dans pbxproj (cf. build #84 ERRORED path-doubling, corrigé #86) —
  même code de path pour les fichiers TV, donc devrait passer.
- **AUCUN `eas submit`** (garde-fou respecté).

## 5. Garde-fous respectés
- Pas de submit. Pas de merge sur main. Fallback BlurView JS conservé.
- `#if os(tvOS)` sur tous les fichiers Swift TV. Coordonné avec la task iPhone
  (même branche, rebase/FF propre).
