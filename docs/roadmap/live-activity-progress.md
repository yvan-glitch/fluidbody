# Live Activity — État du scaffolding & étapes manuelles

**Branche :** `feat/live-activity-foundation`
**Dernière mise à jour :** 2026-05-19

Voir aussi : [live-activity-strategy.md](./live-activity-strategy.md) pour la
décision tech et l'architecture cible.

## Ce qui est dans la branche (fait)

- ✅ Doc stratégie + tech decision (`live-activity-strategy.md`).
- ✅ `@bacons/apple-targets@4.0.7` ajouté en devDep, plugin déclaré.
- ✅ `app.json` : `NSSupportsLiveActivities`, `NSSupportsLiveActivitiesFrequentUpdates`,
  app group entitlement.
- ✅ `targets/live-activity/` : Widget Extension complet
  (FluidLiveActivityWidget, FluidLockScreenView, FluidProgressRing,
  FluidJellyfishGlyph, FluidColors, FluidSessionAttributes,
  `expo-target.config.js`, `Info.plist`).
- ✅ `ios-native/FluidLiveActivity/` : sources du bridge ActivityKit pour le
  main app target (FluidLiveActivityModule.swift + .m + Attributes).
- ✅ `plugins/withFluidLiveActivityBridge.js` : config plugin qui copie les
  sources du bridge vers `ios/<app>/FluidLiveActivity/` à chaque prebuild.
- ✅ `src/utils/liveActivity.js` : JS bridge iOS-only, safe-resolve.
- ✅ `src/components/VideoPlayer.js` : start/update/end wirés sur le cycle
  de vie de la séance.

## Ce qu'il reste à faire (Yvan, en local)

### 1. Premier prebuild

```bash
npx expo prebuild -p ios --clean
```

Cela génère :
- `ios/fluidbody.xcworkspace` + `ios/fluidbody.xcodeproj`
- `ios/expo:targets/live-activity/` (target Widget Extension, monté par
  `@bacons/apple-targets`)
- `ios/fluidbody/FluidLiveActivity/` (sources du bridge, copiées par notre
  plugin maison)

Vérifier la sortie console :
```
[fluid-live-activity] copied bridge sources → ios/fluidbody/FluidLiveActivity/
[fluid-live-activity] ⚠️  add the folder to the Xcode target manually (one-time)
```

### 2. Apple Developer portal — créer l'App Group

1. https://developer.apple.com/account/resources/identifiers/list/applicationGroup
2. Add → `group.com.ytissot.fluidbody.shared`
3. Aller dans **Identifiers → com.ytissot.fluidbody** → cocher App Groups,
   sélectionner `group.com.ytissot.fluidbody.shared`. Sauvegarder.
4. Faire pareil pour `com.ytissot.fluidbody.live-activity` (créé
   automatiquement au premier build EAS s'il n'existe pas).
5. Régénérer le provisioning profile (EAS le fait automatiquement, mais on
   peut aussi forcer via `eas credentials`).

### 3. Xcode — attacher les sources du bridge au main target

`@bacons/apple-targets` s'occupe du target widget tout seul. Le bridge,
lui, vit dans le target principal et n'est pas auto-attaché.

1. Ouvrir `ios/fluidbody.xcworkspace`
2. Dans le navigateur de gauche, drag-drop le dossier
   `fluidbody/FluidLiveActivity/` (qui contient le `.swift` + le `.m`)
   sur le groupe `fluidbody` du projet.
3. Dialogue d'import :
   - "Copy items if needed" → **décoché** (déjà copié par le plugin)
   - "Create groups" → **coché**
   - Target membership → **fluidbody** uniquement
4. Xcode demande "Create Bridging Header?" → **Create** (si pas déjà fait
   pour HealthKit, mais normalement il existe déjà).
5. Cmd+B pour vérifier que ça compile.

### 4. Smoke test sur device

⚠️ Live Activities ne marchent **pas** dans le simulateur iOS sur
toutes les versions. Tester sur un device physique iOS 16.2+ (idéalement
iPhone 14 Pro+ pour avoir le Dynamic Island).

```bash
# Dev build local (rapide)
npx expo run:ios --device

# Sinon EAS dev build
eas build --profile development --platform ios
```

Vérifications :
- [ ] Démarrer une séance → la Live Activity apparaît sur lock screen ?
- [ ] Dynamic Island compact = méduse + timer qui tourne ?
- [ ] Long-press sur Dynamic Island = vue expanded avec titre + ring + BPM ?
- [ ] BPM apparaît si Apple Watch active ?
- [ ] Fermer la séance → activity disparaît immédiatement ?
- [ ] Logs Xcode : `[FLDB-DIAG] FluidLiveActivity.start done` etc.

### 5. EAS build TestFlight (quand v1.1 sera prêt à shipper)

Aucune action spécifique : la capability `NSSupportsLiveActivities` est
déjà dans `app.json`, le widget bundle est généré au prebuild, EAS gère
le reste.

## Points d'attention

### Le bridge `.swift` + `.m` doit être dans le main target, pas dans le widget

Le widget est sandboxé : il **lit** les `Activity.activities` créées par
l'app principale mais ne peut pas en créer. C'est pour ça qu'on a deux
copies de `FluidSessionAttributes.swift` (cf commentaire dans le fichier
côté `ios-native/`).

### Mode pause / reprise vidéo

Le widget timer tourne via `Text(timerInterval:)` à partir de `startedAt`.
Si l'utilisateur **pause** la vidéo, on continue actuellement à laisser
le timer SwiftUI tourner. C'est OK pour la v1.1 (Apple Fitness+ fait
pareil). Si on veut un pause-aware timer, il faudra :
1. Ajouter `pausedAt: Date?` dans ContentState
2. Côté Swift, basculer entre `Text(timerInterval:)` et un `Text` figé
3. Côté JS, pousser un `update` au moment du pause/play

### Pas de QA exhaustif fait dans cette branche

- Pas testé que le `pbxproj` reste stable entre deux `expo prebuild` (le
  plugin `@bacons/apple-targets` est censé être idempotent mais on n'a
  pas validé sur ce projet).
- Pas validé que l'app group entitlement appliqué via `app.json` survit
  bien au prebuild (à confirmer au premier `npx expo prebuild`).
- Pas testé le deep link `widgetURL` — il faut wirer le handler côté JS
  pour ouvrir la bonne séance, c'est un ticket à part.

## Si le bridge bridging-header coince

Symptôme : Xcode dit "Cannot find type 'FluidSessionAttributes' in scope"
au build du main target.

Cause : le compilateur Swift doit voir le fichier `FluidSessionAttributes.swift`
*dans le même target* que le module. Vérifier dans Xcode que les 3 fichiers
sous `fluidbody/FluidLiveActivity/` ont bien le target membership =
fluidbody (panneau de droite, File Inspector).

## Plan B (si la branche est repoussée hors v1.1)

Garder le code mais documenter dans Notion que la feature n'est pas
shippée. Le JS est totalement no-op tant que le module natif n'est pas
linké, donc zéro régression côté users actuels.

Alternative dégradée évoquée dans `live-activity.md` (notification
"live" persistante via `expo-notifications`) reste valide mais on ne
l'a pas implémentée dans cette branche.
