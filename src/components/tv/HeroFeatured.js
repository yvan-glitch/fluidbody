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
  const ringO = useRef(new Animated.Value(0)).current;

  useEffect(function () {
    Animated.parallel([
      Animated.timing(scale, { toValue: focused ? 1.10 : 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringO, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View
      style={[
        { alignSelf: 'flex-start', marginBottom: 14, borderRadius: 32, transform: [{ scale: scale }] },
        focused ? { shadowColor: primary ? FITNESS_GREEN : '#FFFFFF', shadowOpacity: primary ? 0.72 : 0.7, shadowRadius: primary ? 30 : 36, shadowOffset: { width: 0, height: 4 } } : null,
      ]}
    >
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{ borderRadius: 32, overflow: 'hidden' }}
      >
        {primary ? (
          <View style={{ paddingVertical: 18, paddingHorizontal: 44, position: 'relative', overflow: 'hidden' }}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={35} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
            ) : null}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: focused ? 'rgba(0,240,138,0.92)' : 'rgba(0,219,125,0.88)' }]} pointerEvents="none" />
            <View style={[StyleSheet.absoluteFill, { borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)' }]} pointerEvents="none" />
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#001B10', letterSpacing: 0.2 }}>{label}</Text>
          </View>
        ) : (
          <View style={{ paddingVertical: 18, paddingHorizontal: 44, position: 'relative', overflow: 'hidden' }}>
            {Platform.OS === 'ios' ? <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: focused ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.07)' }]} pointerEvents="none" />
            <View style={[StyleSheet.absoluteFill, { borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]} pointerEvents="none" />
            <Text style={{ fontSize: 22, fontWeight: '600', color: '#ffffff', letterSpacing: 0.2 }}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 35, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', opacity: ringO }} />
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
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.35, 0.78, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Bandeau frostée bas pour fondre le titre dans l'image
          (feedback "PilierPanelTV hero card : BlurView frosté sur le bas"). */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%', overflow: 'hidden' }}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={22} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
      </View>
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
