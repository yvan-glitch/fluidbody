// GlassView — the substrate every other Liquid Glass surface layers on top of.
//
// Three stacked effects (bottom → top):
//   1. BlurView           : the actual frosted-glass blur
//   2. Substrate fill     : a translucent tint over the blur (per tint)
//   3. Specular highlight : a soft top-left → bottom-right white gradient (~135°)
//   4. Bevel              : 1px bright top/left + 1px dark bottom/right (inset)
//
// Children are rendered above all of that. The outer wrapper carries the drop
// shadow (it must sit outside `overflow: hidden`, otherwise iOS clips it).
//
// On Android, BlurView falls back to a flat overlay (intensity 0); we
// compensate by bumping the substrate alpha so the surface still reads
// as a translucent material rather than fully transparent.

import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GLASS_HIGHLIGHT_COLORS,
  GLASS_HIGHLIGHT_START,
  GLASS_HIGHLIGHT_END,
  GLASS_BEVEL_LIGHT,
  GLASS_BEVEL_DARK,
  GLASS_SUBSTRATE,
  GLASS_SHADOW,
} from './glassTokens';

function pickSubstrate(tint) {
  if (tint === 'dark') return GLASS_SUBSTRATE.dark;
  if (tint === 'light') return GLASS_SUBSTRATE.light;
  return GLASS_SUBSTRATE.default;
}

export default function GlassView({
  children,
  intensity = 70,
  tint = 'default',
  borderRadius = 18,
  highlight = true,
  bevel = true,
  elevated = true,
  substrateColor,        // override for accent/branded glass (e.g. green CTA)
  style,
  contentStyle,
  pointerEvents,
  accessibilityLabel,
}) {
  // Android's BlurView is unreliable; bump the substrate so we don't read
  // as a flat transparent rectangle. We also clamp the iOS intensity into
  // a sane range — anything above ~85 looks milky.
  const iosIntensity = Math.max(0, Math.min(95, intensity));
  const androidFallback = Platform.OS === 'android';
  const substrate = substrateColor || pickSubstrate(tint);

  // The bevel is built from two stacked absolute layers: one painting the
  // bright top/left edges, the other painting the dark bottom/right edges.
  // Using borderTop/Left + borderBottom/Right on a single View would
  // collapse into mitered corners and break the radius.
  return (
    <View
      style={[
        elevated ? GLASS_SHADOW : null,
        { borderRadius },
        style,
      ]}
      pointerEvents={pointerEvents}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ borderRadius, overflow: 'hidden' }}>
        <BlurView
          intensity={iosIntensity}
          tint={tint === 'default' ? 'default' : tint}
          style={StyleSheet.absoluteFill}
        />

        {/* Substrate fill. On Android we lean a touch heavier since the
            BlurView can't do its job — keeps the material readable. */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: androidFallback
                ? bumpAlpha(substrate, 0.18)
                : substrate,
            },
          ]}
        />

        {highlight ? (
          <LinearGradient
            pointerEvents="none"
            colors={GLASS_HIGHLIGHT_COLORS}
            start={GLASS_HIGHLIGHT_START}
            end={GLASS_HIGHLIGHT_END}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {bevel ? (
          <>
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius,
                  borderTopWidth: 1,
                  borderLeftWidth: 1,
                  borderTopColor: GLASS_BEVEL_LIGHT,
                  borderLeftColor: GLASS_BEVEL_LIGHT,
                  borderRightColor: 'transparent',
                  borderBottomColor: 'transparent',
                  borderRightWidth: 1,
                  borderBottomWidth: 1,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius,
                  borderBottomWidth: 1,
                  borderRightWidth: 1,
                  borderTopWidth: 1,
                  borderLeftWidth: 1,
                  borderBottomColor: GLASS_BEVEL_DARK,
                  borderRightColor: GLASS_BEVEL_DARK,
                  borderTopColor: 'transparent',
                  borderLeftColor: 'transparent',
                },
              ]}
            />
          </>
        ) : null}

        <View style={contentStyle}>
          {children}
        </View>
      </View>
    </View>
  );
}

// Tiny helper — bumps the alpha of an `rgba(...)` string by a delta clamped to 1.
// Used to give Android a slightly denser substrate (no BlurView to lean on).
function bumpAlpha(rgba, delta) {
  if (typeof rgba !== 'string') return rgba;
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgba;
  const parts = m[1].split(',').map((p) => p.trim());
  if (parts.length < 3) return rgba;
  const r = parts[0], g = parts[1], b = parts[2];
  const a = parts.length >= 4 ? parseFloat(parts[3]) : 1;
  const next = Math.max(0, Math.min(1, a + delta));
  return `rgba(${r},${g},${b},${next})`;
}
