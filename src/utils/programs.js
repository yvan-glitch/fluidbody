// programs — high-level CRUD + stats for user_programs.
//
// Thin wrapper over the Supabase table; the generator lives next door
// (`./programGenerator.js`). Screens consume the helpers in this file and
// shouldn't reach into the table directly — keeps the JSON shape contained.
//
// All helpers are tolerant of a null `supabase` client (Expo Go without
// env vars) and a missing `userId` — they no-op and return `{ ok: false }`
// so the UI can still render without crashing the home screen.

import { generateProgram, progressKey, nextSession, countCompleted } from './programGenerator';

// Hard cap to avoid runaway memory if the table grows weird. Aligned with
// the migration's `duration_weeks BETWEEN 1 AND 12`.
const MAX_DURATION_WEEKS = 12;
const MIN_DURATION_WEEKS = 1;
const MIN_SESSIONS_PER_WEEK = 1;
const MAX_SESSIONS_PER_WEEK = 7;

// Default program name fallback if the caller doesn't pass one. Localised
// labels live in i18n; this is the bare-minimum literal so the migration
// constraint (`name NOT NULL`) is never violated.
const DEFAULT_NAME = 'My program';

// ── Generation + persistence ───────────────────────────────────────────

// createProgram :: ({ supabase, userId, profile, goals, durationWeeks,
//   sessionsPerWeek, name, difficulty, start }) → { ok, program?, error? }
//
// `start` (default true): if true, sets started_at to now() so the program
// is immediately considered active. Pass false to "queue" a program for
// later activation.
export async function createProgram(opts) {
  const supabase = opts && opts.supabase;
  const userId = opts && opts.userId;
  if (!supabase) return { ok: false, error: 'no_supabase' };
  if (!userId) return { ok: false, error: 'no_user' };

  const profile = opts.profile || {};
  const goals = sanitizeGoals(opts.goals);
  const durationWeeks = clamp(opts.durationWeeks, MIN_DURATION_WEEKS, MAX_DURATION_WEEKS, 4);
  const sessionsPerWeek = clamp(opts.sessionsPerWeek, MIN_SESSIONS_PER_WEEK, MAX_SESSIONS_PER_WEEK, 3);
  const difficulty = normaliseDifficulty(opts.difficulty || profile.practice_level);

  const schedule = generateProgram({
    profile: { ...profile, practice_level: difficulty },
    goals,
    durationWeeks,
    sessionsPerWeek,
  });

  const insertPayload = {
    user_id: userId,
    name: (opts.name && String(opts.name).slice(0, 80)) || DEFAULT_NAME,
    goal: goals[0] || null,
    duration_weeks: durationWeeks,
    sessions_per_week: sessionsPerWeek,
    difficulty,
    schedule,
    progress: {},
    started_at: opts.start === false ? null : new Date().toISOString(),
  };

  try {
    const res = await supabase
      .from('user_programs')
      .insert(insertPayload)
      .select('*')
      .single();
    if (res.error) return { ok: false, error: res.error.message || String(res.error) };
    return { ok: true, program: res.data };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) };
  }
}

// ── Read paths ─────────────────────────────────────────────────────────

// listPrograms — newest first. Use case: MyPrograms screen.
export async function listPrograms(supabase, userId) {
  if (!supabase || !userId) return [];
  try {
    const res = await supabase
      .from('user_programs')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false });
    if (res.error) return [];
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    return [];
  }
}

// getActiveProgram — the most recently *started* program that isn't yet
// completed. Returns null when nothing is active so callers can render a
// "create your first program" empty state.
export async function getActiveProgram(supabase, userId) {
  if (!supabase || !userId) return null;
  try {
    const res = await supabase
      .from('user_programs')
      .select('*')
      .eq('user_id', userId)
      .not('started_at', 'is', null)
      .is('completed_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) return null;
    return res.data || null;
  } catch (e) {
    return null;
  }
}

// ── Write paths (progress) ─────────────────────────────────────────────

// markSessionDone — pose un état "done" (ou autre) sur un slot week/day.
// On lit le progress courant et on le ré-écrit en entier — la table est
// petite (<30 entrées par programme) et Postgres n'a pas d'opérateur JSONB
// `merge` exposé proprement via le SDK. Lecture/écriture distinctes ⇒
// possibilité de race si l'utilisateur double-tap depuis deux écrans, mais
// le scénario est tellement marginal qu'on l'accepte.
export async function markSessionDone(supabase, programId, week, day, state) {
  if (!supabase || !programId) return { ok: false, error: 'no_args' };
  const key = progressKey(week, day);
  const newState = state === undefined ? 'done' : state;
  try {
    const cur = await supabase
      .from('user_programs')
      .select('progress, schedule')
      .eq('id', programId)
      .single();
    if (cur.error) return { ok: false, error: cur.error.message };
    const merged = { ...(cur.data.progress || {}), [key]: newState };
    const total = Array.isArray(cur.data.schedule) ? cur.data.schedule.length : 0;
    const completed = Object.values(merged).filter(function (v) { return v === 'done' || v === 'skipped'; }).length;
    const patch = { progress: merged };
    if (total > 0 && completed >= total) patch.completed_at = new Date().toISOString();
    const upd = await supabase
      .from('user_programs')
      .update(patch)
      .eq('id', programId)
      .select('*')
      .single();
    if (upd.error) return { ok: false, error: upd.error.message };
    return { ok: true, program: upd.data };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) };
  }
}

// startProgram / deleteProgram — small mutators for MyPrograms.
export async function startProgram(supabase, programId) {
  if (!supabase || !programId) return { ok: false };
  try {
    const r = await supabase
      .from('user_programs')
      .update({ started_at: new Date().toISOString(), completed_at: null })
      .eq('id', programId)
      .select('*')
      .single();
    return r.error ? { ok: false, error: r.error.message } : { ok: true, program: r.data };
  } catch (e) { return { ok: false, error: String(e) }; }
}

export async function deleteProgram(supabase, programId) {
  if (!supabase || !programId) return { ok: false };
  try {
    const r = await supabase.from('user_programs').delete().eq('id', programId);
    return r.error ? { ok: false, error: r.error.message } : { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// ── Stats (pure, no I/O) ───────────────────────────────────────────────

// getProgramStats — derive UI-friendly state from a program row. Pure, no
// I/O — safe to call inside a render loop.
//
// Returns { total, completed, percent, currentWeek, nextSession }.
// `currentWeek` is the week containing the next un-done session — useful
// for the "Semaine 2/4" badge.
export function getProgramStats(program) {
  const empty = { total: 0, completed: 0, percent: 0, currentWeek: 1, nextSession: null };
  if (!program || !Array.isArray(program.schedule)) return empty;
  const schedule = program.schedule;
  const progress = program.progress || {};
  const total = schedule.length;
  const completed = countCompleted(schedule, progress);
  const next = nextSession(schedule, progress);
  const currentWeek = next ? next.week : (schedule.length ? schedule[schedule.length - 1].week : 1);
  return {
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    currentWeek,
    nextSession: next,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function clamp(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normaliseDifficulty(d) {
  if (d === 'beginner' || d === 'intermediate' || d === 'advanced') return d;
  return 'intermediate';
}

function sanitizeGoals(input) {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  // Keep up to 2 goals — matches the ProfileOnboarding constraint.
  return arr.slice(0, 2).filter(Boolean).map(function (g) { return String(g); });
}

// Re-export read-side helpers so screens can `import { progressKey } from
// '../utils/programs'` without reaching into the generator file.
export { progressKey, nextSession, countCompleted };
