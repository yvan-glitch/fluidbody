import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

// Logo « Souffle » animé : trois cercles qui respirent autour du + jaune fluo.
const TURQUOISE = '#1FD6CF';
const JAUNE_FLUO = '#E8FF1A';

function Ring({ size, radius, opacity, progress, delay, breathScale }) {
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, breathScale],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', width: size, height: size, opacity, transform: [{ scale }] }}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r={radius} stroke={TURQUOISE} strokeWidth={3} fill="none" />
      </Svg>
    </Animated.View>
  );
}

export default function SouffleLoader({ size = 160, breathCycleMs = 2500 }) {
  const inner = useRef(new Animated.Value(0)).current;
  const middle = useRef(new Animated.Value(0)).current;
  const outer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const half = breathCycleMs / 2;
    const breathe = (v, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
    // Décalage léger : l'onde part du centre vers l'extérieur.
    const anims = [breathe(inner, 0), breathe(middle, 150), breathe(outer, 300)];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [breathCycleMs]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ring size={size} radius={34} opacity={0.35} progress={outer} breathScale={1.08} />
      <Ring size={size} radius={24} opacity={0.65} progress={middle} breathScale={1.1} />
      <Ring size={size} radius={14} opacity={1} progress={inner} breathScale={1.12} />
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
        <Path d="M50 43 V57 M43 50 H57" stroke={JAUNE_FLUO} strokeWidth={5} strokeLinecap="round" fill="none" />
      </Svg>
    </View>
  );
}
