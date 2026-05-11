import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
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
}) {
  const isLight = tint === 'light';
  return (
    <View style={[styles.wrap, { borderRadius: radius }, style]}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 70 : 100}
        tint={isLight ? 'light' : 'dark'}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: isLight ? 'rgba(255,255,255,0.22)' : 'rgba(20,20,28,0.30)' },
      ]} />
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
      <View style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: radius,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: isLight ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.18)',
        },
      ]} pointerEvents="none" />
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
