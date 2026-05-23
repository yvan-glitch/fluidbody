// Skeleton — placeholder shimmer pour zones en chargement (signing Bunny,
// etc.). Une boîte aux mêmes dimensions que la cible avec un dégradé qui
// glisse de gauche à droite (1.2 s par cycle, useNativeDriver).
//
// Usage : <Skeleton style={{ position:'absolute', top:0,left:0,right:0,bottom:0 }} />

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Skeleton({ style, radius = 12 }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(function () {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return function () { try { loop.stop(); } catch (e) {} };
  }, []);

  return (
    <View
      onLayout={function (e) { setW(e.nativeEvent.layout.width); }}
      style={[{ overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius }, style]}
      pointerEvents="none"
    >
      {w > 0 ? (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: Math.max(120, w * 0.6),
            transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-w * 0.6, w] }) }],
          }}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
