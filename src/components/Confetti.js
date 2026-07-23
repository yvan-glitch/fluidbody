import { useEffect, useRef } from 'react';
import { View, Animated, Easing, Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

const COLORS = ['#AEEF4D', '#AEEF4D', '#00BDD0', '#ffffff'];
const SHAPES = ['rect', 'circle'];

function rand(a, b) { return a + Math.random() * (b - a); }

export default function Confetti({ count = 60, duration = 2000, onDone }) {
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => {
      const shape = SHAPES[i % SHAPES.length];
      const size = shape === 'rect' ? rand(6, 12) : rand(5, 10);
      return {
        translateY: new Animated.Value(-30 - Math.random() * 80),
        translateX: new Animated.Value(rand(0, SW)),
        rotate: new Animated.Value(0),
        opacity: new Animated.Value(1),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape,
        width: size,
        height: shape === 'rect' ? size * rand(0.6, 1.6) : size,
        startX: rand(0, SW),
        endX: rand(-40, SW + 40),
        delay: Math.random() * 400,
      };
    })
  ).current;

  useEffect(() => {
    let mounted = true;
    const animations = pieces.map((p) =>
      Animated.parallel([
        Animated.timing(p.translateY, {
          toValue: SH + 60,
          duration: duration + Math.random() * 600,
          delay: p.delay,
          easing: Easing.bezier(0.4, 0, 0.7, 1),
          useNativeDriver: true,
        }),
        Animated.timing(p.translateX, {
          toValue: p.endX,
          duration: duration + Math.random() * 600,
          delay: p.delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(p.rotate, {
          toValue: rand(2, 6),
          duration: duration + Math.random() * 600,
          delay: p.delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(p.delay + duration * 0.7),
          Animated.timing(p.opacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    const stagger = Animated.stagger(0, animations);
    stagger.start(() => {
      if (mounted && typeof onDone === 'function') onDone();
    });
    return () => {
      mounted = false;
      try { stagger.stop && stagger.stop(); } catch (e) {}
      animations.forEach((a) => { try { a.stop && a.stop(); } catch (e) {} });
      pieces.forEach((p) => {
        try {
          p.translateX.removeAllListeners();
          p.translateY.removeAllListeners();
          p.rotate.removeAllListeners();
          p.opacity.removeAllListeners();
        } catch (e) {}
      });
    };
  }, []);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }}>
      {pieces.map((p, i) => {
        const rotate = p.rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: p.width,
              height: p.height,
              borderRadius: p.shape === 'circle' ? p.width / 2 : 1,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateX: p.translateX },
                { translateY: p.translateY },
                { rotate },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
