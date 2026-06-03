# Fonds d'écran FluidBody+

Wallpapers statiques reprenant l'esthétique de l'écran de veille `fluidbody.ch/veille` :
dégradé navy → teal pâle, méduses translucides, halos turquoise subtils.

Palette : navy `#0E2730` · teal sombre `#3D6068` · teal pâle `#6BAEAF` · turquoise halo `#55BBC9` · accent lime `#B8E62E` (très subtil).

## Versions

Chaque résolution existe en **2 variations** :
- `-clean` : background + méduses uniquement
- `-branded` : avec le mot-symbole `FLUIDBODY+` très discret en bas centre

## Quel fichier pour quel appareil

| Appareil | Fichier recommandé |
|---|---|
| Studio Display / écran 5K | `mac-5k-5120x2880-*.png` |
| iMac 4K / écran externe 4K | `mac-4k-3840x2160-*.png` |
| MacBook Pro 14" | `macbook-pro-14-3024x1964-*.png` |
| MacBook Pro 16" | `macbook-pro-16-3456x2234-*.png` |
| iPad Pro 12,9" (paysage) | `ipad-pro-12-9-2732x2048-*.png` |
| iPad Pro 12,9" (portrait) | `ipad-pro-12-9-2048x2732-*.png` |
| iPad Pro 11" (paysage) | `ipad-pro-11-2388x1668-*.png` |
| iPad Pro 11" (portrait) | `ipad-pro-11-1668x2388-*.png` |
| iPhone 15/16 Pro Max | `iphone-15-pro-max-1290x2796-*.png` |
| iPhone 15/16 Pro | `iphone-15-pro-1179x2556-*.png` |
| iPhone 15/16 (standard) | `iphone-15-1170x2532-*.png` |
| Apple TV 4K | `apple-tv-3840x2160-*.png` |

> iPhone : utilise `-clean` pour laisser respirer l'horloge et les widgets de l'écran verrouillé.
> L'iPad et le Mac affichent bien la version `-branded`.

## Installation

- **Mac** : Réglages Système → Fond d'écran → Ajouter une photo → sélectionne le PNG.
- **iPad / iPhone** : envoie-toi le fichier en AirDrop → ouvre dans Photos → bouton Partager → « Utiliser en fond d'écran ».
- **Apple TV** : il n'y a pas d'import direct de fond d'écran tvOS ; utilise le PNG comme visuel de référence / poster, ou via une app photo iCloud en économiseur d'écran.

## Régénérer

```bash
node marketing/wallpapers/_generate.js
```

Le script (`_generate.js`) utilise Puppeteer-core + Chrome installé. La méduse SVG
provient de `fluidbody-web/assets/meduse.svg`. Adapte le tableau `RESOS` ou les
layouts `LAYOUT` pour ajouter des formats / repositionner les méduses.
