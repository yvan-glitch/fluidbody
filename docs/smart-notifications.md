# Smart Notifications — Pause Active suppression (MVP)

> Status: MVP shipped. Skips the hourly "Pause Active au bureau" reminders on
> days where HealthKit reports the user has already been moving.

## Spec — thresholds (OR logic, current calendar day)

A user counts as **already active** as soon as any of these is crossed:

| Signal | Threshold | HealthKit source |
|---|---|---|
| Steps | > 8 000 | `StepCount` (via `readDayDetails`) |
| Active Energy | > 250 kcal | `ActiveEnergyBurned` (via `readActivitySummary.moveKcal`) |
| Stand Hours | > 6 | `AppleStandTime` (via `readActivitySummary.standHours`) |

Tweaks live in `src/utils/activityCheck.js` (`ACTIVITY_THRESHOLDS`).

## Behaviour

1. **App foreground** (and once on cold start, 1.6 s deferred): probe HealthKit
   → if active, cancel today's remaining pause notifs.
2. **Session ended with ≥ 80 % of the video watched**: cancel pause notifs
   scheduled in the next 3 hours.
3. **Cold start the next day**: the existing `setupNotifications()` (App.js)
   re-schedules everything from scratch — nothing to do.

### Throttle

HealthKit probes are limited to **one per 30 minutes** per device, persisted
via AsyncStorage key `fluid_last_activity_check`. Prevents the bridge from
being hit on every foreground bounce.

## Implementation map

| Layer | File | What |
|---|---|---|
| Notification tagging | `App.js:1256-1276` (`setupNotifications`) | Adds `data: { type: 'pause_active', scheduledHour, scheduledWeekday }` to each pre-scheduled notif. |
| HealthKit probe | `src/utils/activityCheck.js` | `isUserAlreadyActive()` reads steps/energy/stand and compares to thresholds. Returns `{ active, reason, values }` with safe fallback. |
| Selective cancel | `src/utils/notifications.js` (`cancelPauseActiveNotifications`) | Enumerates scheduled notifs, filters by `data.type === 'pause_active'` + scope ('today' or 'next3h'), cancels matches. Returns the cancelled count. |
| Foreground trigger | `App.js` `MainApp` `useEffect` | AppState listener — on `'active'` (and once after mount), invokes `maybeSuppress`. Honours the 30-min throttle. |
| Session-end trigger | `src/components/VideoPlayer.js` (Terminer button) | If `hasRealVideo && positionMillis / durationMillis ≥ 0.8`, calls `cancelPauseActiveNotifications('next3h')`. Theory sessions skipped. |

## MVP limitations (accepted, to revisit)

- **App never opens**: if the user is active but never opens FluidBody+ during
  the day, iOS still fires the pre-scheduled notifs. Acceptable because the
  user can't see the app suggesting a break if they don't open it anyway, but
  ideally a v1.1 should run a background fetch task.
- **HealthKit lag**: HK syncs Watch samples with seconds-to-minutes delay. A
  user who just hit 8 001 steps may still get the next-hour notif if the
  foreground happens before the sync. Tolerable for MVP.
- **No per-user threshold tuning**: thresholds are hard-coded. UI surface
  (Profil > Notifications) deferred until we collect feedback on the defaults.
- **`activeEnergy` includes all sources**: workouts logged by other apps
  (Strava, Nike) count too. By design.
- **Throttle is per-device**: 30 min across all foreground bumps. No per-tab,
  no debouncing within a session.

## Test plan (manual, device)

1. **No regression** — HK returns zeros (clean install or HK denied) →
   foreground does NOT cancel anything. Console: no `[SmartNotif]` log.
2. **Active by steps** — manually set steps > 8 000 in HK or wait for Watch
   sync → next foreground logs `[SmartNotif] foreground — cancelled N pause
   notifs (reason: steps)`. Verify via Settings → Notifications → FluidBody+
   that today's remaining hourly pause notifs are gone.
3. **HK not authorised** — revoke HK permission → no crash, no console log,
   notifs continue firing on schedule.
4. **Session end ≥ 80 %** — watch a real video to ≥ 80 % then tap "Terminer"
   → console logs `cancelled N` for `next3h`. Re-check
   `getAllScheduledNotificationsAsync()` count from Reactotron / Sentry.
5. **Session end < 80 %** — skip to 30 % then tap Terminer → NO cancel.
   Theory sessions (Comprendre / Ressentir) → NO cancel even at 100 %.
6. **Throttle** — foreground twice in 10 minutes → only the first probe runs.
   AsyncStorage key `fluid_last_activity_check` shows a single timestamp.
   Wait 30 min then foreground → probe runs again.

## Owner / future work

- Owner: Yvan / Sabrina (product).
- Next iteration: configurable thresholds in Profil + background-fetch task
  for the "user never opens app" case.
