// TVCard16x9 — carte focusable 16:9 pour les carrousels Apple TV (style
// Fitness+). Image full-bleed + gradient bas + titre/sous-titre en overlay.
//
// Focus = scale 1.08 (native driver) + ring blanc 2.5px + glow/shadow blanc
// (élévation). Uniquement des transforms native-driven, JAMAIS de rotateX/Y
// JS sur le même node (cf. crash GlassCardTV corrigé en amont).
//
// TV-only — zéro impact iPhone.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { tvFocusProps } from '../../utils/platformTV';

export default function TVCard16x9({
  title,
  subtitle,
  image,
  width = 360,
  focusPreferred = false,
  onPress,
  onFocus,
}) {
  const cardW = width;
  const cardH = Math.round((width * 9) / 16);
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(function () {
    Animated.parallel([
      Animated.timing(scale, { toValue: focused ? 1.08 : 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ring, { toValue: focused ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [focused]);

  useEffect(function () {
    return function () { try { scale.stopAnimation(); ring.stopAnimation(); } catch (e) {} };
  }, []);

  return (
    <Animated.View
      style={[
        { width: cardW, height: cardH, borderRadius: 20, transform: [{ scale: scale }] },
        focused ? { shadowColor: '#FFFFFF', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } } : null,
      ]}
    >
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); if (onFocus) onFocus(); }}
        onBlur={function () { setFocused(false); }}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#10131C' }}>
          {image ? (
            <Image source={image} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
          ) : null}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.88)']}
            locations={[0.38, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
            <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2 }}>{title}</Text>
            {subtitle ? (
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.72)', marginTop: 3 }}>{subtitle}</Text>
            ) : null}
          </View>
        </View>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -2, left: -2, right: -2, bottom: -2,
            borderRadius: 22,
            borderWidth: 2.5,
            borderColor: '#FFFFFF',
            opacity: ring,
          }}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}
