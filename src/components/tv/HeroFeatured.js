// HeroFeatured — section hero cinématique en haut de "Pour vous" sur Apple
// TV (style Fitness+). Image full-bleed + gradient sombre vers le bas +
// titre H1 / sous-titre / description + bouton "Démarrer/Continuer"
// focusable (fond clair, contraste sur l'image, léger scale au focus).
//
// Le bouton porte hasTVPreferredFocus par défaut → le focus démarre ici au
// mount de l'écran. `onStart` ouvre le PilierPanel du pilier mis en avant.
//
// TV-only — zéro impact iPhone.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TouchableOpacity, View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { tvFocusProps } from '../../utils/platformTV';

const { height: SH } = Dimensions.get('window');

export default function HeroFeatured({
  image,
  title,
  subtitle,
  description,
  ctaLabel,
  onStart,
  focusPreferred = true,
}) {
  const heroH = Math.round(SH * 0.46);
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(function () {
    Animated.timing(scale, { toValue: focused ? 1.05 : 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [focused]);

  useEffect(function () {
    return function () { try { scale.stopAnimation(); } catch (e) {} };
  }, []);

  return (
    <View style={{ height: heroH, overflow: 'hidden', marginBottom: 28 }}>
      {image ? (
        <Image source={image} contentFit="cover" transition={250} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient
        colors={['rgba(10,14,31,0.10)', 'rgba(10,14,31,0.55)', 'rgba(10,14,31,0.98)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={{ position: 'absolute', left: 80, right: 80, bottom: 56 }}>
        <Text numberOfLines={1} style={{ fontSize: 56, fontWeight: '800', color: '#ffffff', letterSpacing: -1, marginBottom: 10 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: '500', color: 'rgba(255,255,255,0.80)', marginBottom: 8 }}>
            {subtitle}
          </Text>
        ) : null}
        {description ? (
          <Text numberOfLines={2} style={{ fontSize: 17, fontWeight: '300', color: 'rgba(255,255,255,0.64)', lineHeight: 24, maxWidth: 760, marginBottom: 22 }}>
            {description}
          </Text>
        ) : null}
        <Animated.View style={{ alignSelf: 'flex-start', transform: [{ scale: scale }] }}>
          <TouchableOpacity
            {...tvFocusProps(focusPreferred)}
            activeOpacity={0.9}
            onPress={onStart}
            onFocus={function () { setFocused(true); }}
            onBlur={function () { setFocused(false); }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: focused ? '#FFFFFF' : 'rgba(255,255,255,0.92)',
              paddingHorizontal: 40,
              paddingVertical: 16,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: focused ? '#AEEF4D' : 'transparent',
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#0A0E1F', letterSpacing: 0.2 }}>
              {'▶  ' + (ctaLabel || 'Démarrer')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
