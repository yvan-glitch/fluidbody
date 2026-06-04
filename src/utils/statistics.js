// Statistics aggregation — single funnel that gathers every signal the
// advanced stats dashboard needs: pillar progression, activity calendar,
// streak history, weekly/monthly ring snapshots, HealthKit heart-rate
// trends, and unlocked milestones.
//
// Design notes:
//   • All sources are read in parallel via Promise.all so the screen mounts
//     fast. HealthKit reads are gated by `healthkit.isHealthKitReady()` —
//     when it's not available we still return a fully-shaped object with
//     zeros, so the screen doesn't need to branch on `null`.
//   • A 60-second in-memory cache (`getCachedStatistics`) keeps scrolling
//     and the count-up animations from re-triggering work. The cache key
//     is the user id (or 'anonymous') so signing in/out invalidates.
//   • The shape is frozen at the top of this file as a JSDoc comment so
//     the chart components can rely on it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import healthkit from './health';
import { getPiliers, getSeances } from '../utils';
import { readCachedProfile } from './profileSync';

const CACHE_TTL_MS = 60 * 1000;
const _cache = new Map(); // key -> { ts, value }

/**
 * @typedef {Object} StatisticsSnapshot
 * @property {Object} header
 *   @property {number} header.totalSessions
 *   @property {number} header.streakCurrent
 *   @property {number} header.activeMonths   - distinct YYYY-MM with ≥1 séance
 *   @property {number} header.totalMinutes
 *   @property {string|null} header.memberSince - ISO date string
 * @property {Array<{key,label,color,done,total,pct,lastDate}>} piliers
 * @property {Object} rings
 *   @property {Array<{date,moveKcal,exerciseMin,standHours}>} rings.week
 *   @property {Array<{startDate,endDate,closedDays,totalDays}>} rings.monthly
 *   @property {{move:number,exercise:number,stand:number}} rings.goals
 * @property {Object} hr
 *   @property {boolean} hr.available
 *   @property {Array<{date,avgHr,maxHr}>} hr.daily30
 *   @property {number|null} hr.restingAvg
 *   @property {number|null} hr.activeAvg
 *   @property {number|null} hr.maxOverall
 * @property {Object} badges
 *   @property {Array<{key,label,emoji,unlocked,target,current}>} badges.list
 *   @property {number} badges.unlockedCount
 */

function todayDateKey(d) {
  const x = d instanceof Date ? d : new Date();
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}

function startOfWeekMonday(d) {
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDuration(label) {
  // Accept "12 min", "1'59''", "2 min 10 s", "45 min"
  if (!label || typeof label !== 'string') return 0;
  // Pattern: digits min
  const minMatch = label.match(/(\d+)\s*min/);
  if (minMatch) {
    const min = parseInt(minMatch[1], 10) || 0;
    const sMatch = label.match(/(\d+)\s*s\b/);
    const s = sMatch ? parseInt(sMatch[1], 10) || 0 : 0;
    return min + s / 60;
  }
  // Pattern: 1'59''  or  2'10''
  const apostrophe = label.match(/(\d+)\s*'\s*(\d+)?/);
  if (apostrophe) {
    const m = parseInt(apostrophe[1], 10) || 0;
    const s = apostrophe[2] ? parseInt(apostrophe[2], 10) || 0 : 0;
    return m + s / 60;
  }
  return 0;
}

async function readActivityCalendar() {
  try {
    const raw = await AsyncStorage.getItem('fluid_activity_calendar');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) { return {}; }
}

async function readSeanceCompletionDates(done, piliers, seances) {
  // The Supabase `progression` row is just `done[pilier][idx] = bool`,
  // no per-seance timestamp. The closest "when did the user do this"
  // proxy is the activity calendar (per-day session count) + the
  // fluid_done_<key>_<idx>_at AsyncStorage entries when we have them.
  // For now we return the calendar; a per-session timestamp ledger is
  // tracked as a follow-up.
  const cal = await readActivityCalendar();
  let mostRecent = null;
  Object.keys(cal).forEach(function (k) {
    if (!mostRecent || k > mostRecent) mostRecent = k;
  });
  // Per-pilier last activity proxy: just the last activity date — the
  // app doesn't yet tag completion by pilier in storage.
  const perPilier = {};
  piliers.forEach(function (p) { perPilier[p.key] = mostRecent; });
  return perPilier;
}

function computePiliersProgress(done, piliers, seances) {
  // 5 séances effective cap per pilier (matches the existing Progress UI
  // contract in MonCorps / Resume). We count any boolean-truthy entry.
  return piliers.map(function (p) {
    const total = (seances[p.key] || []).length || 20;
    const arr = done[p.key] || [];
    const doneCount = arr.filter(function (v) { return v === true || v === 'true'; }).length;
    const pct = total > 0 ? Math.min(100, Math.round((doneCount / total) * 100)) : 0;
    return {
      key: p.key,
      label: p.label,
      color: p.color,
      done: doneCount,
      total: total,
      pct: pct,
      lastDate: null, // filled in later
    };
  });
}

function colorForPct(pct) {
  // 0-25 red → 25-50 orange → 50-75 yellow → 75-100 green
  if (pct < 25) return '#FF4D4D';
  if (pct < 50) return '#FF8A2A';
  if (pct < 75) return '#FFD23F';
  return '#5DCE6F';
}

async function readRingsHistory(hkAvailable, goals) {
  if (!hkAvailable) {
    return { week: [], monthly: [] };
  }
  let history = [];
  try {
    history = await healthkit.readActivityHistory(30);
  } catch (e) {
    history = [];
  }
  if (!Array.isArray(history) || history.length === 0) {
    return { week: [], monthly: [] };
  }
  // Last 7 days: take the tail of the 30-day window — readActivityHistory
  // resolves oldest→newest, so slice(-7) is the most recent week.
  const week = history.slice(-7);

  // Monthly buckets: split the 30-day window into 4 ~7-day chunks ending
  // today. We report closed-rings-per-chunk + total days for the donut.
  const monthly = [];
  for (let i = 3; i >= 0; i--) {
    const chunkEnd = history.length - 1 - i * 7;
    const chunkStart = Math.max(0, chunkEnd - 6);
    if (chunkEnd < 0) continue;
    const slice = history.slice(chunkStart, chunkEnd + 1);
    let closedDays = 0;
    slice.forEach(function (d) {
      const moveOk = d.moveKcal >= goals.move;
      const exOk = d.exerciseMin >= goals.exercise;
      const standOk = d.standHours >= goals.stand;
      if (moveOk && exOk && standOk) closedDays++;
    });
    monthly.push({
      startDate: slice[0] ? slice[0].date : null,
      endDate: slice[slice.length - 1] ? slice[slice.length - 1].date : null,
      closedDays: closedDays,
      totalDays: slice.length,
    });
  }
  return { week: week, monthly: monthly };
}

async function readHeartRateTrends(hkAvailable) {
  if (!hkAvailable) {
    return { available: false, daily30: [], restingAvg: null, activeAvg: null, maxOverall: null };
  }
  // We avoid hammering HealthKit with 30 per-day queries on cold start —
  // readDayDetails does a 24-hour HR scan, so 30 of them is heavy. Strategy:
  // start with the most recent 14 days for the trend line; if HealthKit
  // proves fast we can bump this later.
  const tasks = [];
  const dates = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d);
    tasks.push(healthkit.readDayDetails(d).catch(function () {
      return { avgHr: null, maxHr: null };
    }));
  }
  const results = await Promise.all(tasks);
  const daily = results.map(function (r, i) {
    return {
      date: todayDateKey(dates[i]),
      avgHr: r && isFinite(r.avgHr) ? r.avgHr : null,
      maxHr: r && isFinite(r.maxHr) ? r.maxHr : null,
    };
  });
  let restingSum = 0, restingCount = 0;
  let activeSum = 0, activeCount = 0;
  let maxOverall = 0;
  daily.forEach(function (d) {
    if (d.avgHr != null && d.avgHr > 0) {
      // Rough proxy: avgHr captures full-day average, so it's closer to
      // "resting + light activity". Days when maxHr crossed 110 we count
      // as having had a real workout — the avg of those days lands in
      // "active". Below 110, we stash it as "resting".
      if (d.maxHr != null && d.maxHr >= 110) {
        activeSum += d.avgHr; activeCount++;
      } else {
        restingSum += d.avgHr; restingCount++;
      }
    }
    if (d.maxHr != null && d.maxHr > maxOverall) maxOverall = d.maxHr;
  });
  return {
    available: daily.some(function (d) { return d.avgHr != null; }),
    daily30: daily,
    restingAvg: restingCount > 0 ? Math.round(restingSum / restingCount) : null,
    activeAvg: activeCount > 0 ? Math.round(activeSum / activeCount) : null,
    maxOverall: maxOverall > 0 ? maxOverall : null,
  };
}

function computeBadges(totalSessions, streakCurrent, activeMonths, tr) {
  // 8 badges total — 4 about volume, 2 about consistency, 2 about depth.
  // `target` is what's needed; `current` is what the user has now.
  const defs = [
    { key: 'first',      label: tr.stats_badge_first       || 'Première séance',    iconKey: 'seedling',  target: 1,   current: totalSessions },
    { key: 'ten',        label: tr.stats_badge_ten         || '10 séances',         iconKey: 'lotus',     target: 10,  current: totalSessions },
    { key: 'thirty',     label: tr.stats_badge_thirty      || '30 séances',         iconKey: 'jellyfish', target: 30,  current: totalSessions },
    { key: 'hundred',    label: tr.stats_badge_hundred     || '100 séances',        iconKey: 'trophy',    target: 100, current: totalSessions },
    { key: 'streak3',    label: tr.stats_badge_streak3     || 'Streak 3 jours',     iconKey: 'flame',     target: 3,   current: streakCurrent },
    { key: 'streak30',   label: tr.stats_badge_streak30    || 'Streak 30 jours',    iconKey: 'lightning', target: 30,  current: streakCurrent },
    { key: 'months3',    label: tr.stats_badge_months3     || '3 mois actifs',      iconKey: 'wave',      target: 3,   current: activeMonths },
    { key: 'months12',   label: tr.stats_badge_months12    || '12 mois actifs',     iconKey: 'star',      target: 12,  current: activeMonths },
  ];
  let unlocked = 0;
  const list = defs.map(function (d) {
    const u = d.current >= d.target;
    if (u) unlocked++;
    return Object.assign({}, d, { unlocked: u });
  });
  return { list: list, unlockedCount: unlocked };
}

/**
 * Compute the full statistics snapshot.
 *
 * @param {Object} args
 * @param {Object} args.done       - the {pilierKey: bool[]} progression map
 * @param {string} args.lang       - 'fr' | 'en' | 'es' | 'it'
 * @param {Object} args.tr         - translation map (T[lang])
 * @param {Object} [args.supaUser] - the Supabase auth user, optional
 * @returns {Promise<StatisticsSnapshot>}
 */
export async function computeStatistics(args) {
  const done = (args && args.done) || {};
  const lang = (args && args.lang) || 'fr';
  const tr = (args && args.tr) || {};
  const supaUser = (args && args.supaUser) || null;

  const piliers = getPiliers(lang);
  const seances = getSeances(lang);

  // ── Fire everything in parallel ──
  const hkReady = typeof healthkit.isHealthKitReady === 'function' && healthkit.isHealthKitReady();
  const goalsDefault = { move: 350, exercise: 30, stand: 12 };

  // Read the profile cache once — both the ring goals and `memberSince`
  // fallback need it. Then fan out the heavy reads in parallel.
  const cachedProfile = await readCachedProfile().catch(function () { return null; });
  const goals = Object.assign({}, goalsDefault);
  if (cachedProfile) {
    if (isFinite(cachedProfile.ring_goal_move_kcal) && cachedProfile.ring_goal_move_kcal > 0) goals.move = cachedProfile.ring_goal_move_kcal;
    if (isFinite(cachedProfile.ring_goal_exercise_min) && cachedProfile.ring_goal_exercise_min > 0) goals.exercise = cachedProfile.ring_goal_exercise_min;
    if (isFinite(cachedProfile.ring_goal_stand_hours) && cachedProfile.ring_goal_stand_hours > 0) goals.stand = cachedProfile.ring_goal_stand_hours;
  }

  const [
    cal,
    perPilierLast,
    ringsHistory,
    hrTrends,
  ] = await Promise.all([
    readActivityCalendar(),
    readSeanceCompletionDates(done, piliers, seances),
    readRingsHistory(hkReady, goals).then(function (r) { return Object.assign(r, { goals: goals }); }),
    readHeartRateTrends(hkReady),
  ]);

  // ── Header KPIs ──
  let totalSessions = 0;
  Object.values(done).forEach(function (arr) {
    if (Array.isArray(arr)) arr.forEach(function (v) { if (v === true || v === 'true') totalSessions++; });
  });

  // Active months: distinct YYYY-MM in the activity calendar (any count > 0)
  const monthSet = new Set();
  Object.keys(cal).forEach(function (k) {
    if (typeof k === 'string' && k.length >= 7 && cal[k] > 0) {
      monthSet.add(k.slice(0, 7));
    }
  });
  const activeMonths = monthSet.size;

  // Total minutes: sum of fluid_exercise_<YYYY-MM-DD> keys (best effort,
  // up to 365 entries scanned). If that yields 0 we fall back to a
  // session-time estimate from the séance label durations.
  let totalMinutes = 0;
  try {
    const keys = await AsyncStorage.getAllKeys();
    const exKeys = keys.filter(function (k) { return k.indexOf('fluid_exercise_') === 0; });
    const pairs = await AsyncStorage.multiGet(exKeys);
    pairs.forEach(function (p) {
      const v = parseInt(p[1], 10);
      if (isFinite(v)) totalMinutes += v;
    });
  } catch (e) {}
  if (totalMinutes === 0 && totalSessions > 0) {
    // Estimate from labels: sum duration of every done seance.
    Object.keys(done).forEach(function (pk) {
      const arr = done[pk];
      const ps = seances[pk] || [];
      if (!Array.isArray(arr)) return;
      arr.forEach(function (v, i) {
        if (v === true || v === 'true') {
          const label = ps[i] && ps[i][1];
          totalMinutes += parseDuration(label);
        }
      });
    });
    totalMinutes = Math.round(totalMinutes);
  }

  // Streak: pulled from AsyncStorage (the authoritative seance streak).
  let streakCurrent = 0;
  try {
    const s = await AsyncStorage.getItem('fluid_streak_seance_count');
    streakCurrent = parseInt(s, 10) || 0;
  } catch (e) {}

  // Member since: prefer supaUser.created_at, fall back to onboarding date.
  let memberSince = null;
  if (supaUser && supaUser.created_at) {
    memberSince = supaUser.created_at;
  } else if (cachedProfile && cachedProfile.onboarding_completed_at) {
    memberSince = cachedProfile.onboarding_completed_at;
  }

  // Pillar progress, with per-pilier last activity merged in.
  const piliersProgress = computePiliersProgress(done, piliers, seances).map(function (p) {
    return Object.assign({}, p, { lastDate: perPilierLast[p.key] || null });
  });

  const badges = computeBadges(totalSessions, streakCurrent, activeMonths, tr);

  return Object.freeze({
    header: {
      totalSessions: totalSessions,
      streakCurrent: streakCurrent,
      activeMonths: activeMonths,
      totalMinutes: totalMinutes,
      memberSince: memberSince,
    },
    piliers: piliersProgress,
    rings: ringsHistory,
    hr: hrTrends,
    badges: badges,
  });
}

/**
 * Cached variant — same shape, but reuses the snapshot for 60 seconds per
 * user. Pass `{ force: true }` to bypass.
 */
export async function getCachedStatistics(args) {
  const force = !!(args && args.force);
  const userKey = (args && args.supaUser && args.supaUser.id) || 'anonymous';
  const cached = _cache.get(userKey);
  const now = Date.now();
  if (!force && cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.value;
  }
  const value = await computeStatistics(args);
  _cache.set(userKey, { ts: now, value: value });
  return value;
}

export function invalidateStatisticsCache() {
  _cache.clear();
}

// Re-exported helpers for chart code.
export { colorForPct, todayDateKey, startOfWeekMonday };
