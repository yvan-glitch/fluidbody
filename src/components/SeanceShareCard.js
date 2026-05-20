// SeanceShareCard — story-format render for sharing after a séance.
//
// Rendered off-screen at 1080×1920 (Instagram Stories aspect) so the
// ViewShot capture lands at the correct resolution regardless of the
// device's screen size. We scale typography in CSS units (px) because
// ViewShot captures at the resolution we declare — pixel-perfect.
//
// The card stays static (no animations) — we capture a single frame.
// Animations would force us to sample at an arbitrary moment, which
// risks capturing a half-faded jellyfish.

import { forwardRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
// react-native-view-shot: native module manquant sur tvOS, lazy require avec fallback
let ViewShot = null;
try { ViewShot = require('react-native-view-shot').default; } catch(e) {}
// Sur tvOS, on remplace ViewShot par un View transparent (share désactivé).
if (!ViewShot) ViewShot = require('react-native').View;
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { PILIER_IMAGES, T } from '../constants/data';

// Background jellyfish silhouette — drawn in SVG so it scales cleanly at
// 1080px wide. We keep it pale (cyan glow on dark) so the foreground text
// stays the hero of the image.
function JellyfishSilhouette({ size = 720 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id="bell" cx="100" cy="80" r="80" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#AEEF4D" stopOpacity="0.32" />
          <Stop offset="60%" stopColor="#00C8D4" stopOpacity="0.16" />
          <Stop offset="100%" stopColor="#000a1a" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Path
        d="M30 90 C 30 50, 170 50, 170 90 C 170 110, 150 120, 100 120 C 50 120, 30 110, 30 90 Z"
        fill="url(#bell)"
      />
      {/* tentacles */}
      {[60, 80, 100, 120, 140].map((x, i) => (
        <Path
          key={i}
          d={`M ${x} 118 C ${x - 4} 140, ${x + 6} 160, ${x - 2} 188`}
          stroke="rgba(174,239,77,0.18)"
          strokeWidth={1.2}
          fill="none"
          strokeLinecap="round"
        />
      ))}
      <Circle cx="100" cy="60" r="60" fill="url(#bell)" opacity={0.6} />
    </Svg>
  );
}

function StatBlock({ label, value }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const SeanceShareCard = forwardRef(function SeanceShareCard(
  { pilier, seanceLabel, durationMin, kcal, avgBpm, maxBpm, dateLabel, lang },
  ref,
) {
  const tr = T[lang] || T.fr;
  const pilierLabel = pilier?.label || '';
  const pilierKey = pilier?.key || 'p1';
  const accent = pilier?.color || '#AEEF4D';

  const showHr = Number.isFinite(avgBpm) && avgBpm > 0;

  return (
    // Off-screen render: position absolute, far above the screen so the
    // user never sees this view, but ViewShot captures the declared size.
    <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
      <ViewShot ref={ref} options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 }} style={styles.canvas}>
        <View style={styles.canvas}>
          <LinearGradient
            colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']}
            locations={[0, 0.18, 0.4, 0.6, 0.82, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Faint pilier image, very low opacity, fills 40% of height */}
          <View style={styles.pilierBgWrap}>
            <ExpoImage
              source={PILIER_IMAGES[pilierKey] || PILIER_IMAGES.p1}
              contentFit="cover"
              cachePolicy="memory-disk"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(0,10,26,0)', 'rgba(0,10,26,0.55)', '#000a1a']}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Centered jellyfish silhouette */}
          <View style={styles.jellyWrap}>
            <JellyfishSilhouette size={720} />
          </View>

          {/* Top wordmark */}
          <View style={styles.topBrand}>
            <Text style={styles.wordmark}>FLUIDBODY</Text>
            <Text style={styles.wordmarkPlus}>+</Text>
          </View>

          {/* Middle stack — pilier + séance + stats */}
          <View style={styles.mid}>
            <Text style={[styles.eyebrow, { color: accent }]}>{pilierLabel.toUpperCase()}</Text>
            <Text style={styles.title}>{seanceLabel}</Text>
            <View style={styles.divider} />
            <View style={styles.statsRow}>
              <StatBlock label={tr.share_card_minutes || 'MINUTES'} value={String(durationMin)} />
              {Number.isFinite(kcal) && kcal > 0 ? (
                <StatBlock label={tr.share_card_kcal || 'KCAL'} value={String(kcal)} />
              ) : null}
              {showHr ? (
                <StatBlock label={tr.share_card_avg_bpm || 'BPM MOY'} value={String(Math.round(avgBpm))} />
              ) : null}
            </View>
            {showHr && Number.isFinite(maxBpm) && maxBpm > 0 ? (
              <Text style={styles.maxBpm}>{tr.share_card_max_bpm || 'Max'} {Math.round(maxBpm)} bpm</Text>
            ) : null}
          </View>

          {/* Bottom branding */}
          <View style={styles.bottomBrand}>
            <Text style={styles.dateText}>{dateLabel}</Text>
            <Text style={styles.brandline}>fluidbody.app · Pilates conscient</Text>
          </View>
        </View>
      </ViewShot>
    </View>
  );
});

export default SeanceShareCard;

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    // Push it far above the screen so it never paints visibly.
    top: -10000,
    left: -10000,
    width: 1080,
    height: 1920,
    opacity: Platform.OS === 'web' ? 0 : 1,
  },
  canvas: {
    width: 1080,
    height: 1920,
    backgroundColor: '#000a1a',
  },
  pilierBgWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1100,
    overflow: 'hidden',
  },
  jellyWrap: {
    position: 'absolute',
    top: 360,
    left: 180,
    width: 720,
    height: 720,
    opacity: 0.85,
  },
  topBrand: {
    position: 'absolute',
    top: 96,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
  },
  wordmark: {
    fontSize: 64,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 4,
  },
  wordmarkPlus: {
    fontSize: 64,
    fontWeight: '900',
    color: '#AEEF4D',
    marginLeft: 14,
  },
  mid: {
    position: 'absolute',
    top: 760,
    left: 80,
    right: 80,
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 6,
    marginBottom: 22,
  },
  title: {
    fontSize: 88,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1.2,
    lineHeight: 96,
    textAlign: 'center',
  },
  divider: {
    width: 100,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.32)',
    marginVertical: 56,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  statBlock: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 92,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
    lineHeight: 100,
  },
  statLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 4,
    marginTop: 10,
  },
  maxBpm: {
    fontSize: 24,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 24,
    letterSpacing: 1,
  },
  bottomBrand: {
    position: 'absolute',
    bottom: 96,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 26,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 4,
    fontWeight: '500',
    marginBottom: 12,
  },
  brandline: {
    fontSize: 22,
    color: 'rgba(174,239,77,0.7)',
    fontWeight: '700',
    letterSpacing: 3,
  },
});
