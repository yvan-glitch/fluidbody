// Compat shim. The original GlassButton is now `src/components/ui/GlassButton.js`,
// rebuilt on top of GlassView so it inherits the full Liquid Glass language
// (specular highlight, bevel, drop shadow, press spring, haptics).
//
// Existing call sites pass the same props (onPress, variant, size, textColor,
// textStyle, leftIcon, rightIcon, fullWidth, disabled, loading, style,
// accessibilityLabel, children) — those flow straight through.
//
// The legacy token re-exports (`GLASS_RADIUS`, etc.) are kept as no-op
// constants so any old imports continue to resolve. None are referenced
// outside this file as of the GlassView migration; keeping them avoids
// surprises if a forgotten branch tries to import them.

import GlassButton from './ui/GlassButton';
import { GLASS_RADII } from './ui/glassTokens';

export default GlassButton;

export const GLASS_RADIUS = GLASS_RADII.button;
export const GLASS_BORDER_COLOR = 'rgba(255,255,255,0.2)';
export const GLASS_BG_DEFAULT = 'rgba(20,20,28,0.45)';
export const GLASS_BG_DARK = 'rgba(0,0,0,0.55)';
