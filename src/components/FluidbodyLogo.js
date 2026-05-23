// FluidbodyLogo — wordmark FLUIDBODY+ réutilisable (iPhone + iPad + Apple TV).
//
// Texte blanc bold + signe plus vert lime (`#AEEF4D`) qui pulse via
// AnimatedPlus. Tailles préréglées : `iphone` (28), `tv` (44), `tv-large`
// (60). Avant ce composant, le markup était dupliqué dans MonCorps et les
// composants TV — sortir le motif évite la dérive (couleur, weight, signe).

import { Text, StyleSheet } from 'react-native';

import AnimatedPlus from './AnimatedPlus';

const PRESETS = {
  'iphone':   { word: 28, plus: 34, letterSpacing: -0.2 },
  'iphone-sm':{ word: 22, plus: 28, letterSpacing: -0.2 },
  'tv':       { word: 44, plus: 54, letterSpacing: -0.3 },
  'tv-large': { word: 60, plus: 72, letterSpacing: -0.5 },
};

export default function FluidbodyLogo({ size = 'iphone', style, accentColor = '#AEEF4D' }) {
  const p = PRESETS[size] || PRESETS.iphone;
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit={size === 'iphone' || size === 'iphone-sm'}
      minimumFontScale={0.85}
      style={[styles.word, { fontSize: p.word, letterSpacing: p.letterSpacing }, style]}
    >
      FLUIDBODY
      <AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: accentColor, fontSize: p.plus }}>+</AnimatedPlus>
    </Text>
  );
}

const styles = StyleSheet.create({
  word: {
    fontWeight: '900',
    color: '#ffffff',
  },
});
