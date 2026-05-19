import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T, PILIERS_BASE, SEANCES_FR, SEANCES_EN, FREE_SEANCE_INDEX, ZONE_TO_PILIER, FREE_MONTHLY_SELECTION } from './constants/data';
import { safeNativeFire } from './utils/safeNativeCall';

const FREE_MONTHLY_SET = new Set((FREE_MONTHLY_SELECTION || []).map(function(s) { return s.pilier + '_' + s.idx; }));
import { VIDEO_RESUME_PREFIX } from './components/VideoPlayer';

let HapticsMod = null;
try { HapticsMod = require('expo-haptics'); } catch(e) {}

function hapticLight() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  safeNativeFire('haptic.impactLight', function() {
    return HapticsMod.impactAsync(HapticsMod.ImpactFeedbackStyle.Light);
  });
}

function hapticSuccess() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  safeNativeFire('haptic.notificationSuccess', function() {
    return HapticsMod.notificationAsync(HapticsMod.NotificationFeedbackType.Success);
  });
}

function getSeances(lang) {
  if (lang === 'fr') return SEANCES_FR;
  return SEANCES_EN;
}

const PILIER_LABEL_IDX = { p1: 0, p2: 1, p3: 2, p4: 3, p5: 4, p6: 5, p7: 6, p8: 7, p9: 8 };

function getPiliers(lang) {
  const t = T[lang] || T["fr"];
  return PILIERS_BASE.map((p) => ({ ...p, label: t.piliers[PILIER_LABEL_IDX[p.key]] }));
}

function canAccessSeanceIndex(idx, isSubscriber, pilierKey) {
  if (pilierKey && FREE_MONTHLY_SET.has(pilierKey + '_' + idx)) return true;
  if (idx === 0) return true; // séance 1 gratuite pour tous
  // Théorie (Comprendre + Ressentir) toujours gratuite — vit dans la Biblio
  if (pilierKey) {
    const s = (SEANCES_FR[pilierKey] || [])[idx];
    if (s && (s[2] === 'Comprendre' || s[2] === 'Ressentir')) return true;
  }
  return isSubscriber;
}

function isComingSoon(pilierKey, idx) {
  // p9 Ménopause : 15 séances structurées dans le code, contenu vidéo en
  // attente de tournage avec Sabrina. Centralisé ici pour pouvoir relâcher
  // par batch quand les vidéos arriveront.
  if (pilierKey === 'p9') return true;
  return false;
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

    // Find first undone session index for this pilier (excluding theory steps — those live in Biblio)
    const doneMap = (done && done[p.key]) || {};
    let firstUndone = -1;
    for (let i = 0; i < ps.length; i++) {
      const e = ps[i] && ps[i][2];
      if (e === 'Comprendre' || e === 'Ressentir') continue;
      if (!doneMap[i]) { firstUndone = i; break; }
    }
    // All practical sessions done in this pilier — skip it
    if (firstUndone === -1) return;

    // Completion ratio for practical sessions only
    let doneCount = 0;
    let practicalCount = 0;
    for (let i = 0; i < ps.length; i++) {
      const e = ps[i] && ps[i][2];
      if (e === 'Comprendre' || e === 'Ressentir') continue;
      practicalCount++;
      if (doneMap[i]) doneCount++;
    }
    const completionRatio = practicalCount > 0 ? doneCount / practicalCount : 0;

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
