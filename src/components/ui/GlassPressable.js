// GlassPressable — thin wrapper around `Pressable` that applies the standard
// Liquid Glass press feedback (scale 0.97 + spring back) and exposes the right
// accessibility props.
//
// We use the JS-driven Animated.spring instead of useNativeDriver:true for the
// scale because it's a tiny transform on a small surface and we want the same
// spring config as the rest of the system without a Reanimated dependency.

import { useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { GLASS_PRESS_SCALE, GLASS_PRESS_SPRING } from './glassTokens';

export default function GlassPressable({
  onPress,
  disabled,
  hitSlop = 8,
  pressedScale = GLASS_PRESS_SCALE,
  style,
  children,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  testID,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: pressedScale,
      ...GLASS_PRESS_SPRING,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      ...GLASS_PRESS_SPRING,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={disabled ? { disabled: true } : undefined}
      testID={testID}
      style={({ pressed }) => [
        { opacity: disabled ? 0.4 : pressed ? 0.95 : 1 },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
