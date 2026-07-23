// TVCard16x9 — carte focusable 16:9 Apple TV, langage Liquid Glass.
//
// Image full-bleed + bandeau bas glassy (BlurView intensity 20) sur lequel
// vit le titre/sous-titre — texte lisible sans tout brouiller la photo.
// Au focus : scale 1.08 (native driver, aligné site-wide) + GLOW lumineux blanc fort
// (shadow opacity 0.78, radius 40) + ring blanc 3px opaque + voile blanc
// très subtil pour sortir la card du fond. Android : fallback elevation.
//
// TV-only — zéro impact iPhone.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TouchableOpacity, View, Text, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { tvFocusProps } from '../../utils/platformTV';
import SessionBadge from './SessionBadge';

const GLOW = Platform.OS === 'ios'
  ? { shadowColor: '#FFFFFF', shadowOpacity: 0.78, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } }
  : { elevation: 30 };

const TEXT_SHADOW = { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } };

export default function TVCard16x9({
  title,
  subtitle,
  image,
  width = 360,
  focusPreferred = false,
  onPress,
  onFocus,
  badge, // { label, tone } | null — affiché en top-left si présent.
}) {
  const cardW = width;
  const cardH = Math.round((width * 9) / 16);
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(function () {
    Animated.parallel([
      Animated.timing(scale, { toValue: focused ? 1.08 : 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: focused ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [focused]);

  useEffect(function () {
    return function () { try { scale.stopAnimation(); ringOpacity.stopAnimation(); } catch (e) {} };
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
          {/* Gradient subtle pour aider la lisibilité au-dessus du bandeau */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
            locations={[0.42, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Bandeau bas glassy — abrite le titre/sous-titre. Frost léger
              sur iOS pour donner la sensation Liquid Glass sans voiler
              l'image (le BlurView est cantonné aux ~38% du bas). */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' }} pointerEvents="none">
            {Platform.OS === 'ios' ? (
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            ) : null}
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.32)']}
              locations={[0, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
          {/* Voile blanc très subtil au focus, pour faire ressortir la card. */}
          {focused ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24 }]} />
          ) : null}
          {/* Badge top-left (Reprendre / Nouveau / Programme / Favori).
              `pointerEvents` reste none sur le badge (cf. SessionBadge),
              donc la card reste focusable. */}
          {badge && badge.label ? (
            <View style={{ position: 'absolute', top: 14, left: 14 }}>
              <SessionBadge label={badge.label} tone={badge.tone} />
            </View>
          ) : null}
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
            <Text numberOfLines={1} style={[{ fontSize: 18, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2 }, TEXT_SHADOW]}>{title}</Text>
            {subtitle ? (
              <Text numberOfLines={1} style={[{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.82)', marginTop: 3 }, TEXT_SHADOW]}>{subtitle}</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
      {/* Ring blanc 3px au focus (au-dessus du clip → visible). */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 27, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', opacity: ringOpacity }}
      />
    </Animated.View>
  );
}
