import { useEffect, useRef } from 'react';
import { View, Animated, Easing, Dimensions, Platform } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

const BLOBS = [
  {
    color: 'rgba(0,189,208,0.15)',
    shadow: 'rgb(0,189,208)',
    size: 280,
    startX: SW * 0.10, startY: SH * 0.18,
    dx: SW * 0.45, dy: SH * 0.30,
    durX: 45000, durY: 38000,
    delay: 0,
  },
  {
    color: 'rgba(174,239,77,0.08)',
    shadow: 'rgb(174,239,77)',
    size: 240,
    startX: SW * 0.72, startY: SH * 0.22,
    dx: -SW * 0.40, dy: SH * 0.42,
    durX: 47000, durY: 41000,
    delay: 1500,
  },
  {
    color: 'rgba(0,100,150,0.2)',
    shadow: 'rgb(0,100,150)',
    size: 220,
    startX: SW * 0.65, startY: SH * 0.60,
    dx: -SW * 0.32, dy: -SH * 0.38,
    durX: 49000, durY: 39000,
    delay: 4500,
  },
];

export default function LivingBackground() {
  const anims = useRef(BLOBS.map(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    const loops = [];
    anims.forEach((a, i) => {
      const cfg = BLOBS[i];
      const lx = Animated.loop(
        Animated.sequence([
          Animated.timing(a.x, { toValue: 1, duration: cfg.durX, easing: Easing.inOut(Easing.sin), useNativeDriver: true, delay: cfg.delay }),
          Animated.timing(a.x, { toValue: 0, duration: cfg.durX, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      const ly = Animated.loop(
        Animated.sequence([
          Animated.timing(a.y, { toValue: 1, duration: cfg.durY, easing: Easing.inOut(Easing.sin), useNativeDriver: true, delay: cfg.delay + 2000 }),
          Animated.timing(a.y, { toValue: 0, duration: cfg.durY, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      lx.start();
      ly.start();
      loops.push(lx, ly);
    });
    return () => { loops.forEach((l) => l.stop && l.stop()); };
  }, []);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {BLOBS.map((b, i) => {
        const tx = anims[i].x.interpolate({ inputRange: [0, 1], outputRange: [0, b.dx] });
        const ty = anims[i].y.interpolate({ inputRange: [0, 1], outputRange: [0, b.dy] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: b.startX - b.size / 2,
              top: b.startY - b.size / 2,
              width: b.size,
              height: b.size,
              borderRadius: b.size / 2,
              backgroundColor: b.color,
              transform: [{ translateX: tx }, { translateY: ty }],
              shadowColor: b.shadow,
              shadowOpacity: Platform.OS === 'ios' ? 0.85 : 0,
              shadowRadius: 90,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
        );
      })}
    </View>
  );
}
