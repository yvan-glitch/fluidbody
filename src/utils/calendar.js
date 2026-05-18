// Apple Calendar integration.
//
// Goal: let the user opt-in to auto-schedule their Fluidbody sessions in
// their native iOS calendar. A real calendar event is harder to ignore
// than a push notification, which boosts adherence.
//
// Public surface (all functions are no-op on Android / Expo Go / web):
//   • requestCalendarPermission()        → boolean
//   • getDefaultCalendarId()             → calendar id (string) | null
//   • listWritableCalendars()            → [{ id, title, source, color, isPrimary }]
//   • scheduleSession(opts)              → eventId | null
//   • scheduleProgram({ program, ... })  → { eventIds, count }
//   • unscheduleProgram(programId)       → number of events removed
//   • getUpcomingFluidbodyEvents(days?)  → array of native events
//
// Convention: every event we create stores `[Fluidbody:<programId>:<sessionId>]`
// in its `notes` field so we can find and remove our own events later
// without touching anything the user (or another app) created.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeNativeCall } from './safeNativeCall';

let Calendar = null;
try { Calendar = require('expo-calendar'); } catch (e) {}

const CALENDAR_PREFS_KEY = 'fluid_calendar_prefs_v1';
const FLUIDBODY_TAG = 'Fluidbody';

export function isCalendarAvailable() {
  return !!Calendar && Platform.OS !== 'web';
}

function tagFor(programId, sessionId) {
  return '[' + FLUIDBODY_TAG + ':' + (programId || 'free') + ':' + (sessionId || 'session') + ']';
}

function parseTag(notes) {
  if (!notes || typeof notes !== 'string') return null;
  const m = notes.match(/\[Fluidbody:([^:\]]+):([^\]]+)\]/);
  if (!m) return null;
  return { programId: m[1], sessionId: m[2] };
}

// ───────── Permission ─────────

export async function requestCalendarPermission() {
  if (!isCalendarAvailable()) return false;
  const status = await safeNativeCall('calendar.requestPermissionsAsync', function () {
    return Calendar.requestCalendarPermissionsAsync();
  }, null);
  if (!status) return false;
  return status.status === 'granted';
}

export async function getCalendarPermissionStatus() {
  if (!isCalendarAvailable()) return 'unavailable';
  const status = await safeNativeCall('calendar.getPermissionsAsync', function () {
    return Calendar.getCalendarPermissionsAsync();
  }, null);
  return (status && status.status) || 'undetermined';
}

// ───────── Calendars ─────────

async function getAllCalendars() {
  if (!isCalendarAvailable()) return [];
  const cals = await safeNativeCall('calendar.getCalendarsAsync', function () {
    return Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  }, []);
  return Array.isArray(cals) ? cals : [];
}

export async function listWritableCalendars() {
  const cals = await getAllCalendars();
  return cals
    .filter(function (c) { return c && c.allowsModifications !== false; })
    .map(function (c) {
      return {
        id: c.id,
        title: c.title || 'Calendar',
        source: (c.source && (c.source.name || c.source.type)) || '',
        color: c.color || null,
        isPrimary: !!c.isPrimary,
      };
    });
}

export async function getDefaultCalendarId() {
  if (!isCalendarAvailable()) return null;
  // Honour an explicit user choice first.
  try {
    const prefs = await getCalendarPrefs();
    if (prefs && prefs.calendarId) {
      const all = await getAllCalendars();
      const exists = all.some(function (c) { return c.id === prefs.calendarId && c.allowsModifications !== false; });
      if (exists) return prefs.calendarId;
    }
  } catch (e) {}
  // iOS: getDefaultCalendarAsync returns the system default. Fall back to the
  // first writable iCloud calendar, then to anything writable.
  if (Platform.OS === 'ios') {
    const def = await safeNativeCall('calendar.getDefaultCalendarAsync', function () {
      return Calendar.getDefaultCalendarAsync();
    }, null);
    if (def && def.id && def.allowsModifications !== false) return def.id;
  }
  const cals = await getAllCalendars();
  const icloud = cals.find(function (c) {
    return c.allowsModifications !== false && c.source && /icloud/i.test(c.source.name || '');
  });
  if (icloud) return icloud.id;
  const anyWritable = cals.find(function (c) { return c.allowsModifications !== false; });
  return anyWritable ? anyWritable.id : null;
}

// ───────── Preferences ─────────

const DEFAULT_PREFS = {
  enabled: false,
  preferredHour: 18,
  defaultDurationMin: 20,
  calendarId: null,
  weekdays: [1, 3, 5], // Mon, Wed, Fri — index 1..7 matching JOUR_LABELS
};

export async function getCalendarPrefs() {
  try {
    const raw = await AsyncStorage.getItem(CALENDAR_PREFS_KEY);
    if (!raw) return Object.assign({}, DEFAULT_PREFS);
    const parsed = JSON.parse(raw);
    return Object.assign({}, DEFAULT_PREFS, parsed || {});
  } catch (e) { return Object.assign({}, DEFAULT_PREFS); }
}

export async function setCalendarPrefs(patch) {
  const current = await getCalendarPrefs();
  const next = Object.assign({}, current, patch || {});
  try { await AsyncStorage.setItem(CALENDAR_PREFS_KEY, JSON.stringify(next)); } catch (e) {}
  return next;
}

// ───────── Scheduling ─────────

function parseDurationMin(durStr) {
  if (typeof durStr === 'number') return durStr;
  if (!durStr || typeof durStr !== 'string') return null;
  // Matches "20 min", "2 min 10 s", "1'59''", "10 min"
  const minMatch = durStr.match(/(\d+)\s*min/i);
  if (minMatch) return parseInt(minMatch[1], 10);
  const apos = durStr.match(/^(\d+)['′]/);
  if (apos) return parseInt(apos[1], 10);
  return null;
}

// scheduleSession({ date, durationMin, title, pillarName, programId, sessionId, calendarId })
export async function scheduleSession(opts) {
  if (!isCalendarAvailable()) return null;
  const o = opts || {};
  const calId = o.calendarId || await getDefaultCalendarId();
  if (!calId) return null;
  const startDate = o.date instanceof Date ? o.date : new Date(o.date);
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) return null;
  const dur = Math.max(5, parseInt(o.durationMin, 10) || 20);
  const endDate = new Date(startDate.getTime() + dur * 60 * 1000);
  const tag = tagFor(o.programId, o.sessionId);
  const title = o.title || (o.pillarName ? ('Fluidbody — ' + o.pillarName) : 'Fluidbody');
  const notes = (o.notes ? (o.notes + '\n\n') : '') + tag;
  const eventId = await safeNativeCall('calendar.createEventAsync', function () {
    return Calendar.createEventAsync(calId, {
      title: title,
      startDate: startDate,
      endDate: endDate,
      notes: notes,
      alarms: [{ relativeOffset: -10 }], // 10 min before
      timeZone: undefined,
    });
  }, null);
  return eventId || null;
}

// scheduleProgram({ program, programId, preferredHour, defaultDurationMin, weeks, calendarId, pillarLabelFor, titleTemplate })
//
//   - program: { piliers: ['p1', ...], duree: '20 min', selectedDays: [1..7], notifHour, schedule? }
//     If `program.schedule` (from the algorithmic-programs sprint) is present, we
//     use it directly as the source of truth — list of { dayIndex, pillarKey, sessionId, dateISO? }.
//     Otherwise we synthesise N weeks of slots from `selectedDays` + `preferredHour`.
//   - weeks: how many weeks forward to create events for. Default 4.
//   - pillarLabelFor: (pillarKey) => human label (e.g. via getPiliers)
export async function scheduleProgram(opts) {
  if (!isCalendarAvailable()) return { eventIds: [], count: 0 };
  const o = opts || {};
  const program = o.program || {};
  const programId = o.programId || program.id || ('prog_' + String(program.date || Date.now()));
  const calendarId = o.calendarId || await getDefaultCalendarId();
  if (!calendarId) return { eventIds: [], count: 0 };
  const prefs = await getCalendarPrefs();
  const hour = clampHour(o.preferredHour != null ? o.preferredHour : (program.notifHour != null ? program.notifHour : prefs.preferredHour));
  const durationMin = Math.max(5, parseInt(o.defaultDurationMin, 10) || parseDurationMin(program.duree) || prefs.defaultDurationMin || 20);
  const weeks = Math.max(1, Math.min(12, parseInt(o.weeks, 10) || 4));
  const labelFor = typeof o.pillarLabelFor === 'function' ? o.pillarLabelFor : function (k) { return k; };
  const titleTemplate = typeof o.titleTemplate === 'function'
    ? o.titleTemplate
    : function (pillarLabel) { return 'Fluidbody — ' + pillarLabel; };

  // Build the list of { date, pillarKey, sessionId }.
  const slots = [];

  if (Array.isArray(program.schedule) && program.schedule.length > 0) {
    // Honour an explicit schedule when provided (feat/programs-algorithmic).
    for (let i = 0; i < program.schedule.length; i++) {
      const entry = program.schedule[i];
      if (!entry) continue;
      let date = entry.dateISO ? new Date(entry.dateISO) : null;
      if (!date || isNaN(date.getTime())) {
        // dayIndex is 0..N → schedule one per day from today.
        const di = typeof entry.dayIndex === 'number' ? entry.dayIndex : i;
        date = new Date();
        date.setHours(hour, 0, 0, 0);
        date.setDate(date.getDate() + di);
      }
      slots.push({
        date: date,
        pillarKey: entry.pillarKey || (program.piliers && program.piliers[i % program.piliers.length]),
        sessionId: entry.sessionId || ('s' + i),
      });
    }
  } else {
    // Synthesise from selectedDays.
    const selectedDays = Array.isArray(program.selectedDays) && program.selectedDays.length > 0
      ? program.selectedDays
      : (Array.isArray(o.weekdays) ? o.weekdays : prefs.weekdays);
    const piliers = Array.isArray(program.piliers) && program.piliers.length > 0 ? program.piliers : ['p1'];
    let pillarRR = 0;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < selectedDays.length; d++) {
        const wd = selectedDays[d]; // 1..7 (1=Mon, 7=Sun)
        const date = nextOccurrenceOfWeekday(wd, hour, w);
        if (!date) continue;
        slots.push({
          date: date,
          pillarKey: piliers[pillarRR % piliers.length],
          sessionId: 'w' + w + 'd' + wd,
        });
        pillarRR += 1;
      }
    }
  }

  // Sort + dedupe: skip events already created for the same programId+sessionId.
  const existing = await getUpcomingFluidbodyEvents(7 * weeks + 7);
  const existingKeys = new Set();
  for (let i = 0; i < existing.length; i++) {
    const t = parseTag((existing[i] && existing[i].notes) || '');
    if (t && t.programId === programId) existingKeys.add(t.sessionId);
  }

  const eventIds = [];
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s || existingKeys.has(s.sessionId)) continue;
    const id = await scheduleSession({
      date: s.date,
      durationMin: durationMin,
      title: titleTemplate(labelFor(s.pillarKey)),
      pillarName: labelFor(s.pillarKey),
      programId: programId,
      sessionId: s.sessionId,
      calendarId: calendarId,
    });
    if (id) eventIds.push(id);
  }
  return { eventIds: eventIds, count: eventIds.length };
}

function clampHour(h) {
  const n = parseInt(h, 10);
  if (isNaN(n)) return 18;
  return Math.max(5, Math.min(22, n));
}

// weekday: 1=Mon..7=Sun (matches our JOUR_LABELS index). Returns a Date at
// the next occurrence of that weekday at `hour`, offset by `weekOffset`
// additional weeks.
function nextOccurrenceOfWeekday(weekday, hour, weekOffset) {
  const now = new Date();
  // JS getDay: 0=Sun..6=Sat. Our weekday: 1=Mon..7=Sun. Convert:
  const jsTarget = (weekday === 7) ? 0 : weekday; // 1..6 -> 1..6 (Mon..Sat), 7 -> 0 (Sun)
  const todayJs = now.getDay();
  let delta = jsTarget - todayJs;
  const candidate = new Date(now);
  candidate.setHours(hour, 0, 0, 0);
  if (delta < 0 || (delta === 0 && candidate.getTime() <= now.getTime())) delta += 7;
  candidate.setDate(candidate.getDate() + delta + (weekOffset || 0) * 7);
  return candidate;
}

// ───────── Listing / removing our own events ─────────

export async function getUpcomingFluidbodyEvents(daysAhead) {
  if (!isCalendarAvailable()) return [];
  const ok = (await getCalendarPermissionStatus()) === 'granted';
  if (!ok) return [];
  const cals = await getAllCalendars();
  if (cals.length === 0) return [];
  const calIds = cals.map(function (c) { return c.id; });
  const now = new Date();
  const end = new Date(now.getTime() + Math.max(1, daysAhead || 60) * 86400000);
  const events = await safeNativeCall('calendar.getEventsAsync', function () {
    return Calendar.getEventsAsync(calIds, now, end);
  }, []);
  if (!Array.isArray(events)) return [];
  return events.filter(function (e) { return e && parseTag(e.notes) !== null; });
}

export async function unscheduleProgram(programId) {
  if (!isCalendarAvailable() || !programId) return 0;
  const events = await getUpcomingFluidbodyEvents(365);
  let removed = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const t = parseTag(e && e.notes);
    if (!t || t.programId !== programId) continue;
    const ok = await safeNativeCall('calendar.deleteEventAsync', (function (id_) {
      return function () { return Calendar.deleteEventAsync(id_); };
    })(e.id), false);
    if (ok !== false) removed += 1;
  }
  return removed;
}

// Removes every future Fluidbody event regardless of programId. Used when the
// user toggles the sync off.
export async function unscheduleAllFluidbody() {
  if (!isCalendarAvailable()) return 0;
  const events = await getUpcomingFluidbodyEvents(365);
  let removed = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e || !parseTag(e.notes)) continue;
    const ok = await safeNativeCall('calendar.deleteEventAsync.all', (function (id_) {
      return function () { return Calendar.deleteEventAsync(id_); };
    })(e.id), false);
    if (ok !== false) removed += 1;
  }
  return removed;
}

// ───────── Smart suggestion ─────────
// Derive 3 likely slots in the week from the user's session-hour history or
// fluid_notif_hour. The caller can show them to the user before scheduling.
export async function suggestWeeklySlots(opts) {
  const prefs = await getCalendarPrefs();
  const o = opts || {};
  let hour = clampHour(o.preferredHour != null ? o.preferredHour : prefs.preferredHour);
  if (o.preferredHour == null) {
    try {
      const notifH = await AsyncStorage.getItem('fluid_notif_hour');
      if (notifH) {
        const h = parseInt(notifH, 10);
        if (!isNaN(h)) hour = clampHour(h);
      }
    } catch (e) {}
  }
  const weekdays = (Array.isArray(o.weekdays) && o.weekdays.length > 0) ? o.weekdays : [1, 3, 5];
  return {
    preferredHour: hour,
    weekdays: weekdays.slice().sort(function (a, b) { return a - b; }),
    durationMin: o.defaultDurationMin || prefs.defaultDurationMin || 20,
  };
}

export default {
  isCalendarAvailable,
  requestCalendarPermission,
  getCalendarPermissionStatus,
  listWritableCalendars,
  getDefaultCalendarId,
  getCalendarPrefs,
  setCalendarPrefs,
  scheduleSession,
  scheduleProgram,
  unscheduleProgram,
  unscheduleAllFluidbody,
  getUpcomingFluidbodyEvents,
  suggestWeeklySlots,
};
