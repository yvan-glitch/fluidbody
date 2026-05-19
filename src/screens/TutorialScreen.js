// TutorialScreen — first-launch 5-step walkthrough.
//
// Shown once, after the existing OnboardingScreen has captured prénom +
// language, before the user lands on MainApp tabs. Storage flag:
// `fluid_tutorial_done_v1` ('true' once seen — bump the suffix to
// re-show on a future major UX revamp).
//
// The component is fully self-contained: it owns its step index, the
// AsyncStorage write, and the visual frame. The host (App root) just
// renders it and waits for `onDone` to flip to MainApp.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Easing, StyleSheet, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GlassCard, GlassButton } from '../components/ui';
import LivingBackground from '../components/LivingBackground';
import { Bulle, BULLES_ONBOARDING, FloatingMedusas, MeduseCornerIcon } from '../components/Meduse';
import AnimatedPlus from '../components/AnimatedPlus';
import { T } from '../constants/data';

export const TUTORIAL_STORAGE_KEY = 'fluid_tutorial_done_v1';

const { width: SW } = Dimensions.get('window');

// Step content lives here so the host can't accidentally drift from the
// 5-step contract. Each step pulls its strings from the active `tr`
// table at render time; the `key` field selects the visual.
const STEPS = [
  { key: 'welcome',  titleKey: 'tutorial_welcome_title',  descKey: 'tutorial_welcome_desc'  },
  { key: 'piliers',  titleKey: 'tutorial_piliers_title',  descKey: 'tutorial_piliers_desc'  },
  { key: 'rings',    titleKey: 'tutorial_rings_title',    descKey: 'tutorial_rings_desc'    },
  { key: 'library',  titleKey: 'tutorial_library_title',  descKey: 'tutorial_library_desc'  },
  { key: 'coach',    titleKey: 'tutorial_coach_title',    descKey: 'tutorial_coach_desc'    },
];

// Lightweight illustrations for each step. We deliberately don't ship
// new image assets — the méduse + glass language already carries the
// brand, and shipping placeholder PNGs would bloat the bundle for
// content that may rotate. Each illustration is a small composition of
// existing primitives.
function StepIllustration({ step, accent }) {
  switch (step) {
    case 'welcome':
      return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(174,239,77,0.08)',
          }}>
            <MeduseCornerIcon size={140} tint={accent} breathCycleMs={2600} breathMaxScale={1.2} />
          </View>
        </View>
      );
    case 'piliers':
      return (
        <View style={{ alignItems: 'center' }}>
          <View style={{
            width: 110, height: 200, borderRadius: 22, borderWidth: 1.5, borderColor: accent,
            backgroundColor: 'rgba(174,239,77,0.06)', justifyContent: 'space-between',
            paddingVertical: 14, alignItems: 'center',
          }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={'p' + i} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: accent, opacity: 0.35 + (i * 0.1) }} />
            ))}
          </View>
        </View>
      );
    case 'rings':
      return (
        <View style={{ alignItems: 'center' }}>
          {[
            { c: '#FA114F', r: 70 },
            { c: '#92E82A', r: 56 },
            { c: '#1FD9E1', r: 42 },
          ].map((ring, i) => (
            <View key={'ring' + i}
              style={{
                position: 'absolute', top: 90 - ring.r, width: ring.r * 2, height: ring.r * 2,
                borderRadius: ring.r, borderWidth: 7, borderColor: ring.c, opacity: 0.85,
              }}
            />
          ))}
          <View style={{ height: 180, width: 180 }} />
        </View>
      );
    case 'library':
      return (
        <View style={{ width: '70%', maxWidth: 240, alignSelf: 'center' }}>
          {[0, 1, 2].map((i) => (
            <View key={'lib' + i} style={{
              height: 38, marginBottom: 10, borderRadius: 10,
              borderWidth: 1, borderColor: accent,
              backgroundColor: 'rgba(174,239,77,0.10)',
              paddingHorizontal: 10, justifyContent: 'center',
            }}>
              <View style={{ width: '60%', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' }} />
            </View>
          ))}
          <View style={{
            height: 42, borderRadius: 21, borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.4)',
            paddingHorizontal: 16, justifyContent: 'center', marginTop: 6,
          }}>
            <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{'🔍'}</Text>
          </View>
        </View>
      );
    case 'coach':
    default:
      return (
        <View style={{ alignItems: 'center' }}>
          <View style={{
            width: 130, height: 130, borderRadius: 65, alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(174,239,77,0.10)', borderWidth: 2, borderColor: 'rgba(174,239,77,0.6)',
          }}>
            <Text style={{ fontSize: 60 }}>👩‍🏫</Text>
          </View>
          <View style={{
            marginTop: 14, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
          }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, letterSpacing: 0.4 }}>
              {'Sabrina'}
            </Text>
          </View>
        </View>
      );
  }
}

export default function TutorialScreen({ lang = 'fr', prenom, onDone }) {
  const tr = T[lang] || T.fr;
  const [idx, setIdx] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  // Fade-in per step so each transition reads as a deliberate slide.
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [idx, fade]);

  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  // Title interpolation for the welcome step — fold the prénom in
  // ("Bienvenue Yvan") if we have one, otherwise the generic title.
  const title = useMemo(() => {
    const raw = tr[step.titleKey];
    if (step.key === 'welcome' && prenom) {
      if (typeof raw === 'function') return raw(prenom);
      const fallback = (lang === 'en' ? 'Welcome, ' : 'Bienvenue, ');
      return (raw || fallback) + prenom;
    }
    if (typeof raw === 'function') return raw(prenom || '');
    return raw || '';
  }, [tr, step.titleKey, step.key, prenom, lang]);

  const description = tr[step.descKey] || '';
  const nextLabel = isLast
    ? (tr.tutorial_done || (lang === 'en' ? "Let's start" : 'Commencer'))
    : (tr.tutorial_next || (lang === 'en' ? 'Next' : 'Suivant'));
  const skipLabel = tr.tutorial_skip || (lang === 'en' ? 'Skip' : 'Passer');

  async function persistDone() {
    try { await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, 'true'); } catch (e) {}
  }

  function handleNext() {
    if (isLast) {
      persistDone().finally(() => { if (typeof onDone === 'function') onDone({ skipped: false }); });
      return;
    }
    setIdx(idx + 1);
  }

  function handleSkip() {
    persistDone().finally(() => { if (typeof onDone === 'function') onDone({ skipped: true }); });
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000a1a' }}>
      <LinearGradient
        colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']}
        locations={[0, 0.18, 0.4, 0.6, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        {BULLES_ONBOARDING.map((b, i) => <Bulle key={'tut-b-' + i} {...b} />)}
      </View>
      <FloatingMedusas />

      {/* Header — wordmark + skip. Matches HealthKitConnect for visual
          continuity (the user arrives here from a similar-looking flow). */}
      <View style={{
        paddingTop: 56, paddingHorizontal: 22, flexDirection: 'row',
        justifyContent: 'space-between', alignItems: 'center', zIndex: 5,
      }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>
          FLUIDBODY
          <AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: 24 }}>+</AnimatedPlus>
        </Text>
        <TouchableOpacity
          onPress={handleSkip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={skipLabel}
        >
          <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>
            {skipLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progress dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 14, gap: 8, zIndex: 5 }}>
        {STEPS.map((s, i) => (
          <View
            key={'dot-' + s.key}
            style={{
              width: i === idx ? 22 : 8, height: 8, borderRadius: 4,
              backgroundColor: i === idx ? '#AEEF4D' : 'rgba(255,255,255,0.3)',
            }}
          />
        ))}
      </View>

      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, paddingTop: 12, paddingBottom: 36, zIndex: 5,
      }}>
        <Animated.View style={{
          opacity: fade,
          transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          width: '100%', flex: 1, justifyContent: 'center',
        }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 20 }}>
            <StepIllustration step={step.key} accent="#AEEF4D" />
          </View>

          <GlassCard padded padding={22}>
            <Text style={{
              fontSize: 24, fontWeight: '800', color: '#ffffff',
              textAlign: 'center', lineHeight: 30, letterSpacing: -0.3, marginBottom: 10,
            }}>
              {title}
            </Text>
            <Text style={{
              fontSize: 15, color: 'rgba(255,255,255,0.78)',
              textAlign: 'center', lineHeight: 22,
            }}>
              {description}
            </Text>
          </GlassCard>
        </Animated.View>

        <View style={{ alignSelf: 'stretch', marginTop: 14 }}>
          <GlassButton
            variant="accent"
            size="lg"
            onPress={handleNext}
            forceDark
            haptic={isLast ? 'success' : 'light'}
            accessibilityLabel={nextLabel}
          >
            {nextLabel}
          </GlassButton>
        </View>
      </View>
    </View>
  );
}
