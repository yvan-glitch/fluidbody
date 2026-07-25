import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, Animated, Dimensions, StyleSheet, AppState, Alert, Platform, PanResponder, Easing } from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
// expo-screen-orientation: native module manquant sur tvOS, lazy require avec fallback
let ScreenOrientation = null;
try { ScreenOrientation = require('expo-screen-orientation'); } catch(e) {}
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { T } from '../constants/data';
import { VideoPlaceholderMeduse } from './Meduse';
import Skeleton from './Skeleton';
import LiquidGlassCapsule from './LiquidGlassCapsule';
import { Icon } from './Icons';
// (HeartRatePill remplacée le 25/07 par la ligne BPM du HUD façon Watch —
// composant conservé dans src/components/ si besoin ailleurs.)

// Cœur rouge qui bat au rythme réel du BPM (repris de HeartRatePill).
// Grisé et immobile quand le signal est absent ou stale.
function PulsingHeart({ bpm, isLive, size = 19 }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!bpm || !isLive) { pulse.setValue(1); return undefined; }
    const cycleMs = Math.max(280, Math.min(1500, Math.round(60000 / bpm)));
    const upMs = Math.max(100, Math.round(cycleMs * 0.35));
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: upMs, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: cycleMs - upMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => { try { loop.stop(); } catch (e) {} };
  }, [bpm, isLive, pulse]);
  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M12 21s-7-4.6-9.4-9.1C.8 8.5 2.7 5 6 5c2 0 3.4 1 4 2.4C10.6 6 12 5 14 5c3.3 0 5.2 3.5 3.4 6.9C19 16.4 12 21 12 21Z"
          fill={bpm != null && isLive ? '#FF3B4F' : 'rgba(255,80,90,0.45)'}
        />
      </Svg>
    </Animated.View>
  );
}
import { GlassView, GlassButton, GLASS_RADII, GLASS_EASING, GLASS_DURATIONS } from './ui';
import { getSignedVideoUrl, buildSessionId } from '../utils/videoUrl';
import { breadcrumb } from '../utils/breadcrumb';
import { hapticLight } from '../utils';
import { saveVideoDurationMin } from '../utils/videoDurations';
import useLiveHeartRate from '../hooks/useLiveHeartRate';
import { recordSessionHour, cancelPauseActiveNotifications } from '../utils/notifications';
import { IS_TV, tvFocusProps } from '../utils/platformTV';
import { isDownloaded, getLocalVideoUri } from './DownloadManager';
import { getCachedPref } from '../utils/userPreferences';
import { writeWorkoutEffortScore } from '../utils/healthkit';

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

// Garde-fou juridique pré-séance : confirmation unique par session (process
// en mémoire, PAS de persistance AsyncStorage → réaffiché à chaque cold start,
// une seule fois ensuite). Partagé entre tous les montages de VideoPlayer pour
// ne pas réafficher l'alerte à chaque séance lancée dans la même session.
var _preSeanceConfirmedThisSession = false;

// ── Étape colors (also kept in App.js for PilierPanel) ──

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


function VideoSkip10Icon({ reverse, onPress, bumpTimer }) {
  const a11y = reverse ? 'Revenir de 10 secondes' : 'Avancer de 10 secondes';
  // Apple TV : skip buttons need to be readable from 2-3m, scale them up
  // by ~70 % and bump label/stroke proportionally.
  const SIZE = IS_TV ? 90 : 52;
  const STROKE = IS_TV ? 1.2 : 1.5; // SVG is in a 24-unit viewBox, smaller stroke reads cleaner at scale
  const LABEL = IS_TV ? 20 : 12;
  return (
    <Pressable
      accessibilityLabel={a11y}
      accessibilityRole="button"
      onPress={async () => { bumpTimer(); await onPress?.(); }}
      hitSlop={14}
      {...tvFocusProps(false)}
      style={{ width: SIZE + 12, height: SIZE + 12, alignItems: 'center', justifyContent: 'center' }}
    >
      <GlassView
        intensity={IS_TV ? 60 : 45}
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
              <Path d="M12 5 A7 7 0 1 0 19 12" stroke="#fff" strokeWidth={STROKE} strokeLinecap="round" fill="none" />
              <Path d="M14.5 3 L12 5 L14.5 7.5" stroke="#fff" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          ) : (
            <>
              <Path d="M12 5 A7 7 0 1 1 5 12" stroke="#fff" strokeWidth={STROKE} strokeLinecap="round" fill="none" />
              <Path d="M9.5 3 L12 5 L9.5 7.5" stroke="#fff" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </>
          )}
        </Svg>
        <Text style={{ fontSize: LABEL, fontWeight: '800', color: '#fff', letterSpacing: -0.3, marginTop: IS_TV ? 4 : 1 }}>10</Text>
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
  // tvOS n'a pas HealthKit → la pill BPM ne peut pas s'allumer. On force OFF.
  const hrEnabled = !IS_TV && ((showHeartRate != null) ? showHeartRate : showHrPref);
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
  // Ref pour ne tirer qu'un seul Alert.alert diagnostic si la lecture échoue
  // (expo-av peut spammer onPlaybackStatusUpdate avec l'erreur).
  const alertedOnceRef = useRef(false);
  const [videoResetKey, setVideoResetKey] = useState(0);
  const [titre, duree, etape, videoFlag] = seance;
  const isTheory = etape === 'Comprendre' || etape === 'Ressentir';
  // Pré-séance : on ne gate que les vraies séances de pratique (pas le
  // théorique Comprendre/Ressentir). Confirmé d'office si déjà validé dans
  // cette session process, ou pour le contenu théorique.
  const [preSeanceConfirmed, setPreSeanceConfirmed] = useState(_preSeanceConfirmedThisSession || isTheory);
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

  // ── Scrubbing de la barre de progression (retour Yvan 25/07) ──
  // On remplace le simple onPress par un PanResponder : le doigt peut
  // glisser le long de la barre, l'UI suit en direct (scrubRatio) et le
  // seek réel (setPositionAsync) n'est fait qu'au relâchement — évite de
  // spammer expo-av pendant le drag. Les handlers ne touchent que des refs
  // et des setState (stables), donc la closure du 1er render suffit.
  const seekBarWRef = useRef(1);
  const scrubRatioRef = useRef(null);
  const [scrubRatio, setScrubRatio] = useState(null); // null = pas de scrub

  function updateScrub(x) {
    const w = seekBarWRef.current || 1;
    const r = Math.max(0, Math.min(1, x / w));
    scrubRatioRef.current = r;
    setScrubRatio(r);
  }
  function commitScrub() {
    const r = scrubRatioRef.current;
    scrubRatioRef.current = null;
    setScrubRatio(null);
    const dur = lastStatusRef.current && lastStatusRef.current.durationMillis;
    if (r != null && dur) {
      try { videoRef.current?.setPositionAsync(r * dur); } catch (e) {}
    }
  }
  // ── Double-tap → vidéo plein écran (retour Yvan 25/07) ──
  // CONTAIN (par défaut, bandes noires) ⇄ COVER (remplit l'écran, léger
  // crop). Détection maison : 2 taps < 300 ms. Le 1er tap déclenche
  // quand même l'affichage/masquage des contrôles (comme YouTube) —
  // acceptable et évite de retarder chaque tap simple de 300 ms.
  const [videoFill, setVideoFill] = useState(false);
  const lastTapAtRef = useRef(0);
  function handleScreenTap(singleTapAction) {
    const now = Date.now();
    if (now - lastTapAtRef.current < 300) {
      lastTapAtRef.current = 0;
      hapticLight();
      setVideoFill(function (v) { return !v; });
      return;
    }
    lastTapAtRef.current = now;
    if (singleTapAction) singleTapAction();
  }

  const seekPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: function () { return true; },
    onMoveShouldSetPanResponder: function () { return true; },
    onPanResponderTerminationRequest: function () { return false; },
    onPanResponderGrant: function (e) { bumpTimer(); updateScrub(e.nativeEvent.locationX); },
    onPanResponderMove: function (e) { bumpTimer(); updateScrub(e.nativeEvent.locationX); },
    onPanResponderRelease: function () { commitScrub(); },
    onPanResponderTerminate: function () { commitScrub(); },
  })).current;

  // Fetch a fresh signed MP4 URL whenever we need one (initial mount or after
  // a forced reset). If the session is downloaded locally, decrypt-to-temp
  // first and play from disk — no Bunny round-trip, works offline.
  // Sinon : signed Bunny URL via l'edge function (token court).
  //
  // INSTRUMENTATION (diagnostic round) — Alert.alert visible en cas
  // d'échec offline ; à retirer une fois le bug confirmé/fixé.
  useEffect(function() {
    if (!hasRealVideo || !sessionId || !pilier?.key || typeof seanceIndex !== 'number') return;
    breadcrumb('Started session', { pilier: pilier.key, seanceIndex }, { category: 'video' });
    let cancelled = false;
    setUri('');
    hasRestoredRef.current = false;
    alertedOnceRef.current = false;

    (async function() {
      const trace = []; // accumulator pour Alert si erreur
      try {
        // Étape 1 — fichier local (iPhone download). Sur TV `isDownloaded`
        // renvoie false (rien n'est jamais téléchargé sur tvOS).
        if (!IS_TV) {
          trace.push('check local p=' + pilier.key + ' i=' + seanceIndex);
          let local = false;
          try {
            local = await isDownloaded(pilier.key, seanceIndex);
          } catch (e) {
            trace.push('isDownloaded threw: ' + (e?.message || e));
          }
          trace.push('isDownloaded=' + local);
          if (local) {
            let localUri = null;
            try {
              localUri = await getLocalVideoUri(pilier.key, seanceIndex);
            } catch (e) {
              trace.push('getLocalVideoUri threw: ' + (e?.message || e));
            }
            trace.push('localUri=' + (localUri || 'null'));
            if (!cancelled && localUri) { setUri(localUri); return; }
            // Marqué "downloaded" mais le décrypte fail → erreur explicite
            // plutôt que fallback Bunny (qui ne marchera pas offline non plus).
            if (!cancelled && !localUri) {
              Alert.alert(
                'Téléchargement corrompu',
                'Le fichier hors-ligne est illisible. Re-téléchargez la séance.\n\nDébug : ' + trace.join(' | ')
              );
              setVideoLoadFailed(true);
              return;
            }
          }
        }
        // Étape 2 — fallback Bunny signé.
        trace.push('try Bunny');
        const signed = await getSignedVideoUrl(sessionId, 'mp4');
        trace.push('Bunny=' + (signed ? 'ok' : 'empty'));
        if (!cancelled) setUri(signed);
      } catch (err) {
        if (cancelled) return;
        const msg = err?.message || String(err);
        trace.push('CATCH: ' + msg);
        breadcrumb('Bunny URL fetch error', { pilier: pilier?.key, seanceIndex, msg }, { category: 'video', level: 'error' });
        if (__DEV__) devWarn('VideoPlayer.urlResolve.ERR', msg);
        Alert.alert(
          'Vidéo indisponible',
          'Impossible de charger la séance.\n\nDébug : ' + trace.join(' | ')
        );
        setVideoLoadFailed(true);
      }
    })();

    return function() {
      cancelled = true;
      // NOTE — on NE supprime PAS le fichier décrypté au unmount. expo-av
      // peut être en train de le lire encore et le delete race avec la
      // lecture. Le cache OS le nettoie de toute façon, et la place est
      // négligeable (taille du MP4 décrypté).
    };
  }, [hasRealVideo, sessionId, pilier?.key, seanceIndex, videoResetKey]);

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
      // staysActiveInBackground piloté par la préférence utilisateur
      // (Profil > Préférences > "Lecture audio en arrière-plan").
      // Default false — l'utilisateur doit explicitement opt-in.
      const bgAudio = !!getCachedPref('backgroundAudio');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: bgAudio,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    })();
    // tvOS n'a pas de notion d'orientation ; ScreenOrientation lèverait
    // une UnavailabilityError au runtime, donc on saute. ScreenOrientation peut être null sur tvOS (lazy require).
    if (!IS_TV && ScreenOrientation) ScreenOrientation.unlockAsync();
    const sub = Dimensions.addEventListener('change', ({ window }) => setDims(window));
    return () => {
      void deactivateKeepAwake().catch(() => {});
      // FIX audit iPad 2026-06-11 : ne re-locker en portrait que sur iPhone.
      // Sur iPad (4 orientations autorisées dans Info.plist), ce lock forçait
      // l'app en portrait après chaque vidéo fermée, même pour un utilisateur
      // en paysage. + .catch() : lockAsync peut rejeter en multitâche iPad.
      if (!IS_TV && !Platform.isPad && ScreenOrientation) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
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
      breadcrumb('Video error', { pilier: pilier?.key, seanceIndex, error: String(s.error) }, { category: 'video', level: 'error' });
      if (__DEV__) console.log('Video playback error:', { uri: uriRef.current, error: s.error });
      if (__DEV__) devWarn('Video playback error', s.error);
      setVideoLoadFailed(true);
      // Diagnostic round (à retirer une fois confirmé) : remonter l'erreur
      // expo-av à l'utilisateur. Useful pour distinguer "fichier local
      // corrompu" vs "URL Bunny inaccessible".
      const u = uriRef.current || '';
      const isLocal = u.indexOf('file://') === 0 || u.indexOf('/var/') === 0 || u.indexOf('Caches') !== -1;
      if (!alertedOnceRef.current) {
        alertedOnceRef.current = true;
        Alert.alert(
          isLocal ? 'Lecture locale échouée' : 'Lecture distante échouée',
          (isLocal ? 'Fichier hors-ligne illisible.' : 'Connexion ou URL Bunny indisponible.')
          + '\n\nURI : ' + (u ? u.slice(0, 120) : '(vide)')
          + '\nErreur : ' + (s.error || 'inconnue')
        );
      }
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
      // Mémorise la durée réelle pour corriger le libellé des cards
      // (les durées de data.js sont saisies à la main et peuvent dériver).
      try { saveVideoDurationMin(pilier.key, seanceIndex, s.durationMillis); } catch (e) {}
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
    hapticLight();
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

  // ── Confirmation pré-séance (garde-fou juridique) ──
  // Avant la 1ère lecture de la session (cold start), on demande à
  // l'utilisateur de reconnaître qu'il s'arrête en cas de douleur. Native
  // Alert pour rester léger ; une seule fois par session process. Tant que
  // ce n'est pas confirmé, le compte à rebours d'intro et la lecture sont
  // retenus (cf. shouldPlay). « Annuler » referme le lecteur.
  useEffect(function() {
    if (preSeanceConfirmed) return;
    const isFrLang = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
    const psTr = isFrLang ? T.fr : T.en;
    Alert.alert(
      psTr.preseance_title,
      psTr.preseance_body,
      [
        { text: psTr.preseance_cancel, style: 'cancel', onPress: function() { if (onClose) onClose(); } },
        { text: psTr.preseance_ok, style: 'default', onPress: function() {
            _preSeanceConfirmedThisSession = true;
            setPreSeanceConfirmed(true);
          } },
      ],
      { cancelable: false }
    );
  }, []);

  // ── Compte à rebours d'intro (façon FitOn) ──
  // Petit « 3·2·1 » plein écran avant le début. Il retient aussi la lecture
  // vidéo (cf. shouldPlay={introN <= 0}) pour que la séance démarre pile à 0.
  // Sauté pour les contenus théoriques (Comprendre / Ressentir).
  var [introN, setIntroN] = useState(isTheory ? 0 : 3);
  useEffect(function() {
    if (!preSeanceConfirmed) return;
    if (introN <= 0) return;
    var t = setTimeout(function() { setIntroN(function(n) { return n - 1; }); }, 900);
    return function() { clearTimeout(t); };
  }, [introN, preSeanceConfirmed]);

  function getElapsedMinutes() { return Math.max(1, Math.round(elapsedSec / 60)); }

  // ── Évaluation d'effort post-séance (2026-07-25) ──
  // Affichée après « Terminé » (iPhone uniquement). 4 niveaux façon Apple
  // Fitness (échelle 1-10 sous-jacente) : le score part vers HealthKit
  // (WorkoutEffortScore, iOS 18+ — nourrit la charge d'entraînement) et vers
  // un log local AsyncStorage pour Statistics / le générateur de programmes.
  const [showEffort, setShowEffort] = useState(false);
  const effortWindowRef = useRef(null);

  async function logEffortLocally(score) {
    try {
      var raw = await AsyncStorage.getItem('fluid_efforts_v1');
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      list.push({
        d: new Date().toISOString(),
        s: pilier?.key != null && seanceIndex != null ? pilier.key + '_' + seanceIndex : null,
        e: score,
        m: effortWindowRef.current ? effortWindowRef.current.minutes : null,
      });
      if (list.length > 300) list = list.slice(list.length - 300);
      await AsyncStorage.setItem('fluid_efforts_v1', JSON.stringify(list));
    } catch (e) {}
  }

  function chooseEffort(score) {
    hapticLight();
    var w = effortWindowRef.current;
    // Fire-and-forget : ni l'échec HealthKit ni le log local ne doivent
    // retarder la fermeture du player.
    try { writeWorkoutEffortScore(score, w && w.start, w && w.end).catch(function () {}); } catch (e) {}
    logEffortLocally(score);
    breadcrumb('Effort rated', { score: score, pilier: pilier?.key, seanceIndex }, { category: 'video' });
    setShowEffort(false);
    onComplete();
  }

  function skipEffort() {
    setShowEffort(false);
    onComplete();
  }

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
    breadcrumb('Completed session', { pilier: pilier?.key, seanceIndex, minutes }, { category: 'video' });
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

  // Minuteur en DÉCOMPTE (retour Yvan 25/07) : on affiche le temps restant.
  // Source de vérité = position réelle de la vidéo quand elle est chargée
  // (suit les seeks / vitesses de lecture) ; sinon fallback sur la durée
  // annoncée de la séance moins le temps écoulé.
  var timerTotalSec = status.durationMillis
    ? Math.round(status.durationMillis / 1000)
    : (parseInt(duree) || 15) * 60;
  var timerPosSec = (status.durationMillis && status.positionMillis != null)
    ? Math.floor(status.positionMillis / 1000)
    : elapsedSec;
  var timerRemainSec = Math.max(0, timerTotalSec - timerPosSec);
  var timerMin = Math.floor(timerRemainSec / 60);
  var timerSec = timerRemainSec % 60;
  var timerStr = String(timerMin).padStart(2, '0') + ':' + String(timerSec).padStart(2, '0');

  return (
    <View
      // FIX 25/07 : plus de width/height figés — au lancement (rotation
      // portrait→paysage), Dimensions pouvait livrer les dims portrait
      // avec un écran déjà paysage → bande noire à gauche + zone blanche
      // à droite. absoluteFill suit toujours l'écran ; onLayout resynchronise
      // dims (utilisé par la méduse placeholder et le fallback barW).
      onLayout={(e) => {
        const l = e.nativeEvent.layout;
        if (l && l.width && (Math.abs(l.width - dims.width) > 1 || Math.abs(l.height - dims.height) > 1)) {
          setDims({ width: l.width, height: l.height });
        }
      }}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: '#000' }}
    >
      {hasRealVideo && !uri && !videoLoadFailed ? (
        <Skeleton style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} radius={0} />
      ) : null}
      {hasRealVideo && uri ? (
        <Video
          key={videoResetKey}
          ref={videoRef}
          source={{ uri }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          resizeMode={videoFill ? ResizeMode.COVER : ResizeMode.CONTAIN}
          shouldPlay={introN <= 0 && preSeanceConfirmed}
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
            right: 0,
            bottom: 0,
            backgroundColor: '#000',
          }}
        />
      ) : (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
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

      {/* Compte à rebours d'intro façon FitOn — retient la vidéo jusqu'à 0 */}
      {introN > 0 ? (
        <View pointerEvents="auto" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 320, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,8,16,0.85)' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 12 }}>{tr.video_get_ready || 'Prépare-toi'}</Text>
          <Text style={{ fontSize: 112, fontWeight: '800', color: '#AEEF4D', fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 18 }}>{introN}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 10 }}>Respire… on commence.</Text>
        </View>
      ) : null}

      {/* ── HUD séance v3 « façon Apple Watch Entraînement » (25/07, demande
          Yvan) ── bloc empilé top-left : décompte + mini anneau lime, BPM +
          cœur battant, kcal + label rouge. Anneaux d'activité top-right
          (3e anneau bleu = progression réelle de la séance). La ligne BPM est
          toujours montée quand la préf HR est active : « -- » grisé sans
          signal (sinon l'utilisateur croit la fonction disparue). */}
      {!videoLoadFailed && !isTheory && !showControls && (
        <>
        <View pointerEvents="none" style={{ position: 'absolute', top: 50, left: 16, zIndex: 210 }}>
          {/* Cadre Liquid Glass (25/07) : mêmes tokens que les contrôles du
              player (GlassView intensity 70 dark + highlight/bevel/elevated).
              Un seul blur monté pendant la lecture — OK perf (cf. règle
              « pas de multiples BlurView », ici hors ScrollView). */}
          <GlassView
            intensity={70}
            tint="dark"
            forceDark
            borderRadius={18}
            highlight
            bevel
            elevated
            contentStyle={{ paddingHorizontal: 14, paddingVertical: 10, minWidth: 122 }}
          >
            {/* Ligne 1 : décompte + mini anneau de progression */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 27, fontWeight: '700', color: '#ffffff', fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}>{timerStr}</Text>
              <Svg width={17} height={17} viewBox="0 0 20 20">
                <Circle cx="10" cy="10" r="8" stroke="rgba(174,239,77,0.25)" strokeWidth={3} fill="none" />
                <Circle
                  cx="10" cy="10" r="8"
                  stroke="#AEEF4D" strokeWidth={3} fill="none" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 8}
                  strokeDashoffset={2 * Math.PI * 8 * (1 - (status.durationMillis ? progress : Math.min(elapsedSec / ((parseInt(duree) || 15) * 60), 1)))}
                  transform="rotate(-90 10 10)"
                />
              </Svg>
            </View>
            {/* Ligne 2 : BPM + cœur battant */}
            {hrEnabled && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 27, fontWeight: '700', color: hr.bpm != null ? '#ffffff' : 'rgba(255,255,255,0.45)', fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}>{hr.bpm != null ? String(hr.bpm) : '--'}</Text>
                <PulsingHeart bpm={hr.bpm} isLive={hr.isLive} size={19} />
              </View>
            )}
            {/* Ligne 3 : kcal */}
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff', fontVariant: ['tabular-nums'], letterSpacing: -0.5, marginTop: 2 }}>
              {Math.round(elapsedSec / 60 * 5)}
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#FF3B30' }}>KCAL</Text>
            </Text>
          </GlassView>
        </View>
        {/* Anneaux d'activité top-right (façon Watch), dans le même cadre
            Liquid Glass que le bloc stats. */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 50, right: 16, zIndex: 210 }}>
          <GlassView
            intensity={70}
            tint="dark"
            forceDark
            borderRadius={18}
            highlight
            bevel
            elevated
            contentStyle={{ padding: 9, alignItems: 'center', justifyContent: 'center' }}
          >
            <Svg width={56} height={56} viewBox="0 0 44 44">
              <Circle cx="22" cy="22" r="19" stroke="rgba(255,59,48,0.3)" strokeWidth={3.5} fill="none" />
              <Circle cx="22" cy="22" r="19" stroke="#FF3B30" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 19} strokeDashoffset={2 * Math.PI * 19 * (1 - Math.min(elapsedSec / 60 * 5 / 400, 1))} transform="rotate(-90 22 22)" />
              <Circle cx="22" cy="22" r="13.5" stroke="rgba(48,209,88,0.3)" strokeWidth={3.5} fill="none" />
              <Circle cx="22" cy="22" r="13.5" stroke="#30D158" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 13.5} strokeDashoffset={2 * Math.PI * 13.5 * (1 - Math.min(elapsedSec / 60 / 30, 1))} transform="rotate(-90 22 22)" />
              <Circle cx="22" cy="22" r="8" stroke="rgba(10,132,255,0.3)" strokeWidth={3.5} fill="none" />
              <Circle cx="22" cy="22" r="8" stroke="#0A84FF" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 8} strokeDashoffset={2 * Math.PI * 8 * (1 - (status.durationMillis ? progress : Math.min(elapsedSec / ((parseInt(duree) || 15) * 60), 1)))} transform="rotate(-90 22 22)" />
            </Svg>
          </GlassView>
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
                  {active ? <Icon name="check" size={14} color="#AEEF4D" strokeWidth={2.2} /> : null}
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
            {...tvFocusProps(true)}
            style={{ paddingVertical: 14, paddingHorizontal: 28, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,235,255,0.55)', backgroundColor: 'rgba(0,100,140,0.35)' }}
            accessibilityRole="button"
            accessibilityLabel={tr.video_retry}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: 'rgba(230,250,255,0.95)', letterSpacing: 0.5 }}>{tr.video_retry}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!videoLoadFailed && !showControls && (
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => handleScreenTap(revealControls)} android_ripple={null} />
      )}

      {!videoLoadFailed && showControls && (
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, { opacity: controlsOpacity }]}>
          <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={() => handleScreenTap(hideControls)} android_ripple={null} />
          <View pointerEvents="box-none" style={StyleSheet.absoluteFillObject}>
            {/* Top-left : X + PiP/fullscreen — capsule Liquid Glass */}
            <View pointerEvents="box-none" style={{ position: 'absolute', top: 50, left: 16 }}>
              <LiquidGlassCapsule tint="light" paddingH={10} paddingV={6} gap={12}>
                <TouchableOpacity onPress={() => { void handleCloseVideo(); }} hitSlop={10} {...tvFocusProps(true)} style={{ width: IS_TV ? 56 : 28, height: IS_TV ? 56 : 28, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="close" size={IS_TV ? 28 : 18} color="#FFFFFF" strokeWidth={2} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: IS_TV ? 48 : 28 }}>
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
                  {...tvFocusProps(true)}
                  accessibilityLabel={status.isPlaying ? 'Pause' : 'Lecture'}
                  accessibilityRole="button"
                >
                  <Animated.View style={{ transform: [{ scale: playScale }] }}>
                    <GlassView
                      intensity={IS_TV ? 70 : 55}
                      tint="dark"

                      forceDark
                      borderRadius={IS_TV ? 60 : 36}
                      contentStyle={{
                        width: IS_TV ? 120 : 72,
                        height: IS_TV ? 120 : 72,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <VideoPlayPauseIcon playing={!!status.isPlaying} size={IS_TV ? 54 : 32} />
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
                  intensity={IS_TV ? 65 : 50}
                  tint="dark"

                  forceDark
                  borderRadius={GLASS_RADII.button}
                  style={{ marginBottom: IS_TV ? 28 : 16 }}
                  contentStyle={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: IS_TV ? 18 : 10,
                    paddingHorizontal: IS_TV ? 24 : 12,
                    paddingVertical: IS_TV ? 14 : 6,
                  }}
                >
                  <Text style={{ fontSize: IS_TV ? 18 : 11, fontWeight: '500', color: '#ffffff', minWidth: IS_TV ? 70 : 44, fontVariant: ['tabular-nums'], letterSpacing: IS_TV ? 0.5 : 0 }}>{formatTimeCode(scrubRatio != null && status.durationMillis ? scrubRatio * status.durationMillis : status.positionMillis)}</Text>
                  {/* Barre scrubbable : tap OU glisser (PanResponder). La
                      largeur réelle vient d'onLayout (l'ancien code divisait
                      par dims.width-40 alors que la barre est plus étroite →
                      taps imprécis). Pendant le drag, l'UI suit scrubRatio ;
                      le seek est commité au relâchement. */}
                  <View
                    {...seekPan.panHandlers}
                    accessibilityLabel="Barre de progression de la vidéo"
                    accessibilityRole="adjustable"
                    onLayout={(e) => { seekBarWRef.current = e.nativeEvent.layout.width; }}
                    style={{ flex: 1, height: IS_TV ? 32 : 28, justifyContent: 'center' }}
                  >
                    <View style={{ height: IS_TV ? 6 : 3, borderRadius: IS_TV ? 3 : 1.5, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                      <View style={{ width: (((scrubRatio != null ? scrubRatio : progress)) * 100) + '%', height: '100%', backgroundColor: '#ffffff' }} />
                    </View>
                    {/* Poignée — affordance visuelle du drag (grossit pendant le scrub) */}
                    {!IS_TV && (
                      <View pointerEvents="none" style={{ position: 'absolute', left: ((scrubRatio != null ? scrubRatio : progress) * 100) + '%', top: '50%', width: scrubRatio != null ? 16 : 11, height: scrubRatio != null ? 16 : 11, marginLeft: scrubRatio != null ? -8 : -5.5, marginTop: scrubRatio != null ? -8 : -5.5, borderRadius: 8, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }} />
                    )}
                  </View>
                  <Text style={{ fontSize: IS_TV ? 18 : 11, fontWeight: '500', color: '#ffffff', minWidth: IS_TV ? 70 : 44, textAlign: 'right', fontVariant: ['tabular-nums'], letterSpacing: IS_TV ? 0.5 : 0 }}>{formatRemaining(scrubRatio != null && status.durationMillis ? scrubRatio * status.durationMillis : status.positionMillis, status.durationMillis)}</Text>
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
                      // Évaluation d'effort post-séance (2026-07-25) : sur
                      // iPhone on intercale l'écran « Comment c'était ? »
                      // avant onComplete — le score nourrit la charge
                      // d'entraînement Apple (iOS 18+) + nos stats locales.
                      if (!IS_TV) {
                        var effEnd = new Date();
                        effortWindowRef.current = {
                          start: new Date(effEnd.getTime() - getElapsedMinutes() * 60000),
                          end: effEnd,
                          minutes: getElapsedMinutes(),
                        };
                        setShowEffort(true);
                      } else {
                        onComplete();
                      }
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

      {/* Overlay « Comment c'était ? » — évaluation d'effort post-séance.
          Scrim opaque au-dessus de tout (la vidéo est terminée) ; le blur du
          GlassView est OK ici (équivalent modal, pas de scroll). */}
      {showEffort && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: 'rgba(0,8,20,0.94)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <GlassView intensity={70} borderRadius={22} elevated contentStyle={{ width: '100%', maxWidth: 360, paddingHorizontal: 22, paddingVertical: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', textAlign: 'center', letterSpacing: -0.3 }}>
              {tr.effort_title || 'Comment c\'était ?'}
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 19, marginTop: 8, marginBottom: 18 }}>
              {tr.effort_sub || 'Évalue ton effort — il compte dans ta charge d\'entraînement Apple Santé.'}
            </Text>
            {[
              { score: 2, color: '#64D2FF', label: tr.effort_l1 || 'Tout en douceur' },
              { score: 5, color: '#30D158', label: tr.effort_l2 || 'Modéré' },
              { score: 7, color: '#FF9F0A', label: tr.effort_l3 || 'Soutenu' },
              { score: 9, color: '#FF453A', label: tr.effort_l4 || 'Intense' },
            ].map(function (lvl) {
              return (
                <TouchableOpacity
                  key={lvl.score}
                  onPress={function () { chooseEffort(lvl.score); }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={lvl.label}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 13,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    marginBottom: 8,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.14)',
                  }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: lvl.color }} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#ffffff', flex: 1 }}>{lvl.label}</Text>
                  {/* Jauge 1-10 discrète — repère l'échelle Apple sans la crier */}
                  <View style={{ flexDirection: 'row', gap: 3 }}>
                    {[0, 1, 2, 3].map(function (i) {
                      var lit = i < Math.ceil(lvl.score / 2.5);
                      return <View key={i} style={{ width: 4, height: 12 + i * 2, borderRadius: 2, alignSelf: 'flex-end', backgroundColor: lit ? lvl.color : 'rgba(255,255,255,0.18)' }} />;
                    })}
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={skipEffort} activeOpacity={0.7} style={{ paddingVertical: 12, alignItems: 'center' }} accessibilityRole="button">
              <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3 }}>{tr.effort_skip || 'Passer'}</Text>
            </TouchableOpacity>
          </GlassView>
        </View>
      )}
    </View>
  );
}
