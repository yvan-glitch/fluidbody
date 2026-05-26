# Ajouter une nouvelle séance vidéo dans Fluidbody

Ce guide te permet d'ajouter une séance vidéo de bout en bout : tournage → Bunny Stream → Supabase → `data.js` → tests → build. Environ **30-45 min** par séance une fois le workflow rodé.

---

## Avant de commencer

### Identifier la nouvelle séance

Pour chaque nouvelle séance, tu as besoin de définir :

| Champ | Exemple | Notes |
|---|---|---|
| **Pilier** | `p2` (Dos) | Doit correspondre à un pilier existant dans `data.js` (`p1`-`p9`) |
| **Index** | `0`, `1`, `2`... | Position dans la liste du pilier. Numérotation continue à partir de 0. |
| **Session ID** | `p2_0`, `p2_1`... | Format `{pilier}_{index}`. C'est l'identifiant unique pour Bunny + Supabase + l'app. |
| **Titre FR** | "Le dos expliqué" | Court, descriptif, parlant pour l'utilisateur |
| **Titre EN** | "Understanding the back" | Traduction équivalente |
| **Durée** | `"2'23''"` | Format string `M'SS''` (apostrophes simples comme dans data.js) |
| **Type** | `Comprendre` / `Apprendre` / `Exécuter` / `Découvrir` | Progression pédagogique de la séance |

### Tu auras besoin de

- Le fichier vidéo MP4 final (1080p min, encodage H.264)
- Accès dashboard **Bunny** (`https://dash.bunny.net`)
- Accès dashboard **Supabase** (`https://supabase.com/dashboard/project/ctvtjeidkqpdsmhsjsij`)
- Accès au repo Fluidbody sur ton Mac
- 5-10 min de temps dispo pour tester en local après

---

## Étape 1 — Uploader la vidéo sur Bunny Stream

### A. Te connecter au dashboard Bunny

1. Va sur **https://dash.bunny.net**
2. Sidebar gauche → **Stream**
3. Clique sur ta library **"Fluidbody Pilates"**

### B. Upload la vidéo

1. Bouton bleu **"Upload a Video"** en haut à droite
2. Glisse-dépose ton fichier `.mp4` ou clique pour browser
3. **Patiente** pendant l'upload (1-5 min selon taille fichier et connexion)
4. **Patiente** pendant l'encoding Bunny (5-15 min selon durée vidéo) — Bunny génère les 4 qualités (240p, 360p, 720p, 1080p) automatiquement

### C. Récupérer le GUID (très important)

Une fois encoding terminé :
1. Clique sur la vidéo dans la liste
2. Tu vois une URL du type :
   ```
   https://vz-1a4e2cac-0dc.b-cdn.net/{GUID}/playlist.m3u8
   ```
3. **Copie le `{GUID}`** — c'est ton identifiant unique pour Bunny (format UUID type `02edcbb8-ca7c-4b58-8e64-719ad457bf92`)

### D. (Optionnel) Activer les sous-titres

Si tu veux des sous-titres :
1. Onglet **Captions** de la vidéo
2. Upload `.vtt` (français nommé `fr.vtt`, anglais `en.vtt`)
3. L'app les chargera automatiquement via le sign-video-url

---

## Étape 2 — Ajouter dans Supabase `video_assets`

### A. Ouvrir le SQL Editor

1. Va sur **https://supabase.com/dashboard/project/ctvtjeidkqpdsmhsjsij**
2. Sidebar gauche → **SQL Editor**
3. Nouveau query (icône `+`)

### B. Insérer la séance

Copie-colle, **adapte les valeurs** :

```sql
INSERT INTO public.video_assets (session_id, bunny_path)
VALUES (
  'p2_3',  -- ← remplace par ton session_id
  '02edcbb8-ca7c-4b58-8e64-719ad457bf92'  -- ← remplace par le GUID Bunny
);
```

Si tu ajoutes plusieurs séances d'un coup :

```sql
INSERT INTO public.video_assets (session_id, bunny_path) VALUES
  ('p2_3', 'guid-de-la-vidéo-1'),
  ('p2_4', 'guid-de-la-vidéo-2'),
  ('p4_0', 'guid-de-la-vidéo-3');
```

Clique **Run** (Cmd+Enter).

### C. Vérifier

```sql
SELECT session_id, bunny_path FROM public.video_assets ORDER BY session_id;
```

Tu dois voir ta nouvelle séance dans la liste.

---

## Étape 3 — Ajouter dans `src/constants/data.js`

### A. Trouver le pilier

Ouvre `src/constants/data.js` dans ton éditeur favori. Cherche `SEANCES_FR` (et `SEANCES_EN`).

Tu verras une structure comme :

```js
export const SEANCES_FR = {
  p1: [
    ['Titre séance 1', "0'45''", 'Comprendre', false],
    ['Titre séance 2', "1'30''", 'Apprendre', false],
    // ...
  ],
  p2: [
    ['Pourquoi le dos souffre', "2'31''", 'Comprendre', true],
    ['Le dos expliqué', "2'23''", 'Comprendre', true],
    // ← C'est ici qu'on ajoute ta nouvelle séance
  ],
  // ...
};
```

### B. Format d'une séance

Chaque séance est un tableau `[titre, durée, type, hasVideo]` :

- `titre` : string FR (équivalent EN dans `SEANCES_EN`)
- `durée` : string format `"M'SS''"` (ex: `"5'12''"`)
- `type` : `'Comprendre'` | `'Apprendre'` | `'Exécuter'` | `'Découvrir'`
- `hasVideo` : `true` si la séance a une vidéo Bunny (sinon `false` = juste théorie texte)

### C. Insérer la nouvelle séance

Ajoute la ligne au bon index du pilier dans `SEANCES_FR` ET dans `SEANCES_EN` :

```js
// Dans SEANCES_FR :
p2: [
  ['Pourquoi le dos souffre', "2'31''", 'Comprendre', true],
  ['Le dos expliqué', "2'23''", 'Comprendre', true],
  ['Réveil du dos en 5 min', "5'15''", 'Apprendre', true],  // ← NOUVEAU index 2
  // séances suivantes...
],
```

```js
// Dans SEANCES_EN :
p2: [
  ['Why the back suffers', "2'31''", 'Understand', true],
  ['The back explained', "2'23''", 'Understand', true],
  ['Back wake-up in 5 min', "5'15''", 'Learn', true],  // ← NOUVEAU même index 2
  // séances suivantes...
],
```

⚠️ **Important** : l'index doit être identique en FR et EN. C'est lui qui détermine le `session_id` (ici `p2_2`).

### D. (Optionnel) Ajouter ES et IT

Si tu veux supporter espagnol/italien, ajoute aussi dans `SEANCES_ES` et `SEANCES_IT` (mais c'est pas obligatoire — les utilisateurs ES/IT verront le contenu FR par défaut).

---

## Étape 4 — Commit + push

Dans ton terminal :

```bash
cd /Users/xvan06/fluidbody
git status
git add src/constants/data.js
git commit -m "feat(content): add seance p2_2 'Réveil du dos en 5 min'"
git push origin main
```

---

## Étape 5 — Tester localement

### A. Lancer l'app

```bash
cd /Users/xvan06/fluidbody
npx expo start --clear
```

Scan le QR code avec ton iPhone (Expo Go ou dev client).

### B. Naviguer vers la nouvelle séance

1. Connecte-toi avec un compte test
2. Ouvre l'onglet **MonCorps** → tap sur le pilier concerné (ex: Dos)
3. La nouvelle séance doit apparaître dans la liste à son index
4. Tap dessus → la vidéo doit charger et jouer
5. Vérifie que la durée affichée correspond à ce qui se passe

### C. Si la vidéo ne joue pas

Quelques pistes :
- Bunny encoding peut-être pas terminé (attends 5-10 min)
- GUID mal copié dans Supabase (revérifie via SQL `SELECT * FROM video_assets WHERE session_id = 'p2_2';`)
- Token authentication Bunny désactivée (CDN > Security > Token Authentication doit être ON)
- L'app cache des sessions précédentes — kill + relance

---

## Étape 6 — Builder pour TestFlight

Une fois testée en local et OK :

```bash
cd /Users/xvan06/fluidbody
eas build --profile production --platform ios --non-interactive --auto-submit \
  --message "Build avec nouvelle séance: Réveil du dos en 5 min"
```

⚠️ EAS auto-increment le numéro de build. Compte 15-30 min pour build + processing Apple. Une fois reçu, install via TestFlight et re-teste sur device réel.

---

## Récap visuel du workflow

```
[Vidéo MP4]
    ↓ upload
[Bunny Stream]  → récupère le GUID
    ↓ insert
[Supabase video_assets]  ← session_id ↔ bunny_path
    ↓ référence
[data.js SEANCES_FR/EN]  ← titre, durée, type
    ↓ commit
[git push main]
    ↓ build
[EAS Build]  → IPA
    ↓ submit
[TestFlight]  → install device
    ↓ test
[Production ready]
```

---

## Notes de qualité vidéo

Pour que tes séances aient un rendu premium dans Fluidbody :

### Spécifications recommandées

- **Résolution** : 1920×1080 (Full HD) min, 4K possible pour iPad/Apple TV
- **Frame rate** : 30 fps stable
- **Codec** : H.264 baseline ou High profile, AAC audio
- **Bitrate** : 6-10 Mbps (Bunny le réencode quoi qu'il arrive)
- **Audio** : -14 LUFS (norme broadcast) avec micro propre (pas micro intégré iPhone)

### Conseils tournage rapides

- **Lumière naturelle** côté ouest l'après-midi (golden hour) ou nord toute la journée (lumière douce constante)
- **Fond uni** ou minimaliste (mur blanc, voilage, jamais distraction visuelle)
- **Vêtements** : couleurs unies sombres ou turquoise/vert citron Fluidbody pour rappel marque
- **Tapis** sombre ou turquoise (continuité visuelle avec l'app)
- **Cadre** : plan large qui montre tout le corps + zoom sur les détails clés
- **Audio** : enregistrer le tapis bouge / les vêtements bruissent peu = micro proche

### Editing rapide

- iMovie ou DaVinci Resolve (gratuit, plus pro)
- Intro 3-5 sec avec logo Fluidbody (déjà filmé une fois, réutilisable)
- Outro 3-5 sec "Bravo, tu as fait ta séance"
- Export Apple ProRes ou H.264 1080p 30fps

---

## Troubleshooting

### La nouvelle séance n'apparaît pas dans l'app

- Vérifie `data.js` : la session est bien dans `SEANCES_FR[piler]` ?
- Vérifie le push : `git log --oneline -3` sur main devrait montrer ton commit
- Vérifie le rebuild Metro : `npx expo start --clear` (option --clear est crucial)

### La vidéo se charge mais ne joue pas

- Vérifie Supabase `video_assets` : `SELECT * FROM video_assets WHERE session_id = 'p2_X';`
- Vérifie Bunny : la vidéo est-elle bien encodée ? (status "Ready" dans le dashboard)
- Vérifie Bunny Security : CDN Token Authentication doit être ON
- Vérifie le format : MP4 H.264 (pas HEVC, pas WebM)

### Erreur 403 Forbidden quand la vidéo se charge

- L'edge function `sign-video-url` ne trouve pas le bunny_path → vérifie Supabase video_assets
- Le token Bunny est peut-être expiré ou mal configuré (BUNNY_TOKEN_KEY secret côté Supabase)

### EAS build échoue

- `expo-doctor` doit passer 15-17/17 (lance-le avant build)
- Pas de console.log non gardé par `__DEV__` dans le code modifié

---

## Quand le catalogue grandit

Quand tu approches 30-50+ séances, certaines choses méritent reconsidération :

1. **Search/filter** est déjà en place dans Bibliothèque — utile à partir de 15-20 séances
2. **Favoris** activé — utilisateurs marquent leurs préférées
3. **Programmes algo** générés depuis le catalogue (plus le catalogue grandit, mieux les programmes sont)
4. **Categories thématiques** dans Bibliothèque (déjà partiel : "Récents", "Populaires") — à enrichir

Tu n'as pas besoin de rebuilder l'app pour ajouter des séances. Juste :
1. Upload Bunny + Supabase + push `data.js` → la séance est dispo au prochain redémarrage de l'app par les utilisateurs (s'ils ont un OTA update Expo) ou au prochain build natif.

Pour des changements **purement contenu** (pas de native code), les **Expo Updates OTA** peuvent te dispenser de rebuilder — à explorer plus tard si tu fais beaucoup de releases contenu.

---

## Ressources

- **Dashboard Bunny** : https://dash.bunny.net (login avec ton compte Bunny)
- **Dashboard Supabase** : https://supabase.com/dashboard/project/ctvtjeidkqpdsmhsjsij
- **EAS Builds** : https://expo.dev/accounts/ytissot/projects/fluidbody/builds
- **App Store Connect** : https://appstoreconnect.apple.com/apps/6761364962

---

*Dernière mise à jour : 2026-05-19 — Workflow validé sur les 3 premières séances filmées.*
