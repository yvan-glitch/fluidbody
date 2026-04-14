import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T, PILIERS_BASE, SEANCES_FR, SEANCES_EN, FREE_SEANCE_INDEX, ZONE_TO_PILIER } from './constants/data';
import { VIDEO_RESUME_PREFIX } from './components/VideoPlayer';

let HapticsMod = null;
try { HapticsMod = require('expo-haptics'); } catch(e) {}

function hapticLight() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  try { void HapticsMod.impactAsync(HapticsMod.ImpactFeedbackStyle.Light); } catch (e) {}
}

function hapticSuccess() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  try { void HapticsMod.notificationAsync(HapticsMod.NotificationFeedbackType.Success); } catch (e) {}
}

function getSeances(lang) {
  if (lang === 'fr') return SEANCES_FR;
  return SEANCES_EN;
}

const PILIER_LABEL_IDX = { p1: 0, p2: 1, p3: 2, p4: 3, p5: 4, p6: 5, p7: 6, p8: 7 };

function getPiliers(lang) {
  const t = T[lang] || T["fr"];
  return PILIERS_BASE.map((p) => ({ ...p, label: t.piliers[PILIER_LABEL_IDX[p.key]] }));
}

function canAccessSeanceIndex(idx, isSubscriber) {
  if (idx >= 5) return false; // séances 6-20 coming soon
  if (idx === 0) return true; // séance 1 gratuite pour tous
  return isSubscriber;
}

function isComingSoon(idx) {
  return idx >= 5;
}

function getSeanceDuJour(done, tensionIdxs, lang) {
  const piliers = getPiliers(lang);
  const seances = getSeances(lang);

  // Build a set of pilier keys that match the user's tension zones
  const tensionPiliers = new Set();
  if (Array.isArray(tensionIdxs)) {
    tensionIdxs.forEach(function(zi) {
      const pk = ZONE_TO_PILIER[zi];
      if (pk) tensionPiliers.add(pk);
    });
  }

  // Count total and done sessions per pilier for completion ratio
  const candidates = [];
  piliers.forEach(function(p) {
    const ps = seances[p.key] || [];
    if (ps.length === 0) return;

    // Find first undone session index for this pilier
    const doneMap = (done && done[p.key]) || {};
    let firstUndone = -1;
    for (let i = 0; i < ps.length; i++) {
      if (!doneMap[i]) { firstUndone = i; break; }
    }
    // All sessions done in this pilier — skip it
    if (firstUndone === -1) return;

    // Completion ratio for this pilier (0 = nothing done, 1 = all done)
    let doneCount = 0;
    for (let i = 0; i < ps.length; i++) {
      if (doneMap[i]) doneCount++;
    }
    const completionRatio = ps.length > 0 ? doneCount / ps.length : 0;

    // Score the candidate
    let score = 0;
    if (tensionPiliers.has(p.key)) score += 50;
    score += 20 * (1 - completionRatio);
    if (firstUndone < 5) score += 10;

    candidates.push({
      seance: ps[firstUndone],
      idx: firstUndone,
      key: p.key,
      pilier: p,
      score: score,
    });
  });

  if (candidates.length === 0) {
    // All piliers fully done — fall back to first session of first pilier
    const fallbackKey = piliers[0] && piliers[0].key;
    const fallbackSeances = fallbackKey ? (seances[fallbackKey] || []) : [];
    if (fallbackSeances.length === 0) return null;
    return { seance: fallbackSeances[0], idx: 0, key: fallbackKey, pilier: piliers[0] };
  }

  // Sort descending by score
  candidates.sort(function(a, b) { return b.score - a.score; });

  // Among tied top-scorers, use a day-based seed for deterministic daily rotation
  const topScore = candidates[0].score;
  const topCandidates = candidates.filter(function(c) { return c.score === topScore; });
  const now = new Date();
  const daySeed = (now.getDate() + now.getMonth() * 31) % topCandidates.length;
  return topCandidates[daySeed];
}

async function getResumeIndicesForPilier(pilierKey) {
  const indices = new Set();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const prefix = `${VIDEO_RESUME_PREFIX}${pilierKey}_`;
    for (const k of keys) {
      if (!k.startsWith(prefix)) continue;
      const idx = parseInt(k.slice(prefix.length), 10);
      if (!Number.isNaN(idx)) indices.add(idx);
    }
  } catch (e) {}
  return indices;
}

export {
  hapticLight,
  hapticSuccess,
  getSeances,
  getPiliers,
  canAccessSeanceIndex,
  isComingSoon,
  getSeanceDuJour,
  getResumeIndicesForPilier,
  PILIER_LABEL_IDX,
};
