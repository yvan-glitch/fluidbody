// AnniversaryOverlay — discreet 14 May celebration overlay.
//
// Shows once per year (gated by AsyncStorage key `fluid_anniv_seen_<year>`)
// when the user opens MainApp on 14 May. Coach mode (5 taps on the avatar in
// Profil) bypasses the seen flag so the overlay can be previewed at any time.
//
// The overlay is dismissible: tap anywhere outside the card or the CTA. We
// fade in over the rendered MainApp (so the user isn't ripped out of context)
// and ease out cleanly.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Animated, Easing, StyleSheet, Dimensions, Pressable, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LiquidGlass from './LiquidGlass';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MeduseCornerIcon, Bulle, BULLES_ONBOARDING } from './Meduse';
import Confetti from './Confetti';
import GlassButton from './ui/GlassButton';


const ANNIV_MONTH = 4; // 0-indexed → May
const ANNIV_DAY = 14;

export function annivStorageKey(year) {
  return 'fluid_anniv_seen_' + year;
}

export function isAnniversaryToday(now) {
  const d = now instanceof Date ? now : new Date();
  return d.getMonth() === ANNIV_MONTH && d.getDate() === ANNIV_DAY;
}

export async function shouldShowAnniversary() {
  if (!isAnniversaryToday(new Date())) return false;
  try {
    const seen = await AsyncStorage.getItem(annivStorageKey(new Date().getFullYear()));
    return seen !== '1';
  } catch (e) { return false; }
}

export async function markAnniversarySeen() {
  try { await AsyncStorage.setItem(annivStorageKey(new Date().getFullYear()), '1'); }
  catch (e) {}
}

function copyFor(lang, prenom) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const named = prenom ? (isFr ? ('Joyeux 14 mai, ' + prenom + '.') : ('Happy 14 May, ' + prenom + '.')) : null;
  return {
    eyebrow: isFr ? '14 MAI · UN JOUR SPÉCIAL' : '14 MAY · A SPECIAL DAY',
    title: named || (isFr ? 'Joyeux 14 mai.' : 'Happy 14 May.'),
    body: isFr
      ? 'Aujourd\'hui, on prend un instant pour soi. Respire, sens ton corps, ouvre l\'espace. Merci d\'être là — Sabrina.'
      : 'Today, take a moment for yourself. Breathe, feel your body, open space. Thank you for being here — Sabrina.',
    cta: isFr ? 'Continuer' : 'Continue',
  };
}

export default function AnniversaryOverlay({ visible, lang, prenom, onDismiss }) {
  const { eyebrow, title, body, cta } = useMemo(
    function () { return copyFor(lang, prenom); },
    [lang, prenom],
  );

  const opacAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0.85)).current;
  const [dismissing, setDismissing] = useState(false);

  useEffect(function () {
    if (!visible) return;
    setDismissing(false);
    opacAnim.setValue(0);
    cardAnim.setValue(0.85);
    Animated.parallel([
      Animated.timing(opacAnim, { toValue: 1, duration: 460, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  function handleDismiss() {
    if (dismissing) return;
    setDismissing(true);
    markAnniversarySeen();
    Animated.parallel([
      Animated.timing(opacAnim, { toValue: 0, duration: 300, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 0.94, duration: 300, useNativeDriver: true }),
    ]).start(function () { if (onDismiss) onDismiss(); });
  }

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, { opacity: opacAnim, zIndex: 9998 }]}
    >
      <LinearGradient
        colors={['rgba(0,10,26,0.92)', 'rgba(0,26,46,0.92)', 'rgba(0,109,133,0.78)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {BULLES_ONBOARDING.map(function (b, i) { return <Bulle key={'anniv-' + i} {...b} />; })}
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Confetti count={45} duration={3200} />
      </View>

      <Pressable onPress={handleDismiss} style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <Animated.View style={{ transform: [{ scale: cardAnim }], marginBottom: 22 }}>
            <MeduseCornerIcon size={120} breathCycleMs={2400} breathMaxScale={1.28} tint="rgba(174,239,77,1)" />
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: cardAnim }], width: '100%', maxWidth: 360 }}>
            <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
              <LiquidGlass intensity={Platform.OS === 'ios' ? 80 : 0} tint="dark" style={{ padding: 24, backgroundColor: 'rgba(8,18,32,0.55)' }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#AEEF4D', letterSpacing: 2, textAlign: 'center', marginBottom: 12 }}>
                  {eyebrow}
                </Text>
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.4, lineHeight: 32, textAlign: 'center', marginBottom: 14 }}>
                  {title}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '300', color: 'rgba(230,248,255,0.86)', lineHeight: 22, textAlign: 'center', marginBottom: 22 }}>
                  {body}
                </Text>
                <GlassButton
                  variant="accent"
                  size="lg"
                  forceDark
                  haptic="soft"
                  onPress={handleDismiss}
                  textStyle={{ fontSize: 15, fontWeight: '800', letterSpacing: -0.1 }}
                >
                  {cta}
                </GlassButton>
              </LiquidGlass>
            </View>
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
