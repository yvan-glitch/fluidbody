# Connexion Google — réglages à faire une fois

Le **code** est en place (bouton + handler dans `src/screens/SignIn.js`, plugin dans `app.config.js`, calqué sur la connexion Apple). Il reste les **réglages externes** ci-dessous. Une fois faits, plus rien à retoucher dans le code.

Tout passe par des **variables d'environnement** : si tu te trompes d'identifiant, tu corriges la variable (et tu rebuild), sans jamais éditer le code.

---

## A. Installer la dépendance  *(terminal, dans `~/fluidbody`)*

```bash
npx expo install @react-native-google-signin/google-signin
```

(Ça ajoute le module et choisit la version compatible avec ton Expo SDK 54.)

---

## B. Créer les identifiants Google  *(console.cloud.google.com)*

1. Choisis (ou crée) un **projet Google Cloud**.
2. **APIs & Services → OAuth consent screen** : configure-le (type *External*, nom « FluidBody+ », email de support). Ajoute ton adresse comme testeur si tu restes en mode test.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, et crée **trois** clients :

   - **Web application** — nomme-le « FluidBody Web ». Note le **Client ID** *et* le **Client secret**. ⟵ c'est le `webClientId` du code + ça va dans Supabase.
   - **Android** — package : `com.ytissot.fluidbody` + la **SHA-1** (voir étape C). Aucun ID à recopier pour le code.
   - **iOS** — bundle : `com.ytissot.fluidbody`. Note le **iOS Client ID**. Sa version « inversée » (format `com.googleusercontent.apps.XXXXXXXX`) est l'**iosUrlScheme**.

---

## C. Récupérer la SHA-1 Android  *(terminal, dans `~/fluidbody`)*

```bash
eas credentials
```

→ **Android** → ton profil → affiche la keystore → copie le **SHA-1 Fingerprint**.
(Alternative : dashboard Expo → projet *fluidbody* → *Credentials* → *Android*.)

Colle cette SHA-1 dans le client OAuth **Android** créé à l'étape B.

---

## D. Activer Google dans Supabase  *(dashboard Supabase → Authentication → Providers → Google)*

1. **Active** Google.
2. Colle le **Web Client ID** + **Web Client Secret** (étape B).
3. Dans **« Authorized Client IDs »**, ajoute le **Web Client ID** *et* le **iOS Client ID** (séparés par une virgule). C'est ce qui autorise la connexion native.
4. (iOS) Si l'option **« Skip nonce checks »** est proposée, active-la.
5. **Save**.

---

## E. Variables d'environnement EAS  *(dashboard Expo → projet fluidbody → Environment variables)*

Ajoute ces 3 variables, cochées pour **preview**, **production** et **development** (visibilité *Plain text*) :

| Nom | Valeur |
|---|---|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | le **Web Client ID** (étape B) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | le **iOS Client ID** (étape B) |
| `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` | le iOS Client ID **inversé** (`com.googleusercontent.apps.XXXX`) |

---

## F. Rebuild + test

```bash
eas build -p android --profile preview
```

Installe, ouvre l'écran de connexion → le bouton **« Continuer avec Google »** doit apparaître et ouvrir le sélecteur de compte Google natif.
(iOS : `eas build -p ios --profile preview`, ou via TestFlight.)

---

## Bon à savoir

- Le bouton Google s'affiche **sur Android** (bouton social principal) **et sur iOS** (sous le bouton Apple), dès que `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` est défini.
- Tant que les variables ne sont pas posées, **le build passe quand même** — le bouton Google reste juste masqué, aucun crash. Apple est inchangé.
- **Build Apple TV** (`*-tv`) : le plugin Google est automatiquement exclu (l'Apple TV se connecte par pairing). Si un build TV échoue à cause du module natif, il faudra l'exclure de l'autolinking tvOS — me le signaler.
- Ordre conseillé : **A → B → C → D → E → F**. Les étapes B/C/D/E se font dans les tableaux de bord (modifiables sans rebuild) ; seule F coûte un crédit de build.
