import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Pressable, Animated,
  Dimensions, Platform, StyleSheet, AppState,
} from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { T } from '../constants/data';
import { VideoPlaceholderMeduse } from './Meduse';

// ── Optional native modules (safe for Expo Go) ──
let HapticsMod = null;
try { HapticsMod = require('expo-haptics'); } catch (e) {}

// ── Small utilities (local copies to avoid circular deps) ──

function hapticSuccess() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  try { void HapticsMod.notificationAsync(HapticsMod.NotificationFeedbackType.Success); } catch (e) {}
}

function devWarn(...args) {
  if (__DEV__) console.warn('[FluidBody]', ...args);
}

/** URL vidéo hébergée Bunny.net (HLS / CDN). */
function isBunnyVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim().toLowerCase();
  if (u.includes('b-cdn.net')) return true;
  if (u.includes('bunnycdn.com')) return true;
  if (u.includes('bunny.net')) return true;
  if (u.includes('vz-') && u.includes('.m3u8')) return true;
  return false;
}

const VIDEO_DEMO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

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

async function saveVideoResume(pilierKey, seanceIndex, uri, positionMillis, durationMillis) {
  if (!uri || !durationMillis || positionMillis == null) return;
  if (positionMillis < 2500) return;
  if (durationMillis - positionMillis < 5000) return;
  try {
    await AsyncStorage.setItem(
      videoResumeStorageKey(pilierKey, seanceIndex),
      JSON.stringify({ uri, positionMillis, durationMillis, t: Date.now() }),
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
    if (o.uri !== currentUri) return null;
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
  { code: 'fr', label: 'Français' }, { code: 'en', label: 'English' }, { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' }, { code: 'zh', label: '中文' }, { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' }, { code: 'es', label: 'Español' }, { code: 'it', label: 'Italiano' },
];

function extractVideoId(url) {
  if (!url) return null;
  var m = url.match(/\/([0-9a-f-]{36})\//);
  return m ? m[1] : null;
}

function getSubtitleUrl(videoUrl, langCode) {
  var id = extractVideoId(videoUrl);
  if (!id) return null;
  return 'https://vz-1a4e2cac-0dc.b-cdn.net/' + id + '/subtitles/' + langCode + '.vtt';
}

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
  return (
    <Pressable
      accessibilityLabel={a11y}
      accessibilityRole="button"
      onPress={async () => {
        bumpTimer();
        await onPress?.();
      }}
      hitSlop={14}
      style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: SKIP_BTN,
          height: SKIP_BTN,
          borderRadius: SKIP_BTN / 2,
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.45)',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: reverse ? 4 : 4,
          paddingHorizontal: 6,
          shadowColor: '#000',
          shadowOpacity: 0.42,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 5 },
          elevation: 12,
        }}
      >
        {reverse ? (
          <>
            <VideoSkipChevrons reverse />
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>10</Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>10</Text>
            <VideoSkipChevrons reverse={false} />
          </>
        )}
      </View>
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

export default function VideoPlayer({ seance, pilier, onClose, onComplete, lang, seanceIndex, isDemo, onDemoLimit, saveHealthKitWorkout }) {
  const tr = T[lang] || T['fr'];
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
  const [videoLoadFailed, setVideoLoadFailed] = useState(false);
  const [videoResetKey, setVideoResetKey] = useState(0);
  const [titre, duree, etape, videoUrl] = seance;
  const hasRealVideo = isBunnyVideoUrl(videoUrl);
  const [showControls, setShowControls] = useState(!hasRealVideo);
  const [uri, setUri] = useState(hasRealVideo ? (videoUrl || '') : '');
  const uriRef = useRef(uri);
  uriRef.current = uri;
  const lastPersistAtRef = useRef(0);
  var [ccEnabled, setCcEnabled] = useState(false);
  var [ccLang, setCcLang] = useState(lang || 'fr');
  var [ccCues, setCcCues] = useState([]);
  var [ccText, setCcText] = useState(null);
  var [showCcPicker, setShowCcPicker] = useState(false);

  useEffect(function() {
    if (!ccEnabled || !hasRealVideo || !videoUrl) { setCcCues([]); return; }
    var url = getSubtitleUrl(videoUrl, ccLang);
    if (!url) return;
    fetch(url).then(function(r) { if (r.ok) return r.text(); throw new Error('no vtt'); })
      .then(function(txt) { setCcCues(parseVtt(txt)); })
      .catch(function() { setCcCues([]); });
  }, [ccEnabled, ccLang, videoUrl]);

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
      console.log('Video playback error:', { uri: uriRef.current, error: s.error });
      if (__DEV__) devWarn('Video playback error', s.error);
      // Fallback: si l'URL spécifique échoue, basculer sur la démo pour éviter un écran bloqué
      if (hasRealVideo && uriRef.current !== VIDEO_DEMO) {
        setUri(VIDEO_DEMO);
        hasRestoredRef.current = false;
        setVideoResetKey((k) => k + 1);
        return;
      }
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

  // Save exercise time locally for activity rings
  async function saveExerciseTime(minutes) {
    try {
      var key = 'fluid_exercise_' + new Date().toISOString().slice(0, 10);
      var raw = await AsyncStorage.getItem(key);
      var total = raw ? parseInt(raw) : 0;
      await AsyncStorage.setItem(key, String(total + minutes));
    } catch(e) {}
    if (saveHealthKitWorkout) saveHealthKitWorkout(minutes);
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
      {hasRealVideo ? (
        <Video
          key={videoResetKey}
          ref={videoRef}
          source={{ uri }}
          style={{ position: 'absolute', top: 0, left: 0, width: dims.width, height: dims.height }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
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

      {!videoLoadFailed && (
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
        <View pointerEvents="none" style={{ position: 'absolute', top: 50, right: 16, zIndex: 210 }}>
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
        <>
          <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={hideControls} android_ripple={null} />
          <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
            <View style={{ paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }} pointerEvents="box-none">
              <View style={{ flex: 1, paddingRight: 12 }} pointerEvents="box-none">
                <TouchableOpacity onPress={() => { void handleCloseVideo(); }} hitSlop={10} style={{ alignSelf: 'flex-start', marginBottom: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.9)' }}>{tr.retour_video}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: 0.3 }} numberOfLines={2}>{titre.toUpperCase()}</Text>
                <Text style={{ fontSize: 13, fontWeight: '300', color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>
                  {tr.etapes[etape] || etape} · {pilier.label} · {duree}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {hasRealVideo && (
                  <TouchableOpacity onPress={function() { setCcEnabled(!ccEnabled); bumpTimer(); }} hitSlop={10} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: ccEnabled ? '#AEEF4D' : 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: ccEnabled ? '#000' : '#fff' }}>CC</Text>
                  </TouchableOpacity>
                )}
                {hasRealVideo && ccEnabled && (
                  <TouchableOpacity onPress={function() { setShowCcPicker(!showCcPicker); bumpTimer(); }} hitSlop={10} style={{ height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>{ccLang.toUpperCase()}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { void handleCloseVideo(); }} hitSlop={14} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22, color: '#fff', fontWeight: '300' }}>{'\u2715'}</Text>
                </TouchableOpacity>
              </View>
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
                  <Animated.View style={{
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.45)',
                    shadowColor: '#000',
                    shadowOpacity: 0.5,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 14,
                    transform: [{ scale: playScale }],
                  }}>
                    <VideoPlayPauseIcon playing={!!status.isPlaying} size={36} />
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
              <>
              <Pressable
                accessibilityLabel="Barre de progression de la vidéo"
                accessibilityRole="adjustable"
                onPress={async (e) => {
                  bumpTimer();
                  if (!status.durationMillis) return;
                  const { locationX } = e.nativeEvent;
                  const ratio = Math.max(0, Math.min(1, locationX / barW));
                  await videoRef.current?.setPositionAsync(ratio * status.durationMillis);
                }}
                style={{ width: barW, height: 28, alignSelf: 'center', justifyContent: 'center', marginBottom: 8 }}
              >
                <View style={{ width: barW, height: 28, justifyContent: 'center' }}>
                  <View style={{ height: 4, width: barW, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }}>
                    <View style={{ width: barW * progress, height: 4, borderRadius: 2, backgroundColor: '#fff' }} />
                  </View>
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: thumbLeft,
                      top: (28 - thumbSize) / 2,
                      width: thumbSize,
                      height: thumbSize,
                      borderRadius: thumbSize / 2,
                      backgroundColor: '#fff',
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.12)',
                      shadowColor: '#000',
                      shadowOpacity: 0.35,
                      shadowRadius: 6,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 4,
                    }}
                  />
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: barW, alignSelf: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.85)' }}>{formatTimeCode(status.positionMillis)}</Text>
                <Text style={{ fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.85)' }}>{formatRemaining(status.positionMillis, status.durationMillis)}</Text>
              </View>
              </>
              )}
              {(progress >= 0.8 || !hasRealVideo || elapsedSec >= 60) && <Pressable
                onPress={() => {
                  bumpTimer();
                  hapticSuccess();
                  Animated.sequence([
                    Animated.timing(doneScale, { toValue: 0.97, duration: 60, useNativeDriver: true }),
                    Animated.spring(doneScale, { toValue: 1, friction: 4, tension: 280, useNativeDriver: true }),
                  ]).start();
                  completedRef.current = true;
                  if (pilier?.key != null && seanceIndex != null) clearVideoResume(pilier.key, seanceIndex);
                  saveExerciseTime(getElapsedMinutes());
                  onComplete();
                }}
                style={{ alignSelf: 'stretch' }}
              >
                <Animated.View style={{
                  borderRadius: 24,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.26)',
                  transform: [{ scale: doneScale }],
                  shadowColor: '#000',
                  shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0.12,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: Platform.OS === 'android' ? 5 : 0,
                }}>
                  {Platform.OS === 'web' ? (
                    <View style={{
                      height: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 16,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 2, textTransform: 'uppercase' }}>
                        {tr.seance_done}
                      </Text>
                    </View>
                  ) : (
                    <BlurView
                      intensity={Platform.OS === 'ios' ? 14 : 10}
                      tint="dark"
                      style={{
                        height: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 16,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '700',
                          color: '#fff',
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                          textShadowColor: 'rgba(0,0,0,0.55)',
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 5,
                        }}
                      >
                        {tr.seance_done}
                      </Text>
                    </BlurView>
                  )}
                </Animated.View>
              </Pressable>}
            </View>
          </View>
        </>
      )}
    </View>
  );
}
