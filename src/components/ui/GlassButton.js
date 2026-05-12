// GlassButton — Liquid Glass primary/secondary CTA.
//
// Built on GlassView + GlassPressable. Three variants:
//   - default  : neutral dark glass (CTAs over photo/dark backgrounds)
//   - accent   : tinted with the brand green (#AEEF4D) — for the main CTA
//   - subtle   : near-transparent; used for "Restaurer mes achats" type links
//
// Haptics are best-effort: we lazy-require `expo-haptics` so the button keeps
// working in Expo Go where the native module is absent.

import { Text, View, Platform, ActivityIndicator } from 'react-native';
import GlassView from './GlassView';
import GlassPressable from './GlassPressable';
import { GLASS_RADII } from './glassTokens';

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

const VARIANT_STYLES = {
  default: {
    substrate: 'rgba(20,20,28,0.45)',
    tint: 'dark',
    text: '#FFFFFF',
  },
  accent: {
    substrate: 'rgba(174,239,77,0.18)',
    tint: 'dark',
    text: '#AEEF4D',
  },
  subtle: {
    substrate: 'rgba(20,20,28,0.20)',
    tint: 'dark',
    text: 'rgba(255,255,255,0.78)',
  },
  // Legacy variant kept for the profile-edit CTA in App.js (~1938).
  // Same shape as `accent`, but with the previous yellow brand colour.
  yellow: {
    substrate: 'rgba(229,255,0,0.14)',
    tint: 'dark',
    text: '#E5FF00',
  },
  // Legacy variant: pitch-black opaque pill (used to be `dark`).
  dark: {
    substrate: 'rgba(0,0,0,0.55)',
    tint: 'dark',
    text: '#FFFFFF',
  },
};

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
  leftIcon,
  rightIcon,
  textColor,
  textStyle,
  style,
  accessibilityLabel,
  accessibilityHint,
}) {
  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
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
