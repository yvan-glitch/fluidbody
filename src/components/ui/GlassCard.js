// GlassCard — preset around GlassView for content cards.
//
// Defaults are tuned for translucent cards over rich backgrounds (the aquatic
// gradient + Meduses are the canonical reference). Use `padded` to opt into
// the standard inner padding without re-typing it.

import { View } from 'react-native';
import GlassView from './GlassView';
import GlassPressable from './GlassPressable';
import { GLASS_RADII } from './glassTokens';

export default function GlassCard({
  children,
  onPress,
  intensity = 60,
  tint = 'dark',
  borderRadius = GLASS_RADII.card,
  padded = true,
  padding,
  highlight = true,
  bevel = true,
  elevated = true,
  substrateColor,
  enhanced = false,
  glassStyle,
  tintColor,
  tintIntensity,
  interactive,
  style,
  accessibilityLabel,
  accessibilityHint,
}) {
  const resolvedPadding = padding != null ? padding : padded ? 16 : 0;
  const card = (
    <GlassView
      intensity={intensity}
      tint={tint}
      borderRadius={borderRadius}
      highlight={highlight}
      bevel={bevel}
      elevated={elevated}
      substrateColor={substrateColor}
      enhanced={enhanced}
      glassStyle={glassStyle}
      tintColor={tintColor}
      tintIntensity={tintIntensity}
      interactive={interactive}
      style={style}
      contentStyle={{ padding: resolvedPadding }}
    >
      {children}
    </GlassView>
  );
  if (!onPress) return card;
  return (
    <GlassPressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      {card}
    </GlassPressable>
  );
}
