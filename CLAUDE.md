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

## Metro Config

`metro.config.js` adds Node.js polyfills (`node-libs-react-native`) for Supabase compatibility, with mock `net`/`tls`.

## Notes

- The `my-app/` directory is an unrelated Expo Router scaffold (not part of the main app)
- The `docs/` directory contains a landing page (`index.html`)
- App language: code comments and variable names are primarily in French
