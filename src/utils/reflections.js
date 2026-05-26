// reflections — collecte "Comment tu te sens ?" après une séance.
// Storage : `fluid_reflections` → array de { sessionId, emoji, t }.
// Cap soft à 500 entrées pour ne pas grossir indéfiniment.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'fluid_reflections';

export async function saveReflection(sessionId, emoji) {
  if (!sessionId || !emoji) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push({ sessionId: sessionId, emoji: emoji, t: Date.now() });
    const capped = arr.length > 500 ? arr.slice(-500) : arr;
    await AsyncStorage.setItem(KEY, JSON.stringify(capped));
  } catch (e) {}
}

export async function getReflections() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
