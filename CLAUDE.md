# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FluidBody is a **Pilates/wellness mobile app** built with React Native + Expo (SDK 54). It targets iOS and Android with support for iPad scaling. The app is in French by default but supports 4 languages (fr, en, es, it) with auto-detection from device locale.

## Development Commands

```bash
npx expo start          # Start Metro bundler (Expo Go or dev client)
npx expo start --web    # Start web version
npx expo run:ios        # Build and run on iOS
npx expo run:android    # Build and run on Android
eas build --profile development --platform ios   # EAS dev build
eas build --profile production --platform ios    # EAS production build
```

No test runner or linter is configured.

## Architecture

**This is a single-file app.** Nearly all application code lives in `App.js` (~3765 lines). There is no component/screen directory structure — screens, navigation, business logic, translations, content data, and styling are all in `App.js`.

### Key sections in App.js (top to bottom)

1. **Imports & safe-requires** (lines 1-28): Optional native modules (RevenueCat, Notifications, Haptics) are loaded with try/catch to work in Expo Go
2. **Utility functions** (lines 30-210): Streak counting, video URL detection, haptics, video resume/persistence via AsyncStorage
3. **Translations** (`const T`, ~line 253): Multi-language string map keyed by `fr|en|es|it`
4. **Content data** (~lines 680-840): Articles (`ARTICLES`), fiches (`FICHES`), séances (`SEANCES_FR/EN/ES/IT`), piliers (`PILIERS_BASE`)
5. **SVG icon components** (~lines 885-930): Body zone icons (épaules, dos, hanches, etc.)
6. **Animated visuals** (~lines 931-1150): Jellyfish (`Meduse`) animation, celebration overlay
7. **VideoPlayer** (~line 1465): Full video player with HLS (Bunny CDN), skip controls, resume support
8. **Screen components**:
   - `MonCorps` (~line 2176): Home/body map screen with tension zone selection + orbs
   - `Biblio` (~line 2586): Article/fiche library
   - `Progresser` (~line 2690): Progress stats
   - `ParcoursScreen` (~line 2760): Journey/profile screen
   - `AuthScreen` (~line 2903): Supabase email auth (magic link)
   - `OnboardingScreen` (~line 3002): First-launch onboarding flow
9. **Notifications & Supabase setup** (~line 3300): Notification scheduling, Supabase client init
10. **MainApp** (~line 3351): Tab navigator with subscription/IAP logic (RevenueCat)
11. **App root** (~line 3588): Onboarding check, auth state, profile sync

### Only other source file
- `components/ErrorBoundary.js`: React error boundary with retry button

### Entry point
- `index.js` registers `App` via `registerRootComponent`

## Backend & Services

- **Supabase**: Auth (magic link email), user profiles table (`profiles`), session persistence via AsyncStorage
- **RevenueCat**: In-app purchases (monthly/yearly subscription), entitlement `Fluidbody Pilates Pro`
- **Bunny CDN**: Video hosting (HLS `.m3u8` streams)
- **EAS**: Build and submit pipeline (see `eas.json`)

## Key Patterns

- **Safe optional imports**: Native-only modules use `try { require(...) } catch(e) {}` so the app works in Expo Go where native modules aren't available
- **iPad scaling**: `IS_IPAD` flag and `SCALE` factor (relative to 390px iPhone width) used throughout for responsive layout
- **AsyncStorage keys**: `fluid_sub` (subscription status), `fluid_video_resume_v1_*` (video positions), `fluid_onboarding_done`, `fluid_prenom`, `fluid_lang`, `fluid_tension_idxs`, `fluid_done_*` (exercise completion)
- **Translations**: All UI strings go through `const tr = T[lang] || T['fr']` — always access via `tr.key_name`
- **Piliers**: The 6 exercise categories (p1-p6, optionally p7) each with up to 20 séances; first 2 séances per pilier are free

## Vidéos sécurisées

Premium Bunny CDN URLs are **never** bundled. Flow:

1. `src/constants/data.js` flags sessions that have a video with `true` at
   index 3 of the séance tuple (e.g. `['Le dos expliqué', "1'59''", 'Comprendre', true]`).
   The Bunny GUID lives only in the Supabase table `video_assets`.
2. `src/utils/videoUrl.js#getSignedVideoUrl(sessionId, kind, lang?)` calls the
   `sign-video-url` Supabase edge function with the user's JWT.
3. The edge function (`supabase/functions/sign-video-url/index.ts`) verifies
   the JWT, looks up `video_assets.bunny_path`, checks entitlement
   (admin allowlist → `profiles.is_subscriber` → live RevenueCat fallback),
   then mints a Bunny Token-Auth URL with a 30-min TTL.
4. `VideoPlayer` and `DownloadManager` consume signed URLs only; the client
   has an in-memory cache that re-signs ~1 min before expiry.

Session id convention: `${pilierKey}_${seanceIndex}` — matches the existing
`DownloadManager` key. Same id is used for HLS, MP4 download, and VTT
subtitles; the edge function picks the asset suffix from `kind`.

Setup:
- Bunny dashboard: enable Token Authentication on the pull zone (see
  `supabase/README.md` for the exact clicks).
- Supabase env vars (function secrets, never `EXPO_PUBLIC_*`):
  `BUNNY_TOKEN_KEY`, `BUNNY_PULL_ZONE_HOST`,
  `REVENUECAT_SECRET_API_KEY` (optional), `ADMIN_EMAILS` (optional).
- Run `supabase db push` to create `video_assets` + add `profiles.is_subscriber`,
  then `supabase functions deploy sign-video-url`.

`DownloadManager.js`'s XOR-with-derived-seed encryption is a casual-tamper
deterrent, **not** DRM. It's tagged in the file as a placeholder; replace
with `expo-secure-store` + a per-user-derived key before treating it as a
real protection layer.

## Metro Config

`metro.config.js` adds Node.js polyfills (`node-libs-react-native`) for Supabase compatibility, with mock `net`/`tls`.

## Crash Monitoring (Sentry)

- DSN injected via `EXPO_PUBLIC_SENTRY_DSN` (see `.env.example`). Empty → Sentry is a no-op.
- Init lives at the top of `App.js` (before any other native module loads). Native iOS/Android crashes are captured automatically.
- `Sentry.setUser({ id })` is wired to the Supabase auth state — only the user ID is sent, no email/PII (`beforeSend` strips email/IP/username).
- `ErrorBoundary` forwards JS render errors to Sentry via `onError`.
- The global `ErrorUtils` handler in prod (`App.js:95`) sends to Sentry and shows a generic alert ("Une erreur est survenue, l'équipe a été notifiée") — no stack trace is exposed.
- All `console.log/warn/error` calls in app code are gated behind `__DEV__` (or routed through `devLog`/`devWarn` helpers) so prod logs stay clean.

**To enable for TestFlight:**
1. Create a "React Native" project on sentry.io.
2. Put the public DSN in your local `.env`: `EXPO_PUBLIC_SENTRY_DSN=https://...@...ingest.sentry.io/...`
3. `eas build --profile production --platform ios` — the env var is bundled at build time.
4. Verify on the Sentry dashboard: trigger a JS error from a dev build, confirm the event arrives. Native crash symbolication needs sourcemap/dSYM upload (wire `sentry-cli` in an EAS post-publish hook later — not done yet).

## HealthKit

The app uses **`@kingstinct/react-native-healthkit` v14** (Nitro Modules).
It replaced the legacy `react-native-health` 1.19 binding in May 2026 after
that lib crashed with NSException on iOS 26.5 + New Arch
(`EXC_BAD_ACCESS` in `TurboModuleConvertUtils::convertNSExceptionToJSError`).
Nitro bypasses the legacy ObjC TurboModule bridge that owns that crash class.

### Call sites
- **`App.js`** — top-level `initHealthKit()` (called once on app mount) and
  `saveHealthKitWorkout(durationMinutes, extras)` (called from `VideoPlayer`
  on session end). Activity type: `HKWorkoutActivityType.pilates = 66`.
- **`src/utils/healthkit.js`** — promise-based helpers used by Activity,
  ProfileOnboarding, Profil and `profileSync.js`. Keeps the legacy export
  shape (`ensureHealthKitInit`, `readActivitySummary`, `readDayDetails`,
  `readDayWorkouts`, `readActivityHistory`, `readLatestWeightKg`,
  `readLatestHeightCm`, `writeWeightKg`, `writeHeightCm`, `readDateOfBirth`,
  `readBiologicalSex`).
- **`src/hooks/useLiveHeartRate.js`** — 4-second polling on
  `queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', ...)` with a 30-s
  lookback. Picks the most recent Apple Watch sample (source-name match
  on `/apple\s*watch/i`).
- **`src/screens/HealthKitConnect.js`** — onboarding permission sheet.
  Uses `requestAuthorization({toShare, toRead})` + `authorizationStatusFor`
  on a WRITE type to probe whether the user actually granted (READ status is
  always reported as `sharingDenied` by HealthKit for privacy).

### Kill switch
`HEALTHKIT_DISABLED` is hoisted at module scope in `App.js`, `healthkit.js`
and `useLiveHeartRate.js`. Set to `false` by default. Flip to `true` if a
future iOS version causes a regression; the JS kill switch avoids needing a
native rebuild. The flag also auto-marks the onboarding HK prompt as done so
the user doesn't see the permission screen while it's disabled.

### Image fix (kept from previous mitigation)
`HealthKitConnect.js` uses `<Image>` from `expo-image` (SDWebImage) instead
of RN's `Image` to avoid the `RCTImageLoader` + `CGImageSourceCreateThumbnailAtIndex`
crash on the 882×806 Display P3 `apple-watch-hero.png`. The PNG was also
re-encoded from Display P3 → sRGB via `sips`.

### Permissions (declared in `app.json` plugin block)
- Read: HeartRate, ActiveEnergyBurned, BasalEnergyBurned, AppleExerciseTime,
  AppleStandTime, BodyMass, Height, StepCount, DistanceWalkingRunning,
  FlightsClimbed, DateOfBirth, BiologicalSex, Workout
- Write: ActiveEnergyBurned, HeartRate, BodyMass, Height, Workout
- Background delivery: enabled (`com.apple.developer.healthkit.background-delivery`)

## Notes

- The `my-app/` directory is an unrelated Expo Router scaffold (not part of the main app)
- The `docs/` directory contains a landing page (`index.html`)
- App language: code comments and variable names are primarily in French
