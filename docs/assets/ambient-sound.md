# Ambient sound — spec & wiring

**Statut :** non-implémenté. Le toggle UI peut être branché en ~1h dès qu'on a
les assets audio. Cette note fixe le plan pour que Yvan puisse fournir les
fichiers et que je puisse câbler la lecture sans rouvrir le sujet.

## Vision

Pendant une séance Fluidbody (VideoPlayer monté + en lecture), l'utilisateur
peut activer un fond sonore d'ambiance qui se superpose au coaching vocal de
Sabrina. Volume bas (≈ -18 dB sous la voix), boucle infinie, fade-in/out
600 ms aux extrémités.

## Choix d'ambiance (4 pistes)

| Slug | Description | Durée loop |
| --- | --- | --- |
| `silence` | Pas d'ambiance — défaut | n/a |
| `ocean` | Vagues douces lointaines, pas de mouettes | 2 min |
| `medusae` | Drone synthé subaquatique, type "Hyperion" tonal pad C+G | 4 min |
| `forest` | Brise + feuilles, pas d'oiseaux | 3 min |

Format : `.m4a` AAC stéréo 128 kbps, normalisé à -23 LUFS pour éviter le
clipping quand la voix coach s'ajoute. Loop seamless (cross-fade interne
~200 ms).

## Stockage

Bunny CDN ne fait pas vraiment de sens pour ces 4 boucles courtes — on les
bundle dans l'app via `assets/ambient/{ocean,medusae,forest}.m4a`. Ajout à
`assets/` directement + entrée dans `app.json` `assetBundlePatterns` si
nécessaire.

Total ≈ 4 × 1.5 MB = 6 MB, acceptable pour le bundle iOS.

## Câblage

1. Hook `src/hooks/useAmbientSound.js` :
   ```js
   const { current, setCurrent } = useAmbientSound();
   // current = 'silence' | 'ocean' | 'medusae' | 'forest'
   ```
   Lecture via `expo-av` `Audio.Sound`, `isLooping: true`,
   `volume: 0.18`. Stop + dispose au unmount.
2. Toggle dans **Profil → Réglages → Ambiance audio** : segmented control
   (icônes simples), valeur persistée dans `fluid_ambient_pref`.
3. VideoPlayer lit la préférence au mount, démarre la piste au premier
   `isPlaying`, stoppe au unmount. Si user change de piste depuis Réglages
   pendant qu'une séance tourne → crossfade 400 ms.

## Définition de "done"

- 4 pistes uploadées dans `assets/ambient/`, `expo-av` lit sans glitch sur
  iPhone (testé physique) et émulateur Android.
- Le mix avec la voix coach reste intelligible (la voix domine).
- Pas de fuite mémoire au cycle ouvre/ferme la séance × 20 fois.
