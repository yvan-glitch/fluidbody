// streakMilestones — déclencheur "X jours d'affilée" pour la célébration
// plein écran. Storage : `fluid_streak_celebrated_<N>` (string '1') une
// fois la milestone fêtée. Si elle est déjà célébrée, on ne re-affiche pas.
//
// Milestones : 3, 7, 14, 21, 30, 50, 100. Le bilan progresse de jour en
// jour ; on capte uniquement la transition vers une de ces valeurs.

import AsyncStorage from '@react-native-async-storage/async-storage';

export const MILESTONES = [3, 7, 14, 21, 30, 50, 100];

export function isMilestone(streak) {
  if (!streak || typeof streak !== 'number') return false;
  return MILESTONES.indexOf(streak) !== -1;
}

function keyFor(n) { return 'fluid_streak_celebrated_' + n; }

export async function shouldCelebrate(streak) {
  if (!isMilestone(streak)) return false;
  try {
    const raw = await AsyncStorage.getItem(keyFor(streak));
    return !raw;
  } catch (e) { return false; }
}

export async function markCelebrated(streak) {
  if (!isMilestone(streak)) return;
  try { await AsyncStorage.setItem(keyFor(streak), '1'); } catch (e) {}
}
