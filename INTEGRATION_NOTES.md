# Integration notes — `feat/sound-onboarding-polish`

Cette PR ajoute deux features (ambient sound + tutorial + empty-states),
mais l'intégration *runtime* de certaines pièces a été volontairement
reportée pour éviter de modifier deux fichiers que la tâche parallèle
`feat/ai-form-coaching-foundation` réécrit également :

- `src/components/VideoPlayer.js`
- `App.js` (routing root, montage initial)

Une fois `feat/ai-form-coaching-foundation` mergée dans `main`, brancher
les morceaux ci-dessous prend ~30 min.

---

## 1. Ambient sound dans VideoPlayer

L'utilitaire `src/utils/ambientSound.js` est complet. Il manque juste à
le câbler dans le cycle de vie d'une séance + UI sheet.

### 1a. Cycle de vie

Dans `VideoPlayer.js`, près du `useEffect` qui charge la vidéo signée :

```js
import ambient from '../utils/ambientSound';

useEffect(() => {
  let cancelled = false;
  (async () => {
    const { slug, volume } = await ambient.loadPreference();
    if (cancelled) return;
    await ambient.setVolume(volume);
    await ambient.play(slug);
  })();
  return () => {
    cancelled = true;
    ambient.stop();
  };
}, []);
```

Mettre le `play` après que `Audio.setAudioModeAsync` du VideoPlayer ait
configuré la session iOS (sinon iOS peut interrompre la lecture).

### 1b. Ducking de la voix coach

Quand `ambient.isPlaying()`, baisser le volume de la `Video` à `0.7` :

```js
useEffect(() => {
  if (!videoRef.current) return;
  const target = ambient.isPlaying() ? 0.7 : 1.0;
  videoRef.current.setVolumeAsync(target).catch(() => {});
}, [ambientSlug]);
```

(Le slug peut être suivi via un petit subscriber pattern, ou un state
local synchronisé sur les boutons du sheet.)

### 1c. UI in-player

Ajouter un bouton speaker en haut à gauche du player (à côté de l'icône
fermeture). Tap → modal/sheet "Ambiance pendant la séance" avec :
- Liste segmentée des 4 ambiances (`silence`, `ocean`, `medusae`, `forest`)
- Slider volume 0 → 1
- Le sheet appelle `ambient.setPreference(slug)` et `ambient.setVolume(v)`
  qui s'occupent de persister + de swap la piste en cours.

Composants à réutiliser : `GlassSheet`, `GlassPressable`, `GlassButton`.
Strings i18n déjà ajoutées : `ambient_sheet_title`, `ambient_label_*`,
`ambient_volume_label`.

---

## 2. Tutorial first-launch dans App root

`src/screens/TutorialScreen.js` est prêt et autonome. Pour le déclencher
au premier lancement (après `OnboardingScreen`, avant le MainApp tabs) :

### 2a. Flag d'état

```js
// quelque part dans le root App :
const [tutorialDone, setTutorialDone] = useState(null); // null = loading
useEffect(() => {
  AsyncStorage.getItem('fluid_tutorial_done_v1')
    .then(v => setTutorialDone(v === 'true'))
    .catch(() => setTutorialDone(true)); // safe fallback : skip
}, []);
```

### 2b. Branchement dans le routeur

```js
import TutorialScreen from './src/screens/TutorialScreen';

// Après le check onboarding, avant MainApp :
if (onboardingDone && !tutorialDone) {
  return (
    <TutorialScreen
      lang={lang}
      prenom={prenom}
      onDone={async () => {
        await AsyncStorage.setItem('fluid_tutorial_done_v1', 'true');
        setTutorialDone(true);
      }}
    />
  );
}
```

Le tutorial gère lui-même `Passer` et `Suivant` ; `onDone` est appelé
dans les deux cas (skip = finir tôt = sauvegarder quand même pour ne
pas le re-montrer en boucle).

### 2c. Réarmer depuis Profil (déjà en place)

Dans Profil → mode coach (admin), un bouton "Réinitialiser le tutoriel"
supprime `fluid_tutorial_done_v1`. Pratique pour le screenshot store.

---

## 3. ErrorRetry + offline toast

`src/components/ErrorRetry.js` est un composant générique réutilisable.
Il n'a pas de point d'intégration unique — on l'ajoute au cas par cas
quand une requête réseau peut planter (chargement vidéo signée, fetch
des stats, etc.).

Cas suggérés à câbler plus tard :
- Dans `VideoPlayer` : quand `getSignedVideoUrl()` rejette → afficher
  `<ErrorRetry kind="video" onRetry={...} />` plein écran sur le player.
- Au mount de `Activity` : si `readActivitySummary()` rejette → afficher
  `<ErrorRetry kind="network" onRetry={...} />` au-dessus des rings.
- Au tap d'un bouton "Sync" qui timeout → toast Liquid Glass avec
  `<ErrorRetry compact />` (le composant supporte `compact` pour un
  rendu en barre fine plutôt qu'en carte).

---

## Garde-fous lors du merge

1. Si VideoPlayer ou App.js ont été réécrits en parallèle, **ne pas faire
   un merge bête** — relire le diff, importer `ambient` correctement,
   garder l'ordre `setAudioModeAsync` → `ambient.play()`.
2. Les nouvelles strings i18n (`ambient_*`, `tutorial_*`, `empty_*`,
   `error_*`) ne doivent pas être perdues lors du merge — elles sont en
   FR et EN dans `src/constants/data.js`.
3. Pas de build EAS lancé depuis cette branche — laisser Yvan déclencher
   sa pipeline une fois le merge propre.
