// TVCard16x9 — carte focusable 16:9 Apple TV, langage Liquid Glass.
//
// Image full-bleed + gradient bas. Au focus : scale 1.08 (native driver) +
// GLOW lumineux (shadow blanc radius 30, pas de ring) + overlay glass frosté
// (BlurView clair monté uniquement quand focusé, pour la perf) + highlight
// blanc subtil. Android : fallback elevation. Texte avec ombre douce.
//
// TV-only — zéro impact iPhone.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TouchableOpacity, View, Text, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { tvFocusProps } from '../../utils/platformTV';

const GLOW = Platform.OS === 'ios'
  ? { shadowColor: '#FFFFFF', shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } }
  : { elevation: 24 };

const TEXT_SHADOW = { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } };

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
  const glassOpacity = useRef(new Animated.Value(0)).current;

  useEffect(function () {
    Animated.parallel([
      Animated.timing(scale, { toValue: focused ? 1.08 : 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(glassOpacity, { toValue: focused ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [focused]);

  useEffect(function () {
    return function () { try { scale.stopAnimation(); glassOpacity.stopAnimation(); } catch (e) {} };
  }, []);

  return (
    <Animated.View
      style={[
        { width: cardW, height: cardH, borderRadius: 24, transform: [{ scale: scale }] },
        focused ? GLOW : null,
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
        <View style={{ flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(16,19,28,0.6)' }}>
          {image ? (
            <Image source={image} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
          ) : null}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
            locations={[0.38, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Focus = bordure highlight légère (PAS de BlurView : il voilait
              l'image et la rendait illisible quand sélectionnée). */}
          {focused ? (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)', opacity: glassOpacity }]} />
          ) : null}
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
            <Text numberOfLines={1} style={[{ fontSize: 18, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2 }, TEXT_SHADOW]}>{title}</Text>
            {subtitle ? (
              <Text numberOfLines={1} style={[{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.78)', marginTop: 3 }, TEXT_SHADOW]}>{subtitle}</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
