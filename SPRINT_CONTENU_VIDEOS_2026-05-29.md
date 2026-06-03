# Sprint Contenu Vidéos — Plan de débloquage App Store

**Rédigé pendant la nuit du 28→29 mai 2026, pour discussion avec Yvan au matin.**

Objectif : sortir du blocage actuel (App Store en pause par manque de vidéos) avec un plan de tournage réaliste pour Sabrina, compatible avec ses 8h/jour de coaching et la charge studio.

---

## Constat de départ

- App FluidBody+ annonce **175 séances, 64h20 de pratique** au lancement (cf. screenshot Pour vous).
- Sabrina est la voix unique et l'identité visuelle de la marque coach.
- Elle enseigne en présentiel à plein temps, ce qui rend les sessions de tournage longues impossibles.
- 9 piliers à couvrir : Mat Pilates · Mobilité · Posture · Pilates Golf · Eldoa · Épaules · Dos · Office · Ménopause.
- Sans contenu, l'app n'est pas vendable → la soumission App Store reste bloquée.

**La question stratégique : quel est le minimum viable de contenu pour soumettre, vs le contenu cible long terme ?**

---

## Stratégie en 3 étages

### Étage 1 — MVP soumission (20-30 séances, 10-15h de tournage net)

Le but : permettre de soumettre l'app à Apple avec un catalogue qui justifie le prix Founder (12.90/mois, 99/an) sans que les utilisateurs se sentent vidés à la 5e séance.

**Sélection minimum recommandée** : 2-3 séances par pilier, sur les 9 piliers = 18-27 séances. Soit ~10-15h de contenu net (séances de 10-30 min).

Priorité d'ordre (les piliers à filmer **en premier** parce qu'ils débloquent le plus de cas d'usage) :

1. **Mat Pilates** (4 séances : débutant 15min, intermédiaire 20min, intermédiaire 30min, avancé 30min) — c'est l'épine dorsale, sans ça pas d'app.
2. **Dos** (3 séances : douleur aiguë 10min, prévention 15min, mobilité dorsale 20min) — case d'usage #1 dans les recherches Pilates.
3. **Posture** (2 séances : auto-évaluation 10min, séance correction 20min) — différenciant fort vs concurrence.
4. **Épaules** (2 séances : libération 10min, renforcement 15min).
5. **Mobilité** (2 séances : routine matinale 10min, routine soirée 10min).
6. **Office** (2 séances : pause bureau 5min, fin de journée 15min) — différenciant moderne.
7. **Eldoa** (2 séances : niveau 1 intro 15min, séance complète 25min) — niche premium.
8. **Pilates Golf** (1 séance : programme golfeur 20min) — niche spécifique, peut attendre.
9. **Ménopause** (1 séance : programme dédié 20min) — niche spécifique, peut attendre.

**Total MVP** : 19 séances. ~5-6h de contenu net. Filmé en 10-15h de tournage (ratio ~3x avec setups, prises multiples, etc.).

### Étage 2 — Cible "175 séances" sur 6-12 mois

Étoffer le catalogue à 175 séances permet de tenir l'annonce marketing et la profondeur Founder. Mais c'est un travail de long terme qui se fait après le launch (post-soumission), avec du contenu OTA mis à jour mensuellement.

### Étage 3 — Polish marketing (à faire en parallèle MVP, sans Sabrina)

Pendant que Sabrina tourne, Yvan peut préparer :
- Screenshots App Store (déjà en partie fait, cf. session `Screenshots App Store iPhone 6.9"`)
- Texte métadonnées App Store (cf. session `App Store metadata FR + EN`)
- Demo videos courts pour l'App Store preview (15-30s clips)

---

## Plan de tournage pratique

### Idée centrale : "tournage par blocs de 2-3h, pas à la pièce entre 2 clients"

Filmer entre 2 clients de Sabrina = changement d'éclairage, micro à reposer, énergie discontinue, qualité incohérente. Mauvaise stratégie.

**Mieux** : bloquer **3 demi-journées Sabrina libres** dans le mois (samedi matin, dimanche, jour férié), tourner 6-8 séances par demi-journée avec un setup permanent.

**Réalisme** : avec sa charge actuelle, viser **1 demi-journée par semaine sur 4-6 semaines** = 4-6 sessions de tournage = 24-48 séances filmées = couvre largement le MVP.

### Setup minimum (équipement)

L'app est filmée dans le studio Espace Pilates (cohérent avec la marque). Setup minimal pour qualité acceptable :

- **Caméra** : un iPhone Pro récent (12 Pro+) en 4K 30fps suffit. Pas besoin de DSLR pour démarrer.
- **Trépied** : un trépied iPhone ou Manfrotto basique (~50 CHF).
- **Audio** : un micro-cravate sans fil (DJI Mic ou Rode Wireless Go II, ~200 CHF). C'est le point faible le plus visible quand c'est mauvais — Yvan peut investir ici en priorité.
- **Lumière** : si possible 1 softbox ou un panneau LED (~100 CHF). Sinon, lumière naturelle du studio aux bonnes heures (matin tôt, fin d'aprem).
- **Tapis et accessoires** : déjà dans le studio.
- **Pas de stabilisateur, pas de drone, pas de second angle au début** — keep it simple.

Total équipement : **300-500 CHF** pour un setup correct.

### Process par séance (10-20 min de prod chacune)

1. Préparation 3 min : poser le mic, vérifier cadrage, charger la batterie.
2. Intro Sabrina à la caméra (30s-1min) : "Aujourd'hui on travaille [zone] pour [bénéfice]. Cette séance est niveau [débutant/inter/avancé]."
3. Démonstration de la séance complète (10-25 min selon le format), Sabrina parle en faisant. Pas de coupes, prise au kilomètre, on garde tout.
4. Outro 30s : "Tu peux refaire cette séance autant que tu veux, écoute ton corps."

Une prise par séance, pas de refaire. Sabrina est pro, ça passe.

### Process de post-prod (Yvan ou pigiste)

1. Encoding pour Bunny CDN : HLS 720p + 1080p. Gratuit avec un script ffmpeg, ou via le dashboard Bunny.
2. Sous-titres FR (automatiques via Whisper, ~5 min par séance), relecture rapide par Yvan.
3. Sous-titres EN : Whisper traduit, relecture par un anglophone (importants pour le marché international).
4. Upload sur Bunny + ajout dans `video_assets` Supabase (1 ligne SQL par séance).

Estimé : **30 min de post-prod par séance**. Pour 20 séances : 10h. Étalable sur 2-3 weekends.

---

## Calendrier réaliste suggéré

| Semaine | Action | Output |
|---|---|---|
| **S1 (cette semaine)** | Acheter le micro-cravate + trépied. Définir 4 demi-journées avec Sabrina sur 4 semaines. | Setup + planning |
| **S2** | Tournage demi-journée #1 (6 séances Mat Pilates + Dos). | 6 séances brutes |
| **S2-3** | Yvan post-prod en parallèle (encoding, subs FR). | 6 séances prêtes |
| **S3** | Tournage demi-journée #2 (Posture + Épaules + Mobilité). | +6 séances |
| **S4** | Tournage demi-journée #3 (Office + Eldoa). | +4 séances |
| **S5** | Tournage demi-journée #4 (Pilates Golf + Ménopause + remplissage). | +3 séances |
| **S6** | Sous-titres EN finaux + upload tout sur Bunny + check intégration app. | Catalogue MVP 19+ séances complet |
| **S7** | Soumission App Store avec contenu prêt. | App live ~S8-9 |

**Délai total** : 6-7 semaines pour passer de "App Store bloqué" à "App live sur l'App Store". Critique : **commencer S1 maintenant**.

---

## Alternatives si Sabrina ne peut pas dégager 4 demi-journées

### Plan B — Co-instructeur (Natalia)

Si Natalia (instructrice de Pilates à l'équipe) peut filmer quelques séances en plus de Sabrina, ça soulage Sabrina et apporte une diversité de voix dans l'app. Mais ça dilue l'identité "Sabrina coach principale" qui est centrale au branding actuel. À décider.

### Plan C — Tournage condensé "1 weekend marathon"

Si on bloque un weekend complet (samedi + dimanche, 8h chacun), on peut filmer 20-25 séances en 2 jours. Plus dense pour Sabrina mais on est launch-ready en 1 weekend. Demande une grosse résistance physique côté Sabrina.

### Plan D — Studio de tournage externe ponctuel

Louer un studio vidéo Lausanne/Vevey pour 1 jour (~500 CHF), avec lumière pro, fond Pilates simulé ou portable, mic pro inclus. Yvan amène Sabrina pour 6h, sortie avec 12-15 séances filmées en qualité ++. Plus cher (~500 CHF + temps) mais qualité supérieure et hors stress studio.

---

## Décisions Yvan attendues demain

1. **Tu valides la stratégie 3 étages** (MVP 19 séances → 175 long terme → polish marketing parallèle) ?
2. **Tu valides le calendrier 6-7 semaines** pour soumission App Store ?
3. **Equipment** : tu achètes le micro-cravate (200 CHF) cette semaine, ou tu as déjà du matos ?
4. **Sabrina** : tu peux bloquer 4 demi-journées sur 4 semaines, ou il faut Plan B/C/D ?
5. **Plan B** (Natalia co-coach) : envisageable ou tu veux garder Sabrina seule pour le launch ?

---

## Ce qui peut être préparé en parallèle (en attendant tournage)

- Screenshots App Store (~déjà en cours, cf. sessions précédentes)
- Métadonnées App Store FR + EN (~déjà en cours)
- Trailer App Store Preview (15-30s) : Yvan peut le scripter en amont, on filmera quelques inserts pendant les sessions de tournage Sabrina
- Page landing du site fluidbody-web finalisée
- Bridge FluidBody+ depuis espace-pilates-web finalisé
- Sentry DSN configurée (✓ fait)
- Liquid Glass natif iOS 26 (✓ fait, build #86 prêt)

Le code et la plomberie sont OK. Le seul vrai bottleneck = contenu.

---

**Auteur** : préparé par Claude pendant la nuit du 28→29 mai 2026 pour Yvan.
**Action immédiate** : ouvre ce doc et range les points 1-5 ci-dessus par ordre de décision pour ta journée de demain.
