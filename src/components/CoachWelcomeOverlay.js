// CoachWelcomeOverlay — first-launch coach moment.
//
// Shown once after a user finishes onboarding (HK prompt closed → MainApp
// renders), gated by AsyncStorage key `fluid_coach_welcome_seen`. The video
// asset (Sabrina, 35s vertical) doesn't exist yet — see
// `docs/assets/coach-welcome.md` for the tournage specs. Until then this
// component renders a placeholder: animated jellyfish + a 3-beat copy that
// introduces Fluidbody's voice.
//
// Dismissal is non-destructive: tap the CTA or anywhere outside the card,
// the flag is written so the overlay never reappears for that user.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Animated, Easing, StyleSheet, Dimensions, Pressable, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LiquidGlass from './LiquidGlass';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MeduseCornerIcon, Bulle, BULLES_ONBOARDING } from './Meduse';
import LivingBackground from './LivingBackground';
import GlassButton from './ui/GlassButton';
import AnimatedPlus from './AnimatedPlus';
import { T } from '../constants/data';

const STORAGE_KEY = 'fluid_coach_welcome_seen';

let HapticsMod = null;
try { HapticsMod = require('expo-haptics'); } catch (e) {}

let _safeFire = null;
try { _safeFire = require('../utils/safeNativeCall').safeNativeFire; } catch (e) {}

function hapticSoft() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  if (_safeFire) {
    _safeFire('haptic.impactSoft.coachWelcome', function() {
      return HapticsMod.impactAsync(HapticsMod.ImpactFeedbackStyle.Soft);
    });
  } else {
    try { HapticsMod.impactAsync(HapticsMod.ImpactFeedbackStyle.Soft); } catch (e) {}
  }
}

// Three-beat copy: title, then a coach quote, then a small action prompt.
function buildBeats(lang, prenom) {
  const tr = T[lang] || T.fr;
  const greet = prenom
    ? (tr.coach_welcome_hello_named ? tr.coach_welcome_hello_named(prenom) : (`Bienvenue, ${prenom}.`))
    : (tr.coach_welcome_hello || 'Bienvenue dans Fluidbody.');
  const pitch = tr.coach_welcome_pitch
    || 'Ici, pas de performance à courir après. On respire, on écoute, on construit jour après jour un Pilates conscient.';
  const cta = tr.coach_welcome_cta || 'Je commence';
  const coachName = tr.coach_name || 'Sabrina';
  return { greet, pitch, cta, coachName };
}

export async function isCoachWelcomeSeen() {
  try { return (await AsyncStorage.getItem(STORAGE_KEY)) === '1'; }
  catch (e) { return false; }
}

export async function markCoachWelcomeSeen() {
  try { await AsyncStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
}

export default function CoachWelcomeOverlay({ visible, onDone, lang, prenom }) {
  const { greet, pitch, cta, coachName } = useMemo(
    () => buildBeats(lang, prenom),
    [lang, prenom],
  );

  const opacAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0.8)).current;
  const greetAnim = useRef(new Animated.Value(0)).current;
  const pitchAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    hapticSoft();
    Animated.parallel([
      Animated.timing(opacAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(220),
      Animated.timing(greetAnim, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(120),
      Animated.timing(pitchAnim, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(80),
      Animated.timing(ctaAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [visible]);

  function handleDismiss() {
    if (dismissing) return;
    setDismissing(true);
    markCoachWelcomeSeen();
    Animated.parallel([
      Animated.timing(opacAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 0.92, duration: 280, useNativeDriver: true }),
    ]).start(() => { if (onDone) onDone(); });
  }

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, { opacity: opacAnim, zIndex: 9999 }]}
    >
      <LinearGradient
        colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']}
        locations={[0, 0.18, 0.4, 0.6, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LivingBackground />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {BULLES_ONBOARDING.map((b, i) => <Bulle key={`cw-${i}`} {...b} />)}
      </View>

      <Pressable onPress={handleDismiss} style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 }}>
          {/* Wordmark — top */}
          <View style={{ position: 'absolute', top: 64, flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY</Text>
            <AnimatedPlus style={{ fontSize: 26, fontWeight: '900', color: '#AEEF4D', marginLeft: 8 }}>+</AnimatedPlus>
          </View>

          {/* Jellyfish hero */}
          <Animated.View style={{ transform: [{ scale: cardAnim }], marginBottom: 28 }}>
            <MeduseCornerIcon size={148} breathCycleMs={2800} breathMaxScale={1.32} tint="rgba(174,239,77,1)" />
          </Animated.View>

          {/* Card */}
          <Animated.View style={{ transform: [{ scale: cardAnim }], width: '100%', maxWidth: 380 }}>
            <View style={{ borderRadius: 28, overflow: 'hidden' }}>
              <LiquidGlass intensity={Platform.OS === 'ios' ? 80 : 0} tint="dark" style={{ padding: 26, backgroundColor: 'rgba(8,18,32,0.55)' }}>
                <Animated.Text
                  style={{
                    fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.4,
                    lineHeight: 32, marginBottom: 14, opacity: greetAnim,
                    transform: [{ translateY: greetAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                  }}
                >
                  {greet}
                </Animated.Text>
                <Animated.Text
                  style={{
                    fontSize: 15, fontWeight: '300', color: 'rgba(230,248,255,0.86)',
                    lineHeight: 24, marginBottom: 22, opacity: pitchAnim,
                    transform: [{ translateY: pitchAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                  }}
                >
                  {pitch}
                </Animated.Text>
                <Animated.View
                  style={{
                    opacity: ctaAnim,
                    transform: [{ translateY: ctaAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                  }}
                >
                  <GlassButton
                    variant="accent"
                    size="lg"
                    forceDark
                    haptic="success"
                    onPress={handleDismiss}
                    textStyle={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.1 }}
                  >
                    {cta}
                  </GlassButton>
                  <Text style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center',
                    letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 12,
                  }}>
                    — {coachName}
                  </Text>
                </Animated.View>
              </LiquidGlass>
            </View>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
