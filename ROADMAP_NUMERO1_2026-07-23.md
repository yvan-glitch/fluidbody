# Feuille de route « Numéro 1 » — 2026-07-23

Objectif : faire de FluidBody l'app Pilates la mieux notée et la plus fluide de l'App Store.

## ✅ Fait aujourd'hui (part dans le prochain OTA)

Fluidité : ticker partagé des méduses (1 timer au lieu de 16, paths SVG calculés une fois), pause de tous les fonds animés hors focus/background, React.memo sur les 5 écrans + CustomTabBar, handlers stabilisés (useStableCallback), freezeOnBlur, toggleDone instantané (persistance en tâche de fond), blurs Statistics/PilierEducation → verre léger, useMemo MonCorps (Recherche/Explorer/PilierPage) et Resume.

App Store : demande d'avis intelligente (`src/utils/reviewPrompt.js`) — après une séance validée, ≥3 séances ou streak ≥3, jamais pendant un milestone, max 1×/120 j et 3× au total. **S'active au prochain build EAS** (expo-store-review ~9.0.9 ajouté ; no-op en OTA d'ici là).

## Prochain build EAS (natif requis)

1. **expo-store-review** — déjà dans package.json, rien d'autre à faire : `eas build --profile production --platform ios`.
2. **Widget iOS** (rétention n°1) : streak + séance du jour sur l'écran d'accueil. Voie : `@bacons/apple-targets` (config plugin WidgetKit) + App Group pour partager streak/done avec le widget Swift. ~2-3 jours de travail, gros impact rétention.
3. **Live Activity** pendant la séance (Dynamic Island + écran verrouillé : temps restant, pilier). Même plugin que le widget. À faire après le widget.

## Effet wow (OTA-able, à faire ensuite)

4. **Fin de séance signature** : chorégraphie haptique (séquence success → légère → success), méduse qui « célèbre » (burst de particules du LivingMedusa), CountUp du streak. La CelebrationOverlay existe — l'enrichir.
5. **Transitions liquides** entre onglets : le fade actuel est bien ; tester une interpolation de la pilule de la tab bar synchronisée avec un léger scale de l'écran entrant.
6. **Paywall : prix localisés partout** — les textes « 12.90 CHF / puis 24.90 » sont codés en dur (PaywallModal.js:556, 626) alors que le gros prix suit la devise du client. Dériver intro/standard des `introPrice`/`price` RevenueCat.

## Rétention (mix OTA/natif)

7. **Notifications intelligentes** : le scheduling existe (milestones). Ajouter : rappel doux si streak en danger (20 h, pas de séance aujourd'hui, streak ≥ 3), notification « nouvelle séance du mois » quand FREE_MONTHLY_SELECTION change. OTA-able.
8. **Streak freeze** (1 jour de grâce gagné toutes les 7 séances) — retire la peur de casser la série, standard des apps n°1 (Duolingo). OTA-able.

## Conquérir l'App Store (contenu, pas de code)

9. **ASO** : titre « FluidBody+ : Pilates conscient » ; sous-titre avec mots-clés (Pilates, dos, posture, souplesse, ménopause — créneau peu concurrentiel) ; localiser la fiche EN. Les mots-clés du champ keywords ne doivent pas répéter le titre.
10. **Screenshots** : 3 premiers = promesse (séance en cours, méduse/streak, Apple TV). Vidéo preview de 15-20 s.
11. **Répondre à chaque avis** (surtout les négatifs) — signal fort pour le classement.
12. **Événements in-app App Store** (« Défi 7 jours dos ») — visibilité gratuite dans l'onglet Aujourd'hui.

## Perf restante (fond de backlog)

13. Virtualisation FlatList de Bibliotheque + MonCorps Recherche (~160 cartes) — le plus invasif, à faire quand le reste est validé.
14. React.memo sur SeanceCard/PilierCard/charts ; réduire les LinearGradient 6 stops → 3.
15. tvOS : pré-rendre les halos focus `shadowRadius: 40`.
