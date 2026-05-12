// Liquid Glass design tokens — geometry, motion, and shadows.
//
// Colour-dependent tokens (bevel, highlight, substrate, hairline) live in
// `src/theme/index.js` so they swap on light/dark mode. This file only
// holds tokens that are theme-invariant: corner radii, durations, easing,
// press spring, and the shape of the drop shadow (opacity is themed,
// everything else stays constant).

import { Easing } from 'react-native';

export const GLASS_EASING = Easing.bezier(0.32, 0.72, 0, 1);

export const GLASS_DURATIONS = {
  micro: 180,   // press feedback
  fast: 280,    // pill fade, small swap
  base: 360,    // cards, list items, theme cross-fade
  sheet: 480,   // modales / sheets
};

// Specular highlight (top-left → bottom-right at ~135°).
// We approximate with a single LinearGradient since RN doesn't support
// arbitrary angles natively. The angle is implicit via start/end coords.
export const GLASS_HIGHLIGHT_START = { x: 0, y: 0 };
export const GLASS_HIGHLIGHT_END = { x: 1, y: 1 };

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

// Drop shadow geometry, shared across themes. `shadowOpacity` is provided
// per-theme via `theme.glass.shadowOpacity` and merged in GlassView.
export const GLASS_SHADOW_BASE = {
  shadowColor: '#000',
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
};

// Press feedback (spring config) and scale target.
export const GLASS_PRESS_SCALE = 0.97;
export const GLASS_PRESS_SPRING = { damping: 18, mass: 0.8, stiffness: 220 };

// Legacy re-exports — older code reaches in for raw colour tokens.
// We point them at the dark-theme values so any forgotten import still
// renders the same as before the theme system. Migration target: read
// from `theme.glass.*` via `useTheme()` instead.
export const GLASS_BEVEL_LIGHT = 'rgba(255,255,255,0.22)';
export const GLASS_BEVEL_DARK = 'rgba(0,0,0,0.18)';
export const GLASS_HIGHLIGHT_COLORS = ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)'];
export const GLASS_SUBSTRATE = {
  dark: 'rgba(20,20,28,0.28)',
  light: 'rgba(255,255,255,0.55)',
  default: 'rgba(80,80,100,0.18)',
};
export const GLASS_HAIRLINE = 'rgba(255,255,255,0.08)';
export const GLASS_SHADOW = Object.assign({}, GLASS_SHADOW_BASE, { shadowOpacity: 0.15 });
export const GLASS_SHADOW_SOFT = Object.assign({}, GLASS_SHADOW_BASE, { shadowOpacity: 0.10, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 });
