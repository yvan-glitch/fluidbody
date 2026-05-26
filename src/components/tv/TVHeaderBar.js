// TVHeaderBar — header Apple TV style iPhone.
//
// Remplace l'ancien TVTopBar (hamburger + dropdown) par le même layout que
// le header MonCorps iPhone — feedback Yvan "le menu en haut à gauche pas
// fan je préfère comme sur l'iPhone" :
//   - Logo FLUIDBODY+ en haut-gauche (composant <FluidbodyLogo size="tv" />)
//   - Pill "Respirer 60s" au centre haut (focusable, ouvre BreathingCheckIn)
//   - "Bonjour {prenom}" en haut droite (texte vert lime) + petit avatar
//     Sabrina focusable (ouvre Profil)
//   - Tab bar glassy capsule en dessous : Pour vous · Explorer · Programmes · 🔍
//
// Les sections secondaires (Activité, Résumé, Bibliothèque, Respire) ne sont
// plus dans la nav principale — `extraKey` permet quand même au parent de
// rendre l'écran courant si mcTab pointe dessus, sans qu'on les affiche dans
// la tab bar.
//
// TV-only — zéro impact iPhone.

import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Platform, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Circle } from 'react-native-svg';
import { BlurView } from 'expo-blur';

import { tvFocusProps } from '../../utils/platformTV';
import FluidbodyLogo from '../FluidbodyLogo';

const SIDE = 80;
const SABRINA_AVATAR = require('../../../assets/coach/avatar.jpg');

const LIME = '#AEEF4D';
const LIME_BG = 'rgba(174,239,77,0.18)';
const LIME_BORDER = 'rgba(174,239,77,0.55)';

// ─────────────────────────────────────────────────────────────
// Tab pill (label texte ou icône SVG)
// ─────────────────────────────────────────────────────────────
function TabPill({ label, icon, active, focusPreferred, onPress }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(function () {
    Animated.timing(scale, { toValue: focused ? 1.08 : 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [focused]);
  const bg = active ? LIME_BG : (focused ? 'rgba(255,255,255,0.16)' : 'transparent');
  const border = active ? LIME_BORDER : (focused ? 'rgba(255,255,255,0.45)' : 'transparent');
  const color = active ? LIME : '#ffffff';
  return (
    <Animated.View style={{ transform: [{ scale: scale }], borderRadius: 999 }}>
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.85}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: icon ? 18 : 22,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: bg,
          borderWidth: active || focused ? 1.5 : 0,
          borderColor: border,
        }}
      >
        {icon ? icon(color) : null}
        {label ? (
          <Text style={{ fontSize: 18, fontWeight: active || focused ? '700' : '600', color: color, letterSpacing: 0.2 }}>{label}</Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// Respirer pill (à part : style spécifique, icône respiration)
// ─────────────────────────────────────────────────────────────
function BreathePill({ label, done, onPress }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(function () {
    Animated.timing(scale, { toValue: focused ? 1.08 : 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [focused]);
  const c = done ? LIME : (focused ? '#ffffff' : 'rgba(255,255,255,0.86)');
  return (
    <Animated.View style={[
      { transform: [{ scale: scale }], borderRadius: 999 },
      focused && Platform.OS === 'ios' ? { shadowColor: '#FFFFFF', shadowOpacity: 0.55, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } } : null,
    ]}>
      <TouchableOpacity
        {...tvFocusProps(false)}
        activeOpacity={0.85}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: done ? LIME_BG : (focused ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'),
          borderWidth: 1,
          borderColor: done ? LIME_BORDER : (focused ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)'),
        }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={1.6} />
          <Circle cx="12" cy="12" r="4.5" stroke={c} strokeWidth={1.2} opacity={0.6} />
        </Svg>
        <Text style={{ fontSize: 15, fontWeight: '700', color: c, letterSpacing: 0.3 }}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// Avatar coach (focusable, ouvre profil)
// ─────────────────────────────────────────────────────────────
function CoachAvatar({ onPress }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(function () {
    Animated.timing(scale, { toValue: focused ? 1.10 : 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [focused]);
  return (
    <Animated.View style={[
      { transform: [{ scale: scale }], borderRadius: 999 },
      focused && Platform.OS === 'ios' ? { shadowColor: '#FFFFFF', shadowOpacity: 0.55, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } } : null,
    ]}>
      <TouchableOpacity
        {...tvFocusProps(false)}
        activeOpacity={0.85}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        accessibilityRole="button"
        accessibilityLabel="Profil"
        style={{
          width: 52, height: 52, borderRadius: 26,
          overflow: 'hidden',
          borderWidth: focused ? 3 : 2,
          borderColor: focused ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
        }}
      >
        <Image source={SABRINA_AVATAR} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// Header complet
// ─────────────────────────────────────────────────────────────
export default function TVHeaderBar({
  tabs,
  activeKey,
  onSelectTab,
  prenom,
  onOpenProfile,
  onOpenBreathing,
  breathDone,
  lang,
}) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const breathLabel = breathDone
    ? (isFr ? 'Respiration faite' : 'Breathing done')
    : (isFr ? 'Respirer 60s' : 'Breathe 60s');
  const bonjourPrefix = isFr ? 'Bonjour' : 'Hello';

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 70 }}>
      {/* Bande frostée Liquid Glass (intensity 98, bordure bas subtile). */}
      {Platform.OS === 'ios' ? (
        <BlurView intensity={98} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 168 }} pointerEvents="none" />
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 168, backgroundColor: 'rgba(2,12,24,0.34)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' }} />

      {/* Rangée 1 — logo · breathe pill · greeting + avatar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 32, paddingHorizontal: SIDE, marginBottom: 10 }} pointerEvents="box-none">
        <FluidbodyLogo size="tv" />
        <BreathePill label={breathLabel} done={!!breathDone} onPress={onOpenBreathing} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          {prenom ? (
            <Text style={{ fontSize: 20, fontWeight: '300', color: 'rgba(174,239,77,0.85)', letterSpacing: 0.2 }}>{bonjourPrefix + ' ' + prenom}</Text>
          ) : null}
          <CoachAvatar onPress={onOpenProfile} />
        </View>
      </View>

      {/* Rangée 2 — capsule glass + tabs */}
      <View style={{ alignItems: 'center' }} pointerEvents="box-none">
        <View style={{ borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
          ) : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 999 }]} pointerEvents="none" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}>
            {(tabs || []).map(function (t, i) {
              const active = t.key === activeKey;
              return (
                <TabPill
                  key={t.key}
                  label={t.icon ? null : t.label}
                  icon={t.icon}
                  active={active}
                  focusPreferred={active && i === 0 ? false : (active ? true : false)}
                  onPress={function () { if (onSelectTab) onSelectTab(t.key); }}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

// Icône loupe (utilisée pour le tab Recherche).
export function SearchIcon(color) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth={2} />
      <Path d="M20 20 L16 16" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Icône respiration (cercles concentriques — même langage visuel que la
// pill BreathePill, pour signaler "même action").
export function BreathIcon(color) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.8} />
      <Circle cx="12" cy="12" r="4.5" stroke={color} strokeWidth={1.4} opacity={0.6} />
    </Svg>
  );
}
