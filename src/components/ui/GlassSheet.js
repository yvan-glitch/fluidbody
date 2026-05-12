// GlassSheet — bottom-sheet/modal surface in the Liquid Glass language.
//
// Wraps the content in a GlassView with sheet-tier corner radius and a
// grabber handle at the top. Caller is responsible for the Modal/Animated
// presentation around it (we deliberately don't lock you into a single
// transition style — paywall slides fullscreen, profile picker slides up
// 60%, etc).
//
// Usage:
//   <Modal visible={visible} transparent animationType="slide">
//     <View style={{ flex:1, justifyContent:'flex-end' }}>
//       <GlassSheet onClose={close}> ... </GlassSheet>
//     </View>
//   </Modal>

import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GlassView from './GlassView';
import GlassPressable from './GlassPressable';
import { GLASS_RADII } from './glassTokens';

export default function GlassSheet({
  children,
  intensity = 80,
  tint = 'dark',
  highlight = true,
  bevel = true,
  showHandle = true,
  onClose,
  closeLabel,
  style,
  contentStyle,
  paddingHorizontal = 20,
  paddingTop = 8,
  paddingBottom,        // overridden to keep safe area space
  fullHeight = false,
  topRadius = GLASS_RADII.sheet,
}) {
  const insets = useSafeAreaInsets();
  const resolvedBottomPad =
    paddingBottom != null ? paddingBottom + insets.bottom : 24 + insets.bottom;

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
                backgroundColor: 'rgba(255,255,255,0.32)',
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
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.16)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>✕</Text>
            </View>
          </GlassPressable>
        ) : null}
        {children}
      </GlassView>
    </View>
  );
}
