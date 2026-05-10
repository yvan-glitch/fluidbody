import { TouchableOpacity, Text, View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

const RADIUS = 30;
const BORDER_COLOR = 'rgba(255,255,255,0.2)';
const BG_DEFAULT = 'rgba(30,30,40,0.7)';
const BG_DARK = 'rgba(0,0,0,0.6)';

export default function GlassButton({
  onPress,
  disabled,
  loading,
  variant = 'default',
  size = 'md',
  fullWidth = true,
  textColor,
  style,
  textStyle,
  children,
  leftIcon,
  rightIcon,
  accessibilityLabel,
}) {
  const heights = { sm: 44, md: 52, lg: 56 };
  const fonts = { sm: 14, md: 15, lg: 16 };
  const h = heights[size] || heights.md;
  const f = fonts[size] || fonts.md;

  let bg = BG_DEFAULT;
  let resolvedTextColor = textColor || '#ffffff';
  if (variant === 'dark') {
    bg = BG_DARK;
  } else if (variant === 'accent') {
    bg = 'rgba(174,239,77,0.10)';
    resolvedTextColor = textColor || '#AEEF4D';
  } else if (variant === 'yellow') {
    bg = 'rgba(229,255,0,0.10)';
    resolvedTextColor = textColor || '#E5FF00';
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[{
        height: h,
        borderRadius: RADIUS,
        overflow: 'hidden',
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        opacity: (disabled || loading) ? 0.45 : 1,
      }, style]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 40 : 0}
        tint="dark"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: RADIUS,
        }}
      />
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 22,
          backgroundColor: bg,
          borderRadius: RADIUS,
          borderWidth: 1,
          borderColor: BORDER_COLOR,
        }}
      >
        {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
        {typeof children === 'string' ? (
          <Text
            style={[{
              fontSize: f,
              fontWeight: '700',
              color: resolvedTextColor,
              letterSpacing: 0.2,
            }, textStyle]}
            numberOfLines={1}
          >
            {children}
          </Text>
        ) : children}
        {rightIcon ? <View style={{ marginLeft: 8 }}>{rightIcon}</View> : null}
      </View>
    </TouchableOpacity>
  );
}

export { RADIUS as GLASS_RADIUS, BORDER_COLOR as GLASS_BORDER_COLOR, BG_DEFAULT as GLASS_BG_DEFAULT, BG_DARK as GLASS_BG_DARK };
