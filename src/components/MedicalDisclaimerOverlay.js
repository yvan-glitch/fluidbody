// MedicalDisclaimerOverlay — first-launch medical safety gate.
//
// Shown exactly once per install, right after onboarding finishes and BEFORE
// the user can start any session (legal protection against injury claims —
// option C, validated by Yvan). Gated by AsyncStorage key
// `fluid_medical_disclaimer_v1_seen`.
//
// The card lists the imperative stop-and-consult symptoms and the conditions
// that require a doctor's clearance (mirrors §5 / §5 bis of the CGU). The CTA
// stays disabled until the user ticks the contraindication checkbox. A link
// opens the full Terms of Service in the browser.
//
// Style mirrors CoachWelcomeOverlay: dark gradient + living background +
// jellyfish + LiquidGlass card. Unlike the coach overlay this one is NOT
// dismissable by tapping outside — the user must acknowledge explicitly.

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, Animated, StyleSheet, Platform, Pressable, ScrollView, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LiquidGlass from './LiquidGlass';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MeduseCornerIcon, Bulle, BULLES_ONBOARDING } from './Meduse';
import LivingBackground from './LivingBackground';
import GlassButton from './ui/GlassButton';
import Svg, { Path } from 'react-native-svg';
import { T } from '../constants/data';
import { getTermsUrl } from '../constants/legal';

const STORAGE_KEY = 'fluid_medical_disclaimer_v1_seen';

let HapticsMod = null;
try { HapticsMod = require('expo-haptics'); } catch (e) {}

let _safeFire = null;
try { _safeFire = require('../utils/safeNativeCall').safeNativeFire; } catch (e) {}

function hapticSoft() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  if (_safeFire) {
    _safeFire('haptic.impactSoft.medicalDisclaimer', function () {
      return HapticsMod.impactAsync(HapticsMod.ImpactFeedbackStyle.Soft);
    });
  } else {
    try { HapticsMod.impactAsync(HapticsMod.ImpactFeedbackStyle.Soft); } catch (e) {}
  }
}

export async function isMedicalDisclaimerSeen() {
  try { return (await AsyncStorage.getItem(STORAGE_KEY)) === '1'; }
  catch (e) { return false; }
}

export async function markMedicalDisclaimerSeen() {
  try { await AsyncStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
}

// Bullet list of i18n keys disclaimer_<group>_1..5.
function bullets(tr, group) {
  const out = [];
  for (let i = 1; i <= 5; i++) {
    const v = tr[`disclaimer_${group}_${i}`];
    if (v) out.push(v);
  }
  return out;
}

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path d="M20 6L9 17l-5-5" stroke="#0a1420" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function Bullet({ children }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: 8 }}>
      <Text style={{ color: '#AEEF4D', fontSize: 14, lineHeight: 21, marginRight: 8 }}>•</Text>
      <Text style={{ flex: 1, color: 'rgba(230,248,255,0.86)', fontSize: 14, lineHeight: 21, fontWeight: '300' }}>
        {children}
      </Text>
    </View>
  );
}

export default function MedicalDisclaimerOverlay({ visible, onDone, lang }) {
  // Mirror getTermsUrl's language split: FR for fr*, EN for everything else.
  // Guarantees no undefined strings for es/it users (terms only exist FR/EN).
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const tr = isFr ? T.fr : T.en;

  const opacAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0.9)).current;
  const [checked, setChecked] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    hapticSoft();
    Animated.parallel([
      Animated.timing(opacAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  function handleConfirm() {
    if (dismissing || !checked) return;
    setDismissing(true);
    markMedicalDisclaimerSeen();
    Animated.parallel([
      Animated.timing(opacAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 0.94, duration: 280, useNativeDriver: true }),
    ]).start(() => { if (onDone) onDone(); });
  }

  function openTerms() {
    const url = getTermsUrl(lang);
    if (url) Linking.openURL(url).catch(() => {});
  }

  if (!visible) return null;

  const symptoms = bullets(tr, 'symptoms');
  const conditions = bullets(tr, 'conditions');

  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, { opacity: opacAnim, zIndex: 10000 }]}
    >
      <LinearGradient
        colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']}
        locations={[0, 0.18, 0.4, 0.6, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LivingBackground />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {BULLES_ONBOARDING.map((b, i) => <Bulle key={`md-${i}`} {...b} />)}
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 56 }}>
        <Animated.View style={{ transform: [{ scale: cardAnim }], width: '100%', maxWidth: 400, alignItems: 'center' }}>
          <View style={{ marginBottom: 14 }}>
            <MeduseCornerIcon size={96} breathCycleMs={2800} breathMaxScale={1.32} tint="rgba(174,239,77,1)" />
          </View>

          <View style={{ borderRadius: 28, overflow: 'hidden', width: '100%' }}>
            <LiquidGlass intensity={Platform.OS === 'ios' ? 80 : 0} tint="dark" style={{ backgroundColor: 'rgba(8,18,32,0.6)' }}>
              <ScrollView
                style={{ maxHeight: 460 }}
                contentContainerStyle={{ padding: 24 }}
                showsVerticalScrollIndicator={false}
              >
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.4, lineHeight: 28, marginBottom: 8 }}>
                  {tr.disclaimer_title}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', lineHeight: 20, marginBottom: 18 }}>
                  {tr.disclaimer_subtitle}
                </Text>

                <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.92)', lineHeight: 19, marginBottom: 10 }}>
                  {tr.disclaimer_symptoms_intro}
                </Text>
                {symptoms.map((s, i) => <Bullet key={`s-${i}`}>{s}</Bullet>)}

                <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.92)', lineHeight: 19, marginTop: 12, marginBottom: 10 }}>
                  {tr.disclaimer_conditions_intro}
                </Text>
                {conditions.map((c, i) => <Bullet key={`c-${i}`}>{c}</Bullet>)}

                {/* Checkbox — gates the CTA */}
                <Pressable
                  onPress={() => { hapticSoft(); setChecked((v) => !v); }}
                  style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 4 }}
                >
                  <View
                    style={{
                      width: 24, height: 24, borderRadius: 7, marginRight: 12,
                      alignItems: 'center', justifyContent: 'center',
                      borderWidth: 1.5,
                      borderColor: checked ? '#AEEF4D' : 'rgba(255,255,255,0.4)',
                      backgroundColor: checked ? '#AEEF4D' : 'transparent',
                    }}
                  >
                    {checked ? <CheckIcon /> : null}
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: 'rgba(230,248,255,0.9)', lineHeight: 19, fontWeight: '400' }}>
                    {tr.disclaimer_checkbox}
                  </Text>
                </Pressable>
              </ScrollView>

              <View style={{ paddingHorizontal: 24, paddingBottom: 22, paddingTop: 6 }}>
                <GlassButton
                  variant="accent"
                  size="lg"
                  forceDark
                  haptic="success"
                  disabled={!checked}
                  onPress={handleConfirm}
                  textStyle={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.1 }}
                >
                  {tr.disclaimer_cta}
                </GlassButton>
                <Pressable onPress={openTerms} style={{ marginTop: 14, alignItems: 'center' }} hitSlop={8}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)', textDecorationLine: 'underline' }}>
                    {tr.disclaimer_terms_link}
                  </Text>
                </Pressable>
              </View>
            </LiquidGlass>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
