# Recap nuit — Polish iPad + tvOS · 2 juin 2026

Travail réalisé pendant la nuit sur deux demandes :
1. **iPad Pro** : photos de catégories étirées → corrigé.
2. **tvOS** : polish du focus pour un rendu plus premium.

Toutes les modifications sont **strictement isolées derrière `IS_IPAD` ou `IS_TV`**.
👉 **Le rendu iPhone est inchangé, à l'octet près** (sur iPhone `CW = SW`, `RW = 1`,
`ipadH(h) = h`, `maxWidth = undefined`, et la grille Biblio reste à 2 colonnes).

---

## 1. iPad — pourquoi les photos paraissaient étirées

Les images utilisent toutes `contentFit="cover"` : l'image elle-même ne se déforme
jamais. Le vrai problème venait des **cartes**, dimensionnées à partir de la largeur
brute de l'écran (`SW`). Sur iPhone (`SW ≈ 390`) c'est parfait ; sur iPad Pro
(`SW ≈ 1024`) les cartes devenaient des bandeaux pleine largeur de 460 px de haut,
avec en plus un zoom `scale(1.15)` → la photo recadrée paraissait étirée / sur-zoomée.

### Solution
Sur iPad, le contenu est désormais contraint dans une **colonne centrée** de largeur
type « grand téléphone » (`CONTENT_MAX_W = 640 px`), et toutes les cartes sont
dimensionnées sur cette largeur effective plutôt que sur la dalle entière. Résultat :
des proportions de cartes identiques à l'iPhone, centrées, avec de jolies marges
latérales — exactement ce que font les apps premium pensées « mobile d'abord ».

### Fichiers modifiés

**`src/screens/MonCorps.js`** (écran d'accueil / catégories)
- Nouveaux helpers : `CONTENT_MAX_W`, `CW` (largeur effective), `RW` (ratio), `ipadH()`.
- ScrollView de contenu : `maxWidth` + `alignSelf: 'center'` sur iPad.
- Cartes catégories de l'onglet *Explorer* : hauteur/largeur basées sur `CW` (au lieu de `SW`).
- Mosaïque *Pour vous*, grille *Recherche* : largeurs basées sur `CW`.
- Bandeaux photo à hauteur fixe (séance du jour, programmes thématiques, live,
  cartes recommandées) : hauteurs mises à l'échelle via `ipadH()` pour garder le
  bon ratio au lieu de bandes larges et basses.

**`src/screens/Bibliotheque.js`** (bibliothèque — même bug latent)
- Ajout de `IS_IPAD`.
- La grille de résultats passe de **2 → 3 colonnes** sur iPad, avec une hauteur de
  vignette proportionnelle (au lieu de 486×170 px très étirés).

---

## 2. tvOS — polish du focus

Le composant `FocusableCardTV` (utilisé par **toutes** les cartes Apple TV) anime
déjà un scale + un anneau lumineux au focus. Changement appliqué :

**`src/components/tv/FocusableCardTV.js`**
- Le scale au focus passe d'un `timing` linéaire à un **`spring`** (léger
  dépassement « vivant » caractéristique du focus engine Apple TV — bien plus
  tactile).
- Scale réduit `1.10 → 1.08` (assez pour ressortir, sans risque de clipping sur
  les grandes cartes).
- Anneau légèrement plus rapide (`200 → 180 ms`) pour rester synchro.

---

## Vérifications faites
- Les 3 fichiers passent au parseur (`@babel/parser`, JSX) sans erreur de syntaxe.
- Aucune modification hors `IS_IPAD` / `IS_TV` → iPhone garanti inchangé.

## À tester par toi (je ne peux pas lancer l'iPad / l'Apple TV ici)
1. `npx expo start` puis ouvrir sur l'iPad Pro → vérifier l'onglet *Explorer*
   (catégories), *Pour vous*, *Recherche*, et la *Bibliothèque*.
2. Si tu trouves la colonne `640 px` trop étroite ou trop large, c'est réglable en
   une ligne : `CONTENT_MAX_W` dans `MonCorps.js` (et le nombre de colonnes Biblio).
3. Apple TV → parcourir les cartes à la télécommande pour sentir le nouveau focus.

## Statut Git
Modifications **laissées non commitées** pour que tu puisses les relire et builder
toi-même (comme les nuits précédentes). `git diff` pour tout voir.

## Pistes de polish tvOS plus poussées (à valider avec toi)
Un vrai « la plus belle app du monde » sur Apple TV mérite des choix de design que
je préfère ne pas trancher seul en aveugle. Quelques idées à fort impact :
parallax léger sur la hero featured, transitions de page plus douces, hiérarchie
typographique 10-foot, et un traitement Liquid Glass cohérent sur les overlays.
Dis-moi lesquelles te parlent et je les fais proprement.
