// CountUpNumber — animated number that rolls from 0 to a target value.
//
// Used on the Statistics header KPI cards. Driving Animated.Value with a
// listener (rather than a re-render loop) keeps the work off the JS bridge;
// we only call setState on each frame the displayed integer actually
// changes, which is cheap.

import { useEffect, useRef, useState } from 'react';
import { Text, Animated } from 'react-native';
import { GLASS_EASING } from '../ui/glassTokens';

export default function CountUpNumber({
  value,
  duration = 1100,
  delay = 0,
  formatter,
  style,
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  const lastShown = useRef(0);

  useEffect(function () {
    anim.setValue(0);
    lastShown.current = 0;
    setShown(0);
    const id = anim.addListener(function (snap) {
      const n = Math.round(snap.value);
      if (n !== lastShown.current) {
        lastShown.current = n;
        setShown(n);
      }
    });
    Animated.timing(anim, {
      toValue: isFinite(value) ? value : 0,
      duration: duration,
      delay: delay,
      easing: GLASS_EASING,
      useNativeDriver: false,
    }).start();
    return function () { anim.removeListener(id); };
  }, [value]);

  return <Text style={style}>{formatter ? formatter(shown) : shown}</Text>;
}
