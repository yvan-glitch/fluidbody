// TVCard16x9 — carte focusable 16:9 pour les carrousels Apple TV (style
// Fitness+). Image full-bleed + gradient bas + titre/sous-titre en overlay.
//
// Focus = scale 1.06 (native driver) + ring 2px (blanc par défaut, vert si
// accent === 'green'). Même pattern safe que le FocusableCard de MonCorps —
// uniquement des transforms native-driven, JAMAIS de rotateX/Y JS sur le
// même node (cf. le crash GlassCardTV corrigé en amont).
//
// N'est importée que par des composants TV / branches `IS_TV`, donc zéro
// impact iPhone.

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
  accent,
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
      Animated.timing(scale, { toValue: focused ? 1.06 : 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ring, { toValue: focused ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [focused]);

  useEffect(function () {
    return function () { try { scale.stopAnimation(); ring.stopAnimation(); } catch (e) {} };
  }, []);

  return (
    <Animated.View style={{ width: cardW, height: cardH, transform: [{ scale: scale }] }}>
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); if (onFocus) onFocus(); }}
        onBlur={function () { setFocused(false); }}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: '#10162B' }}>
          {image ? (
            <Image source={image} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
          ) : null}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
            locations={[0.4, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
            <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2 }}>{title}</Text>
            {subtitle ? (
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{subtitle}</Text>
            ) : null}
          </View>
        </View>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -2, left: -2, right: -2, bottom: -2,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: accent === 'green' ? '#AEEF4D' : '#FFFFFF',
            opacity: ring,
          }}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}
