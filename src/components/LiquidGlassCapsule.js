import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import LiquidGlass, { HAS_LIQUID_GLASS } from './LiquidGlass';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Capsule Liquid Glass macOS-style.
 * Props:
 *  - children : contenu (icônes, boutons, texte)
 *  - tint     : 'light' (default) | 'dark' — adapter au fond derrière
 *  - radius   : nombre (default 999 = capsule full-round). Override pour rectangle arrondi.
 *  - paddingH : padding horizontal (default 12)
 *  - paddingV : padding vertical (default 8)
 *  - gap      : espacement entre enfants direct (default 14)
 *  - style    : style supplémentaire sur le wrapper
 */
export default function LiquidGlassCapsule({
  children,
  tint = 'light',
  radius = 999,
  paddingH = 12,
  paddingV = 8,
  gap = 14,
  style,
  // v2 — opt into the native iOS 26 UIGlassEffect amplification (used by the
  // header capsule): prominent glass + subtle lime tint + touch interactivity.
  premium = false,
  glassStyle,
  tintColor,
  tintIntensity,
  interactive,
}) {
  const isLight = tint === 'light';
  const resolvedGlassStyle = glassStyle != null ? glassStyle : (premium ? 'prominent' : 'regular');
  const resolvedTintColor = tintColor != null ? tintColor : (premium ? '#B8E62E' : undefined);
  const resolvedTintIntensity = tintIntensity != null ? tintIntensity : (premium ? 0.10 : 0.18);
  const resolvedInteractive = interactive != null ? interactive : premium;
  return (
    <View style={[styles.wrap, { borderRadius: radius }, style]}>
      <LiquidGlass
        intensity={Platform.OS === 'ios' ? 70 : 100}
        tint={isLight ? 'light' : 'dark'}
        borderStyle={HAS_LIQUID_GLASS ? 'bright' : 'subtle'}
        borderRadius={radius}
        glassStyle={resolvedGlassStyle}
        tintColor={resolvedTintColor}
        tintIntensity={resolvedTintIntensity}
        interactive={resolvedInteractive}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Fallback (pas d'UIGlassEffect natif) : substrat sombre plus dense,
          aligné sur la densité de la tab bar (GlassView intensity 80) pour
          garder le texte lisible quand du contenu clair défile derrière. */}
      <View style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: isLight ? 'rgba(255,255,255,0.22)' : (HAS_LIQUID_GLASS ? 'rgba(20,20,28,0.30)' : 'rgba(20,20,28,0.42)') },
      ]} />
      {!HAS_LIQUID_GLASS ? (
        <LinearGradient
          colors={
            isLight
              ? ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']
              : ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']
          }
          locations={[0, 0.55]}
          style={styles.specHighlight}
          pointerEvents="none"
        />
      ) : null}
      {!HAS_LIQUID_GLASS ? (
        <View style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: radius,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: isLight ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.18)',
          },
        ]} pointerEvents="none" />
      ) : null}
      <View style={[
        styles.content,
        { paddingHorizontal: paddingH, paddingVertical: paddingV, gap },
      ]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  specHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '55%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
