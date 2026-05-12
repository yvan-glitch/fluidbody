# Fluidbody

Premium Pilates companion app for the Apple ecosystem (iOS + iPadOS, Apple TV planned).
Native React Native / Expo SDK 54. Targets iPhone + iPad. Apple Watch integration for live heart rate during sessions.

## Stack

- **Frontend**: Expo SDK 54, React Native 0.81, React 19, New Architecture (Fabric/TurboModules), TypeScript declarations only
- **State / Theming**: ThemeProvider with dark / light / auto-follow-system + Liquid Glass primitives (`src/components/ui/Glass*`)
- **Auth + DB**: Supabase (email/password + Apple Sign-In via `signInWithIdToken`)
- **Subscriptions**: RevenueCat (entitlement `Fluidbody Pilates Pro`)
- **Video**: Bunny Stream + token-authenticated CDN URLs via Supabase Edge Function `sign-video-url`
- **Health**: HealthKit (read HR / kcal / exercise / stand / steps; write workouts + body mass)
- **Monitoring**: Sentry (`@sentry/react-native`)

## Setup

```bash
npm ci
cp .env.example .env  # fill in EXPO_PUBLIC_* values
npx expo prebuild --clean
```

## Local dev

```bash
npx expo start --ios          # Expo Go (limited — no native modules)
npx expo run:ios              # dev client (full features)
```

## Build & deploy

```bash
eas build --profile production --platform ios --auto-submit
```

## Code map

- `App.js` — root, navigation, auth bootstrap, theme/safearea wrappers
- `src/screens/` — top-level screens (Activity, MonCorps, Profil, ProfileOnboarding, …)
- `src/components/ui/` — Liquid Glass primitives (GlassView / GlassCard / GlassButton / GlassSheet / GlassPressable)
- `src/components/` — VideoPlayer, HeartRatePill, ActivityRings, DownloadManager, …
- `src/hooks/` — useLiveHeartRate
- `src/theme/` — ThemeProvider + dark/light palettes
- `src/utils/` — videoUrl (signed Bunny), profileSync, healthkit wrapper
- `supabase/functions/sign-video-url/` — Edge function that mints signed Bunny URLs after subscription check
- `supabase/migrations/` — Postgres schema (`video_assets`, `profiles` fields, RLS)

## Conventions

- **No `console.log` in prod paths** — wrap in `if (__DEV__)` or use `devLog` / `devWarn` helpers
- **No clear Bunny URLs in `src/constants/data.js`** — set the video flag to `true`; the client fetches the signed URL via the `sign-video-url` edge function
- **All glass surfaces** must use the `<GlassView>` primitive — never raw `BlurView`
- **PR-friendly**: CI checks for `SafeAreaProvider` at root, `__DEV__` console guards, and no clear Bunny URLs

## CI

GitHub Actions runs on every PR to `main` and on push to `main`. Guards:

- Dependency install (`npm ci`)
- `tsc --noEmit` (informational — the tsconfig is intentionally lax)
- `expo-doctor` (dependency/Expo SDK compatibility)
- No bare `console.log/warn/info` in `App.js`, `src/`, or `components/` (must be `__DEV__`-guarded or via `devLog`/`devWarn`)
- No clear Bunny CDN host in `src/constants/data.js`
- `App.js` parses as JSX
- `<SafeAreaProvider>` present at the root of `App.js`

Dependabot opens grouped npm + GitHub Actions update PRs weekly.

## License

Proprietary. © Espace Pilates Sarl.
