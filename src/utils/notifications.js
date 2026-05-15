// Smart notifications layer.
//
// The base `setupNotifications` in App.js handles the always-on stack (daily
// reminder, daily Sabrina quote, weekday active breaks, welcome). This module
// adds the *adaptive* layer:
//
//   • recordSessionHour     — call after each completed séance; pushes the
//                             local hour into a 14-day ring buffer.
//   • getPreferredHour      — median hour from that ring. Falls back to 18.
//   • scheduleStreakProtectionToday — if the user has a hot streak and hasn't
//                             trained yet today, schedule a 21h one-shot push.
//   • schedulePostOnboardingNudge — 24h after first launch, "Sabrina t'attend".
//   • scheduleMilestoneReward — fires immediately when a milestone is hit;
//                             non-disruptive, treats it as a local toast push.
//
// All calls degrade silently when expo-notifications isn't available
// (Expo Go on a simulator, web, etc.). No throw, no Sentry noise.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/data';
import { safeNativeCall } from './safeNativeCall';

let Notifications = null;
let Device = null;
try { Notifications = require('expo-notifications'); } catch (e) {}
try { Device = require('expo-device'); } catch (e) {}

const HOURS_KEY = 'fluid_session_hours_v1';
const DEFAULT_HOUR = 18;
const STREAK_PROT_ID_KEY = 'fluid_streak_prot_notif_id';
const ONBOARDING_NUDGE_KEY = 'fluid_post_onboarding_nudge_scheduled';
const ONBOARDING_FIRST_OPEN_KEY = 'fluid_first_open_ts';

function isReady() {
  if (!Notifications) return false;
  if (!Device) return false;
  try { return !!Device.isDevice; } catch (e) { return false; }
}

function trigType(name, fallback) {
  const T_ = Notifications && Notifications.SchedulableTriggerInputTypes;
  return (T_ && T_[name]) || fallback;
}

function trigDate(date) {
  return { type: trigType('DATE', 'date'), date: date };
}

function trigTimeInterval(seconds, repeats) {
  return { type: trigType('TIME_INTERVAL', 'timeInterval'), seconds: seconds, repeats: !!repeats };
}

// ───────── Preferred hour learning ─────────

export async function recordSessionHour(now) {
  if (!Notifications) {
    // Even without notifications, record so the learning catches up when the
    // user grants permission later.
  }
  try {
    const d = now || new Date();
    const hour = d.getHours();
    const ts = d.getTime();
    const raw = await AsyncStorage.getItem(HOURS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ h: hour, t: ts });
    // Keep last 14 days only.
    const cutoff = ts - 14 * 86400000;
    const trimmed = arr.filter(function (e) { return e && typeof e.t === 'number' && e.t >= cutoff; }).slice(-50);
    await AsyncStorage.setItem(HOURS_KEY, JSON.stringify(trimmed));
  } catch (e) {}
}

export async function getPreferredHour() {
  try {
    const raw = await AsyncStorage.getItem(HOURS_KEY);
    if (!raw) return DEFAULT_HOUR;
    const arr = JSON.parse(raw);
    const cutoff = Date.now() - 14 * 86400000;
    const hours = (arr || [])
      .filter(function (e) { return e && typeof e.t === 'number' && e.t >= cutoff; })
      .map(function (e) { return e.h; })
      .filter(function (h) { return typeof h === 'number' && h >= 0 && h <= 23; });
    if (hours.length < 3) return DEFAULT_HOUR;
    hours.sort(function (a, b) { return a - b; });
    return hours[Math.floor(hours.length / 2)];
  } catch (e) { return DEFAULT_HOUR; }
}

// ───────── Streak protection ─────────
// If the user has streak ≥ 3 and it's after 21h with no session today,
// schedule a one-shot push the same evening. We aim at the next minute so iOS
// fires it quickly. If the user has already trained today, no-op.

async function hasDoneSessionToday() {
  try {
    // Cheapest check: per-day exercise minute counter written by VideoPlayer
    // (`fluid_exercise_YYYY-MM-DD`).
    const key = 'fluid_exercise_' + new Date().toISOString().slice(0, 10);
    const raw = await AsyncStorage.getItem(key);
    return !!(raw && parseInt(raw, 10) > 0);
  } catch (e) { return false; }
}

export async function scheduleStreakProtectionToday({ streak, lang }) {
  if (!isReady()) return false;
  if (!streak || streak < 3) return false;
  const now = new Date();
  // Only fire between 21:00 and 22:59 — earlier feels nagging, later feels
  // useless (user is asleep).
  if (now.getHours() < 21 || now.getHours() > 22) return false;
  if (await hasDoneSessionToday()) return false;
  try {
    const perm = await safeNativeCall('notif.getPermissionsAsync.streakProt', function() { return Notifications.getPermissionsAsync(); }, null);
    if (!perm || perm.status !== 'granted') return false;
    // Avoid scheduling twice in the same evening.
    const existingId = await AsyncStorage.getItem(STREAK_PROT_ID_KEY);
    if (existingId) {
      const scheduled = await safeNativeCall('notif.getAllScheduled.streakProt', function() { return Notifications.getAllScheduledNotificationsAsync(); }, null);
      const stillThere = (scheduled || []).some(function (n) { return n.identifier === existingId; });
      if (stillThere) return false;
    }
    const tr = T[lang] || T.fr;
    const title = tr.notif_streak_prot_title || 'Garde ta série 🔥';
    const body = (tr.notif_streak_prot_body
      ? (typeof tr.notif_streak_prot_body === 'function' ? tr.notif_streak_prot_body(streak) : tr.notif_streak_prot_body)
      : `Tu en es à ${streak} jours. Une mini-séance de 5 min suffit pour la prolonger.`);
    const id = await safeNativeCall('notif.schedule.streakProt', function() {
      return Notifications.scheduleNotificationAsync({
        content: { title: title, body: body, sound: true },
        trigger: trigTimeInterval(60, false),
      });
    }, null);
    if (id == null) return false;
    await AsyncStorage.setItem(STREAK_PROT_ID_KEY, String(id));
    return true;
  } catch (e) { return false; }
}

// ───────── Post-onboarding nudge ─────────
// "Sabrina t'attend" — 24h after the user first opens the app, if they
// haven't started a session yet.

export async function schedulePostOnboardingNudge({ lang }) {
  if (!isReady()) return false;
  try {
    if (await AsyncStorage.getItem(ONBOARDING_NUDGE_KEY)) return false;
    const perm = await safeNativeCall('notif.getPermissionsAsync.nudge', function() { return Notifications.getPermissionsAsync(); }, null);
    if (!perm || perm.status !== 'granted') return false;
    const firstRaw = await AsyncStorage.getItem(ONBOARDING_FIRST_OPEN_KEY);
    let firstTs = firstRaw ? parseInt(firstRaw, 10) : 0;
    if (!firstTs) {
      firstTs = Date.now();
      await AsyncStorage.setItem(ONBOARDING_FIRST_OPEN_KEY, String(firstTs));
    }
    // Fire ~24h later. Clamp the trigger seconds to a sane range — if user
    // re-runs onboarding 48h after install we don't want to schedule in the
    // past (iOS rejects it).
    const elapsed = Math.floor((Date.now() - firstTs) / 1000);
    const target = 24 * 3600;
    const seconds = Math.max(60, target - elapsed);
    if (seconds > 72 * 3600) return false; // too late, skip
    const tr = T[lang] || T.fr;
    await safeNativeCall('notif.schedule.nudge', function() {
      return Notifications.scheduleNotificationAsync({
        content: {
          title: tr.notif_nudge_title || 'Sabrina t\'attend',
          body: tr.notif_nudge_body || '10 minutes suffisent pour découvrir ta première séance.',
          sound: false,
        },
        trigger: trigTimeInterval(seconds, false),
      });
    }, null);
    await AsyncStorage.setItem(ONBOARDING_NUDGE_KEY, '1');
    return true;
  } catch (e) { return false; }
}

// ───────── Milestone reward ─────────
// Fires an "in-app celebration" push when the user crosses a milestone count
// (7, 30, 100 sessions). Fires after a tiny delay so it lands as a banner
// just after the celebration modal in MainApp.

const MILESTONE_PUSH_TARGETS = [7, 30, 100];

export async function scheduleMilestoneReward({ milestoneNum, lang, prenom }) {
  if (!isReady()) return false;
  if (MILESTONE_PUSH_TARGETS.indexOf(milestoneNum) === -1) return false;
  try {
    const perm = await safeNativeCall('notif.getPermissionsAsync.milestone', function() { return Notifications.getPermissionsAsync(); }, null);
    if (!perm || perm.status !== 'granted') return false;
    const tr = T[lang] || T.fr;
    const titleFn = tr.notif_milestone_title;
    const bodyFn = tr.notif_milestone_body;
    const title = typeof titleFn === 'function' ? titleFn(milestoneNum, prenom) : (titleFn || `${milestoneNum} séances 🌟`);
    const body = typeof bodyFn === 'function' ? bodyFn(milestoneNum, prenom) : (bodyFn || 'Tu construis quelque chose de durable. Continue.');
    await safeNativeCall('notif.schedule.milestone', function() {
      return Notifications.scheduleNotificationAsync({
        content: { title: title, body: body, sound: false },
        trigger: trigTimeInterval(8, false),
      });
    }, null);
    return true;
  } catch (e) { return false; }
}

// ───────── Smart suppression — Pause Active ─────────
//
// The 45 pre-scheduled "pause active" weekly notifications (cf.
// setupNotifications in App.js) are tagged with `content.data.type
// === 'pause_active'`. This helper enumerates them and cancels those
// matching the requested `scope`.
//
//   scope === 'today'  → cancel every remaining pause notif whose next
//                        fire date is in the current calendar day
//   scope === 'next3h' → cancel every pause notif whose next fire date
//                        falls within the next 3 hours
//
// Returns the number of notifications actually cancelled (for logging).
// Safe to call concurrently; failures degrade silently to 0.
export async function cancelPauseActiveNotifications(scope) {
  if (!Notifications) return 0;
  try {
    const scheduled = await safeNativeCall(
      'notif.getAllScheduled.pauseSuppress',
      function () { return Notifications.getAllScheduledNotificationsAsync(); },
      null
    );
    if (!Array.isArray(scheduled) || scheduled.length === 0) return 0;

    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();
    const horizonMs = scope === 'next3h' ? 3 * 60 * 60 * 1000 : null;

    const inScope = function (fireDate) {
      if (!fireDate) return false;
      if (scope === 'today') {
        return (
          fireDate.getFullYear() === todayY
          && fireDate.getMonth() === todayM
          && fireDate.getDate() === todayD
          && fireDate.getTime() > now.getTime()
        );
      }
      if (scope === 'next3h') {
        const dt = fireDate.getTime() - now.getTime();
        return dt > 0 && dt <= horizonMs;
      }
      return false;
    };

    let cancelled = 0;
    for (let i = 0; i < scheduled.length; i++) {
      const n = scheduled[i];
      const data = (n && n.content && n.content.data) || {};
      if (data.type !== 'pause_active') continue;
      const fireDate = nextFireDateFor(n, now);
      if (!inScope(fireDate)) continue;
      const ok = await safeNativeCall(
        'notif.cancel.pauseSuppress',
        function () { return Notifications.cancelScheduledNotificationAsync(n.identifier); },
        false
      );
      if (ok !== false) cancelled += 1;
    }
    return cancelled;
  } catch (e) { return 0; }
}

// Compute the next fire date for a scheduled notification. Pauses use a
// WEEKLY trigger (weekday 1-7 where 1=Sunday, hour, minute). We rebuild
// the next occurrence from `now`. For non-weekly triggers (other notif
// types) we return null — the caller filters them out via `data.type`.
function nextFireDateFor(n, now) {
  const trigger = n && n.trigger;
  if (!trigger) return null;
  // Weekly trigger from expo-notifications exposes weekday/hour/minute.
  // expo-notifications uses 1=Sunday, 2=Monday, ..., 7=Saturday.
  const weekday = trigger.weekday;
  if (typeof weekday !== 'number') return null;
  const hour = typeof trigger.hour === 'number' ? trigger.hour : 0;
  const minute = typeof trigger.minute === 'number' ? trigger.minute : 0;
  // Map: JS Date.getDay() is 0=Sunday..6=Saturday → +1 to match Expo's weekday.
  const todayWeekdayExpo = now.getDay() + 1;
  let deltaDays = weekday - todayWeekdayExpo;
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);
  if (deltaDays < 0 || (deltaDays === 0 && candidate.getTime() <= now.getTime())) {
    deltaDays += 7;
  }
  candidate.setDate(candidate.getDate() + deltaDays);
  return candidate;
}
