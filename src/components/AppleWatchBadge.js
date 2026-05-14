// AppleWatchBadge — small glass pill that shows whether an Apple Watch
// is feeding HealthKit. Used at the top of Activity and inside Profil's
// "Connexions" section. Probing happens via the shared
// useAppleWatchPresence hook (one-shot 7-day HR sample lookup) so the
// badge appears within a second of mount and never re-polls.

import { View, Text, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import useAppleWatchPresence from '../hooks/useAppleWatchPresence';
import { GlassView, GLASS_RADII } from './ui';

function WatchIcon({ color, size }) {
  const s = size || 14;
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M7 7h10v10H7z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M9 7l1-3h4l1 3M9 17l1 3h4l1-3" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function StatusDot({ color }) {
  return (
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
  );
}

export default function AppleWatchBadge({ colors, tr, compact }) {
  // Android: no Apple Watch, no badge.
  if (Platform.OS !== 'ios') return null;

  const { hasAppleWatch, model } = useAppleWatchPresence();

  // While probing (null) we don't render anything — avoids a flash of
  // "not detected" before the first sample query resolves.
  if (hasAppleWatch === null) return null;

  const connected = hasAppleWatch === true;
  const dot = connected ? '#34c759' : 'rgba(255,255,255,0.35)';
  const label = connected
    ? (tr.watch_connected || 'Apple Watch connected')
    : (tr.watch_not_detected || 'Apple Watch not detected');
  const text = connected && model && !compact ? label + ' · ' + model : label;
  const textColor = connected ? colors.text : colors.textSecondary;

  return (
    <GlassView
      intensity={45}
      borderRadius={GLASS_RADII.pill}
      contentStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <StatusDot color={dot} />
        <WatchIcon color={textColor} size={14} />
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: textColor,
            letterSpacing: 0.2,
          }}
          numberOfLines={1}
        >
          {text}
        </Text>
      </View>
    </GlassView>
  );
}
