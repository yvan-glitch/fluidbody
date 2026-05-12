// GlassButton — Liquid Glass primary/secondary CTA.
//
// Built on GlassView + GlassPressable. Variants:
//   - default  : neutral glass for CTAs over photo/dark backgrounds
//   - accent   : tinted with the brand green — main CTA
//   - subtle   : near-transparent; "Restaurer mes achats" type links
//   - dark     : legacy always-dark pill (used on top of bright photos)
//   - yellow   : legacy profile-edit CTA (kept for the App.js call site)
//
// Variants pull substrate + text colours from the active theme, so a green
// CTA reads as a saturated `rgba(91,168,0,…)` over a light-glass card and
// the same shape reads as `rgba(174,239,77,…)` on dark glass — same
// JSX, no per-screen branching.
//
// Haptics are best-effort: we lazy-require `expo-haptics` so the button
// keeps working in Expo Go where the native module is absent.

import { Text, View, Platform, ActivityIndicator } from 'react-native';
import GlassView from './GlassView';
import GlassPressable from './GlassPressable';
import { GLASS_RADII } from './glassTokens';
import { useTheme } from '../../theme/ThemeProvider';

let HapticsMod = null;
try { HapticsMod = require('expo-haptics'); } catch (e) {}

function fireHaptic(kind) {
  if (Platform.OS === 'web' || !HapticsMod) return;
  try {
    if (kind === 'success') {
      HapticsMod.notificationAsync(HapticsMod.NotificationFeedbackType.Success);
    } else {
      HapticsMod.impactAsync(HapticsMod.ImpactFeedbackStyle.Light);
    }
  } catch (e) {}
}

// Build the variant table from the active theme. Keeps the call sites
// declarative (`variant="accent"`) while the colours adapt under the hood.
function buildVariants(theme) {
  const c = theme.colors;
  const g = theme.glass;
  const isLight = theme.mode === 'light';
  return {
    default: {
      substrate: g.substrate,
      tint: g.tint,
      text: c.text,
    },
    accent: {
      substrate: g.substrateAccent,
      tint: g.tint,
      text: c.accentText,
    },
    subtle: {
      // Slightly more transparent than `default`.
      substrate: isLight ? 'rgba(255,255,255,0.30)' : 'rgba(20,20,28,0.20)',
      tint: g.tint,
      text: c.textSecondary,
    },
    yellow: {
      // Legacy variant — the kept brand yellow. We dial up the substrate
      // opacity in light mode so the pill stays visible.
      substrate: isLight ? 'rgba(229,255,0,0.32)' : 'rgba(229,255,0,0.14)',
      tint: g.tint,
      text: isLight ? '#5C6A00' : '#E5FF00',
    },
    dark: {
      // Always-dark variant for CTAs sitting on bright photos / hero
      // images — ignores theme so it stays legible everywhere.
      substrate: 'rgba(0,0,0,0.55)',
      tint: 'dark',
      text: '#FFFFFF',
      forceDark: true,
    },
  };
}

const SIZE_HEIGHTS = { sm: 40, md: 48, lg: 56 };
const SIZE_FONTS = { sm: 13, md: 15, lg: 16 };

export default function GlassButton({
  children,
  onPress,
  disabled,
  loading,
  variant = 'default',
  size = 'md',
  fullWidth = true,
  haptic = 'light',           // 'light' | 'success' | 'none'
  forceDark = false,          // force the dark palette (VideoPlayer overlay)
  leftIcon,
  rightIcon,
  textColor,
  textStyle,
  style,
  accessibilityLabel,
  accessibilityHint,
}) {
  const ctxTheme = useTheme().theme;
  // When `forceDark` is set, bypass the active theme and render variants
  // from the dark palette — used on top of always-dark backdrops (video).
  const theme = forceDark
    ? require('../../theme').darkTheme
    : ctxTheme;
  const variants = buildVariants(theme);
  const v = variants[variant] || variants.default;
  const h = SIZE_HEIGHTS[size] || SIZE_HEIGHTS.md;
  const f = SIZE_FONTS[size] || SIZE_FONTS.md;
  const resolvedTextColor = textColor || v.text;

  function handlePress(e) {
    if (disabled || loading) return;
    if (haptic !== 'none') fireHaptic(haptic);
    if (onPress) onPress(e);
  }

  return (
    <GlassPressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
      accessibilityHint={accessibilityHint}
      style={{
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        opacity: (disabled || loading) ? 0.45 : 1,
      }}
    >
      <GlassView
        intensity={70}
        tint={v.tint}
        forceDark={forceDark || !!v.forceDark}
        borderRadius={GLASS_RADII.button}
        substrateColor={v.substrate}
        style={style}
        contentStyle={{
          height: h,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
        {loading ? (
          <ActivityIndicator color={resolvedTextColor} size="small" />
        ) : typeof children === 'string' ? (
          <Text
            style={[{
              fontSize: f,
              fontWeight: '700',
              color: resolvedTextColor,
              letterSpacing: -0.2,
            }, textStyle]}
            numberOfLines={1}
          >
            {children}
          </Text>
        ) : children}
        {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
      </GlassView>
    </GlassPressable>
  );
}
