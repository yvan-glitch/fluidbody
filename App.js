import 'react-native-url-polyfill/auto';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, Animated, Easing, View, TouchableOpacity, Pressable, ScrollView, TextInput, Dimensions, Alert, Modal, Platform, AppState, KeyboardAvoidingView, ImageBackground, PanResponder, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ErrorBoundary } from './components/ErrorBoundary';
// RevenueCat (achats Apple) — indisponible dans Expo Go, donc import "safe"
let Purchases = null;
try {
  const M = require('react-native-purchases');
  Purchases = M?.default || M;
} catch (e) {}
// Notifications optionnelles — package peut ne pas être installé
let Notifications = null;
let Device = null;
let HapticsMod = null;
try { Notifications = require('expo-notifications'); } catch(e) {}
try { Device = require('expo-device'); } catch(e) {}
try { HapticsMod = require('expo-haptics'); } catch(e) {}
let AppleHealthKit = null;
try { AppleHealthKit = require('react-native-health').default; } catch(e) {}
import { useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Path, Circle, Ellipse, Line, Rect, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import { Video, ResizeMode, Audio } from 'expo-av';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ViewShot from 'react-native-view-shot';
import { U_JELLY, U_WAVE, FREE_SEANCE_INDEX, ZONE_TO_PILIER, T, SEANCES_FR, SEANCES_EN, SEANCES_ES, SEANCES_IT, SEANCES_DE, SEANCES_PT, SEANCES_ZH, SEANCES_JA, SEANCES_KO, PILIERS_BASE, PILIER_IMAGES } from './src/constants/data';
import { Linking as RNLinking } from 'react-native';
import { Bulle, Rayon, Meduse, MeduseCornerIcon, VideoPlaceholderMeduse, BULLES, BULLES_MONCORPS, BULLES_ONBOARDING, MEDUSA_STATES, MEDUSA_STATE_NAMES, getMeduseState, LivingMedusa, FloatingMedusas } from './src/components/Meduse';
import VideoPlayer, { VIDEO_RESUME_PREFIX } from './src/components/VideoPlayer';
import PaywallModal, { PRODUCT_IDS } from './src/components/PaywallModal';
import StretchTimerModal from './src/components/Timer';
import PilierCard from './src/components/PilierCard';
import MonCorps, { MetricTile } from './src/screens/MonCorps';
import { getPiliers, getSeances, getSeanceDuJour, canAccessSeanceIndex, getResumeIndicesForPilier, hapticLight, hapticSuccess } from './src/utils';

// ── HEALTHKIT ──────────────────────────────────────────
const HK_PERMISSIONS = AppleHealthKit ? {
  permissions: {
    read: [
      AppleHealthKit.Constants?.Permissions?.ActiveEnergyBurned,
      AppleHealthKit.Constants?.Permissions?.AppleExerciseTime,
      AppleHealthKit.Constants?.Permissions?.AppleStandTime,
      AppleHealthKit.Constants?.Permissions?.Workout,
    ].filter(Boolean),
    write: [
      AppleHealthKit.Constants?.Permissions?.ActiveEnergyBurned,
      AppleHealthKit.Constants?.Permissions?.Workout,
    ].filter(Boolean),
  },
} : null;

let hkInitialized = false;

function initHealthKit() {
  if (!AppleHealthKit || hkInitialized || Platform.OS !== 'ios') return;
  AppleHealthKit.initHealthKit(HK_PERMISSIONS, function(err) {
    if (err) { if (__DEV__) console.log('HealthKit init error:', err); return; }
    hkInitialized = true;
    if (__DEV__) console.log('HealthKit initialized');
  });
}

function saveHealthKitWorkout(durationMinutes) {
  if (!AppleHealthKit || !hkInitialized || Platform.OS !== 'ios') return;
  var now = new Date();
  var start = new Date(now.getTime() - durationMinutes * 60000);
  var calories = Math.round(durationMinutes * 5);
  var options = {
    type: 'FunctionalStrengthTraining',
    startDate: start.toISOString(),
    endDate: now.toISOString(),
    energyBurned: calories,
    energyBurnedUnit: 'calorie',
  };
  AppleHealthKit.saveWorkout(options, function(err, res) {
    if (__DEV__) {
      if (__DEV__ && err) console.log('HealthKit workout save error:', err);
      else if (__DEV__) console.log('HealthKit workout saved:', durationMinutes + 'min, ' + calories + 'cal');
    }
  });
}

/** Pictogrammes restants (autres que 🔥🔒✓▶) — chaînes UTF-8. */
const U_STAR = '\u2B50';
const U_SEED = '\uD83C\uDF31';
const U_DROP = '\uD83D\uDCA7';

/** Valeur numérique du streak pour l'affichage à côté de {'🔥'} dans le JSX. */
function streakCountValue(streak) {
  const n = Number(streak);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function devWarn(...args) {
  if (__DEV__) console.warn('[FluidBody]', ...args);
}

// hapticLight and hapticSuccess moved to src/utils.js

function tabBarIconTint(color) {
  return color != null && color !== '' ? color : 'rgba(0,220,255,0.9)';
}

function CustomTabBar({ state, descriptors, navigation }) {
  var tabCount = state.routes.length;
  var barW = SW - 40;
  var tabW = barW / tabCount;
  var pad = 5;
  var pillW = tabW - pad * 2;
  var pillH = 56;
  var indicatorX = useRef(new Animated.Value(state.index * tabW + pad)).current;
  var currentIdx = useRef(state.index);
  var dragStartX = useRef(0);

  useEffect(function() {
    currentIdx.current = state.index;
    Animated.spring(indicatorX, { toValue: state.index * tabW + pad, useNativeDriver: true, damping: 18, stiffness: 180, mass: 0.8 }).start();
  }, [state.index]);

  var panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: function() { return true; },
    onMoveShouldSetPanResponder: function(_, g) { return Math.abs(g.dx) > 8; },
    onPanResponderGrant: function(_, g) {
      dragStartX.current = currentIdx.current * tabW + pad;
      indicatorX.stopAnimation();
    },
    onPanResponderMove: function(_, g) {
      var newX = Math.max(pad, Math.min(dragStartX.current + g.dx, (tabCount - 1) * tabW + pad));
      indicatorX.setValue(newX);
    },
    onPanResponderRelease: function(_, g) {
      var rawX = dragStartX.current + g.dx;
      var newIdx = Math.round(Math.max(0, Math.min(rawX / tabW, tabCount - 1)));
      if (newIdx !== currentIdx.current) {
        navigation.navigate(state.routes[newIdx].name);
      }
      Animated.spring(indicatorX, { toValue: newIdx * tabW + pad, useNativeDriver: true, damping: 18, stiffness: 180, mass: 0.8 }).start();
    },
  })).current;

  return (
    <View style={{ position: 'absolute', bottom: 24, left: 20, right: 20, height: 66, backgroundColor: 'rgba(28,28,30,0.94)', borderRadius: 33, borderWidth: 1, borderColor: '#AEEF4D' }} {...panResponder.panHandlers}>
      <Animated.View style={{ position: 'absolute', top: (66 - pillH) / 2, left: 0, width: pillW, height: pillH, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.13)', transform: [{ translateX: indicatorX }] }} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        {state.routes.map(function(route, index) {
          var options = descriptors[route.key].options;
          var isFocused = state.index === index;
          var color = isFocused ? '#AEEF4D' : 'rgba(255,255,255,0.45)';
          var onPress = function() {
            var event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          var IconComp = options.tabBarIcon;
          return (
            <TouchableOpacity key={route.key} onPress={onPress} activeOpacity={0.7} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 66 }}>
              {IconComp && IconComp({ color: color, size: 22, focused: isFocused })}
              <Text style={{ fontSize: 10, fontWeight: '600', color: color, marginTop: 3, letterSpacing: 0.2 }}>{route.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function TabIconResume({ color, size }) {
  var c = tabBarIconTint(color);
  var s = size ?? 22;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={1.8} opacity={0.3} />
        <Path d="M12 3a9 9 0 0 1 6.36 15.36" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx="12" cy="12" r="6" stroke={c} strokeWidth={1.6} opacity={0.3} />
        <Path d="M12 6a6 6 0 0 1 4.24 10.24" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        <Circle cx="12" cy="12" r="3" stroke={c} strokeWidth={1.4} opacity={0.3} />
        <Path d="M12 9a3 3 0 0 1 2.12 5.12" stroke={c} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function TabIconMonCorps({ color, size }) {
  const c = tabBarIconTint(color);
  const s = size ?? 22;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M6 10C5 7 7 3 12 3s7 4 6 7c-0.5 1.2-2 2-3.5 1.8C13.5 12.2 12.8 12.5 12 12.5s-1.5-0.3-2.5-0.7C8 12 6.5 11.2 6 10Z" fill={c} opacity={0.35} />
        <Path d="M6 10C5 7 7 3 12 3s7 4 6 7c-0.5 1.2-2 2-3.5 1.8C13.5 12.2 12.8 12.5 12 12.5s-1.5-0.3-2.5-0.7C8 12 6.5 11.2 6 10Z" stroke={c} strokeWidth={1.2} strokeLinecap="round" />
        <Path d="M10 12.5c-0.3 1.5-1 3-1.5 4.5" stroke={c} strokeWidth={1} strokeLinecap="round" opacity={0.6} />
        <Path d="M12 12.5c0 1.5 0 3.5-0.2 5" stroke={c} strokeWidth={1} strokeLinecap="round" opacity={0.6} />
        <Path d="M14 12.5c0.3 1.5 1 3 1.5 4.5" stroke={c} strokeWidth={1} strokeLinecap="round" opacity={0.6} />
        <Path d="M9 6.5Q10.5 5.5 12 5.5" stroke={c} strokeWidth={0.8} strokeLinecap="round" opacity={0.5} />
      </Svg>
    </View>
  );
}

function TabIconProgresser({ color, size }) {
  const c = tabBarIconTint(color);
  const s = size ?? 22;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M3 20h18M3 14h12M3 8h8" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx={19} cy={8} r={3} stroke={c} strokeWidth={1.6} fill="none" />
      </Svg>
    </View>
  );
}

function TabIconBiblio({ color, size }) {
  const c = tabBarIconTint(color);
  const s = size ?? 22;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path d="M4 4h16v16H4z" stroke={c} strokeWidth={1.6} strokeLinejoin="round" fill="none" />
        <Path d="M8 8h8M8 12h8M8 16h5" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function TabIconProfil({ color, size }) {
  var c = tabBarIconTint(color);
  var s = size ?? 22;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="8" r="4" stroke={c} strokeWidth={1.6} />
        <Path d="M4 21c0-3.87 3.58-7 8-7s8 3.13 8 7" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function TabIconPartage({ color, size }) {
  var c = tabBarIconTint(color);
  var s = size ?? 22;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Circle cx="18" cy="5" r="3" stroke={c} strokeWidth={1.5} />
        <Circle cx="6" cy="12" r="3" stroke={c} strokeWidth={1.5} />
        <Circle cx="18" cy="19" r="3" stroke={c} strokeWidth={1.5} />
        <Path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke={c} strokeWidth={1.3} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// TabIconTimer moved to src/screens/MonCorps.js

const Tab = createBottomTabNavigator();
const { width: SW, height: SH } = Dimensions.get('window');
const IS_IPAD = SW >= 768;
const SCALE = IS_IPAD ? SW / 390 : 1; // Scale factor relative to iPhone 390px
const SUPPORTED_APP_LANGS = ['fr', 'en', 'es', 'it', 'de', 'pt', 'zh', 'ja', 'ko'];

/** Langue d'interface : locale appareil (expo-localization), sinon français. */
function getAppLangFromLocale() {
  try {
    const locales = getLocales();
    const first = locales?.[0];
    const code = (first?.languageCode || String(first?.languageTag || '').split(/[-_]/)[0] || '').toLowerCase();
    if (SUPPORTED_APP_LANGS.includes(code)) return code;
  } catch (e) {}
  return 'fr';
}

const ALL_PRODUCT_IDS = Object.values(PRODUCT_IDS);
const RC_ENTITLEMENT_ID = 'Fluidbody Pilates Pro';
const RC_API_KEY_IOS = 'appl_hqCGakwrJAfotXKNQtMBAgLnqcX';

const COACH_IMAGE = require('./assets/coach.jpg');

// getResumeIndicesForPilier and canAccessSeanceIndex moved to src/utils.js



// getSeanceDuJour moved to src/utils.js



// ARTICLES, FICHES, ArticleDetail, FicheDetail, Biblio moved to src/screens/Bibliotheque.js
import Biblio from './src/screens/Bibliotheque';

import ResumeScreen from './src/screens/Resume';


// ══════════════════════════════════
// PROGRESSER
// ══════════════════════════════════
function AnimatedBar({ value, max, color, delay = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setTimeout(() => { Animated.timing(anim, { toValue: value / max, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, delay);
  }, [value]);
  return (
    <View style={{ height: 7, backgroundColor: 'rgba(174,239,77,0.12)', borderRadius: 4, overflow: 'hidden' }}>
      <Animated.View style={{ height: 7, width: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 300] }), backgroundColor: color, borderRadius: 4, opacity: value === max ? 1 : 0.85 }} />
    </View>
  );
}

var FACE_EXPRESSIONS = [
  { eyes: 'happy', mouth: 'smile' },
  { eyes: 'wink', mouth: 'grin' },
  { eyes: 'happy', mouth: 'open' },
  { eyes: 'star', mouth: 'smile' },
  { eyes: 'love', mouth: 'grin' },
  { eyes: 'happy', mouth: 'tongue' },
  { eyes: 'wink', mouth: 'smile' },
];

function AnimatedFaceIcon({ size = 50, breathCycleMs = 3000, expression = 0, tint = 'rgba(174,239,77,1)' }) {
  var breathAnim = useRef(new Animated.Value(0)).current;
  var [blinking, setBlinking] = useState(false);
  useEffect(function() {
    if (breathCycleMs) {
      Animated.loop(Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: breathCycleMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0, duration: breathCycleMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();
    }
    function blink() {
      var delay = 2000 + Math.random() * 4000;
      setTimeout(function() {
        setBlinking(true);
        setTimeout(function() { setBlinking(false); blink(); }, 150);
      }, delay);
    }
    blink();
  }, []);
  var scale = breathAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  var expr = FACE_EXPRESSIONS[expression % FACE_EXPRESSIONS.length];
  var c = tint;
  var eyeL = null; var eyeR = null;
  if (blinking) {
    eyeL = <Path d="M35 36h14" stroke={c} strokeWidth={2.5} strokeLinecap="round" />;
    eyeR = <Path d="M55 36h14" stroke={c} strokeWidth={2.5} strokeLinecap="round" />;
  } else if (expr.eyes === 'happy') {
    eyeL = <Path d="M35 38C35 34 38 31 42 31s7 3 7 7" stroke={c} strokeWidth={2.5} strokeLinecap="round" fill="none" />;
    eyeR = <Path d="M55 38C55 34 58 31 62 31s7 3 7 7" stroke={c} strokeWidth={2.5} strokeLinecap="round" fill="none" />;
  } else if (expr.eyes === 'wink') {
    eyeL = <Path d="M35 38C35 34 38 31 42 31s7 3 7 7" stroke={c} strokeWidth={2.5} strokeLinecap="round" fill="none" />;
    eyeR = <Circle cx="62" cy="35" r="3" fill={c} />;
  } else if (expr.eyes === 'star') {
    eyeL = <Path d="M42 30l1.5 4 4-1.5-3 3 3 3-4-1.5L42 42l-1.5-4-4 1.5 3-3-3-3 4 1.5z" fill={c} />;
    eyeR = <Path d="M62 30l1.5 4 4-1.5-3 3 3 3-4-1.5L62 42l-1.5-4-4 1.5 3-3-3-3 4 1.5z" fill={c} />;
  } else if (expr.eyes === 'love') {
    eyeL = <Path d="M38 34c0-2 1.5-4 4-4s4 2 4 4c0 3-4 6-4 6s-4-3-4-6z" fill={c} />;
    eyeR = <Path d="M58 34c0-2 1.5-4 4-4s4 2 4 4c0 3-4 6-4 6s-4-3-4-6z" fill={c} />;
  }
  var mouth = null;
  if (expr.mouth === 'smile') mouth = <Path d="M40 58Q52 68 64 58" stroke={c} strokeWidth={2.5} strokeLinecap="round" fill="none" />;
  else if (expr.mouth === 'grin') mouth = <Path d="M38 56Q52 72 66 56" stroke={c} strokeWidth={2.5} strokeLinecap="round" fill="none" />;
  else if (expr.mouth === 'open') mouth = <Ellipse cx="52" cy="60" rx="7" ry="5" fill={c} opacity={0.25} stroke={c} strokeWidth={2} />;
  else if (expr.mouth === 'tongue') mouth = <G><Path d="M40 58Q52 68 64 58" stroke={c} strokeWidth={2.5} strokeLinecap="round" fill="none" /><Ellipse cx="52" cy="65" rx="4" ry="3" fill="#FF6B8A" opacity={0.7} /></G>;
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ scale: scale }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="44" fill={tint.replace('1)', '0.1)')} />
        <Circle cx="50" cy="50" r="44" stroke={c} strokeWidth={2} fill="none" />
        <Path d="M22 38Q28 20 44 16" stroke={c} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.35} />
        {eyeL}{eyeR}
        {mouth}
        <Circle cx="28" cy="52" r="6" fill={tint.replace('1)', '0.12)')} />
        <Circle cx="72" cy="52" r="6" fill={tint.replace('1)', '0.12)')} />
      </Svg>
    </Animated.View>
  );
}


function Progresser({ done, lang, tensionIdxs }) {
  const tr = T[lang] || T['fr'];
  const totalDone = Math.min(Object.values(done).flat().filter(Boolean).length, 40);
  const pct = Math.round(totalDone / 40 * 100);
  const piliers = getPiliers(lang);
  const recommendedPiliers = tensionIdxs.map(i => ZONE_TO_PILIER[i]);
  const globalAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(globalAnim, { toValue: pct / 100, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);
  const sortedPiliers = [...piliers].sort((a, b) => (recommendedPiliers.includes(a.key) ? 0 : 1) - (recommendedPiliers.includes(b.key) ? 0 : 1));
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map((b, i) => <Bulle key={i} {...b} />)}
      </View>
      <FloatingMedusas />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        <View style={{ paddingTop: 65, paddingHorizontal: 24, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 34 }}>+</Text></Text>
          </View>
          <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.progresser_sub(pct)}</Text>
          <View style={{ height: 6, backgroundColor: 'rgba(174,239,77,0.15)', borderRadius: 3, marginTop: 14, overflow: 'hidden' }}>
            <Animated.View style={{ height: 6, width: globalAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 300] }), backgroundColor: '#AEEF4D', borderRadius: 3 }} />
          </View>
          <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.45)', textAlign: 'right', marginTop: 4 }}>{totalDone} / 40</Text>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {sortedPiliers.map((p, idx) => {
            const count = Math.min(done[p.key].filter(v => v === true || v === 'true').length, 5);
            const IconComp = ICONS[p.key];
            const isRec = recommendedPiliers.includes(p.key);
            const pct2 = Math.round(count / 5 * 100);
            return (
              <View key={p.key} style={{ backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 14 }}>
                    <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '300', color: '#ffffff' }}>{p.label}</Text>
                      {isRec && <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(174,239,77,0.15)', borderWidth: 0.5, borderColor: 'rgba(174,239,77,0.5)' }}><Text style={{ fontSize: 8, color: '#AEEF4D', letterSpacing: 1 }}>{'\u2605'} {tr.recommande_pour_toi}</Text></View>}
                    </View>
                    <Text style={{ fontSize: 11, color: '#AEEF4D', letterSpacing: 1, marginTop: 3 }}>{count}/5{count === 5 ? ' \u2713' : ''}</Text>
                  </View>
                  <Text style={{ fontSize: pct2 === 0 ? 16 : 22, fontWeight: pct2 === 0 ? '600' : '200', color: '#AEEF4D' }}>{pct2 === 0 ? (tr.cest_parti || "C'est parti !") : pct2 + '%'}</Text>
                </View>
                <AnimatedBar value={count} max={5} color={'#AEEF4D'} delay={idx * 100} />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}


// AVATARS, AvatarFace, AvatarConstellation, FloatingAvatars, PartageScreen moved to src/screens/Partage.js
// import PartageScreen from './src/screens/Partage'; // not used in tab navigator currently


// ProfilScreen moved to src/screens/Profil.js
import ProfilScreen from './src/screens/Profil';


// ══════════════════════════════════
// SEANCE DETAIL MODAL
// ══════════════════════════════════
function SeanceDetailModal({ visible, onClose, sdj, lang, onPlay }) {
  if (!visible || !sdj) return null;
  var tr = T[lang] || T["fr"];
  var titre = sdj.seance[0];
  var duree = sdj.seance[1];
  var etape = sdj.seance[2];
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000000" }}>
        <View style={{ height: SH * 0.42, width: "100%" }}>
          <ImageBackground source={PILIER_IMAGES[sdj.pilier.key]} resizeMode="cover" style={{ flex: 1 }}>
            <LinearGradient colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.7)"]} style={{ flex: 1 }}>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ position: "absolute", top: 56, left: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 18, color: "#ffffff" }}>{"\u2190"}</Text>
              </TouchableOpacity>
            </LinearGradient>
          </ImageBackground>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>{tr.free_try_once}</Text>
          <Text style={{ fontSize: 28, fontWeight: "800", color: "#ffffff", marginBottom: 10 }}>{titre}</Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#00BDD0", marginBottom: 6 }}>{sdj.pilier.label}</Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>{duree} · {tr.etapes[etape] || etape}</Text>
          <TouchableOpacity
            onPress={function() { onPlay && onPlay(); }}
            activeOpacity={0.85}
            style={{ height: 54, borderRadius: 27, backgroundColor: "#E5FF00", alignItems: "center", justifyContent: "center", marginBottom: 14 }}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#000000" }}>{tr.free_go}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════
// AUTH SCREEN — Email + mot de passe (Supabase), après onboarding si pas de session
// ══════════════════════════════════
function AuthScreen({ onSkip, lang = 'fr', prenomHint = '', langForProfile = 'fr', tensionIdxsForProfile = [] }) {
  const tr = T[lang] || T.fr;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('up');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!supabase) return;
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setError(tr.ob_auth_err_email); return; }
    if (password.length < 6) { setError(tr.ob_auth_err_short); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'up') {
        const { data, error: err } = await supabase.auth.signUp({
          email: em,
          password,
          options: { data: { prenom: String(prenomHint || '').trim().slice(0, 50).replace(/[<>]/g, '') } },
        });
        if (err) { setError(err.message); setLoading(false); return; }
        if (!data.session) {
          setError(tr.ob_auth_confirm);
          setLoading(false);
          return;
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: em, password });
        if (err) { setError(err.message); setLoading(false); return; }
      }
      const hint = prenomHint && String(prenomHint).trim();
      if (hint) {
        const { error: ue } = await supabase.auth.updateUser({ data: { prenom: hint } });
        if (ue) devWarn('updateUser metadata prenom', ue);
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && supabase) {
        try {
          await supabase.from('profiles').upsert({
            id: session.user.id,
            prenom: String(prenomHint || hint || '').trim(),
            lang: langForProfile || lang,
            tension_idxs: Array.isArray(tensionIdxsForProfile) ? tensionIdxsForProfile : [],
            updated_at: new Date().toISOString(),
          });
        } catch (e) { devWarn('profiles upsert post-auth', e); }
      }
    } catch (e) {
      setError(tr.ob_auth_err_net);
    }
    setLoading(false);
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible', opacity: 0.3 }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />

      <View style={{ paddingTop: 58, paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 30 }}>+</Text></Text>
        <TouchableOpacity onPress={onSkip} style={{ paddingVertical: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1 }}>{tr.first_seance_later || 'Plus tard'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1, zIndex: 2 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 20 }} keyboardShouldPersistTaps="handled">

          <MeduseCornerIcon size={70} breathCycleMs={3000} tint="rgba(174,239,77,1)" />

          <Text style={{ fontSize: 12, color: '#AEEF4D', letterSpacing: 3, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 }}>{tr.ob_auth_tag}</Text>
          <Text style={{ fontSize: 22, fontWeight: '300', color: '#ffffff', textAlign: 'center', marginBottom: 8 }}>{tr.ob_auth_title}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>{tr.ob_auth_sub}</Text>

          <TouchableOpacity onPress={function() { if (supabase) { Alert.alert('FluidBody+', tr.auth_social_soon || 'Connexion Apple disponible dans la version App Store.'); } }} activeOpacity={0.85} style={{ width: '100%', height: 50, borderRadius: 25, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C3.79 16.17 4.36 9.04 8.72 8.78c1.34.07 2.27.74 3.06.8.93-.19 1.82-.73 2.82-.66 1.19.1 2.09.58 2.68 1.49-2.45 1.47-1.87 4.71.36 5.62-.45 1.17-.66 1.7-1.23 2.73-.82 1.46-1.97 2.92-3.36 2.95.27.18.55.34.84.46.32.13.66.11 1.16.11zM12.13 8.65c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="#000000" />
            </Svg>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#000000' }}>{tr.auth_apple || 'Continuer avec Apple'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={function() { if (supabase) { Alert.alert('FluidBody+', tr.auth_social_soon || 'Connexion Google disponible dans la version App Store.'); } }} activeOpacity={0.85} style={{ width: '100%', height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 001 12c0 1.94.46 3.77 1.18 5.07l3.66-2.84v-.14z" fill="#FBBC05" />
              <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </Svg>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#ffffff' }}>{tr.auth_google || 'Continuer avec Google'}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 16 }}>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(174,239,77,0.2)' }} />
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginHorizontal: 14 }}>{tr.auth_or || 'ou'}</Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(174,239,77,0.2)' }} />
          </View>

          <TextInput value={email} onChangeText={setEmail} placeholder={tr.ob_email_ph} placeholderTextColor="rgba(174,239,77,0.3)" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            style={{ width: '100%', height: 52, backgroundColor: 'rgba(0,18,32,0.6)', borderWidth: 1, borderColor: email ? '#AEEF4D' : 'rgba(174,239,77,0.2)', borderRadius: 14, color: '#ffffff', fontSize: 16, paddingHorizontal: 16, marginBottom: 10 }}
          />
          <TextInput value={password} onChangeText={setPassword} placeholder={tr.ob_pass_ph} placeholderTextColor="rgba(174,239,77,0.3)" secureTextEntry autoCapitalize="none" autoCorrect={false}
            style={{ width: '100%', height: 52, backgroundColor: 'rgba(0,18,32,0.6)', borderWidth: 1, borderColor: password ? '#AEEF4D' : 'rgba(174,239,77,0.2)', borderRadius: 14, color: '#ffffff', fontSize: 16, paddingHorizontal: 16, marginBottom: 12 }}
          />
          {error ? <Text style={{ color: 'rgba(255,120,120,0.9)', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>{error}</Text> : null}
          <TouchableOpacity onPress={submit} disabled={loading} style={{ width: '100%', height: 50, borderRadius: 25, backgroundColor: email.trim() && password.length >= 6 ? '#AEEF4D' : 'rgba(174,239,77,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: email.trim() && password.length >= 6 ? '#000000' : 'rgba(174,239,77,0.5)' }}>{loading ? '…' : (mode === 'up' ? tr.ob_auth_submit_up : tr.ob_auth_submit_in)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setMode(m => m === 'up' ? 'in' : 'up'); setError(''); }} style={{ paddingVertical: 10 }}>
            <Text style={{ fontSize: 13, color: '#AEEF4D', letterSpacing: 0.5 }}>{mode === 'up' ? tr.ob_auth_toggle_in : tr.ob_auth_toggle_up}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ══════════════════════════════════
// ONBOARDING
// ══════════════════════════════════
function OnboardingScreen({ onDone, initialLang }) {
  const [lang] = useState(() => initialLang ?? getAppLangFromLocale());
  const [step, setStep] = useState(0);
  const [prenom, setPrenom] = useState('');
  const [tensionIdxs, setTensionIdxs] = useState([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const tr = T[lang] || T.fr;
  const obStepCount = 3;
  const prenomMeduseAnim = useRef(new Animated.Value(0)).current;
  const prenomMeduseFloat = prenomMeduseAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(prenomMeduseAnim, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(prenomMeduseAnim, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const floatingMedusas = useRef([
    { x: new Animated.Value(SW - 80), y: new Animated.Value(SH * 0.12), size: 72, speed: 0.8, breath: 3200, cx: SW - 80, cy: SH * 0.12 },
    { x: new Animated.Value(30), y: new Animated.Value(SH * 0.4), size: 58, speed: 0.9, breath: 3600, cx: 30, cy: SH * 0.4 },
    { x: new Animated.Value(SW * 0.5), y: new Animated.Value(SH * 0.65), size: 50, speed: 0.85, breath: 4000, cx: SW * 0.5, cy: SH * 0.65 },
    { x: new Animated.Value(SW * 0.75), y: new Animated.Value(SH * 0.8), size: 44, speed: 0.75, breath: 3800, cx: SW * 0.75, cy: SH * 0.8 },
  ]).current;

  useEffect(() => {
    floatingMedusas.forEach(function(m) {
      function drift() {
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 60 + Math.random() * (SH - m.size - 160);
        var dur = 12000 + Math.random() * 8000;
        Animated.parallel([
          Animated.timing(m.x, { toValue: toX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
          Animated.timing(m.y, { toValue: toY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
        ]).start(function() { drift(); });
      }
      drift();
    });
  }, []);

  useEffect(function() {}, [step]);

  function nextStep(n) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(n), 400);
  }

  function afterPrenomContinue() {
    if (!prenom.trim()) return;
    onDone(prenom.trim(), lang, tensionIdxs, { skipCloudAuth: true });
  }

  function afterPrenomAnon() {
    onDone('', lang, tensionIdxs, { skipCloudAuth: true });
  }

  function toggleTension(idx) {
    setTensionIdxs(prev => prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]);
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#00bdd0', '#005878', '#001828']} locations={[0, 0.3, 0.52, 0.72, 1]} style={StyleSheet.absoluteFill} />
      {BULLES_ONBOARDING.map((b, i) => <Bulle key={`ob-${i}`} {...b} />)}
      {/* Méduse centrale : écran bienvenue (step 0) et écran prénom (step 2) */}
      {(step === 0 || step === 2) && (
        <View style={{ position: 'absolute', top: step === 0 ? 298 : 200, left: 0, right: 0, alignItems: 'center', opacity: step === 0 ? 0.9 : 0.25, zIndex: 0 }} pointerEvents="none">
          <Meduse />
        </View>
      )}
      {/* Grand logo sur step 0, petit header compact sur steps 1-3 */}
      {step === 0 ? (
        <View style={{ position: 'absolute', top: 128, left: 0, right: 0, zIndex: 20, alignItems: 'center', paddingHorizontal: 8, pointerEvents: 'none' }}>
          <View style={{ width: '100%', maxWidth: SW - 16, alignItems: 'center' }}>
            <View style={{ width: '100%', paddingHorizontal: 2 }}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.2}
                style={{
                  width: '100%',
                  fontSize: 236,
                  fontWeight: '200',
                  letterSpacing: 10,
                  color: '#FAFEFF',
                  textAlign: 'center',
                  textShadowColor: 'rgba(0, 14, 32, 0.55)',
                  textShadowOffset: { width: 0, height: 5 },
                  textShadowRadius: 24,
                  ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
                }}
              >
                FLUIDBODY<Text
                  style={{
                    fontWeight: '700',
                    fontSize: 260,
                    letterSpacing: 1,
                    color: '#E5FF00',
                    textShadowColor: 'rgba(0, 0, 0, 0.4)',
                    textShadowOffset: { width: 0, height: 3 },
                    textShadowRadius: 14,
                    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
                  }}
                >+</Text>
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'nowrap', marginTop: -2, width: '100%', paddingHorizontal: 8 }}>
              <Text style={{ fontSize: 28, fontWeight: '400', color: '#E5FF00', letterSpacing: 16, textTransform: 'uppercase', textShadowColor: 'rgba(0, 12, 28, 0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10, ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}) }}>PILATES</Text>
              <Text style={{ marginLeft: 14, fontSize: 28, fontWeight: '300', color: '#E5FF00', letterSpacing: 2, textShadowColor: 'rgba(0, 12, 28, 0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6, ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}) }}>{'& More'}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.logoRow, { justifyContent: "flex-start", paddingLeft: 20, paddingTop: 10, marginBottom: 20, zIndex: 20 }]} pointerEvents="none">
          <Text style={styles.logoWordmark} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            FLUIDBODY<Text style={{ fontWeight: "900", color: "#E5FF00", fontSize: 34 }}>+</Text>
          </Text>
        </View>
      )}
      {floatingMedusas.map(function(m, i) {
        var s = step === 2 ? m.size * 0.7 : m.size;
        var o = step === 2 ? 0.7 : 1;
        return (
          <Animated.View key={'fm-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 0, opacity: o * 0.7, left: m.x, top: m.y }}>
            <MeduseCornerIcon size={s} breathCycleMs={m.breath} breathMaxScale={1.35} tint="rgba(174,239,77,1)" />
          </Animated.View>
        );
      })}
      <View style={{ position: 'absolute', top: 54, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', zIndex: 30, paddingHorizontal: 24 }}>
        {step > 1 ? (
          <TouchableOpacity onPress={() => nextStep(step - 1)} style={{ position: 'absolute', left: 24, padding: 8 }}>
            <Text style={{ fontSize: 22, color: '#E5FF00' }}>←</Text>
          </TouchableOpacity>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Array.from({ length: obStepCount }, (_, i) => <View key={i} style={{ width: step === i ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: step === i ? '#E5FF00' : 'rgba(229,255,0,0.25)' }} />)}
        </View>
      </View>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, alignItems: 'center', justifyContent: step === 1 ? 'center' : 'flex-end', paddingBottom: step === 0 ? 132 : 60, zIndex: 2, elevation: step === 2 ? 4 : 0 }}>
        {step === 0 && (
          <View style={{ alignItems: 'center', paddingHorizontal: 32, alignSelf: 'stretch' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 28, alignSelf: 'center' }}>
              <View style={{ width: 120, height: 120, borderRadius: 60, overflow: 'hidden', borderWidth: 3, borderColor: '#AEEF4D' }}>
                <ImageBackground source={COACH_IMAGE} resizeMode="cover" style={{ flex: 1 }} />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>{tr.coach_avec || 'Avec Sabrina'}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{tr.coach_exp || '30 ans d\'expérience'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => nextStep(1)} style={styles.btnCtaLarge}>
              <Text style={styles.btnCtaLargeTxt}>{"C'est parti !"}</Text>
            </TouchableOpacity>
          </View>
        )}
        {step === 1 && (
          <View style={{ alignItems: 'center', paddingHorizontal: 32, alignSelf: 'stretch' }}>
            <Text style={{ fontSize: 16, color: '#E5FF00', letterSpacing: 6, textTransform: 'uppercase', marginBottom: 12 }}>{tr.ob_bilan}</Text>
            <Text style={{ fontSize: 32, fontWeight: '300', color: '#ffffff', textAlign: 'center', marginBottom: 8 }}>{tr.ob_tensions}</Text>
            <Text style={{ fontSize: 17, color: 'rgba(255,255,255,0.6)', marginBottom: 18 }}>{tr.ob_select}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 28, marginTop: 8 }}>
              {tr.ob_zones.map((zone, idx) => (
                <TouchableOpacity key={idx} onPress={() => toggleTension(idx)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: tensionIdxs.includes(idx) ? '#E5FF00' : 'rgba(255,255,255,0.2)', backgroundColor: tensionIdxs.includes(idx) ? 'rgba(229,255,0,0.15)' : 'rgba(0,20,35,0.55)' }}>
                  <Text style={{ fontSize: 15, color: tensionIdxs.includes(idx) ? '#E5FF00' : 'rgba(255,255,255,0.65)' }}>{zone}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => nextStep(2)} style={[styles.btnCtaLarge, tensionIdxs.length === 0 && styles.btnCtaOff]}>
              <Text style={styles.btnCtaLargeTxt}>{tr.ob_continuer}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => nextStep(2)} style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#E5FF00', letterSpacing: 2.5, textTransform: 'uppercase' }}>{tr.ob_explorer}</Text>
            </TouchableOpacity>
          </View>
        )}
        {step === 2 && (
          <KeyboardAvoidingView
            style={{ flex: 1, alignSelf: 'stretch', width: '100%' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 52 : 0}
          >
          <ScrollView
            style={{ flex: 1, alignSelf: 'stretch', zIndex: 3 }}
            contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 120, paddingBottom: 24, flexGrow: 1, justifyContent: 'flex-end' }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', paddingVertical: 22, paddingHorizontal: 18, borderRadius: 22, backgroundColor: 'rgba(0,10,22,0.78)', borderWidth: 1, borderColor: 'rgba(229,255,0,0.15)' }}>
              <Text style={{ fontSize: 12, color: '#E5FF00', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }}>{tr.ob_prenom_tag}</Text>
              <Text style={{ fontSize: 32, fontWeight: '300', color: '#ffffff', textAlign: 'center', marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 10 }}>{tr.ob_prenom}</Text>
              <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', marginBottom: 24, textAlign: 'center', lineHeight: 22, textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }}>{tr.ob_prenom_sub}</Text>
              <TextInput
                value={prenom} onChangeText={setPrenom}
                placeholder={tr.ob_placeholder}
                placeholderTextColor="rgba(0,200,230,0.45)"
                autoFocus autoCapitalize="words" returnKeyType="done"
                textContentType="givenName"
                autoCorrect={false}
                keyboardAppearance={Platform.OS === 'ios' ? 'dark' : undefined}
                onSubmitEditing={() => afterPrenomContinue()}
                style={{ alignSelf: 'stretch', height: 62, backgroundColor: prenom.trim() ? 'rgba(0,28,48,0.96)' : 'rgba(0,22,38,0.94)', borderWidth: prenom.trim() ? 1.5 : 1, borderColor: prenom.trim() ? '#E5FF00' : 'rgba(229,255,0,0.35)', borderRadius: 16, color: '#ffffff', fontSize: 20, fontWeight: '400', textAlign: 'center', marginBottom: prenom.trim() ? 10 : 22 }}
              />
              {prenom.trim().length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', marginBottom: 14 }}>
                  <Text style={{ fontSize: 26, fontWeight: '300', color: '#E5FF00', textAlign: 'center', lineHeight: 32 }}>{`${tr.bonjour_mot} ${prenom.trim()}`}</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => afterPrenomContinue()} style={[styles.btnCtaLarge, prenom.trim() === '' && styles.btnCtaOff]} disabled={prenom.trim() === ''}>
                <Text style={styles.btnCtaLargeTxt}>{tr.ob_demarrer}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => afterPrenomAnon()} style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#E5FF00', letterSpacing: 2.5, textTransform: 'uppercase' }}>{tr.ob_anon}</Text>
            </TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
        )}
      </Animated.View>
    </View>
  );
}

// ══════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════
if (Notifications) {
  try {
    Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }) });
  } catch(e) {}
}

async function setupNotifications(lang = 'fr') {
  try {
    if (!Notifications || !Device) return;
    if (!Device.isDevice) return;
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const tr = T[lang] || T['fr'];
    await Notifications.scheduleNotificationAsync({ content: { title: tr.notif_title, body: tr.notif_body, sound: true }, trigger: { hour: 9, minute: 0, repeats: true } });
    // Pause Active — Office : toutes les heures 9h-18h en semaine
    for (var h = 9; h <= 17; h++) {
      for (var wd = 2; wd <= 6; wd++) {
        await Notifications.scheduleNotificationAsync({
          content: { title: tr.notif_pause_title || 'Pause Active', body: tr.notif_pause_body || 'C\'est le moment de bouger ! 5 min d\'étirements au bureau.', sound: true },
          trigger: { weekday: wd, hour: h, minute: 0, repeats: true },
        });
      }
    }
  } catch(e) {}
}

const FLUID_SUB_KEY = 'fluid_sub';
const DONE_KEY = 'fluidbody_done';

// ══════════════════════════════════
// SUPABASE
// ══════════════════════════════════
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let supabase = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_ANON_KEY manquant');
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      storageKey: 'fluidbody.supabase.auth.v1',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: { transport: () => null },
  });
  if (__DEV__) console.log('Supabase créé avec succès');
} catch (e) {
  supabase = null;
  if (__DEV__) console.error('Erreur Supabase:', e?.message != null ? e.message : String(e));
}

// ══════════════════════════════════
// MAIN APP
// ══════════════════════════════════
function MainApp({ prenom, lang, tensionIdxs, supabase, supaUser }) {
  const tr = T[lang] || T['fr'];
  const [done, setDone] = useState({
    p1: Array(20).fill(false), p2: Array(20).fill(false), p3: Array(20).fill(false),
    p4: Array(20).fill(false), p5: Array(20).fill(false), p6: Array(20).fill(false), p7: Array(20).fill(false), p8: Array(20).fill(false),
  });
  const [streak, setStreak] = useState(0);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [freeDetailVisible, setFreeDetailVisible] = useState(false);
  const [freeVideoPlaying, setFreeVideoPlaying] = useState(false);
  const [showFirstSeanceModal, setShowFirstSeanceModal] = useState(false);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [showStretchTimer, setShowStretchTimer] = useState(false);
  const [rcPackagesByProductId, setRcPackagesByProductId] = useState({});
  const [rcLoadingPrices, setRcLoadingPrices] = useState(false);

  useEffect(function() { initHealthKit(); }, []);

  const rcSupported = Platform.OS === 'ios';
  const rcDisabled = !Purchases || !rcSupported || (Device && Device.isDevice === false);

  function openPaywall() {
    setPaywallVisible(true);
  }

  async function setSubscriptionActive(active) {
    setIsSubscriber(!!active);
    try {
      await AsyncStorage.setItem(FLUID_SUB_KEY, active ? 'true' : 'false');
      await AsyncStorage.setItem('is_subscription_active', active ? 'true' : 'false');
    } catch (e) {}
  }

  async function refreshCustomerInfo() {
    try {
      const info = await Purchases.getCustomerInfo();
      const active = !!info?.entitlements?.active?.[RC_ENTITLEMENT_ID];
      await setSubscriptionActive(active);
      return { info, active };
    } catch (e) {
      if (__DEV__) console.log('IAP Error:', e);
      devWarn('RevenueCat getCustomerInfo', e);
      return { info: null, active: false };
    }
  }

  async function purchaseSubscription(pkg) {
    if (rcDisabled) return;
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const active = !!customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];
      await setSubscriptionActive(active);
      setPaywallVisible(false);
    } catch (e) {
      if (__DEV__) console.log('IAP Error:', e);
      devWarn('RevenueCat purchasePackage', e);
    }
  }

  async function restoreSubscription() {
    if (rcDisabled) return;
    try {
      const info = await Purchases.restorePurchases();
      const active = !!info?.entitlements?.active?.[RC_ENTITLEMENT_ID];
      await setSubscriptionActive(active);
    } catch (e) {
      if (__DEV__) console.log('IAP Error:', e);
      devWarn('RevenueCat restorePurchases', e);
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        // Vérification abonnement : RevenueCat d'abord, cache AsyncStorage en fallback offline
        var subVerified = false;
        try {
          if (Purchases && !rcDisabled) {
            var info = await Purchases.getCustomerInfo();
            subVerified = !!(info?.entitlements?.active?.[RC_ENTITLEMENT_ID]);
            await AsyncStorage.setItem(FLUID_SUB_KEY, subVerified ? 'true' : 'false');
          } else {
            // Offline fallback : cache local (non fiable, mais mieux que rien)
            var cached = await AsyncStorage.getItem(FLUID_SUB_KEY);
            subVerified = cached === 'true';
          }
        } catch(rcErr) {
          // Erreur réseau : utiliser le cache
          var cached = await AsyncStorage.getItem(FLUID_SUB_KEY);
          subVerified = cached === 'true';
        }
        if (subVerified) setIsSubscriber(true);
        const savedDone = await AsyncStorage.getItem(DONE_KEY);
        if (savedDone) {
          const parsed = JSON.parse(savedDone);
          const fixed = {};
          ['p1','p2','p3','p4','p5','p6','p7','p8'].forEach(function(k) {
            fixed[k] = parsed[k] ? parsed[k].map(v => v === true || v === 'true') : Array(20).fill(false);
          });
          setDone(fixed);
        }
        if (supabase && supaUser) {
          try {
            const { data } = await supabase.from('progression').select('done').eq('user_id', supaUser.id).single();
            if (data?.done) {
              const fixed = {};
              Object.keys(data.done).forEach(k => { fixed[k] = (data.done[k] || []).map(v => v === true || v === 'true'); });
              setDone(fixed);
            }
          } catch (e) { devWarn('Supabase progression', e); }
        }
        const savedStreak = parseInt(await AsyncStorage.getItem(STREAK_KEY) || '0');
        const lastDate = await AsyncStorage.getItem(STREAK_DATE_KEY);
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastDate === today) { setStreak(savedStreak); }
        else if (lastDate === yesterday) { setStreak(savedStreak); }
        else if (lastDate) { await AsyncStorage.setItem(STREAK_KEY, '0'); setStreak(0); }
      } catch (e) {}
    }
    loadData();
    setupNotifications(lang);
  }, []);

  useEffect(() => {
    if (rcDisabled) return;
    let mounted = true;
    let customerInfoListener = null;

    async function initRevenueCat() {
      try {
        Purchases.configure({ apiKey: RC_API_KEY_IOS });
      } catch (e) {
        if (__DEV__) console.log('IAP Error:', e);
        devWarn('RevenueCat configure', e);
        return;
      }

      try {
        await refreshCustomerInfo();
      } catch (e) {}

      try {
        customerInfoListener = async (info) => {
          try {
            const active = !!info?.entitlements?.active?.[RC_ENTITLEMENT_ID];
            await setSubscriptionActive(active);
          } catch (e) {}
        };
        Purchases.addCustomerInfoUpdateListener(customerInfoListener);
      } catch (e) {}

      try {
        if (__DEV__) console.log('Loading products...', PRODUCT_IDS);
        setRcLoadingPrices(true);
        const offerings = await Purchases.getOfferings();
        const current = offerings?.current;
        const packages = current?.availablePackages || [];
        const map = {};
        for (const pkg of packages) {
          const pid = pkg?.product?.identifier;
          const ptype = pkg?.packageType;
          if (!pid && !ptype) continue;

          // Accepte les identifiants App Store (longs) + Test Store (courts) + packageType
          const isMonthly =
            pid === PRODUCT_IDS.monthly ||
            pid === 'monthly' ||
            ptype === 'MONTHLY';
          const isYearly =
            pid === PRODUCT_IDS.yearly ||
            pid === 'yearly' ||
            ptype === 'ANNUAL';

          const canonical = isMonthly ? PRODUCT_IDS.monthly : isYearly ? PRODUCT_IDS.yearly : null;
          if (!canonical) continue;
          map[canonical] = pkg;
        }
        if (mounted) {
          setRcPackagesByProductId(map);
          if (__DEV__) console.log('Products loaded:', map);
        }
      } catch (e) {
        if (__DEV__) console.log('IAP Error:', e);
        devWarn('RevenueCat getOfferings', e);
      } finally {
        if (mounted) setRcLoadingPrices(false);
      }
    }

    initRevenueCat();
    return () => {
      mounted = false;
      try { if (customerInfoListener) Purchases.removeCustomerInfoUpdateListener(customerInfoListener); } catch (e) {}
    };
  }, []);

  async function resetAllData() {
    try {
      var keys = await AsyncStorage.getAllKeys();
      var fluidKeys = keys.filter(function(k) { return k.startsWith('fluid') || k === DONE_KEY || k === 'is_subscription_active'; });
      if (fluidKeys.length > 0) await AsyncStorage.multiRemove(fluidKeys);
    } catch(e) {}
    setDone({ p1: Array(20).fill(false), p2: Array(20).fill(false), p3: Array(20).fill(false), p4: Array(20).fill(false), p5: Array(20).fill(false), p6: Array(20).fill(false), p7: Array(20).fill(false), p8: Array(20).fill(false) });
    setStreak(0);
    setIsSubscriber(false);
  }

  async function toggleDone(key, idx) {
    const next = { ...done, [key]: [...done[key]] };
    next[key][idx] = !next[key][idx];
    setDone(next);
    try { await AsyncStorage.setItem(DONE_KEY, JSON.stringify(next)); } catch (e) {}
    if (supabase && supaUser) {
      try { await supabase.from('progression').upsert({ user_id: supaUser.id, done: next, updated_at: new Date().toISOString() }); } catch (e) { devWarn('Supabase progression upsert', e); }
    }
    // First séance modal
    if (!done[key][idx] && !supaUser) {
      var prevTotal = Object.values(done).flat().filter(Boolean).length;
      if (prevTotal === 0) {
        setTimeout(function() { setShowFirstSeanceModal(true); }, 1500);
      }
    }
    // Calendar heatmap
    if (!done[key][idx]) {
      try {
        var calKey = 'fluid_activity_calendar';
        var calRaw = await AsyncStorage.getItem(calKey);
        var cal = calRaw ? JSON.parse(calRaw) : {};
        var todayCal = new Date().toISOString().slice(0, 10);
        cal[todayCal] = (cal[todayCal] || 0) + 1;
        await AsyncStorage.setItem(calKey, JSON.stringify(cal));
      } catch(e) {}
    }
    // Streak
    if (!done[key][idx]) {
      try {
        const today = new Date().toDateString();
        const lastDate = await AsyncStorage.getItem(STREAK_DATE_KEY);
        if (lastDate !== today) {
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          const current = parseInt(await AsyncStorage.getItem(STREAK_KEY) || '0');
          const newStreak = lastDate === yesterday ? current + 1 : 1;
          await AsyncStorage.setItem(STREAK_KEY, String(newStreak));
          await AsyncStorage.setItem(STREAK_DATE_KEY, today);
          setStreak(newStreak);
        }
      } catch (e) {}
    }
  }

  return (
    <>
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        lang={lang}
        packagesByProductId={rcPackagesByProductId}
        loadingPrices={rcLoadingPrices}
        disabled={rcDisabled}
        onBuyMonthly={(pkg) => purchaseSubscription(pkg)}
        onBuyYearly={(pkg) => purchaseSubscription(pkg)}
        onRestore={() => restoreSubscription()}
        onTryFree={() => { setPaywallVisible(false); setFreeDetailVisible(true); }}
        coachImage={COACH_IMAGE}
      />
      <SeanceDetailModal
        visible={freeDetailVisible}
        onClose={() => { setFreeDetailVisible(false); setFreeVideoPlaying(false); }}
        sdj={getSeanceDuJour(done, tensionIdxs, lang)}
        lang={lang}
        onPlay={() => { setFreeDetailVisible(false); setFreeVideoPlaying(true); }}
      />
      {freeVideoPlaying && (function() {
        var sdj = getSeanceDuJour(done, tensionIdxs, lang);
        if (!sdj) return null;
        return (
          <Modal visible animationType="fade" presentationStyle="fullScreen" statusBarTranslucent supportedOrientations={['portrait', 'landscape-left', 'landscape-right']} onRequestClose={() => setFreeVideoPlaying(false)}>
            <VideoPlayer
              seance={sdj.seance}
              pilier={sdj.pilier}
              lang={lang}
              seanceIndex={sdj.idx}
              isDemo={!isSubscriber}
              onClose={() => setFreeVideoPlaying(false)}
              onComplete={() => { setFreeVideoPlaying(false); }}
              onDemoLimit={() => { setFreeVideoPlaying(false); setPaywallVisible(true); }}
              saveHealthKitWorkout={saveHealthKitWorkout}
            />
          </Modal>
        );
      })()}
      {showFirstSeanceModal && (
        <Modal visible animationType="fade" transparent statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
            <View style={{ backgroundColor: '#001828', borderRadius: 24, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#AEEF4D', width: '100%', maxWidth: 340 }}>
              <MeduseCornerIcon size={80} breathCycleMs={2500} tint="rgba(255,215,0,1)" />
              <Text style={{ fontSize: 32, marginTop: 12 }}>🎉</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginTop: 12 }}>{tr.first_seance_title || 'Bravo !'}</Text>
              <Text style={{ fontSize: 15, fontWeight: '300', color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginTop: 10, marginBottom: 24 }}>{tr.first_seance_sub || 'Première séance terminée !\nCrée un compte gratuit pour sauvegarder ta progression.'}</Text>
              <TouchableOpacity onPress={function() { setShowFirstSeanceModal(false); setShowAuthScreen(true); }} activeOpacity={0.85} style={{ alignSelf: 'stretch', height: 50, borderRadius: 25, backgroundColor: '#00BDD0', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>{tr.first_seance_create || 'Créer mon compte'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={function() { setShowFirstSeanceModal(false); }} activeOpacity={0.7}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>{tr.first_seance_later || 'Plus tard'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      {showAuthScreen && (
        <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
          <AuthScreen onSkip={function() { setShowAuthScreen(false); }} lang={lang} prenomHint={prenom} langForProfile={lang} tensionIdxsForProfile={tensionIdxs} />
        </Modal>
      )}
      <NavigationContainer>
          <Tab.Navigator tabBar={function(props) { return <CustomTabBar {...props} />; }} screenOptions={{ headerShown: false }}>
          <Tab.Screen name={tr.tabs[0]} options={{ tabBarIcon: (props) => <TabIconMonCorps {...props} /> }}>{() => <MonCorps prenom={prenom} done={done} toggleDone={toggleDone} lang={lang} tensionIdxs={tensionIdxs} streak={streak} isSubscriber={isSubscriber} onActivateSubscription={openPaywall} onTryFreeSession={() => setFreeDetailVisible(true)} onOpenTimer={() => setShowStretchTimer(true)} saveHealthKitWorkout={saveHealthKitWorkout} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[1]} options={{ tabBarIcon: (props) => <TabIconResume {...props} /> }}>{() => <ResumeScreen done={done} lang={lang} streak={streak} prenom={prenom} tensionIdxs={tensionIdxs} supaUser={supaUser} onCreateAccount={function() { setShowAuthScreen(true); }} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[2]} options={{ tabBarIcon: (props) => <TabIconBiblio {...props} /> }}>{() => <Biblio lang={lang} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[3]} options={{ tabBarIcon: (props) => <TabIconProfil {...props} /> }}>{() => <ProfilScreen prenom={prenom} done={done} lang={lang} streak={streak} supabase={supabase} supaUser={supaUser} onLogout={() => { supabase?.auth.signOut(); }} isSubscriber={isSubscriber} onRestorePurchases={() => { setPaywallVisible(true); }} onReset={resetAllData} />}</Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
      <StretchTimerModal visible={showStretchTimer} onClose={function() { setShowStretchTimer(false); }} lang={lang} />
    </>
  );
}

// ══════════════════════════════════
// APP ROOT
// ══════════════════════════════════
function App() {
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [prenom, setPrenom] = useState('');
  const [lang, setLang] = useState(() => getAppLangFromLocale());
  const [tensionIdxs, setTensionIdxs] = useState([]);
  const [supaUser, setSupaUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const profileLocalRef = useRef({ prenom: '', lang: 'fr', tensionIdxs: [] });
  profileLocalRef.current = { prenom, lang, tensionIdxs };

  useEffect(() => {
    if (__DEV__) {
      console.log('[FluidBody] emojis inline', JSON.stringify({ fire: '🔥', lock: '🔒', check: '✓', play: '▶' }));
    }
  }, []);

  useEffect(() => {
    function friendlyFromEmail(email) {
      if (!email || typeof email !== 'string') return '';
      const local = email.split('@')[0] || '';
      const word = local.replace(/[.+_-]+/g, ' ').trim().split(/\s+/)[0] || '';
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }

    async function fetchAndMergeProfile(user) {
      if (!user?.id || !supabase) return;
      const { data: profile, error: pe } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (pe) devWarn('profiles lecture', pe);

      const meta = user.user_metadata || {};
      const metaKeys = ['prenom', 'first_name', 'firstName', 'given_name', 'name', 'full_name'];
      let metaName = '';
      for (const k of metaKeys) {
        const v = meta[k];
        if (v != null && String(v).trim()) {
          metaName = String(v).trim();
          break;
        }
      }

      const dbPrenom = profile?.prenom != null && String(profile.prenom).trim();
      const localPrenom = profileLocalRef.current.prenom != null && String(profileLocalRef.current.prenom).trim();
      const resolved = dbPrenom || metaName || localPrenom || '';
      const displayPrenom = resolved || friendlyFromEmail(user.email);

      setPrenom(prev => displayPrenom || prev);
      if (profile?.lang) setLang(profile.lang);
      if (Array.isArray(profile?.tension_idxs)) setTensionIdxs(profile.tension_idxs);

      if (!dbPrenom && (metaName || localPrenom)) {
        const prenomToStore = metaName || localPrenom;
        const pl = profileLocalRef.current;
        const { error: upErr } = await supabase.from('profiles').upsert({
          id: user.id,
          prenom: prenomToStore,
          lang: profile?.lang || pl.lang || 'fr',
          tension_idxs: Array.isArray(profile?.tension_idxs) ? profile.tension_idxs : (Array.isArray(pl.tensionIdxs) ? pl.tensionIdxs : []),
          updated_at: new Date().toISOString(),
        });
        if (upErr) devWarn('profiles upsert hydrate', upErr);
        else setPrenom(prenomToStore);
      }
    }

    async function checkSession() {
      try {
        if (!supabase) { setLoading(false); return; }
        const { data: { session }, error: se } = await supabase.auth.getSession();
        if (se) devWarn('getSession', se);
        if (session?.user) {
          setSupaUser(session.user);
          await fetchAndMergeProfile(session.user);
          setShowAuth(false);
          setOnboardingDone(true);
        }
      } catch (e) { devWarn('Session / profil', e); }
      setLoading(false);
    }
    checkSession();
    if (!supabase) return undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSupaUser(session?.user || null);
      if (session?.user) {
        try {
          await fetchAndMergeProfile(session.user);
          setShowAuth(false);
          setOnboardingDone(true);
        } catch (e) { devWarn('Profil après connexion', e); }
      }
    });
    return () => subscription?.unsubscribe();
  }, []);

  async function handleOnboardingDone(p, l, t) {
    setPrenom(p); setLang(l); setTensionIdxs(t); setOnboardingDone(true);
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    try {
      await supabase.from('profiles').upsert({
        id: session.user.id,
        prenom: String(p ?? '').trim(),
        lang: l,
        tension_idxs: Array.isArray(t) ? t : [],
        updated_at: new Date().toISOString(),
      });
    } catch (e) { devWarn('Supabase profiles upsert', e); }
  }

  async function completeOnboarding(p, l, t, opts) {
    await handleOnboardingDone(p, l, t);
    if (!supabase) { setShowAuth(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user && !opts?.skipCloudAuth) setShowAuth(true);
    else setShowAuth(false);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000e18', alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <View style={{ width: 88, height: 88, marginRight: 14, overflow: 'visible' }} pointerEvents="none">
            <MeduseCornerIcon size={88} breathCycleMs={3000} />
          </View>
          <Text style={{ color: 'rgba(0,210,250,0.6)', fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' }}>FluidBody Pilates</Text>
        </View>
      </View>
    );
  }

  if (!onboardingDone) {
    return <OnboardingScreen initialLang={lang} onDone={(p, l, t, o) => { completeOnboarding(p, l, t, o); }} />;
  }

  if (showAuth && !supaUser) {
    return <AuthScreen onSkip={() => setShowAuth(false)} lang={lang} prenomHint={prenom} langForProfile={lang} tensionIdxsForProfile={tensionIdxs} />;
  }

  return <MainApp prenom={prenom} lang={lang} tensionIdxs={tensionIdxs} supabase={supabase} supaUser={supaUser} />;
}

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoRow: { position: 'absolute', top: 58, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 8, gap: 10 },
  logoWordmark: { fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 },
  metrics: { position: 'absolute', bottom: 30, left: 16, right: 16, flexDirection: 'row', gap: 8 },
  metricShell: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  metricBlurInner: { padding: 10, alignItems: 'center', justifyContent: 'center', minHeight: 64 },
  metricWebFallback: { backgroundColor: 'rgba(255,255,255,0.14)' },
  mval: { fontSize: 20, fontWeight: '500', color: '#fff' },
  mlbl: { fontSize: 9, fontWeight: '200', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)', marginTop: 3 },
  btnCtaLarge: { alignSelf: 'stretch', height: 48, borderRadius: 24, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center' },
  btnCtaOff: { opacity: 0.3 },
  btnCtaLargeTxt: { fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 0.5 },
  statCard: { flex: 1, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 14, alignItems: 'center' },
  statLbl: { fontSize: 9, fontWeight: '200', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(174,239,77,0.6)' },
});