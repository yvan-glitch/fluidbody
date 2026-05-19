# Privacy data-flow — FluidBody iOS

Last updated: 2026-05-19 (audit branch `audit/pre-app-store-submission`).

This document inventories every piece of data the app touches, where it
lives, and which third party (if any) ever sees it. Use it to:

- Fill the App Store Connect privacy questionnaire so it matches
  `app.json > privacyManifests.NSPrivacyCollectedDataTypes`.
- Answer Apple review questions about specific data types.
- Update the user-facing privacy text in `T.fr/T.en.profil_donnees_*`.

## Data inventory

| Data | Source | Stored | Sent to | Notes |
|---|---|---|---|---|
| Email | User input (sign-up / sign-in / Apple ID relay) | Supabase `auth.users`, `profiles.id`-derived, AsyncStorage `fluid_supa_email` (cache) | **Supabase EU** | Linked. Required for cloud profile, reset-password. |
| First name (prénom) | User input (onboarding) or Apple Sign-In `givenName` | Supabase `profiles.prenom`, AsyncStorage `fluid_prenom` | **Supabase EU** | Linked. Optional but used everywhere in UI. |
| User ID (Supabase uid) | Generated on first sign-in | Supabase `auth.users.id`, AsyncStorage session | **Supabase EU**, Sentry (as tag, no email) | Linked. Needed for RLS. |
| Tension zones (corps map) | User input (onboarding + Mon Corps) | AsyncStorage `fluid_tension_idxs` | **Supabase `profiles.tension_idxs`** (on sign-in) | Linked. Used to score séances. |
| Onboarding profile (genre, DOB, poids, taille, objectifs, niveau) | User input (ProfileOnboarding) | AsyncStorage; mirrored to `profiles` row | **Supabase EU** | Linked (sensitive — health-adjacent). |
| Séance completion (done map per pilier) | User taps "valider la séance" | AsyncStorage `fluid_done_*` | **Supabase `profiles.done_map`** (sync on auth) | Linked. |
| Custom programs | User creates a program in MyPrograms | AsyncStorage; `user_programs` table | **Supabase EU** | Linked. Per-user RLS. |
| Favorite articles | User taps heart | AsyncStorage; `user_favorites` table | **Supabase EU** | Linked. |
| Referral code | Generated server-side on first sign-in | `profiles.referral_code`, AsyncStorage | **Supabase EU** | Linked. Visible only to user (admins see it for support). |
| Video resume timestamps | VideoPlayer position-save | AsyncStorage `fluid_video_resume_v1_*` | — | **Local only.** |
| Subscription status (`fluid_sub`) | RevenueCat customerInfo event | AsyncStorage; mirrored to `profiles.is_subscriber` | **RevenueCat**, **Apple App Store**, Supabase | Linked. Required for entitlement gating. |
| Purchase history | Apple App Store IAP | RevenueCat → app | **RevenueCat**, **Apple** | Linked. RC retains for renewal logic. |
| HealthKit reads (HR, calories, exercise time, steps, weight, height, DOB, sex, distance, flights) | Apple HealthKit (Apple Watch + iPhone) | In-memory only | — | **Local only.** Never leaves the device. |
| HealthKit writes (Pilates workout: duration, kcal, HR) | App writes after séance complete | Apple HealthKit | — | Stays in HealthKit (Apple's silo). |
| Calendar events (NEW build #61) | App creates events tagged `[Fluidbody:...]` | iOS Calendar (EventKit) | — | **Local only.** The app stores nothing about the events other than `fluid_calendar_prefs_v1` (chosen calendar id) in AsyncStorage. |
| Crash reports | JS or native crash | Sentry SDK queue | **Sentry** (project `fluidbody`) | Anonymised: `beforeSend` strips `email`, `ip_address`, `username`. Only the Supabase user ID is sent (set via `Sentry.setUser({ id })`). |
| Push token | expo-notifications | AsyncStorage | — | Currently we only schedule **local** notifications, no remote push, so the token is never transmitted off-device. |

Anything in **bold** in the *Sent to* column is a third party. Everything
else stays on the device.

## Third-party processors

| Vendor | Purpose | Region | Apple Privacy declaration |
|---|---|---|---|
| Supabase (managed) | Auth + Postgres (profiles, user_programs, user_favorites, video_assets, referrals) | EU (Frankfurt) | Linked: Email, Name, User ID, Health (subset) |
| Sentry | Crash + error reporting | EU | Linked: Crash data (anonymous-tagged with user ID) |
| RevenueCat | IAP receipt validation + offerings | US | Linked: Purchase history, User ID |
| Bunny CDN | Video streaming (signed tokens) | EU | Linked: nothing personal — only signed URL with 30-min TTL; we send no PII in headers |
| Apple | HealthKit storage, EventKit, IAP | Device / Apple iCloud | Read/write only on user grant |
| GitHub Pages | Privacy policy hosting (`yvan-glitch.github.io/fluidbody-privacy`) | US/global | Static page, no telemetry |

## Mapping to app.json `NSPrivacyCollectedDataTypes`

Already declared in `app.json` (verify before submitting App Store Connect questionnaire matches):

- `NSPrivacyCollectedDataTypeEmailAddress` — linked, app functionality
- `NSPrivacyCollectedDataTypeUserID` — linked, app functionality
- `NSPrivacyCollectedDataTypeHealth` — **NOT linked** (HealthKit reads stay
  on-device — this is correct under Apple's definition; "linked" means
  associated with the user's identity in our systems, which it is not)
- `NSPrivacyCollectedDataTypePurchaseHistory` — linked, app functionality
- `NSPrivacyCollectedDataTypeCrashData` — not linked
- `NSPrivacyCollectedDataTypePerformanceData` — not linked

Missing — consider whether you need to add these:

- `NSPrivacyCollectedDataTypeName` (first name / prénom). Currently the
  declaration says only Email + UserID. The profile row contains
  `prenom`, which is "Name" under Apple's taxonomy. **Recommend
  adding.**
- `NSPrivacyCollectedDataTypeOtherUserContent` if you treat the custom
  programs / favorites / référral data as "user content". Optional —
  not strictly required.
- `NSPrivacyCollectedDataTypeSensitiveInfo` is **NOT required**: we
  don't collect race, religion, sexual orientation, etc. The onboarding
  has gender / DOB / weight / height — those map to "Health" (already
  declared) or "Name/Other".

## What the app does NOT do

Sanity list to defend against reviewer questions:

- ❌ No advertising tracking, no IDFA, no SKAdNetwork. ATT prompt not
  required. `NSPrivacyTracking: false` is honest.
- ❌ No third-party analytics SDK (no Firebase, no Mixpanel, no
  Amplitude).
- ❌ No camera, microphone, photo library, contacts, or location.
- ❌ No data sold or shared with brokers.
- ❌ No background uploads (Sentry uses its own queue; HealthKit /
  Calendar stay on device).

## Action items for the App Store Connect questionnaire

When filling the questionnaire:

1. **Contact info → Email Address** → Collected, linked to user, used
   for App Functionality.
2. **Contact info → Name** → Collected, linked to user, used for App
   Functionality. *(Add to NSPrivacyCollectedDataTypes too.)*
3. **Identifiers → User ID** → Collected, linked, App Functionality.
4. **Purchases → Purchase History** → Collected, linked, App
   Functionality.
5. **Health & Fitness** → Collected (read + write via HealthKit), **not
   linked** (stays in HealthKit silo), App Functionality.
6. **Diagnostics → Crash Data + Performance Data** → Collected, **not
   linked**, App Functionality.

All other categories: "Data Not Collected".
