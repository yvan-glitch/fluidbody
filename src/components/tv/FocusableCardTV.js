// FocusableCardTV — pressable wrapper qui réagit au focus engine tvOS.
//
// Premium focus :
//   - scale 1 → 1.06 animé (220 ms, easing.out.cubic, native driver)
//   - anneau bioluminescent cyan (ou vert via accent="green") qui fade-in
//     0 → 1 (200 ms) avec shadow halo
//
// Sur iPhone, comportement identique au TouchableOpacity standard (zéro
// overhead — early return d'un TouchableOpacity simple, pas d'Animated.View
// extra qui pourrait casser des layouts existants).
//
// Hoisted ici depuis MonCorps.js pour pouvoir être réutilisé par
// Bibliotheque TV et tout futur écran TV qui a besoin du même focus.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TouchableOpacity } from 'react-native';

import { IS_TV, tvFocusProps } from '../../utils/platformTV';

export default function FocusableCardTV({ children, focusPreferred, style, accent, ringRadius, ...rest }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const ringColor = accent === 'green' ? '#AEEF4D' : '#00DCEC';

  useEffect(function() {
    if (!IS_TV) return;
    Animated.parallel([
      Animated.timing(scale, {
        toValue: focused ? 1.06 : 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ring, {
        toValue: focused ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  if (!IS_TV) {
    return (
      <TouchableOpacity activeOpacity={0.88} style={style} {...rest}>
        {children}
      </TouchableOpacity>
    );
  }

  const radius = typeof ringRadius === 'number' ? ringRadius : 18;

  return (
    <Animated.View style={[style, { transform: [{ scale: scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.92}
        {...tvFocusProps(focusPreferred)}
        onFocus={function() { setFocused(true); }}
        onBlur={function() { setFocused(false); }}
        style={{ flex: 1 }}
        {...rest}
      >
        {children}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -3,
            left: -3,
            right: -3,
            bottom: -3,
            borderRadius: radius,
            borderWidth: 3,
            borderColor: ringColor,
            opacity: ring,
            shadowColor: ringColor,
            shadowOpacity: 0.8,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}
