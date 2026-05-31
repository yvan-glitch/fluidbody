// GlassView — the substrate every other Liquid Glass surface layers on top of.
//
// Three stacked effects (bottom → top):
//   1. LiquidGlass         : real iOS 26 UIGlassEffect when available, otherwise
//                             falls back to expo-blur's BlurView (same API).
//   2. Substrate fill      : a translucent tint over the blur (per tint).
//   3. Specular highlight  : soft top-left → bottom-right white gradient (~135°).
//                             Skipped on iOS 26 because UIGlassEffect already
//                             renders a refractive specular as part of the material.
//   4. Bevel               : 1px bright top/left + 1px dark bottom/right (inset).
//                             Also skipped on iOS 26 since LiquidGlass paints
//                             its own gradient ring on the native side.
//
// Children are rendered above all of that. The outer wrapper carries the drop
// shadow (it must sit outside `overflow: hidden`, otherwise iOS clips it).
//
// On Android, BlurView falls back to a flat overlay (intensity 0); we
// compensate by bumping the substrate alpha so the surface still reads
// as a translucent material rather than fully transparent.
//
// THEME-AWARE: by default, every visual token (tint, substrate, bevel,
// highlight, shadow opacity) is pulled from the active theme via
// `useTheme()`. Pass `tint`, `substrateColor`, `forceDark`, etc. to
// override per-call — typically only the VideoPlayer overlay needs that
// since it always renders against pitch-black video.

import { View, StyleSheet, Platform } from 'react-native';
import LiquidGlass, { HAS_LIQUID_GLASS } from '../LiquidGlass';
import { GlassEnhanceOverlays } from '../LiquidGlassEnhanced';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GLASS_HIGHLIGHT_START,
  GLASS_HIGHLIGHT_END,
  GLASS_SHADOW_BASE,
} from './glassTokens';
import { useTheme, useForcedDarkTheme } from '../../theme/ThemeProvider';

export default function GlassView({
  children,
  intensity = 70,
  tint,                  // 'dark' | 'light' | 'default' — override theme.glass.tint
  borderRadius = 18,
  highlight = true,
  bevel = true,
  elevated = true,
  substrateColor,        // override for accent/branded glass (e.g. green CTA)
  forceDark = false,     // bypass theme — always render as dark glass (videoplayer overlay)
  enhanced = false,      // opt-in: amplified Liquid Glass v2 overlays (breathing + specular + lime ring)
  focused = false,       // tvOS focus state — intensifies the enhanced overlays
  // v2 native UIGlassEffect controls (forwarded to LiquidGlass). When
  // `enhanced` is on and these aren't explicitly set, we apply the premium
  // defaults: prominent glass, brand-lime tint, system interactivity.
  glassStyle,
  tintColor,
  tintIntensity,
  interactive,
  style,
  contentStyle,
  pointerEvents,
  accessibilityLabel,
}) {
  // `useForcedDarkTheme()` returns the dark palette without subscribing to
  // context — cheap, and avoids re-renders when the user toggles theme
  // while a video is playing.
  const themedTheme = useTheme().theme;
  const forcedTheme = useForcedDarkTheme();
  const theme = forceDark ? forcedTheme : themedTheme;
  const g = theme.glass;

  // Android's BlurView is unreliable; bump the substrate so we don't read
  // as a flat transparent rectangle. We also clamp the iOS intensity into
  // a sane range — anything above ~85 looks milky.
  const iosIntensity = Math.max(0, Math.min(95, intensity));
  const androidFallback = Platform.OS === 'android';

  const resolvedTint = tint || g.tint;
  const resolvedSubstrate = substrateColor || g.substrate;

  // v2/v3 native glass controls. `enhanced` surfaces opt into the premium look
  // (prominent glass + subtle brand-lime stained-glass tint + system
  // interactivity) unless the caller overrides a given knob explicitly.
  //
  // v3 (OTA, 2026-06): on iOS 26+ the real UIGlassEffect supports the `clear`
  // lens-warp style — noticeably more refractive than `prominent`. We default
  // enhanced surfaces to `clear` there, and keep `prominent` as the pre-26
  // fallback (the JS overlays carry the look on older OSes). Tint is bumped
  // 0.10 → 0.14 so the brand-lime stained-glass reads through the clearer lens.
  const BRAND_LIME = '#B8E62E';
  const IS_IOS26 = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;
  const resolvedGlassStyle = glassStyle != null
    ? glassStyle
    : (enhanced ? (IS_IOS26 ? 'clear' : 'prominent') : 'regular');
  const resolvedGlassTintColor = tintColor != null ? tintColor : (enhanced ? BRAND_LIME : undefined);
  const resolvedTintIntensity = tintIntensity != null ? tintIntensity : (enhanced ? 0.14 : 0.18);
  const resolvedInteractive = interactive != null ? interactive : enhanced;

  const shadowStyle = elevated
    ? Object.assign({}, GLASS_SHADOW_BASE, { shadowOpacity: g.shadowOpacity })
    : null;

  // The bevel is built from two stacked absolute layers: one painting the
  // bright top/left edges, the other painting the dark bottom/right edges.
  // Using borderTop/Left + borderBottom/Right on a single View would
  // collapse into mitered corners and break the radius.
  return (
    <View
      style={[shadowStyle, { borderRadius }, style]}
      pointerEvents={pointerEvents}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ borderRadius, overflow: 'hidden' }}>
        <LiquidGlass
          intensity={iosIntensity}
          tint={resolvedTint === 'default' ? 'default' : resolvedTint}
          borderStyle={HAS_LIQUID_GLASS ? (highlight ? 'subtle' : 'off') : 'subtle'}
          borderRadius={borderRadius}
          glassStyle={resolvedGlassStyle}
          tintColor={resolvedGlassTintColor}
          tintIntensity={resolvedTintIntensity}
          interactive={resolvedInteractive}
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
                ? bumpAlpha(resolvedSubstrate, 0.18)
                : resolvedSubstrate,
            },
          ]}
        />

        {highlight && !HAS_LIQUID_GLASS ? (
          <LinearGradient
            pointerEvents="none"
            colors={g.highlightColors}
            start={GLASS_HIGHLIGHT_START}
            end={GLASS_HIGHLIGHT_END}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {bevel && !HAS_LIQUID_GLASS ? (
          <>
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius,
                  borderTopWidth: 1,
                  borderLeftWidth: 1,
                  borderTopColor: g.bevelLight,
                  borderLeftColor: g.bevelLight,
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
                  borderBottomColor: g.bevelDark,
                  borderRightColor: g.bevelDark,
                  borderTopColor: 'transparent',
                  borderLeftColor: 'transparent',
                },
              ]}
            />
          </>
        ) : null}

        {/* Liquid Glass v2 amplification — sits above the substrate/bevel so
            the bloom and specular sweep read against the blurred backdrop,
            but below the content. OTA-only, fully JS. */}
        {enhanced ? (
          <GlassEnhanceOverlays
            borderRadius={borderRadius}
            focused={focused}
            intensity={intensity}
            amplify
          />
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
