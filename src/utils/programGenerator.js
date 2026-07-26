// programGenerator — algorithmic schedule builder for user_programs.
//
// `generateProgram({ profile, goals, durationWeeks, sessionsPerWeek })` returns
// an immutable `schedule` array shaped:
//   [{ week: 1, day: 1, pilier_key: 'p2', session_index: 0,
//      etape: 'Comprendre', type: 'guided' | 'recovery' }, ...]
//
// Why algorithmic: Sabrina can only film 2-3 séances/week, so the catalogue
// stays small. The generator stretches the same ~150 séances into bespoke
// 4-12 week journeys by ordering them according to goal weights, the user's
// declared practice level, and a progression curve (Comprendre → Évoluer).
//
// Determinism: given the same inputs (profile fields, goals, duration,
// frequency) the output is identical across runs. We seed a small PRNG so
// "Tonifier intermédiaire 4sem 3x" always produces the same plan. The
// preview in ProgramBuilder relies on this — what the user sees is what
// gets persisted.
//
// Bias towards available video content: a séance with `hasVideo === true`
// (4th tuple element) is preferred over a comment-only one at the same
// (pilier, étape) bucket. The generator never *requires* a video — that
// would brick output as soon as the catalogue holds a non-video étape.

import { SEANCES_FR, PILIERS_BASE } from '../constants/data';
import { hasVideo as catalogHasVideo, HIDE_UNFILMED } from './catalogVisibility';

// ── Constants ──────────────────────────────────────────────────────────

// Goal keys match `GOAL_KEYS` in ProfileOnboarding.js. The French aliases
// (tonifier / souplesse / récupération / sérénité) are accepted as inputs
// — we normalize at the boundary so callers can use either vocabulary.
const GOAL_ALIASES = {
  tonifier: 'tone',
  souplesse: 'flex',
  flexibility: 'flex',
  recuperation: 'recovery',
  récupération: 'recovery',
  serenite: 'serenity',
  sérénité: 'serenity',
};

// Per-goal pillar weights. Higher = pillar fires more often when this goal
// is selected. Multiple goals stack (we sum weights across selected goals).
// Numbers are arbitrary — only the relative ranking matters.
const GOAL_WEIGHTS = {
  tone:     { p7: 4, p2: 3, p3: 2, p1: 1 },              // Mat core + dos + jambes
  flex:     { p3: 4, p1: 3, p5: 2, p7: 1 },              // mobilité + épaules + souffle
  posture:  { p4: 4, p2: 3, p1: 2, p7: 1 },              // posture + dos + épaules
  recovery: { p5: 3, p8: 3, p6: 2, p3: 1 },              // souffle + office + pleine conscience
  serenity: { p5: 4, p6: 3, p8: 2, p7: 1 },              // souffle + golf/conscience + office
};

// Difficulty → distribution across étapes. Beginners spend more time
// understanding/feeling; advanced users skip ahead. The active row picks
// the étape via weighted random; progression over weeks then shifts the
// row (see `etapeBudgetForSlot`).
const ETAPE_BUDGET = {
  beginner:     { Comprendre: 3, Ressentir: 3, Préparer: 3, Exécuter: 1, Évoluer: 0 },
  intermediate: { Comprendre: 1, Ressentir: 2, Préparer: 3, Exécuter: 3, Évoluer: 1 },
  advanced:     { Comprendre: 0, Ressentir: 1, Préparer: 2, Exécuter: 4, Évoluer: 3 },
};

// Étape ordering — index = "depth". Used to (a) sort generated picks within
// a week so the user always advances Comprendre → Évoluer, and (b) shift
// the budget rightward as weeks progress.
const ETAPE_ORDER = ['Comprendre', 'Ressentir', 'Préparer', 'Exécuter', 'Évoluer'];

// Recovery slot every Nth session (variety + sustainability). Default 5
// keeps every 5th séance a calm respiration session (p5 Ressentir).
const RECOVERY_EVERY_N = 5;

// ── Helpers ────────────────────────────────────────────────────────────

// Tiny seedable PRNG (mulberry32) so the same inputs produce the same plan.
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// String → 32-bit hash. Used to derive a stable seed from the input
// profile + goals so the plan stays consistent without storing the seed.
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function normalizeGoals(goals) {
  const arr = Array.isArray(goals) ? goals : (goals ? [goals] : []);
  return arr
    .map((g) => (g == null ? '' : String(g).toLowerCase()))
    .map((g) => GOAL_ALIASES[g] || g)
    .filter((g) => GOAL_WEIGHTS[g] != null);
}

function pillarKeys() {
  return PILIERS_BASE.map((p) => p.key);
}

// Weighted random pick from a {key: weight} map using the supplied rng.
// Returns null if no positive weight is present.
function weightedPick(weights, rng) {
  const keys = Object.keys(weights).filter((k) => (weights[k] || 0) > 0);
  if (!keys.length) return null;
  const total = keys.reduce((a, k) => a + (weights[k] || 0), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const k of keys) {
    r -= weights[k] || 0;
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}

// Shift the étape budget rightward by `weeksIn / durationWeeks` so a 4-week
// program glides from "Comprendre-heavy" to "Évoluer-heavy". Beginners get
// a gentler shift (max +1 column), advanced gets a hard push.
function etapeBudgetForSlot(level, weekIdx, durationWeeks) {
  const base = ETAPE_BUDGET[level] || ETAPE_BUDGET.intermediate;
  const progress = durationWeeks <= 1 ? 0 : weekIdx / Math.max(1, durationWeeks - 1);
  // shift: 0 → no shift, 1 → drop earliest étape, boost latest
  const shift = level === 'beginner'
    ? progress * 1
    : level === 'advanced'
      ? progress * 2.5
      : progress * 1.8;
  const out = {};
  ETAPE_ORDER.forEach((etape, i) => {
    const shiftedIdx = i - shift;
    // bell-ish: distance from current "centre" reduces weight
    const distanceFactor = Math.max(0, 1 - Math.abs(shiftedIdx - i) * 0.4);
    out[etape] = Math.max(0, (base[etape] || 0) * distanceFactor + Math.max(0, shift - (ETAPE_ORDER.length - 1 - i)) * 0.3);
  });
  return out;
}

// Build a (pilier, étape) → list of session indices map from SEANCES_FR.
// We use FR as the canonical source because étape labels are stored in FR
// across all locales (the EN catalogue mirrors the same indices and étape
// values — see src/constants/data.js).
function buildSessionIndex() {
  const idx = {};
  Object.keys(SEANCES_FR).forEach((pk) => {
    const sessions = SEANCES_FR[pk] || [];
    sessions.forEach((s, i) => {
      const etape = s[2];
      const hasVideo = catalogHasVideo(pk, i);
      // En mode App Store (HIDE_UNFILMED), une séance sans vidéo ne doit
      // jamais atterrir dans un programme : elle serait injouable.
      if (HIDE_UNFILMED && !hasVideo) return;
      const key = pk + ':' + etape;
      if (!idx[key]) idx[key] = [];
      idx[key].push({ index: i, hasVideo });
    });
  });
  // Sort each bucket so sessions with video come first — better UX when
  // a slot lands on a still-comment-only catalogue entry.
  Object.keys(idx).forEach((k) => {
    idx[k].sort((a, b) => (b.hasVideo ? 1 : 0) - (a.hasVideo ? 1 : 0));
  });
  return idx;
}

// ── Main entry point ───────────────────────────────────────────────────

export function generateProgram(input) {
  const profile = (input && input.profile) || {};
  const durationWeeks = clamp(input && input.durationWeeks, 1, 12, 4);
  const sessionsPerWeek = clamp(input && input.sessionsPerWeek, 1, 7, 3);
  const rawGoals = input && (input.goals || input.goal);
  const goals = normalizeGoals(rawGoals);
  const level = (profile.practice_level || 'intermediate');

  // Build a base pilier-weight map from the user's goals. If no goals
  // were provided we fall back to a balanced spread across the main
  // pillars so the generator still yields something usable.
  const piliers = pillarKeys();
  const pilierWeights = {};
  piliers.forEach((k) => { pilierWeights[k] = 0; });
  if (goals.length === 0) {
    // Balanced default: p2, p3, p4, p7 (the four "headline" pillars).
    ['p2', 'p3', 'p4', 'p7'].forEach((k) => { pilierWeights[k] = 2; });
  } else {
    goals.forEach((g) => {
      const w = GOAL_WEIGHTS[g];
      if (!w) return;
      Object.keys(w).forEach((pk) => {
        pilierWeights[pk] = (pilierWeights[pk] || 0) + (w[pk] || 0);
      });
    });
  }

  // Seed the PRNG from the inputs that meaningfully change the plan.
  // We deliberately exclude `profile` fields that aren't program-shaping
  // (prénom, birth_date, ...) so two users on the same plan get the same
  // generated schedule.
  const seedStr = [
    goals.join(','),
    durationWeeks,
    sessionsPerWeek,
    level,
  ].join('|');
  const rng = mulberry32(hashSeed(seedStr || 'fluidbody-default'));

  const sessionIdx = buildSessionIndex();
  const totalSlots = durationWeeks * sessionsPerWeek;
  const schedule = [];

  // Bookkeeping for variety: track how often each pilier was picked so we
  // can soft-cap consecutive same-pilier slots within a week.
  let lastPilier = null;
  const usedSessionsByKey = {}; // "p2:Comprendre" → Set of indices already placed

  for (let slot = 0; slot < totalSlots; slot++) {
    const week = Math.floor(slot / sessionsPerWeek) + 1;
    const day = (slot % sessionsPerWeek) + 1;
    const isRecovery = ((slot + 1) % RECOVERY_EVERY_N) === 0;

    if (isRecovery) {
      // Recovery slot — always Ressentir on p5 (Souffle) if available,
      // fall back to p6 (pleine conscience). Same generator picks the
      // session index so the same slot lands on the same recovery video.
      const recoveryKey = sessionIdx['p5:Ressentir'] ? 'p5:Ressentir' : 'p6:Ressentir';
      const bucket = sessionIdx[recoveryKey] || [];
      const used = ensureSet(usedSessionsByKey, recoveryKey);
      const pick = pickFromBucket(bucket, used, rng);
      if (pick != null) {
        const [pk, etape] = recoveryKey.split(':');
        schedule.push({
          week,
          day,
          pilier_key: pk,
          session_index: pick,
          etape,
          type: 'recovery',
        });
        lastPilier = pk;
        continue;
      }
      // Fall through to a regular pick if no recovery bucket has space.
    }

    // 1. Compute étape weights for this week.
    const etapeWeights = etapeBudgetForSlot(level, week - 1, durationWeeks);

    // 2. Bias pilier weights: penalize the pilier picked on the previous
    //    slot so we don't stack three p7 sessions in a row.
    const localPilierWeights = {};
    piliers.forEach((k) => {
      const base = pilierWeights[k] || 0;
      localPilierWeights[k] = base > 0
        ? (k === lastPilier ? base * 0.4 : base)
        : 0;
    });

    // 3. Pick a (pilier, étape) by drawing both independently then verify
    //    the bucket has unused content. If it doesn't, fall back to any
    //    available (pilier, étape) for this pilier.
    let pick = null;
    let chosenPilier = null;
    let chosenEtape = null;
    for (let attempt = 0; attempt < 6 && pick == null; attempt++) {
      chosenPilier = weightedPick(localPilierWeights, rng);
      chosenEtape = weightedPick(etapeWeights, rng);
      if (!chosenPilier || !chosenEtape) break;
      const key = chosenPilier + ':' + chosenEtape;
      const bucket = sessionIdx[key] || [];
      const used = ensureSet(usedSessionsByKey, key);
      pick = pickFromBucket(bucket, used, rng);
    }

    // 4. Last-resort fallback: scan every bucket of the highest-weighted
    //    pilier for any session not yet used. Guarantees we never emit a
    //    null slot — small catalogue, but generator must always succeed.
    if (pick == null) {
      const fallback = findAnyUnused(sessionIdx, pilierWeights, usedSessionsByKey);
      if (fallback) {
        chosenPilier = fallback.pilier;
        chosenEtape = fallback.etape;
        pick = fallback.index;
      }
    }

    // 5. Absolute fallback: re-use a session (cycle). For very long
    //    programs that exceed catalogue capacity per (pilier, étape).
    if (pick == null && chosenPilier && chosenEtape) {
      const bucket = sessionIdx[chosenPilier + ':' + chosenEtape] || [];
      if (bucket.length) pick = bucket[slot % bucket.length].index;
    }

    if (pick == null) continue; // shouldn't happen; defensive.

    schedule.push({
      week,
      day,
      pilier_key: chosenPilier,
      session_index: pick,
      etape: chosenEtape,
      type: 'guided',
    });
    lastPilier = chosenPilier;
  }

  // Within each week, sort by étape depth so the user always travels
  // Comprendre → Évoluer through the week. Day numbers get reassigned
  // after sort to stay 1..sessionsPerWeek contiguous.
  const byWeek = {};
  schedule.forEach((s) => {
    if (!byWeek[s.week]) byWeek[s.week] = [];
    byWeek[s.week].push(s);
  });
  const ordered = [];
  Object.keys(byWeek).map(Number).sort((a, b) => a - b).forEach((w) => {
    const items = byWeek[w].slice();
    items.sort((a, b) => ETAPE_ORDER.indexOf(a.etape) - ETAPE_ORDER.indexOf(b.etape));
    items.forEach((s, i) => {
      ordered.push({ ...s, day: i + 1 });
    });
  });

  return ordered;
}

// ── Internal helpers ───────────────────────────────────────────────────

function clamp(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function ensureSet(obj, key) {
  if (!obj[key]) obj[key] = new Set();
  return obj[key];
}

function pickFromBucket(bucket, usedSet, rng) {
  if (!bucket || !bucket.length) return null;
  // Prefer entries with video first; within each tier, prefer ones we
  // haven't used yet for this (pilier, étape) bucket.
  const fresh = bucket.filter((b) => !usedSet.has(b.index));
  const pool = fresh.length ? fresh : bucket; // re-use if exhausted
  // Weighted slightly towards earlier (Comprendre = easier session_index)
  // via a small drift on the random pick. Keeps "first séance" feel.
  const r = Math.floor(rng() * pool.length);
  const chosen = pool[r];
  usedSet.add(chosen.index);
  return chosen.index;
}

function findAnyUnused(sessionIdx, pilierWeights, usedSessionsByKey) {
  const pillars = Object.keys(pilierWeights)
    .filter((p) => (pilierWeights[p] || 0) > 0)
    .sort((a, b) => (pilierWeights[b] || 0) - (pilierWeights[a] || 0));
  // First try the highest-weighted pillars, walking étapes in order.
  for (const p of pillars) {
    for (const etape of ETAPE_ORDER) {
      const key = p + ':' + etape;
      const bucket = sessionIdx[key] || [];
      const used = ensureSet(usedSessionsByKey, key);
      for (const b of bucket) {
        if (!used.has(b.index)) {
          used.add(b.index);
          return { pilier: p, etape, index: b.index };
        }
      }
    }
  }
  return null;
}

// ── Read-side helpers (consumed by programs.js and screens) ────────────

// Stable string key for a schedule entry: "week-day". Mirrors the JSONB
// shape we persist into `user_programs.progress`.
export function progressKey(week, day) {
  return week + '-' + day;
}

// Render-time helper: return next un-done schedule entry, or null when
// every slot has been marked done/skipped.
export function nextSession(schedule, progress) {
  if (!Array.isArray(schedule)) return null;
  for (const s of schedule) {
    const k = progressKey(s.week, s.day);
    const state = progress && progress[k];
    if (state !== 'done' && state !== 'skipped') return s;
  }
  return null;
}

// Convenience: count how many slots have a state (done OR skipped) — used
// as the denominator-free numerator for progress percentages.
export function countCompleted(schedule, progress) {
  if (!Array.isArray(schedule) || !progress) return 0;
  let n = 0;
  for (const s of schedule) {
    const state = progress[progressKey(s.week, s.day)];
    if (state === 'done' || state === 'skipped') n++;
  }
  return n;
}

export const __TEST_ONLY__ = {
  GOAL_WEIGHTS,
  ETAPE_BUDGET,
  ETAPE_ORDER,
  RECOVERY_EVERY_N,
  hashSeed,
};
