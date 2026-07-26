import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T, PILIERS_BASE, SEANCES_FR, SEANCES_EN, ZONE_TO_PILIER, FREE_MONTHLY_SELECTION } from './constants/data';
import { safeNativeFire } from './utils/safeNativeCall';
import { isSeanceVisible } from './utils/catalogVisibility';

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
      if (!isSeanceVisible(p.key, i)) continue;
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
      if (!isSeanceVisible(p.key, i)) continue;
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
    // All piliers fully done — fall back to the first visible session of the
    // first pilier that has one.
    for (let pi = 0; pi < piliers.length; pi++) {
      const fp = piliers[pi];
      const fs = (seances[fp.key] || []);
      for (let i = 0; i < fs.length; i++) {
        if (isSeanceVisible(fp.key, i)) {
          return { seance: fs[i], idx: i, key: fp.key, pilier: fp };
        }
      }
    }
    return null;
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

// Cherche dans AsyncStorage la séance interrompue la plus récente (non
// terminée) pour proposer une reprise sur la TV. Renvoie { pilierKey, idx,
// positionMillis, durationMillis, t } ou null.
async function getResumableSession() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const matching = keys.filter(function(k) { return k.startsWith(VIDEO_RESUME_PREFIX); });
    if (matching.length === 0) return null;
    const entries = await AsyncStorage.multiGet(matching);
    let best = null;
    for (const pair of entries) {
      const key = pair[0];
      const raw = pair[1];
      if (!raw) continue;
      let o;
      try { o = JSON.parse(raw); } catch (e) { continue; }
      if (!o || o.positionMillis == null || !o.durationMillis) continue;
      if (o.positionMillis < 5000) continue;                     // >5s regardés
      if (o.durationMillis - o.positionMillis < 30000) continue; // pas (presque) fini
      const rest = key.slice(VIDEO_RESUME_PREFIX.length);         // ex "p1_5"
      const us = rest.lastIndexOf('_');
      if (us < 1) continue;
      const pilierKey = rest.slice(0, us);
      const idx = parseInt(rest.slice(us + 1), 10);
      if (Number.isNaN(idx)) continue;
      const t = o.t || 0;
      if (!best || t > best.t) best = { pilierKey: pilierKey, idx: idx, positionMillis: o.positionMillis, durationMillis: o.durationMillis, t: t };
    }
    return best;
  } catch (e) { return null; }
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
  getResumableSession,
  PILIER_LABEL_IDX,
};
