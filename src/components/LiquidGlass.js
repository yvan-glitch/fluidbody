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

const NATIVE_VIEW_NAME = 'LiquidGlassView';

// Probe whether the native view is actually registered in this binary.
// requireNativeComponent itself doesn't throw for missing views — it returns
// a stub — so we use UIManager as the source of truth.
function hasNativeLiquidGlass() {
  if (Platform.OS !== 'ios') return false;
  if (Platform.isTV) return false;
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
  ...rest
}) {
  if (LiquidGlassNative) {
    // Forward borderRadius to both the RN wrapper style and the native
    // prop so UIVisualEffectView can clip to the same radius. Without
    // glassCornerRadius the effect view stays square and we'd see a
    // square blur peeking out of a rounded RN container.
    const resolvedRadius =
      typeof borderRadius === 'number' ? borderRadius : undefined;
    return (
      <LiquidGlassNative
        style={[
          resolvedRadius != null ? { borderRadius: resolvedRadius } : null,
          style,
        ]}
        glassIntensity={Math.max(0, Math.min(1, intensity / 100))}
        borderStyle={borderStyle}
        glassTint={glassTint}
        glassCornerRadius={resolvedRadius ?? 0}
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
