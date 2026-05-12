// Liquid Glass design tokens for FluidBody.
//
// Centralised so screens import constants instead of re-typing rgba strings,
// and so the substrate can be tuned in one place (e.g. when we hook up a
// light-mode pass later).
//
// Apple-style easing curve, used for every glass transition.
import { Easing } from 'react-native';

export const GLASS_EASING = Easing.bezier(0.32, 0.72, 0, 1);

export const GLASS_DURATIONS = {
  micro: 180,   // press feedback
  fast: 280,    // pill fade, small swap
  base: 360,    // cards, list items
  sheet: 480,   // modales / sheets
};

// Specular highlight (top-left → bottom-right at ~135°).
// We approximate with a single LinearGradient since RN doesn't support
// arbitrary angles natively. The angle is implicit via start/end coords.
export const GLASS_HIGHLIGHT_COLORS = ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)'];
export const GLASS_HIGHLIGHT_START = { x: 0, y: 0 };
export const GLASS_HIGHLIGHT_END = { x: 1, y: 1 };

// Bevel — 1px inset on the inner edge. Top/left bright, bottom/right shadow.
export const GLASS_BEVEL_LIGHT = 'rgba(255,255,255,0.22)';
export const GLASS_BEVEL_DARK = 'rgba(0,0,0,0.18)';

// Card & button substrates (additive over the BlurView).
// Kept very translucent — the blur does the heavy lifting.
export const GLASS_SUBSTRATE = {
  dark: 'rgba(20,20,28,0.28)',
  light: 'rgba(255,255,255,0.18)',
  default: 'rgba(80,80,100,0.18)',
};

// Hairline separators inside glass surfaces.
export const GLASS_HAIRLINE = 'rgba(255,255,255,0.08)';

// Continuous-ish corner radii (RN doesn't render true squircles, but these
// scales feel close enough to iOS continuous corners).
export const GLASS_RADII = {
  pill: 999,
  button: 14,
  card: 20,
  cardLg: 24,
  sheet: 28,
  modal: 32,
};

// Default shadow tier. iOS uses shadowColor/shadow*, Android uses elevation —
// merged into one style object that works on both.
export const GLASS_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.15,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
};

export const GLASS_SHADOW_SOFT = {
  shadowColor: '#000',
  shadowOpacity: 0.10,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
};

// Press feedback (spring config) and scale target.
export const GLASS_PRESS_SCALE = 0.97;
export const GLASS_PRESS_SPRING = { damping: 18, mass: 0.8, stiffness: 220 };
