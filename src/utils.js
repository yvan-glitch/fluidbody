import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T, PILIERS_BASE, SEANCES_FR, SEANCES_EN, SEANCES_ES, SEANCES_IT, SEANCES_DE, SEANCES_PT, SEANCES_ZH, SEANCES_JA, SEANCES_KO, FREE_SEANCE_INDEX, ZONE_TO_PILIER } from './constants/data';
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
  if (lang === 'en') return SEANCES_EN;
  if (lang === 'es') return SEANCES_ES;
  if (lang === 'it') return SEANCES_IT;
  if (lang === 'de') return SEANCES_DE;
  if (lang === 'pt') return SEANCES_PT;
  if (lang === 'zh') return SEANCES_ZH;
  if (lang === 'ja') return SEANCES_JA;
  if (lang === 'ko') return SEANCES_KO;
  return SEANCES_FR;
}

const PILIER_LABEL_IDX = { p1: 0, p2: 1, p3: 2, p4: 3, p5: 4, p6: 5, p7: 6, p8: 7 };

function getPiliers(lang) {
  const t = T[lang] || T["fr"];
  return PILIERS_BASE.map((p) => ({ ...p, label: t.piliers[PILIER_LABEL_IDX[p.key]] }));
}

function canAccessSeanceIndex(idx, isSubscriber) {
  if (idx >= 5) return false; // séances 6-20 coming soon
  return isSubscriber;
}

function isComingSoon(idx) {
  return idx >= 5;
}

function getSeanceDuJour(done, tensionIdxs, lang) {
  const piliers = getPiliers(lang);
  const seances = getSeances(lang);
  const allSeances = [];
  piliers.forEach(function(p) {
    var ps = seances[p.key] || [];
    ps.forEach(function(s, i) {
      allSeances.push({ seance: s, idx: i, key: p.key, pilier: p });
    });
  });
  if (allSeances.length === 0) return null;
  var pick = allSeances.find(function(s) { return s.key === 'p3' && s.idx === 0; });
  return pick || allSeances[0];
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
