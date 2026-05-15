import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Pressable, Animated,
  Dimensions, Platform, StyleSheet, AppState,
} from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { T } from '../constants/data';
import { VideoPlaceholderMeduse } from './Meduse';
import LiquidGlassCapsule from './LiquidGlassCapsule';
import HeartRatePill from './HeartRatePill';
import { GlassView, GlassButton, GLASS_RADII, GLASS_EASING, GLASS_DURATIONS } from './ui';
import { getSignedVideoUrl, buildSessionId } from '../utils/videoUrl';
import useLiveHeartRate from '../hooks/useLiveHeartRate';
import { recordSessionHour, cancelPauseActiveNotifications } from '../utils/notifications';

// ── Small utilities (local copies to avoid circular deps) ──
// Haptics are fired by GlassButton (FAIT) via `haptic="success"`, so
// VideoPlayer no longer needs its own expo-haptics safe-require.

function devWarn(...args) {
  if (__DEV__) console.warn('[FluidBody]', ...args);
}

/** Truthy flag at `seance[3]` indicates a protected Bunny video is available
 *  for this session. The actual URL is signed on demand via the edge function. */
function hasProtectedVideo(flag) {
  return !!flag;
}

var RATE_OPTIONS = [0.75, 1.0, 1.25, 1.5];

// ── Étape colors (also kept in App.js for PilierPanel) ──
const ETAPE_COLORS = {
  'Comprendre': 'rgba(0,220,170,0.9)',
  'Ressentir': 'rgba(100,190,255,0.9)',
  'Préparer': 'rgba(255,200,80,0.9)',
  'Exécuter': 'rgba(255,145,100,0.9)',
  'Évoluer': 'rgba(185,135,255,0.9)',
};

// ── Video resume persistence ──

export const VIDEO_RESUME_PREFIX = 'fluid_video_resume_v1_';

function videoResumeStorageKey(pilierKey, seanceIndex) {
  return `${VIDEO_RESUME_PREFIX}${pilierKey}_${seanceIndex}`;
}

// Strip query string so signed URLs (which rotate every TTL) don't invalidate
// the resume cache. The path identifies the asset; the token does not.
function normalizeUriForResume(uri) {
  if (!uri) return '';
  const q = uri.indexOf('?');
  return q >= 0 ? uri.slice(0, q) : uri;
}

async function saveVideoResume(pilierKey, seanceIndex, uri, positionMillis, durationMillis) {
  if (!uri || !durationMillis || positionMillis == null) return;
  if (positionMillis < 2500) return;
  if (durationMillis - positionMillis < 5000) return;
  try {
    await AsyncStorage.setItem(
      videoResumeStorageKey(pilierKey, seanceIndex),
      JSON.stringify({ uri: normalizeUriForResume(uri), positionMillis, durationMillis, t: Date.now() }),
    );
  } catch (e) {}
}

async function clearVideoResume(pilierKey, seanceIndex) {
  try {
    await AsyncStorage.removeItem(videoResumeStorageKey(pilierKey, seanceIndex));
  } catch (e) {}
}

async function loadVideoResume(pilierKey, seanceIndex, currentUri, currentDurationMillis) {
  try {
    const raw = await AsyncStorage.getItem(videoResumeStorageKey(pilierKey, seanceIndex));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o.uri !== normalizeUriForResume(currentUri)) return null;
    const d0 = o.durationMillis || 0;
    const d1 = currentDurationMillis || 0;
    if (d0 > 0 && d1 > 0 && Math.abs(d0 - d1) / Math.max(d0, d1) > 0.18) return null;
    if (o.positionMillis < 2000) return null;
    if ((o.durationMillis || 0) - o.positionMillis < 4000) return null;
    return o.positionMillis;
  } catch (e) {
    return null;
  }
}

// ── Subtitles (VTT) ──

var SUBTITLE_LANGS = [
  { code: 'fr', label: 'Français' }, { code: 'en', label: 'English' },
];

function parseVtt(text) {
  if (!text) return [];
  var cues = [];
  var blocks = text.replace(/\r\n/g, '\n').split('\n\n');
  blocks.forEach(function(block) {
    var lines = block.trim().split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('-->') !== -1) {
        var times = lines[i].split('-->');
        var start = vttTimeToMs(times[0].trim());
        var end = vttTimeToMs(times[1].trim());
        var txt = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
        if (txt && !isNaN(start) && !isNaN(end)) cues.push({ start: start, end: end, text: txt });
        break;
      }
    }
  });
  return cues;
}

function vttTimeToMs(t) {
  var parts = t.split(':');
  if (parts.length === 3) return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])) * 1000;
  if (parts.length === 2) return (parseInt(parts[0]) * 60 + parseFloat(parts[1])) * 1000;
  return parseFloat(t) * 1000;
}

function getCurrentCue(cues, posMs) {
  if (!cues || !cues.length) return null;
  for (var i = 0; i < cues.length; i++) {
    if (posMs >= cues[i].start && posMs <= cues[i].end) return cues[i].text;
  }
  return null;
}

// ── Video icon sub-components ──

/** Saut ±10 s — verre + doubles chevrons + « 10 » (sans arc ni allure +10 / −10). */
const SKIP_BTN = 56;

function VideoSkipChevrons({ reverse, size = 22 }) {
  const c = '#fff';
  if (reverse) {
    return (
      <Svg width={size} height={size} viewBox="0 0 28 28">
        <Path d="M15 6 L9 14 L15 22 V6Z" fill={c} />
        <Path d="M23 6 L17 14 L23 22 V6Z" fill={c} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Path d="M7 6 L13 14 L7 22 V6Z" fill={c} />
      <Path d="M15 6 L21 14 L15 22 V6Z" fill={c} />
    </Svg>
  );
}

function VideoSkip10Icon({ reverse, onPress, bumpTimer }) {
  const a11y = reverse ? 'Revenir de 10 secondes' : 'Avancer de 10 secondes';
  const SIZE = 52;
  return (
    <Pressable
      accessibilityLabel={a11y}
      accessibilityRole="button"
      onPress={async () => { bumpTimer(); await onPress?.(); }}
      hitSlop={14}
      style={{ width: SIZE + 12, height: SIZE + 12, alignItems: 'center', justifyContent: 'center' }}
    >
      <GlassView
        intensity={45}
        tint="dark"

        forceDark
        borderRadius={SIZE / 2}
        contentStyle={{
          width: SIZE,
          height: SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" style={{ position: 'absolute' }}>
          {reverse ? (
            <>
              <Path d="M12 5 A7 7 0 1 0 19 12" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" fill="none" />
              <Path d="M14.5 3 L12 5 L14.5 7.5" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          ) : (
            <>
              <Path d="M12 5 A7 7 0 1 1 5 12" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" fill="none" />
              <Path d="M9.5 3 L12 5 L9.5 7.5" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          )}
        </Svg>
        <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff', letterSpacing: -0.3, marginTop: 1 }}>10</Text>
      </GlassView>
    </Pressable>
  );
}

/** Icônes lecture / pause vectorielles (style apps vidéo récentes). */
function VideoPlayPauseIcon({ playing, size = 36 }) {
  const c = '#fff';
  if (playing) {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityLabel="Pause">
        <Rect x="9" y="8" width="9" height="24" rx="2.5" fill={c} />
        <Rect x="22" y="8" width="9" height="24" rx="2.5" fill={c} />
      </Svg>
    );
  }
  return (
    <View style={{ marginLeft: 4 }}>
      <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityLabel="Lecture">
        <Path d="M12 8 L12 32 L34 20 L12 8 Z" fill={c} />
      </Svg>
    </View>
  );
}

// ── Main VideoPlayer component ──

export default function VideoPlayer({ seance, pilier, onClose, onComplete, lang, seanceIndex, isDemo, onDemoLimit, saveHealthKitWorkout, userBirthDate, showHeartRate }) {
  const tr = T[lang] || T['fr'];

  // showHeartRate / userBirthDate peuvent venir en prop (override pour tests)
  // ou être lus depuis AsyncStorage. Defaults : toggle=true, DOB=null.
  // Lecture optimiste : pas de blocage du 1er render — quand AsyncStorage
  // répond, un re-render fait apparaître le pill.
  const [showHrPref, setShowHrPref] = useState(showHeartRate !== false);
  const [birthDatePref, setBirthDatePref] = useState(userBirthDate || null);
  useEffect(function() {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem('fluid_show_hr').catch(function() { return null; }),
      AsyncStorage.getItem('fluid_birth_date').catch(function() { return null; }),
    ]).then(function(values) {
      if (cancelled) return;
      if (showHeartRate == null) setShowHrPref(values[0] !== 'false');
      if (!userBirthDate && values[1]) setBirthDatePref(values[1]);
    });
    return function() { cancelled = true; };
  }, []);
  const hrEnabled = (showHeartRate != null) ? showHeartRate : showHrPref;
  const hr = useLiveHeartRate({ enabled: hrEnabled });
  const effectiveBirthDate = userBirthDate || birthDatePref;
  const videoRef = useRef(null);
  const lastStatusRef = useRef({});
  const hasRestoredRef = useRef(false);
  const completedRef = useRef(false);
  const [status, setStatus] = useState({});
  const [resumeHint, setResumeHint] = useState(null);
  const controlsTimer = useRef(null);
  const [dims, setDims] = useState(Dimensions.get('window'));
  const playScale = useRef(new Animated.Value(1)).current;
  const doneScale = useRef(new Animated.Value(1)).current;
  // Apple-curve opacity for the full controls overlay. Driven by `showControls`,
  // animated separately so we can fade rather than hard-toggle.
  const controlsOpacity = useRef(new Animated.Value(0)).current;
  const [videoLoadFailed, setVideoLoadFailed] = useState(false);
  const [videoResetKey, setVideoResetKey] = useState(0);
  const [titre, duree, etape, videoFlag] = seance;
  const isTheory = etape === 'Comprendre' || etape === 'Ressentir';
  const hasRealVideo = hasProtectedVideo(videoFlag);
  const sessionId = hasRealVideo ? buildSessionId(pilier?.key, seanceIndex) : null;
  const [showControls, setShowControls] = useState(!hasRealVideo);
  const [uri, setUri] = useState('');
  const uriRef = useRef(uri);
  uriRef.current = uri;
  const lastPersistAtRef = useRef(0);
  var [ccEnabled, setCcEnabled] = useState(false);
  var [volume, setVolume] = useState(1);
  var [ccLang, setCcLang] = useState(lang || 'fr');
  var [ccCues, setCcCues] = useState([]);
  var [ccText, setCcText] = useState(null);
  var [showCcPicker, setShowCcPicker] = useState(false);
  var [playbackRate, setPlaybackRate] = useState(1.0);

  // Fetch a fresh signed MP4 URL whenever we need one (initial mount or after
  // a forced reset). The token is short-lived, so we always re-resolve through
  // the cache instead of caching the URL in component state long-term.
  useEffect(function() {
    if (!hasRealVideo || !sessionId) return;
    let cancelled = false;
    setUri('');
    hasRestoredRef.current = false;
    getSignedVideoUrl(sessionId, 'mp4')
      .then(function(signed) { if (!cancelled) setUri(signed); })
      .catch(function(err) {
        if (cancelled) return;
        if (__DEV__) devWarn('getSignedVideoUrl', err?.message || err);
        setVideoLoadFailed(true);
      });
    return function() { cancelled = true; };
  }, [hasRealVideo, sessionId, videoResetKey]);

  useEffect(function() {
    if (!ccEnabled || !hasRealVideo || !sessionId) { setCcCues([]); return; }
    let cancelled = false;
    getSignedVideoUrl(sessionId, 'vtt', ccLang)
      .then(function(url) {
        if (cancelled) return;
        return fetch(url).then(function(r) { if (r.ok) return r.text(); throw new Error('no vtt'); });
      })
      .then(function(txt) { if (!cancelled && txt) setCcCues(parseVtt(txt)); })
      .catch(function() { if (!cancelled) setCcCues([]); });
    return function() { cancelled = true; };
  }, [ccEnabled, ccLang, hasRealVideo, sessionId]);

  useEffect(function() {
    if (ccEnabled && ccCues.length > 0 && status.positionMillis != null) {
      setCcText(getCurrentCue(ccCues, status.positionMillis));
    } else { setCcText(null); }
  }, [status.positionMillis, ccEnabled, ccCues]);

  function maybePersistProgress(s) {
    if (!hasRealVideo) return;
    if (completedRef.current || pilier?.key == null || seanceIndex == null) return;
    if (!s?.isLoaded || !s.durationMillis || s.positionMillis == null) return;
    if (s.positionMillis < 2500 || s.durationMillis - s.positionMillis < 5000) return;
    const now = Date.now();
    if (now - lastPersistAtRef.current < 2800) return;
    lastPersistAtRef.current = now;
    saveVideoResume(pilier.key, seanceIndex, uriRef.current, s.positionMillis, s.durationMillis);
  }

  async function handleCloseVideo() {
    try {
      await deactivateKeepAwake();
    } catch (e) {
      if (__DEV__) devWarn('deactivateKeepAwake', e);
    }
    bumpTimer();
    if (!completedRef.current && elapsedSec >= 30) {
      saveExerciseTime(getElapsedMinutes());
    }
    const s = lastStatusRef.current;
    if (
      hasRealVideo &&
      !completedRef.current &&
      pilier?.key != null &&
      seanceIndex != null &&
      s?.durationMillis &&
      s.positionMillis != null
    ) {
      await saveVideoResume(pilier.key, seanceIndex, uriRef.current, s.positionMillis, s.durationMillis);
    }
    onClose();
  }

  function retryVideoLoad() {
    setVideoLoadFailed(false);
    hasRestoredRef.current = false;
    setVideoResetKey((k) => k + 1);
  }

  function scheduleHide() {
    if (!hasRealVideo) return;
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 4500);
  }

  function revealControls() {
    setShowControls(true);
    scheduleHide();
  }

  function hideControls() {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(false);
  }

  // Drive the controls overlay opacity with the Apple symmetric easing curve.
  // We keep the mount-state `showControls` separate from the opacity so that
  // taps on the dim layer still register during the fade.
  useEffect(function() {
    Animated.timing(controlsOpacity, {
      toValue: showControls ? 1 : 0,
      duration: GLASS_DURATIONS.fast,
      easing: GLASS_EASING,
      useNativeDriver: true,
    }).start();
  }, [showControls]);

  function bumpTimer() {
    if (hasRealVideo) scheduleHide();
  }

  useEffect(() => {
    (async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    })();
    ScreenOrientation.unlockAsync();
    const sub = Dimensions.addEventListener('change', ({ window }) => setDims(window));
    return () => {
      void deactivateKeepAwake().catch(() => {});
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!hasRealVideo) return;
      if (completedRef.current || pilier?.key == null || seanceIndex == null) return;
      const s = lastStatusRef.current;
      if (!s?.durationMillis || s.positionMillis == null) return;
      void saveVideoResume(pilier.key, seanceIndex, uriRef.current, s.positionMillis, s.durationMillis);
    };
  }, [hasRealVideo, pilier?.key, seanceIndex]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (!hasRealVideo) return;
      if (next !== 'background' && next !== 'inactive') return;
      if (completedRef.current || pilier?.key == null || seanceIndex == null) return;
      const s = lastStatusRef.current;
      if (!s?.durationMillis || s.positionMillis == null) return;
      void saveVideoResume(pilier.key, seanceIndex, uriRef.current, s.positionMillis, s.durationMillis);
    });
    return () => sub.remove();
  }, [hasRealVideo, pilier?.key, seanceIndex]);

  function syncKeepAwake(s) {
    if (!hasRealVideo) return;
    if (s?.isLoaded && s.isPlaying) {
      void activateKeepAwakeAsync().catch((e) => { if (__DEV__) devWarn('activateKeepAwakeAsync', e); });
    } else {
      void deactivateKeepAwake().catch((e) => { if (__DEV__) devWarn('deactivateKeepAwake', e); });
    }
  }

  function onPlaybackStatusUpdate(s) {
    lastStatusRef.current = s;
    if (!s.isLoaded && s.error) {
      setStatus(s);
      syncKeepAwake(s);
      if (__DEV__) console.log('Video playback error:', { uri: uriRef.current, error: s.error });
      if (__DEV__) devWarn('Video playback error', s.error);
      setVideoLoadFailed(true);
      return;
    }
    if (s.isLoaded) setVideoLoadFailed(false);
    // Demo limit: stop at 120 seconds
    if (isDemo && s.isLoaded && s.positionMillis >= 120000) {
      if (videoRef.current) videoRef.current.pauseAsync();
      if (onDemoLimit) onDemoLimit();
      return;
    }
    setStatus(s);
    syncKeepAwake(s);
    maybePersistProgress(s);
    if (hasRealVideo && !hasRestoredRef.current && s.isLoaded && s.durationMillis && pilier?.key != null && seanceIndex != null) {
      hasRestoredRef.current = true;
      loadVideoResume(pilier.key, seanceIndex, uriRef.current, s.durationMillis).then((pos) => {
        if (pos != null && videoRef.current) {
          videoRef.current.setPositionAsync(pos).then(() => {
            setResumeHint(pos);
            revealControls();
            setTimeout(() => setResumeHint(null), 2800);
          });
        }
      });
    }
  }

  function togglePlay() {
    Animated.sequence([
      Animated.timing(playScale, { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.spring(playScale, { toValue: 1, friction: 4, tension: 280, useNativeDriver: true }),
    ]).start();
    if (status.isPlaying) { videoRef.current?.pauseAsync(); } else { videoRef.current?.playAsync(); }
    bumpTimer();
  }

  async function cyclePlaybackRate() {
    var idx = RATE_OPTIONS.indexOf(playbackRate);
    var next = RATE_OPTIONS[(idx + 1) % RATE_OPTIONS.length];
    setPlaybackRate(next);
    if (videoRef.current) {
      try { await videoRef.current.setRateAsync(next, true); } catch(e) {}
    }
    bumpTimer();
  }

  function formatTimeCode(ms) {
    if (ms == null || !Number.isFinite(ms)) return '00:00';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function formatRemaining(msPos, msDur) {
    if (!msDur) return '\u221200:00';
    const rem = Math.max(0, msDur - (msPos || 0));
    const s = Math.floor(rem / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `\u2212${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `\u2212${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  var playingRef = useRef(false);
  var elapsedRef = useRef(0);
  var lastTickRef = useRef(Date.now());
  var [elapsedSec, setElapsedSec] = useState(0);

  useEffect(function() {
    playingRef.current = !!status.isPlaying;
    if (status.isPlaying) lastTickRef.current = Date.now();
  }, [status.isPlaying]);

  useEffect(function() {
    var interval = setInterval(function() {
      if (playingRef.current) {
        var now = Date.now();
        var delta = Math.floor((now - lastTickRef.current) / 1000);
        if (delta > 0) {
          elapsedRef.current += delta;
          lastTickRef.current = now;
          setElapsedSec(elapsedRef.current);
        }
      } else {
        lastTickRef.current = Date.now();
      }
    }, 1000);
    return function() { clearInterval(interval); };
  }, []);

  function getElapsedMinutes() { return Math.max(1, Math.round(elapsedSec / 60)); }

  // Start the live-HR polling session the FIRST time the video actually
  // reaches a playing state — not on mount. Otherwise we'd open a HealthKit
  // observer just for users scrolling through previews.
  const hrStartedRef = useRef(false);
  useEffect(function() {
    if (!hrEnabled) return;
    if (hrStartedRef.current) return;
    if (!status?.isPlaying) return;
    hrStartedRef.current = true;
    try { hr.start(); } catch (e) { if (__DEV__) devWarn('hr.start', e); }
  }, [hrEnabled, status?.isPlaying]);

  // Make sure the polling interval is shut down whatever the exit path
  // (back press, complete, swipe-down on the modal). The hook also cleans
  // on unmount but stopping here means we keep the HR summary in scope
  // for saveExerciseTime below.
  useEffect(function() {
    return function() {
      if (hrStartedRef.current) {
        try { hr.stop(); } catch (e) {}
      }
    };
  }, []);

  // Save exercise time locally for activity rings
  async function saveExerciseTime(minutes) {
    try {
      var key = 'fluid_exercise_' + new Date().toISOString().slice(0, 10);
      var raw = await AsyncStorage.getItem(key);
      var total = raw ? parseInt(raw) : 0;
      await AsyncStorage.setItem(key, String(total + minutes));
    } catch(e) {}
    // Feed the smart-notification preferred-hour learner so future reminders
    // land near the user's actual training time.
    try { recordSessionHour(new Date()); } catch (e) {}
    // Stop HR session first, capture summary, then forward to the workout save.
    var summary = null;
    if (hrStartedRef.current) {
      try { summary = hr.stop(); } catch (e) {}
      hrStartedRef.current = false;
    }
    if (saveHealthKitWorkout) {
      // Si on a une avgBpm valable, on remonte une estimation kcal un peu plus
      // honnête : Pilates oscille entre 4 et 7 kcal/min selon l'intensité.
      // 0.06 * avgBpm × min reste un proxy grossier mais corrige les sessions
      // intenses (Pilates avancé sur reformer ≈ 6 kcal/min, vs 3 kcal/min en
      // séance Comprendre).
      var extras = null;
      if (summary && Number.isFinite(summary.avgBpm) && summary.avgBpm > 0) {
        extras = { energyBurned: Math.round(minutes * Math.max(3, summary.avgBpm * 0.06)) };
      }
      try { saveHealthKitWorkout(minutes, extras); } catch (e) {
        // Backward compat : si l'ancienne signature 1-arg est appelée par mistake
        if (__DEV__) devWarn('saveHealthKitWorkout extras', e);
      }
    }
  }

  const progress = status.durationMillis ? status.positionMillis / status.durationMillis : 0;
  const barW = Math.max(40, dims.width - 40);
  const thumbSize = 16;
  const thumbLeft = Math.max(0, Math.min(barW - thumbSize, progress * barW - thumbSize / 2));

  var timerMin = Math.floor(elapsedSec / 60);
  var timerSec = elapsedSec % 60;
  var timerStr = String(timerMin).padStart(2, '0') + ':' + String(timerSec).padStart(2, '0');

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: '#000', width: dims.width, height: dims.height }}>
      {hasRealVideo && uri ? (
        <Video
          key={videoResetKey}
          ref={videoRef}
          source={{ uri }}
          style={{ position: 'absolute', top: 0, left: 0, width: dims.width, height: dims.height }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          rate={playbackRate}
          shouldCorrectPitch={true}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />
      ) : hasRealVideo ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: dims.width,
            height: dims.height,
            backgroundColor: '#000',
          }}
        />
      ) : (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: dims.width,
            height: dims.height,
            backgroundColor: '#000',
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: 48,
          }}
        >
          <VideoPlaceholderMeduse size={Math.min(dims.width, dims.height) * 0.58} />
          <Text
            style={{
              marginTop: 28,
              fontSize: 17,
              fontWeight: '500',
              color: '#ffffff',
              textAlign: 'center',
              paddingHorizontal: 32,
              lineHeight: 24,
              letterSpacing: 0.3,
            }}
          >
            Vidéo bientôt disponible
          </Text>
        </View>
      )}

      {!videoLoadFailed && !isTheory && !showControls && (
        <>
        <View pointerEvents="none" style={{ position: 'absolute', top: 50, left: 16, zIndex: 210 }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 16, padding: 12, minWidth: 110 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: '#ffffff', fontVariant: ['tabular-nums'], letterSpacing: -1 }}>{timerStr}</Text>
              <View style={{ width: 18, height: 18, marginLeft: 2 }}>
                <Svg width={18} height={18} viewBox="0 0 18 18">
                  <Circle cx="9" cy="9" r="7" stroke="rgba(174,239,77,0.3)" strokeWidth={2} fill="none" />
                  <Path d={'M9 2a7 7 0 0 1 ' + (Math.min(elapsedSec / ((parseInt(duree) || 15) * 60), 1) > 0.5 ? '0 14' : (7 * Math.sin(Math.min(elapsedSec / ((parseInt(duree) || 15) * 60), 1) * Math.PI * 2)).toFixed(1) + ' ' + (7 - 7 * Math.cos(Math.min(elapsedSec / ((parseInt(duree) || 15) * 60), 1) * Math.PI * 2)).toFixed(1))} stroke="#AEEF4D" strokeWidth={2} fill="none" strokeLinecap="round" />
                </Svg>
              </View>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#ffffff', fontVariant: ['tabular-nums'] }}>{Math.round(elapsedSec / 60 * 5)}<Text style={{ fontSize: 14, fontWeight: '800', color: '#FF3B30' }}> KCAL</Text></Text>
          </View>
        </View>
        {/* HR pill (top-right). Shows when (a) display flag on, (b) at least
            one BPM sample has come through HealthKit. Pill stays mounted
            across stale (isLive=false) for visual continuity but goes 50%
            opacity — see HeartRatePill. */}
        {hrEnabled && hr.bpm != null && (
          <View pointerEvents="box-none" style={{ position: 'absolute', top: 50, right: 16, zIndex: 220 }}>
            <HeartRatePill bpm={hr.bpm} isLive={hr.isLive} birthDateIso={effectiveBirthDate} />
          </View>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', top: (hrEnabled && hr.bpm != null) ? 90 : 50, right: 16, zIndex: 210 }}>
          <View style={{ width: 44, height: 44 }}>
            <Svg width={44} height={44} viewBox="0 0 44 44">
              <Circle cx="22" cy="22" r="19" stroke="rgba(255,59,48,0.3)" strokeWidth={3} fill="none" />
              <Circle cx="22" cy="22" r="19" stroke="#FF3B30" strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 19} strokeDashoffset={2 * Math.PI * 19 * (1 - Math.min(elapsedSec / 60 * 5 / 400, 1))} transform="rotate(-90 22 22)" />
              <Circle cx="22" cy="22" r="14" stroke="rgba(48,209,88,0.3)" strokeWidth={3} fill="none" />
              <Circle cx="22" cy="22" r="14" stroke="#30D158" strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 14} strokeDashoffset={2 * Math.PI * 14 * (1 - Math.min(elapsedSec / 60 / 30, 1))} transform="rotate(-90 22 22)" />
              <Circle cx="22" cy="22" r="9" stroke="rgba(10,132,255,0.3)" strokeWidth={3} fill="none" />
              <Circle cx="22" cy="22" r="9" stroke="#0A84FF" strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 9} strokeDashoffset={2 * Math.PI * 9 * 0.92} transform="rotate(-90 22 22)" />
            </Svg>
          </View>
        </View>
        </>
      )}

      {hasRealVideo && !videoLoadFailed && !showControls && (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, zIndex: 210 }}>
          <View style={{ height: 3, width: (progress * 100) + '%', backgroundColor: '#AEEF4D' }} />
        </View>
      )}

      {ccEnabled && ccText && (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: showControls ? 140 : 60, left: 20, right: 20, zIndex: 220, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, maxWidth: '90%' }}>
            <Text style={{ fontSize: 16, fontWeight: '500', color: '#ffffff', textAlign: 'center', lineHeight: 22 }}>{ccText}</Text>
          </View>
        </View>
      )}

      {showCcPicker && (
        <Pressable onPress={function() { setShowCcPicker(false); }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 230, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'flex-end', paddingTop: 100, paddingRight: 20 }}>
          <View style={{ backgroundColor: 'rgba(28,28,30,0.95)', borderRadius: 14, padding: 8, width: 160 }}>
            {SUBTITLE_LANGS.map(function(sl) {
              var active = ccLang === sl.code;
              return (
                <TouchableOpacity key={sl.code} onPress={function() { setCcLang(sl.code); setShowCcPicker(false); bumpTimer(); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: active ? 'rgba(174,239,77,0.15)' : 'transparent' }}>
                  <Text style={{ fontSize: 14, color: active ? '#AEEF4D' : '#ffffff' }}>{sl.label}</Text>
                  {active && <Text style={{ fontSize: 12, color: '#AEEF4D' }}>{'✓'}</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      )}

      {videoLoadFailed && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.94)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
            zIndex: 400,
          }}
          pointerEvents="box-none"
        >
          <Text style={{ fontSize: 16, fontWeight: '500', color: 'rgba(230,248,255,0.92)', textAlign: 'center', marginBottom: 20, lineHeight: 24 }}>
            {tr.video_load_error}
          </Text>
          <TouchableOpacity
            onPress={retryVideoLoad}
            style={{ paddingVertical: 14, paddingHorizontal: 28, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,235,255,0.55)', backgroundColor: 'rgba(0,100,140,0.35)' }}
            accessibilityRole="button"
            accessibilityLabel={tr.video_retry}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: 'rgba(230,250,255,0.95)', letterSpacing: 0.5 }}>{tr.video_retry}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!videoLoadFailed && !showControls && (
        <Pressable style={StyleSheet.absoluteFillObject} onPress={revealControls} android_ripple={null} />
      )}

      {!videoLoadFailed && showControls && (
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, { opacity: controlsOpacity }]}>
          <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={hideControls} android_ripple={null} />
          <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
            {/* Top-left : X + PiP/fullscreen — capsule Liquid Glass */}
            <View pointerEvents="box-none" style={{ position: 'absolute', top: 50, left: 16 }}>
              <LiquidGlassCapsule tint="light" paddingH={10} paddingV={6} gap={12}>
                <TouchableOpacity onPress={() => { void handleCloseVideo(); }} hitSlop={10} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#FFFFFF', fontWeight: '500' }}>{'✕'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { bumpTimer(); }} hitSlop={10} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M3 7 a2 2 0 0 1 2 -2 H14 a2 2 0 0 1 2 2 V13 a2 2 0 0 1 -2 2 H10" stroke="#FFFFFF" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M9 11 H19 a2 2 0 0 1 2 2 V18 a2 2 0 0 1 -2 2 H9 a2 2 0 0 1 -2 -2 V13 a2 2 0 0 1 2 -2 Z" fill="#FFFFFF" />
                  </Svg>
                </TouchableOpacity>
              </LiquidGlassCapsule>
            </View>

            {/* Top-right : volume slider + speaker */}
            <View pointerEvents="box-none" style={{ position: 'absolute', top: 56, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable
                onPress={async (e) => {
                  bumpTimer();
                  const w = 90;
                  const x = e.nativeEvent.locationX;
                  const v = Math.max(0, Math.min(1, x / w));
                  setVolume(v);
                  try { await videoRef.current?.setVolumeAsync(v); } catch(_) {}
                }}
                style={{ width: 90, height: 24, justifyContent: 'center' }}
              >
                <View style={{ height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: (volume * 100) + '%', backgroundColor: '#ffffff', borderRadius: 2.5 }} />
                </View>
              </Pressable>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M3 10 v4 h3 l5 4 V6 L6 10 Z" fill="#fff" />
                <Path d="M15 9 c1.5 1.5 1.5 4.5 0 6" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" fill="none" />
                <Path d="M18 6 c3 3 3 9 0 12" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" fill="none" />
              </Svg>
            </View>

            {hasRealVideo && (
            <View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
                <VideoSkip10Icon
                  reverse
                  bumpTimer={bumpTimer}
                  onPress={async () => {
                    const pos = Math.max(0, (status.positionMillis || 0) - 10000);
                    await videoRef.current?.setPositionAsync(pos);
                  }}
                />
                <Pressable
                  onPress={togglePlay}
                  hitSlop={12}
                  accessibilityLabel={status.isPlaying ? 'Pause' : 'Lecture'}
                  accessibilityRole="button"
                >
                  <Animated.View style={{ transform: [{ scale: playScale }] }}>
                    <GlassView
                      intensity={55}
                      tint="dark"

                      forceDark
                      borderRadius={36}
                      contentStyle={{
                        width: 72,
                        height: 72,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <VideoPlayPauseIcon playing={!!status.isPlaying} size={32} />
                    </GlassView>
                  </Animated.View>
                </Pressable>
                <VideoSkip10Icon
                  bumpTimer={bumpTimer}
                  onPress={async () => {
                    const pos = Math.min(status.durationMillis || 0, (status.positionMillis || 0) + 10000);
                    await videoRef.current?.setPositionAsync(pos);
                  }}
                />
              </View>
            </View>
            )}

            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: 32, paddingHorizontal: 20 }} pointerEvents="box-none">
              {hasRealVideo && (
                <View style={{ alignItems: 'flex-end', marginBottom: 10 }}>
                  <TouchableOpacity onPress={cyclePlaybackRate} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Vitesse de lecture ${playbackRate}x`}>
                    <GlassView
                      intensity={45}
                      tint="dark"

                      forceDark
                      borderRadius={16}
                      contentStyle={{
                        width: 32,
                        height: 32,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {playbackRate === 1.0 ? (
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                          <Path d="M12 3 a9 9 0 1 1 -6.4 2.6" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" fill="none" />
                          <Path d="M12 12 L7 7" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" fill="none" />
                        </Svg>
                      ) : (
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF' }}>{playbackRate}x</Text>
                      )}
                    </GlassView>
                  </TouchableOpacity>
                </View>
              )}
              {hasRealVideo && resumeHint != null && (
                <View
                  style={{
                    alignSelf: 'center',
                    marginBottom: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 5,
                    borderRadius: 14,
                    backgroundColor: 'rgba(0,0,0,0.42)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.14)',
                  }}
                  accessibilityLiveRegion="polite"
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.92)', letterSpacing: 0.4 }}>
                    {typeof tr.video_resume === 'function' ? tr.video_resume(formatTimeCode(resumeHint)) : ''}
                  </Text>
                </View>
              )}
              {hasRealVideo && (
                <GlassView
                  intensity={50}
                  tint="dark"

                  forceDark
                  borderRadius={GLASS_RADII.button}
                  style={{ marginBottom: 16 }}
                  contentStyle={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '500', color: '#ffffff', minWidth: 44, fontVariant: ['tabular-nums'] }}>{formatTimeCode(status.positionMillis)}</Text>
                  <Pressable
                    accessibilityLabel="Barre de progression de la vidéo"
                    accessibilityRole="adjustable"
                    onPress={async (e) => {
                      bumpTimer();
                      if (!status.durationMillis) return;
                      const w = e.nativeEvent.target ? barW : barW;
                      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / w));
                      await videoRef.current?.setPositionAsync(ratio * status.durationMillis);
                    }}
                    style={{ flex: 1, height: 24, justifyContent: 'center' }}
                  >
                    <View style={{ height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                      <View style={{ width: (progress * 100) + '%', height: '100%', backgroundColor: '#ffffff' }} />
                    </View>
                  </Pressable>
                  <Text style={{ fontSize: 11, fontWeight: '500', color: '#ffffff', minWidth: 44, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{formatRemaining(status.positionMillis, status.durationMillis)}</Text>
                </GlassView>
              )}
              {(progress >= 0.8 || !hasRealVideo || elapsedSec >= 60) && (
                <Animated.View style={{ transform: [{ scale: doneScale }] }}>
                  <GlassButton
                    variant="accent"
                    forceDark
                    size="lg"
                    haptic="success"
                    accessibilityLabel={tr.seance_done}
                    onPress={() => {
                      bumpTimer();
                      Animated.sequence([
                        Animated.timing(doneScale, { toValue: 0.97, duration: 60, useNativeDriver: true }),
                        Animated.spring(doneScale, { toValue: 1, friction: 4, tension: 280, useNativeDriver: true }),
                      ]).start();
                      completedRef.current = true;
                      if (pilier?.key != null && seanceIndex != null) clearVideoResume(pilier.key, seanceIndex);
                      saveExerciseTime(getElapsedMinutes());
                      // Smart notifications — if the user watched ≥80% of a
                      // real video, treat as an active break and suppress the
                      // next 3h of "pause active" reminders. Theory sessions
                      // (no real video) don't qualify.
                      var lastSt = lastStatusRef.current;
                      var shouldCancel =
                        hasRealVideo
                        && lastSt
                        && lastSt.durationMillis > 0
                        && (lastSt.positionMillis / lastSt.durationMillis) >= 0.8;
                      if (shouldCancel) {
                        cancelPauseActiveNotifications('next3h').catch(function() {});
                      }
                      onComplete();
                    }}
                    textStyle={{
                      fontSize: 14,
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                      fontWeight: '700',
                    }}
                  >
                    {tr.seance_done}
                  </GlassButton>
                </Animated.View>
              )}
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
