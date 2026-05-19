# Ambient sound — spec & wiring

**Statut :**
- ✅ Utilitaire JS prêt — `src/utils/ambientSound.js` (load/save préf, play/pause/setVolume,
  fallback silencieux si l'asset n'est pas bundlé).
- ✅ Réglage utilisateur exposé dans **Profil → Pendant la séance → Ambiance audio**.
- ⏳ Intégration VideoPlayer reportée — voir `INTEGRATION_NOTES.md`. Une autre tâche
  travaille déjà sur `VideoPlayer.js` (branche `feat/ai-form-coaching-foundation`),
  donc on garde le câblage final pour un merge ultérieur.
- ⏳ Assets `.m4a` non fournis dans cette PR. Yvan les uploadera dans
  `assets/ambient/`. Le code détecte leur absence sans crasher (`require` raté
  → `null` → `play()` est un no-op silencieux).

## Vision

Pendant une séance Fluidbody (VideoPlayer monté + en lecture), l'utilisateur
peut activer un fond sonore d'ambiance qui se superpose au coaching vocal de
Sabrina. Volume bas (≈ -18 dB sous la voix), boucle infinie, fade-in/out
600 ms aux extrémités (à implémenter lors du câblage VideoPlayer).

## Choix d'ambiance (4 pistes)

| Slug | Description | Durée loop | Mix |
| --- | --- | --- | --- |
| `silence` | Pas d'ambiance — défaut | n/a | n/a |
| `ocean` | Vagues lentes lointaines, fréquence respiratoire 4-6 cycles/min, pas de mouettes | 2 min | stereo wide, basse coupée < 80 Hz |
| `medusae` | Drone synthé subaquatique tonal pad C+G, hum profond, ping subtils espacés ≥ 8 s | 4 min | mono, reverb long (>2 s), brillance basse |
| `forest` | Brise + feuilles, pas d'oiseaux (oiseaux trop intrusifs en séance) | 3 min | stereo léger, hi-shelf cut −3 dB |

### Specs techniques communes

- Format : `.m4a` AAC stéréo 128 kbps (mono accepté pour `medusae`).
- Loudness cible : **-23 LUFS** (intégré) ± 1 LU. Permet d'éviter le clipping
  quand la voix coach s'ajoute par-dessus.
- True-peak max : **-1 dBTP**.
- Loop seamless : cross-fade interne ~200 ms aux extrémités (pas de pop audible).
- Pas de signature musicale forte (mélodie reconnaissable) — l'ambiance doit
  rester un fond, pas devenir un morceau.

### Pistes pour Yvan : où trouver les samples

- **FreeSound.org** (CC0 ou CC-BY, attribuer si nécessaire) — recherche
  `ocean waves loop`, `underwater drone`, `forest wind leaves`.
- **Pixabay Music** — catégorie "Ambient" / "Nature".
- **Génération algorithmique** : `scipy.signal` + `numpy` pour un bruit rose
  filtré (vagues), ou un oscillateur sin C+G + low-pass + reverb (méduses).
  Garder cette piste comme fallback si rien de libre ne convient.

## Stockage des fichiers

Bunny CDN n'a pas de sens pour 3 boucles courtes — bundle dans l'app via
`assets/ambient/{ocean,medusae,forest}.m4a`. Pas besoin d'éditer
`app.json` `assetBundlePatterns` : Expo bundle tout le dossier `assets/`
par défaut.

Total cible : ≈ 3 × 1.5 MB = 4.5 MB. Acceptable pour le bundle iOS.

## Câblage côté code

### 1. Utilitaire (déjà en place)

```js
import ambient from '../utils/ambientSound';

// Au mount d'une séance :
const { slug, volume } = await ambient.loadPreference();
await ambient.setVolume(volume);
await ambient.play(slug);

// Volume runtime :
await ambient.setVolume(0.18);

// Au unmount :
await ambient.stop();
```

Slugs valides : `'silence' | 'ocean' | 'medusae' | 'forest'`.
Clés AsyncStorage : `fluid_ambient_sound`, `fluid_ambient_volume`.

### 2. Préférences utilisateur (déjà en place)

`src/screens/Profil.js` expose la section **Ambiance audio** dans le bloc
"Pendant la séance" : 4 choix segmentés + slider volume. Persiste via
`ambient.setPreference()` et `ambient.setVolume()`.

### 3. Câblage VideoPlayer (TODO)

Voir `INTEGRATION_NOTES.md`. Côté player on doit :
- Au mount, lire la préférence et appeler `ambient.play(slug)`.
- Quand l'ambient joue, baisser la piste vidéo (voix coach) à **70 %** de
  son volume normal et garder l'ambient à `volume * 0.3` (cf. partie 1.C
  de la mission).
- Au unmount / au tap "Fermer la séance", `ambient.stop()`.
- Quand l'utilisateur change de piste depuis le sheet "Ambiance pendant la
  séance" : crossfade 400 ms (`setVolumeAsync` rampé manuellement —
  expo-av ne fournit pas de fade natif).

## Définition de "done"

- [ ] 3 pistes uploadées dans `assets/ambient/`.
- [ ] `expo-av` lit sans glitch sur iPhone physique (testé) et émulateur Android.
- [ ] Le mix avec la voix coach reste intelligible (la voix domine).
- [ ] Pas de fuite mémoire sur cycle ouvre/ferme la séance × 20 fois.
- [ ] La préférence persiste entre lancements (déjà testable avec le réglage
  Profil — l'utilitaire écrit dans AsyncStorage à chaque tap).
