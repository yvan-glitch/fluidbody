# 🚀 App Store Readiness · FluidBody+ · 2026-07-07

Audit complet du repo en préparation de la soumission App Store.
Verdict global : **l'app est saine et bien préparée**. Il reste du rangement
(script ci-dessous), un blocage produit connu (vidéos), et quelques finitions.

---

## 1 · Sécurité — état : 🟢 très bon

Vérifié ce jour :

- ✅ **Aucun secret dans le code** (scan sk_live / clés privées / tokens : rien).
- ✅ **Aucun secret dans l'historique git** (p8, .env, credentials.json jamais commités).
- ✅ `.env`, `.env.local`, `credentials.json`, `credentials/`, `*.p8` ignorés.
- ✅ Ajouté ce jour : `KEY/` dans .gitignore (le dossier n'était pas couvert, seul son contenu .p8 l'était).
- ✅ Pas de `eval()` / `new Function()` dans le code applicatif.
- ✅ Sentry : PII strippée (`beforeSend` retire email/IP), seul l'ID user est envoyé.
- ✅ Logs : tous les `console.log` sont derrière `__DEV__` ou des helpers devLog.
- ✅ Vidéos premium : URLs Bunny signées côté edge function (JWT + entitlement), GUID jamais bundlés.
- ⚠️ Connu et documenté : le chiffrement XOR de DownloadManager n'est PAS du DRM
  (remplacer par expo-secure-store un jour, non bloquant pour la soumission).
- 💡 Recommandé (post-launch) : activer la **signature de code expo-updates**
  (`eas update:configure` code signing) pour durcir le canal OTA.

## 2 · Conformité App Store — état : 🟢 prêt (hors vidéos)

- ✅ `ITSAppUsesNonExemptEncryption: false` (pas de question chiffrement à chaque build).
- ✅ Usage descriptions FR/EN : Photos, HealthKit (share + update), Calendrier.
- ✅ Entitlement HealthKit déclaré, `privacyManifests` défini.
- ✅ **Suppression de compte dans l'app** (exigence Apple 5.1.1(v)) : `accountDeletion.js`.
- ✅ **Restaurer les achats** présent (PaywallModal).
- ✅ Sign in with Apple présent (obligatoire car Google Sign-In offert).
- ⚠️ Wording : `NSHealthShareUsageDescription` vouvoie (« votre fréquence ») alors
  que tout le reste tutoie — à harmoniser à l'occasion.
- 🔴 **Blocage produit assumé : les vidéos** (MVP 19 séances). C'est LE chemin critique.

## 3 · Code mort & rangement — script à exécuter

Le bac à sable ne peut pas supprimer de fichiers ; colle ce bloc dans ton Terminal :

```bash
cd ~/fluidbody

# 0. verrou git laissé par l'audit (indispensable avant tout)
rm -f .git/index.lock

# 1. composant orphelin (aucun import nulle part, vérifié 2x)
git rm src/components/PilierCard.js

# 2. screensaver macOS non fonctionnel (documenté KO, remplacé par WebViewScreenSaver)
git rm -r FluidBody.saver

# 3. OTA de test à révert : le fichier lui-même dit de le supprimer
git rm OTA_TEST_REVERT_2026-06-01.md

# 4. journal de bord : regrouper les recaps datés dans docs/journal/
mkdir -p docs/journal
git mv AFTERNOON_WORK_2026-05-21.md APPLE_TV_RECAP_2026-05-20.md \
  AUDIT_APP_NIGHT.md AUDIT_NIGHT_2026-05-31.md AUDIT_SECU_FLUIDITE_CODEMORT_2026-06-03.md \
  BUILD_96_PENDING.md MORNING_RECAP_2026-05-21.md PAUSE_WORK_2026-05-21.md \
  RECAP_CONSOLIDATED_2026-05-26.md RECAP_DEEP_POLISH_2026-05-22.md \
  RECAP_IPAD_TVOS_2026-06-02.md RECAP_LIQUID_GLASS_TV_2026-05-30.md \
  RECAP_NIGHT_2026-05-25.md RECAP_NUIT_2026-05-28_29.md RECAP_NUIT_2026-06-10.md \
  SPRINT_CONTENU_VIDEOS_2026-05-29.md docs/journal/

# 5. assets non référencés par le code (1,5 Mo de repo en moins ; ils ne sont
#    PAS bundlés dans l'app, c'est du ménage de repo uniquement)
git rm assets/coach/sabrina_trampoline.jpg assets/coach/meduses_blue.jpg \
  assets/coach/sabrina_beach.jpg assets/logo_web.png assets/wallpaper_iphone.png

# 6. commit de la grande préparation
git add -A
git commit -m "chore: preparation App Store - code mort, rangement docs, securite (audit 2026-07-07)"
git push origin main
```

**Volontairement CONSERVÉS** (pas du code mort) :
- `AudioRitualPlayer.js` + `constants/audioRituals.js` : fondation v1.2 « rituels
  audio » (stratégie documentée : Sabrina enregistre 5 rituels en 30 min sans
  studio). Table Supabase `audio_rituals` déjà prête. À brancher, pas à jeter.

## 4 · Structure

- `CLAUDE.md` réécrit ce jour : il décrivait encore une app mono-fichier de
  3 765 lignes ; il documente maintenant la vraie arborescence `src/`
  (~125 fichiers), les règles de perf (pas de BlurView dans un ScrollView,
  rasterisation des ombres animées) et le piège du deadlock onAuthStateChange.
- Pas de refactor « big-bang » d'App.js recommandé avant la soumission : il est
  gros mais ordonné, et un déplacement massif juste avant un launch = risque
  sans bénéfice utilisateur. À découper APRÈS le lancement, écran par écran.

## 5 · Checklist de soumission (le jour J)

1. Tourner et intégrer les **19 séances vidéo** (2-3 par pilier × 9) → Bunny + `video_assets`.
2. `eas build --profile production --platform ios` puis tester la build TestFlight.
3. Captures d'écran App Store (6.9" + 6.5" + iPad si supporté) — le kit marketing
   existe dans `marketing/`.
4. Fiche App Store : description FR/EN, mots-clés, URL support (fluidbody.ch),
   URL confidentialité (fluidbody-privacy).
5. Questionnaire confidentialité App Store Connect (données : email, ID user,
   santé — usage app uniquement, pas de tracking).
6. Vérifier prix Founder (12.90/99) et l'offre d'intro éventuelle dans App Store Connect.
7. `eas submit --profile production --platform ios`.
8. Après validation : OTA gelées sur les grosses features, builds pour le natif.

## 6 · Idées (n'hésite surtout pas 😉)

- **Widget iOS** « séance du jour + streak » (WidgetKit via @bacons/apple-targets,
  déjà utilisé pour la target watch) — LE levier de rétention, visible chaque matin.
- **Live Activity** pendant la séance : minuteur sur écran verrouillé + Dynamic Island.
- **Rituels audio v1.2** : brancher AudioRitualPlayer (le plan existe, le code aussi).
- **Notification intelligente** : rappel doux à l'heure habituelle de pratique
  (les hooks notifications existent), avec la citation Sabrina du jour.
- **Écran « Cette semaine »** : mini bilan hebdo le dimanche soir (rings + streak
  + mot de Sabrina), partageable comme la streak.
- **Parrainage** : le système referrals existe dans utils — le mettre en avant
  au moment où l'utilisatrice partage sa streak (moment de fierté = moment de parrainage).

---

*Audit réalisé le 2026-07-07 au soir. Rien de bloquant côté code : le chemin
critique vers l'App Store est le tournage des vidéos.*
