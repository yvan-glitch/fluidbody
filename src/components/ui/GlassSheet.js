// GlassSheet — bottom-sheet/modal surface in the Liquid Glass language.
//
// Wraps the content in a GlassView with sheet-tier corner radius and a
// grabber handle at the top. Caller is responsible for the Modal/Animated
// presentation around it (we deliberately don't lock you into a single
// transition style — paywall slides fullscreen, profile picker slides up
// 60%, etc).
//
// Tint defaults to the theme's glass tint so the sheet feels coherent
// with the rest of the surface. Pass `tint` explicitly to override.

import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassView from './GlassView';
import GlassPressable from './GlassPressable';
import { GLASS_RADII } from './glassTokens';
import { useTheme } from '../../theme/ThemeProvider';

export default function GlassSheet({
  children,
  intensity = 80,
  tint,                    // override theme.glass.tint
  highlight = true,
  bevel = true,
  showHandle = true,
  onClose,
  closeLabel,
  style,
  contentStyle,
  paddingHorizontal = 20,
  paddingTop = 8,
  paddingBottom,           // overridden to keep safe area space
  fullHeight = false,
  topRadius = GLASS_RADII.sheet,
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const resolvedBottomPad =
    paddingBottom != null ? paddingBottom + insets.bottom : 24 + insets.bottom;

  // Handle bar + close button colours follow the theme so they stay
  // legible on a light glass sheet without going invisible.
  const handleColor = theme.mode === 'light' ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.32)';
  const closeBg = theme.mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
  const closeBorder = theme.mode === 'light' ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.16)';

  return (
    <View style={[{ overflow: 'hidden' }, fullHeight ? { flex: 1 } : null, style]}>
      <GlassView
        intensity={intensity}
        tint={tint}
        borderRadius={topRadius}
        highlight={highlight}
        bevel={bevel}
        elevated
        style={{
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
        contentStyle={[
          {
            paddingTop,
            paddingHorizontal,
            paddingBottom: resolvedBottomPad,
          },
          fullHeight ? { flex: 1 } : null,
          contentStyle,
        ]}
      >
        {showHandle ? (
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View
              accessibilityLabel="poignée"
              style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                backgroundColor: handleColor,
              }}
            />
          </View>
        ) : null}
        {onClose ? (
          <GlassPressable
            onPress={onClose}
            accessibilityLabel={closeLabel || 'Fermer'}
            accessibilityRole="button"
            style={{
              position: 'absolute',
              top: 12 + (showHandle ? 8 : 0),
              right: 16,
            }}
          >
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: closeBg,
                borderWidth: 1,
                borderColor: closeBorder,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>✕</Text>
            </View>
          </GlassPressable>
        ) : null}
        {children}
      </GlassView>
    </View>
  );
}
