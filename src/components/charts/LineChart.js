// LineChart — minimal SVG line chart for the HR-trend card.
//
// Strict scope: a single series of points, plotted as a smooth polyline
// with optional area fill, X-axis day ticks, and a horizontal hairline
// at the average. Hand-rolled (no external lib) because we only need one
// chart shape and `react-native-svg` is already in the bundle.
//
// Missing samples (`y == null`) are drawn as gaps in the line — we split
// the polyline into multiple segments rather than interpolating, so the
// reader doesn't mistake "no data" for "heart rate dropped".

import { View, Text } from 'react-native';
import Svg, { Path, Circle, Line as SvgLine } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

function buildPath(points) {
  if (!points.length) return '';
  let d = 'M ' + points[0].x + ' ' + points[0].y;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    d += ' L ' + p.x + ' ' + p.y;
  }
  return d;
}

function splitSegments(data, width, height, padX, padY, minY, maxY) {
  // Walk data, accumulating runs of non-null y values into segments.
  const range = Math.max(1, maxY - minY);
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const n = data.length;
  const segments = [];
  let current = [];
  for (let i = 0; i < n; i++) {
    const point = data[i];
    if (point && point.y != null && isFinite(point.y)) {
      const xRatio = n <= 1 ? 0.5 : i / (n - 1);
      const yRatio = (point.y - minY) / range;
      current.push({
        x: padX + xRatio * innerW,
        y: padY + (1 - yRatio) * innerH,
        raw: point,
      });
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

export default function LineChart({
  data,         // [{ date, y }]
  width = 320,
  height = 140,
  color,
  showAvg = true,
  yLabelFormat,
  emptyLabel,
}) {
  const { theme } = useTheme();
  const stroke = color || theme.colors.accentDeep;
  const hairline = theme.colors.hairline;
  const padX = 16;
  const padY = 14;

  const validYs = (data || []).filter(function (d) { return d && d.y != null && isFinite(d.y); }).map(function (d) { return d.y; });
  if (validYs.length === 0) {
    return (
      <View style={{ width: width, height: height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
          {emptyLabel || '-'}
        </Text>
      </View>
    );
  }

  let minY = Math.min.apply(null, validYs);
  let maxY = Math.max.apply(null, validYs);
  // Pad the y range a bit so the line doesn't kiss the edges.
  const yPad = Math.max(2, (maxY - minY) * 0.18);
  minY = Math.max(0, minY - yPad);
  maxY = maxY + yPad;

  const avg = validYs.reduce(function (a, b) { return a + b; }, 0) / validYs.length;
  const avgRatio = (avg - minY) / Math.max(1, maxY - minY);
  const avgY = padY + (1 - avgRatio) * (height - padY * 2);

  const segments = splitSegments(data, width, height, padX, padY, minY, maxY);

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Average hairline */}
        {showAvg ? (
          <SvgLine
            x1={padX}
            y1={avgY}
            x2={width - padX}
            y2={avgY}
            stroke={hairline}
            strokeWidth={1}
            strokeDasharray="3,4"
          />
        ) : null}
        {/* Segments */}
        {segments.map(function (seg, i) {
          return (
            <Path
              key={'seg-' + i}
              d={buildPath(seg)}
              stroke={stroke}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {/* Point dots */}
        {segments.map(function (seg, i) {
          return seg.map(function (p, j) {
            return (
              <Circle
                key={'pt-' + i + '-' + j}
                cx={p.x}
                cy={p.y}
                r={2}
                fill={stroke}
                opacity={0.9}
              />
            );
          });
        })}
      </Svg>
      {showAvg ? (
        <View style={{ position: 'absolute', right: 6, top: avgY - 22 }} pointerEvents="none">
          <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontVariant: ['tabular-nums'] }}>
            {yLabelFormat ? yLabelFormat(Math.round(avg)) : Math.round(avg)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
