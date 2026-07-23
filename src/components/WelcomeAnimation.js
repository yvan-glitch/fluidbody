// WelcomeAnimation — first-launch greeting that plays once after onboarding.
//
// Sequence: ~800ms hold (let MainApp's tab bar settle) → 600ms fade-in → 2.5s
// visible → 600ms fade-out. Gated by AsyncStorage `fluid_welcome_animation_shown`
// so the animation is strictly one-shot per install.
//
// The flag write happens at fade-out start so a process kill mid-display still
// records the play (we don't want it to loop on every launch if it half-played).

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MeduseCornerIcon } from './Meduse';

const STORAGE_KEY = 'fluid_welcome_animation_shown';

export async function isWelcomeAnimationShown() {
  try { return (await AsyncStorage.getItem(STORAGE_KEY)) === '1'; }
  catch (e) { return false; }
}

async function markShown() {
  try { await AsyncStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
}

function copyFor(lang, prenom, tr) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const fallback = tr.welcome_anim_fallback || (isFr ? 'Bienvenue' : 'Welcome');
  const greeting = prenom ? (isFr ? ('Bienvenue ' + prenom) : ('Welcome ' + prenom)) : fallback;
  const subtitle = tr.welcome_anim_subtitle || (isFr ? 'Ton parcours commence.' : 'Your journey begins.');
  return { greeting, subtitle };
}

export default function WelcomeAnimation({ visible, lang, prenom, tr, onDone }) {
  const { greeting, subtitle } = useMemo(
    function () { return copyFor(lang, prenom, tr || {}); },
    [lang, prenom, tr],
  );

  const opacAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const meduseAnim = useRef(new Animated.Value(0)).current;
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(function () {
    if (!visible || hasStarted) return;
    setHasStarted(true);
    const HOLD_MS = 800;
    const FADE_IN_MS = 600;
    const VISIBLE_MS = 2500;
    const FADE_OUT_MS = 600;
    const ease = Easing.bezier(0.32, 0.72, 0, 1);

    const fadeIn = Animated.sequence([
      Animated.delay(HOLD_MS),
      Animated.parallel([
        Animated.timing(opacAnim, { toValue: 1, duration: FADE_IN_MS, easing: ease, useNativeDriver: true }),
        Animated.timing(meduseAnim, { toValue: 1, duration: FADE_IN_MS + 200, easing: ease, useNativeDriver: true }),
      ]),
      Animated.delay(160),
      Animated.timing(subtitleAnim, { toValue: 1, duration: 420, easing: ease, useNativeDriver: true }),
      Animated.delay(VISIBLE_MS),
    ]);
    const fadeOut = Animated.parallel([
      Animated.timing(opacAnim, { toValue: 0, duration: FADE_OUT_MS, easing: ease, useNativeDriver: true }),
      Animated.timing(subtitleAnim, { toValue: 0, duration: FADE_OUT_MS, easing: ease, useNativeDriver: true }),
      Animated.timing(meduseAnim, { toValue: 0, duration: FADE_OUT_MS, easing: ease, useNativeDriver: true }),
    ]);

    fadeIn.start(function () {
      markShown();
      fadeOut.start(function () { if (onDone) onDone(); });
    });
    return function () { try { fadeIn.stop && fadeIn.stop(); fadeOut.stop && fadeOut.stop(); } catch (e) {} };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: opacAnim, zIndex: 9997, alignItems: 'center', justifyContent: 'center' }]}
    >
      <LinearGradient
        colors={['rgba(0,10,26,0.78)', 'rgba(0,26,46,0.78)', 'rgba(0,109,133,0.65)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Voile simple (pas d'UIGlassEffect : l'overlay est en fondu, et
          UIVisualEffectView rend mal sous alpha < 1 — cf. fix CoachWelcome). */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,14,26,0.30)' }]} />
      <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
        <Text
          style={{
            fontSize: 40,
            fontWeight: '300',
            color: '#ffffff',
            letterSpacing: 2,
            textAlign: 'center',
            marginBottom: 18,
          }}
        >
          {greeting}
        </Text>
        <Animated.Text
          style={{
            fontSize: 16,
            fontWeight: '500',
            color: '#AEEF4D',
            opacity: subtitleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] }),
            transform: [{ translateY: subtitleAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
            letterSpacing: 0.4,
            textAlign: 'center',
          }}
        >
          {subtitle}
        </Animated.Text>
      </View>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 80,
          opacity: meduseAnim,
          transform: [{ scale: meduseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }}
      >
        <MeduseCornerIcon size={40} breathCycleMs={2400} tint="rgba(174,239,77,0.95)" />
      </Animated.View>
    </Animated.View>
  );
}
