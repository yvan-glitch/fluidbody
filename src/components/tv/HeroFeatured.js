// HeroFeatured — section hero cinématique en haut de "Pour vous" sur Apple
// TV (style Fitness+). Image full-bleed (~60% de l'écran) + gradient sombre
// épais vers le bas + titre H1 / sous-titre / description + DEUX CTAs empilés
// verticalement :
//   - primaire : vert vif Fitness+ (#00DB7D), texte noir, hasTVPreferredFocus
//   - secondaire : noir translucide + blur, bordure blanche 30 %, texte blanc
//
// `onPrimary` ouvre le PilierPanel de la séance mise en avant ; `onSecondary`
// renvoie vers l'abonnement annuel.
//
// TV-only — zéro impact iPhone.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TouchableOpacity, View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { tvFocusProps } from '../../utils/platformTV';

const { height: SH } = Dimensions.get('window');
const FITNESS_GREEN = '#00DB7D';

function HeroButton({ label, variant, onPress, focusPreferred }) {
  const primary = variant === 'primary';
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(function () {
    Animated.timing(scale, { toValue: focused ? 1.05 : 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [focused]);

  return (
    <Animated.View
      style={[
        { alignSelf: 'flex-start', marginBottom: 14, borderRadius: 30, transform: [{ scale: scale }] },
        focused ? { shadowColor: primary ? FITNESS_GREEN : '#000000', shadowOpacity: primary ? 0.55 : 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } } : null,
      ]}
    >
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{ borderRadius: 30, overflow: 'hidden', borderWidth: primary ? 0 : 1, borderColor: 'rgba(255,255,255,0.3)' }}
      >
        {primary ? (
          <View style={{ backgroundColor: focused ? '#00F08A' : FITNESS_GREEN, paddingVertical: 18, paddingHorizontal: 44 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#001B10', letterSpacing: 0.2 }}>{label}</Text>
          </View>
        ) : (
          <View style={{ paddingVertical: 18, paddingHorizontal: 44, backgroundColor: focused ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.5)' }}>
            {Platform.OS === 'ios' ? <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
            <Text style={{ fontSize: 22, fontWeight: '600', color: '#ffffff', letterSpacing: 0.2 }}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HeroFeatured({
  image,
  title,
  subtitle,
  description,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}) {
  const heroH = Math.round(SH * 0.6);

  return (
    <View style={{ height: heroH, overflow: 'hidden' }}>
      {image ? (
        <Image source={image} contentFit="cover" transition={250} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.86)', '#000000']}
        locations={[0, 0.35, 0.78, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={{ position: 'absolute', left: 80, right: 80, bottom: 64 }}>
        <Text numberOfLines={1} style={{ fontSize: 76, fontWeight: '800', color: '#ffffff', letterSpacing: -1.5, marginBottom: 12 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ fontSize: 30, fontWeight: '500', color: 'rgba(255,255,255,0.82)', marginBottom: 10 }}>
            {subtitle}
          </Text>
        ) : null}
        {description ? (
          <Text numberOfLines={2} style={{ fontSize: 22, fontWeight: '400', color: 'rgba(255,255,255,0.68)', lineHeight: 30, maxWidth: 820, marginBottom: 26 }}>
            {description}
          </Text>
        ) : null}
        <HeroButton label={primaryLabel || 'Commencer'} variant="primary" focusPreferred onPress={onPrimary} />
        {secondaryLabel ? (
          <HeroButton label={secondaryLabel} variant="secondary" onPress={onSecondary} />
        ) : null}
      </View>
    </View>
  );
}
