# Travail pendant ta pause — 21 mai 2026

Voici ce que j'ai construit pendant que tu prenais une pause.

## 🎙️ Foundation Audio Rituals (v1.2) — DELIVERABLE MAJEUR

Tu m'avais demandé de réfléchir à comment scaler le catalogue sans demander à Sabrina de filmer plus. **Solution** : des rituels audio courts (3-10 min) que Sabrina peut enregistrer avec ses AirPods en 30 min pour 5 rituels — versus 4-8h pour une séance vidéo.

**3 fichiers créés** :

### 1. `src/constants/audioRituals.js`

5 catégories × 3-4 rituels = **17 rituels audio prévus** :

- **Respiration** (4) : Cohérence cardiaque 5min, Respiration carrée, 4-7-8 endormissement, Souffle de l'ours
- **Réveil** (3) : Ouvrir le corps en 3 min, Réveil doux pour le dos, Étirements depuis le lit
- **Pause active** (3) : Décontraction nuque/épaules, Pause bureau express, Respiration entre 2 réunions
- **Endormissement** (3) : Scan corporel, Détente Jacobson, Visualisation marine
- **Méditation** (3) : Ancrage 5min, Gratitude du soir, Observation des sensations

Format mirror du `data.js` existant : tuple `[titre, durée, catégorie, hasAudio]`. FR + EN.

### 2. `src/components/AudioRitualPlayer.js`

Player audio minimaliste, fait pour être utilisé pendant qu'on fait autre chose (yeux fermés, en marchant, au bureau).

- Pas de fullscreen, juste play/pause + progress bar
- Animation breathing 4s in/out sur le bouton (synchro respiration carrée)
- Tap simple = pause/resume
- Auto-play au mount, auto-stop au unmount
- Skip silencieux sur tvOS (les rituels sont mobile-first)
- Compatible Apple AirPods (audio dans silent mode, no ducking)
- Accessibilité : labels FR/EN, accessibilityRole adjustable pour la progress

### 3. `supabase/migrations/20260521000000_audio_rituals.sql`

Table `audio_assets` miroir de `video_assets` :
- RLS bloqué par défaut, seul service_role peut lire
- Champ `is_premium` (true par défaut, false pour les 3 previews gratuites = stratégie d'acquisition)
- Champ `kind` (audio/subtitles)
- Trigger updated_at automatique
- Seed des 17 rituels commenté en bas (à décommenter quand Sabrina commence à enregistrer)

**Prochaines étapes pour activer la feature** :
1. Sabrina enregistre les 17 rituels (~2h estimé, 7 sessions de 15 min)
2. Upload sur Bunny CDN
3. Décommenter le seed dans la migration + remplir `bunny_path`
4. Créer l'edge function `sign-audio-url` (mirror de `sign-video-url`)
5. Créer l'écran `AudioRituals.js` (browse + tap → play)
6. Ajouter une entrée dans MonCorps ou tab dédiée

L'app et l'UI ne consomment pas encore ce code — j'ai juste posé la fondation. Tu valides l'approche avant qu'on wire tout.

## 📝 App Store metadata FR + EN — DELIVERABLE MAJEUR

Fichier : `docs/app-store/metadata-2026-05-21.md`

Tout est prêt pour upload dans App Store Connect :

- **Sous-titres** (30 car) : "Le Pilates qui coule" / "Pilates that flows"
- **Mots-clés** : pilates, yoga, respiration, dos, posture, mobilité…
- **Description courte** (170 car) — met en avant le multi-device ("Un seul abonnement, iPhone + Apple TV inclus")
- **Description longue** complète FR + EN :
  - Hook multi-device en premier paragraphe
  - 9 piliers détaillés
  - Sabrina 55 ans / 8h cours/jour (positionnement "vraie pro qui sait ce qu'elle fait")
  - Apple Watch / Apple Health intégration
  - Programmes personnalisés
  - Bibliothèque
  - Apple TV pairing
  - Privacy-first
  - 7 jours gratuits / 12.90 CHF /mois
  - Disclaimer médical
- **Promotional text** (170 car affiché dynamiquement) : "Nouveau sur Apple TV. Un seul abonnement pour iPhone + ta TV…"
- **What's New** (release notes) build #75 FR + EN
- Catégories : Health & Fitness (primary), Lifestyle (secondary)
- Privacy details
- Notes pour reviewer Apple

Tu peux copier-coller direct dans App Store Connect → Distribution → iOS App → Localizations (FR-FR + EN-US).

## ✅ Étapes pour valider / commit

```bash
cd /Users/xvan06/fluidbody
git add src/constants/audioRituals.js src/components/AudioRitualPlayer.js \
        supabase/migrations/20260521000000_audio_rituals.sql \
        docs/app-store/metadata-2026-05-21.md \
        PAUSE_WORK_2026-05-21.md

git commit -m "feat(audio): foundation for v1.2 Audio Rituals + App Store metadata

- src/constants/audioRituals.js : 5 catégories × 3-4 rituels (17 total)
- src/components/AudioRitualPlayer.js : lightweight player with breathing anim
- supabase/migrations/20260521000000_audio_rituals.sql : audio_assets table + RLS
- docs/app-store/metadata-2026-05-21.md : full FR + EN copy with multi-device positioning

Strategic value : audio rituals require 30 min of Sabrina's time per 5 rituals
(vs 4-8h for a video séance). Stretches the catalogue cheaply, opens new use
cases (daily breathing, evening wind-down, micro-pauses at office).

Not wired to UI yet — foundation only. Yvan reviews + decides when to ship."

git push origin main
```

## 🌙 Plan pour plus tard

Quand tu reviens et que tu as testé l'Apple TV physique :

1. **Si TestFlight tvOS arrive** (build #76 en processing) → test pairing iPhone → TV
2. **Si tvOS résiste encore** → on debug le buil #76 spécifique
3. **Sabrina enregistre les rituels audio** (calendrier à arranger, ~2h en 7 sessions)
4. **Wire audio rituals dans MonCorps** (quand on a 5+ rituels uploadés)
5. **Accessibility audit MonCorps.js** (80+ touchables à labelliser, ~4-6h de boulot)

## 🧠 Mémoire mise à jour

Pas de nouvelles entrées de mémoire à créer — toutes les décisions stratégiques sont déjà dans les memory files existants.

---

Bonne pause Yvan. Ton app prend forme. 🌊
