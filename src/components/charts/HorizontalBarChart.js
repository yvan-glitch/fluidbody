// HorizontalBarChart — pillar progress bars.
//
// Each row renders: pilier label + count, an animated bar whose width
// grows from 0 → pct over ~900ms with the Apple symmetric curve, and a
// right-aligned percentage. Bar colour comes from `colorForPct` so the
// row turns from red → orange → yellow → green as the user progresses.
//
// Tappable rows surface the underlying pilier metadata via `onRowPress`.

import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { GLASS_EASING } from '../ui/glassTokens';

function AnimatedBar({ pct, color, delay, height = 8 }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(function () {
    Animated.timing(w, {
      toValue: pct,
      duration: 900,
      delay: delay,
      easing: GLASS_EASING,
      useNativeDriver: false,
    }).start();
  }, [pct]);
  const { theme } = useTheme();
  const trackColor = theme.mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
  return (
    <View style={{ height: height, backgroundColor: trackColor, borderRadius: height / 2, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: height,
          width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          backgroundColor: color,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

export default function HorizontalBarChart({ data, onRowPress, colorForPct, staggerMs = 80 }) {
  const { theme } = useTheme();
  if (!Array.isArray(data) || data.length === 0) return null;
  return (
    <View style={{ gap: 12 }}>
      {data.map(function (row, i) {
        const c = colorForPct ? colorForPct(row.pct) : row.color || '#5DCE6F';
        const inner = (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
                <Text
                  style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text, flexShrink: 1 }}
                  numberOfLines={1}
                >
                  {row.label}
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontVariant: ['tabular-nums'] }}>
                {row.done}/{row.total}
                <Text style={{ color: c, fontWeight: '700' }}>{'  ' + row.pct + '%'}</Text>
              </Text>
            </View>
            <AnimatedBar pct={row.pct} color={c} delay={i * staggerMs} />
          </View>
        );
        if (!onRowPress) return <View key={row.key}>{inner}</View>;
        return (
          <Pressable
            key={row.key}
            onPress={function () { onRowPress(row); }}
            accessibilityRole="button"
            accessibilityLabel={row.label + ' ' + row.pct + '%'}
            android_ripple={{ color: 'rgba(255,255,255,0.05)', borderless: false }}
            style={function (s) { return { opacity: s.pressed ? 0.7 : 1 }; }}
          >
            {inner}
          </Pressable>
        );
      })}
    </View>
  );
}
