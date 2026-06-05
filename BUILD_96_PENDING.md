# BUILD #96 — PENDING (à lancer après #95)

> Mémo écrit le 2026-06-05 par l'agent « renforcement juridique blessures » (option C).
> Build #95 était EN COURS au moment des modifs → **ne pas lancer #96 tant que #95 n'est pas FINISHED**.

## Ce qui est inclus dans #96 (déjà mergé sur `main`)

Commit app : `9127543` — feat(legal): medical disclaimer modal + reinforced CGU on first launch

- **MedicalDisclaimerOverlay** (`src/components/MedicalDisclaimerOverlay.js`) :
  modal de sécurité affiché 1× par install (clé AsyncStorage
  `fluid_medical_disclaimer_v1_seen`), juste après l'onboarding et AVANT la
  1ère séance. Checkbox de non-contre-indication qui gate le CTA + lien CGU.
- **App.js** : séquence disclaimer → coach welcome (ne s'empilent jamais).
- **VideoPlayer** : confirmation pré-séance (Alert natif, 1× par session
  process / cold start) qui retient le compte à rebours + la lecture ;
  « Annuler » ferme le lecteur.
- **i18n** fr/en complets (es/it retombent sur EN, comme `getTermsUrl`).

Hors app (repo `fluidbody-privacy`, déjà live sur GitHub Pages) :
- CGU FR + EN v1.1 renforcées (symptômes impératifs, §5 bis acceptation des
  risques, §8 limitation de responsabilité durcie). Commit `8a9338d`.

## Étapes pour le prochain task

1. **Vérifier que #95 est FINISHED** :
   ```bash
   eas build:list --platform ios --limit 3
   # ou : eas build:view <buildId du #95>
   ```
   Ne PAS continuer si #95 est encore `in queue` / `in progress`.

2. **Lancer #96 avec auto-submit** (compte EAS `ytissot`, iPhone uniquement —
   PAS de build tv) :
   ```bash
   cd /Users/xvan06/fluidbody
   eas build --profile production --platform ios --auto-submit --non-interactive
   ```
   - `production` → `autoIncrement: true` (buildNumber bumpé automatiquement,
     `appVersionSource: remote`).
   - `--auto-submit` utilise `submit.production.ios`
     (ascAppId `6761364962`, appleTeamId `R5V88AS9MX`).

3. Après soumission : laisser Apple traiter le build sur App Store Connect.
   **NE PAS** pousser en App Store review automatiquement — TestFlight d'abord.

## Garde-fous

- iPhone uniquement. Pas de `production-tv`.
- ⚠️ Crédits de build EAS à 100 % utilisés → pay-as-you-go (facturé).
- Vérifier `.env` local : `EXPO_PUBLIC_SENTRY_DSN` doit être présent (bundlé au
  build).
