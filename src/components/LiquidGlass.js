// LiquidGlass — drop-in replacement for <BlurView> that uses the real
// iOS 26 UIGlassEffect (Apple's "Liquid Glass" material) when available,
// and falls back to expo-blur everywhere else.
//
// Pass-through API (so call sites can swap blindly):
//   intensity   number  0-100         — only consumed by the BlurView fallback
//   tint        string  'dark'|'light'|'default'|… — BlurView tints
//   style       any                    — wrapper styling
//
// Liquid-Glass-specific extras:
//   borderStyle 'subtle'|'bright'|'off'  — luminous edge gradient
//   glassTint   color                   — optional translucent overlay
//
// Detection is conservative: we only route to the native module when
//   1. Platform.OS === 'ios'
//   2. parseInt(Platform.Version) >= 26  (iOS 26+)
//   3. UIManager.hasViewManagerConfig('LiquidGlassView') is true
// so Expo Go (no native module compiled in), tvOS, Android, and iOS 25
// all silently fall through to <BlurView>.
//
// Border (the detail Yvan cares about): the native view paints a 1pt
// CAGradientLayer ring, top → bottom, alpha 0.45 → 0.08 in 'subtle',
// 0.70 → 0.15 in 'bright'. That's what catches the light like Apple's
// system chrome — and unlike the pure-CSS border we had before, the
// gradient is rendered by Core Animation in the same compositing pass
// as UIGlassEffect, so the highlight tracks the live blur.

import { requireNativeComponent, UIManager, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

// iPhone/iPad → 'LiquidGlassView' (iOS 26.x UIGlassEffect, full v2 API).
// Apple TV     → 'LiquidGlassTVView' (UIGlassEffect on tvOS 26 + a
//                focus-responsive specular sheen; see
//                plugins/LiquidGlass/LiquidGlassTVView.swift).
// react-native-tvos reports Platform.OS === 'ios' on tvOS, so we branch on
// Platform.isTV to pick the right view-manager name.
const IOS_VIEW_NAME = 'LiquidGlassView';
const TV_VIEW_NAME = 'LiquidGlassTVView';
const NATIVE_VIEW_NAME = Platform.isTV ? TV_VIEW_NAME : IOS_VIEW_NAME;

// True when we're routing to the tvOS module — call sites (GlassCardTV) use
// this to forward the extra focused/accent props the TV view understands.
export const IS_TV_GLASS = Platform.isTV === true;

// Probe whether the native view is actually registered in this binary.
// requireNativeComponent itself doesn't throw for missing views — it returns
// a stub — so we use UIManager as the source of truth.
function hasNativeLiquidGlass() {
  if (Platform.OS !== 'ios') return false;
  // tvOS 26 and iOS 26 both gained UIGlassEffect; gate on version 26+ and
  // let the UIManager probe confirm the right view manager is compiled in.
  const version = parseInt(String(Platform.Version), 10);
  if (!Number.isFinite(version) || version < 26) return false;
  try {
    if (typeof UIManager.hasViewManagerConfig === 'function') {
      return UIManager.hasViewManagerConfig(NATIVE_VIEW_NAME);
    }
    return !!UIManager.getViewManagerConfig?.(NATIVE_VIEW_NAME);
  } catch (e) {
    return false;
  }
}

const NATIVE_AVAILABLE = hasNativeLiquidGlass();

let LiquidGlassNative = null;
if (NATIVE_AVAILABLE) {
  try {
    LiquidGlassNative = requireNativeComponent(NATIVE_VIEW_NAME);
  } catch (e) {
    LiquidGlassNative = null;
  }
}

export default function LiquidGlass({
  children,
  style,
  intensity = 60,
  tint = 'dark',
  borderStyle = 'subtle',
  glassTint,
  borderRadius,
  // v2 — iOS 26.x UIGlassEffect props (no-ops on the BlurView fallback):
  glassStyle = 'regular',   // 'automatic'|'regular'|'thin'|'prominent'|'clear'
  tintColor,                // brand hex (#B8E62E …) → real UIGlassEffect.tintColor
  tintIntensity = 0.18,     // 0-1 strength applied as the tint alpha
  interactive = false,      // system glass expand/highlight on touch + tap burst
  cornerRadius,             // alias for borderRadius (matches the v2 prop name)
  // tvOS-only extras (consumed by LiquidGlassTVView; ignored elsewhere):
  //   focused — intensifies the specular sheen + tint when the wrapping
  //             TouchableOpacity gains Siri-Remote focus
  //   accent  — 'cyan' (default) | 'green' lime, tints the edge + sheen
  focused = false,
  accent = 'cyan',
  ...rest
}) {
  if (LiquidGlassNative) {
    // Forward borderRadius to both the RN wrapper style and the native
    // prop so UIVisualEffectView can clip to the same radius. Without
    // glassCornerRadius the effect view stays square and we'd see a
    // square blur peeking out of a rounded RN container.
    const radiusInput =
      typeof cornerRadius === 'number' ? cornerRadius : borderRadius;
    const resolvedRadius =
      typeof radiusInput === 'number' ? radiusInput : undefined;
    // `tintColor` is the v2 name; `glassTint` is the legacy name. Either maps
    // onto the native `glassTint` UIColor prop (real UIGlassEffect.tintColor
    // on iOS 26).
    const resolvedTint = tintColor != null ? tintColor : glassTint;
    // The tvOS view manager (LiquidGlassTVView) exposes a different prop
    // surface than the iOS one: focus-driven sheen (glassFocused) + accent,
    // and NOT glassStyle/tintIntensity/interactive. Forward only the props
    // each view actually declares so RN doesn't warn on unknown props.
    const nativeProps = IS_TV_GLASS
      ? { glassFocused: !!focused, accent }
      : {
          glassStyle,
          tintIntensity: Math.max(0, Math.min(1, tintIntensity)),
          interactive: !!interactive,
        };
    return (
      <LiquidGlassNative
        style={[
          resolvedRadius != null ? { borderRadius: resolvedRadius } : null,
          style,
        ]}
        glassIntensity={Math.max(0, Math.min(1, intensity / 100))}
        borderStyle={borderStyle}
        glassTint={resolvedTint}
        glassCornerRadius={resolvedRadius ?? 0}
        {...nativeProps}
        {...rest}
      >
        {children}
      </LiquidGlassNative>
    );
  }
  return (
    <BlurView
      intensity={intensity}
      tint={tint}
      style={style}
      {...rest}
    >
      {children}
    </BlurView>
  );
}

// Exposed for callers that need to branch on availability (e.g. to drop
// the JS specular-highlight overlay when the native border is doing it).
export const HAS_LIQUID_GLASS = NATIVE_AVAILABLE;
