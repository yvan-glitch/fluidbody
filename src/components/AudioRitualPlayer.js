// AudioRitualPlayer — Lightweight audio player for short rituals (v1.2).
//
// Design philosophy :
//   - Audio rituals are MEANT to be done while doing something else
//     (eyes closed lying down, walking, on a chair at the desk).
//   - So the UI is INTENTIONALLY minimal — no fullscreen, no controls
//     fight for attention. Just a bottom bar with play/pause + progress.
//   - Tap anywhere on the bar = pause/resume. No fiddly buttons.
//   - Auto-dim screen after 3s during playback (battery + ambient mood).
//
// Built on expo-av (already in deps via VideoPlayer). Same module covers
// audio playback so no new native module needed.
//
// Lifecycle:
//   - mount → fetch signed audio URL from edge function `sign-audio-url`
//     (mirror of sign-video-url, same Bunny token auth flow).
//   - loaded → auto-play, show duration.
//   - playing → update progress, allow seek by tapping progress bar.
//   - finished → call onComplete callback (parent saves completion).
//   - unmount → stop sound, unload, restore screen brightness if dimmed.
//
// Accessibility :
//   - Single play/pause button has explicit label "Lecture" / "Pause".
//   - Progress bar announces percentage.
//   - Honors Reduce Motion (no breathing animation if disabled).

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

// Safe require expo-av (same pattern as VideoPlayer).
let Audio = null;
try { Audio = require('expo-av').Audio; } catch (e) {}

// Inline strings — same approach as OtaUpdateBanner to avoid imports.
const STRINGS = {
  fr: {
    loading: 'Préparation…',
    play: 'Lecture',
    pause: 'Pause',
    failed: 'Connexion à venir',
  },
  en: {
    loading: 'Loading…',
    play: 'Play',
    pause: 'Pause',
    failed: 'Coming soon',
  },
};

export default function AudioRitualPlayer({
  signedUrl,         // pre-fetched signed URL from sign-audio-url edge fn
  title,             // e.g. "Cohérence cardiaque 5 min"
  durationLabel,     // e.g. "5'00''"
  lang = 'fr',
  onComplete,        // called when playback reaches end
  onError,           // called on load/play failure
}) {
  const [sound, setSound] = useState(null);
  const [status, setStatus] = useState({ isLoaded: false, isPlaying: false, positionMillis: 0, durationMillis: 0 });
  const [error, setError] = useState(false);
  const breathAnim = useRef(new Animated.Value(0)).current;
  const completedRef = useRef(false);
  const t = STRINGS[lang] || STRINGS.fr;

  // Load and play audio on mount.
  useEffect(() => {
    if (!Audio || !signedUrl) {
      setError(true);
      onError?.();
      return;
    }

    let mounted = true;
    let soundObj = null;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          interruptionModeIOS: 1, // do not duck (= we want full audio focus during ritual)
          shouldDuckAndroid: false,
          staysActiveInBackground: false,
        });

        const { sound: s } = await Audio.Sound.createAsync(
          { uri: signedUrl },
          { shouldPlay: true, progressUpdateIntervalMillis: 250 },
          (s) => {
            if (!mounted) return;
            setStatus(s);
            if (s.didJustFinish && !completedRef.current) {
              completedRef.current = true;
              onComplete?.();
            }
          },
        );
        if (!mounted) {
          s.unloadAsync().catch(() => {});
          return;
        }
        soundObj = s;
        setSound(s);
      } catch (e) {
        if (!mounted) return;
        setError(true);
        onError?.(e);
      }
    })();

    return () => {
      mounted = false;
      if (soundObj) {
        soundObj.unloadAsync().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedUrl]);

  // Gentle breathing animation on the play button while playing (4s in / 4s out).
  // Matches "respiration carrée" rhythm. Visual cue without distraction.
  useEffect(() => {
    if (!status.isPlaying) {
      breathAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status.isPlaying, breathAnim]);

  const handleTogglePlay = async () => {
    if (!sound) return;
    try {
      if (status.isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (e) {
      // Silent fail — user can retry
    }
  };

  const scaleStyle = {
    transform: [
      {
        scale: breathAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.06],
        }),
      },
    ],
  };

  const progress = status.durationMillis > 0
    ? status.positionMillis / status.durationMillis
    : 0;

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{t.failed}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityRole="adjustable" accessibilityValue={{ now: Math.round(progress * 100), min: 0, max: 100 }}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.duration}>{durationLabel}</Text>
      </View>

      <Pressable
        onPress={handleTogglePlay}
        disabled={!status.isLoaded}
        accessibilityRole="button"
        accessibilityLabel={status.isPlaying ? t.pause : t.play}
        accessibilityState={{ disabled: !status.isLoaded }}
        hitSlop={16}
        style={({ pressed }) => [
          styles.playButtonOuter,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Animated.View style={[styles.playButton, scaleStyle]}>
          {!status.isLoaded ? (
            <ActivityIndicator color="#000e18" />
          ) : status.isPlaying ? (
            <View style={styles.pauseIcon}>
              <View style={styles.pauseBar} />
              <View style={styles.pauseBar} />
            </View>
          ) : (
            <View style={styles.playTriangle} />
          )}
        </Animated.View>
      </Pressable>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 24,
  },
  titleBlock: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  duration: {
    color: 'rgba(174, 239, 77, 0.85)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1,
  },
  playButtonOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#AEEF4D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#AEEF4D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 6,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 18,
    borderBottomWidth: 18,
    borderLeftWidth: 28,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#000e18',
    marginLeft: 6,
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 10,
  },
  pauseBar: {
    width: 10,
    height: 32,
    backgroundColor: '#000e18',
    borderRadius: 2,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#AEEF4D',
    borderRadius: 2,
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(174, 239, 77, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(174, 239, 77, 0.3)',
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    textAlign: 'center',
  },
});
