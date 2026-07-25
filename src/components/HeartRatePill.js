// Discreet live heart-rate pill for the VideoPlayer overlay.
//
// Rendered top-right above the video, below the play/pause cluster.
// Pulse animation = real BPM (60000/bpm ms cycle), colors track HRmax zones.
// onPress is a hook left open for the future "session HR summary" sheet.

import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import GlassView from './ui/GlassView';
import { GLASS_RADII } from './ui/glassTokens';

const DEFAULT_HRMAX = 180;

function hrMaxFromBirthDate(birthDateIso) {
  if (!birthDateIso) return DEFAULT_HRMAX;
  try {
    const dob = new Date(birthDateIso);
    if (Number.isNaN(dob.getTime())) return DEFAULT_HRMAX;
    const ageMs = Date.now() - dob.getTime();
    const ageYrs = ageMs / (365.25 * 24 * 3600 * 1000);
    if (!Number.isFinite(ageYrs) || ageYrs < 8 || ageYrs > 110) return DEFAULT_HRMAX;
    return Math.max(120, Math.round(220 - ageYrs));
  } catch (e) {
    return DEFAULT_HRMAX;
  }
}

// Couleurs des zones cardio "à l'américaine" (Karvonen simplifié, sur HRmax).
// Tout reste lisible sur fond sombre.
function colorForZone(pct) {
  if (pct < 0.6) return '#FFFFFF';
  if (pct < 0.7) return '#9FC7FF';
  if (pct < 0.85) return '#5CE092';
  if (pct < 0.95) return '#FFB347';
  return '#FF5050';
}

function HeartIcon({ size = 13, color = '#FF3B4F' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 21s-7-4.6-9.4-9.1C.8 8.5 2.7 5 6 5c2 0 3.4 1 4 2.4C10.6 6 12 5 14 5c3.3 0 5.2 3.5 3.4 6.9C19 16.4 12 21 12 21Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * @param {Object}    props
 * @param {number?}   props.bpm           Last fresh BPM. null hides the number.
 * @param {boolean}   props.isLive        True if last sample < ~15s ago.
 * @param {string?}   props.birthDateIso  User DOB for HRmax. Null → fallback 180.
 * @param {function?} props.onPress       Optional tap handler (future summary sheet).
 * @param {Object?}   props.style         Container override (eg. top/right positioning).
 */
export default function HeartRatePill({ bpm, isLive, birthDateIso, onPress, style, large }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const loopRef = useRef(null);

  const hrMax = hrMaxFromBirthDate(birthDateIso);
  const pct = bpm ? Math.max(0, Math.min(1.2, bpm / hrMax)) : 0;
  const numberColor = bpm ? colorForZone(pct) : 'rgba(255,255,255,0.55)';

  // Resync the pulse loop whenever BPM crosses a meaningful delta.
  useEffect(() => {
    if (loopRef.current) {
      try { loopRef.current.stop(); } catch (e) {}
      loopRef.current = null;
    }
    if (!bpm || !isLive) return;
    const cycleMs = Math.max(280, Math.min(1500, Math.round(60000 / bpm)));
    const halfA = Math.max(100, Math.round(cycleMs * 0.35));
    const halfB = cycleMs - halfA;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: halfA, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: halfB, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loopRef.current = loop;
    loop.start();
    return () => {
      try { loop.stop(); } catch (e) {}
    };
  }, [bpm, isLive, pulse]);

  const Wrapper = onPress ? Pressable : View;
  // The pill itself stays a fixed-height glass capsule. We let GlassView
  // do the blur + specular + bevel + shadow; HeartRatePill just lays out
  // the heart icon and number row on top.
  return (
    <Wrapper
      onPress={onPress}
      accessibilityLabel={bpm != null ? `${bpm} battements par minute` : 'Fréquence cardiaque indisponible'}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[{ opacity: isLive ? 1 : 0.5 }, style]}
    >
      <GlassView
        intensity={70}
        tint="dark"
        forceDark
        borderRadius={GLASS_RADII.pill}
        highlight
        bevel
        elevated
        contentStyle={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: large ? 14 : 12,
          height: large ? 38 : 30,
        }}
      >
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <HeartIcon size={large ? 17 : 13} color={isLive ? '#FF3B4F' : 'rgba(255,80,90,0.55)'} />
        </Animated.View>
        <Text style={{
          marginLeft: 6,
          fontSize: large ? 20 : 15,
          fontWeight: '700',
          color: numberColor,
          fontVariant: ['tabular-nums'],
          letterSpacing: -0.3,
        }}>
          {bpm != null ? String(bpm) : '—'}
        </Text>
        <Text style={{
          marginLeft: 3,
          fontSize: large ? 12 : 10,
          fontWeight: '600',
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: 0.4,
        }}>bpm</Text>
      </GlassView>
    </Wrapper>
  );
}
