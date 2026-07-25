import { Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContext, NavigationContainerRefContext } from '@react-navigation/native';

// Safe useNavigation : retourne null sur tvOS où MonCorps est rendu hors
// NavigationContainer (cf. App.js TVMainView). Évite le crash :
// "Couldn't find a navigation object. Is your component inside NavigationContainer?".
function useSafeNavigation() {
  const navCtx = useContext(NavigationContext);
  const rootRef = useContext(NavigationContainerRefContext);
  return navCtx || rootRef || null;
}
import { Text, StyleSheet, Animated, Easing, View, TouchableOpacity, ScrollView, Dimensions, Modal, Platform, TextInput, Share, Alert } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import LiquidGlass from '../components/LiquidGlass';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { U_JELLY, U_WAVE, ZONE_TO_PILIER, T, PILIER_IMAGES, FREE_MONTHLY_SELECTION, getSeanceImage } from '../constants/data';
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
import PostSessionReflection from '../components/PostSessionReflection';
import DailyIntentionPrompt from '../components/DailyIntentionPrompt';
import StreakCelebration from '../components/StreakCelebration';
import { getTodayIntention, getPilierKeyForIntention, findIntention } from '../utils/dailyIntention';
import { chromeAnim, createChromeScrollHandler, showChrome } from '../utils/chromeScroll';
import { shouldCelebrate, markCelebrated } from '../utils/streakMilestones';
import PilierEducation from './PilierEducation';
import { prefetchSignedVideoUrl, buildSessionId } from '../utils/videoUrl';
import { getPiliers, getSeances, getSeanceDuJour, canAccessSeanceIndex, getResumeIndicesForPilier, hapticLight, hapticSuccess, isComingSoon } from '../utils';
import ChallengeModal from '../components/ChallengeModal';
import { CHALLENGE_7J, challengeDoneCount, challengeNextDay } from '../constants/challenge';
import { safeNativeCall, diag } from '../utils/safeNativeCall';
import { getActiveProgram, getProgramStats } from '../utils/programs';
import MyPrograms from './MyPrograms';
import ProgramBuilder from './ProgramBuilder';
import calendarUtil from '../utils/calendar';
import { IS_TV, tvFocusProps } from '../utils/platformTV';
import { SeanceCompleteTV, TVHeaderBar, TVHeaderSearchIcon, TVHeaderBreathIcon, PilierPanelTV, ExplorerTV, ProgrammesTV, StatsTV, BibliothequeTV, TwoColLandingTV, AquaticBackground, RechercheTV, SessionBadge } from '../components/tv';
import { pickBadge } from '../utils/sessionBadges';
import { getCachedFavorites, subscribeFavorites } from '../utils/favorites';
import { getThisWeekSchedule } from '../utils/weeklySchedule';
import SeanceCarouselRow from '../components/SeanceCarouselRow';
import DownloadButton from '../components/DownloadButton';
import { primeDownloadsCache, subscribeDownloads } from '../utils/downloadsCache';
import { primeDurationsCache, subscribeDurations, getRealDurationLabel } from '../utils/videoDurations';
import { useEffortPromo, EffortPromoBanner, EffortPromoWalkthrough } from '../components/EffortPromo';
import { primeFavoritesCache } from '../utils/favorites';
import { getDailyQuote } from '../constants/sabrinaQuotes';
import { Icon } from '../components/Icons';

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

// Photos coach Sabrina (studio Espace Pilates) — TV uniquement.
   // signature hero
  // backdrop "monde"

const { width: SW, height: SH } = Dimensions.get('window');
const IS_IPAD = SW >= 768;
// Écrans ≤ 410 pt (iPhone 13/14/15/16 non-Max) : pas la place pour
// wordmark + pastille respiration avec libellé + "Bonjour {prénom}" sur
// une seule rangée → la pastille passe en icône seule.
const HEADER_COMPACT = !IS_IPAD && SW < 410;
// iPad : on contraint le contenu dans une colonne centrée de largeur "type
// téléphone large" plutôt que d'étaler les cartes sur toute la dalle (sinon les
// photos de catégories paraissent étirées). CW = largeur effective utilisée
// pour dimensionner les cartes ; RW = ratio pour mettre à l'échelle les
// hauteurs fixes afin de conserver des proportions proches de l'iPhone.
const CONTENT_MAX_W = 640;
const CW = IS_IPAD ? Math.min(SW, CONTENT_MAX_W) : SW;
const RW = IS_IPAD ? CW / 390 : 1;
const ipadH = function (h) { return IS_IPAD ? Math.round(h * RW) : h; };

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
    // Signature haptique de fin de séance (2026-07-23) : une chorégraphie en
    // trois temps calée sur l'animation — burst initial (succès), deux pulses
    // légers pendant l'envol des particules, puis un succès final quand la
    // médaille se pose. Le moment le plus important de l'app doit se SENTIR.
    hapticSuccess();
    const hapticTimers = [
      setTimeout(hapticLight, 180),
      setTimeout(hapticLight, 380),
      setTimeout(hapticSuccess, 820),
    ];
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
    return function() {
      clearAutoDismiss();
      hapticTimers.forEach(function(t) { clearTimeout(t); });
    };
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

// Pressable wrapper qui réagit au focus engine tvOS — premium :
//   - scale 1 → 1.06 animé (220 ms, easing.out.cubic, native driver)
//   - anneau bioluminescent cyan qui fade-in 0 → 1 (200 ms)
//   - drop shadow plus dense au focus pour faire "lever" la card
// Sur iPhone, comportement identique au TouchableOpacity standard
// (les Animated.timing ne tournent que sur tvOS où setFocused est branché).
function FocusableCard({ children, focusPreferred, style, accent, ...rest }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const ringColor = accent === 'green' ? '#AEEF4D' : '#00DCEC';

  useEffect(() => {
    if (!IS_TV) return;
    Animated.parallel([
      Animated.timing(scale, {
        toValue: focused ? 1.06 : 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ring, {
        toValue: focused ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  if (!IS_TV) {
    return (
      <TouchableOpacity activeOpacity={0.88} style={style} {...rest}>
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.92}
        {...tvFocusProps(focusPreferred)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ flex: 1 }}
        {...rest}
      >
        {children}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -3,
            left: -3,
            right: -3,
            bottom: -3,
            borderRadius: 18,
            borderWidth: 3,
            borderColor: ringColor,
            opacity: ring,
            shadowColor: ringColor,
            shadowOpacity: 0.8,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      </TouchableOpacity>
    </Animated.View>
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
  const [celebratedIdx, setCelebratedIdx] = useState(null);
  const [showReflection, setShowReflection] = useState(false);
  const [showDemoLimit, setShowDemoLimit] = useState(false);
  const [resumeIndices, setResumeIndices] = useState(() => new Set());

  // Durées réelles des vidéos (cache rempli à la 1re lecture) — force un
  // re-render quand une nouvelle durée arrive pour corriger le chip.
  const [, setDurVersion] = useState(0);
  useEffect(function() {
    primeDurationsCache();
    return subscribeDurations(function() { setDurVersion(function(v) { return v + 1; }); });
  }, []);

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
          onComplete={() => { setCelebratedSeance(seances[activeVideo]); setCelebratedIdx(activeVideo); onToggle(activeVideo); setActiveVideo(null); setShowCelebration(true); }}
          onDemoLimit={() => setShowDemoLimit(true)}
          saveHealthKitWorkout={saveHealthKitWorkout}
        />
        {showDemoLimit && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50, overflow: 'hidden', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)' }}>
            <LiquidGlass intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={{ paddingVertical: 24, paddingHorizontal: 28, alignItems: 'center', backgroundColor: 'rgba(10,20,35,0.6)' }}>
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
            </LiquidGlass>
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
      {/* Layout : sur iPhone \u2192 header empil\u00E9 + ScrollView pleine largeur.
          Sur Apple TV \u2192 header en colonne gauche (~38% largeur) avec
          pilier en hero, ScrollView en colonne droite (~62%). */}
      <View style={{ flex: 1, flexDirection: IS_TV ? 'row' : 'column' }}>
      <View style={{
        paddingTop: IS_TV ? 90 : 54,
        paddingHorizontal: IS_TV ? 60 : 22,
        paddingBottom: 10,
        width: IS_TV ? '38%' : undefined,
        justifyContent: IS_TV ? 'flex-start' : undefined,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: IS_TV ? 'flex-start' : 'flex-end', marginBottom: IS_TV ? 24 : 10 }}>
          <Text style={{ fontSize: IS_TV ? 28 : 22, fontWeight: '900', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: IS_TV ? 34 : 28 }}>+</AnimatedPlus></Text>
        </View>
        <FocusableCard
          onPress={onClose}
          focusPreferred={false}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          style={{
            marginBottom: IS_TV ? 28 : 12,
            alignSelf: 'flex-start',
            paddingHorizontal: IS_TV ? 18 : 0,
            paddingVertical: IS_TV ? 10 : 0,
            borderRadius: IS_TV ? 14 : 0,
          }}
        >
          <Text style={{ fontSize: IS_TV ? 28 : 24, fontWeight: '700', color: '#AEEF4D' }}>{tr.retour}</Text>
        </FocusableCard>
        <View style={{ flexDirection: IS_TV ? 'column' : 'row', alignItems: IS_TV ? 'flex-start' : 'center', gap: 10, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: IS_TV ? 64 : (IS_IPAD ? 38 : 34), fontWeight: '200', color: '#ffffff', letterSpacing: -0.3, lineHeight: IS_TV ? 72 : undefined }}>{pilier.label}</Text>
          {isRecommended && (
            <View style={{ paddingHorizontal: IS_TV ? 14 : 10, paddingVertical: IS_TV ? 6 : 4, borderRadius: IS_TV ? 14 : 10, backgroundColor: 'rgba(0,215,255,0.2)', borderWidth: 1, borderColor: 'rgba(0,215,255,0.7)' }}>
              <Text style={{ fontSize: IS_TV ? 13 : 9, color: 'rgba(0,220,255,0.9)', letterSpacing: 1 }}>{'\u2605'} {tr.recommande_pour_toi}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: IS_TV ? 14 : 10, color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginTop: IS_TV ? 16 : 4 }}>{tr.seances_available || '5 S\u00C9ANCES \u00B7 PLUS \u00C0 VENIR'}</Text>
        <View style={{ height: IS_TV ? 5 : 3, backgroundColor: 'rgba(0,200,240,0.1)', borderRadius: 2, marginTop: IS_TV ? 18 : 10, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ height: IS_TV ? 5 : 3, flex: doneCount / 5, backgroundColor: pilier.color, borderRadius: 2 }} />
        </View>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: IS_TV ? 40 : 16 }} contentContainerStyle={{ paddingTop: IS_TV ? 90 : 0, paddingRight: IS_TV ? 40 : 0 }} showsVerticalScrollIndicator={false}>
        {(function() {
        // PERF (2026-07-23) : l'en-tête de section était calculé via une
        // boucle arrière O(n) par item (O(n²) au total, à chaque render).
        // Le map s'exécutant dans l'ordre, une simple variable de closure
        // suffit — même sémantique, une seule passe.
        let lastPracticalEtape = null;
        return seances.map(([titre, duree, etape, url], i) => {
          if (etape === 'Comprendre' || etape === 'Ressentir') return null;
          const isDone = done[i] === true || done[i] === 'true';
          const noVideo = !url;
          const locked = !noVideo && !canAccessSeanceIndex(i, isSubscriber, pilier.key);
          const prevPracticalEtape = lastPracticalEtape;
          lastPracticalEtape = etape;
          let sectionTitle = null;
          if (etape !== prevPracticalEtape) sectionTitle = tr.etapes[etape] || etape;
          const isFirstVisible = prevPracticalEtape === null;
          const header = sectionTitle ? (
            <View>
              <Text style={{ fontSize: IS_TV ? 28 : 18, fontWeight: '800', color: '#AEEF4D', letterSpacing: IS_TV ? 4 : 2.5, textTransform: 'uppercase', marginTop: IS_TV ? (isFirstVisible ? 16 : 36) : (isFirstVisible ? 10 : 22), marginBottom: IS_TV ? 24 : 18, paddingHorizontal: 4 }}>{sectionTitle}</Text>
            </View>
          ) : null;
          return (
            <Fragment key={i}>
              {header}
            <FocusableCard
              onPress={() => tryOpenSeance(i)}
              focusPreferred={i === 0}
              disabled={noVideo}
              accent={isDone ? 'green' : 'cyan'}
              style={{ borderRadius: IS_TV ? 20 : 16, overflow: 'hidden', marginBottom: IS_TV ? 22 : 12, height: IS_TV ? 200 : 110, opacity: noVideo ? 0.45 : (locked ? 0.4 : 1) }}
            >
              {(function() {
                // Badge top-left (REPRENDRE / NOUVEAU / FAVORI). On désactive
                // "PROGRAMME" à l'intérieur d'un pilier (redondant : toutes
                // les séances du pilier le porteraient).
                var b = pickBadge({ pilierKey: pilier.key, idx: i, lang: lang, isResume: resumeIndices.has(i), isProgram: false });
                return b && !noVideo ? (
                  <View style={{ position: 'absolute', top: IS_TV ? 14 : 8, left: IS_TV ? 14 : 8, zIndex: 4 }}>
                    <SessionBadge label={b.label} tone={b.tone} />
                  </View>
                ) : null;
              })()}
              {/* Bouton télécharger (iPhone uniquement). En top-right pour
                  ne pas chevaucher le badge top-left ni les chips bas-gauche
                  (Gratuit / Reprise / Bientôt). Peut chevaucher légèrement
                  le watermark "FLUIDBODY+" décoratif — le bouton est
                  fonctionnel, prioritaire. Désactivé si pas vidéo ou pas
                  abonné (le DL nécessite l'abonnement comme le stream). */}
              {!IS_TV && !noVideo && !locked ? (
                <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 4 }}>
                  <DownloadButton pilierKey={pilier.key} idx={i} lang={lang} disabled={!isSubscriber} />
                </View>
              ) : null}
              <View style={{ flex: 1 }}>
                <Image source={PILIER_IMAGES[pilier.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-pil-bg-' + pilier.key} style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={
                    isDone
                      ? ['rgba(0,30,22,0.65)', 'rgba(0,30,22,0.74)', 'rgba(0,30,22,0.80)', 'rgba(0,30,22,0.85)', 'rgba(0,30,22,0.90)', 'rgba(0,30,22,0.94)']
                      : locked
                        ? ['rgba(0,14,24,0.65)', 'rgba(0,14,24,0.75)', 'rgba(0,14,24,0.82)', 'rgba(0,14,24,0.86)', 'rgba(0,14,24,0.90)', 'rgba(0,14,24,0.94)']
                        : ['rgba(0,14,24,0.42)', 'rgba(0,14,24,0.55)', 'rgba(0,14,24,0.65)', 'rgba(0,14,24,0.74)', 'rgba(0,14,24,0.82)', 'rgba(0,14,24,0.88)']
                  }
                  locations={[0, 0.22, 0.44, 0.66, 0.84, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1, paddingHorizontal: IS_TV ? 30 : 16, paddingTop: IS_TV ? 18 : 8, paddingBottom: IS_TV ? 20 : 12 }}
                >
                  {/* marginRight quand le bouton download (absolute top-right,
                      30px + 8px de marge) est affiché — sinon le watermark
                      passe dessous (retour Yvan 25/07). */}
                  <Text style={{ fontSize: IS_TV ? 14 : 10, fontWeight: '900', color: '#ffffff', alignSelf: 'flex-end', marginBottom: 6, marginRight: (!IS_TV && !noVideo && !locked) ? 34 : 0 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, color: '#AEEF4D' }}>+</AnimatedPlus></Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: IS_TV ? 72 : 40, height: IS_TV ? 72 : 40, borderRadius: IS_TV ? 36 : 20, backgroundColor: isDone ? 'rgba(174,239,77,0.18)' : 'rgba(255,255,255,0.15)', borderWidth: IS_TV ? 1.5 : 0, borderColor: isDone ? 'rgba(174,239,77,0.55)' : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: IS_TV ? 22 : 14 }}>
                      <Text style={{ fontSize: IS_TV ? 34 : 18, color: isDone ? '#AEEF4D' : '#ffffff' }}>{isDone ? '\u2713' : '\u25B6'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: IS_TV ? 30 : 16, fontWeight: IS_TV ? '500' : '600', color: '#ffffff', marginBottom: IS_TV ? 10 : 6, letterSpacing: IS_TV ? -0.3 : 0 }} numberOfLines={1}>{titre}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Text style={{ fontSize: IS_TV ? 13 : 10, paddingHorizontal: IS_TV ? 12 : 8, paddingVertical: IS_TV ? 5 : 3, borderRadius: 8, backgroundColor: 'rgba(0,189,208,0.15)', color: '#00BDD0', letterSpacing: 0.5 }}>{tr.etapes[etape] || etape}</Text>
                        <Text style={{ fontSize: IS_TV ? 13 : 10, paddingHorizontal: IS_TV ? 12 : 8, paddingVertical: IS_TV ? 5 : 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', color: '#ffffff' }}>{getRealDurationLabel(pilier.key, i, duree)}</Text>
                        {i === 0 && !isSubscriber ? (
                          <Text style={{ fontSize: IS_TV ? 12 : 9, paddingHorizontal: IS_TV ? 11 : 7, paddingVertical: IS_TV ? 5 : 3, borderRadius: 8, backgroundColor: 'rgba(0,189,208,0.2)', color: '#00BDD0', fontWeight: '700', letterSpacing: 0.5 }}>{tr.gratuit_badge || 'GRATUIT'}</Text>
                        ) : null}
                        {resumeIndices.has(i) && !locked ? (
                          <Text style={{ fontSize: IS_TV ? 12 : 9, paddingHorizontal: IS_TV ? 11 : 7, paddingVertical: IS_TV ? 5 : 3, borderRadius: 8, backgroundColor: 'rgba(174,239,77,0.15)', color: '#AEEF4D', fontWeight: '600' }}>{tr.reprise_badge}</Text>
                        ) : null}
                        {isComingSoon(pilier.key, i) ? (
                          <Text style={{ fontSize: IS_TV ? 12 : 9, paddingHorizontal: IS_TV ? 11 : 7, paddingVertical: IS_TV ? 5 : 3, borderRadius: 8, backgroundColor: 'rgba(210,140,190,0.20)', color: '#E1A8C8', fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>{tr.coming_soon_badge || 'Bientôt'}</Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={{ fontSize: IS_TV ? 32 : 13, color: '#AEEF4D', fontWeight: '200', letterSpacing: IS_TV ? -0.5 : 0, fontVariant: ['tabular-nums'] }}>{String(i + 1).padStart(2, '0')}</Text>
                  </View>
                </LinearGradient>
              </View>
            </FocusableCard>
            </Fragment>
          );
        });
        })()}
        <View style={{ height: 100 }} />
      </ScrollView>
      </View>
      {/* Apple TV : on bascule sur SeanceCompleteTV (overlay plein écran
          avec confetti méduses + AquaticBackground en fond). Le
          CelebrationOverlay iPhone reste pour mobile. */}
      {IS_TV ? (
        showCelebration && (
          <View pointerEvents="auto" style={[StyleSheet.absoluteFillObject, { zIndex: 200 }]}>
            <SeanceCompleteTV
              isFr={(lang || 'fr').toLowerCase().indexOf('fr') === 0}
              durationLabel={celebratedSeance ? celebratedSeance[1] : null}
              seanceTitle={celebratedSeance ? celebratedSeance[0] : null}
              pilierLabel={pilier.label}
              onContinue={() => { setShowCelebration(false); setShowReflection(true); }}
              onClose={() => { setShowCelebration(false); setShowReflection(true); onClose && onClose(); }}
            />
          </View>
        )
      ) : (
        <CelebrationOverlay visible={showCelebration} onDone={() => { setShowCelebration(false); setShowReflection(true); }} pilier={pilier} lang={lang} seance={celebratedSeance} />
      )}
      <PostSessionReflection
        visible={showReflection}
        sessionId={celebratedIdx != null ? pilier.key + '_' + celebratedIdx : null}
        lang={lang}
        onClose={() => setShowReflection(false)}
      />
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
        enhanced
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
  var tr = T[lang] || T["fr"];
  var piliers = getPiliers(lang);
  var [selected, setSelected] = useState([]);
  var [duree, setDuree] = useState(1);
  var [jours, setJours] = useState(3);
  var [saved, setSaved] = useState(false);
  var [notifHour, setNotifHour] = useState(8);
  var [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  // FIX rules-of-hooks (2026-07-23) : le early-return était AVANT les hooks →
  // « Rendered more hooks than during the previous render » à l'ouverture.
  if (!visible) return null;
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
        <LiquidGlass intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,20,35,0.6)' }} pointerEvents="none" />
        <ScrollView contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 24, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <TouchableOpacity onPress={onClose} style={{ paddingVertical: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1.5, textTransform: 'uppercase' }}>{tr.retour}</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 24 }}>{tr.prog_create_title}</Text>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_select_piliers}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
            {piliers.map(function(p) {
              var active = selected.includes(p.key);
              return (
                <TouchableOpacity key={p.key} onPress={function() { togglePilier(p.key); }} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(174,239,77,0.12)' : 'rgba(0,18,32,0.6)' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden' }}>
                    <Image source={PILIER_IMAGES[p.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-pil-' + p.key} style={{ flex: 1 }} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: active ? '#AEEF4D' : 'rgba(255,255,255,0.6)' }}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_duree_label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 28 }} contentContainerStyle={{ gap: 10 }}>
            {dureeOptions.map(function(d, i) {
              var active = duree === i;
              return (
                <TouchableOpacity key={i} onPress={function() { setDuree(i); }} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(174,239,77,0.12)' : 'rgba(0,18,32,0.6)' }}>
                  <Text style={{ fontSize: 14, color: active ? '#AEEF4D' : 'rgba(255,255,255,0.6)' }}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_jours_label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 36 }} contentContainerStyle={{ gap: 10 }}>
            {joursOptions.map(function(j) {
              var active = jours === j;
              return (
                <TouchableOpacity key={j} onPress={function() { setJours(j); }} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(174,239,77,0.12)' : 'rgba(0,18,32,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: active ? '#AEEF4D' : 'rgba(255,255,255,0.6)' }}>{j}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_notif_days || 'Jours de rappel'}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 0].map(function(d, i) {
              var active = selectedDays.includes(d);
              return (
                <TouchableOpacity key={d} onPress={function() { toggleDay(d); }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(174,239,77,0.12)' : 'rgba(0,18,32,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#AEEF4D' : 'rgba(255,255,255,0.6)' }}>{jourLabels[i]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_notif_hour || 'Heure de rappel'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 36 }}>
            <TouchableOpacity onPress={function() { setNotifHour(Math.max(5, notifHour - 1)); }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>{'\u2212'}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff', minWidth: 80, textAlign: 'center' }}>{String(notifHour).padStart(2, '0') + ':00'}</Text>
            <TouchableOpacity onPress={function() { setNotifHour(Math.min(22, notifHour + 1)); }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={saveProg} disabled={selected.length === 0} activeOpacity={0.85} style={{ height: 56, borderRadius: 28, backgroundColor: selected.length > 0 ? '#AEEF4D' : 'rgba(174,239,77,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#000000' }}>{saved ? tr.prog_saved : tr.prog_save}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const PILIER_LABEL_IDX = { p1: 0, p2: 1, p3: 2, p4: 3, p5: 4, p6: 5, p7: 6, p8: 7 };


function MonCorps({ prenom, done, toggleDone, lang, tensionIdxs, onTensionChange, streak, isSubscriber, onActivateSubscription, onTryFreeSession, saveHealthKitWorkout, supabase, supaUser, onOpenProfile }) {
  var tr = T[lang] || T["fr"];
  // Précharge le cache favoris : cœurs visibles (Bibliothèque TV, badges
  // iPhone) + rangée "Mes favoris" (TV + iPhone Pour vous).
  useEffect(function() { primeFavoritesCache(); }, []);
  // Précharge le cache des téléchargements (iPhone) pour que les boutons
  // download dans PilierPanel et la section Hors-ligne reflètent l'état
  // dès le premier rendu.
  useEffect(function() { if (!IS_TV) primeDownloadsCache(); }, []);
  var theme = useTheme().theme;
  var navigation = useSafeNavigation();
  var [openPilier, setOpenPilier] = useState(null);
  var [openInitialIdx, setOpenInitialIdx] = useState(null);
  var [openEducationPilier, setOpenEducationPilier] = useState(null);
  var [mcTab, setMcTab] = useState('pour_vous');
  var [bilanEditMode, setBilanEditMode] = useState(!Array.isArray(tensionIdxs) || tensionIdxs.length === 0);
  var [showCreateProg, setShowCreateProg] = useState(false);
  var [savedPrograms, setSavedPrograms] = useState([]);
  var [searchQuery, setSearchQuery] = useState('');
  var [searchEtape, setSearchEtape] = useState(null);
  // Défi 7 jours « Libère ton dos » — cf. src/constants/challenge.js (flag enabled).
  var [showChallenge, setShowChallenge] = useState(false);
  // Duration filter — partagé entre l'onglet Explorer et Recherche.
  // Buckets : '5' (<=5min), '10' (6-10min), '1520' (15-20min), 'long' (>20min).
  var [durationFilter, setDurationFilter] = useState(null);

  // Helpers durée — partagés entre Explorer / Recherche.
  function _matchesDurationBucket(durationLabel, bucket) {
    if (!bucket) return true;
    var m = parseDurationMinutes(durationLabel);
    if (!m && m !== 0) return false;
    if (bucket === '5') return m > 0 && m <= 5;
    if (bucket === '10') return m > 5 && m <= 10;
    if (bucket === '1520') return m > 10 && m <= 20;
    if (bucket === 'long') return m > 20;
    return true;
  }
  // PERF (2026-07-23) : les calculs des onglets Recherche et Explorer sont
  // mémoïsés — avant, la double boucle piliers × séances (~160 items) était
  // reconstruite dans le render à CHAQUE frappe clavier et à chaque re-render.
  var searchResults = useMemo(function() {
    var seancesData = getSeances(lang);
    var results = [];
    getPiliers(lang).forEach(function(p) {
      var ps = seancesData[p.key] || [];
      ps.forEach(function(s, idx) {
        var titre = s[0] || '';
        var etape = s[2] || '';
        var matchQuery = !searchQuery || titre.toLowerCase().includes(searchQuery.toLowerCase());
        var matchEtape = !searchEtape || etape === searchEtape;
        var matchDur = _matchesDurationBucket(s[1], durationFilter);
        if (matchQuery && matchEtape && matchDur) {
          results.push({ seance: s, idx: idx, pilier: p });
        }
      });
    });
    return results;
  }, [lang, searchQuery, searchEtape, durationFilter]);

  var explorerData = useMemo(function() {
    var seancesData = getSeances(lang);
    var piliersAll = getPiliers(lang);
    var freeItems = (FREE_MONTHLY_SELECTION || []).map(function(item) {
      var p = piliersAll.find(function(x) { return x.key === item.pilier; });
      var seance = (seancesData[item.pilier] || [])[item.idx];
      if (!p || !seance) return null;
      return { pilier: p, idx: item.idx, titre: seance[0], duree: seance[1], etape: seance[2] };
    }).filter(Boolean).filter(function (it) {
      return _matchesDurationBucket(it.duree, durationFilter);
    });
    // Filter piliers to those containing at least one session matching the duration bucket.
    var piliersFiltered = piliersAll.filter(function (p) {
      if (!durationFilter) return true;
      var ps = seancesData[p.key] || [];
      for (var i = 0; i < ps.length; i++) {
        if (_matchesDurationBucket(ps[i] && ps[i][1], durationFilter)) return true;
      }
      return false;
    });
    return { freeItems: freeItems, piliersFiltered: piliersFiltered };
  }, [lang, durationFilter]);

  var DURATION_CHIPS = [
    { key: '5', labelFr: '5 min', labelEn: '5 min' },
    { key: '10', labelFr: '10 min', labelEn: '10 min' },
    { key: '1520', labelFr: '15-20 min', labelEn: '15-20 min' },
    { key: 'long', labelFr: '20 min +', labelEn: '20 min +' },
  ];
  function DurationChipsRow() {
    var isFrLang = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8, paddingRight: 6 }}>
        {DURATION_CHIPS.map(function (c) {
          var active = durationFilter === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              onPress={function () { setDurationFilter(active ? null : c.key); }}
              accessibilityLabel={(active ? (isFrLang ? 'Retirer le filtre ' : 'Remove filter ') : (isFrLang ? 'Filtrer ' : 'Filter ')) + (isFrLang ? c.labelFr : c.labelEn)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.12)',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#001226' : 'rgba(255,255,255,0.75)' }}>
                {isFrLang ? c.labelFr : c.labelEn}
              </Text>
            </TouchableOpacity>
          );
        })}
        {durationFilter ? (
          <TouchableOpacity
            onPress={function () { setDurationFilter(null); }}
            accessibilityLabel={(lang || 'fr').toLowerCase().indexOf('fr') === 0 ? 'Réinitialiser le filtre durée' : 'Reset duration filter'}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.18)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
              {(lang || 'fr').toLowerCase().indexOf('fr') === 0 ? 'Réinitialiser' : 'Reset'}
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{'×'}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    );
  }
  var [showBreathing, setShowBreathing] = useState(false);
  var [breathDoneToday, setBreathDoneToday] = useState(false);
  // Algorithmic programs: active row pulled from Supabase + screens
  // (MyPrograms list / ProgramBuilder flow). Both render inline rather
  // than as Modals so the existing tab bar stays hidden — same pattern
  // as the existing CreateProgramScreen modal swap, just full-screen.
  var [activeProgram, setActiveProgram] = useState(null);
  var [showMyPrograms, setShowMyPrograms] = useState(false);
  var [showProgramBuilder, setShowProgramBuilder] = useState(false);
  var [programRefreshTick, setProgramRefreshTick] = useState(0);
  // F1 — intention du jour (cold-start prompt + recommandation pilier).
  var [todayIntention, setTodayIntentionState] = useState(null);
  var [showIntentionPrompt, setShowIntentionPrompt] = useState(false);
  // F3 — milestone de streak fêtée (3/7/14/21/30/50/100).
  var [celebratedStreakN, setCelebratedStreakN] = useState(null);
  // Speir-inspired Lots iPhone — favoris live-updatable pour les rangées
  // "Mes favoris" + badges sur les cards. `favVersion` force un rerender
  // de la branche Pour vous quand un cœur est toggle ailleurs.
  var [favVersion, setFavVersion] = useState(0);
  // Section Hors-ligne iPhone : version cache téléchargements pour
  // rerender quand une séance est téléchargée/supprimée.
  var [dlVersion, setDlVersion] = useState(0);

  useEffect(function() { diag('MonCorps.mount', 'start'); loadSavedPrograms(); diag('MonCorps.mount', 'done'); }, []);

  useEffect(function() {
    if (IS_TV) return undefined; // TV : déjà câblé via TwoColLandingTV.
    var unsub = subscribeFavorites(function() { setFavVersion(function(v) { return v + 1; }); });
    return function() { try { if (unsub) unsub(); } catch (e) {} };
  }, []);

  useEffect(function() {
    if (IS_TV) return undefined; // TV : pas de downloads.
    var unsub = subscribeDownloads(function() { setDlVersion(function(v) { return v + 1; }); });
    return function() { try { if (unsub) unsub(); } catch (e) {} };
  }, []);

  useEffect(function() {
    var cancelled = false;
    getTodayIntention().then(function(intent) {
      if (cancelled) return;
      if (intent) { setTodayIntentionState(intent); return; }
      // Pas d'intention pour aujourd'hui — petit délai pour ne pas afficher
      // par-dessus l'éventuel onboarding/auth qui se monte juste après.
      setTimeout(function() { if (!cancelled) setShowIntentionPrompt(true); }, 900);
    }).catch(function() {});
    return function() { cancelled = true; };
  }, []);

  // F3 — détecte la transition vers une milestone (3/7/14/21/30/50/100).
  // On regarde si la milestone N n'a pas encore été célébrée (storage). Si
  // c'est le cas, on l'affiche puis on marque comme célébrée pour ne pas
  // re-afficher à chaque ouverture du même nombre.
  useEffect(function() {
    var cancelled = false;
    if (!streak) return undefined;
    shouldCelebrate(streak).then(function(go) {
      if (cancelled || !go) return;
      setCelebratedStreakN(streak);
      markCelebrated(streak);
    }).catch(function() {});
    return function() { cancelled = true; };
  }, [streak]);

  useEffect(function() {
    var cancelled = false;
    if (!supabase || !supaUser) { setActiveProgram(null); return; }
    getActiveProgram(supabase, supaUser.id).then(function(p) {
      if (!cancelled) setActiveProgram(p || null);
    });
    return function() { cancelled = true; };
  }, [supabase, supaUser && supaUser.id, programRefreshTick]);

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
    if (prog && prog.calendarProgramId) {
      try { calendarUtil.unscheduleProgram(prog.calendarProgramId); } catch(e) {}
    }
    var updated = savedPrograms.filter(function(_, i) { return i !== idx; });
    setSavedPrograms(updated);
    AsyncStorage.setItem('fluid_custom_programs', JSON.stringify(updated));
  }

  async function handleScheduleProgramInCalendar(idx) {
    if (Platform.OS !== 'ios') return;
    var prog = savedPrograms[idx];
    if (!prog) return;
    try {
      var prefs = await calendarUtil.getCalendarPrefs();
      if (!prefs || !prefs.enabled) {
        var granted = await calendarUtil.requestCalendarPermission();
        if (!granted) {
          Alert.alert('FluidBody', tr.calendar_permission_denied || "Permission refusée. Ouvre Réglages > Confidentialité > Calendriers pour autoriser Fluidbody.");
          return;
        }
        await calendarUtil.setCalendarPrefs({ enabled: true });
      }
      var calendarProgramId = prog.calendarProgramId || ('prog_' + (prog.date || Date.now()) + '_' + idx);
      var pilierLabelFor = function(k) {
        var p = getPiliers(lang).find(function(x) { return x.key === k; });
        return (p && p.label) || k;
      };
      var titleTemplate = function(pillarLabel) {
        var tpl = tr.calendar_event_title_template;
        if (typeof tpl === 'function') return tpl(pillarLabel);
        return 'Fluidbody — ' + pillarLabel;
      };
      var res = await calendarUtil.scheduleProgram({
        program: prog,
        programId: calendarProgramId,
        weeks: 4,
        pillarLabelFor: pilierLabelFor,
        titleTemplate: titleTemplate,
      });
      // Persist the calendarProgramId on the program so we can unschedule later.
      if (!prog.calendarProgramId) {
        prog.calendarProgramId = calendarProgramId;
        var updated = savedPrograms.slice();
        updated[idx] = Object.assign({}, prog);
        setSavedPrograms(updated);
        AsyncStorage.setItem('fluid_custom_programs', JSON.stringify(updated));
      }
      hapticSuccess();
      Alert.alert('FluidBody', (tr.calendar_added_count ? tr.calendar_added_count(res.count) : (res.count + ' séance(s) ajoutée(s) à ton agenda')));
    } catch (e) {
      sentryCaptureSafe(e, { where: 'handleScheduleProgramInCalendar' });
      Alert.alert('FluidBody', tr.calendar_error || 'Impossible de planifier les séances. Réessaie plus tard.');
    }
  }

  async function handleUnscheduleProgramInCalendar(idx) {
    if (Platform.OS !== 'ios') return;
    var prog = savedPrograms[idx];
    if (!prog || !prog.calendarProgramId) return;
    try {
      var n = await calendarUtil.unscheduleProgram(prog.calendarProgramId);
      var updated = savedPrograms.slice();
      var copy = Object.assign({}, prog);
      delete copy.calendarProgramId;
      updated[idx] = copy;
      setSavedPrograms(updated);
      AsyncStorage.setItem('fluid_custom_programs', JSON.stringify(updated));
      Alert.alert('FluidBody', (tr.calendar_removed_count ? tr.calendar_removed_count(n) : (n + ' événement(s) retiré(s)')));
    } catch (e) {}
  }
  // 'recherche' retiré de la capsule iPhone le 24/07 (choix Yvan : doublon
  // avec Bibliothèque/Pour toi) — l'écran reste rendu si mcTab === 'recherche'
  // et l'icône recherche du header TV est conservée. Bonus : 3 onglets =
  // capsule entière visible sans scroll horizontal.
  var MC_TABS = ['pour_vous', 'explorer', 'programmes' /* , 'live', 'recherche' */];
  // chromeScroll : le header (scrim + logo + capsule) sort par le haut quand
  // on scrolle vers le bas, revient au scroll vers le haut. Handler recréé à
  // chaque changement d'onglet (le ScrollView est remonté avec key={mcTab},
  // son offset repart à 0 — un lastY périmé déclencherait un faux masquage).
  var headerTranslateY = useRef(chromeAnim.interpolate({ inputRange: [0, 1], outputRange: [-220, 0] })).current;
  // Promo « charge d'entraînement » — même bannière que sur Activité, même
  // flag partagé (fermée à un endroit = fermée partout, via pub-sub).
  var effortPromo = useEffortPromo();
  var [showEffortWalkthrough, setShowEffortWalkthrough] = useState(false);
  var onChromeScroll = useMemo(function() { return createChromeScrollHandler(); }, [mcTab]);
  useEffect(function() { showChrome(); }, [mcTab]);
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

  // Inline full-screen swap for the algorithmic programs flow. ProgramBuilder
  // is rendered standalone (no MyPrograms wrap) when the user enters it from
  // the "Create" CTA on the MonCorps card — keeps that flow short.
  if (showProgramBuilder) {
    return (
      <ProgramBuilder
        lang={lang}
        supabase={supabase}
        supaUser={supaUser}
        onClose={function() { setShowProgramBuilder(false); setProgramRefreshTick(function(n) { return n + 1; }); }}
        onCreated={function() { setProgramRefreshTick(function(n) { return n + 1; }); }}
      />
    );
  }
  if (showMyPrograms) {
    return (
      <MyPrograms
        lang={lang}
        supabase={supabase}
        supaUser={supaUser}
        onClose={function() { setShowMyPrograms(false); setProgramRefreshTick(function(n) { return n + 1; }); }}
      />
    );
  }

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
      {!IS_TV && (
      /* Bloc header animé (chromeScroll) : scrim + logo + capsule sortent
         ensemble par le haut au scroll vers le bas, reviennent au scroll
         vers le haut. Les enfants gardent leurs positions absolues — le
         wrapper est à top:0 donc leurs coordonnées sont inchangées. */
      <Animated.View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 10, transform: [{ translateY: headerTranslateY }] }}
      >
      {/* Scrim header : dégradé fond → transparent sous logo + onglets.
          Sans lui, le contenu défile derrière la rangée logo (transparente)
          et se superpose au wordmark / pastille / prénom — illisible
          (retour Yvan 24/07). zIndex 4 : au-dessus du ScrollView (3),
          sous la capsule (5) et la rangée logo (10). Couleurs = haut de
          bgGradient pour un raccord invisible. */}
      <LinearGradient
        colors={['#000a1a', '#001527', 'rgba(0,26,46,0)']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 4 }}
        pointerEvents="none"
      />
      <View style={[localStyles.logoRow, { justifyContent: "space-between", paddingLeft: 20, paddingRight: 20, paddingTop: 10, marginBottom: 20, flexDirection: 'row', alignItems: 'center' }]} pointerEvents="box-none">
        {/* flexShrink:1 : sans lui la rangée déborde sur les écrans ≤ 390 pt
            et le prénom ("Bonjour Maelle") est poussé hors écran à droite. */}
        <Text style={[localStyles.logoWordmark, { flexShrink: 1 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: "900", color: "#AEEF4D", fontSize: 34 }}>+</AnimatedPlus>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 0 }}>
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
            {!HEADER_COMPACT ? (
            <Text style={{ fontSize: 12, fontWeight: '700', color: breathDoneToday ? '#AEEF4D' : 'rgba(255,255,255,0.86)', letterSpacing: 0.3 }}>
              {breathDoneToday ? (tr.breath_pill_done || 'Respiration faite') : (tr.breath_pill || 'Respirer 60s')}
            </Text>
            ) : null}
          </TouchableOpacity>
              );
            } catch (e) {
              if (__DEV__) console.warn('[breath-pill] render throw:', e);
              return null;
            }
          })()}
          {prenom ? (
            <TouchableOpacity
              onPress={function() { try { if (navigation) navigation.navigate(tr.tabs[3]); } catch(e) {} }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '300', color: 'rgba(174,239,77,0.6)' }}>{tr.bonjour(prenom)}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View style={{ position: "absolute", top: 105, left: 0, right: 0, zIndex: 5, marginTop: 20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {/* Style Apple Fitness+ (demande Yvan 25/07, capture fournie) :
              pastilles séparées au lieu de la capsule verre — l'active en
              blanc plein / texte noir, les inactives en gris sombre
              translucide sans bordure. Zéro BlurView ici = perf OK. */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {MC_TABS.map(function(t) {
              var active = mcTab === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={function() { setMcTab(t); }}
                  activeOpacity={0.85}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: active ? '#ffffff' : 'rgba(118,118,128,0.28)',
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: active ? "700" : "600", color: active ? "#000000" : "#ffffff" }}>
                    {mcTabLabels[t]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
      </Animated.View>)}
      <ScrollView
        key={mcTab}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 3 }}
        contentContainerStyle={{ paddingTop: 190, paddingBottom: 110, paddingHorizontal: 16, width: '100%', maxWidth: IS_IPAD ? CONTENT_MAX_W : undefined, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
        onScroll={onChromeScroll}
        scrollEventThrottle={16}
      >
        {/* Promo effort / charge d'entraînement — aussi sur l'écran
            d'ouverture (demande Yvan 25/07), onglet Pour vous uniquement.
            pad=0 : le contentContainer a déjà paddingHorizontal 16. */}
        {mcTab === 'pour_vous' && !IS_TV && effortPromo.visible ? (
          <EffortPromoBanner
            lang={lang}
            pad={0}
            onOpen={function() { setShowEffortWalkthrough(true); }}
            onDismiss={function() { effortPromo.dismiss(); }}
          />
        ) : null}
        {/* Active algorithmic program banner. Visible across all MonCorps
            tabs so the user always sees their journey. Tap → MyPrograms. */}
        {activeProgram && (function() {
          try {
            var stats = getProgramStats(activeProgram);
            var nextS = stats.nextSession;
            var nextPil = nextS && piliers.find(function(p) { return p.key === nextS.pilier_key; });
            var nextLabel = nextPil ? nextPil.label : (nextS ? nextS.pilier_key : '');
            var nextEtape = nextS && ((tr.etapes && tr.etapes[nextS.etape]) || nextS.etape);
            var wkLabel = (tr.program_week_label || 'Semaine') + ' ' + stats.currentWeek + '/' + activeProgram.duration_weeks;
            return (
              <TouchableOpacity
                onPress={function() { hapticLight(); setShowMyPrograms(true); }}
                activeOpacity={0.9}
                style={{ marginBottom: 14, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(174,239,77,0.5)', backgroundColor: 'rgba(174,239,77,0.10)' }}
              >
                <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(174,239,77,0.18)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#AEEF4D' }}>{stats.percent}%</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#AEEF4D', letterSpacing: 0.6 }}>
                      {(tr.program_active_tag || 'PROGRAMME ACTIF') + ' · ' + wkLabel}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: '#ffffff', marginTop: 2 }}>
                      {activeProgram.name || (tr.program_default_name || 'Programme')}
                    </Text>
                    {nextS ? (
                      <Text numberOfLines={1} style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                        {(tr.program_next_label || 'Prochaine séance') + ' : ' + nextLabel + (nextEtape ? ' · ' + nextEtape : '')}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 20, color: '#AEEF4D', fontWeight: '300' }}>{'›'}</Text>
                </View>
              </TouchableOpacity>
            );
          } catch (e) {
            if (__DEV__) console.warn('[active-program-banner] render throw:', e);
            return null;
          }
        })()}
        {mcTab === 'explorer' && sdj && (
          <TouchableOpacity onPress={function() { if (onTryFreeSession) onTryFreeSession(); }} activeOpacity={0.9} style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#AEEF4D' }}>
            <View style={{ height: ipadH(110) }}>
              {/* getSeanceImage (pas PILIER_IMAGES) : évite la même photo que
                  la card gratuite p2 et la pilier card juste en dessous. */}
              <Image source={getSeanceImage(sdj.pilier.key, sdj.idx)} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-sdj-' + sdj.pilier.key + '-' + sdj.idx} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.85)']} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Text style={{ fontSize: 20, color: '#000000' }}>{'\u25B6'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <View style={{ backgroundColor: '#FF3B30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff', letterSpacing: 1 }}>{(pickBadge({ isNew: true, lang: lang }) || {}).label || 'NOUVEAU'}</Text>
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
          if (IS_TV) {
            // Apple TV : "Pour vous" est rendu en plein écran style Fitness+
            // par un overlay haut-zIndex en fin de composant (cf. plus bas) —
            // pas ici dans le scroll. On ne rend donc rien dans la branche
            // tab pour éviter un double rendu / des focusables fantômes.
            return null;
          }
          var gridGap = 6;
          var fullW = CW - 32;
          var halfW = Math.floor((fullW - gridGap) / 2);
          var thirdW = Math.floor((fullW - gridGap * 2) / 3);
          var rowH1 = Math.floor(halfW * 0.72);
          var rowH2 = Math.floor(thirdW * 0.82);
          // Mosaïque décorative (aucun onPress) — retour Sabrina 25/07 :
          // « pas d'homogénéité ». 100 % série STUDIO (lumière claire, tons
          // marine/blanc/bois), sélection dynamique (mouvement plutôt que
          // portraits assis) ; golf/chalet restent sur les cards Explorer.
          // Invariant anti-doublon : uniquement des canoniques PILIER_IMAGES
          // ou des photos retirées des variantes (sabrina_2, sabrina_6,
          // sabrina_15), jamais servies par getSeanceImage.
          var mosaicImages = [
            PILIER_IMAGES.p1, require('../../assets/coach/sabrina_2.jpg'),
            require('../../assets/coach/sabrina_15.jpg'), PILIER_IMAGES.p5, PILIER_IMAGES.p9,
            PILIER_IMAGES.p2, require('../../assets/coach/sabrina_6.jpg'),
          ];
          // Style Fitness+ (demande Yvan 25/07, capture fournie) : cells
          // nues — pas de bordure verre ni de reflet, juste l'image avec un
          // radius modéré, collage serré.
          var glassCell = function(src, w, h, key) {
            return (
              <View key={key} style={{ width: w, height: h, borderRadius: 14, overflow: 'hidden' }}>
                <Image source={src} contentFit="cover" transition={200} cachePolicy="memory-disk" style={{ flex: 1 }} />
                {/* Voile sombre uniforme (référence Fitness+, retour Sabrina
                    25/07) : c'est ce voile qui homogénéise l'expo et les
                    couleurs des 7 photos, quel que soit le cliché. */}
                <LinearGradient colors={['rgba(2,18,28,0.22)', 'rgba(2,18,28,0.52)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
              </View>
            );
          };
          var intent = todayIntention ? findIntention(todayIntention) : null;
          var intentPilierKey = todayIntention ? getPilierKeyForIntention(todayIntention) : null;
          var intentPilier = intentPilierKey ? piliers.find(function(p) { return p.key === intentPilierKey; }) : null;

          // (La section "Hors-ligne" a déménagé dans Profil > Mes téléchargements
          // pour ne pas surcharger Pour vous.)

          // Rangée "Mes favoris" iPhone — items dérivés du cache synchrone.
          // Hidden si 0 favori. favVersion (dans une useEffect ailleurs) force
          // un rerender quand un cœur est toggle.
          // eslint-disable-next-line no-unused-vars
          var _favTick = favVersion;
          var seancesByKey = getSeances(lang);

          // Rangée "Cette semaine" iPhone (Lot 4) — 7 séances suggérées sur
          // les 7 prochains jours. Biais intention si l'utilisateur a une
          // intention du jour. Cards avec badge LUN/MAR/... en top-left.
          var weekSchedule = getThisWeekSchedule(piliers, seancesByKey, { intentionKey: todayIntention, lang: lang });
          var weekItems = weekSchedule.map(function(e) {
            return {
              key: 'wk_' + e.dayIdx + '_' + e.pilier.key + '_' + e.idx,
              title: e.seance[0],
              subtitle: e.seance[1] + ' · ' + e.pilier.label,
              image: getSeanceImage(e.pilier.key, e.idx),
              badge: { label: e.dayLabel, tone: 'white' },
              pilier: e.pilier,
              idx: e.idx,
            };
          });
          var favItems = [];
          var favIds = getCachedFavorites() || [];
          for (var i = 0; i < favIds.length; i++) {
            var id = favIds[i];
            var us = id.lastIndexOf('_');
            if (us < 1) continue;
            var pk = id.slice(0, us);
            var sIdx = parseInt(id.slice(us + 1), 10);
            if (Number.isNaN(sIdx)) continue;
            var pil = piliers.find(function(p) { return p.key === pk; });
            var s = pil && seancesByKey[pk] && seancesByKey[pk][sIdx];
            if (!pil || !s) continue;
            favItems.push({
              key: 'fav_' + id,
              title: s[0],
              subtitle: s[1] + ' · ' + pil.label,
              image: getSeanceImage(pk, sIdx),
              badge: pickBadge({ pilierKey: pk, idx: sIdx, lang: lang, isFavorite: true }),
              pilier: pil,
              idx: sIdx,
            });
            if (favItems.length >= 12) break;
          }
          return (
            <View key="pour-vous">
              {intent && intentPilier ? (
                <TouchableOpacity
                  onPress={function() { setOpenPilier(intentPilier); }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={(tr.intention_aujourdhui || "Intention du jour") + " : " + (lang === 'fr' ? intent.labelFr : intent.labelEn) + " → " + intentPilier.label}
                  style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.42)', marginBottom: 12 }}
                >
                  <Icon name={intent.iconKey || 'sparkle'} size={16} color="#AEEF4D" />
                  <Text style={{ fontSize: 11, color: '#AEEF4D', fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>{tr.intention_aujourdhui || 'Intention'}</Text>
                  <Text style={{ fontSize: 13, color: '#ffffff', fontWeight: '600' }}>{lang === 'fr' ? intent.labelFr : intent.labelEn}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{'·'}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: '500' }}>{intentPilier.label}</Text>
                  <Text style={{ fontSize: 14, color: '#AEEF4D', fontWeight: '300', marginLeft: 2 }}>{'›'}</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={{ fontSize: 13, fontWeight: '500', fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.1, marginBottom: 14, paddingHorizontal: 4 }}>« {getDailyQuote()} »  <Text style={{ color: '#AEEF4D', fontWeight: '700', fontStyle: 'normal' }}>Sabrina</Text></Text>
              {/* Défi 7 jours « Libère ton dos » — n'apparaît que quand
                  CHALLENGE_7J.enabled est true (vidéos en ligne). */}
              {CHALLENGE_7J.enabled ? (function() {
                var cdCount = challengeDoneCount(done);
                var cdNext = challengeNextDay(done);
                var cdDone = cdNext === -1;
                return (
                  <TouchableOpacity
                    onPress={function() { hapticLight(); setShowChallenge(true); }}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel={(lang === 'fr' ? 'Défi 7 jours — Libère ton dos, jour ' : '7-day challenge — Free your back, day ') + Math.min(cdCount + 1, 7)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, marginBottom: 14, backgroundColor: 'rgba(174,239,77,0.10)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.5)' }}
                  >
                    <MeduseCornerIcon size={40} tint="rgba(174,239,77,1)" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#AEEF4D', letterSpacing: 1.5, textTransform: 'uppercase' }}>{lang === 'fr' ? 'Défi 7 jours' : '7-day challenge'}</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff', marginTop: 2 }}>{lang === 'fr' ? 'Libère ton dos' : 'Free your back'}</Text>
                    </View>
                    <View style={{ backgroundColor: cdDone ? '#AEEF4D' : 'rgba(255,255,255,0.10)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: cdDone ? '#001226' : '#ffffff' }}>{cdDone ? '🏆 7/7' : cdCount + '/7'}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })() : null}
              {/* Collage + bloc abonnement fondu dedans (layout Fitness+,
                  demande Yvan 25/07 : « l'option d'abonnement sur les images
                  comme Apple »). Le dégradé absorbe les rangées 2-3 ; le
                  contenu (titre/CTA/prix) se superpose au bas du collage.
                  Bloc affiché pour TOUT LE MONDE (leçon f7aa154 : ne pas le
                  masquer pour les abonnés, Yvan-admin croit à un bug). */}
              <View style={{ position: 'relative', marginBottom: 8 }}>
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
                <LinearGradient
                  colors={['rgba(4,22,32,0)', 'rgba(4,22,32,0.55)', 'rgba(4,22,32,0.92)', 'rgba(4,22,32,0.99)']}
                  locations={[0, 0.32, 0.62, 1]}
                  style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: Math.floor(rowH1 * 0.55), justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 18 }}
                >
                  <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', textAlign: 'center', letterSpacing: -0.4, lineHeight: 31, marginBottom: 8 }}>{tr.paywall_title}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.72)', textAlign: 'center', lineHeight: 19, marginBottom: 16 }}>{tr.paywall_sub}</Text>
                  <TouchableOpacity
                    onPress={function() { onActivateSubscription && onActivateSubscription(); }}
                    activeOpacity={0.85}
                    style={{ alignSelf: 'stretch', backgroundColor: '#AEEF4D', borderRadius: 26, paddingVertical: 15, alignItems: 'center', marginBottom: 10 }}
                  >
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#001226' }}>{tr.paywall_start}</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>{"CHF 12.90" + (tr.paywall_per_month || '/mois')}</Text>
                  <TouchableOpacity onPress={function() { onActivateSubscription && onActivateSubscription(); }} activeOpacity={0.8}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>{tr.paywall_yearly_link}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
              {/* Rangée "Mes favoris" iPhone (Lot 2 Speir-inspired) — hidden
                  si l'utilisateur n'a aucun cœur. Tap → ouvre la séance
                  directement via setOpenInitialIdx + setOpenPilier. */}
              {favItems.length > 0 ? (
                <SeanceCarouselRow
                  title={lang === 'fr' ? 'Mes favoris' : 'My favorites'}
                  items={favItems}
                  onItemPress={function(it) { setOpenInitialIdx(it.idx); setOpenPilier(it.pilier); }}
                />
              ) : null}
              {/* Rangée "Cette semaine" iPhone (Lot 4) — planification 7 jours
                  biaisée par l'intention du jour. Badge LUN/MAR/... blanc. */}
              {weekItems.length > 0 ? (
                <SeanceCarouselRow
                  title={lang === 'fr' ? 'Cette semaine' : 'This week'}
                  items={weekItems}
                  onItemPress={function(it) { setOpenInitialIdx(it.idx); setOpenPilier(it.pilier); }}
                />
              ) : null}
              {/* (Carte abonnement déplacée : elle est désormais fondue dans
                  le collage ci-dessus, layout Fitness+ — commit du 25/07.) */}
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
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2 }}>{tr.bilan_program_title || 'Ton programme personnalisé'}</Text>
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
                          style={{ height: ipadH(92), borderRadius: 16, overflow: 'hidden' }}
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
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, height: ipadH(160), borderWidth: 1, borderColor: '#AEEF4D' }}>
              <View style={{ flex: 1 }}>
                <Image source={PROG_IMAGES.reveil} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey="mc-prog-reveil" style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1, padding: 16, justifyContent: "space-between", backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_reveil || 'Réveil Matinal'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>{tr.prog_reveil_sub || '10 min pour réveiller ton corps en douceur'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#AEEF4D", letterSpacing: 1 }}>{tr.prog_reveil_duree || '7 JOURS · 10 MIN/JOUR'}</Text>
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
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, height: ipadH(160), borderWidth: 1, borderColor: '#AEEF4D' }}>
              <View style={{ flex: 1 }}>
                <Image source={PROG_IMAGES.dos} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey="mc-prog-dos" style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1, padding: 16, justifyContent: "space-between", backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_dos || 'Mal de dos'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>{tr.prog_dos_sub || 'Soulage et renforce ton dos en 21 jours'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#AEEF4D", letterSpacing: 1 }}>{tr.prog_dos_duree || '21 JOURS · 15 MIN/JOUR'}</Text>
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
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, height: ipadH(160), borderWidth: 1, borderColor: '#AEEF4D' }}>
              <View style={{ flex: 1 }}>
                <Image source={PROG_IMAGES.posttravail} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey="mc-prog-pt" style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1, padding: 16, justifyContent: "space-between", backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_posttravail || 'Post-travail'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>{tr.prog_posttravail_sub || 'Décompresse après une journée assise'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#AEEF4D", letterSpacing: 1 }}>{tr.prog_posttravail_duree || '5 JOURS · 15 MIN/JOUR'}</Text>
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
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, height: ipadH(160), borderWidth: 1, borderColor: '#AEEF4D' }}>
              <View style={{ flex: 1 }}>
                <Image source={PROG_IMAGES.core} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey="mc-prog-core" style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1, padding: 16, justifyContent: "space-between", backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_core || 'Core & Plancher'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>{tr.prog_core_sub || 'Renforce ton centre et ta stabilité'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#AEEF4D", letterSpacing: 1 }}>{tr.prog_core_duree || '14 JOURS · 12 MIN/JOUR'}</Text>
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
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 14, height: ipadH(160), borderWidth: 1, borderColor: '#AEEF4D' }}>
              <View style={{ flex: 1 }}>
                <Image source={PROG_IMAGES.souplesse} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey="mc-prog-soup" style={StyleSheet.absoluteFill} />
                <View style={{ flex: 1, padding: 16, justifyContent: "space-between", backgroundColor: 'rgba(0,0,0,0.45)' }}>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_souplesse || 'Souplesse totale'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>{tr.prog_souplesse_sub || 'Gagne en mobilité sur tout le corps'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#AEEF4D", letterSpacing: 1 }}>{tr.prog_souplesse_duree || '14 JOURS · 20 MIN/JOUR'}</Text>
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

            {/* Algorithmic programs entry — only when Supabase is reachable.
                Without supabase/supaUser the new feature has no backing store
                and we hide it rather than showing a dead card. */}
            {supabase && supaUser ? (
              <View style={{ marginTop: 24 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 6 }}>{tr.program_section_title || 'Programmes intelligents'}</Text>
                <Text style={{ fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.45)', lineHeight: 18, marginBottom: 14 }}>{tr.program_section_sub || 'Plans personnalisés sur 2 à 12 semaines, générés à partir de tes objectifs.'}</Text>
                <View style={{ borderRadius: 16, overflow: 'hidden', height: 230, borderWidth: 1, borderColor: '#AEEF4D' }}>
                  <LinearGradient colors={["#0a1f1a", "#0f3a30", "#1ea585"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
                    <View>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 4 }}>{tr.program_smart_card || 'Programme intelligent'}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.7)', lineHeight: 18 }}>{tr.program_smart_card_sub || 'Tonifier, posture, souplesse, sérénité — choisis ton cap et on construit le parcours.'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={function() { hapticLight(); setShowProgramBuilder(true); }}
                        activeOpacity={0.85}
                        style={{ flex: 1, height: 38, borderRadius: 19, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#000' }}>{tr.program_create_btn || 'Créer'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={function() { hapticLight(); setShowMyPrograms(true); }}
                        activeOpacity={0.85}
                        style={{ flex: 1, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>{tr.program_mine_btn || 'Mes programmes'}</Text>
                      </TouchableOpacity>
                    </View>
                  </LinearGradient>
                </View>
              </View>
            ) : null}

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
                      {Platform.OS === 'ios' && (
                        <TouchableOpacity
                          onPress={function() {
                            if (prog.calendarProgramId) handleUnscheduleProgramInCalendar(idx);
                            else handleScheduleProgramInCalendar(idx);
                          }}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={prog.calendarProgramId ? (tr.calendar_unschedule_btn || 'Retirer de mon agenda') : (tr.calendar_schedule_btn || 'Planifier dans mon agenda')}
                          style={{ marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: prog.calendarProgramId ? 'rgba(255,255,255,0.06)' : 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: prog.calendarProgramId ? 'rgba(255,255,255,0.18)' : 'rgba(174,239,77,0.4)' }}
                        >
                          <Text style={{ fontSize: 13, color: prog.calendarProgramId ? 'rgba(255,255,255,0.85)' : '#AEEF4D', fontWeight: '700' }}>
                            {prog.calendarProgramId
                              ? (tr.calendar_unschedule_btn || 'Retirer de mon agenda')
                              : (tr.calendar_schedule_btn || 'Planifier dans mon agenda')}
                          </Text>
                          <Text style={{ fontSize: 13, color: prog.calendarProgramId ? 'rgba(255,255,255,0.85)' : '#AEEF4D' }}>{'\u2192'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
        {mcTab === 'explorer' && (function() {
          var seancesData = getSeances(lang);
          // Sur Apple TV (1920×1080 ou plus), une card occupant 45 % de la
          // largeur écran est trop grande et perd le confort de scan visuel
          // à 2-3 m. On bascule à des dims pensées pour le focus engine.
          var cardH = IS_TV ? 320 : Math.floor(CW * 0.45);
          var freeCardW = IS_TV ? 380 : Math.round(CW * 0.62);
          var freeCardH = IS_TV ? 440 : Math.round(freeCardW * 1.15);
          // PERF : mémoïsés en tête de composant (explorerData).
          var freeItems = explorerData.freeItems;
          var piliersFiltered = explorerData.piliersFiltered;
          return (
            <View key="explorer-sections">
              <DurationChipsRow />
              {freeItems.length > 0 && (
                <View style={{ marginBottom: 24, marginHorizontal: -16 }}>
                  <View style={{ paddingHorizontal: 22, marginBottom: 12 }}>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.3, marginBottom: 4 }}>{tr.explore_free_title || 'Sélection gratuite du mois'}</Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{tr.explore_free_sub || 'Essayez ces séances gratuitement, sans abonnement'}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                    {freeItems.map(function(it, i) {
                      return (
                        <FocusableCard
                          key={"free-" + it.pilier.key + "-" + it.idx}
                          onPress={function() { setOpenInitialIdx(it.idx); setOpenPilier(it.pilier); }}
                          focusPreferred={i === 0}
                          accent="green"
                          style={{ width: freeCardW, height: freeCardH, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(174,239,77,0.25)' }}
                        >
                          <View style={{ flex: 1 }}>
                            <Image source={getSeanceImage(it.pilier.key, it.idx)} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-it-' + it.pilier.key + '-' + it.idx} style={StyleSheet.absoluteFill} />
                            <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0.60)', 'rgba(0,0,0,0.80)', 'rgba(0,0,0,0.92)']} locations={[0, 0.3, 0.5, 0.7, 0.85, 1]} style={{ flex: 1, padding: IS_TV ? 22 : 16, justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ backgroundColor: '#AEEF4D', borderRadius: IS_TV ? 10 : 8, paddingHorizontal: IS_TV ? 12 : 9, paddingVertical: IS_TV ? 6 : 4 }}>
                                  <Text style={{ fontSize: IS_TV ? 12 : 9, fontWeight: '900', color: '#000', letterSpacing: 1.5 }}>{tr.gratuit_badge || 'GRATUIT'}</Text>
                                </View>
                                <Text style={{ fontSize: IS_TV ? 14 : 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: IS_TV ? 1.5 : 0 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, color: '#AEEF4D' }}>+</AnimatedPlus></Text>
                              </View>
                              <View>
                                <Text style={{ fontSize: IS_TV ? 13 : 10, color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, fontWeight: '700' }}>{(tr.etapes && tr.etapes[it.etape]) || it.etape} · {it.pilier.label}</Text>
                                <Text style={{ fontSize: IS_TV ? 26 : 19, fontWeight: IS_TV ? '600' : '800', color: '#ffffff', lineHeight: IS_TV ? 30 : 23, marginBottom: 12, letterSpacing: IS_TV ? -0.3 : 0 }} numberOfLines={2}>{it.titre}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                  <View style={{ width: IS_TV ? 42 : 32, height: IS_TV ? 42 : 32, borderRadius: IS_TV ? 21 : 16, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: IS_TV ? 17 : 13, color: '#000' }}>{'▶'}</Text>
                                  </View>
                                  <Text style={{ fontSize: IS_TV ? 15 : 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)', letterSpacing: IS_TV ? 0.5 : 0 }}>{it.duree}</Text>
                                </View>
                              </View>
                            </LinearGradient>
                          </View>
                        </FocusableCard>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {piliersFiltered.length === 0 && durationFilter ? (
                <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 30, fontSize: 14 }}>
                  {(lang || 'fr').toLowerCase().indexOf('fr') === 0 ? 'Aucun pilier avec cette durée' : 'No pillar with this duration'}
                </Text>
              ) : null}
              {piliersFiltered.map(function(p, pi) {
                var ps = seancesData[p.key] || [];
                var doneCount = done[p.key] ? done[p.key].filter(Boolean).length : 0;
                // Sur TV : si pas de bandeau "gratuit du mois" au-dessus, la
                // première pilier card prend le focus initial.
                var preferred = pi === 0 && freeItems.length === 0;
                return (
                  <FocusableCard
                    key={"exp-" + p.key}
                    onPress={function() {
                      if (!isSubscriber) { onActivateSubscription && onActivateSubscription(); return; }
                      setOpenPilier(p);
                    }}
                    focusPreferred={preferred}
                    accent="cyan"
                    style={{ marginBottom: IS_TV ? 22 : 16, borderRadius: 18, overflow: "hidden", height: cardH }}
                  >
                    <View style={{ flex: 1 }}>
                      <Image source={PILIER_IMAGES[p.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-pcardbig-' + p.key} style={[StyleSheet.absoluteFill, p.key === 'p8' ? { top: -20, transform: [{ scale: 1.15 }] } : { transform: [{ scale: 1.15 }] }]} />
                      {/* Gradient with 6 stops to avoid banding on 1080p+ TVs */}
                      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.65)", "rgba(0,0,0,0.85)"]} locations={[0, 0.32, 0.5, 0.68, 0.85, 1]} style={{ flex: 1, justifyContent: "flex-end", padding: IS_TV ? 28 : 16 }}>
                        <Text style={{ fontSize: IS_TV ? 36 : 24, fontWeight: IS_TV ? "300" : "800", color: "#ffffff", marginBottom: 6, letterSpacing: IS_TV ? -0.6 : 0 }}>{p.label}</Text>
                        <Text style={{ fontSize: IS_TV ? 16 : 12, color: "rgba(255,255,255,0.65)", letterSpacing: IS_TV ? 1.5 : 0 }}>{(ps.length || 20) + ' ' + tr.m_seances}</Text>
                      </LinearGradient>
                    </View>
                  </FocusableCard>
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
                  <View style={{ height: ipadH(150) }}>
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
                          <Icon name="bell" size={14} color="#AEEF4D" />
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
          var halfW = (CW - 52) / 2;
          var allResults = searchResults; // PERF : mémoïsé en tête de composant.
          return (
            <View>
              {/* Search bar — Liquid Glass capsule */}
              <View style={{ marginBottom: 14 }}>
                <LiquidGlassCapsule tint="light" radius={16} paddingH={14} paddingV={8} gap={8}>
                  <Icon name="search" size={16} color="rgba(255,255,255,0.45)" />
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
              {/* Durée filter chips */}
              <DurationChipsRow />
              {/* Étape filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {['Comprendre', 'Ressentir', 'Préparer', 'Exécuter', 'Évoluer'].map(function(etape) {
                  var active = searchEtape === etape;
                  return (
                    <TouchableOpacity key={etape} onPress={function() { setSearchEtape(active ? null : etape); }}
                      style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.08)', marginRight: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#001226' : 'rgba(255,255,255,0.6)' }}>{(tr.etapes && tr.etapes[etape]) || etape}</Text>
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
                      style={{ width: halfW, height: ipadH(140), borderRadius: 14, overflow: 'hidden', marginBottom: 2 }}>
                      <View style={{ flex: 1 }}>
                        <Image source={PILIER_IMAGES[r.pilier.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" recyclingKey={'mc-r-' + r.pilier.key} style={StyleSheet.absoluteFill} />
                        <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.8)']} style={{ flex: 1, justifyContent: 'space-between', padding: 10 }}>
                          <View style={{ flexDirection: 'row' }}>
                            {etape ? (
                              <View style={{ backgroundColor: etapeColor, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: '#001226' }}>{(tr.etapes && tr.etapes[etape]) || etape}</Text>
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
      <EffortPromoWalkthrough
        visible={showEffortWalkthrough}
        lang={lang}
        onDone={function() { setShowEffortWalkthrough(false); effortPromo.dismiss(); }}
      />
      {openPilier && (IS_TV ? (
        <PilierPanelTV pilier={openPilier} done={done[openPilier.key] || Array(20).fill(false)} onToggle={function(idx) { toggleDone(openPilier.key, idx); }} onClose={function() { setOpenPilier(null); setOpenInitialIdx(null); }} lang={lang} isRecommended={effectiveRecommended.includes(openPilier.key)} isSubscriber={isSubscriber} onActivateSubscription={onActivateSubscription} sdjIndex={sdj && sdj.pilier && sdj.pilier.key === openPilier.key ? sdj.idx : null} saveHealthKitWorkout={saveHealthKitWorkout} initialSeanceIdx={openInitialIdx} />
      ) : (
        <PilierPanel pilier={openPilier} done={done[openPilier.key] || Array(20).fill(false)} onToggle={function(idx) { toggleDone(openPilier.key, idx); }} onClose={function() { setOpenPilier(null); setOpenInitialIdx(null); }} lang={lang} isRecommended={effectiveRecommended.includes(openPilier.key)} isSubscriber={isSubscriber} onActivateSubscription={onActivateSubscription} sdjIndex={sdj && sdj.pilier && sdj.pilier.key === openPilier.key ? sdj.idx : null} saveHealthKitWorkout={saveHealthKitWorkout} initialSeanceIdx={openInitialIdx} />
      ))}
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

      <ChallengeModal
        visible={showChallenge}
        onClose={function() { setShowChallenge(false); }}
        lang={lang}
        done={done}
        isSubscriber={isSubscriber}
        onActivateSubscription={onActivateSubscription}
        onOpenSeance={function(pilierKey, idx) {
          var target = piliers.find(function(x) { return x.key === pilierKey; });
          if (!target) return;
          setShowChallenge(false);
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

      {/* ───────── Apple TV — backdrop "monde" ─────────
          Sur "Pour vous" : le vrai fond animé Fluidbody (dégradé turquoise →
          esthétique splash iPhone (navy → teal + 1-2 méduses à halo + qq
          bulles), via AquaticBackground. MÊME fond sur TOUS les onglets TV
          pour la cohérence (Yvan : "ce fond sur toutes les pages").
          Persistant derrière tous les overlays TV (z50). */}
      {IS_TV && !openPilier ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
          <AquaticBackground density="rich" contentOpacity={0.9} />
        </View>
      ) : null}

      {/* ───────── Apple TV — "Pour vous" plein écran style Fitness+ ─────────
          Overlay haut-zIndex qui recouvre tout le chrome iPhone (logoRow +
          tabs masqués sur TV). Le PilierPanel est un Modal → s'affiche au
          dessus quand une séance s'ouvre. */}
      {IS_TV && !openPilier && mcTab === 'pour_vous' ? (
        <TwoColLandingTV
          piliers={piliers}
          lang={lang}
          seancesByKey={getSeances(lang)}
          onPrimary={function() { var f = (sdj && sdj.pilier) || piliers[0]; if (f) setOpenPilier(f); }}
          onOpenPilier={setOpenPilier}
          onOpenSeance={function(p, idx) { setOpenInitialIdx(typeof idx === 'number' ? idx : null); setOpenPilier(p); }}
          onResume={function(p, idx) { setOpenInitialIdx(typeof idx === 'number' ? idx : null); setOpenPilier(p); }}
        />
      ) : null}
      {IS_TV && !openPilier && mcTab === 'explorer' ? (
        <ExplorerTV piliers={piliers} seancesByKey={getSeances(lang)} onOpenPilier={setOpenPilier} onActivateSubscription={onActivateSubscription} lang={lang} />
      ) : null}
      {IS_TV && !openPilier && mcTab === 'programmes' ? (
        <ProgrammesTV piliers={piliers} lang={lang} activeProgram={activeProgram} seancesByKey={getSeances(lang)} onOpenPilier={setOpenPilier} onOpenSeance={function(p, idx) { setOpenInitialIdx(typeof idx === 'number' ? idx : null); setOpenPilier(p); }} />
      ) : null}
      {IS_TV && !openPilier && mcTab === 'activite' ? (
        <StatsTV mode="activity" done={done} streak={streak} piliers={piliers} lang={lang} />
      ) : null}
      {IS_TV && !openPilier && mcTab === 'resume' ? (
        <StatsTV mode="resume" done={done} streak={streak} piliers={piliers} lang={lang} />
      ) : null}
      {IS_TV && !openPilier && mcTab === 'biblio' ? (
        <BibliothequeTV piliers={piliers} seancesByKey={getSeances(lang)} done={done} onOpenPilier={setOpenPilier} onOpenSeance={function(p, idx) { setOpenInitialIdx(typeof idx === 'number' ? idx : null); setOpenPilier(p); }} lang={lang} />
      ) : null}
      {IS_TV && !openPilier && mcTab === 'recherche' ? (
        <RechercheTV piliers={piliers} seancesByKey={getSeances(lang)} onOpenPilier={setOpenPilier} onOpenSeance={function(p, idx) { setOpenInitialIdx(typeof idx === 'number' ? idx : null); setOpenPilier(p); }} lang={lang} />
      ) : null}
      {/* (Ancien : `mcTab === 'respire'` rendait BreathingCheckIn. Le nouveau
          header utilise une pill modale → cette branche n'a plus de sens.) */}
      {IS_TV && !openPilier ? (
        <TVHeaderBar
          tabs={[
            { key: 'pour_vous', label: tr.tab_pour_vous || 'Pour vous' },
            { key: 'explorer', label: tr.tab_explorer || 'Explorer' },
            { key: 'programmes', label: tr.tab_programmes || 'Programmes' },
            // Le tab "Respiration" n'agit pas comme une section navigable —
            // au tap il déclenche la modal BreathingCheckIn (raccourci redondant
            // avec la pill centrale, par demande Yvan). Mêmes méduses + bulles
            // que sur iPhone, ajoutées en foreground dans BreathingCheckIn.
            { key: 'respiration', label: tr.tab_respiration || 'Respiration', icon: TVHeaderBreathIcon, modal: true },
            { key: 'recherche', icon: TVHeaderSearchIcon },
          ]}
          activeKey={mcTab}
          onSelectTab={function(k) {
            if (k === 'respiration') { setShowBreathing(true); return; }
            setMcTab(k);
          }}
          prenom={prenom}
          onOpenProfile={onOpenProfile}
          onOpenBreathing={function() { setShowBreathing(true); }}
          breathDone={breathDoneToday}
          lang={lang}
        />
      ) : null}
      {/* BreathingCheckIn modal — déclenché par la pill Respirer du header TV. */}
      {IS_TV && showBreathing ? (
        <BreathingCheckIn visible onClose={function() { setShowBreathing(false); }} lang={lang} />
      ) : null}
      <DailyIntentionPrompt
        visible={showIntentionPrompt}
        lang={lang}
        onPicked={function(key) { setTodayIntentionState(key); setShowIntentionPrompt(false); }}
        onClose={function() { setShowIntentionPrompt(false); }}
      />
      <StreakCelebration
        visible={celebratedStreakN != null}
        streak={celebratedStreakN || 0}
        lang={lang}
        onClose={function() { setCelebratedStreakN(null); }}
      />
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
