// StreakCelebration — overlay plein écran qui s'affiche quand l'utilisateur
// franchit une milestone de série de jours consécutifs (3, 7, 14, 21, 30,
// 50, 100). Cascade de méduses qui montent + grand chiffre + sous-titre.
// Auto-dismiss après 3.6 s, tap pour fermer plus tôt. iPhone + Apple TV.

import { useEffect, useRef } from 'react';
import { Modal, View, Text, Animated, Easing, TouchableOpacity, Platform, StyleSheet, Dimensions, Share } from 'react-native';
import LiquidGlass from './LiquidGlass';
import { hapticSuccess } from '../utils';

import { MeduseCornerIcon } from './Meduse';

const { width: SW, height: SH } = Dimensions.get('window');

function RisingMeduse({ x, size, delay, duration, tint, breath }) {
  const ty = useRef(new Animated.Value(SH + 80)).current;
  const sw = useRef(new Animated.Value(0)).current;
  useEffect(function () {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(ty, { toValue: -size - 40, duration: duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(sw, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true }),
      ]),
    ]).start();
    return function () { ty.stopAnimation(); sw.stopAnimation(); };
  }, []);
  const sway = sw.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-12, 12, -12] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: x, transform: [{ translateY: ty }, { translateX: sway }] }}>
      <MeduseCornerIcon size={size} breathCycleMs={breath} breathMaxScale={1.4} tint={tint} />
    </Animated.View>
  );
}

export default function StreakCelebration({ visible, streak, lang, onClose }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const fade = useRef(new Animated.Value(0)).current;
  const big = useRef(new Animated.Value(0.6)).current;
  const timerRef = useRef(null);

  function shareStreak() {
    // On fige l'overlay le temps du partage (sinon l'auto-dismiss ferme tout).
    if (timerRef.current) { try { clearTimeout(timerRef.current); } catch (e) {} }
    const msg = isFr
      ? streak + ' jours de Pilates d’affilée avec FluidBody+ 🪼 10 à 25 min par jour avec Sabrina. fluidbody.ch'
      : streak + ' days of Pilates in a row with FluidBody+ 🪼 10-25 min a day with Sabrina. fluidbody.ch';
    Share.share({ message: msg }).catch(function () {}).finally(function () {
      if (onClose) onClose();
    });
  }
  useEffect(function () {
    if (!visible) {
      fade.setValue(0);
      big.setValue(0.6);
      return undefined;
    }
    hapticSuccess(); // petite vibration de fierté au moment où la milestone s'affiche
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(big, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(function () { if (onClose) onClose(); }, 3600);
    return function () { clearTimeout(timerRef.current); };
  }, [visible]);
  if (!visible) return null;
  const medusas = [];
  const cols = 8;
  for (let i = 0; i < cols; i++) {
    const xCol = (SW / (cols + 1)) * (i + 1) - 18;
    medusas.push({ x: xCol, size: 28 + (i % 3) * 10, delay: i * 110, duration: 2400 + (i % 4) * 250, tint: 'rgba(174,239,77,0.95)', breath: 2800 + i * 200 });
  }
  // Second wave un peu retardée pour densifier
  for (let i = 0; i < cols; i++) {
    const xCol = (SW / (cols + 1)) * (i + 1) + 12;
    medusas.push({ x: xCol, size: 22 + (i % 3) * 8, delay: 400 + i * 130, duration: 2700 + (i % 4) * 280, tint: 'rgba(170,225,255,0.9)', breath: 3100 + i * 220 });
  }
  const headline = isFr
    ? streak + ' jours d’affilée'
    : streak + ' days in a row';
  const sub = isFr ? 'Tu es lancée.' : 'You’re on a roll.';
  return (
    <Modal visible animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={isFr ? 'Fermer' : 'Close'}>
          {Platform.OS === 'ios' ? (
            <LiquidGlass intensity={75} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          ) : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2,18,34,0.85)' }]} pointerEvents="none" />
          {medusas.map(function (m, i) { return <RisingMeduse key={'rm' + i} {...m} />; })}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <Animated.Text style={{ fontSize: 110, fontWeight: '900', color: '#AEEF4D', letterSpacing: -3, textShadowColor: 'rgba(174,239,77,0.6)', textShadowRadius: 30, transform: [{ scale: big }] }}>{streak}</Animated.Text>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#ffffff', letterSpacing: -0.4, marginTop: 6, textAlign: 'center' }}>{headline}</Text>
            <Text style={{ fontSize: 18, fontWeight: '500', color: 'rgba(255,255,255,0.78)', marginTop: 8, textAlign: 'center' }}>{sub}</Text>
            <TouchableOpacity
              onPress={shareStreak}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={isFr ? 'Partager ma série' : 'Share my streak'}
              style={{ marginTop: 22, paddingVertical: 12, paddingHorizontal: 26, borderRadius: 999, backgroundColor: 'rgba(174,239,77,0.16)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.5)' }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D' }}>{isFr ? 'Partager ma série' : 'Share my streak'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}
