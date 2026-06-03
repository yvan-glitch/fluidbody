# ⚠️ OTA DE TEST EN PROD — À REVERT

**Date :** 2026-06-01 ~15:55 (publié par diag Claude)

## Ce qui est en prod en ce moment
- **Update group `2e3ad6dc-bbb8-4db2-b06f-4eb14bdfa11c`** est le HEAD de la branche `production`.
- Contenu = `main` (44a8621, **fix Sabrina inclus**) + **titre "Développeur" rouge `#FF0000`** dans Profil.js (test de visibilité OTA, TEMPORAIRE).
- Dashboard : https://expo.dev/accounts/ytissot/projects/fluidbody/updates/2e3ad6dc-bbb8-4db2-b06f-4eb14bdfa11c

## But du test
Vérifier que la livraison OTA fonctionne de bout en bout. Si après reload de l'app
le titre "Développeur" (Profil → section dev) apparaît **ROUGE** → OTA delivery OK
ET le fix Sabrina (même provenance `main`) est bien dans le bundle.

## ✅ REVERT (à faire dès qu'Yvan a observé le rouge)
Le plus simple — republier l'OTA propre "Fix Sabrina" (28bde019) par-dessus :

```bash
cd /Users/xvan06/fluidbody
eas update:republish --group 28bde019-f66d-428a-80e3-df6084305fc8 --non-interactive
```

(28bde019 = "Fix Sabrina screen safe area" — bundle propre, SANS le rouge.)

Puis supprimer ce fichier.
