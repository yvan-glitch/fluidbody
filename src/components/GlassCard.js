import { View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export default function GlassCard({
  children,
  style,
  intensity = 75,
  tint = 'dark',
  borderRadius = 20,
  padding,
  bg = 'rgba(255,255,255,0.08)',
  borderColor = 'rgba(255,255,255,0.25)',
  borderWidth = 1,
  reflection = true,
  shadow = true,
  reflectionHeight = '30%',
  reflectionColor = 'rgba(255,255,255,0.12)',
}) {
  const inner = {
    backgroundColor: bg,
    borderWidth,
    borderColor,
    borderRadius,
  };
  if (padding != null) inner.padding = padding;

  const shadowStyle = shadow
    ? {
        shadowColor: '#ffffff',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      }
    : null;

  return (
    <View style={[shadowStyle, style]}>
      <View style={{ borderRadius, overflow: 'hidden' }}>
        <BlurView
          intensity={Platform.OS === 'ios' ? intensity : 0}
          tint={tint}
          style={inner}
        >
          {reflection ? (
            <LinearGradient
              colors={[reflectionColor, 'rgba(255,255,255,0)']}
              locations={[0, 1]}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: reflectionHeight,
                borderTopLeftRadius: borderRadius,
                borderTopRightRadius: borderRadius,
              }}
              pointerEvents="none"
            />
          ) : null}
          {children}
        </BlurView>
      </View>
    </View>
  );
}
