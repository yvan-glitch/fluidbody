// FluidBody theme palettes.
//
// Two themes ship today: `darkTheme` (the existing aquatic premium look)
// and `lightTheme` (new — clear, premium, retains the fluid feel).
//
// Both expose the same shape so a component just reads `theme.colors.text`
// or `theme.glass.substrate` without branching on mode. Mode-specific
// branching belongs here, not in screen code.
//
// Shape (frozen, mirror it when adding a third theme later):
// {
//   mode:        'dark' | 'light',
//   colors: {
//     bg, bgGradient, surface, surfaceMuted,
//     text, textSecondary, textTertiary,
//     accent,            // brand green for backgrounds/borders
//     accentText,        // accent colour safe to use as text on `surface`
//     accentDeep,        // saturated teal (jellyfish) for secondary accents
//     danger,
//     hairline,
//     statusBarStyle,    // 'light-content' | 'dark-content'
//   },
//   glass: {
//     tint,              // BlurView tint
//     substrate,
//     substrateAccent,   // tinted-green substrate (for the "active" state)
//     substrateDanger,   // tinted-red substrate (warnings)
//     bevelLight,
//     bevelDark,
//     highlightColors,   // 2-stop array for the specular gradient
//     shadowOpacity,
//   },
// }

export const darkTheme = Object.freeze({
  mode: 'dark',
  colors: {
    bg: '#000a1a',
    bgGradient: ['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4'],
    bgGradientStops: [0, 0.18, 0.4, 0.6, 0.82, 1],
    surface: 'rgba(20,20,28,0.30)',
    surfaceMuted: 'rgba(0,18,38,0.35)',
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.62)',
    textTertiary: 'rgba(255,255,255,0.4)',
    accent: '#AEEF4D',
    accentText: '#AEEF4D',
    accentDeep: '#00BDD0',
    danger: '#FF3B30',
    hairline: 'rgba(255,255,255,0.08)',
    statusBarStyle: 'light-content',
  },
  glass: {
    tint: 'dark',
    substrate: 'rgba(20,20,28,0.28)',
    substrateAccent: 'rgba(174,239,77,0.16)',
    substrateDanger: 'rgba(255,80,80,0.12)',
    bevelLight: 'rgba(255,255,255,0.22)',
    bevelDark: 'rgba(0,0,0,0.18)',
    highlightColors: ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)'],
    shadowOpacity: 0.15,
  },
});

export const lightTheme = Object.freeze({
  mode: 'light',
  colors: {
    // Slightly bluish off-white at the top, drifting into a paler turquoise
    // at the bottom — keeps the "fluid" identity without going milky-white.
    bg: '#EEF2F7',
    bgGradient: ['#F5F7FB', '#E8F1F8', '#D6E9F3', '#BFDDEB', '#A5CFE0', '#8EC2D6'],
    bgGradientStops: [0, 0.18, 0.4, 0.6, 0.82, 1],
    surface: 'rgba(255,255,255,0.55)',
    surfaceMuted: 'rgba(255,255,255,0.45)',
    text: '#1A1F2E',
    textSecondary: '#5B6478',
    textTertiary: '#9CA3AF',
    // Brand green stays for backgrounds; for *text on light glass* we use a
    // deeper variant that passes WCAG AA (~5:1 on the substrate).
    accent: '#5BA800',
    accentText: '#3E7E00',
    accentDeep: '#007288',
    danger: '#D9342B',
    hairline: 'rgba(0,0,0,0.07)',
    statusBarStyle: 'dark-content',
  },
  glass: {
    tint: 'light',
    substrate: 'rgba(255,255,255,0.55)',
    substrateAccent: 'rgba(91,168,0,0.16)',
    substrateDanger: 'rgba(217,52,43,0.10)',
    bevelLight: 'rgba(255,255,255,0.90)',
    bevelDark: 'rgba(0,0,0,0.05)',
    highlightColors: ['rgba(255,255,255,0.70)', 'rgba(255,255,255,0.15)'],
    shadowOpacity: 0.08,
  },
});

// Resolve an arbitrary user-chosen mode against the system colour scheme.
// `mode` is what the user picked ('auto' | 'light' | 'dark'); `system` is
// whatever `useColorScheme()` returned (`'light'`, `'dark'`, or `null`).
// When the system value is null (rare, but possible in Expo Go on Android),
// we fall back to dark — that's the canonical FluidBody look.
export function resolveTheme(mode, system) {
  const effective = mode === 'auto' ? (system === 'light' ? 'light' : 'dark') : mode;
  return effective === 'light' ? lightTheme : darkTheme;
}

export const THEME_MODES = ['auto', 'light', 'dark'];

export const THEME_STORAGE_KEY = 'fluid_theme_mode';
