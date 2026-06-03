// BreathingCheckIn — 60-second guided breath ritual.
//
// One full-screen modal. Four cycles of a box-breath pattern (4-4-6-2 by
// default — inhale / hold / exhale / hold). At the end, the user gets a
// short confirmation and the day is marked as "breath done" so the
// Activity ring records 1 min of mindfulness.
//
// Heuristic for the haptic / sound rhythm:
//   • Each phase transition fires a soft impact, except "Pause" → "Pause"
//     (no transition).
//   • Sound is intentionally absent for v1: we'd need a tasteful audio
//     asset (~3-tone gong loop) and that requires Yvan's input. The
//     animation alone is hypnotic enough.
//
// Stats hooks:
//   • Writes `fluid_breath_YYYY-MM-DD = 1` when a session is completed.
//   • Increments `fluid_exercise_YYYY-MM-DD` by 1 minute so the Activity
//     ring picks it up alongside Pilates sessions.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, StyleSheet, Animated, Easing, Dimensions, Pressable, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LivingBackground from './LivingBackground';
import { Bulle, BULLES_ONBOARDING, FloatingMedusas } from './Meduse';
import GlassButton from './ui/GlassButton';
import { T } from '../constants/data';
import { safeNativeFire } from '../utils/safeNativeCall';
import { IS_TV } from '../utils/platformTV';
import { AquaticDrifters } from './tv/AquaticBackground';

const { width: SW, height: SH } = Dimensions.get('window');

let HapticsMod = null;
try { HapticsMod = require('expo-haptics'); } catch (e) {}

function hapticImpact() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  safeNativeFire('haptic.impactSoft.breath', function() {
    return HapticsMod.impactAsync(HapticsMod.ImpactFeedbackStyle.Soft);
  });
}
function hapticSuccess() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  safeNativeFire('haptic.notificationSuccess.breath', function() {
    return HapticsMod.notificationAsync(HapticsMod.NotificationFeedbackType.Success);
  });
}

const DEFAULT_PATTERN = { inhale: 4, holdIn: 4, exhale: 6, holdOut: 2 };
const CYCLES = 4;
const CIRCLE_SIZE = Math.min(SW, SH) * 0.62;
const MIN_SCALE = 0.6;
const MAX_SCALE = 1.0;

export function todayKey(prefix) {
  return prefix + '_' + new Date().toISOString().slice(0, 10);
}

export async function isBreathDoneToday() {
  try { return (await AsyncStorage.getItem(todayKey('fluid_breath'))) === '1'; }
  catch (e) { return false; }
}

async function markBreathDoneToday() {
  try {
    await AsyncStorage.setItem(todayKey('fluid_breath'), '1');
    const exKey = todayKey('fluid_exercise');
    const raw = await AsyncStorage.getItem(exKey);
    const total = raw ? parseInt(raw, 10) : 0;
    await AsyncStorage.setItem(exKey, String(total + 1));
  } catch (e) {}
}

function BreathRing({ scaleAnim, phaseColor }) {
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="breathGrad" cx="100" cy="100" r="90" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor={phaseColor} stopOpacity={0.85} />
            <Stop offset="60%" stopColor={phaseColor} stopOpacity={0.25} />
            <Stop offset="100%" stopColor="#000a1a" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="100" cy="100" r="92" fill="url(#breathGrad)" />
        <Circle cx="100" cy="100" r="60" stroke={phaseColor} strokeWidth={1.2} fill="none" opacity={0.5} />
        <Circle cx="100" cy="100" r="40" stroke={phaseColor} strokeWidth={0.8} fill="none" opacity={0.3} />
      </Svg>
    </Animated.View>
  );
}

const PHASE_COLOR = {
  inhale: '#AEEF4D',
  holdIn: '#7BD3FF',
  exhale: '#FFB069',
  holdOut: '#9CA8C6',
};

function phaseLabel(phase, tr) {
  switch (phase) {
    case 'inhale':  return tr.breath_inhale  || 'Inspire';
    case 'holdIn':  return tr.breath_hold    || 'Retiens';
    case 'exhale':  return tr.breath_exhale  || 'Expire';
    case 'holdOut': return tr.breath_pause   || 'Pause';
    default:        return '';
  }
}

export default function BreathingCheckIn({ visible, onClose, lang, pattern }) {
  const tr = T[lang] || T.fr;
  const pat = pattern || DEFAULT_PATTERN;
  const totalSec = useMemo(() => (pat.inhale + pat.holdIn + pat.exhale + pat.holdOut) * CYCLES, [pat]);

  const scaleAnim = useRef(new Animated.Value(MIN_SCALE)).current;
  const opacAnim = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState('inhale');
  const [phaseColor, setPhaseColor] = useState(PHASE_COLOR.inhale);
  const [cycleNum, setCycleNum] = useState(0);
  const [remaining, setRemaining] = useState(totalSec);
  const [completed, setCompleted] = useState(false);
  const tickerRef = useRef(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      // Reset when closing
      runningRef.current = false;
      scaleAnim.setValue(MIN_SCALE);
      opacAnim.setValue(0);
      setPhase('inhale');
      setPhaseColor(PHASE_COLOR.inhale);
      setCycleNum(0);
      setRemaining(totalSec);
      setCompleted(false);
      if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
      return;
    }
    runningRef.current = true;
    Animated.timing(opacAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    // Phase loop driven by setTimeout chain — easier to reason about than
    // a chained Animated.sequence when we also need React state callbacks.
    let cancelled = false;
    let cycle = 0;

    function runPhase(name, fromScale, toScale, seconds, onDone) {
      if (cancelled) return;
      setPhase(name);
      setPhaseColor(PHASE_COLOR[name]);
      hapticImpact();
      scaleAnim.setValue(fromScale);
      Animated.timing(scaleAnim, {
        toValue: toScale,
        duration: seconds * 1000,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }).start(({ finished }) => { if (finished && !cancelled) onDone(); });
    }

    function runCycle() {
      if (cancelled) return;
      setCycleNum(cycle + 1);
      runPhase('inhale', MIN_SCALE, MAX_SCALE, pat.inhale, () => {
        runPhase('holdIn', MAX_SCALE, MAX_SCALE, pat.holdIn, () => {
          runPhase('exhale', MAX_SCALE, MIN_SCALE, pat.exhale, () => {
            runPhase('holdOut', MIN_SCALE, MIN_SCALE, pat.holdOut, () => {
              cycle += 1;
              if (cycle < CYCLES) runCycle();
              else if (!cancelled) finish();
            });
          });
        });
      });
    }

    function finish() {
      if (cancelled) return;
      runningRef.current = false;
      setCompleted(true);
      hapticSuccess();
      markBreathDoneToday();
    }

    // Countdown ticker (1s) — purely display, drives the bottom timer.
    tickerRef.current = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);

    runCycle();

    return () => {
      cancelled = true;
      runningRef.current = false;
      if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
    };
  }, [visible, totalSec]);

  function handleSkip() {
    if (onClose) onClose();
  }

  function handleDone() {
    if (onClose) onClose();
  }

  return (
    <Modal visible={!!visible} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={handleSkip}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacAnim }]}>
        <LinearGradient
          colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']}
          locations={[0, 0.18, 0.4, 0.6, 0.82, 1]}
          style={StyleSheet.absoluteFill}
        />
        <LivingBackground />
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {BULLES_ONBOARDING.map((b, i) => <Bulle key={`br-${i}`} {...b} />)}
          {/* Une 2e vague de bulles décalée pour densifier l'iPhone (effet
              méditation : on veut le sentiment d'un vrai banc). */}
          {BULLES_ONBOARDING.map((b, i) => (
            <Bulle key={`br2-${i}`} delay={(b.delay || 0) + 4500} x={(b.x || 0) + 24} size={b.size} duration={b.duration} />
          ))}
        </View>
        {/* Couche aquatique foreground "high" — méduses + bulles denses pour
            l'ambiance méditation. TV uniquement (les drifters TV sont
            dimensionnés 1920×1080) ; sur iPhone la 2e vague de bulles
            ci-dessus suffit visuellement.
            pointerEvents="none" CRITIQUE → ne bloque jamais l'interaction. */}
        {IS_TV ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 50, opacity: 0.5 }]}>
            <AquaticDrifters density="high" contentOpacity={1} />
          </View>
        ) : null}
        {/* Une seule méduse iconique iPhone, douce et lente, en foreground. */}
        {!IS_TV ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 50, opacity: 0.42 }]}>
            <FloatingMedusas topInset={120} bottomInset={120} />
          </View>
        ) : null}

        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.title}>{tr.breath_title || 'Respiration du jour'}</Text>
          <Pressable onPress={handleSkip} hitSlop={12} style={styles.skipBtn}>
            <Text style={styles.skipText}>{tr.breath_skip || 'Passer'}</Text>
          </Pressable>
        </View>

        {!completed ? (
          <View style={styles.body}>
            <Text style={[styles.phaseLabel, { color: phaseColor }]}>
              {phaseLabel(phase, tr)}
            </Text>
            <BreathRing scaleAnim={scaleAnim} phaseColor={phaseColor} />
            <View style={styles.bottomInfo}>
              <Text style={styles.cycleText}>{(tr.breath_cycle || 'Cycle')} {cycleNum} / {CYCLES}</Text>
              <Text style={styles.timer}>{remaining}s</Text>
            </View>
          </View>
        ) : (
          <View style={styles.completedBody}>
            <Text style={styles.completedTitle}>{tr.breath_done_title || 'Bravo'}</Text>
            <Text style={styles.completedSub}>
              {tr.breath_done_sub || 'Ton anneau respiration est complété pour aujourd\'hui.'}
            </Text>
            <View style={{ marginTop: 26, alignSelf: 'stretch' }}>
              <GlassButton variant="accent" size="lg" haptic="success" onPress={handleDone}>
                {tr.breath_done_cta || 'Merci'}
              </GlassButton>
            </View>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 28,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
  },
  cycleText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  timer: {
    fontSize: 36,
    fontWeight: '300',
    color: '#ffffff',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  completedBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  completedTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#AEEF4D',
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  completedSub: {
    fontSize: 16,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
});
