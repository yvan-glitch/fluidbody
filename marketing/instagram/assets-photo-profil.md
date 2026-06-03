# Photo de profil Instagram — guide

## 📐 Specs techniques
- **Upload en 1080×1080 px** (Instagram affiche en cercle, mais préfère une source HD).
- L'avatar est **rogné en cercle** → garde le sujet **centré**, marge de sécurité tout autour.
- Test décisif : **doit rester lisible à 110×110 px** (taille dans le feed) et à ~40px (commentaires).
  → Donc : **un seul sujet, fort contraste, zéro texte fin.**

---

## ✅ Option 1 — Icône méduse de l'app (RECOMMANDÉE)
- **Source** : `assets/icon.png` (et `assets/icon.svg` pour recolorer/exporter en HD).
- Déjà à l'identité : méduse navy + turquoise, lisible en petit, cohérente avec l'App Store.
- **Avantage** : continuité parfaite app ↔ Instagram. Quand l'app sortira, l'avatar = l'icône App Store. Reconnaissance immédiate.
- **À faire** : exporter le SVG en 1080×1080 PNG, vérifier que la méduse remplit ~70% du cadre (pas perdue au centre), fond navy `#021222` plein ou léger dégradé navy→turquoise.

## ✅ Option 2 — Méduse + halo turquoise (variante premium)
- **Base** : la méduse de l'icône, isolée sur fond **dégradé radial** navy → turquoise `#55BBC9`, avec un **halo lumineux** turquoise diffus derrière.
- Plus « éditorial » que l'icône brute. Donne un côté lumineux/vivant.
- **À créer** : depuis `assets/icon.svg`, ajouter un glow turquoise (Figma/Photoshop : calque flou turquoise sous la méduse), export 1080×1080.

## ✅ Option 3 — Monogramme « F+ »
- **Concept** : un « **F+** » stylisé en typo fine, blanc cassé, sur fond dégradé turquoise→lime ou navy→turquoise.
- Plus corporate / type « app premium ». Très lisible en petit.
- **À créer** : Figma, typo fine (ex. une grotesque légère), lettre centrée, contraste fort.
- **Quand le choisir** : si tu veux un avatar plus « marque » que « créature ». Sinon, la méduse raconte mieux l'histoire.

---

## 🏆 Recommandation
**Option 1 (icône méduse de l'app)** pour le jour J — zéro production, cohérence App Store immédiate, déjà aux specs.
Puis, si tu veux raffiner sur la semaine, passe à **l'Option 2** (méduse + halo) pour un avatar plus lumineux sans casser la reconnaissance.

> 🚫 Évite la photo de Sabrina **en avatar** : trop de détail, illisible à 110px, et tu « brûles » ton meilleur visuel humain qui mérite d'être en post/Stories. Garde Sabrina pour le contenu, la méduse pour l'identité.

---

## 🎨 Rappel palette
- Navy `#021222` · Turquoise `#55BBC9` · Lime `#B8E62E`
- Avatar = **navy + turquoise** dominants. Le lime en accent ponctuel seulement.

## 🛠️ Si tu n'as pas d'outil sous la main
- **Figma** (gratuit, web) : importe `assets/icon.svg`, pose un fond navy 1080×1080, exporte en PNG.
- **Express/Canva** : template carré 1080×1080, fond dégradé navy→turquoise, glisse la méduse au centre.
- Au pire, **`assets/icon.png` tel quel** fait déjà le job pour lancer aujourd'hui — tu raffineras après.
