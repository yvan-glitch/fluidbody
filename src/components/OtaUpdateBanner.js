// OtaUpdateBanner — affiche un toast subtil quand une OTA update est dispo.
//
// Comportement :
//   1. À chaque foreground de l'app, check si une mise à jour OTA est dispo
//      (channel = production ou production-tv selon le build).
//   2. Si oui, télécharge silencieusement et affiche un toast en bas d'écran
//      avec message "Une mise à jour est prête" + bouton "Recharger".
//   3. Tap "Recharger" → reload de l'app avec le nouveau bundle.
//   4. Tap croix → dismiss, le toast revient au prochain foreground si update
//      pas encore appliqué.
//
// Pourquoi pas d'auto-reload silencieux :
//   - Recharger interrompt une séance en cours = mauvaise UX.
//   - Recharger sans prévenir surprend (l'app "saute" sans raison apparente).
//   - L'utilisateur garde le contrôle : il sait quand sa nouvelle séance
//     "Posture Dos Avancée" arrive.
//
// Tech :
//   - expo-updates safe-required (no crash en Expo Go ou dev mode).
//   - AppState listener pour re-check au foreground (throttle 5 min).
//   - Pas de blocage UI : check async en arrière-plan.

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// Safe require — expo-updates n'est pas dispo en Expo Go, et n'a aucun effet
// en dev mode. Pas la peine de crasher le boot.
let Updates = null;
try { Updates = require('expo-updates'); } catch (e) {}

// Translations inline pour éviter un import circulaire avec T from data.js
// si data.js doit changer. Le banner est volontairement minimaliste.
const STRINGS = {
  fr: {
    available: 'Nouveau contenu disponible',
    reload: 'Recharger',
    dismiss: 'Plus tard',
  },
  en: {
    available: 'New content available',
    reload: 'Reload',
    dismiss: 'Later',
  },
};

// Throttle check toutes les 5 min. Plus fréquent = surcharge Metro,
// moins fréquent = user voit le banner trop tard après push.
const CHECK_THROTTLE_MS = 5 * 60 * 1000;

export default function OtaUpdateBanner({ lang = 'fr' }) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const slideAnim = useRef(new Animated.Value(100)).current;
  const lastCheckRef = useRef(0);

  // Skip entirely in dev mode / Expo Go where Updates is a no-op.
  // Also skip if user already dismissed this update — re-armed at next foreground
  // only if a NEWER update is available (handled below via fetchUpdateAsync check).
  const enabled = Updates && !__DEV__ && Updates.channel;

  const checkForUpdate = async () => {
    if (!enabled) return;
    if (dismissed) return;
    const now = Date.now();
    if (now - lastCheckRef.current < CHECK_THROTTLE_MS) return;
    lastCheckRef.current = now;

    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result?.isAvailable) return;

      // Download the update silently.
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched?.isNew) {
        setVisible(true);
      }
    } catch (e) {
      // Network error, server down, etc. Silent fail — banner just doesn't show.
      // Don't log in prod, would spam Sentry on every spotty network.
    }
  };

  // Initial check on mount + check on each foreground.
  useEffect(() => {
    if (!enabled) return;

    // Defer initial check by 3s to avoid competing with cold-start native init.
    const timer = setTimeout(() => { void checkForUpdate(); }, 3000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkForUpdate();
      }
    });

    return () => {
      clearTimeout(timer);
      sub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, dismissed]);

  // Slide in / out animation.
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 100,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [visible, slideAnim]);

  const t = STRINGS[lang] || STRINGS.fr;

  const handleReload = async () => {
    if (!Updates) return;
    try {
      await Updates.reloadAsync();
    } catch (e) {
      // If reload fails, dismiss the banner so user isn't stuck looking at it.
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setVisible(false);
  };

  if (!enabled || !visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.banner}>
        <View style={styles.dot} />
        <Text style={styles.message} numberOfLines={1}>
          {t.available}
        </Text>
        <Pressable onPress={handleDismiss} hitSlop={8} style={styles.dismissButton}>
          <Text style={styles.dismissText}>{t.dismiss}</Text>
        </Pressable>
        <Pressable onPress={handleReload} hitSlop={8} style={styles.reloadButton}>
          <Text style={styles.reloadText}>{t.reload}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.select({ ios: 100, default: 80 }), // au-dessus de la tab bar
    left: 12,
    right: 12,
    zIndex: 999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 14, 24, 0.95)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(174, 239, 77, 0.3)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#AEEF4D',
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  dismissButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dismissText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  reloadButton: {
    backgroundColor: '#AEEF4D',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  reloadText: {
    color: '#000e18',
    fontSize: 13,
    fontWeight: '700',
  },
});
