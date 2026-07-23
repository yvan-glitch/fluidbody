// ── Demande d'avis App Store ──
// SKStoreReviewController via expo-store-review, déclenché uniquement sur un
// moment positif (séance validée). Safe-require : tant que le module natif
// n'est pas dans le build (ajout du 2026-07-23 → prochain build EAS), tout
// est no-op — l'OTA reste sûr.
//
// Garde-fous :
// - jamais avant 3 séances complétées (ou streak ≥ 3) ;
// - au plus 1 demande tous les 120 jours, 3 demandes au total ;
// - Apple plafonne de toute façon à 3 affichages système par an, et
//   n'affiche rien si l'utilisateur a déjà noté — d'où l'absence de UI custom.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let StoreReview = null;
try { StoreReview = require('expo-store-review'); } catch (e) {}

const LAST_ASK_KEY = 'fluid_review_last_ask';
const ASK_COUNT_KEY = 'fluid_review_ask_count';
const MIN_DAYS_BETWEEN = 120;
const MAX_ASKS = 3;

export async function maybeAskForReview({ totalDone, streak }) {
  try {
    if (!StoreReview || Platform.OS !== 'ios') return false;
    if ((totalDone || 0) < 3 && (streak || 0) < 3) return false;
    const lastRaw = await AsyncStorage.getItem(LAST_ASK_KEY);
    const countRaw = await AsyncStorage.getItem(ASK_COUNT_KEY);
    const count = parseInt(countRaw || '0') || 0;
    if (count >= MAX_ASKS) return false;
    const last = lastRaw ? parseInt(lastRaw) : 0;
    if (last && Date.now() - last < MIN_DAYS_BETWEEN * 86400000) return false;
    const available = await StoreReview.isAvailableAsync();
    if (!available) return false;
    await AsyncStorage.setItem(LAST_ASK_KEY, String(Date.now()));
    await AsyncStorage.setItem(ASK_COUNT_KEY, String(count + 1));
    await StoreReview.requestReview();
    return true;
  } catch (e) {
    return false;
  }
}
