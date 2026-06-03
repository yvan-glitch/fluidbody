// ActivityRings — three concentric Apple-Fitness rings.
//
// Each ring is drawn with two stacked Circle elements:
//   1) A faint track (the "empty" ring).
//   2) The progress arc, drawn from 12 o'clock and going clockwise,
//      using `stroke-dasharray` so the visible length matches the
//      current progress.
//
// The hue gradient is approximated with a `<LinearGradient>` since
// SVG conic gradients aren't widely supported on RN. The visible
// effect is close enough to Apple's two-tone trail.
//
// Glow at the head of each ring: a small filled circle positioned at
// the arc's leading edge, with a soft drop-shadow. Position is computed
// from the current animated progress every render via a listener on
// the underlying Animated.Value.
//
// Overlap when progress > 1.0: we keep drawing past 360° (up to ~390°)
// so the head crosses the start of the ring and casts a subtle 3D
// shadow — matching the Apple "you crushed your goal" look.

import { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, Pressable } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const RING_COLORS = {
  move:     { from: '#FA114F', to: '#FF375F', glow: '#FF375F' },   // red — Apple Move
  exercise: { from: '#76EE00', to: '#A0FF49', glow: '#A0FF49' },   // green — Apple Exercise
  stand:    { from: '#00C7FC', to: '#1AECFF', glow: '#1AECFF' },   // blue — Apple Stand
};

const TWO_PI = Math.PI * 2;

function clampProgress(value, goal) {
  if (!isFinite(value) || !isFinite(goal) || goal <= 0) return 0;
  // Allow up to ~1.08 for the overlap effect even when we go far past goal.
  return Math.max(0, Math.min(1.08, value / goal));
}

function Ring({
  size,
  strokeWidth,
  ringIndex,            // 0 = outer (move), 1 = exercise, 2 = stand
  color,
  glowColor,
  progress,             // 0..1.08
  delay = 0,
  duration = 1100,
}) {
  // Geometry — radius depends on which concentric ring this is.
  const centre = size / 2;
  const gap = Math.max(2, Math.round(strokeWidth * 0.18));
  const r = centre - strokeWidth / 2 - ringIndex * (strokeWidth + gap);
  const circumference = TWO_PI * r;

  // Animation: from 0 to clamped progress.
  const anim = useRef(new Animated.Value(0)).current;
  const [headAngle, setHeadAngle] = useState(0);

  useEffect(function () {
    const target = clampProgress(progress, 1); // progress already normalised
    anim.stopAnimation();
    const id = anim.addListener(function (snap) {
      setHeadAngle(snap.value * 360);
    });
    Animated.timing(anim, {
      toValue: target,
      duration: duration,
      delay: delay,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: false,
    }).start();
    return function () {
      anim.removeListener(id);
    };
  }, [progress]);

  const strokeDasharray = circumference;
  // We interpolate dashoffset from full → tiny number based on the
  // animated progress. dashoffset 0 means "full ring drawn".
  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1.08],
    outputRange: [circumference, circumference - circumference * 1.08],
  });

  // Head position (for the glow dot at the leading edge of the arc).
  const headRad = (headAngle - 90) * Math.PI / 180; // -90° to start at 12 o'clock
  const headX = centre + r * Math.cos(headRad);
  const headY = centre + r * Math.sin(headRad);
  // Show the glow only when there's measurable progress.
  const headOpacity = headAngle > 1 ? 1 : 0;

  const gradId = `ring-grad-${ringIndex}`;

  return (
    <>
      <Defs>
        <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={color.from} />
          <Stop offset="100%" stopColor={color.to} />
        </SvgLinearGradient>
      </Defs>
      {/* Track */}
      <Circle
        cx={centre}
        cy={centre}
        r={r}
        stroke={color.from}
        strokeOpacity={0.18}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Progress arc — rotated so it starts at 12 o'clock and goes clockwise. */}
      <AnimatedCircle
        cx={centre}
        cy={centre}
        r={r}
        stroke={`url(#${gradId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        transform={`rotate(-90 ${centre} ${centre})`}
      />
      {/* Head glow — a small filled circle that sits at the tip of the arc. */}
      <Circle
        cx={headX}
        cy={headY}
        r={strokeWidth / 2}
        fill={glowColor}
        opacity={headOpacity * 0.95}
      />
      {/* Outer halo on the head for the soft glow feel. */}
      <Circle
        cx={headX}
        cy={headY}
        r={strokeWidth / 2 + 3}
        fill={glowColor}
        opacity={headOpacity * 0.18}
      />
    </>
  );
}

/**
 * Three Apple-style activity rings.
 *
 * Props:
 *   size           — outer diameter in px (default 280).
 *   strokeWidth    — per-ring stroke width (default 22).
 *   values         — `{ move, exercise, stand }` actual values.
 *   goals          — `{ move, exercise, stand }` target values.
 *   onRingPress    — `(ringName: 'move'|'exercise'|'stand') => void`.
 *   staggerMs      — delay between rings (default 160).
 *   showLabels     — render numbers under the rings (default false).
 *   labelLang      — language hint (only used for the chip text).
 */
export default function ActivityRings({
  size = 280,
  strokeWidth = 22,
  values,
  goals,
  onRingPress,
  staggerMs = 160,
  showLabels = false,
  labelTr,
}) {
  const safeValues = values || { move: 0, exercise: 0, stand: 0 };
  const safeGoals = goals || { move: 350, exercise: 30, stand: 12 };
  // Normalised progress per ring (clamped to 1.08).
  const moveP = clampProgress(safeValues.move, safeGoals.move);
  const exP = clampProgress(safeValues.exercise, safeGoals.exercise);
  const standP = clampProgress(safeValues.stand, safeGoals.stand);

  const pad = Math.round(strokeWidth * 0.3);
  const total = size + pad * 2;

  // Tap targets — three nested rectangles (outer ring, middle, inner).
  // We use Pressable wrappers sized roughly to the ring band.
  function ringTap(name) {
    return function () {
      if (onRingPress) onRingPress(name);
    };
  }

  return (
    <View style={{ width: total, height: total, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={total} height={total}>
        <Ring
          size={size}
          strokeWidth={strokeWidth}
          ringIndex={0}
          color={RING_COLORS.move}
          glowColor={RING_COLORS.move.glow}
          progress={moveP}
          delay={0}
        />
        <Ring
          size={size}
          strokeWidth={strokeWidth}
          ringIndex={1}
          color={RING_COLORS.exercise}
          glowColor={RING_COLORS.exercise.glow}
          progress={exP}
          delay={staggerMs}
        />
        <Ring
          size={size}
          strokeWidth={strokeWidth}
          ringIndex={2}
          color={RING_COLORS.stand}
          glowColor={RING_COLORS.stand.glow}
          progress={standP}
          delay={staggerMs * 2}
        />
      </Svg>

      {/* Invisible per-ring tap targets — concentric rings. We layout them
          absolutely so they don't displace the SVG. The hitbox approximates
          the visible ring band (we use slightly wider bands than the stroke
          so they're easy to hit). */}
      {onRingPress ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          {[0, 1, 2].map(function (idx) {
            const gap = Math.max(2, Math.round(strokeWidth * 0.18));
            const r = size / 2 - strokeWidth / 2 - idx * (strokeWidth + gap);
            const dim = (r + strokeWidth) * 2;
            const inner = (r - strokeWidth) * 2;
            const names = ['move', 'exercise', 'stand'];
            return (
              <View
                key={idx}
                pointerEvents="box-none"
                style={{ position: 'absolute', width: dim, height: dim, borderRadius: dim / 2, alignItems: 'center', justifyContent: 'center' }}
              >
                <Pressable
                  onPress={ringTap(names[idx])}
                  hitSlop={4}
                  style={{
                    position: 'absolute',
                    width: dim,
                    height: dim,
                    borderRadius: dim / 2,
                    // The pressable is a "ring band" — easy way: use a thick
                    // border to make the hitbox follow only the band, but RN
                    // pressables don't support that. We accept a slightly
                    // overlapping hitbox; outer ring wins because it's
                    // rendered first / receives the tap first.
                  }}
                />
                {/* Cut-out — inner ring's pressable, smaller, sits in front. */}
                <View pointerEvents="box-none" style={{ width: inner, height: inner }} />
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Mini stacked rings — same idea but tiny, used for the weekly day strip.
 * No animation, no head glow — these stay static once mounted.
 */
export function MiniActivityRings({ size = 28, strokeWidth = 3.5, values, goals }) {
  const safeValues = values || { move: 0, exercise: 0, stand: 0 };
  const safeGoals = goals || { move: 350, exercise: 30, stand: 12 };
  const moveP = clampProgress(safeValues.move, safeGoals.move);
  const exP = clampProgress(safeValues.exercise, safeGoals.exercise);
  const standP = clampProgress(safeValues.stand, safeGoals.stand);
  const centre = size / 2;
  const gap = 1;
  function arc(idx, p, color, gradId) {
    const r = centre - strokeWidth / 2 - idx * (strokeWidth + gap);
    if (r <= 0) return null;
    const circumference = TWO_PI * r;
    const drawn = circumference * Math.min(p, 1);
    return (
      <>
        <Circle cx={centre} cy={centre} r={r} stroke={color.from} strokeOpacity={0.18} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={centre}
          cy={centre}
          r={r}
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${drawn} ${Math.max(0.001, circumference - drawn)}`}
          transform={`rotate(-90 ${centre} ${centre})`}
        />
      </>
    );
  }
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgLinearGradient id="mini-grad-0" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={RING_COLORS.move.from} />
          <Stop offset="100%" stopColor={RING_COLORS.move.to} />
        </SvgLinearGradient>
        <SvgLinearGradient id="mini-grad-1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={RING_COLORS.exercise.from} />
          <Stop offset="100%" stopColor={RING_COLORS.exercise.to} />
        </SvgLinearGradient>
        <SvgLinearGradient id="mini-grad-2" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={RING_COLORS.stand.from} />
          <Stop offset="100%" stopColor={RING_COLORS.stand.to} />
        </SvgLinearGradient>
      </Defs>
      {arc(0, moveP, RING_COLORS.move, 'mini-grad-0')}
      {arc(1, exP, RING_COLORS.exercise, 'mini-grad-1')}
      {arc(2, standP, RING_COLORS.stand, 'mini-grad-2')}
    </Svg>
  );
}
