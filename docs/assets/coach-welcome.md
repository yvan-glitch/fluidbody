# Coach welcome video — specs de tournage

**Statut :** placeholder animation jellyfish + texte en place dans
l'onboarding (`ProfileOnboardingScreen` → étape de bienvenue avant le step 0).
L'asset vidéo Bunny n'existe pas encore. Cette note récapitule ce qu'Yvan
doit tourner et uploader pour remplacer le placeholder.

## Format technique

| Param | Valeur |
| --- | --- |
| Résolution | 1080 × 1920 (vertical 9:16) |
| Durée cible | 30 à 60 s (idéal 35 s) |
| Codec | H.264 baseline, 30 fps |
| Bitrate | 6 Mbps |
| Audio | AAC 128 kbps, mono ou stereo |
| Sous-titres | VTT séparé (fr + en), même nom + `.fr.vtt` / `.en.vtt` |

Bunny CDN : uploader dans la même Stream Library que les autres séances, sous le
chemin `welcome/coach-welcome.mp4`. Pour les sous-titres : `welcome/coach-welcome.fr.vtt`
et `welcome/coach-welcome.en.vtt`.

## Storyboard recommandé

1. **0-3 s** — Plan large naturel. Coach assise/debout face caméra, fond aquatique
   (méduses peintes sur mur du studio, ou simple fond bleu profond). Sourire doux.
2. **3-10 s** — "Bienvenue dans Fluidbody. Je suis [prénom], coach Pilates depuis
   X ans." Contact visuel caméra, voix posée.
3. **10-25 s** — *Le pitch émotionnel.* "Ici on ne court pas après la performance.
   On écoute son corps, on respire, on construit jour après jour un Pilates
   conscient." Inserts B-roll possibles : main qui glisse sur le ventre,
   méduses au plafond, mat sur sol clair.
4. **25-35 s** — "Tu vas commencer par 4 questions pour qu'on adapte tes
   séances à ton corps. Prêt·e ? Respire, et on y va." → fade to black ou
   pause sourire.

## Identité visuelle

- Palette : bleu profond `#000e18` → cyan `#00bdd0`, accent vert `#AEEF4D`.
- Pas de logo collé en surimpression — l'app affiche déjà `FLUIDBODY+` autour
  du player.
- Éviter le branding studio (Espace Pilates Suisse) sur le décor — le but est
  que l'app reste agnostique du studio physique.

## Câblage dans le code

Une fois la vidéo uploadée :

1. Ajouter une entrée dans Supabase `video_assets` :
   - `session_id = 'welcome'`
   - `bunny_path = 'welcome/coach-welcome.mp4'`
   - `kind = 'mp4'` (et un autre row pour `kind='vtt-fr'`, `kind='vtt-en'`)
2. Dans `src/screens/ProfileOnboarding.js`, remplacer le composant placeholder
   `CoachWelcomePlaceholder` par un `<Video>` Expo AV avec `useSignedVideoUrl('welcome', 'mp4')`.
3. Garder le fallback placeholder visible **avant** que la signed URL arrive
   (≈300-500 ms en cold start), pour éviter un flash de noir.

## Définition de "done"

- Vidéo lit du premier coup en TestFlight sur iPhone 12 mini → iPhone 16 Pro Max
  (résolution vertical respectée, pas de bandes noires).
- Sous-titres affichables si l'utilisateur a l'accessibilité texte activée.
- Si le user appuie sur "Passer" en haut à droite, on saute à l'étape 0 sans
  attendre la fin de la vidéo (déjà géré par le placeholder).
