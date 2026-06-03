# Économiseur d'écran FluidBody — Diagnostic & solution

## Pourquoi `FluidBody.saver` n'apparaît pas dans Réglages

Deux problèmes ont été trouvés sur le bundle maison :

1. **Le binaire est mal compilé.** `Contents/MacOS/FluidBody` est un *dynamic
   library* (`.dylib`) alors qu'un screensaver doit être un *bundle*
   (`MH_BUNDLE`). macOS refuse de charger un `.saver` dont le binaire est un
   dylib → il n'apparaît tout simplement pas dans la liste. C'est la cause
   principale du symptôme.
   - En prime, l'« install name » du binaire pointe vers un chemin de build
     absolu (`/Users/xvan06/fluidbody-screensaver/build/...`), ce qui confirme
     une mauvaise option de link (`-emit-library`/`-dynamiclib` au lieu de
     `-bundle`).

2. **Signature ad-hoc.** Le bundle est signé ad-hoc (pas de Team ID, pas de
   notarisation). Gatekeeper le rejette. Sur macOS 26 (Tahoe), une vraie
   signature Apple Developer + notarisation est attendue pour les `.saver`
   tiers.

Pour corriger le maison il faudrait : recompiler le binaire en **bundle**
(`swiftc -bundle …` / `MH_BUNDLE`), puis le signer/notariser avec un compte
Apple Developer (99 $/an). Long et coûteux.

## Solution recommandée : WebViewScreenSaver (déjà installé)

`WebViewScreenSaver.saver` est **déjà présent** dans
`~/Library/Screen Savers/`. Il suffit de le configurer pour afficher la page
de veille FluidBody.

1. Va dans **Réglages Système > Économiseur d'écran**.
2. Cherche **WebViewScreenSaver** dans la liste (souvent en bas, section
   « Autres » / tiers).
   - S'il n'apparaît pas : ouvre le Finder sur `~/Library/Screen Savers/`,
     fais **clic droit > Ouvrir** sur `WebViewScreenSaver.saver` une fois pour
     lever le blocage Gatekeeper, puis reviens dans Réglages.
   - Si toujours rien : retélécharge la dernière release signée ici →
     https://github.com/liquidx/webviewscreensaver/releases (double-clic le
     `.saver`, installer « pour cet utilisateur »).
3. Sélectionne **WebViewScreenSaver**.
4. Clique **Options…** (ou l'icône engrenage).
5. Dans le champ URL, mets : **`https://fluidbody.ch/veille`**
6. Coche « fullscreen » si dispo, valide.
7. Clique **Aperçu** pour tester le rendu.

Ton écran de veille FluidBody+ est prêt.
