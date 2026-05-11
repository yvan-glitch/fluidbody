import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export default function AnimatedPlus({ style }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (__DEV__) console.log('AnimatedPlus mounted');
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.2, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.Text style={[style, { transform: [{ scale }] }]}>+</Animated.Text>
  );
}
