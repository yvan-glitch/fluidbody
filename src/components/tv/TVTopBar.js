// TVTopBar — barre supérieure Apple TV style Fitness+ :
//   - gauche : un SEUL bouton hamburger (icône menu + label de l'onglet
//     courant). Au press → ouvre le TVMenuDropdown flottant.
//   - droite : avatar compact (icône user + prénom). Au press → onOpenProfile
//     (ouvre ProfilTV, géré par le parent TVMainView).
//
// Marge latérale 80px alignée avec le hero et les carrousels. zIndex élevé
// pour rester au-dessus du contenu qui scrolle dessous.
//
// TV-only — zéro impact iPhone.

import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Platform, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';

import TVMenuDropdown from './TVMenuDropdown';
import { tvFocusProps } from '../../utils/platformTV';

const SIDE = 80;
const BAR_H = 118;
const SABRINA_AVATAR = require('../../../assets/coach/avatar.jpg');
const COACH_LABEL = 'Coach Sabrina';

export default function TVTopBar({ tabs, activeKey, onSelectTab, prenom, onOpenProfile }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [burgerFocused, setBurgerFocused] = useState(false);
  const [avatarFocused, setAvatarFocused] = useState(false);
  const avatarScale = useRef(new Animated.Value(1)).current;
  useEffect(function () {
    Animated.timing(avatarScale, { toValue: avatarFocused ? 1.06 : 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [avatarFocused]);
  const activeLabel = (tabs.find(function (t) { return t.key === activeKey; }) || {}).label || '';

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 44, paddingHorizontal: SIDE, zIndex: 70 }} pointerEvents="box-none">
      {/* Barre frostée Liquid Glass */}
      {Platform.OS === 'ios' ? <BlurView intensity={85} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: BAR_H }} pointerEvents="none" /> : null}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: BAR_H, backgroundColor: 'rgba(0,0,0,0.25)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }} pointerEvents="none" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* Hamburger + dropdown */}
        <View>
          <TouchableOpacity
            {...tvFocusProps(false)}
            activeOpacity={0.85}
            onPress={function () { setMenuOpen(function (v) { return !v; }); }}
            onFocus={function () { setBurgerFocused(true); }}
            onBlur={function () { setBurgerFocused(false); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 20, paddingVertical: 12, borderRadius: 32,
              backgroundColor: burgerFocused ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.10)',
              borderWidth: 1, borderColor: burgerFocused ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.14)',
            }}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d="M3 6h18M3 12h18M3 18h18" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <Text style={{ fontSize: 20, fontWeight: '600', color: '#ffffff' }}>{activeLabel}</Text>
          </TouchableOpacity>
          {menuOpen ? (
            <View style={{ marginTop: 10 }}>
              <TVMenuDropdown
                items={tabs}
                activeKey={activeKey}
                onSelect={function (k) { setMenuOpen(false); if (onSelectTab) onSelectTab(k); }}
              />
            </View>
          ) : null}
        </View>

        {/* Avatar coach Sabrina */}
        <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
          <TouchableOpacity
            {...tvFocusProps(false)}
            activeOpacity={0.85}
            onPress={onOpenProfile}
            onFocus={function () { setAvatarFocused(true); }}
            onBlur={function () { setAvatarFocused(false); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingLeft: 8, paddingRight: 20, paddingVertical: 8, borderRadius: 999,
              backgroundColor: avatarFocused ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
              borderWidth: 1, borderColor: avatarFocused ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.14)',
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: avatarFocused ? '#ffffff' : 'rgba(255,255,255,0.45)' }}>
              <Image source={SABRINA_AVATAR} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>{COACH_LABEL}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
