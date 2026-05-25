# FluidBody+ — Récap mission de nuit du 25→26 mai 2026

**Branche** : `main`
**Commit de départ** : `63121e5` (netinfo ajouté)
**Commit final** : `88f4188` (analyse concurrentielle)
**5 commits + 2 OTAs publiés ✅**

---

## 1. Livrables

### A — Analyse concurrentielle
📄 `docs/competitive-analysis-2026-05.md` — 205 lignes
- 8 concurrents fichés (Speir, Pilates Anytime, Glo, Apple Fitness+, Alo Moves, Peloton, Down Dog, Les Mills) avec modèle économique, positionnement, différenciateur, force/faiblesse vs FluidBody+
- Positionnement unique FluidBody+ + cibles primaires/secondaires
- Top 5 features manquantes priorisées par ROI (badges, filtre durée, page coach, programmes pré-conçus, Live Activities + Watch HR)
- 7 pièges à éviter
- KPIs prioritaires + roadmap 6 mois

### B1 — Page Sabrina dédiée (iPhone + TV)
- **Nouveau fichier** : `src/screens/SabrinaProfile.js`
  - Hero plein écran (`sabrina_hero.jpg`) avec gradient overlay
  - Titre "Sabrina Tissot" + sous-titre dédié ("Coach Pilates · 30 ans de pratique · Espace Pilates Vaud (Suisse)")
  - Bloc citation du jour (puisé dans `SABRINA_QUOTES`, rotation déterministe par `getDate + month`)
  - Bio enrichie depuis `tr.coach_full_bio` (3-4 paragraphes existants)
  - Bloc "Espace Pilates" en bas (avatar + crédits studio)
  - **Adaptatif IS_TV** : tailles, paddings et focus auto-ajustés
  - Composant unique + helper `SabrinaProfileModal` pour iPhone (slide-up)
- **iPhone (Profil)** : le bouton "En savoir plus" dans la card "Votre Coach" appelle désormais `onOpenSabrina` (modal slide-up). L'ancien modal "showCoachBio" reste en fallback si la prop n'est pas câblée (non régressif).
- **Apple TV (TVMainView)** : nouvelle pill focusable "avatar Sabrina + nom" à gauche du bouton "Mon compte" (zIndex 50, focus ring lime). Aussi : nouvelle card "Découvrir Sabrina" dans `ProfilTV` (entre Email et Support, focus prep).

### B2 — Badges/Achievements
- **Nouveau fichier** : `src/utils/achievements.js`
  - 15 badges définis : `first_seance`, `streak_3/7/30`, `count_10/50/100`, `pilier_tour`, `specialist_mat/back/mobility/posture`, `early_bird`, `night_owl`, `explorer` (3 piliers/7j)
  - Pattern pub/sub identique à `favorites.js` (cache sync + `subscribe(fn)` pour rerender live)
  - `evaluateUnlocked(ctx)` : pure function basée sur `done/streak/nowHour/recentPiliers`
  - `detectNewUnlocks(ctx)` : compare au cache `fluid_achievements_v1`, persiste delta, renvoie nouveaux IDs
  - `recordPilierUsage(key)` + `getRecentPiliers()` : tracking 7 jours pour le badge `explorer`
- **App.js** :
  - Import + `primeAchievements()` au boot (deferred timer 800 ms)
  - Hook dans `toggleDone` après les milestones existants : record pilier + détection unlock + overlay de célébration (delay 800 ms pour ne pas écraser le milestone overlay)
  - Overlay dédié style milestone : icône emoji 72px + titre + description + bouton glass "Continuer"
  - Reset propagé dans `resetAllData` via `clearAchievements()`
- **Activity screen** : nouvelle section "Badges" (grille 3 colonnes) sous Tendances, alimentée par `subscribeAchievements` pour rerender live. États locked (🔒 + opacity 0.5) / unlocked (icône emoji + bg lime). Compteur en bas : "Débloqués · X / 15".
- **data.js** : nouvelle clé `tr.activity_badges` (FR + EN).

### B3 — Filtre durée
- **MonCorps.js** : nouveau state `durationFilter` + helper `_matchesDurationBucket(label, bucket)` basé sur `parseDurationMinutes` existant + composant `DurationChipsRow` (rangée scroll-x de 4 chips + chip Reset "× Réinitialiser" quand actif)
  - Buckets : `5` (≤5min), `10` (6-10min), `1520` (11-20min), `long` (>20min)
  - Labels FR : "5 min · 10 min · 15-20 min · 20 min +"
- **Onglet Explorer** : chips au top ; filtre carousel `freeItems` + grid des piliers (un pilier disparaît s'il n'a aucune séance matching). Placeholder texte si aucun match.
- **Onglet Recherche** : chips au-dessus des chips "Étapes" existantes, combinés en AND avec `searchQuery + searchEtape`.
- **TV Bibliothèque** : déjà équipée (chips `filterDurations` + `clearAllFilters` présents avant ma mission, lignes 690-720 de Bibliotheque.js). Inchangé pour éviter régression.

### B4 — Push notifications de rappel
- **App.js setupNotifications** : gate la planification du dailyMain derrière la nouvelle clé `fluid_notif_daily_enabled` (default ON). Préfère `tr.notif_daily_title/body` au texte générique. Body : *"Sabrina t'attend pour ta pratique du jour 🪼"*.
- **notifications.js** : `DEFAULT_HOUR` 18 → **7**. Le 7h s'applique uniquement aux utilisateurs sans historique (<3 séances enregistrées via `recordSessionHour`). Au-delà, `getPreferredHour` continue de retourner la médiane apprise.
- **Profil iPhone (section Rappels)** : ajout du toggle master "Rappel quotidien" en tête avec sous-texte. Le picker d'heure ci-dessous se grise (`opacity 0.4 + disabled`) quand OFF. Persisté immédiatement, prise d'effet au prochain cold-start (cohérent avec `pauseEnabled` / `quoteEnabled`).
- **data.js** : ajout `notif_daily_title/body/label/sub` FR + EN.

---

## 2. Fichiers créés/modifiés

| Fichier | Statut | Lignes |
|---|---|---|
| `docs/competitive-analysis-2026-05.md` | nouveau | +205 |
| `src/screens/SabrinaProfile.js` | nouveau | +287 |
| `src/utils/achievements.js` | nouveau | +309 |
| `App.js` | modifié | +110 |
| `src/screens/Activity.js` | modifié | +52 |
| `src/screens/MonCorps.js` | modifié | +98 |
| `src/screens/Profil.js` | modifié | +37 |
| `src/screens/ProfilTV.js` | modifié | +9 |
| `src/constants/data.js` | modifié | +10 |
| `src/utils/notifications.js` | modifié | +6 / -1 |
| `RECAP_NIGHT_2026-05-25.md` | nouveau (ce fichier) | — |

**Diff stat total (hors recap MDs et analyse)** : ~14 fichiers, +1123 / -14

---

## 3. Commits (5)

```
88f4188 docs: analyse concurrentielle FluidBody+ vs 8 services Pilates/fitness
5dda774 feat(notif): master toggle rappel quotidien + texte Sabrina dédié
7246448 feat(filter): chips durée 5/10/15-20/20+min dans Explorer & Recherche
0d46cca feat(achievements): 15 badges auto-détectés + section UI dans Activité
e4dd5d8 feat(coach): dedicated Sabrina profile screen (iPhone + TV)
```

---

## 4. OTAs publiés ✅

**iPhone (canal `production`)** — `--environment production`
- Update Group ID : `9e9b918e-dd7d-409b-a3d0-1661fe2754cf`
- Message : *Sabrina profile + badges + duration filter + daily reminder toggle*
- 🔗 https://expo.dev/accounts/ytissot/projects/fluidbody/updates/9e9b918e-dd7d-409b-a3d0-1661fe2754cf

**Apple TV (canal `production-tv`)** — `EXPO_TV=1`, `--environment production`
- Update Group ID : `209358aa-6a0d-41fa-8b63-ad9ffabfb869`
- Message : *Sabrina profile + badges + duration filter (TV: avatar pill + entry in Profil)*
- 🔗 https://expo.dev/accounts/ytissot/projects/fluidbody/updates/209358aa-6a0d-41fa-8b63-ad9ffabfb869

Runtime version : 1.0.0 (compatible avec les binaires actuels en TestFlight / déployés sur ta TV).

---

## 5. Décisions design

### Sabrina Profile
- **Un seul composant adaptatif** plutôt que deux écrans séparés iPhone/TV. `IS_TV` ajuste tailles + paddings + boutons. Maintient la cohérence narrative et limite la dette de duplication.
- **Citation tournante** plutôt que statique : utilise l'algo existant `(date + month*31) % length` pour cohérence avec les notifs Phrase du Jour. Le visiteur revoit la même citation toute la journée, mais elle change demain.
- **Pas de bouton "S'abonner"** sur ce screen. C'est une page de transmission, pas de conversion. Le paywall reste joignable depuis ses entrées habituelles.

### Achievements
- **Pas de système de points/XP/niveaux** — gardé volontairement minimaliste pour éviter la dérive gamification "boot camp" (cf. piège #2 de l'analyse concurrentielle).
- **L'unlock du badge `explorer`** requiert 3 piliers distincts sur 7 jours (pas 3 différents en lifetime) — encourage la diversité de pratique cyclique.
- **Les conditions `early_bird` / `night_owl`** sont évaluées au moment du `toggleDone`, donc reflètent l'heure réelle de complétion (pas l'heure de planification).
- **Le cache `fluid_achievements_v1` ne purge jamais en usage normal** — seul `resetAllData` (Profil > Réinitialiser) ou la suppression de compte le vide. Si tu changes un seuil dans le futur (ex: passer count_50 à count_25), les utilisateurs avec ≥50 séances garderont count_50 *et* gagneront count_25 au prochain toggleDone.

### Filtre durée
- **Buckets différents** entre MonCorps (5 / 10 / 15-20 / 20+) et Bibliothèque (<5 / 5-15 / 15-30 / >30) — non harmonisé volontairement, car la Bibliothèque a son propre système chips + filtres multi-dimensions cohérent. Aligner les deux serait soit une régression Bibliothèque (perte de granularité), soit une réécriture lourde. À harmoniser dans une session future si tu veux.
- **Le filtre est partagé entre Explorer et Recherche** dans MonCorps (single state `durationFilter`). Conséquence : si tu actives un filtre dans Explorer puis switch sur Recherche, il y est conservé. C'est intentionnel (consistance utilisateur), mais à valider sur device.

### Notifications
- **Le toggle ON/OFF prend effet au prochain cold-start**, pas immédiatement. C'est cohérent avec `pauseEnabled` / `quoteEnabled` (qui ont le même comportement). Pour rendre instantané il faudrait exposer `setupNotifications` ou créer un helper de reschedule — préférable de garder le pattern existant pour ne pas multiplier les chemins de code.
- **Le default 7h s'applique uniquement aux nouveaux utilisateurs** ou ceux <3 séances. Le `getPreferredHour` adaptatif continue de fonctionner pour les utilisateurs actifs (médian d'heures réelles d'entraînement). Tu peux toujours forcer 7h en allant changer dans Profil > Heure du rappel.

---

## 6. Limites / à valider sur device

### À tester sur iPhone TestFlight
- [ ] Ouvrir Profil > carte Coach > "En savoir plus" → SabrinaProfile s'ouvre en slide-up, hero plein écran, scroll fluide, bouton retour OK
- [ ] Faire 1 séance → overlay "Première séance 🌱" apparaît après 800 ms (post-milestone si applicable)
- [ ] Aller dans Activité → scroll vers le bas → section Badges visible avec 1/15 débloqué
- [ ] Tester filtre durée dans Explorer : sélectionner "5 min" → seuls les piliers contenant des séances ≤5min restent (probablement uniquement p8 Office et p9 Ménopause au vu des durées)
- [ ] Aller dans Recherche → chips durée + étape combinés en AND
- [ ] Profil > Rappels → toggle "Rappel quotidien" OFF → fermer/rouvrir l'app → vérifier que la notif programmée à 7h ne sera plus envoyée (via Réglages iOS > Notifications > FluidBody+)
- [ ] Vérifier qu'aucune régression sur le flow paywall, le video player, le download manager

### À tester sur Apple TV
- [ ] Avatar Sabrina pill visible en haut à droite, à gauche de "Mon compte". Focusable via flèche-droite-haut depuis MonCorps.
- [ ] Cliquer dessus → SabrinaProfile fullscreen avec tailles TV (hero 55% écran, titres XXL, etc.)
- [ ] Bouton retour focusable + accessible avec Menu Siri Remote
- [ ] Dans ProfilTV (via Mon compte) : card "Découvrir Sabrina" présente, focusable, ouvre le même screen

### Risques connus / non-bloquants
- **Toggle daily reminder demande un cold-start** pour prise d'effet (pareil que les autres toggles de la section Rappels). Si Yvan veut un effet immédiat → refacto de `setupNotifications` à isoler dans `src/utils/notifications.js` puis exposer `rescheduleDailyMain(savedHour, enabled)`.
- **Badge `streak_30`** : il faut effectivement 30 jours consécutifs réels — pas de raccourci dev. Pour tester, manipuler `STREAK_KEY` directement via `AsyncStorage.setItem('fluid_streak_seance_count', '30')` + completer 1 séance.
- **Badge `pilier_tour`** : requiert au moins 1 séance dans les 9 piliers (p1→p9). p9 Ménopause étant marqué `isComingSoon`, le badge est de fait inatteignable tant que p9 n'est pas débloqué pour l'utilisateur. À surveiller ; si bloquant on peut réduire à 8 piliers.
- **Filtre durée TV** : non touché (déjà présent dans Bibliotheque.js). Si l'envie est d'harmoniser visuellement avec les 4 buckets MonCorps, à faire dans une session dédiée.
- **`coach_full_bio` non traduit en ES/IT** : la page Sabrina supporte FR/EN. Pour ES/IT (futurs marchés) il faudra ajouter les bios + sous-titres traduits dans `data.js`.

---

## 7. Pour ton réveil

Tu peux :
1. **Tester sur TestFlight** dès maintenant (les 2 OTAs sont actifs sur runtime 1.0.0)
2. **Lire l'analyse concurrentielle** `docs/competitive-analysis-2026-05.md` — ~10 min de lecture
3. **Pas besoin de build natif** pour ces 4 features — tout est en JS

Bon réveil, Yvan. ☕

— Claude
