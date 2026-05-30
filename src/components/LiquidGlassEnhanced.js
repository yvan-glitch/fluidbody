// LiquidGlassEnhanced — OTA-only amplification layer on top of <LiquidGlass>.
//
// We do NOT touch the native iOS 26 UIGlassEffect module (build #86). Instead
// this composes a few cheap, fully-JS Animated layers OVER the glass so the
// surface reads closer to Apple's most recent Liquid Glass chrome:
//
//   1. topReflection      — a 1px bright line along the top edge (the signature
//                            specular catch of Apple's system glass).
//   2. breathingHighlight  — a soft central lime bloom that pulses 0.3 → 0.6
//                            over ~6s. Gives the material a slow "alive" feel.
//   3. specularSweep       — a skewed translucent band that sweeps left→right
//                            every ~8s, like light raking across the surface.
//   4. limeBorder          — a subtle brand-lime ring above the native border.
//
// All overlays are `pointerEvents="none"` so they never intercept touches.
//
// `GlassEnhanceOverlays` is exported separately so surfaces that build their own
// blur substrate (e.g. the tvOS `GlassCardTV`, which uses BlurView directly and
// must NOT be wrapped in a second LiquidGlass) can drop in the same layers
// without a redundant blur pass.
//
// Accessibility: respects `prefers-reduced-motion`. When reduce-motion is on,
// the breathing loop and the specular sweep are skipped — the layers render
// statically at their mid values so the look is preserved without animation.
//
// Focus (tvOS): pass `focused` to intensify the breathing bloom and brighten
// the lime ring. Caller drives it from the Touchable onFocus/onBlur.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, StyleSheet, AccessibilityInfo } from 'react-native';
import LiquidGlass from './LiquidGlass';

// Brand lime — same token used across the Fluidbody glass system.
const LIME = '184, 230, 46';

// Shared hook: subscribe to the OS reduce-motion preference.
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => { if (mounted) setReduced(!!v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      setReduced(!!v);
    });
    return () => {
      mounted = false;
      try { sub && sub.remove ? sub.remove() : AccessibilityInfo.removeEventListener?.('reduceMotionChanged', setReduced); } catch (e) {}
    };
  }, []);
  return reduced;
}

// GlassEnhanceOverlays — the four animated layers, with no blur of their own.
// Drop on top of any glass/blur substrate. Fills its parent (absolute).
export function GlassEnhanceOverlays({ borderRadius = 12, focused = false, accent = LIME, intensity = 50 }) {
  const reducedMotion = useReducedMotion();

  // Scale the visual energy with `intensity` (0-100) so a quiet card and a
  // hero CTA don't get the same bloom. Clamped to a tasteful ceiling.
  const energy = Math.max(0, Math.min(1, intensity / 100));

  const breathOpacity = useRef(new Animated.Value(0.3)).current;
  const specularX = useRef(new Animated.Value(-1)).current;
  const focusAnim = useRef(new Animated.Value(0)).current;

  // Breathing + specular loops. Re-armed when reduce-motion flips.
  useEffect(() => {
    if (reducedMotion) {
      // Static mid-render — no loops.
      breathOpacity.setValue(0.42);
      specularX.setValue(0);
      return;
    }
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breathOpacity, { toValue: 0.6, duration: 3000, useNativeDriver: true }),
        Animated.timing(breathOpacity, { toValue: 0.3, duration: 3000, useNativeDriver: true }),
      ])
    );
    const sweep = Animated.loop(
      Animated.timing(specularX, { toValue: 1, duration: 8000, useNativeDriver: true })
    );
    breathing.start();
    sweep.start();
    return () => {
      try { breathing.stop(); sweep.stop(); } catch (e) {}
      specularX.setValue(-1);
    };
  }, [reducedMotion]);

  // Focus ramp — opacity-only so it stays on the native driver.
  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: focused ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  // When focused, push the breathing bloom and the lime ring brighter. We layer
  // a second, focus-driven highlight on top rather than re-targeting the loop,
  // so the breathing keeps running underneath.
  const breathFinalOpacity = breathOpacity.interpolate({
    inputRange: [0.3, 0.6],
    outputRange: [0.18 + 0.4 * energy, 0.34 + 0.5 * energy],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* 1. top reflection — Apple's signature edge catch */}
      <View style={styles.topReflection} />

      {/* 2. breathing highlight — central lime bloom */}
      <Animated.View
        style={[
          styles.breathingHighlight,
          { backgroundColor: `rgba(${accent}, 0.08)`, opacity: breathFinalOpacity },
        ]}
      />

      {/* focus bloom — only visible when focused (tvOS) */}
      <Animated.View
        style={[
          styles.breathingHighlight,
          {
            backgroundColor: `rgba(${accent}, 0.16)`,
            opacity: focusAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }),
          },
        ]}
      />

      {/* 3. specular sweep — raking light band */}
      <Animated.View
        style={[
          styles.specularSweep,
          {
            transform: [
              { skewX: '-15deg' },
              {
                translateX: specularX.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ['-120%', '120%'],
                }),
              },
            ],
          },
        ]}
      />

      {/* 4. lime border — subtle brand ring above the native border */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius,
            borderWidth: 1,
            borderColor: `rgba(${accent}, 0.25)`,
          },
        ]}
      />
      {/* focus ring brighten */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius,
            borderWidth: 1.5,
            borderColor: `rgba(${accent}, 0.7)`,
            opacity: focusAnim,
          },
        ]}
      />
    </View>
  );
}

// LiquidGlassEnhanced — standalone wrapper: real glass + the overlay layers,
// with `children` rendered above everything. Use where you'd reach for
// <LiquidGlass> directly and want the amplified look (e.g. modal surfaces).
export default function LiquidGlassEnhanced({
  children,
  style,
  intensity = 50,
  borderRadius = 12,
  focused = false,
  accent = LIME,
  // v2 native UIGlassEffect knobs. "Premium" defaults: prominent glass,
  // brand-lime stained-glass tint at 0.10, system interactivity. On iOS 26
  // these drive the real UIGlassEffect; on the fallback path they're no-ops
  // and the JS overlays below carry the look. Any can be overridden per call.
  glassStyle = 'prominent',
  tintColor = '#B8E62E',     // brand lime (== `LIME` rgb 184,230,46)
  tintIntensity = 0.10,
  interactive = true,
  ...rest
}) {
  return (
    <LiquidGlass
      style={style}
      intensity={intensity}
      borderRadius={borderRadius}
      glassStyle={glassStyle}
      tintColor={tintColor}
      tintIntensity={tintIntensity}
      interactive={interactive}
      {...rest}
    >
      <GlassEnhanceOverlays
        borderRadius={borderRadius}
        focused={focused}
        accent={accent}
        intensity={intensity}
      />
      {children}
    </LiquidGlass>
  );
}

const styles = StyleSheet.create({
  topReflection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  breathingHighlight: {
    position: 'absolute',
    top: '20%',
    left: '20%',
    right: '20%',
    bottom: '20%',
    borderRadius: 999,
    transform: [{ scale: 1.5 }],
  },
  specularSweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '40%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
});
