# Apple TV — Récap de la session 2026-05-20

## ✅ Ce qui marche maintenant

L'app FluidBody+ tourne sur le simulator Apple TV 4K (tvOS 26.5) :
- Build compile sans erreur
- App boote, splash s'affiche
- UI "Connecte ton Apple TV" rendue avec méduse animée + branding
- Supabase connecté (`.env` copié dans le worktree)
- Edge function `tv-pair` déployée sur Supabase (tu l'as fait juste avant de partir)

## 🎯 Les 8 fixes appliqués pour débloquer le build

1. `xcode-select` → Xcode.app
2. Sentry sourcemap upload désactivé (`.xcode.env.local` + project.pbxproj)
3. `expo-screen-orientation` → lazy require (App.js, VideoPlayer.js)
4. `react-native-view-shot` → lazy require + fallback `View` (App.js, SeanceShareCard.js, Profil.js)
5. `newArchEnabled: false` pour tvOS (app.config.js)
6. Patch `fmt/include/fmt/base.h` pour neutraliser `consteval` (Pods)
7. `.env` copié dans le worktree
8. Edge function `tv-pair` déployée

## 🔒 Patches durables — pas besoin de re-faire à la prochaine prebuild

J'ai créé un **config plugin Expo** `plugins/withTVPodfilePatch.js` qui ré-applique automatiquement les patches Podfile (post_install + fmt/base.h) à chaque `expo prebuild`. Donc tu peux faire `expo prebuild --clean` autant de fois que tu veux, les fixes tvOS resteront.

## ⚠️ À faire à ton retour

### 1. Pousser le commit Apple TV sur GitHub

J'ai **déjà committé** tous les fixes (commit `2f758e3 Apple TV: foundation builds on tvOS 26.5 simulator end-to-end`) mais ma sandbox n'a pas tes credentials GitHub. Tu dois juste pousser :

```
cd /Users/xvan06/fluidbody/.claude/worktrees/flamboyant-franklin-ee2a5f
rm -f /Users/xvan06/fluidbody/.git/worktrees/flamboyant-franklin-ee2a5f/index.lock
git push origin claude/flamboyant-franklin-ee2a5f
```

Le commit inclut 6 fichiers : App.js, app.config.js, plugins/withTVPodfilePatch.js (nouveau), SeanceShareCard.js, VideoPlayer.js, Profil.js.

Il reste 2 fichiers non commités (le doc roadmap mis à jour + une petite update du plugin avec un marqueur d'idempotence) — tu peux les ajouter au push :

```
git add docs/roadmap/apple-tv-progress.md plugins/withTVPodfilePatch.js
git commit -m "docs+plugin: apple-tv Phase 3 simulator success + idempotency marker"
git push
```

### 3. Tester le QR pairing end-to-end

Sur le simulator Apple TV (relancer si fermé) :
- L'écran "Connecte ton Apple TV" devrait maintenant afficher un VRAI QR code (avant ça plantait avec "by edge: 404")
- Ouvre Fluidbody+ sur ton iPhone → Profil → "Pairer une Apple TV"
- Scanne le QR du simulator → la TV devrait se connecter à ton compte
- Tu devrais voir l'app TV complète : MonCorps fullscreen, navigation à la télécommande, etc.

### 4. (Plus tard) Build EAS pour vraie Apple TV

Pour avoir l'app sur ta vraie Apple TV au salon, il faudra :
- Créer un provisioning profile tvOS dans Apple Developer Portal (séparé du profile iOS)
- Lancer `eas build --profile production-tv --platform ios`
- Soumettre à TestFlight tvOS

Ça peut attendre. Le plus dur est fait : **on sait maintenant que l'app fonctionne sur tvOS**, c'était l'inconnue principale.

## 📂 État des fichiers modifiés (non commités)

```
src/components/SeanceShareCard.js     ViewShot lazy + View fallback
src/components/VideoPlayer.js         ScreenOrientation lazy
src/screens/Profil.js                 ViewShot lazy + View fallback
App.js                                ScreenOrientation + ViewShot lazy
app.config.js                         newArchEnabled false + plugin référencé
plugins/withTVPodfilePatch.js         NOUVEAU — config plugin pour les patches
```

`ios/` est gitignored (régénéré par prebuild) — pas besoin de commit.

## 🧠 Mémoire mise à jour

J'ai écrit `project_fluidbody_apple_tv.md` dans ma mémoire — donc dans les futures sessions je saurai exactement comment l'Apple TV fonctionne sans refaire le debug.

---

Bonne journée de cours. À plus tard.
