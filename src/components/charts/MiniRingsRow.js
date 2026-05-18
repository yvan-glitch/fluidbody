// MiniRingsRow — a strip of mini Apple-Fitness rings.
//
// Used twice on the Statistics screen:
//   • Weekly view: 7 days (Mon–Sun) with each MiniActivityRings sitting
//     above a day label.
//   • Monthly view: 4 weekly-aggregate donuts (closedDays/totalDays)
//     stacked the same way.
//
// We reuse the `MiniActivityRings` component from `ActivityRings.js` for
// the weekly mode, and draw a simple closed-rings donut by hand for the
// monthly mode (since each cell aggregates many days, not one).

import { View, Text, Pressable } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MiniActivityRings, RING_COLORS } from '../ActivityRings';
import { useTheme } from '../../theme/ThemeProvider';

const TWO_PI = Math.PI * 2;

function MonthlyDonut({ size, closedDays, totalDays }) {
  const stroke = 5;
  const c = size / 2;
  const r = c - stroke / 2;
  const pct = totalDays > 0 ? Math.min(1, closedDays / totalDays) : 0;
  const circ = TWO_PI * r;
  const drawn = circ * pct;
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={r} stroke={RING_COLORS.exercise.from} strokeOpacity={0.18} strokeWidth={stroke} fill="none" />
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={RING_COLORS.exercise.to}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${drawn} ${Math.max(0.01, circ - drawn)}`}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </Svg>
  );
}

function dayInitial(dateStr, lang) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const map = {
    fr: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
    en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    es: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    it: ['D', 'L', 'M', 'M', 'G', 'V', 'S'],
  };
  const arr = map[lang] || map.fr;
  return arr[d.getDay()];
}

export default function MiniRingsRow({
  mode = 'week',     // 'week' | 'month'
  week,              // [{date, moveKcal, exerciseMin, standHours}]
  monthly,           // [{startDate, endDate, closedDays, totalDays}]
  goals,
  onDayPress,
  onWeekPress,
  lang,
}) {
  const { theme } = useTheme();
  if (mode === 'week') {
    const data = Array.isArray(week) ? week : [];
    if (data.length === 0) {
      return (
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' }}>—</Text>
      );
    }
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {data.map(function (d, i) {
          const ring = (
            <View style={{ alignItems: 'center', flex: 1 }}>
              <MiniActivityRings
                size={32}
                strokeWidth={4}
                values={{ move: d.moveKcal, exercise: d.exerciseMin, stand: d.standHours }}
                goals={goals}
              />
              <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 6, fontWeight: '600' }}>
                {dayInitial(d.date, lang)}
              </Text>
            </View>
          );
          if (!onDayPress) return <View key={d.date || i}>{ring}</View>;
          return (
            <Pressable
              key={d.date || i}
              onPress={function () { onDayPress(d); }}
              hitSlop={6}
              style={function (s) { return { flex: 1, opacity: s.pressed ? 0.6 : 1 }; }}
              accessibilityRole="button"
            >
              {ring}
            </Pressable>
          );
        })}
      </View>
    );
  }
  // ── month mode ──
  const buckets = Array.isArray(monthly) ? monthly : [];
  if (buckets.length === 0) {
    return (
      <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' }}>—</Text>
    );
  }
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' }}>
      {buckets.map(function (b, i) {
        const inner = (
          <View style={{ alignItems: 'center' }}>
            <MonthlyDonut size={40} closedDays={b.closedDays} totalDays={b.totalDays} />
            <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 6, fontWeight: '600' }}>
              {b.closedDays}/{b.totalDays}
            </Text>
          </View>
        );
        if (!onWeekPress) return <View key={'wk-' + i}>{inner}</View>;
        return (
          <Pressable
            key={'wk-' + i}
            onPress={function () { onWeekPress(b); }}
            hitSlop={6}
            style={function (s) { return { opacity: s.pressed ? 0.6 : 1 }; }}
            accessibilityRole="button"
          >
            {inner}
          </Pressable>
        );
      })}
    </View>
  );
}
