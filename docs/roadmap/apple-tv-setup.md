# Roadmap — Apple TV : checklist setup manuel

**Pour Yvan.** Tout ce qui ne peut PAS être fait automatiquement par
Claude/CI/Expo. À cocher dans l'ordre. Chaque étape est annotée
"~10 min" / "~1 h" pour calibrer le créneau.

Pré-requis :

- Xcode 16+ installé (`xcode-select --print-path` doit retourner un chemin)
- tvOS SDK 17+ installé (`xcodebuild -downloadAllPlatforms` si absent)
- Apple Developer account actif (déjà OK : team `R5V88AS9MX`)
- EAS CLI à jour (`npm i -g eas-cli@latest`)
- Brancher une Apple TV (4K, gen 2+) en USB-C / réseau, en mode développeur

---

## 0) Vérifier Xcode + tvOS SDK installé (~5 min)

```sh
xcodebuild -version             # doit être ≥ 16
xcodebuild -showsdks | grep tv  # doit lister appletvos17.x ou plus récent
```

Si pas de tvOS SDK :

```sh
sudo xcodebuild -downloadAllPlatforms
```

---

## 1) Activer le mode développeur sur l'Apple TV physique (~10 min)

Sur l'Apple TV :

1. Réglages → Système → Développeur → activer "Mode développeur"
2. Réglages → Comptes → Connecter avec ton Apple ID dev
3. Brancher l'Apple TV à la même Wi-Fi que ton Mac
4. Sur Xcode (Mac) → Window → Devices and Simulators → l'Apple TV
   devrait apparaître dans "Discovered". Click "Pair with Apple TV".
   L'Apple TV affiche un code à 6 chiffres → saisir dans Xcode.
5. Une fois pairé, le device apparaît comme une cible de build.

**Sans Apple TV physique** : on peut tester sur le simulator tvOS
(plus lent mais marche pour Phase 1). Choisir "Apple TV 4K (3rd gen)" dans
les schemes Xcode.

---

## 2) Créer l'App ID tvOS sur Apple Developer Portal (~15 min)

https://developer.apple.com/account/resources/identifiers/list

1. Identifiers → ➕ → "App IDs" → "App"
2. Description : `FluidBody+ tvOS`
3. Bundle ID : **`com.ytissot.fluidbody.tvos`** ou `com.ytissot.fluidbody`
   (au choix — voir note ci-dessous)
4. Platform : **tvOS** (radio)
5. Capabilities à activer (à minima) :
   - ✅ In-App Purchase
   - ✅ Sign in with Apple (si on garde l'option login Apple)
   - ✅ Associated Domains (pour deep linking depuis l'iPhone, futur)
   - ❌ HealthKit (pas disponible sur tvOS, ne PAS cocher)

> **Bundle ID : même ou séparé ?**
>
> - **Même bundle ID `com.ytissot.fluidbody`** (recommandé Apple) → l'app
>   tvOS est considérée comme une "extension" naturelle de l'app iOS dans
>   les recherches App Store. Achats RevenueCat unifiés. Family Sharing OK.
>   Inconvénient : un seul App Store Connect record, donc submit iOS et
>   tvOS doivent rester en sync de versions.
> - **Bundle ID séparé `com.ytissot.fluidbody.tvos`** → indépendance
>   totale. Submissions séparées. Mais users doivent re-souscrire pour la
>   version TV (sauf config RevenueCat custom).
>
> **Recommandation : même bundle ID** (`com.ytissot.fluidbody`). C'est ce
> que fait Netflix, Spotify, Disney+, et c'est ce qu'Apple
> recommande pour partager l'abonnement Family.

---

## 3) Créer un provisioning profile tvOS dev + distribution (~15 min)

Dans Apple Developer Portal :

1. Profiles → ➕ → "tvOS App Development" → sélectionner l'App ID créé
   ci-dessus → sélectionner les devices Apple TV pairés → générer
   → télécharger
2. Profiles → ➕ → "tvOS App Store" → sélectionner l'App ID → générer
   → télécharger

**Note** : EAS Build peut gérer les profiles automatiquement via
`eas credentials --platform ios` (qui gère iOS + tvOS via le `--target`
flag). Voir étape 7.

---

## 4) Créer le record App Store Connect tvOS (~10 min)

> Skipper cette étape jusqu'à ce qu'on ait un binaire prêt pour TestFlight
> interne (Phase 2 — pas urgent).

https://appstoreconnect.apple.com/apps

1. ➕ Nouvelle app
2. **Si même bundle ID** : ne PAS créer de nouvelle app — la TV sera une
   plateforme ajoutée à l'app `FluidBody+` existante. Dans l'app existante
   → "Plateformes" → "+ Ajouter une plateforme" → tvOS.
3. **Si bundle ID séparé** : créer une nouvelle app, choisir plateforme
   tvOS, bundle ID `com.ytissot.fluidbody.tvos`.

Métadonnées requises pour soumission :
- Description tvOS (différente de iOS, focus sur l'usage salon)
- Screenshots 1920×1080 ou 3840×2160 (5 max)
- Hero video optionnelle (mais recommandée)
- Privacy nutrition labels (identique iOS, copier-coller)
- App Review : note pour le reviewer expliquant que l'auth se fait par QR
  code (ils vont avoir besoin de simuler — fournir un compte démo)

---

## 5) Configurer RevenueCat pour tvOS (~20 min)

https://app.revenuecat.com/projects/

1. Project Fluidbody → Apps → ➕ → choisir **tvOS**
2. Bundle ID : `com.ytissot.fluidbody` (même que iOS — RevenueCat support
   le multi-plateforme sur même bundle ID via les "stores")
3. Connecter à App Store Connect (même clé API que iOS)
4. Vérifier que les **produits** existants (monthly `fluidbody_monthly`,
   yearly `fluidbody_yearly`) sont mappés à la plateforme tvOS
5. Tester avec un sandbox tester Apple ID sur l'Apple TV physique

**⚠️ Caveat** : le wrapper `react-native-purchases` n'est pas officiellement
supporté sur tvOS. Plan B documenté dans `apple-tv-strategy.md` (bridge
Swift minimal). Si le wrapper RN crash au runtime sur tvOS dev client,
basculer sur le plan B avant d'écrire la moindre UI paywall.

---

## 6) Mettre à jour le projet local (~5 min — Claude a déjà préparé)

Sur la branche `feat/apple-tv-foundation`, ce qui est déjà en place :

- `docs/roadmap/apple-tv-*.md` : ces docs
- `app.json` : entry `@react-native-tvos/config-tv` dans `plugins` (gated
  par `EXPO_TV`)
- `eas.json` : profils `development-tv`, `preview-tv`, `production-tv`
- ⚠️ `package.json` : swap `react-native` → `react-native-tvos` **PAS
  encore commit** — voir étape 7

### Ce que Yvan doit faire pour activer le swap

```sh
# Sur la branche feat/apple-tv-foundation
npm i react-native@npm:react-native-tvos@0.81-stable @react-native-tvos/config-tv --save-dev
npm i --legacy-peer-deps   # si conflits de peer deps
git diff package.json package-lock.json
```

Vérifier que :
- `"react-native": "npm:react-native-tvos@0.81-stable"` est bien dans
  `dependencies`
- `"@react-native-tvos/config-tv": "^0.1.6"` est dans `devDependencies`

**Avant de commit / push** : tester que le build iOS standard marche
encore (sans EXPO_TV) :

```sh
unset EXPO_TV
npx expo prebuild --clean --platform ios
npx expo run:ios   # ou: eas build --profile development --platform ios --local
```

Si l'iOS dev client lance comme avant → swap OK. Commit.

---

## 7) Premier prebuild tvOS (~30 min)

```sh
# Backup d'abord
git stash --include-untracked
git checkout feat/apple-tv-foundation

# Mode TV
export EXPO_TV=1

# Prebuild — génère ios/ avec target tvOS
npx expo prebuild --clean

# Vérifier que le projet Xcode tvOS est généré
ls ios/
open ios/FluidBody+.xcworkspace
```

Dans Xcode :
- Scheme sélecteur (en haut à gauche) → choisir l'Apple TV pairée ou le
  simulator tvOS
- ⚠️ **Erreur attendue** : HealthKit ne va pas linker sur tvOS. Voir
  étape 8 pour exclure.

---

## 8) Exclure les modules non-tvOS du build tvOS (~1-2 h)

Quand le prebuild tvOS échoue à cause de modules HealthKit/etc., il faut :

### Option A — Podfile conditional (recommandé)

Éditer `ios/Podfile` (généré par prebuild, mais avant d'être commit, mettre
en place un `expo-build-properties` plugin ou un patch script). Le bloc
ressemble à :

```ruby
target 'FluidBody+' do
  use_expo_modules!
  config = use_native_modules!

  # Exclure HealthKit du build tvOS
  if ENV['EXPO_TV'] != '1'
    pod 'KingstinctReactNativeHealthkit', :path => '../node_modules/@kingstinct/react-native-healthkit'
  end

  # ...
end
```

**⚠️** : `expo prebuild` régénère le Podfile à chaque run. Pour persister
la modification, utiliser **`expo-build-properties` plugin** dans
`app.json` ou écrire un **config plugin custom** dans `plugins/`.

### Option B — Mocker côté JS (plus simple, à court terme)

Dans le code, partout où `@kingstinct/react-native-healthkit` est importé,
wrapper dans un check `Platform.isTV` :

```js
let HealthKit = null
if (!Platform.isTV) {
  try { HealthKit = require('@kingstinct/react-native-healthkit') }
  catch (e) {}
}
```

Et créer un `react-native-healthkit.tv.js` stub qui exporte des no-ops.

Cela ne résout PAS le problème de link natif iOS pendant le pod install
tvOS. Pour ça, il faut quand même un mécanisme côté Podfile.

### Modules à exclure du build tvOS

Liste précise (cross-référencer avec `apple-tv-strategy.md` § matrice) :

- `@kingstinct/react-native-healthkit` — **doit être exclu** du Podfile tvOS
- `expo-apple-authentication` — **doit être exclu** OU remplacé par
  AuthenticationServices natif tvOS
- `expo-screen-orientation` — peut rester (no-op sur tvOS)
- `@react-native-community/datetimepicker` — à exclure si on en met partout
- `expo-notifications` — à exclure (UNUserNotificationCenter restrictif sur
  tvOS, va warn au build)

---

## 9) Premier build dev tvOS sur device (~20 min)

```sh
export EXPO_TV=1
eas build --profile development-tv --platform ios --local
# OU
npx expo run:ios --device "<nom de l'Apple TV>"
```

Si EAS local build est trop long, builder via Xcode directement :
- Sélectionner scheme FluidBody+
- Choose destination : Apple TV pairée
- ⌘B (build) puis ⌘R (run)

L'Apple TV doit afficher l'écran Metro packager (par défaut).

---

## 10) (futur) Builds preview / production tvOS via EAS cloud (~5 min config)

```sh
export EXPO_TV=1
eas build --profile production-tv --platform ios   # cloud build
eas submit --profile production-tv --platform ios
```

EAS cloud lit `EXPO_TV` depuis le profil `eas.json` (déjà configuré).

---

## Récap des coûts annexes Apple Developer

- ✅ Compte Apple Developer Program ($99/an) — déjà payé pour iOS
- ✅ Bundle ID — gratuit (compris dans le compte)
- ✅ Provisioning profiles — gratuits
- ✅ TestFlight — gratuit, jusqu'à 10k testeurs externes
- ✅ App Store Connect — gratuit
- 💰 RevenueCat — free tier large, ~$0-15/mo selon MTR tvOS
- 💰 Bunny CDN — bande passante 4K HLS pèsera plus, à monitorer

**Total cash supplémentaire pour aller live tvOS : 0 €** (jusqu'à passer
le free tier RevenueCat).
