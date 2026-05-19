// BadgeGrid — milestone trophies.
//
// Each badge has an unlocked + locked visual state. Unlocked badges
// render the emoji at full opacity over a subtle accent halo; locked
// badges desaturate to a muted glass cell with a small progress ring
// indicating how close the user is.
//
// The grid is fixed at 4 columns (two rows of 4 for the default 8-badge
// set), but adapts gracefully if the consumer passes fewer items.

import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

const TWO_PI = Math.PI * 2;

function ProgressRing({ size, pct, color, trackColor }) {
  const stroke = 3;
  const c = size / 2;
  const r = c - stroke / 2;
  const circ = TWO_PI * r;
  const drawn = circ * Math.min(1, pct);
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Circle cx={c} cy={c} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${drawn} ${Math.max(0.01, circ - drawn)}`}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </Svg>
  );
}

export default function BadgeGrid({ badges, columns = 4 }) {
  const { theme } = useTheme();
  if (!Array.isArray(badges) || badges.length === 0) return null;
  const cellSize = 64;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
      {badges.map(function (b) {
        const pct = b.unlocked ? 1 : (b.target > 0 ? Math.min(1, b.current / b.target) : 0);
        const cellColor = b.unlocked ? theme.colors.accent : theme.colors.textTertiary;
        const trackColor = theme.mode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
        return (
          <View
            key={b.key}
            style={{
              width: 100 / columns + '%',
              alignItems: 'center',
              paddingVertical: 10,
              paddingHorizontal: 4,
            }}
          >
            <View
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: cellSize / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: b.unlocked ? theme.glass.substrateAccent : theme.glass.substrate,
                borderWidth: 1,
                borderColor: b.unlocked ? theme.colors.accent + '55' : theme.colors.hairline,
                position: 'relative',
                overflow: 'visible',
              }}
            >
              <ProgressRing size={cellSize} pct={pct} color={cellColor} trackColor={trackColor} />
              <Text style={{ fontSize: 26, opacity: b.unlocked ? 1 : 0.35 }}>{b.emoji}</Text>
            </View>
            <Text
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: b.unlocked ? theme.colors.text : theme.colors.textSecondary,
                marginTop: 6,
                textAlign: 'center',
              }}
              numberOfLines={2}
            >
              {b.label}
            </Text>
            {!b.unlocked ? (
              <Text style={{ fontSize: 9, color: theme.colors.textTertiary, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                {b.current}/{b.target}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
