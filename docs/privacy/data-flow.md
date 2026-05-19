# Data flow & user data lifecycle

This doc captures where FluidBody user data lives and how it can be wiped
on demand. Maintained alongside the App Store privacy questionnaire and
the in-app "Confidentialité" section in Profil.

## Storage locations

| Surface             | What lives there                                                                                     | Reset path                                            |
|---------------------|------------------------------------------------------------------------------------------------------|-------------------------------------------------------|
| `AsyncStorage`      | onboarding flags, prénom, language, theme, séances completion cache, video resume positions, downloads ledger, subscription cache | `clearLocalUserData()` (keeps `fluid_lang`, `fluid_theme_mode`) |
| Supabase `profiles` | prénom, langue, mensurations, objectifs, anneaux d'activité, code parrain, flag `is_subscriber`      | `delete_my_account()` RPC                             |
| Supabase `progression` | per-pillar séance completion mirror (optional)                                                    | `delete_my_account()` RPC                             |
| Supabase `user_programs` | algorithmic programs generated for the user                                                    | `delete_my_account()` RPC                             |
| Supabase `user_favorites` | favorited séances                                                                              | `delete_my_account()` RPC                             |
| Supabase `tv_pairings` *(branch-conditional)* | TV pairing codes if shipped on the env                                            | `delete_my_account()` RPC                             |
| `auth.users`        | Supabase auth row (email, refresh tokens, providers)                                                  | `delete_my_account()` final step                      |
| HealthKit           | workouts written from FluidBody séances                                                              | iOS Settings → Health → FluidBody → Delete Data       |
| iOS Calendar        | events written by the auto-schedule feature                                                          | "Retirer de mon agenda" in Profil → Calendar          |
| RevenueCat          | subscription entitlement, app_user_id                                                                | Cleared on RC server when the subscription expires; the `rc_app_user_id` column in `profiles` is removed with the profile row above |

## Suppression du compte — cascade complète

Apple App Store guideline **5.1.1(v)** requires apps that let users create
an account to also let them delete it inside the app. Triggered from
Profil → "Zone dangereuse" → "Supprimer mon compte". The flow is a hard
double confirmation:

1. Native Alert "Es-tu sûr ?" — Annuler / Continuer.
2. Cross-platform Modal that requires typing the localized confirmation
   word (FR: `SUPPRIMER`, EN: `DELETE`) before the destructive button
   activates.
3. Client calls `supabase.rpc('delete_my_account')`.

The RPC (`supabase/migrations/20260521000000_delete_account.sql`) is
`SECURITY DEFINER` and operates strictly on `auth.uid()` — there is no
parameter that could target another user. It cascades through:

1. `public.progression` (guarded by `to_regclass`)
2. `public.user_programs`
3. `public.user_favorites`
4. `public.tv_pairings` (guarded — table is branch-conditional)
5. `public.profiles`
6. `auth.users`

After the RPC succeeds, the client:

- calls `supabase.auth.signOut()`,
- runs `clearLocalUserData()` which wipes every `AsyncStorage` key except
  the device-level preferences `fluid_lang` and `fluid_theme_mode`,
- shows a success Alert and resets in-memory React state via
  `onAccountDeleted` (handled in `App()` root), which sends the user back
  to the onboarding flow.

External data that lives outside Supabase (HealthKit workouts, Calendar
events, RevenueCat entitlement, downloaded video files) is **not**
touched — the user keeps full control over those via the respective
system surfaces. The privacy doc and the in-app warning text both make
that explicit.

## Verification checklist (manual QA)

Before each App Store submission, verify the cascade on a staging account:

- [ ] Create a test account via magic link.
- [ ] Cocher au moins une séance (writes to `progression`).
- [ ] Mettre une séance en favori (writes to `user_favorites`).
- [ ] Générer un programme algorithmique (writes to `user_programs`).
- [ ] Profil → Zone dangereuse → Supprimer mon compte → confirmer.
- [ ] Vérifier dans le dashboard Supabase que les lignes
      `auth.users`, `profiles`, `progression`, `user_programs`,
      `user_favorites` pour cet `user_id` ont disparu.
- [ ] Relancer l'app, vérifier qu'on retombe sur l'onboarding et
      que `fluid_lang` est conservé.
