// SessionBadge — pill arrondi en top-left d'une card 16:9. Frostée
// (BlurView intensity 25) + voile coloré par tone. Texte uppercase
// 11 px weight 700.
//
// `tone` : 'lime' | 'gold' | 'coral' | 'white'.
// Le mapping couleur vit dans `utils/sessionBadges.js#BADGE_TONES`.
//
// TV-only — zéro impact iPhone.

import { View, Text, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

import { BADGE_TONES } from '../../utils/sessionBadges';

export default function SessionBadge({ label, tone = 'lime', style }) {
  if (!label) return null;
  const t = BADGE_TONES[tone] || BADGE_TONES.lime;
  return (
    <View
      pointerEvents="none"
      style={[
        { borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: t.border },
        style,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.tint }]} pointerEvents="none" />
      <Text
        style={{
          paddingHorizontal: 10,
          paddingVertical: 6,
          fontSize: 11,
          fontWeight: '700',
          color: t.fg,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          textShadowColor: 'rgba(0,0,0,0.45)',
          textShadowRadius: 4,
          textShadowOffset: { width: 0, height: 1 },
        }}
      >
        {label}
      </Text>
    </View>
  );
}
