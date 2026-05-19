// EmptyState — Liquid Glass empty-state card.
//
// One reusable shape for "nothing to show yet" moments across the app:
//   - Bibliothèque (search returns 0)
//   - Favoris (no favorite saved yet)
//   - MyPrograms (no program created)
//   - Resume (no session completed)
//   - Activity (HealthKit not authorised)
//
// Props are intentionally minimal — render-prop your own icon if needed,
// otherwise the component falls back to a soft circle dot so the layout
// stays balanced.

import { View, Text } from 'react-native';
import { GlassCard, GlassButton } from './ui';
import { useTheme } from '../theme/ThemeProvider';

export default function EmptyState({
  icon,             // node, optional — render-prop for an SVG/Image
  title,            // string, required
  description,      // string, optional
  ctaLabel,         // string, optional — when set, renders an accent GlassButton
  onCtaPress,       // function, called when ctaLabel is tapped
  compact = false,  // tighter padding for inline use (inside a card row)
  align = 'center', // 'center' | 'left'
  style,
}) {
  const { theme } = useTheme();
  const padding = compact ? 14 : 22;
  const alignItems = align === 'left' ? 'flex-start' : 'center';
  const textAlign = align === 'left' ? 'left' : 'center';

  return (
    <GlassCard padded padding={padding} style={style}>
      <View style={{ alignItems: alignItems }}>
        {icon ? (
          <View style={{ marginBottom: 12 }}>{icon}</View>
        ) : (
          // Default — soft accent dot so the card doesn't read as a flat
          // wall of text. Keeps the visual rhythm with the rest of the
          // app where empty states use the méduse hero icon.
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.glass.substrateAccent,
              marginBottom: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accentText, opacity: 0.85 }} />
          </View>
        )}
        <Text
          style={{
            fontSize: compact ? 14 : 17,
            fontWeight: '700',
            color: theme.colors.text,
            textAlign: textAlign,
            marginBottom: description ? 6 : 0,
          }}
        >
          {title}
        </Text>
        {description ? (
          <Text
            style={{
              fontSize: compact ? 12 : 13,
              color: theme.colors.textSecondary,
              textAlign: textAlign,
              lineHeight: compact ? 17 : 19,
              marginBottom: ctaLabel ? 14 : 0,
            }}
          >
            {description}
          </Text>
        ) : null}
        {ctaLabel ? (
          <GlassButton
            variant="accent"
            size={compact ? 'sm' : 'md'}
            onPress={onCtaPress}
            fullWidth={!compact}
          >
            {ctaLabel}
          </GlassButton>
        ) : null}
      </View>
    </GlassCard>
  );
}
