# Pilier Ménopause (p9) — Roadmap de production

> Document de référence pour la production des séances vidéo Ménopause.
> Auteurs : Yvan Tissot + Sabrina Tissot
> Créé le : 14 mai 2026 (anniversaire 32 ans, Milan)
> Statut : structure validée dans le code (commit 497dde1), contenu à produire.

---

## 1. Positionnement stratégique

**Marché** : ~25 millions de femmes en France/Suisse/Belgique/Québec en péri-ménopause ou ménopause à un moment donné. Marché sous-servi par le secteur Pilates.

**Concurrence directe** : aucune app Pilates dédiée à cette période. Apps santé féminine génériques (MenoLife, Caria, Stella) mais aucune ne combine "vraie instructrice + Pilates + parcours ménopause".

**Différenciateur FluidBody+** :
1. Vraie instructrice certifiée (Sabrina)
2. Multilingue natif FR/EN
3. Approche pédagogique (3 niveaux : Comprendre → Exécuter → Évoluer)
4. Identité brand distincte (méduse, pas mannequins fitness)

---

## 2. Architecture du contenu : 15 séances en 3 niveaux

### 🧠 Niveau 1 — COMPRENDRE (5 séances, 5-10 min)

Format : théorique avec démonstration douce. Sabrina face caméra, illustre brièvement.

| # | Titre FR | Titre EN | Focus |
|---|---|---|---|
| 1 | La ménopause expliquée | Menopause explained | Périménopause / ménopause / post-ménopause. Changements hormonaux. |
| 2 | Pourquoi le Pilates change tout | Why Pilates matters | Bénéfices spécifiques (os, posture, périnée, stress). |
| 3 | Densité osseuse : la clé après 45 ans | Bone density: key after 45 | Pourquoi l'ostéoporose menace, comment le Pilates aide. |
| 4 | Plancher pelvien : anatomie et symptômes | Pelvic floor: anatomy and symptoms | Incontinence, prolapsus, sécheresse. Non-tabou. |
| 5 | Bouffées de chaleur et respiration | Hot flashes and breathing | Système nerveux autonome, régulation par le souffle. |

### 🧘 Niveau 2 — EXÉCUTER (5 séances, 15-20 min)

Format : séances pratiques ciblées sur un symptôme/enjeu spécifique.

| # | Titre FR | Titre EN | Focus pratique |
|---|---|---|---|
| 6 | Réveil hormonal | Hormonal awakening | Séance énergisante du matin. Activation douce, circulation. |
| 7 | Plancher pelvien fondamentaux | Pelvic floor basics | Kegel + Pilates de base. Avec/sans contraction profonde. |
| 8 | Os solides | Strong bones | Travail avec poids du corps, en charge (debout, à 4 pattes). |
| 9 | Calmer les bouffées | Easing hot flashes | Respiration + mouvements lents. À faire pendant une crise. |
| 10 | Sommeil réparateur | Restorative sleep | Séance du soir, étirements doux, transition vers le repos. |

### 🌱 Niveau 3 — ÉVOLUER (5 séances, 20-30 min)

Format : séances avancées, programmes intégrés.

| # | Titre FR | Titre EN | Focus |
|---|---|---|---|
| 11 | Renforcement complet | Complete strengthening | Full body en circuit. Lutte contre la sarcopénie. |
| 12 | Plancher pelvien intégré | Integrated pelvic floor | Pas isolé. Vie quotidienne, sports, marche. |
| 13 | Énergie & vitalité | Energy & vitality | Séance dynamique pour la phase post-ménopause stable. |
| 14 | Mobilité articulaire | Joint mobility | Hanches, épaules, colonne. Zones qui se raidissent. |
| 15 | Programme 30 jours | 30-day program | Suivi structuré multi-séances. |

---

## 3. Contenus bonus (hors séances principales)

- **Méditations Ménopause** (5 min, audio only) : 3-5 méditations courtes
- **Mini-séances bureau** (3-5 min) : gestion bouffées au travail
- **Routine du matin express** (10 min)
- **Routine du soir / sommeil** (10 min)

---

## 4. Différenciateurs UX

### A. Ton de voix non-stigmatisant
Pas de "votre corps qui vieillit" ou "perte de féminité".
Mais : "ton corps évolue, et tu peux l'accompagner".
Empowering, pas alarmiste.

### B. Témoignages
Inclure 1-2 vraies pratiquantes (45-60 ans) dans certaines séances pour témoigner.

### C. Approche pédagogique
Respecter la philosophie FluidBody+ : "comprendre avant d'agir".

---

## 5. Légitimité clinique

### Formations Sabrina (recommandées)
- Stott Pilates : Specialty Menopause / Older Adult (~600-1200 CHF)
- BASI Pilates : Active Aging (~500-1000 CHF)
- Pilates for Pelvic Floor — Marie-José Costa (~400 CHF, en ligne)

### Partenariats experts à explorer
- Kiné spécialisée santé féminine (validation contenu)
- Gynécologue ou sage-femme (apparition séance "Plancher pelvien")
- Comité scientifique léger (3-4 experts pour validation pédagogique)

---

## 6. Aspects légaux

### Disclaimers obligatoires
Chaque séance Ménopause inclut :

> "Cette séance est un complément à un suivi médical, pas un remplacement. Consultez votre médecin avant toute nouvelle pratique physique."

### Questionnaire de pré-pratique
À ajouter dans l'onboarding du pilier Ménopause :
- Hystérectomie récente ?
- Prolapsus diagnostiqué ?
- Ostéoporose confirmée ?
- Hypertension non-contrôlée ?

→ Selon les réponses, orientation vers séances adaptées.

---

## 7. Planning de production estimé

| Phase | Durée | Action |
|---|---|---|
| Recherche & formation | 2-4 semaines | Sabrina se forme (en ligne ou présentiel) |
| Scripting | 1-2 semaines | Écriture des 15 scripts FR |
| Tournage | 3-4 jours | 4-5 séances par jour |
| Montage | 1-2 semaines | Édition vidéos FR |
| Dubbing EN | 1 semaine | ElevenLabs voice cloning |
| Upload + intégration | 1 semaine | Bunny.net + tests |
| **Total** | **6-12 semaines** | Lancement Q3 2026 réaliste |

---

## 8. État technique actuel

- ✅ Pilier p9 créé dans le code (commit 497dde1)
- ✅ Localisation FR / EN dans T.fr.piliers et T.en.piliers
- ✅ Couleur mauve poudré rgba(210,140,190,1) attribuée
- ✅ Image placeholder : assets/piliers/posture.jpg (à remplacer)
- ✅ Sessions array vide : SEANCES_FR/EN.p9 = []
- ✅ Crash Resume.js corrigé via guard `done[p.key] || []` ligne 654 (commit 3de7679)
- ✅ p9 Ménopause + fix Resume.js sont tous les deux sur main
- ✅ Bug identifié comme latent (defensive programming manquant), pas spécifique à p9
- 🔜 Prochaine étape : re-pousser l'OTA Ménopause avec le fix inclus

---

## 9. Notes complémentaires

### Inspiration ton de voix
- Diane Sanson (gynéco / autrice "Bien dans ma ménopause")
- Pauline Schepens (instructrice Pilates France, contenu femme)
- Hormone University (anglophone, ton équilibré scientifique-bienveillant)

### Risques identifiés
- Production trop chargée si Sabrina veut filmer simultanément le contenu général ET le contenu Ménopause → prioriser
- Coût formation + dubbing peut dépasser 2000 CHF → planifier le budget
- Légitimité fragile sans certif → ne pas marketer comme "expert" tant que pas formé

---

**Document vivant — à enrichir au fur et à mesure de la production.**
