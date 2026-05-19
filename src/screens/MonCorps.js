import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Text, StyleSheet, Animated, Easing, View, TouchableOpacity, ScrollView, Dimensions, Modal, Platform, TextInput, Share } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { U_JELLY, U_WAVE, ZONE_TO_PILIER, T, PILIER_IMAGES, FREE_MONTHLY_SELECTION } from '../constants/data';
import SeanceShareCard from '../components/SeanceShareCard';
import BreathingCheckIn, { isBreathDoneToday } from '../components/BreathingCheckIn';
import { Bulle, Rayon, MeduseCornerIcon, FloatingMedusas, BULLES, BULLES_MONCORPS } from '../components/Meduse';
import AnimatedPlus from '../components/AnimatedPlus';
import GlassButton from '../components/GlassButton';
import { GlassCard, GLASS_RADII } from '../components/ui';
import { useTheme } from '../theme/ThemeProvider';
import LivingBackground from '../components/LivingBackground';
import LiquidGlassCapsule from '../components/LiquidGlassCapsule';
import VideoPlayer from '../components/VideoPlayer';
import PilierEducation from './PilierEducation';
import { prefetchSignedVideoUrl, buildSessionId } from '../utils/videoUrl';
import { getPiliers, getSeances, getSeanceDuJour, canAccessSeanceIndex, getResumeIndicesForPilier, hapticLight, hapticSuccess, isComingSoon } from '../utils';
import { safeNativeCall, safeNativeFire, diag } from '../utils/safeNativeCall';

let Notifications = null;
try { Notifications = require('expo-notifications'); } catch(e) {}

// Sentry safe-require (no-op si DSN absent).
let Sentry = null;
try { Sentry = require('@sentry/react-native'); } catch(e) {}
function sentryCaptureSafe(error, ctx) {
  if (!Sentry) return;
  try {
    if (ctx) Sentry.withScope(function(scope) {
      Object.keys(ctx).forEach(function(k) { scope.setExtra(k, ctx[k]); });
      Sentry.captureException(error instanceof Error ? error : new Error(String(error && error.message || error)));
    });
    else Sentry.captureException(error instanceof Error ? error : new Error(String(error && error.message || error)));
  } catch (e) {}
}

// expo-notifications 0.32 + iOS 26.5: l'ancien format de trigger
// `{ weekday, hour, minute, repeats: true }` lève une NSException côté natif
// que le convertisseur RN n'arrive pas à transformer en JSError sur iOS 26.5
// (crash dans dladdr lisant callStackReturnAddresses). On migre vers
// SchedulableTriggerInputTypes, qui est le seul format stable.
// Fallback string si la constante manque (safe).
function trigWeekly(weekday, hour, minute) {
  var TYPES = Notifications && Notifications.SchedulableTriggerInputTypes;
  return { type: (TYPES && TYPES.WEEKLY) || 'weekly', weekday: weekday, hour: hour, minute: minute };
}

const PROG_IMAGES = {
  reveil: require('../../assets/programs/reveil-matinal.jpg'),
  dos: require('../../assets/programs/mal-de-dos.jpg'),
  posttravail: require('../../assets/programs/post-travail.jpg'),
  core: require('../../assets/programs/core-plancher.jpg'),
  souplesse: require('../../assets/programs/souplesse.jpg'),
};

const { width: SW, height: SH } = Dimensions.get('window');
const IS_IPAD = SW >= 768;

const U_STAR = '\u2B50';
const U_DROP = '\uD83D\uDCA7';

const ETAPE_COLORS = {
  'Comprendre': 'rgba(0,220,170,0.9)',
  'Ressentir': 'rgba(100,190,255,0.9)',
  'Préparer': 'rgba(255,200,80,0.9)',
  'Exécuter': 'rgba(255,145,100,0.9)',
  'Évoluer': 'rgba(185,135,255,0.9)',
};

var JOUR_LABELS = { fr: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], de: ['Mo','Di','Mi','Do','Fr','Sa','So'], pt: ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'], zh: ['一','二','三','四','五','六','日'], ja: ['月','火','水','木','金','土','日'], ko: ['월','화','수','목','금','토','일'], es: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'], it: ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'] };

var LIVE_SCHEDULE = [
  { id: 1, title: 'Mat Pilates', coach: 'Sabrina', day: 1, time: '18:00', duration: '45 min' },
  { id: 2, title: 'Stretching Dos', coach: 'Sabrina', day: 3, time: '12:00', duration: '30 min' },
  { id: 3, title: 'Core & Plancher', coach: 'Sabrina', day: 5, time: '18:00', duration: '45 min' },
];
var DAY_FULL_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
var DAY_FULL_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Parse "15 min" / "1'59''" / "2'29''" \u2192 integer minutes (rounded up to 1).
function parseDurationMinutes(label) {
  if (!label || typeof label !== 'string') return 5;
  // Format "Nm" or "N min"
  const mMin = label.match(/(\d+)\s*min/i);
  if (mMin) return Math.max(1, parseInt(mMin[1], 10));
  // Format "M'SS''" \u2014 e.g. "1'59''"
  const mApos = label.match(/(\d+)\s*['\u2019]\s*(\d+)/);
  if (mApos) {
    const m = parseInt(mApos[1], 10);
    const s = parseInt(mApos[2], 10);
    return Math.max(1, Math.round(m + s / 60));
  }
  // Bare integer
  const mInt = label.match(/(\d+)/);
  if (mInt) return Math.max(1, parseInt(mInt[1], 10));
  return 5;
}

function formatShareDate(lang) {
  try {
    const d = new Date();
    const locale = (lang || 'fr').toLowerCase().indexOf('fr') === 0 ? 'fr-FR' : 'en-GB';
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  } catch (e) {
    const d = new Date();
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }
}

function CelebrationOverlay({ visible, onDone, pilier, lang, seance }) {
  const tr = T[lang] || T['fr'];
  const scaleAnim  = useRef(new Animated.Value(0)).current;
  const opacAnim   = useRef(new Animated.Value(0)).current;
  const medalAnim  = useRef(new Animated.Value(0)).current;
  const shareUiAnim = useRef(new Animated.Value(0)).current;
  const autoDismissRef = useRef(null);
  const shareRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const EMOJIS = ['\uD83C\uDF89', '\u2B50', '\u2728', '\uD83E\uDEBC', '\uD83D\uDCAA', '\uD83C\uDFC6', U_WAVE, U_DROP, '\uD83D\uDCAB', '\uD83C\uDF38'];
  const particles  = useRef(Array.from({ length: 35 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const radius = 120 + Math.random() * 200;
    return {
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      o: new Animated.Value(1),
      s: new Animated.Value(0),
      rot: new Animated.Value(0),
      dx: Math.cos(angle) * radius,
      dy: Math.sin(angle) * radius,
      fontSize: 12 + Math.random() * 12,
      rotTarget: (Math.random() - 0.5) * 720,
    };
  })).current;

  // Share-card payload \u2014 derived once from the s\u00E9ance tuple. Kcal is a coarse
  // Pilates proxy (5 kcal/min). When the parallel HK migration lands and
  // VideoPlayer starts passing the real avg/max BPM here, the share card will
  // automatically pick those up via the optional props.
  const shareData = useMemo(() => {
    const durationLabel = Array.isArray(seance) && typeof seance[1] === 'string' ? seance[1] : '5 min';
    const seanceLabel = Array.isArray(seance) ? seance[0] : (pilier?.label || '');
    const minutes = parseDurationMinutes(durationLabel);
    return {
      seanceLabel: seanceLabel,
      durationMin: minutes,
      kcal: Math.round(minutes * 5),
      dateLabel: formatShareDate(lang),
    };
  }, [seance, pilier, lang]);

  function clearAutoDismiss() {
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
  }

  useEffect(() => {
    if (!visible) return;
    hapticSuccess();
    Animated.parallel([
      Animated.timing(opacAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(medalAnim, { toValue: 1,  duration: 400, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.timing(medalAnim, { toValue: 0.9,duration: 200, easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
      Animated.timing(medalAnim, { toValue: 1,  duration: 200, easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
    ]).start();
    // Share row appears once the particles settle (\u2248 1.4s in) so the moment
    // reads as celebration first, action second.
    Animated.sequence([
      Animated.delay(1400),
      Animated.timing(shareUiAnim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    particles.forEach((p, i) => {
      p.x.setValue(0); p.y.setValue(0); p.o.setValue(1); p.s.setValue(0); p.rot.setValue(0);
      setTimeout(() => {
        p.s.setValue(0.4 + Math.random() * 0.6);
        const dur = 900 + Math.random() * 500;
        Animated.parallel([
          Animated.timing(p.x,   { toValue: p.dx, duration: dur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(p.y,   { toValue: p.dy, duration: dur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(p.rot, { toValue: p.rotTarget, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(p.o,   { toValue: 0,    duration: dur + 200, useNativeDriver: true }),
        ]).start();
      }, i * 30);
    });
    // Auto-dismiss after 6s \u2014 long enough to read + decide to share, but not
    // so long the user gets stuck on the celebration screen.
    autoDismissRef.current = setTimeout(onDone, 6000);
    return clearAutoDismiss;
  }, [visible]);

  async function handleShare() {
    if (sharing) return;
    clearAutoDismiss();
    setSharing(true);
    try {
      if (!shareRef.current || typeof shareRef.current.capture !== 'function') {
        // Fallback: text-only share.
        await Share.share({ message: (tr.share_card_message || 'S\u00E9ance termin\u00E9e avec FLUIDBODY+ \uD83E\uDEBC') + '\nhttps://apps.apple.com/app/fluidbody/id6761364962' });
        return;
      }
      const uri = await shareRef.current.capture();
      try {
        await Share.share({
          url: uri,
          message: (tr.share_card_message || 'S\u00E9ance termin\u00E9e avec FLUIDBODY+ \uD83E\uDEBC'),
        });
      } catch (shareErr) {
        // Android sometimes doesn't accept `url` \u2014 retry with message only.
        await Share.share({ message: tr.share_card_message || 'S\u00E9ance termin\u00E9e avec FLUIDBODY+ \uD83E\uDEBC' });
      }
    } catch (e) {
      sentryCaptureSafe(e, { where: 'CelebrationOverlay.handleShare' });
    } finally {
      setSharing(false);
    }
  }

  if (!visible) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,5,15,0.82)', opacity: opacAnim }} />
      {particles.map((p, i) => (
        <Animated.Text key={i} style={{
          position: 'absolute',
          fontSize: p.fontSize,
          transform: [
            { translateX: p.x },
            { translateY: p.y },
            { scale: p.s },
            { rotate: p.rot.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) },
          ],
          opacity: p.o,
        }}>
          {EMOJIS[i % EMOJIS.length]}
        </Animated.Text>
      ))}
      <Animated.View style={{
        transform: [{ scale: scaleAnim }],
        opacity: opacAnim,
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderRadius: 32,
        padding: 36,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.48)',
        alignItems: 'center',
        width: 320,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 12 },
        elevation: 16,
      }}>
        <Animated.View style={{ transform: [{ scale: medalAnim }], marginBottom: 16 }}>
          <Text style={{ fontSize: 64 }}>{U_JELLY}</Text>
        </Animated.View>
        <Text style={{ fontSize: 11, color: pilier?.color || 'rgba(0,215,255,0.95)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>{tr.seance_done}</Text>
        <Text style={{ fontSize: 22, fontWeight: '200', color: 'rgba(255,255,255,0.96)', textAlign: 'center', lineHeight: 32 }}>{pilier?.label}</Text>
        <View style={{ width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.28)', marginVertical: 16 }} />
        <Text style={{ fontSize: 14, color: 'rgba(230,248,255,0.78)', textAlign: 'center', lineHeight: 22 }}>{tr.celebration.split('\n')[0]}{'\n'}{tr.celebration.split('\n')[1]}</Text>
        <Animated.View style={{
          opacity: shareUiAnim,
          transform: [{ translateY: shareUiAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          alignSelf: 'stretch',
          flexDirection: 'row',
          gap: 10,
          marginTop: 22,
        }}>
          <TouchableOpacity
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.85}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#AEEF4D',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 6,
              opacity: sharing ? 0.55 : 1,
            }}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M12 2l3 3h-2v8h-2V5H9l3-3z" fill="#000" /><Path d="M4 14v6h16v-6" stroke="#000" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#000000' }}>{sharing ? '\u2026' : (tr.share_card_share_btn || 'Partager')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={function() { clearAutoDismiss(); onDone(); }}
            activeOpacity={0.85}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.86)' }}>{tr.share_card_continue || 'Continuer'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
      <SeanceShareCard
        ref={shareRef}
        pilier={pilier}
        seanceLabel={shareData.seanceLabel}
        durationMin={shareData.durationMin}
        kcal={shareData.kcal}
        dateLabel={shareData.dateLabel}
        lang={lang}
      />
    </View>
  );
}

function PilierPanel({ pilier, done, onToggle, onClose, lang, isRecommended, isSubscriber, onActivateSubscription, sdjIndex, saveHealthKitWorkout, initialSeanceIdx }) {
  const tr = T[lang] || T['fr'];
  const seances = getSeances(lang)[pilier.key] || [];
  const doneCount = (done || []).filter(Boolean).length;
  const [activeVideo, setActiveVideo] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  // Remember the seance that just finished so the share card has its data
  // even after `activeVideo` resets to null.
  const [celebratedSeance, setCelebratedSeance] = useState(null);
  const [showDemoLimit, setShowDemoLimit] = useState(false);
  const [resumeIndices, setResumeIndices] = useState(() => new Set());

  var ppMedusas = useRef([
    { baseX: SW - 80, baseY: 40, size: 70, dx: new Animated.Value(0), dy: new Animated.Value(0) },
    { baseX: 20, baseY: SH * 0.06, size: 54, dx: new Animated.Value(0), dy: new Animated.Value(0) },
    { baseX: SW * 0.4, baseY: SH * 0.1, size: 42, dx: new Animated.Value(0), dy: new Animated.Value(0) },
  ]).current;

  useEffect(function() {
    let mounted = true;
    const timeouts = [];
    const currentDrifts = [];
    ppMedusas.forEach(function(m, idx) {
      function drift() {
        if (!mounted) return;
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 40 + Math.random() * (SH - m.size - 140);
        var dur = 10000 + Math.random() * 6000;
        var p = Animated.parallel([
          Animated.timing(m.dx, { toValue: toX - m.baseX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
          Animated.timing(m.dy, { toValue: toY - m.baseY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
        ]);
        currentDrifts[idx] = p;
        p.start(function() { if (mounted) drift(); });
      }
      timeouts.push(setTimeout(function() { drift(); }, Math.random() * 2000));
    });
    return function() {
      mounted = false;
      timeouts.forEach(function(t) { clearTimeout(t); });
      currentDrifts.forEach(function(d) { try { d && d.stop && d.stop(); } catch (e) {} });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await getResumeIndicesForPilier(pilier.key);
      if (!cancelled) setResumeIndices(next);
    })();
    return () => { cancelled = true; };
  }, [pilier.key, activeVideo]);

  useEffect(function() {
    if (initialSeanceIdx != null && activeVideo == null) {
      if (canAccessSeanceIndex(initialSeanceIdx, isSubscriber, pilier.key)) {
        setActiveVideo(initialSeanceIdx);
      }
    }
  }, []);

  function tryOpenSeance(i) {
    if (!canAccessSeanceIndex(i, isSubscriber, pilier.key)) {
      onActivateSubscription?.();
      return;
    }
    hapticLight();
    // Prefetch signed MP4 URL in parallel with the modal open animation —
    // by the time VideoPlayer mounts, the signed URL is already in cache.
    const sessionId = buildSessionId(pilier.key, i);
    if (sessionId) prefetchSignedVideoUrl(sessionId, 'mp4');
    setActiveVideo(i);
  }

  if (activeVideo !== null) {
    return (
      <Modal
        visible
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setActiveVideo(null)}
      >
        <VideoPlayer
          key={`${pilier.key}-${activeVideo}`}
          seance={seances[activeVideo]}
          pilier={pilier}
          lang={lang}
          seanceIndex={activeVideo}
          isDemo={activeVideo === sdjIndex && !isSubscriber}
          onClose={() => { setShowDemoLimit(false); setActiveVideo(null); }}
          onComplete={() => { setCelebratedSeance(seances[activeVideo]); onToggle(activeVideo); setActiveVideo(null); setShowCelebration(true); }}
          onDemoLimit={() => setShowDemoLimit(true)}
          saveHealthKitWorkout={saveHealthKitWorkout}
        />
        {showDemoLimit && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50, overflow: 'hidden', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)' }}>
            <BlurView intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={{ paddingVertical: 24, paddingHorizontal: 28, alignItems: 'center', backgroundColor: 'rgba(10,20,35,0.6)' }}>
              <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']} locations={[0, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%' }} pointerEvents="none" />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', textAlign: 'center', marginBottom: 12 }}>{tr.demo_limit}</Text>
              <GlassButton
                onPress={() => { setShowDemoLimit(false); setActiveVideo(null); if (onActivateSubscription) onActivateSubscription(); }}
                fullWidth={false}
                textColor="#AEEF4D"
                style={{ paddingHorizontal: 32 }}
              >
                {tr.paywall_start}
              </GlassButton>
            </BlurView>
          </View>
        )}
      </Modal>
    );
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.18} />
      <Rayon left={280} width={40} delay={4000} duration={8000} opacity={0.12} />
      {BULLES.map((b, i) => <Bulle key={i} {...b} />)}{IS_IPAD && BULLES.map((b, i) => <Bulle key={'r'+i} delay={b.delay + 2000} x={b.x + SW * 0.35} size={b.size} duration={b.duration} />)}{IS_IPAD && BULLES.map((b, i) => <Bulle key={'r2'+i} delay={b.delay + 5000} x={b.x + SW * 0.65} size={b.size} duration={b.duration} />)}
      {ppMedusas.map(function(m, i) {
        return (
          <Animated.View key={'ppm-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 2, opacity: 0.9, left: m.baseX, top: m.baseY, transform: [{ translateX: m.dx }, { translateY: m.dy }] }}>
            <MeduseCornerIcon size={m.size} breathCycleMs={3000 + i * 600} breathMaxScale={1.35} tint="rgba(174,239,77,1)" />
          </Animated.View>
        );
      })}
      <View style={{ paddingTop: 54, paddingHorizontal: 22, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 10 }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: 28 }}>+</AnimatedPlus></Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#AEEF4D' }}>{tr.retour}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: IS_IPAD ? 38 : 34, fontWeight: '200', color: '#ffffff', letterSpacing: -0.3 }}>{pilier.label}</Text>
          {isRecommended && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(0,215,255,0.2)', borderWidth: 1, borderColor: 'rgba(0,215,255,0.7)' }}>
              <Text style={{ fontSize: 9, color: 'rgba(0,220,255,0.9)', letterSpacing: 1 }}>{'\u2605'} {tr.recommande_pour_toi}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 10, color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.seances_available || '5 S\u00C9ANCES \u00B7 PLUS \u00C0 VENIR'}</Text>
        <View style={{ height: 3, backgroundColor: 'rgba(0,200,240,0.1)', borderRadius: 2, marginTop: 10, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ height: 3, flex: doneCount / 5, backgroundColor: pilier.color, borderRadius: 2 }} />
        </View>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        {seances.map(([titre, duree, etape, url], i) => {
          if (etape === 'Comprendre' || etape === 'Ressentir') return null;
          const isDone = done[i] === true || done[i] === 'true';
          const noVideo = !url;
          const locked = !noVideo && !canAccessSeanceIndex(i, isSubscriber, pilier.key);
          let prevPracticalEtape = null;
          for (let k = i - 1; k >= 0; k--) {
            const e = seances[k][2];
            if (e !== 'Comprendre' && e !== 'Ressentir') { prevPracticalEtape = e; break; }
          }
          let sectionTitle = null;
          if (etape !== prevPracticalEtape) sectionTitle = tr.etapes[etape] || etape;
          const isFirstVisible = prevPracticalEtape === null;
          const header = sectionTitle ? (
            <View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#AEEF4D', letterSpacing: 2.5, textTransform: 'uppercase', marginTop: isFirstVisible ? 10 : 22, marginBottom: 18, paddingHorizontal: 4 }}>{sectionTitle}</Text>
            </View>
          ) : null;
          return (
            <Fragment key={i}>
              {header}
            <TouchableOpacity onPress={() => tryOpenSeance(i)} disabled={noVideo} activeOpacity={0.88} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12, height: 110, opacity: noVideo ? 0.45 : (locked ? 0.4 : 1) }}>
              <View style={{ flex: 1 }}>
                <Image source={PILIER_IMAGES[pilier.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-pil-bg-' + pilier.key} style={StyleSheet.absoluteFill} />
                <LinearGradient colors={isDone ? ['rgba(0,30,22,0.75)', 'rgba(0,30,22,0.85)'] : locked ? ['rgba(0,14,24,0.75)', 'rgba(0,14,24,0.9)'] : ['rgba(0,14,24,0.55)', 'rgba(0,14,24,0.8)']} style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#ffffff', alignSelf: 'flex-end', marginBottom: 6 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, color: '#AEEF4D' }}>+</AnimatedPlus></Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Text style={{ fontSize: 18, color: isDone ? '#AEEF4D' : '#ffffff' }}>{isDone ? '\u2713' : '\u25B6'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 6 }} numberOfLines={1}>{titre}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,189,208,0.15)', color: '#00BDD0', letterSpacing: 0.5 }}>{tr.etapes[etape] || etape}</Text>
                        <Text style={{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', color: '#ffffff' }}>{duree}</Text>
                        {i === 0 && !isSubscriber ? (
                          <Text style={{ fontSize: 9, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,189,208,0.2)', color: '#00BDD0', fontWeight: '700', letterSpacing: 0.5 }}>{tr.gratuit_badge || 'GRATUIT'}</Text>
                        ) : null}
                        {resumeIndices.has(i) && !locked ? (
                          <Text style={{ fontSize: 9, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(174,239,77,0.15)', color: '#AEEF4D', fontWeight: '600' }}>{tr.reprise_badge}</Text>
                        ) : null}
                        {isComingSoon(pilier.key, i) ? (
                          <Text style={{ fontSize: 9, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(210,140,190,0.20)', color: '#E1A8C8', fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>{tr.coming_soon_badge || 'Bientôt'}</Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={{ fontSize: 13, color: '#AEEF4D', fontWeight: '300' }}>{String(i + 1).padStart(2, '0')}</Text>
                  </View>
                </LinearGradient>
              </View>
            </TouchableOpacity>
            </Fragment>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>
      <CelebrationOverlay visible={showCelebration} onDone={() => setShowCelebration(false)} pilier={pilier} lang={lang} seance={celebratedSeance} />
    </View>
  );
}

/** Tuiles SEANCES / STREAK / PROGRESSION — Liquid Glass over the aquatic background. */
function MetricTile({ children }) {
  return (
    <View style={{ flex: 1 }}>
      <GlassCard
        intensity={60}
        tint="dark"
        borderRadius={GLASS_RADII.card}
        padding={10}
        elevated
      >
        <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 64 }}>
          {children}
        </View>
      </GlassCard>
    </View>
  );
}

async function scheduleProgNotifications(prog, idx, lang) {
  if (!Notifications) return [];
  var status = await safeNativeCall('notif.requestPermissionsAsync.progSave', function() { return Notifications.requestPermissionsAsync(); }, null);
  if (!status || status.status !== 'granted') return [];
  var tr = T[lang] || T['fr'];
  var pilierNames = getPiliers(lang).filter(function(p) { return prog.piliers.includes(p.key); }).map(function(p) { return p.label; });
  var pilierStr = pilierNames.join(', ');
  var hour = prog.notifHour || 8;
  var ids = [];
  var selectedDays = prog.selectedDays || [1, 2, 3, 4, 5];
  for (var d = 0; d < selectedDays.length; d++) {
    var weekday = selectedDays[d] + 1;
    if (weekday > 7) weekday = 1;
    // Garde-fous : si les valeurs sont corrompues, on saute pour \u00E9viter
    // une NSException c\u00F4t\u00E9 natif (cf. crash build #43 sur iOS 26.5).
    if (typeof weekday !== 'number' || weekday < 1 || weekday > 7) continue;
    if (typeof hour !== 'number' || hour < 0 || hour > 23) continue;
    var id = await safeNativeCall('notif.schedule.prog', (function(wd_, hr_, body_) { return function() {
      return Notifications.scheduleNotificationAsync({
        content: { title: 'FluidBody+ \uD83D\uDCAA', body: body_, sound: true },
        trigger: trigWeekly(wd_, hr_, 0),
      });
    }; })(weekday, hour, (tr.prog_notif_body || "C'est l'heure de ta s\u00E9ance") + ' ' + pilierStr + ' \u00B7 ' + prog.duree), null);
    if (id != null) ids.push(id);
  }
  return ids;
}

async function cancelProgNotifications(notifIds) {
  if (!Notifications || !notifIds) return;
  for (var i = 0; i < notifIds.length; i++) {
    await safeNativeCall('notif.cancelScheduled.prog', (function(id_) { return function() {
      return Notifications.cancelScheduledNotificationAsync(id_);
    }; })(notifIds[i]), null);
  }
}

function CreateProgramScreen({ visible, onClose, lang, onSaved }) {
  if (!visible) return null;
  var tr = T[lang] || T["fr"];
  var piliers = getPiliers(lang);
  var [selected, setSelected] = useState([]);
  var [duree, setDuree] = useState(1);
  var [jours, setJours] = useState(3);
  var [saved, setSaved] = useState(false);
  var [notifHour, setNotifHour] = useState(8);
  var [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  var dureeOptions = ['10 min', '15 min', '20 min', '30 min', '45 min'];
  var joursOptions = [2, 3, 4, 5, 6, 7];
  var jourLabels = JOUR_LABELS[lang] || JOUR_LABELS.fr;

  function togglePilier(key) {
    setSelected(function(prev) { return prev.includes(key) ? prev.filter(function(k) { return k !== key; }) : [...prev, key]; });
  }

  function toggleDay(d) {
    setSelectedDays(function(prev) { return prev.includes(d) ? prev.filter(function(x) { return x !== d; }) : [].concat(prev, [d]).sort(); });
  }

  async function saveProg() {
    try {
      diag('saveProg', 'start');
      var prog = { piliers: selected, duree: dureeOptions[duree], jours: joursOptions[jours - 2 < 0 ? 0 : jours - 2], date: new Date().toISOString(), notifHour: notifHour, selectedDays: selectedDays };
      // Persist FIRST, so even if notification scheduling later throws and
      // somehow corrupts the bridge, the program is on disk.
      try {
        var raw = await AsyncStorage.getItem('fluid_custom_programs');
        var list = raw ? JSON.parse(raw) : [];
        list.push(prog);
        await AsyncStorage.setItem('fluid_custom_programs', JSON.stringify(list));
        diag('saveProg.persistAsyncStorage', 'done');
      } catch(e) { sentryCaptureSafe(e, { where: 'saveProg.persistAsyncStorage' }); }
      // Then schedule the rappels — defer them by 600ms so the modal can
      // start its slide-out before we hit the notification scheduler in a
      // tight loop. The notif IDs are persisted in a second pass after the
      // schedule completes.
      setSaved(true);
      diag('saveProg.scheduleProgNotifications.deferred', 'scheduled');
      setTimeout(function() {
        diag('saveProg.scheduleProgNotifications.deferred', 'fired');
        scheduleProgNotifications(prog, 0, lang)
          .then(function(ids) {
            diag('saveProg.scheduleProgNotifications', 'done');
            if (ids && ids.length) {
              prog.notifIds = ids;
              AsyncStorage.getItem('fluid_custom_programs').then(function(raw2) {
                try {
                  var list2 = raw2 ? JSON.parse(raw2) : [];
                  if (list2.length) {
                    list2[list2.length - 1].notifIds = ids;
                    AsyncStorage.setItem('fluid_custom_programs', JSON.stringify(list2));
                  }
                } catch (e) {}
              });
            }
          })
          .catch(function(e) { sentryCaptureSafe(e, { where: 'saveProg.scheduleProgNotifications' }); });
      }, 600);
      // Close the modal after the user reads the "saved" state. Extended
      // 1500 → 1800ms so the slide-out is not preempted by the deferred
      // notification scheduler.
      setTimeout(function() {
        diag('saveProg.close', 'fire');
        if (onSaved) onSaved();
        onClose();
        setSaved(false);
      }, 1800);
    } catch (e) {
      sentryCaptureSafe(e, { where: 'saveProg.outer' });
      if (__DEV__) console.warn('saveProg failed:', e);
      setSaved(false);
      try { onClose(); } catch(_) {}
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000e18" }}>
        <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
        <LivingBackground />
      <LivingBackground />
        <BlurView intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,20,35,0.6)' }} pointerEvents="none" />
        <ScrollView contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 24, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <TouchableOpacity onPress={onClose} style={{ paddingVertical: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#E5FF00', letterSpacing: 1.5, textTransform: 'uppercase' }}>{tr.retour}</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 24 }}>{tr.prog_create_title}</Text>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#E5FF00', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_select_piliers}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
            {piliers.map(function(p) {
              var active = selected.includes(p.key);
              return (
                <TouchableOpacity key={p.key} onPress={function() { togglePilier(p.key); }} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: active ? '#E5FF00' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(229,255,0,0.12)' : 'rgba(0,18,32,0.6)' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden' }}>
                    <Image source={PILIER_IMAGES[p.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-pil-' + p.key} style={{ flex: 1 }} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: active ? '#E5FF00' : 'rgba(255,255,255,0.6)' }}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#E5FF00', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_duree_label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 28 }} contentContainerStyle={{ gap: 10 }}>
            {dureeOptions.map(function(d, i) {
              var active = duree === i;
              return (
                <TouchableOpacity key={i} onPress={function() { setDuree(i); }} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: active ? '#E5FF00' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(229,255,0,0.12)' : 'rgba(0,18,32,0.6)' }}>
                  <Text style={{ fontSize: 14, color: active ? '#E5FF00' : 'rgba(255,255,255,0.6)' }}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#E5FF00', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_jours_label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 36 }} contentContainerStyle={{ gap: 10 }}>
            {joursOptions.map(function(j) {
              var active = jours === j;
              return (
                <TouchableOpacity key={j} onPress={function() { setJours(j); }} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: active ? '#E5FF00' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(229,255,0,0.12)' : 'rgba(0,18,32,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: active ? '#E5FF00' : 'rgba(255,255,255,0.6)' }}>{j}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#E5FF00', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_notif_days || 'Jours de rappel'}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 0].map(function(d, i) {
              var active = selectedDays.includes(d);
              return (
                <TouchableOpacity key={d} onPress={function() { toggleDay(d); }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: active ? '#E5FF00' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(229,255,0,0.12)' : 'rgba(0,18,32,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#E5FF00' : 'rgba(255,255,255,0.6)' }}>{jourLabels[i]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#E5FF00', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_notif_hour || 'Heure de rappel'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 36 }}>
            <TouchableOpacity onPress={function() { setNotifHour(Math.max(5, notifHour - 1)); }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>{'\u2212'}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff', minWidth: 80, textAlign: 'center' }}>{String(notifHour).padStart(2, '0') + ':00'}</Text>
            <TouchableOpacity onPress={function() { setNotifHour(Math.min(22, notifHour + 1)); }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={saveProg} disabled={selected.length === 0} activeOpacity={0.85} style={{ height: 56, borderRadius: 28, backgroundColor: selected.length > 0 ? '#E5FF00' : 'rgba(229,255,0,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#000000' }}>{saved ? tr.prog_saved : tr.prog_save}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const PILIER_LABEL_IDX = { p1: 0, p2: 1, p3: 2, p4: 3, p5: 4, p6: 5, p7: 6, p8: 7 };

function ZoneIcon({ idx, color, size }) {
  var s = size || 28;
  var c = color || '#AEEF4D';
  switch (idx) {
    case 0: // Dos / Nuque — colonne ondulée
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3 Q15 7 12 11 Q9 15 12 19 Q14 21 12 22" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx="12" cy="6" r="1" fill={c} />
          <Circle cx="12" cy="11" r="1" fill={c} />
          <Circle cx="12" cy="16" r="1" fill={c} />
        </Svg>
      );
    case 1: // Épaules
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M4 11 Q12 4 20 11" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx="5" cy="12" r="1.6" fill={c} />
          <Circle cx="19" cy="12" r="1.6" fill={c} />
          <Path d="M5 13 L5 19 M19 13 L19 19" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    case 2: // Hanches
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M5 6 L5 11 Q5 14 8 14 L16 14 Q19 14 19 11 L19 6" stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9 14 L8 21 M15 14 L16 21" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    case 3: // Posture
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="4.5" r="1.8" stroke={c} strokeWidth={1.6} />
          <Path d="M12 7 L12 14" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M9 10 L15 10" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M12 14 L9 21 M12 14 L15 21" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        </Svg>
      );
    case 4: // Respiration
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M3 9 Q7 5 11 9 T19 9" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
          <Path d="M3 14 Q7 10 11 14 T19 14" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
          <Path d="M3 19 Q7 15 11 19 T19 19" stroke={c} strokeWidth={1.7} strokeLinecap="round" opacity={0.6} />
        </Svg>
      );
    case 5: // Stress / pleine conscience
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="8" stroke={c} strokeWidth={1.6} />
          <Circle cx="12" cy="12" r="4" stroke={c} strokeWidth={1.4} opacity={0.55} />
          <Circle cx="12" cy="12" r="1.2" fill={c} />
        </Svg>
      );
    case 6: // Bureau
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect x="5" y="6" width="14" height="9" rx="1.5" stroke={c} strokeWidth={1.6} />
          <Path d="M3 18 L21 18" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
          <Path d="M9 18 L9 21 M15 18 L15 21" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
        </Svg>
      );
    default:
      return null;
  }
}

function MonCorps({ prenom, done, toggleDone, lang, tensionIdxs, onTensionChange, streak, isSubscriber, onActivateSubscription, onTryFreeSession, saveHealthKitWorkout }) {
  var tr = T[lang] || T["fr"];
  var theme = useTheme().theme;
  var navigation = useNavigation();
  var [openPilier, setOpenPilier] = useState(null);
  var [openInitialIdx, setOpenInitialIdx] = useState(null);
  var [openEducationPilier, setOpenEducationPilier] = useState(null);
  var [mcTab, setMcTab] = useState('pour_vous');
  var [bilanEditMode, setBilanEditMode] = useState(!Array.isArray(tensionIdxs) || tensionIdxs.length === 0);
  var [showCreateProg, setShowCreateProg] = useState(false);
  var [savedPrograms, setSavedPrograms] = useState([]);
  var [searchQuery, setSearchQuery] = useState('');
  var [searchEtape, setSearchEtape] = useState(null);
  var [showBreathing, setShowBreathing] = useState(false);
  var [breathDoneToday, setBreathDoneToday] = useState(false);

  useEffect(function() { diag('MonCorps.mount', 'start'); loadSavedPrograms(); diag('MonCorps.mount', 'done'); }, []);

  // Re-check whether the breath ring is already closed for today, every time
  // the modal closes (so the pill flips to "done" without a manual refresh).
  useEffect(function() {
    let cancelled = false;
    isBreathDoneToday().then(function(d) { if (!cancelled) setBreathDoneToday(!!d); });
    return function() { cancelled = true; };
  }, [showBreathing]);
  function loadSavedPrograms() {
    AsyncStorage.getItem('fluid_custom_programs').then(function(raw) {
      if (raw) { try { setSavedPrograms(JSON.parse(raw)); } catch(e) {} }
      else {
        AsyncStorage.getItem('fluid_custom_program').then(function(old) {
          if (old) { try { var p = JSON.parse(old); setSavedPrograms([p]); AsyncStorage.setItem('fluid_custom_programs', JSON.stringify([p])); } catch(e) {} }
        });
      }
    });
  }
  function deleteSavedProgram(idx) {
    var prog = savedPrograms[idx];
    if (prog && prog.notifIds) cancelProgNotifications(prog.notifIds);
    var updated = savedPrograms.filter(function(_, i) { return i !== idx; });
    setSavedPrograms(updated);
    AsyncStorage.setItem('fluid_custom_programs', JSON.stringify(updated));
  }
  var MC_TABS = ['pour_vous', 'explorer', 'programmes', /* 'live', */ 'recherche'];
  var mcTabLabels = { pour_vous: tr.tab_pour_vous, explorer: tr.tab_explorer, programmes: tr.tab_programmes, live: tr.live_title || 'Live', recherche: tr.tab_recherche };
  var piliers = getPiliers(lang);
  var recommendedPiliers = tensionIdxs.map(function(i) { return ZONE_TO_PILIER[i]; });
  var effectiveRecommended = recommendedPiliers.length > 0 ? recommendedPiliers : [];
  var sdj = getSeanceDuJour(done, tensionIdxs, lang);

  var sortedPiliers = [...piliers].sort(function(a, b) {
    var aRec = effectiveRecommended.includes(a.key) ? 0 : 1;
    var bRec = effectiveRecommended.includes(b.key) ? 0 : 1;
    return aRec - bRec;
  });

  return (
    <View style={localStyles.screen}>
      <LinearGradient colors={theme.colors.bgGradient} locations={theme.colors.bgGradientStops} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: "none" }}>
        <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.18} />
        <Rayon left={140} width={55} delay={2000} duration={11000} opacity={0.15} />
        <Rayon left={280} width={40} delay={4000} duration={8000} opacity={0.12} />
      </View>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} pointerEvents="none">
        <FloatingMedusas />
      </View>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: "none", overflow: "visible" }}>
        {BULLES_MONCORPS.map(function(b, i) { return <Bulle key={"mc-" + i} {...b} />; })}
        {IS_IPAD && BULLES_MONCORPS.map(function(b, i) { return <Bulle key={"mc-ipad1-" + i} delay={b.delay + 2000} x={Math.max(0, Math.min(SW - 8, b.x + SW * 0.35))} size={b.size} duration={b.duration} />; })}
        {IS_IPAD && BULLES_MONCORPS.map(function(b, i) { return <Bulle key={"mc-ipad2-" + i} delay={b.delay + 5000} x={Math.max(0, Math.min(SW - 8, b.x + SW * 0.65))} size={b.size} duration={b.duration} />; })}
      </View>
      <View style={[localStyles.logoRow, { justifyContent: "space-between", paddingLeft: 20, paddingRight: 20, paddingTop: 10, marginBottom: 20, flexDirection: 'row', alignItems: 'center' }]} pointerEvents="box-none">
        <Text style={localStyles.logoWordmark} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: "900", color: "#AEEF4D", fontSize: 34 }}>+</AnimatedPlus>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {(function() {
            // Defensive guard: if the breath pill ever throws during render
            // (post Sprint-B addition, suspected in the build #46 mount
            // burst) we silently drop it instead of crashing the whole
            // home screen. The pill is non-critical UI.
            try {
              return (
          <TouchableOpacity
            onPress={function() { hapticLight(); setShowBreathing(true); }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={breathDoneToday ? (tr.breath_pill_done || 'Respiration faite') : (tr.breath_pill || 'Respirer 60s')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
              backgroundColor: breathDoneToday ? 'rgba(174,239,77,0.18)' : 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: breathDoneToday ? 'rgba(174,239,77,0.55)' : 'rgba(255,255,255,0.18)',
            }}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="9" stroke={breathDoneToday ? '#AEEF4D' : 'rgba(255,255,255,0.78)'} strokeWidth={1.6} />
              <Circle cx="12" cy="12" r="4.5" stroke={breathDoneToday ? '#AEEF4D' : 'rgba(255,255,255,0.78)'} strokeWidth={1.2} opacity={0.6} />
            </Svg>
            <Text style={{ fontSize: 12, fontWeight: '700', color: breathDoneToday ? '#AEEF4D' : 'rgba(255,255,255,0.86)', letterSpacing: 0.3 }}>
              {breathDoneToday ? (tr.breath_pill_done || 'Respiration ✓') : (tr.breath_pill || 'Respirer 60s')}
            </Text>
          </TouchableOpacity>
              );
            } catch (e) {
              if (__DEV__) console.warn('[breath-pill] render throw:', e);
              return null;
            }
          })()}
          {prenom ? (
            <TouchableOpacity
              onPress={function() { try { navigation.navigate(tr.tabs[3]); } catch(e) {} }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 14, fontWeight: '300', color: 'rgba(174,239,77,0.6)' }}>{tr.bonjour(prenom)}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View style={{ position: "absolute", top: 105, left: 0, right: 0, zIndex: 5, marginTop: 20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          <LiquidGlassCapsule tint="light" paddingH={6} paddingV={6} gap={4}>
            {MC_TABS.map(function(t) {
              var active = mcTab === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={function() { setMcTab(t); }}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? 'rgba(174,239,77,0.18)' : 'transparent',
                    borderWidth: active ? 1 : 0,
                    borderColor: active ? 'rgba(174,239,77,0.5)' : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: active ? "700" : "600", color: active ? "#AEEF4D" : "#ffffff" }}>
                    {mcTabLabels[t]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </LiquidGlassCapsule>
        </ScrollView>
      </View>
      <ScrollView
        key={mcTab}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 3 }}
        contentContainerStyle={{ paddingTop: 190, paddingBottom: 110, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {mcTab === 'explorer' && sdj && (
          <TouchableOpacity onPress={function() { if (onTryFreeSession) onTryFreeSession(); }} activeOpacity={0.9} style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#AEEF4D' }}>
            <View style={{ height: 110 }}>
              <Image source={PILIER_IMAGES[sdj.pilier.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-sdj-' + sdj.pilier.key} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.85)']} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Text style={{ fontSize: 20, color: '#000000' }}>{'\u25B6'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <View style={{ backgroundColor: '#FF3B30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff', letterSpacing: 1 }}>NOUVEAU</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#ffffff' }}>{sdj.seance[0]}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{sdj.pilier.label} {'\u00B7'} {sdj.seance[1]}</Text>
                </View>
              </LinearGradient>
            </View>
          </TouchableOpacity>
        )}
        {mcTab === 'pour_vous' && (function() {
          var gridGap = 6;
          var fullW = SW - 32;
          var halfW = Math.floor((fullW - gridGap) / 2);
          var thirdW = Math.floor((fullW - gridGap * 2) / 3);
          var rowH1 = Math.floor(halfW * 0.72);
          var rowH2 = Math.floor(thirdW * 0.82);
          var mosaicImages = [
            PILIER_IMAGES.p1, PILIER_IMAGES.p2,
            PILIER_IMAGES.p3, PILIER_IMAGES.p4, PILIER_IMAGES.p5,
            PILIER_IMAGES.p6, PILIER_IMAGES.p7,
          ];
          var glassCell = function(src, w, h, key) {
            return (
              <View key={key} style={{ width: w, height: h, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#FFFFFF', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }}>
                <Image source={src} contentFit="cover" transition={200} cachePolicy="memory-disk" style={{ flex: 1 }} />
                <LinearGradient colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} locations={[0, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '25%' }} pointerEvents="none" />
              </View>
            );
          };
          return (
            <View key="pour-vous">
              <View style={{ flexDirection: "row", gap: gridGap, marginBottom: gridGap }}>
                {glassCell(mosaicImages[0], halfW, rowH1, 'm0')}
                {glassCell(mosaicImages[1], halfW, rowH1, 'm1')}
              </View>
              <View style={{ flexDirection: "row", gap: gridGap, marginBottom: gridGap }}>
                {glassCell(mosaicImages[2], thirdW, rowH2, 'm2')}
                {glassCell(mosaicImages[3], thirdW, rowH2, 'm3')}
                {glassCell(mosaicImages[4], thirdW, rowH2, 'm4')}
              </View>
              <View style={{ flexDirection: "row", gap: gridGap, marginBottom: 0 }}>
                {glassCell(mosaicImages[5], halfW, rowH1, 'm5')}
                {glassCell(mosaicImages[6], halfW, rowH1, 'm6')}
              </View>
              <LinearGradient colors={["rgba(28,28,30,0.3)", "rgba(28,28,30,0.88)", "rgba(28,28,30,0.95)"]} locations={[0, 0.4, 1]} style={{ borderRadius: 16, marginTop: 14, paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20, alignItems: "center" }}>
                <Text style={{ fontSize: 23, fontWeight: "700", color: "#ffffff", textAlign: "center", marginBottom: 6 }}>{tr.paywall_title}</Text>
                <Text style={{ fontSize: 14, fontWeight: "400", color: "rgba(255,255,255,0.65)", textAlign: "center", lineHeight: 19, marginBottom: 16 }}>{tr.paywall_sub}</Text>
                <View style={{ alignSelf: "stretch", marginBottom: 12 }}>
                  <GlassButton
                    onPress={function() { onActivateSubscription && onActivateSubscription(); }}
                    textColor="#AEEF4D"
                    textStyle={{ fontSize: 17, fontWeight: '700' }}
                  >
                    {tr.paywall_start}
                  </GlassButton>
                </View>
                <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>{"CHF 12.90" + (tr.paywall_per_month || '/mois')}</Text>
                <TouchableOpacity onPress={function() { onActivateSubscription && onActivateSubscription(); }} activeOpacity={0.8}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>{tr.paywall_yearly_link}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          );
        })()}
        {mcTab === 'programmes' && (
          <View key="programmes">
            {tr.ob_zones && tr.ob_zones.length > 0 && (function() {
              var hasZones = Array.isArray(tensionIdxs) && tensionIdxs.length > 0;
              if (bilanEditMode) {
                return (
                  <View style={{ marginBottom: 24 }}>
                    <View style={{ marginBottom: 14, paddingHorizontal: 4 }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2, marginBottom: 4 }}>{tr.ob_bilan || 'Bilan corporel'}</Text>
                      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 18 }}>{tr.bilan_intro || 'Dis-nous où tu ressens des tensions pour personnaliser ton programme'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16, paddingHorizontal: 8 }}>
                      {tr.ob_zones.map(function(zone, idx) {
                        var active = (tensionIdxs || []).indexOf(idx) !== -1;
                        return (
                          <TouchableOpacity
                            key={idx}
                            activeOpacity={0.85}
                            onPress={function() {
                              if (!onTensionChange) return;
                              var cur = Array.isArray(tensionIdxs) ? tensionIdxs : [];
                              var next = cur.indexOf(idx) !== -1 ? cur.filter(function(x) { return x !== idx; }) : cur.concat([idx]);
                              onTensionChange(next);
                            }}
                            style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: active ? 'rgba(174,239,77,0.18)' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.1)' }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? '#AEEF4D' : 'rgba(255,255,255,0.78)', letterSpacing: 0.1 }}>{zone}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <View style={{ paddingHorizontal: 4 }}>
                      {hasZones ? (
                        <TouchableOpacity
                          onPress={function() { setBilanEditMode(false); }}
                          activeOpacity={0.85}
                          style={{ height: 46, borderRadius: 14, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: '800', color: '#000000', letterSpacing: 0.2 }}>{tr.bilan_view_program || 'Voir mon programme'}</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={function() { var p = piliers.find(function(x) { return x.key === 'p7'; }); if (p) setOpenPilier(p); }}
                          activeOpacity={0.7}
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.bilan_explore_all || 'Tout explorer'}</Text>
                          <Text style={{ fontSize: 18, color: '#AEEF4D', fontWeight: '300' }}>{'›'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }
              var seenKeys = {};
              var recommendedPiliers = (tensionIdxs || []).map(function(i) { return ZONE_TO_PILIER[i]; })
                .filter(function(k) { if (!k || seenKeys[k]) return false; seenKeys[k] = true; return true; })
                .map(function(k) { return piliers.find(function(p) { return p.key === k; }); })
                .filter(Boolean);
              return (
                <View style={{ marginBottom: 24 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingHorizontal: 4 }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2 }}>{tr.bilan_program_title || 'Votre programme personnalisé'}</Text>
                    </View>
                    <TouchableOpacity onPress={function() { setBilanEditMode(true); }} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.bilan_update_btn || 'Mettre à jour'}</Text>
                    </TouchableOpacity>
                  </View>
                  {recommendedPiliers.map(function(p) {
                    var descIdx = PILIER_LABEL_IDX[p.key];
                    var desc = (tr.piliers_desc && tr.piliers_desc[descIdx]) || '';
                    return (
                      <View key={'rec-' + p.key} style={{ marginBottom: 10, position: 'relative' }}>
                        <TouchableOpacity
                          onPress={function() { setOpenPilier(p); }}
                          activeOpacity={0.9}
                          style={{ height: 92, borderRadius: 16, overflow: 'hidden' }}
                        >
                          <View style={{ flex: 1 }}>
                            <Image source={PILIER_IMAGES[p.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-pcard-' + p.key} style={StyleSheet.absoluteFill} />
                            <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,14,24,0.85)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, padding: 14, justifyContent: 'center' }}>
                              <Text style={{ fontSize: 17, fontWeight: '800', color: '#ffffff', marginBottom: 4 }}>{p.label}</Text>
                              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 16, paddingRight: 28 }} numberOfLines={2}>{desc}</Text>
                            </LinearGradient>
                            <View style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                              <Text style={{ fontSize: 22, color: '#AEEF4D', fontWeight: '300' }}>{'›'}</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                        {/* Info "i" badge — opens the long-form Comprendre screen. */}
                        <TouchableOpacity
                          onPress={function() { setOpenEducationPilier(p); }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          accessibilityRole="button"
                          accessibilityLabel={(tr.pilier_education_open_a11y || 'Comprendre') + ' — ' + p.label}
                          style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff', fontStyle: 'italic', letterSpacing: 0 }}>i</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#ffffff", marginBottom: 14 }}>{tr.prog_thematiques_title || 'Programmes thématiques'}</Text>
            <Text style={{ fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.45)", lineHeight: 18, marginBottom: 14 }}>{tr.prog_thematiques_sub || 'Des parcours ciblés pour tes objectifs'}</Text>

            {/* Réveil Matinal */}
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, height: 160, borderWidth: 1, borderColor: '#AEEF4D' }}>
              <View style={{ flex: 1 }}>
                <Image source={PROG_IMAGES.reveil} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey="mc-prog-reveil" style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1, padding: 16, justifyContent: "space-between", backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_reveil || 'Réveil Matinal'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>10 min pour réveiller ton corps en douceur</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#AEEF4D", letterSpacing: 1 }}>7 JOURS · 10 MIN/JOUR</Text>
                  </View>
                  <TouchableOpacity
                    onPress={function() { var p = piliers.find(function(x) { return x.key === 'p4'; }); if (p) setOpenPilier(p); }}
                    activeOpacity={0.8}
                    style={{ alignSelf: "stretch", height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>{tr.prog_apercu}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Mal de dos */}
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, height: 160, borderWidth: 1, borderColor: '#AEEF4D' }}>
              <View style={{ flex: 1 }}>
                <Image source={PROG_IMAGES.dos} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey="mc-prog-dos" style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1, padding: 16, justifyContent: "space-between", backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_dos || 'Mal de dos'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>Soulage et renforce ton dos en 21 jours</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#AEEF4D", letterSpacing: 1 }}>21 JOURS · 15 MIN/JOUR</Text>
                  </View>
                  <TouchableOpacity
                    onPress={function() { var p = piliers.find(function(x) { return x.key === 'p2'; }); if (p) setOpenPilier(p); }}
                    activeOpacity={0.8}
                    style={{ alignSelf: "stretch", height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>{tr.prog_apercu}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Post-travail */}
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, height: 160, borderWidth: 1, borderColor: '#AEEF4D' }}>
              <View style={{ flex: 1 }}>
                <Image source={PROG_IMAGES.posttravail} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey="mc-prog-pt" style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1, padding: 16, justifyContent: "space-between", backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_posttravail || 'Post-travail'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>Décompresse après une journée assise</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#AEEF4D", letterSpacing: 1 }}>5 JOURS · 15 MIN/JOUR</Text>
                  </View>
                  <TouchableOpacity
                    onPress={function() { var p = piliers.find(function(x) { return x.key === 'p1'; }); if (p) setOpenPilier(p); }}
                    activeOpacity={0.8}
                    style={{ alignSelf: "stretch", height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>{tr.prog_apercu}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Core & Plancher */}
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, height: 160, borderWidth: 1, borderColor: '#AEEF4D' }}>
              <View style={{ flex: 1 }}>
                <Image source={PROG_IMAGES.core} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey="mc-prog-core" style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1, padding: 16, justifyContent: "space-between", backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_core || 'Core & Plancher'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>Renforce ton centre et ta stabilité</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#AEEF4D", letterSpacing: 1 }}>14 JOURS · 12 MIN/JOUR</Text>
                  </View>
                  <TouchableOpacity
                    onPress={function() { var p = piliers.find(function(x) { return x.key === 'p7'; }); if (p) setOpenPilier(p); }}
                    activeOpacity={0.8}
                    style={{ alignSelf: "stretch", height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>{tr.prog_apercu}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Souplesse totale */}
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, height: 160, borderWidth: 1, borderColor: '#AEEF4D' }}>
              <View style={{ flex: 1 }}>
                <Image source={PROG_IMAGES.souplesse} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey="mc-prog-soup" style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1, padding: 16, justifyContent: "space-between", backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_souplesse || 'Souplesse totale'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>Gagne en mobilité sur tout le corps</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#AEEF4D", letterSpacing: 1 }}>14 JOURS · 20 MIN/JOUR</Text>
                  </View>
                  <TouchableOpacity
                    onPress={function() { var p = piliers.find(function(x) { return x.key === 'p3'; }); if (p) setOpenPilier(p); }}
                    activeOpacity={0.8}
                    style={{ alignSelf: "stretch", height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>{tr.prog_apercu}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Text style={{ fontSize: 22, fontWeight: "800", color: "#ffffff", marginBottom: 6 }}>{tr.prog_section_title}</Text>
            <Text style={{ fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.45)", lineHeight: 18, marginBottom: 14 }}>{tr.prog_section_sub}</Text>
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 20, height: 230, borderWidth: 1, borderColor: '#AEEF4D' }}>
              <LinearGradient colors={["#0a1628", "#0d3b66", "#1a8fa8"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ flex: 1, padding: 16, justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_debuter}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>{tr.prog_debuter_sub}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#ffffff", letterSpacing: 1 }}>{tr.prog_debuter_duree}</Text>
                </View>
                <TouchableOpacity
                  onPress={function() { var p = piliers.find(function(x) { return x.key === 'p1'; }); if (p) setOpenPilier(p); }}
                  activeOpacity={0.8}
                  style={{ alignSelf: "stretch", height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>{tr.prog_apercu}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#ffffff", marginBottom: 6 }}>{tr.prog_custom_title}</Text>
            <Text style={{ fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.45)", lineHeight: 18, marginBottom: 14 }}>{tr.prog_custom_sub}</Text>
            <View style={{ borderRadius: 16, overflow: "hidden", height: 230, borderWidth: 1, borderColor: '#AEEF4D' }}>
              <LinearGradient colors={["#1a0a2e", "#4a1a6b", "#8b3fa0"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ flex: 1, padding: 16, justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_custom_card}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.7)", lineHeight: 18 }}>{tr.prog_custom_card_sub}</Text>
                </View>
                <TouchableOpacity
                  onPress={function() { setShowCreateProg(true); }}
                  activeOpacity={0.8}
                  style={{ alignSelf: "stretch", height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>{tr.prog_custom_btn}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {savedPrograms.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 14 }}>{tr.prog_mes_programmes || 'Mes programmes'}</Text>
                {savedPrograms.map(function(prog, idx) {
                  var progPiliers = getPiliers(lang).filter(function(p) { return prog.piliers.includes(p.key); });
                  return (
                    <View key={idx} style={{ backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>{(tr.prog_custom_card || 'Programme') + ' ' + (idx + 1)}</Text>
                        <TouchableOpacity onPress={function() { deleteSavedProgram(idx); }} activeOpacity={0.7} style={{ padding: 4 }}>
                          <Text style={{ fontSize: 12, color: 'rgba(255,100,100,0.7)' }}>{'\u2715'}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {progPiliers.map(function(p) {
                          return (
                            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.1)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)' }}>
                              <View style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden' }}>
                                <Image source={PILIER_IMAGES[p.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-pil-' + p.key} style={{ flex: 1 }} />
                              </View>
                              <Text style={{ fontSize: 12, color: '#AEEF4D' }}>{p.label}</Text>
                            </View>
                          );
                        })}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 16 }}>
                        <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.6)' }}>{prog.duree} / {tr.resume_seances ? 's\u00E9ance' : 'session'}</Text>
                        <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.6)' }}>{prog.jours}x / {tr.prog_jours_label ? tr.prog_jours_label.toLowerCase() : 'semaine'}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
        {mcTab === 'explorer' && (function() {
          var seancesData = getSeances(lang);
          var cardH = Math.floor(SW * 0.45);
          var freeCardW = Math.round(SW * 0.62);
          var freeCardH = Math.round(freeCardW * 1.15);
          var freeItems = (FREE_MONTHLY_SELECTION || []).map(function(item) {
            var p = piliers.find(function(x) { return x.key === item.pilier; });
            var seance = (seancesData[item.pilier] || [])[item.idx];
            if (!p || !seance) return null;
            return { pilier: p, idx: item.idx, titre: seance[0], duree: seance[1], etape: seance[2] };
          }).filter(Boolean);
          return (
            <View key="explorer-sections">
              {freeItems.length > 0 && (
                <View style={{ marginBottom: 24, marginHorizontal: -16 }}>
                  <View style={{ paddingHorizontal: 22, marginBottom: 12 }}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.3, marginBottom: 4 }}>{tr.explore_free_title || 'Sélection gratuite du mois'}</Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{tr.explore_free_sub || 'Essayez ces séances gratuitement, sans abonnement'}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                    {freeItems.map(function(it, i) {
                      return (
                        <TouchableOpacity
                          key={"free-" + it.pilier.key + "-" + it.idx}
                          activeOpacity={0.9}
                          onPress={function() { setOpenInitialIdx(it.idx); setOpenPilier(it.pilier); }}
                          style={{ width: freeCardW, height: freeCardH, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(174,239,77,0.25)' }}
                        >
                          <View style={{ flex: 1 }}>
                            <Image source={PILIER_IMAGES[it.pilier.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-it-' + it.pilier.key} style={StyleSheet.absoluteFill} />
                            <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']} locations={[0, 0.5, 1]} style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ backgroundColor: '#AEEF4D', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}>
                                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#000', letterSpacing: 1.2 }}>{tr.gratuit_badge || 'GRATUIT'}</Text>
                                </View>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, color: '#AEEF4D' }}>+</AnimatedPlus></Text>
                              </View>
                              <View>
                                <Text style={{ fontSize: 10, color: '#AEEF4D', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 6 }}>{(tr.etapes && tr.etapes[it.etape]) || it.etape} · {it.pilier.label}</Text>
                                <Text style={{ fontSize: 19, fontWeight: '800', color: '#ffffff', lineHeight: 23, marginBottom: 8 }} numberOfLines={2}>{it.titre}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 13, color: '#000' }}>{'▶'}</Text>
                                  </View>
                                  <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>{it.duree}</Text>
                                </View>
                              </View>
                            </LinearGradient>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {piliers.map(function(p) {
                var ps = seancesData[p.key] || [];
                var doneCount = done[p.key] ? done[p.key].filter(Boolean).length : 0;
                return (
                  <TouchableOpacity
                    key={"exp-" + p.key}
                    activeOpacity={0.88}
                    onPress={function() {
                      if (!isSubscriber) { onActivateSubscription && onActivateSubscription(); return; }
                      setOpenPilier(p);
                    }}
                    style={{ marginBottom: 16, borderRadius: 16, overflow: "hidden", height: cardH }}
                  >
                    <View style={{ flex: 1 }}>
                      <Image source={PILIER_IMAGES[p.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-pcardbig-' + p.key} style={[StyleSheet.absoluteFill, p.key === 'p8' ? { top: -20, transform: [{ scale: 1.15 }] } : { transform: [{ scale: 1.15 }] }]} />
                      <LinearGradient colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.7)"]} style={{ flex: 1, justifyContent: "flex-end", padding: 16 }}>
                        <Text style={{ fontSize: 24, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{p.label}</Text>
                        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{(ps.length || 20) + ' ' + tr.m_seances}</Text>
                      </LinearGradient>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })()}
        {mcTab === 'live' && (
          <View key="live" style={{ paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ff3b30' }} />
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff' }}>{tr.live_title || 'Cours en direct'}</Text>
            </View>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>{tr.live_subtitle || 'Rejoins Sabrina en live chaque semaine'}</Text>
            {LIVE_SCHEDULE.map(function(cls) {
              var dayFull = lang === 'en' ? DAY_FULL_EN : DAY_FULL_FR;
              var isToday = cls.day === new Date().getDay();
              return (
                <View key={cls.id} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: isToday ? '#AEEF4D' : 'rgba(174,239,77,0.15)' }}>
                  <View style={{ height: 150 }}>
                    <Image source={require('../../assets/coach.jpg')} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey="mc-coach" style={StyleSheet.absoluteFill} />
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,14,24,0.7)', padding: 16, justifyContent: 'space-between' }}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          {isToday && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,59,48,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4 }}>
                              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff3b30' }} />
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#ff3b30' }}>{tr.live_today || "AUJOURD'HUI"}</Text>
                            </View>
                          )}
                          <View style={{ backgroundColor: 'rgba(174,239,77,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                            <Text style={{ fontSize: 10, fontWeight: '600', color: '#AEEF4D' }}>{cls.duration}</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 3 }}>{cls.title}</Text>
                        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{dayFull[cls.day]} · {cls.time} · {tr.live_with || 'avec'} {cls.coach}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={{ flex: 1, height: 38, borderRadius: 19, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#001226' }}>{tr.live_join || 'Rejoindre'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ height: 38, width: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 14 }}>🔔</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
            <View style={{ backgroundColor: 'rgba(0,18,38,0.4)', borderRadius: 16, padding: 20, marginTop: 6, borderWidth: 1, borderColor: 'rgba(174,239,77,0.1)' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff', marginBottom: 8 }}>{tr.live_info_title || 'Comment ça marche ?'}</Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 }}>{tr.live_info_body || "Connecte-toi à l'heure du cours et clique sur \"Rejoindre\"."}</Text>
            </View>
          </View>
        )}
        {mcTab === 'recherche' && (function() {
          var seancesData = getSeances(lang);
          var halfW = (SW - 52) / 2;
          var allResults = [];
          piliers.forEach(function(p) {
            var ps = seancesData[p.key] || [];
            ps.forEach(function(s, idx) {
              var titre = s[0] || '';
              var etape = s[2] || '';
              var matchQuery = !searchQuery || titre.toLowerCase().includes(searchQuery.toLowerCase());
              var matchEtape = !searchEtape || etape === searchEtape;
              if (matchQuery && matchEtape) {
                allResults.push({ seance: s, idx: idx, pilier: p });
              }
            });
          });
          return (
            <View>
              {/* Search bar — Liquid Glass capsule */}
              <View style={{ marginBottom: 14 }}>
                <LiquidGlassCapsule tint="light" radius={16} paddingH={14} paddingV={8} gap={8}>
                  <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)' }}>🔍</Text>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    accessibilityLabel={tr.a11y_search_seance || 'Rechercher une séance'}
                    placeholder={tr.search_placeholder || 'Chercher une séance...'}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={{ flex: 1, paddingVertical: 6, fontSize: 15, color: '#ffffff' }}
                  />
                </LiquidGlassCapsule>
              </View>
              {/* Étape filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {['Comprendre', 'Ressentir', 'Préparer', 'Exécuter', 'Évoluer'].map(function(etape) {
                  var active = searchEtape === etape;
                  return (
                    <TouchableOpacity key={etape} onPress={function() { setSearchEtape(active ? null : etape); }}
                      style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.08)', marginRight: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#001226' : 'rgba(255,255,255,0.6)' }}>{etape}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {allResults.length === 0 && (
                <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40, fontSize: 15 }}>{tr.search_no_results || 'Aucun résultat'}</Text>
              )}
              {/* Grid 2 colonnes avec photos */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {allResults.map(function(r, i) {
                  var s = r.seance;
                  var titre = s[0] || '';
                  var duree = s[1] || '';
                  var etape = s[2] || '';
                  var etapeColor = ETAPE_COLORS[etape] || 'rgba(255,255,255,0.5)';
                  return (
                    <TouchableOpacity key={r.pilier.key + '-' + r.idx + '-' + i} activeOpacity={0.88} onPress={function() { setOpenPilier(r.pilier); }}
                      style={{ width: halfW, height: 140, borderRadius: 14, overflow: 'hidden', marginBottom: 2 }}>
                      <View style={{ flex: 1 }}>
                        <Image source={PILIER_IMAGES[r.pilier.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-r-' + r.pilier.key} style={StyleSheet.absoluteFill} />
                        <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.8)']} style={{ flex: 1, justifyContent: 'space-between', padding: 10 }}>
                          <View style={{ flexDirection: 'row' }}>
                            {etape ? (
                              <View style={{ backgroundColor: etapeColor, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: '#001226' }}>{etape}</Text>
                              </View>
                            ) : null}
                          </View>
                          <View>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff', marginBottom: 2 }} numberOfLines={2}>{titre}</Text>
                            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{duree}</Text>
                          </View>
                        </LinearGradient>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })()}
      </ScrollView>
      {openPilier && (
        <PilierPanel pilier={openPilier} done={done[openPilier.key] || Array(20).fill(false)} onToggle={function(idx) { toggleDone(openPilier.key, idx); }} onClose={function() { setOpenPilier(null); setOpenInitialIdx(null); }} lang={lang} isRecommended={effectiveRecommended.includes(openPilier.key)} isSubscriber={isSubscriber} onActivateSubscription={onActivateSubscription} sdjIndex={sdj && sdj.pilier && sdj.pilier.key === openPilier.key ? sdj.idx : null} saveHealthKitWorkout={saveHealthKitWorkout} initialSeanceIdx={openInitialIdx} />
      )}
      <PilierEducation
        visible={!!openEducationPilier}
        pilier={openEducationPilier}
        lang={lang}
        onClose={function() { setOpenEducationPilier(null); }}
        onOpenSeance={function(pilierKey, idx) {
          var target = piliers.find(function(x) { return x.key === pilierKey; });
          if (!target) return;
          setOpenInitialIdx(typeof idx === 'number' ? idx : null);
          setOpenPilier(target);
        }}
      />

      <CreateProgramScreen visible={showCreateProg} onClose={function() { setShowCreateProg(false); }} lang={lang} onSaved={loadSavedPrograms} />
      {(function() {
        // Defensive guard around the BreathingCheckIn modal — non-critical
        // UI, never render-throw the whole screen if Sprint-B regression hits.
        try { return <BreathingCheckIn visible={showBreathing} onClose={function() { setShowBreathing(false); }} lang={lang} />; }
        catch (e) { if (__DEV__) console.warn('[breath-modal] render throw:', e); return null; }
      })()}
    </View>
  );
}

const localStyles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoRow: { position: 'absolute', top: 54, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, gap: 10 },
  logoWordmark: { fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 },
});

export default MonCorps;
export { MetricTile };
