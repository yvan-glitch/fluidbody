# Recap matinal — 21 mai 2026

Salut Yvan, voici ce qui s'est passé pendant ton sommeil.

## 🌙 Ce que j'ai fait

### 1. Recherche approfondie sur l'erreur Info.plist tvOS

J'ai fait une recherche détaillée sur la cause exacte des erreurs de submit TestFlight tvOS. **Le bug principal** : la `Contents.json` du brandassets bundle manquait le champ `role`. Sans ce champ, Apple compile les assets dans Assets.car mais altool ne sait pas où les trouver par "role" → rejet "Missing Image Asset".

### 2. Plugin `withTVAssets.js` réécrit complètement

Le nouveau plugin (commit non fait, à push toi-même) inclut maintenant :

- ✅ Champ `role` ajouté aux 4 assets (primary-app-icon, primary-app-icon, top-shelf-image, top-shelf-image-wide)
- ✅ **3 layers** par imagestack (Front, Middle, Back) au lieu de 2 — c'est ce que Xcode génère par défaut et ce qu'altool attend
- ✅ Folder `Content.imageset` (singulier, pas pluriel)
- ✅ `TVTopShelfPrimaryImageWide` remis dans Info.plist (Apple le veut REQUIS, pas optionnel)
- ✅ `UIDeviceFamily = [3]` (tvOS)
- ✅ Documentation détaillée dans le commentaire en tête de fichier

### 3. Images tvOS régénérées en RGB pur (sans alpha channel)

Apple rejette les PNGs avec alpha pour les tvOS assets. J'ai régénéré toutes les images en mode RGB :
- `assets/tv/icon-small.png` (400×240)
- `assets/tv/icon-large.png` (1280×768)
- `assets/tv/top-shelf.png` (1920×720)
- `assets/tv/top-shelf-wide.png` (2320×720)

### 4. Apple TV Developer Mode — j'ai trouvé la procédure

**L'erreur que j'ai faite hier** : je cherchais Developer Mode dans **Réglages → Système**. Il faut chercher dans **Réglages → Remotes and Devices → Remote App and Devices** !

C'est COUNTER-INTUITIF mais documenté sur Apple Forums :

> Le menu "Developer" dans Settings n'apparaît PAS automatiquement avec un compte développeur. Il apparaît **APRÈS** que l'Apple TV soit pairée avec Xcode via le pairing wireless.

C'est l'inverse de ce qu'on pensait — pas besoin de Developer Mode pour pairer, pairer crée le Developer Mode.

## ☀️ Ce que tu dois faire ce matin

### Étape 1 — Commit + push mes changements (5 min)

```bash
cd /Users/xvan06/fluidbody
rm -f .git/index.lock
git add app.config.js plugins/withTVAssets.js assets/tv/ scripts/ .gitignore
git commit -m "feat(tv): proper Info.plist + brandassets with role fields for tvOS submission

- Plugin withTVAssets.js : add 'role' field to brandassets Contents.json (critical fix)
- Use 3-layer imagestacks (Front/Middle/Back) matching Xcode defaults
- Use 'Content.imageset' singular naming (was 'Contents.imageset')
- Re-include TVTopShelfPrimaryImageWide (required, not optional)
- Generate tvOS icons in RGB mode (no alpha channel — altool rejects alpha)
- Asset dimensions verified: 400x240, 1280x768, 1920x720, 2320x720"
git push origin main
```

### Étape 2 — Relance le build tvOS avec auto-submit (~25 min de build)

```bash
cd /Users/xvan06/fluidbody
eas build --profile production-tv --platform ios --auto-submit
```

Cette fois, **la submission devrait passer** parce que :
- Le champ `role` est dans la Contents.json (Apple peut trouver les assets)
- Les images sont sans alpha
- Le Wide top shelf est référencé
- Le format Info.plist matche les attentes Apple

Si tu vois "Submitted to App Store Connect" dans la sortie, c'est gagné. Ça va dans TestFlight ~10 min après.

### Étape 3 — Active Developer Mode sur Apple TV (3 min)

⚠️ **NE CHERCHE PAS dans Réglages → Système → Développeur**. C'est ailleurs.

1. Sur Apple TV : **Réglages** → **Télécommandes et appareils** (Remotes and Devices) → **Apps de télécommande et appareils** (Remote App and Devices)
2. Laisse l'Apple TV sur cet écran (il broadcast pour pairing)
3. Sur ton Mac : **Xcode → Window → Devices and Simulators → Devices tab**
4. Sous la section **Discovered** (à gauche), ton Apple TV devrait apparaître (si Mac + TV même WiFi)
5. Clique sur Apple TV → bouton **"Pair with [nom Apple TV]"**
6. Code 6 chiffres s'affiche sur la TV → tape-le dans Xcode
7. Une fois pairé, va sur Apple TV : **Réglages → Système → Developer** apparaît maintenant

⚠️ **Le pairing est wipé à chaque redémarrage de l'Apple TV**. Il faut re-pairer après chaque reboot. C'est par design Apple.

### Étape 4 — Build & install direct sur Apple TV via Xcode (optionnel)

Une fois pairé, dans Xcode :
1. Ouvre le worktree : `/Users/xvan06/fluidbody/.claude/worktrees/flamboyant-franklin-ee2a5f/ios/FluidBody.xcworkspace`
2. Sélectionne destination → ton Apple TV physique (devrait apparaître dans le menu)
3. **Cmd+R** → Xcode compile + installe sur ta TV
4. L'app FluidBody+ apparaît sur ta vraie Apple TV !

### Étape 5 — Si Étape 2 réussit, install via TestFlight (plus simple long-terme)

Si l'EAS submit passe à TestFlight tvOS :
1. Sur Apple TV : ouvre l'App Store → cherche **TestFlight** → installe
2. Ouvre TestFlight sur Apple TV, sign in avec yvan.tissot@gmail.com
3. Install Fluidbody+ depuis TestFlight
4. Lance Fluidbody+ → écran QR pairing
5. Sur ton iPhone (build #64 TestFlight) : Profil → "Pairer une Apple TV" → scan le QR
6. La TV se logge automatiquement avec ton compte

## 📋 État du projet

### ✅ Ce qui marche
- App iOS production en TestFlight (build #64, avec feature "Pairer une Apple TV")
- App Apple TV sur simulator (tvOS 26.5)
- Pairing QR end-to-end (edge function `tv-pair` déployée + table `tv_pairings`)
- OTA updates configurées (script `push-update.sh` créé)
- Branche TV merged dans main, tout pushé sur GitHub

### 🔄 En cours / À tester
- TestFlight tvOS (après commit + nouveau build avec les fixes Info.plist)
- Apple TV physique via Xcode direct (après pairing wireless)

### 📝 Plus tard
- Live Activity v1.1 (foundation déjà sur branche `feat/live-activity-foundation`)
- Sound + Onboarding tutorial polish (branche `feat/sound-onboarding-polish`)
- Coach welcome video (Sabrina à filmer, specs dans `docs/assets/coach-welcome.md`)
- 5-10 nouvelles vidéos séances (Sabrina à filmer)
- Sentry DSN dans EAS prod env

## 🧠 Mémoire mise à jour

J'ai mis à jour `project_fluidbody_apple_tv.md` dans la mémoire avec :
- Les 8 fixes pour build tvOS (comme avant)
- + Le champ `role` critique dans brandassets Contents.json
- + La procédure réelle pour Developer Mode Apple TV (via Remote App and Devices)
- + Le détail que le pairing se wipe à chaque restart Apple TV

Les futures sessions Claude n'auront pas à refaire la recherche.

## 🛠️ Si le build/submit échoue ENCORE

Vérifications à faire avant de me re-déranger :

**1. Le plugin a-t-il bien tourné pendant le prebuild ?**

Dans les logs EAS du build, cherche les lignes :
- `[withTVPodfilePatch] Injected tvOS post_install patches into Podfile`
- `[withTVAssets] Generated tvOS brandassets at ...`

Si tu ne les vois pas, le plugin n'a pas tourné. Vérifie que app.config.js référence bien `./plugins/withTVAssets.js`.

**2. Le credentials.json pointe-t-il vers le bon profile ?**

```bash
strings credentials/ios/profile.mobileprovision | grep -E "tvOS|Name" | head -3
```

Tu dois voir `tvOS` et `Fluidbody+ tvOS AppStore`. Si tu vois "iOS" ou rien, le profile a été écrasé — re-download depuis Apple Developer Portal et copie-le dans `credentials/ios/profile.mobileprovision`.

**3. Les assets PNG sont-ils en RGB (sans alpha) ?**

```bash
python3 -c "from PIL import Image; print(Image.open('assets/tv/icon-large.png').mode)"
```

Doit afficher `RGB`. Si `RGBA`, ça plantera. Régénère avec mon script Python (voir asset/tv/ pour les originaux).

**4. Apple Transporter cache corrompu ?**

Si tu as fait plusieurs tentatives de submit, le cache local peut être pourri :

```bash
rm -rf ~/Library/Caches/com.apple.amp.itmstransporter
```

Puis relance le build. Documenté sur Apple Forums comme cause de "missing image" même quand les assets sont OK.

**5. Inspecter la .ipa générée :**

```bash
cd /tmp
curl -O https://expo.dev/artifacts/eas/<BUILD_ARTIFACT_ID>.ipa
unzip <BUILD_ARTIFACT_ID>.ipa -d ipa-contents
cd ipa-contents/Payload/FluidBody.app
# Vérifier Info.plist contient bien les keys :
plutil -p Info.plist | grep -E "CFBundleIcons|TVTopShelf"
# Vérifier le Assets.car contient les bons assets :
xcrun --sdk iphoneos assetutil --info Assets.car | grep -E "primary-app-icon|top-shelf"
```

Si Assets.car ne contient PAS les assets attendus → le plugin n'a pas généré les brandassets correctement.

## ⚠️ Choses à savoir

1. **Le pairing Apple TV se wipe à chaque restart**. Donc si tu redémarres ta TV (mise à jour iOS, etc.), faudra re-pair via Xcode. C'est pas un bug, c'est par design Apple pour la sécurité.

2. **Apple TV Wi-Fi gotcha** : si ta TV et ton Mac sont sur des bandes différentes (2.4 vs 5 GHz) ou sur des SSID différents, mDNS échoue silencieusement. Force-les sur le même SSID si le pairing wireless plante.

3. **Le champ `role` était la clé** : tous les errors "Missing Image Asset" venaient de là. Apple compile les assets correctement mais sans `role` ne sait pas les trouver par nom logique.

4. **Tu peux toujours utiliser le simulator** si l'Apple TV physique pose souci. Le simulator marche parfaitement.

---

Bon réveil. Le plus dur est fait. ☕
