# Audit i18n FluidBody

Date : 2026-06-04
Périmètre : `src/constants/data.js` (objet T) + tous les call-sites `tr.*`
dans `App.js` et `src/`.

## TL;DR

- **Langues réellement supportées : `fr`, `en` uniquement.**
  Le CLAUDE.md mentionne 4 langues (fr/en/es/it) — c'est **obsolète**.
  `SUPPORTED_APP_LANGS = ['fr', 'en']` (App.js:437), aucun `es:` ni `it:`
  dans `T`.
- **Couverture FR ↔ EN : 100 %** (693 clés communes, 0 manquante de chaque
  côté). Excellent.
- **466 fallbacks `tr.xxx || '...'` dans le code.** Tous redondants côté
  EN (les clés existent), mais ils figent une seconde traduction
  silencieusement dans le code → toute évolution doit être faite 2 fois.
- **~10 strings hardcodées non traduites côté EN** sur l'écran MonCorps
  (cartes Programmes) + VideoPlayer + un badge "NOUVEAU" + le label
  "Politique de confidentialité" du SignUp.
- Format dates / nombres : `Intl.NumberFormat` + `toLocaleString` câblés
  via `localeFromLang(lang)` — mais cette fonction supporte déjà
  es-ES / it-IT alors que la lang elle-même est limitée à fr/en. Code
  prêt si on rouvre es/it, pas actif aujourd'hui.
- Devise : `CHF` figé partout — **justifié** (mono-marché Suisse).

---

## 1. Tableau de couverture

| Langue | Présente dans `T` | Clés | Manquantes vs union | Couverture |
|--------|-------------------|------|---------------------|------------|
| fr     | Oui (ligne 24)    | 693  | 0                   | 100 %      |
| en     | Oui (ligne 703)   | 693  | 0                   | 100 %      |
| es     | **Non**           | 0    | 693                 | 0 %        |
| it     | **Non**           | 0    | 693                 | 0 %        |

Note : un faux positif `${p}, ${n} séances` a été détecté par le parser —
c'est une fonction template `notif_milestone_title` qui renvoie un string,
pas une clé. Les 693 clés FR ↔ EN sont strictement identiques.

Autres datasets bilingues (fr/en uniquement) :
- `SEANCES_FR` (data.js:1381), `SEANCES_EN` (data.js:1396)
- `PILIER_CONTENT.fr` / `.en` (pilierContent.js)
- `RITUAL_CATEGORIES.keyFr` / `keyEn` (audioRituals.js)
- `legal.termsUrl` / `termsUrlEn`
- `SABRINA_QUOTES` (data.js:1421) — alimenté par `sabrinaQuotes.js`,
  **uniquement FR** (30 citations, voir analyse plus bas)
- `JOUR_LABELS` (MonCorps.js:117) — embarque déjà fr/en/de/pt/zh/ja/ko/es/it
  mais l'app ne fait jamais `lang === 'es'`, donc tout retombe sur fr/en.

---

## 2. Auto-détection langue

`getAppLangFromLocale()` (App.js:440) :
```
const SUPPORTED_APP_LANGS = ['fr', 'en'];
function getAppLangFromLocale() {
  // expo-localization → si code ∈ {fr, en} on le garde, sinon 'fr'
}
```

Conséquence : un utilisateur espagnol ou italien tombe automatiquement
sur **fr** (pas EN). C'est probablement intentionnel pour la cible
helvétique (les hispanophones/italianophones de Suisse romande parlent
souvent français), mais à clarifier — sur l'App Store espagnol/italien,
l'app s'ouvrira en français.

Aucun sélecteur de langue dans l'UI (Preferences.js ne propose pas le
switch) ; seule la locale système pilote `lang`, ou la valeur sauvegardée
côté Supabase profil (`profile.lang`).

---

## 3. Top fallbacks suspects dans le code (`tr.xxx || '...'`)

466 occurrences au total, réparties :

| Fichier                                  | Fallbacks |
|------------------------------------------|-----------|
| src/screens/Profil.js                    | 152       |
| src/screens/ProfileOnboarding.js         | 56        |
| src/screens/MonCorps.js                  | 55        |
| src/screens/Activity.js                  | 38        |
| App.js                                   | 31        |
| src/screens/Resume.js                    | 24        |
| src/screens/Statistics.js                | 18        |
| src/screens/MyPrograms.js                | 17        |
| src/screens/ProgramBuilder.js            | 16        |
| src/screens/PilierEducation.js           | 14        |
| src/components/tv/ProgrammesTV.js        | 13        |
| src/screens/SignIn.js                    | 9         |
| src/components/Timer.js, BreathingCheckIn| 6 chacun  |
| src/components/PaywallModal.js           | 5         |
| autres                                   | <5 chacun |

### Top 20 fallbacks par fréquence

```
7x  tr.profile_not_set          || 'Non renseigné'
5x  tr.activity_ring_move       || 'Move'
5x  tr.activity_ring_exercise   || 'Exercise'
4x  tr.program_default_name     || 'Programme'
4x  tr.ob_auth_err_net          || 'Erreur.'
4x  tr.first_seance_later       || 'Plus tard'
4x  tr.coach_name               || 'Sabrina'
4x  tr.activity_unit_min        || 'min'
4x  tr.activity_unit_kcal       || 'kcal'
4x  tr.activity_unit_hrs        || 'hrs'
4x  tr.activity_ring_stand      || 'Stand'
3x  tr.share_card_message       || 'Séance terminée avec FLUIDBODY+ 🪼'
3x  tr.profile_cancel_btn       || 'Cancel'
3x  tr.onb_referral_validate    || 'Apply code'
3x  tr.ob_auth_terms_required   || 'Tu dois accepter les CGU pour créer un compte.'
3x  tr.ob_auth_submit_in        || 'Se connecter'
3x  tr.delete_account_type_word || 'SUPPRIMER'
3x  tr.auth_or                  || 'ou'
3x  tr.auth_google              || 'Continuer avec Google'
3x  tr.auth_apple               || 'Continuer avec Apple'
```

Étant donné FR ↔ EN à 100 %, ces fallbacks ne se déclenchent **jamais
en pratique** sur la version installée actuelle. Risque réel = futur :
si on ajoute es/it sans définir une clé, le fallback hardcoded
s'affichera. Et 11 cas mélangent : fallback FR utilisé alors que la
clé `tr.profile_cancel_btn` doit pouvoir donner "Cancel" en EN → si la
clé est supprimée par erreur côté EN, l'utilisateur EN verra "Cancel"
(neutre, OK) ; mais `'Erreur.'` ou `'Tu dois accepter…'` montreraient
du français à un anglophone.

Recommandation : nettoyer progressivement ces fallbacks au profit d'un
helper `t(key)` qui logge en `__DEV__` les clés manquantes.

---

## 4. Strings hardcodées non traduites

### MonCorps.js — cartes Programmes (haute priorité)

```
src/screens/MonCorps.js:1420  >NOUVEAU<       (badge top-left tile)
src/screens/MonCorps.js:1705  >10 min pour réveiller ton corps en douceur<
src/screens/MonCorps.js:1706  >7 JOURS · 10 MIN/JOUR<
src/screens/MonCorps.js:1726  >Soulage et renforce ton dos en 21 jours<
src/screens/MonCorps.js:1727  >21 JOURS · 15 MIN/JOUR<
src/screens/MonCorps.js:1747  >Décompresse après une journée assise<
src/screens/MonCorps.js:1748  >5 JOURS · 15 MIN/JOUR<
src/screens/MonCorps.js:1768  >Renforce ton centre et ta stabilité<
src/screens/MonCorps.js:1769  >14 JOURS · 12 MIN/JOUR<
src/screens/MonCorps.js:1789  >Gagne en mobilité sur tout le corps<
src/screens/MonCorps.js:1790  >14 JOURS · 20 MIN/JOUR<
```

→ Ces 5 cartes Programmes affichent **toujours du français**, même pour
un utilisateur EN. Idem dans `ProgrammesTV.js:39-41` (fallback duration
hardcoded `'7 JOURS · 10 MIN/JOUR'`).

À noter : `data.js:138` définit déjà `prog_debuter_duree: '3 JOURS · 10
MIN/JOUR'` côté FR — la convention est donc d'avoir une clé par carte,
elle existe pour "débuter" mais pas pour les 5 autres.

### Badge "NOUVEAU" hardcodé alors qu'il existe en bilingue

`src/utils/sessionBadges.js:43` définit `newer: { fr: 'NOUVEAU', en: 'NEW' }`.
Mais `MonCorps.js:1420` écrit `>NOUVEAU<` en dur sans passer par ce helper.

### VideoPlayer.js

```
src/components/VideoPlayer.js:757   >Prépare-toi<   (intro overlay)
```

### SignUp / footer

```
App.js:1147   >Politique de confidentialité<
```
(le `onPress` ouvre l'URL ; le label est en français pur, alors que la
clé `tr.ob_auth_privacy_link` existe et donne "Privacy policy" côté EN —
il y a juste une autre occurrence ligne 836 qui utilise correctement
le `tr`).

### Profil — Coach mode (peu critique, écran admin)

```
src/screens/Profil.js:1581   >Email<                    (label profil)
src/screens/Profil.js:1664   >Reset HealthKit prompt flag<
src/screens/Profil.js:1778   >Outils admin<
src/screens/Profil.js:1784   >Séances cochées<
src/screens/Profil.js:1792   >Minutes cumulées<
src/screens/Profil.js:1796   >Clés AsyncStorage<
src/screens/Profil.js:1807   >Marquer respiration faite<
src/screens/Profil.js:1810   >Réarmer Coach welcome overlay<
```
→ Écran caché (Coach mode), Sabrina/Yvan only — pas bloquant.

---

## 5. Format dates / heure / nombres

- `localeFromLang(lang)` (Activity.js:57, PaywallModal.js:50) renvoie
  `fr-FR` / `en-US` / `es-ES` / `it-IT`. Le mapping ES/IT est inerte
  aujourd'hui (lang ne prend jamais ces valeurs).
- `formatPriceCHF(amount, lang)` (iap.js:91) utilise `Intl.NumberFormat`
  avec `style: 'currency', currency: 'CHF'`. Fallback `'CHF ' + amount`
  si `Intl` indisponible (Hermes ancien). Solide.
- `details.steps.toLocaleString(localeFromLang(lang))` (Activity.js:653) →
  séparateur de milliers localisé. Bien.
- `DAY_FULL_FR` / `DAY_FULL_EN` (MonCorps.js:124-125) :
  `lang === 'en' ? DAY_FULL_EN : DAY_FULL_FR` ligne 2043 → binaire dur.
  Acceptable tant qu'on reste fr/en.

Pas de `new Date(...).toString()` ou `.toLocaleDateString()` sans
locale explicite détecté dans l'app code.

---

## 6. Devise

`CHF` est codé en dur dans `iap.js` :
```js
prices: { monthly: 12.90, yearly: 99, currency: 'CHF' }
```
Commenté `// est aujourd'hui mono-marché CHF (Suisse).` → **conforme à
la stratégie** (Espace Pilates suisse, App Store CH, founder pricing
CHF). Pas un bug.

---

## 7. Recommandations priorisées

### P0 — Aligner le CLAUDE.md sur la réalité
Le `CLAUDE.md` du repo annonce 4 langues (fr/en/es/it). C'est **faux**.
Effet : tout nouvel agent (humain ou Claude) lit cette ligne et part
chercher des clés es/it qui n'existent pas. À corriger :
```diff
- The app is in French by default but supports 4 languages (fr, en, es, it)
+ The app is in French by default and supports English (fr, en) via
+ device locale auto-detection. Spanish/Italian were planned but the T
+ object only contains fr/en today.
```

### P1 — Fixer les strings FR hardcodées qui régressent côté EN
5 sous-titres + 5 durées de cartes Programmes dans `MonCorps.js`
(lignes 1705-1790), badge `NOUVEAU` ligne 1420, label "Politique de
confidentialité" `App.js:1147`, "Prépare-toi" `VideoPlayer.js:757`.

Quick-win : créer ~12 clés dans T (`prog_reveil_sub`, `prog_dos_duree`,
etc.) et utiliser le helper `sessionBadges` existant pour "NOUVEAU".
Estimation : 20-30 min.

### P2 — Décider du sort de es/it
Trois options claires :
1. **Drop officiel** : retirer les références es/it des commentaires
   (CLAUDE.md, JOUR_LABELS, localeFromLang) → simpler mental model.
2. **Stub minimal** : ajouter `es: { ...T.fr }` et `it: { ...T.fr }`
   dans data.js pour éviter le crash silencieux si un user édite son
   profil `lang: 'es'` côté Supabase (aujourd'hui ça tombe sur T.fr
   via le `|| T.fr` du code, donc OK, mais le code donne l'illusion).
3. **Vraie traduction** : 693 clés × 2 langues = ~1400 strings à
   traduire. Cohérent uniquement si on cible l'App Store ES/IT
   (hors Suisse), ce qui n'est pas la stratégie actuelle ("companion
   app studio clientele" — qui est francophone/italophone/bulgarophone
   en Suisse romande).

**Recommandation : option 1.** La cible commerciale réelle est FR
(Suisse romande) avec EN en filet de sécurité touristes/expats. ES/IT
serait un détour de scope sans ROI clair pour 2026.

### P3 — Nettoyer les 466 fallbacks `||`
Pas urgent (FR↔EN à 100 %), mais limite la maintenance long terme.
Pattern proposé :
```js
function t(tr, key, fallback) {
  const v = tr[key];
  if (v !== undefined) return v;
  if (__DEV__) console.warn('[i18n] missing key:', key);
  return fallback || key;
}
```
Migration progressive, fichier par fichier.

### P4 — Sélecteur de langue dans Préférences
Aujourd'hui la seule manière de changer fr↔en est de changer la locale
iOS/Android. Ajouter un picker dans `Preferences.js` (3 lignes) permet à
un utilisateur français de tester l'app en anglais et à un anglophone
expat de revenir en français facilement. Faible effort, gain UX réel.

