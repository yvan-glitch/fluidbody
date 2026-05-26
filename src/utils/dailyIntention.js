// dailyIntention — "Comment veux-tu te sentir aujourd'hui ?" cold-start.
// Storage : `fluid_daily_intention_YYYY-MM-DD` → l'une des cinq clés.
// Si l'utilisateur a déjà répondu pour la date du jour, on ne re-pose pas.
// Map intention → pilier suggéré : utilisé pour mettre un pilier en avant
// (hero/banner) dans TwoColLandingTV et MonCorps mosaïque iPhone.

import AsyncStorage from '@react-native-async-storage/async-storage';

export const INTENTIONS = [
  { key: 'calme',     iconKey: 'zen',     labelFr: 'Calme',     labelEn: 'Calm' },
  { key: 'energique', iconKey: 'flame',   labelFr: 'Énergique', labelEn: 'Energized' },
  { key: 'ancre',     iconKey: 'tree',    labelFr: 'Ancré',     labelEn: 'Grounded' },
  { key: 'souple',    iconKey: 'droplet', labelFr: 'Souple',    labelEn: 'Supple' },
  { key: 'leger',     iconKey: 'sparkle', labelFr: 'Léger',     labelEn: 'Light' },
];

// Pilier recommandé par intention. Fallback sur p7 (Mat) si la clé est inconnue.
export const INTENTION_TO_PILIER = {
  calme:     'p5', // Souffle
  energique: 'p7', // Mat Pilates
  ancre:     'p4', // Posture
  souple:    'p3', // Mobilité (hanches/genoux/chevilles)
  leger:     'p1', // Épaules
};

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return 'fluid_daily_intention_' + y + '-' + m + '-' + day;
}

export async function getTodayIntention() {
  try {
    const raw = await AsyncStorage.getItem(todayKey());
    return raw || null;
  } catch (e) { return null; }
}

export async function setTodayIntention(intentionKey) {
  if (!intentionKey) return;
  try {
    await AsyncStorage.setItem(todayKey(), intentionKey);
  } catch (e) {}
}

export function getPilierKeyForIntention(intentionKey) {
  if (!intentionKey) return null;
  return INTENTION_TO_PILIER[intentionKey] || null;
}

export function findIntention(intentionKey) {
  if (!intentionKey) return null;
  for (let i = 0; i < INTENTIONS.length; i++) {
    if (INTENTIONS[i].key === intentionKey) return INTENTIONS[i];
  }
  return null;
}
