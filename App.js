import 'react-native-url-polyfill/auto';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, Animated, Easing, View, TouchableOpacity, Pressable, ScrollView, TextInput, Dimensions, Alert, Modal, Platform, AppState, KeyboardAvoidingView, PanResponder, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
// ─── SENTRY ───────────────────────────────────────────────────────────────────
// Init AVANT tout import qui pourrait throw. Safe-require pour Expo Go.
// DSN absent → Sentry no-op (les helpers `Sentry.*` restent appelables).
let Sentry = null;
try { Sentry = require('@sentry/react-native'); } catch (e) {}
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';
if (Sentry && SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      enableNative: true,
      enableNativeCrashHandling: true,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0,
      debug: false,
      environment: __DEV__ ? 'development' : 'production',
      beforeSend(event) {
        if (event?.user) {
          delete event.user.email;
          delete event.user.ip_address;
          delete event.user.username;
        }
        return event;
      },
    });
  } catch (e) {
    if (__DEV__) console.warn('Sentry init failed:', e);
  }
}
function sentryCapture(error, ctx) {
  if (!Sentry || !SENTRY_DSN) return;
  try {
    if (ctx) Sentry.withScope(scope => {
      Object.entries(ctx).forEach(([k, v]) => scope.setExtra(k, v));
      Sentry.captureException(error);
    });
    else Sentry.captureException(error);
  } catch (e) {}
}
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
let AppleAuth = null;
try { AppleAuth = require('expo-apple-authentication'); } catch(e) {}
let DateTimePicker = null;
try { DateTimePicker = require('@react-native-community/datetimepicker').default; } catch(e) {}
let AppleHealthKit = null;
try {
  AppleHealthKit = require('react-native-health').default || require('react-native-health');
} catch (e) {
  if (__DEV__) console.warn('react-native-health unavailable:', e);
}
import { useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Path, Circle, Ellipse, Line, Rect, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import { Video, ResizeMode, Audio } from 'expo-av';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ViewShot from 'react-native-view-shot';
import { U_JELLY, U_WAVE, FREE_SEANCE_INDEX, ZONE_TO_PILIER, T, SEANCES_FR, SEANCES_EN, PILIERS_BASE, PILIER_IMAGES, SABRINA_QUOTES } from './src/constants/data';
import { Linking as RNLinking } from 'react-native';
import { Bulle, Rayon, Meduse, MeduseCornerIcon, VideoPlaceholderMeduse, BULLES, BULLES_MONCORPS, BULLES_ONBOARDING, MEDUSA_STATES, MEDUSA_STATE_NAMES, getMeduseState, LivingMedusa, FloatingMedusas, MeduseRain, PluieBulles } from './src/components/Meduse';
import VideoPlayer, { VIDEO_RESUME_PREFIX } from './src/components/VideoPlayer';
import supabase from './src/lib/supabase';
import PaywallModal, { PRODUCT_IDS } from './src/components/PaywallModal';
import StretchTimerModal from './src/components/Timer';
import AnimatedPlus from './src/components/AnimatedPlus';
import PilierCard from './src/components/PilierCard';
import GlassButton from './src/components/GlassButton';
import Confetti from './src/components/Confetti';
import LivingBackground from './src/components/LivingBackground';
import SignInScreen from './src/screens/SignIn';
import HealthKitConnectScreen from './src/screens/HealthKitConnect';
import MonCorps, { MetricTile } from './src/screens/MonCorps';
import { getPiliers, getSeances, getSeanceDuJour, canAccessSeanceIndex, getResumeIndicesForPilier, hapticLight, hapticSuccess } from './src/utils';
import { LogBox } from 'react-native';

// ─── GLOBAL ERROR HANDLER (PROD ONLY) ─────────────────────────────────────────
// En prod : on envoie l'erreur à Sentry et on affiche un message générique.
// Si Sentry n'est pas configuré (DSN vide), on affiche quand même un message
// utilisateur — pas de stack trace exposée en TestFlight.
let __fatalAlertShown = false;
if (!__DEV__) {
  if (typeof ErrorUtils !== 'undefined' && ErrorUtils.getGlobalHandler) {
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      sentryCapture(error, { isFatal: !!isFatal, source: 'globalHandler' });
      if (isFatal && !__fatalAlertShown) {
        __fatalAlertShown = true;
        setTimeout(() => {
          Alert.alert(
            'Une erreur est survenue',
            "L'équipe a été notifiée. Tu peux relancer l'app.",
            [{ text: 'OK', onPress: () => { __fatalAlertShown = false; } }]
          );
        }, 100);
      }
      if (typeof originalHandler === 'function') originalHandler(error, isFatal);
    });
  }
  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    try {
      process.on('unhandledRejection', (reason) => {
        sentryCapture(reason instanceof Error ? reason : new Error(String(reason)), { source: 'unhandledRejection' });
      });
    } catch (e) {}
  }
}

// ── HEALTHKIT ──────────────────────────────────────────
// NOTE: NE PAS accéder à AppleHealthKit.Constants ici (load time).
// L'accès traverse le bridge natif et peut throw NSException si HKHealthStore
// n'est pas correctement init → crash Hermes au démarrage de l'app.
// Les permissions sont calculées LAZILY dans initHealthKit().

let hkInitialized = false;

function buildHkPermissions() {
  if (!AppleHealthKit) return null;
  try {
    const C = (AppleHealthKit.Constants && AppleHealthKit.Constants.Permissions) || {};
    return {
      permissions: {
        read: [C.ActiveEnergyBurned, C.AppleExerciseTime, C.AppleStandTime, C.Workout].filter(Boolean),
        write: [C.ActiveEnergyBurned, C.Workout].filter(Boolean),
      },
    };
  } catch (e) {
    if (__DEV__) console.warn('HK perms throw:', e);
    return null;
  }
}

function initHealthKit() {
  if (!AppleHealthKit || hkInitialized || Platform.OS !== 'ios') return;
  const perms = buildHkPermissions();
  if (!perms) return;
  try {
    AppleHealthKit.initHealthKit(perms, function(err) {
      if (err) { if (__DEV__) devLog('HealthKit init error:', err); return; }
      hkInitialized = true;
      if (__DEV__) devLog('HealthKit initialized');
    });
  } catch (e) {
    if (__DEV__) console.warn('HealthKit init throw:', e);
  }
}

function saveHealthKitWorkout(durationMinutes) {
  if (!AppleHealthKit || !hkInitialized || Platform.OS !== 'ios') return;
  try {
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
        if (err) devLog('HealthKit workout save error:', err);
        else devLog('HealthKit workout saved:', durationMinutes + 'min, ' + calories + 'cal');
      }
    });
  } catch (e) {
    if (__DEV__) console.warn('HealthKit save throw:', e);
  }
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

function devLog(...args) {
  if (__DEV__) console.log('[FluidBody]', ...args);
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
  var pillH = 50;
  var BAR_H = 60;
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
    <View style={{ position: 'absolute', bottom: 24, left: 20, right: 20, height: BAR_H, zIndex: 1000, elevation: 12, shadowColor: '#ffffff', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }} {...panResponder.panHandlers}>
      <View style={{ flex: 1, borderRadius: BAR_H / 2, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }}>
        <BlurView intensity={Platform.OS === 'ios' ? 40 : 0} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,20,35,0.45)' }} />
        <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} locations={[0, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%' }} pointerEvents="none" />
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']} locations={[0, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' }} pointerEvents="none" />
        <Animated.View style={{ position: 'absolute', top: (BAR_H - pillH) / 2, left: 0, width: pillW, height: pillH, borderRadius: pillH / 2, backgroundColor: 'rgba(174,239,77,0.15)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.4)', transform: [{ translateX: indicatorX }] }}>
          <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']} locations={[0, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', borderTopLeftRadius: pillH / 2, borderTopRightRadius: pillH / 2 }} pointerEvents="none" />
        </Animated.View>
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
            <TouchableOpacity key={route.key} onPress={onPress} activeOpacity={0.7} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: BAR_H }}>
              {IconComp && IconComp({ color: color, size: 20, focused: isFocused })}
              <Text style={{ fontSize: 10, fontWeight: '600', color: color, marginTop: 2, letterSpacing: 0.2 }}>{route.name}</Text>
            </TouchableOpacity>
          );
        })}
        </View>
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
        {/* Cloche translucide */}
        <Path d="M5.5 10.5C4.5 7 6.5 2.5 12 2.5s7.5 4.5 6.5 8c-0.4 1.3-1.8 2.2-3.3 2C14 12.8 13 13 12 13s-2-0.2-3.2-0.5C7.3 12.7 5.9 11.8 5.5 10.5Z" fill={c} opacity={0.2} />
        <Path d="M5.5 10.5C4.5 7 6.5 2.5 12 2.5s7.5 4.5 6.5 8c-0.4 1.3-1.8 2.2-3.3 2C14 12.8 13 13 12 13s-2-0.2-3.2-0.5C7.3 12.7 5.9 11.8 5.5 10.5Z" stroke={c} strokeWidth={1} strokeLinecap="round" />
        {/* Reflet haut */}
        <Path d="M8 5.5Q10 4 12.5 4" stroke={c} strokeWidth={0.7} strokeLinecap="round" opacity={0.6} />
        {/* Bord festonné */}
        <Path d="M7 11.5Q8.5 12.8 10 12.2Q11 12.8 12 12.8Q13 12.8 14 12.2Q15.5 12.8 17 11.5" stroke={c} strokeWidth={0.7} strokeLinecap="round" opacity={0.5} fill="none" />
        {/* Canaux internes */}
        <Path d="M10 8Q11 7 12 7" stroke={c} strokeWidth={0.5} strokeLinecap="round" opacity={0.3} />
        <Path d="M14 8Q13 7 12 7" stroke={c} strokeWidth={0.5} strokeLinecap="round" opacity={0.3} />
        {/* Tentacules ondulants */}
        <Path d="M9.5 13C9 14.5 8.5 16 8 18" stroke={c} strokeWidth={0.8} strokeLinecap="round" opacity={0.5} />
        <Path d="M12 13C12 14.5 11.8 16.5 11.5 19" stroke={c} strokeWidth={0.8} strokeLinecap="round" opacity={0.5} />
        <Path d="M14.5 13C15 14.5 15.5 16 16 18" stroke={c} strokeWidth={0.8} strokeLinecap="round" opacity={0.5} />
        <Path d="M10.5 13C10.2 15 9.8 17 10 19.5" stroke={c} strokeWidth={0.5} strokeLinecap="round" opacity={0.3} />
        <Path d="M13.5 13C13.8 15 14.2 17 14 19.5" stroke={c} strokeWidth={0.5} strokeLinecap="round" opacity={0.3} />
        {/* Points lumineux */}
        <Circle cx="9.5" cy="6.5" r="0.5" fill={c} opacity={0.6} />
        <Circle cx="14.5" cy="6.5" r="0.5" fill={c} opacity={0.6} />
        <Circle cx="12" cy="4" r="0.6" fill={c} opacity={0.8} />
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

// TabIconTimer moved to src/screens/MonCorps.js

const Tab = createBottomTabNavigator();
const { width: SW, height: SH } = Dimensions.get('window');
const IS_IPAD = SW >= 768;
const SCALE = IS_IPAD ? SW / 390 : 1; // Scale factor relative to iPhone 390px
const SUPPORTED_APP_LANGS = ['fr', 'en'];

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
const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_RC_API_KEY_IOS || '';

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
      <LinearGradient pointerEvents="none" colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
      <LivingBackground />
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
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: 34 }}>+</AnimatedPlus></Text>
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
                    <ExpoImage source={PILIER_IMAGES[p.key]} contentFit="cover" cachePolicy="memory-disk" style={{ flex: 1 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '300', color: '#ffffff' }}>{p.label}</Text>
                      {isRec && <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(174,239,77,0.15)', borderWidth: 0.5, borderColor: 'rgba(174,239,77,0.5)' }}><Text style={{ fontSize: 8, color: '#AEEF4D', letterSpacing: 1 }}>{'\u2605'} {tr.recommande_pour_toi}</Text></View>}
                    </View>
                    <Text style={{ fontSize: 11, color: '#AEEF4D', letterSpacing: 1, marginTop: 3 }}>{count}/5{count === 5 ? ' \u2713' : ''}</Text>
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '200', color: '#AEEF4D' }}>{pct2 + '%'}</Text>
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
          <ExpoImage source={PILIER_IMAGES[sdj.pilier.key]} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.7)"]} style={{ flex: 1 }}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ position: "absolute", top: 56, left: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18, color: "#ffffff" }}>{"\u2190"}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>{tr.free_try_once}</Text>
          <Text style={{ fontSize: 28, fontWeight: "800", color: "#ffffff", marginBottom: 10 }}>{titre}</Text>
          <Text style={{ fontSize: 15, fontWeight: "600", color: "#00BDD0", marginBottom: 6 }}>{sdj.pilier.label}</Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>{duree} · {tr.etapes[etape] || etape}</Text>
          <GlassButton
            onPress={function() { onPlay && onPlay(); }}
            size="lg"
            textColor="#AEEF4D"
            textStyle={{ fontSize: 17 }}
            style={{ marginBottom: 14 }}
          >
            {tr.free_go}
          </GlassButton>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ══════════════════════════════════
// AUTH SCREEN — Email + mot de passe (Supabase), après onboarding si pas de session
// ══════════════════════════════════
function AuthScreen({ onSkip, onSuccess, lang = 'fr', prenomHint = '', langForProfile = 'fr', tensionIdxsForProfile = [] }) {
  const tr = T[lang] || T.fr;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPass = password.length >= 6;
  const canSubmit = validEmail && validPass && !loading;
  const appleAvailable = !!AppleAuth && Platform.OS === 'ios';

  async function postAuthProfileSync(extraPrenom) {
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const finalPrenom = String(extraPrenom || prenomHint || session.user.user_metadata?.prenom || '').trim();
      if (finalPrenom) {
        // fire-and-forget — ne pas bloquer l'upsert profiles
        supabase.auth.updateUser({ data: { prenom: finalPrenom } }).catch(function(e) { devWarn('updateUser metadata (bg)', e); });
      }
      try {
        await supabase.from('profiles').upsert({
          id: session.user.id,
          prenom: finalPrenom,
          lang: langForProfile || lang,
          tension_idxs: Array.isArray(tensionIdxsForProfile) ? tensionIdxsForProfile : [],
          updated_at: new Date().toISOString(),
        });
      } catch (e) { devWarn('profiles upsert post-auth', e); }
    } catch(e) { devWarn('postAuthProfileSync', e); }
  }

  async function handleEmailAuth(mode) {
    if (!supabase) return;
    const em = email.trim().toLowerCase();
    if (!validEmail) { setError(tr.ob_auth_err_email); return; }
    if (!validPass) { setError(tr.ob_auth_err_short); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'up') {
        const { data, error: err } = await supabase.auth.signUp({
          email: em,
          password,
          options: { data: { prenom: String(prenomHint || '').trim().slice(0, 50).replace(/[<>]/g, '') } },
        });
        if (err) { setError(err.message); setLoading(false); return; }
        if (!data.session) { setError(tr.ob_auth_confirm); setLoading(false); return; }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: em, password });
        if (err) { setError(err.message); setLoading(false); return; }
      }
      setLoading(false);
      onSuccess && onSuccess();
      postAuthProfileSync().catch(function(e) { devWarn('postAuthProfileSync (background)', e); });
      return;
    } catch (e) {
      setError(tr.ob_auth_err_net);
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    if (!supabase) { Alert.alert('FluidBody+', 'Supabase indisponible.'); return; }
    if (!AppleAuth) { Alert.alert('Apple Sign In', 'Module expo-apple-authentication non chargé. Vérifie le plugin dans app.json.'); return; }
    if (!appleAvailable) {
      Alert.alert('FluidBody+', tr.auth_apple_unavailable || 'Sign in with Apple est disponible sur iOS uniquement.');
      return;
    }
    setLoading(true); setError('');
    try {
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        const msg = 'Apple identity token manquant.';
        setError(msg); Alert.alert('Apple Sign In', msg);
        setLoading(false); return;
      }
      const { error: err } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (err) {
        setError(err.message); Alert.alert('Apple Sign In — Supabase', err.message || 'Erreur Supabase');
        setLoading(false); return;
      }
      const applePrenom = credential.fullName?.givenName || '';
      setLoading(false);
      onSuccess && onSuccess();
      postAuthProfileSync(applePrenom).catch(function(e) { devWarn('postAuthProfileSync apple (background)', e); });
      return;
    } catch (e) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        const msg = e?.message || tr.ob_auth_err_net || 'Erreur Apple Sign In';
        setError(msg);
        Alert.alert('Apple Sign In — erreur', `${msg}\n\nCode: ${e?.code || 'n/a'}`);
      }
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000e18' }}>
      <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        {BULLES.map((b, i) => <Bulle key={`auth-${i}`} {...b} />)}
      </View>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} pointerEvents="none">
        <FloatingMedusas />
      </View>
      <BlurView intensity={Platform.OS === 'ios' ? 30 : 0} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,20,35,0.4)' }} pointerEvents="none" />

      <View style={{ paddingTop: 58, paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: 28 }}>+</AnimatedPlus></Text>
        {onSkip ? (
          <GlassButton
            onPress={onSkip}
            size="sm"
            fullWidth={false}
            textColor="rgba(255,255,255,0.7)"
            textStyle={{ fontSize: 13, fontWeight: '500' }}
            style={{ paddingHorizontal: 4 }}
          >
            {tr.first_seance_later || 'Plus tard'}
          </GlassButton>
        ) : null}
      </View>

      <KeyboardAvoidingView style={{ flex: 1, zIndex: 2 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32 }} keyboardShouldPersistTaps="handled">

          <View style={{ alignItems: 'center', marginBottom: 36 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#ffffff', textAlign: 'center', letterSpacing: -0.4, marginBottom: 8 }}>{tr.ob_auth_title}</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 20 }}>{tr.ob_auth_sub}</Text>
          </View>

          {appleAvailable ? (
            <GlassButton
              onPress={handleAppleSignIn}
              loading={loading}
              size="md"
              style={{ marginBottom: 20 }}
              leftIcon={
                <Svg width={18} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C3.79 16.17 4.36 9.04 8.72 8.78c1.34.07 2.27.74 3.06.8.93-.19 1.82-.73 2.82-.66 1.19.1 2.09.58 2.68 1.49-2.45 1.47-1.87 4.71.36 5.62-.45 1.17-.66 1.7-1.23 2.73-.82 1.46-1.97 2.92-3.36 2.95zM12.13 8.65c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="#ffffff" />
                </Svg>
              }
            >
              {tr.auth_apple || 'Continuer avec Apple'}
            </GlassButton>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 18 }}>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.12)' }} />
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginHorizontal: 14, letterSpacing: 1, textTransform: 'uppercase' }}>{tr.auth_or || 'ou'}</Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(255,255,255,0.12)' }} />
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={tr.ob_email_ph}
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            style={{ width: '100%', height: 52, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: email ? 'rgba(174,239,77,0.5)' : 'rgba(255,255,255,0.12)', borderRadius: 12, color: '#ffffff', fontSize: 15, paddingHorizontal: 16, marginBottom: 10 }}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={tr.ob_pass_ph}
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            style={{ width: '100%', height: 52, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: password ? 'rgba(174,239,77,0.5)' : 'rgba(255,255,255,0.12)', borderRadius: 12, color: '#ffffff', fontSize: 15, paddingHorizontal: 16, marginBottom: 14 }}
          />

          {error ? <Text style={{ color: 'rgba(255,120,120,0.95)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</Text> : null}

          <GlassButton
            onPress={() => handleEmailAuth('in')}
            disabled={!canSubmit}
            loading={loading}
            textColor="#AEEF4D"
            style={{ marginBottom: 10 }}
          >
            {loading ? '…' : (tr.ob_auth_submit_in || 'Se connecter')}
          </GlassButton>

          <GlassButton
            onPress={() => handleEmailAuth('up')}
            disabled={!canSubmit}
            textColor="#AEEF4D"
            textStyle={{ fontSize: 15, fontWeight: '600' }}
          >
            {tr.ob_auth_submit_up || 'Créer un compte'}
          </GlassButton>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ══════════════════════════════════
// ONBOARDING
// ══════════════════════════════════
function OnboardingScreen({ onDone, initialLang, onSwitchToSignIn }) {
  const [lang] = useState(() => initialLang ?? getAppLangFromLocale());
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailExistsErr, setEmailExistsErr] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const authOpacity = useRef(new Animated.Value(0)).current;
  const authTranslateY = useRef(new Animated.Value(-260)).current;

  useEffect(() => {
    const t = setTimeout(() => setAuthVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!authVisible) return;
    const entrance = Animated.parallel([
      Animated.timing(authOpacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(authTranslateY, { toValue: 0, damping: 18, stiffness: 90, mass: 1, useNativeDriver: true }),
    ]);
    entrance.start();
    return () => {
      try { entrance.stop && entrance.stop(); } catch (e) {}
      try { authOpacity.removeAllListeners(); authTranslateY.removeAllListeners(); } catch (e) {}
    };
  }, [authVisible]);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPass = password.length >= 6;
  const canSubmit = validEmail && validPass && !loading;
  const appleAvailable = !!AppleAuth && Platform.OS === 'ios';

  const floatingMedusas = useRef([
    { baseX: SW - 80, baseY: SH * 0.12, size: 72, breath: 3200, dx: new Animated.Value(0), dy: new Animated.Value(0) },
    { baseX: 30, baseY: SH * 0.4, size: 58, breath: 3600, dx: new Animated.Value(0), dy: new Animated.Value(0) },
    { baseX: SW * 0.5, baseY: SH * 0.65, size: 50, breath: 4000, dx: new Animated.Value(0), dy: new Animated.Value(0) },
    { baseX: SW * 0.75, baseY: SH * 0.8, size: 44, breath: 3800, dx: new Animated.Value(0), dy: new Animated.Value(0) },
  ]).current;

  useEffect(() => {
    let mounted = true;
    const currentDrifts = [];
    floatingMedusas.forEach(function(m, i) {
      function drift() {
        if (!mounted) return;
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 60 + Math.random() * (SH - m.size - 160);
        var dur = 12000 + Math.random() * 8000;
        var p = Animated.parallel([
          Animated.timing(m.dx, { toValue: toX - m.baseX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
          Animated.timing(m.dy, { toValue: toY - m.baseY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
        ]);
        currentDrifts[i] = p;
        p.start(function() { if (mounted) drift(); });
      }
      drift();
    });
    return () => {
      mounted = false;
      currentDrifts.forEach((d) => { try { d && d.stop && d.stop(); } catch (e) {} });
    };
  }, []);

  function finish() { onDone('', lang, [], { skipCloudAuth: true }); }

  async function handleEmailAuth(mode) {
    if (!supabase) { Alert.alert('FluidBody+', 'Supabase indisponible.'); return; }
    const em = email.trim().toLowerCase();
    if (!validEmail) { setError(tr.ob_auth_err_email); return; }
    if (!validPass) { setError(tr.ob_auth_err_short); return; }
    setLoading(true); setError(''); setEmailExistsErr(false);
    try {
      if (mode === 'up') {
        const { data, error: err } = await supabase.auth.signUp({ email: em, password });
        if (err) {
          const msg = (err.message || '').toLowerCase();
          if (msg.includes('already') || msg.includes('exists') || msg.includes('registered') || msg.includes('déjà')) {
            setEmailExistsErr(true);
            setError(isFr ? 'Cet email est déjà utilisé. Connecte-toi plutôt ?' : 'This email is already in use. Sign in instead?');
          } else {
            setError(err.message);
          }
          setLoading(false); return;
        }
        if (!data.session) { setError(tr.ob_auth_confirm); setLoading(false); return; }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: em, password });
        if (err) { setError(err.message); setLoading(false); return; }
      }
      setLoading(false);
      finish();
    } catch (e) {
      setError(tr.ob_auth_err_net);
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    if (!supabase) { Alert.alert('FluidBody+', 'Supabase indisponible.'); return; }
    if (!AppleAuth) { Alert.alert('Apple Sign In', 'Module expo-apple-authentication non chargé. Vérifie le plugin dans app.json.'); return; }
    if (!appleAvailable) { Alert.alert('FluidBody+', 'Sign in with Apple disponible sur iOS uniquement.'); return; }
    setLoading(true); setError('');
    try {
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [AppleAuth.AppleAuthenticationScope.FULL_NAME, AppleAuth.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) {
        const msg = 'Apple identity token manquant.';
        setError(msg); Alert.alert('Apple Sign In', msg);
        setLoading(false); return;
      }
      const { error: err } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
      if (err) {
        setError(err.message); Alert.alert('Apple Sign In — Supabase', err.message || 'Erreur Supabase');
        setLoading(false); return;
      }
      setLoading(false);
      finish();
    } catch (e) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        const msg = e?.message || tr.ob_auth_err_net || 'Erreur Apple Sign In';
        setError(msg);
        Alert.alert('Apple Sign In — erreur', `${msg}\n\nCode: ${e?.code || 'n/a'}`);
      }
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      {BULLES_ONBOARDING.map((b, i) => <Bulle key={`ob-${i}`} {...b} />)}
      <View style={{ position: 'absolute', top: 298, left: 0, right: 0, alignItems: 'center', opacity: 0.9, zIndex: 0 }} pointerEvents="none">
        <Meduse />
      </View>
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
              FLUIDBODY<AnimatedPlus
                style={{
                  fontWeight: '700',
                  fontSize: 260,
                  letterSpacing: 1,
                  marginLeft: 40,
                  color: '#E5FF00',
                  textShadowColor: 'rgba(0, 0, 0, 0.4)',
                  textShadowOffset: { width: 0, height: 3 },
                  textShadowRadius: 14,
                  ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
                }}
              >+</AnimatedPlus>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'nowrap', marginTop: -2, width: '100%', paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 28, fontWeight: '400', color: '#E5FF00', letterSpacing: 16, textTransform: 'uppercase', textShadowColor: 'rgba(0, 12, 28, 0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10, ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}) }}>PILATES</Text>
            <Text style={{ marginLeft: 14, fontSize: 28, fontWeight: '300', color: '#E5FF00', letterSpacing: 2, textShadowColor: 'rgba(0, 12, 28, 0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6, ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}) }}>{'& More'}</Text>
          </View>
        </View>
      </View>
      {floatingMedusas.map(function(m, i) {
        return (
          <Animated.View key={'fm-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 0, opacity: 0.7, left: m.baseX, top: m.baseY, transform: [{ translateX: m.dx }, { translateY: m.dy }] }}>
            <MeduseCornerIcon size={m.size} breathCycleMs={m.breath} breathMaxScale={1.35} tint="rgba(174,239,77,1)" />
          </Animated.View>
        );
      })}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30 }}>
        <Animated.View
          pointerEvents={authVisible ? 'auto' : 'none'}
          style={{ paddingHorizontal: 28, paddingBottom: 32, paddingTop: 16, backgroundColor: 'rgba(0,14,24,0.55)', opacity: authOpacity, transform: [{ translateY: authTranslateY }] }}
        >
          {appleAvailable ? (
            <GlassButton
              onPress={handleAppleSignIn}
              loading={loading}
              size="md"
              style={{ marginBottom: 16 }}
              leftIcon={
                <Svg width={18} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C3.79 16.17 4.36 9.04 8.72 8.78c1.34.07 2.27.74 3.06.8.93-.19 1.82-.73 2.82-.66 1.19.1 2.09.58 2.68 1.49-2.45 1.47-1.87 4.71.36 5.62-.45 1.17-.66 1.7-1.23 2.73-.82 1.46-1.97 2.92-3.36 2.95zM12.13 8.65c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="#ffffff" />
                </Svg>
              }
            >
              {tr.auth_apple || 'Continuer avec Apple'}
            </GlassButton>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(229,255,0,0.25)' }} />
            <Text style={{ fontSize: 11, color: '#E5FF00', marginHorizontal: 14, letterSpacing: 1, textTransform: 'uppercase' }}>{tr.auth_or || 'ou'}</Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(229,255,0,0.25)' }} />
          </View>
          <TextInput
            value={email} onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            placeholder={tr.ob_email_ph}
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!loading}
            style={{ width: '100%', height: 48, backgroundColor: emailFocused ? 'rgba(229,255,0,0.06)' : 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: emailFocused ? '#E5FF00' : 'rgba(255,255,255,0.25)', borderRadius: 25, color: '#ffffff', fontSize: 15, paddingHorizontal: 18, marginBottom: 8 }}
          />
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 14, marginBottom: 10, paddingHorizontal: 2 }}>
            En continuant, tu acceptes nos Conditions d'utilisation et notre{' '}
            <Text onPress={function() { RNLinking.openURL('https://yvan-glitch.github.io/fluidbody-privacy/'); }} style={{ color: 'rgba(174,239,77,0.7)', textDecorationLine: 'underline' }}>Politique de confidentialité</Text>
          </Text>
          <TextInput
            value={password} onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            placeholder={tr.ob_pass_ph}
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!loading}
            style={{ width: '100%', height: 48, backgroundColor: passwordFocused ? 'rgba(229,255,0,0.06)' : 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: passwordFocused ? '#E5FF00' : 'rgba(255,255,255,0.25)', borderRadius: 25, color: '#ffffff', fontSize: 15, paddingHorizontal: 18, marginBottom: 10 }}
          />
          {error ? (
            emailExistsErr ? (
              <View style={{ marginBottom: 10, padding: 10, borderRadius: 14, backgroundColor: 'rgba(229,255,0,0.06)', borderWidth: 1, borderColor: 'rgba(229,255,0,0.4)' }}>
                <Text style={{ color: 'rgba(255,220,140,0.95)', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{error}</Text>
                <TouchableOpacity onPress={() => onSwitchToSignIn && onSwitchToSignIn(email)} activeOpacity={0.85} style={{ alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#AEEF4D' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D' }}>{tr.ob_auth_submit_in || 'Se connecter'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ color: 'rgba(255,140,140,0.95)', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{error}</Text>
            )
          ) : null}
          <GlassButton
            onPress={() => handleEmailAuth('up')}
            disabled={!canSubmit}
            loading={loading}
            textColor="#AEEF4D"
          >
            {loading ? '…' : (tr.ob_auth_submit_up || 'Créer un compte')}
          </GlassButton>

          <TouchableOpacity onPress={() => onSwitchToSignIn && onSwitchToSignIn(email)} disabled={loading} activeOpacity={0.7} style={{ alignItems: 'center', paddingVertical: 12, marginTop: 6 }}>
            <Text style={{ fontSize: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.55)' }}>{isFr ? 'Déjà un compte ?  ' : 'Already have an account?  '}</Text>
              <Text style={{ color: '#AEEF4D', textDecorationLine: 'underline' }}>{isFr ? 'Se connecter ›' : 'Sign in ›'}</Text>
            </Text>
          </TouchableOpacity>

          <GlassButton
            onPress={finish}
            loading={loading}
            size="sm"
            textColor="rgba(255,255,255,0.7)"
            style={{ marginTop: 4 }}
            textStyle={{ fontSize: 13, fontWeight: '500' }}
          >
            {tr.first_seance_later || 'Plus tard'}
          </GlassButton>
        </Animated.View>
      </KeyboardAvoidingView>
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
    var savedHour = parseInt(await AsyncStorage.getItem('fluid_notif_hour')) || 9;
    var pauseEnabled = (await AsyncStorage.getItem('fluid_notif_pause_enabled')) !== 'false';
    var quoteEnabled = (await AsyncStorage.getItem('fluid_quote_enabled')) !== 'false';
    var quoteHour = parseInt(await AsyncStorage.getItem('fluid_quote_hour')) || 8;
    await Notifications.scheduleNotificationAsync({ content: { title: tr.notif_title, body: tr.notif_body, sound: true }, trigger: { hour: savedHour, minute: 0, repeats: true } });
    // Phrase du jour — Sabrina : rotation quotidienne, re-schedulée à chaque ouverture
    if (quoteEnabled) {
      var quotes = SABRINA_QUOTES[lang] || SABRINA_QUOTES['fr'];
      if (quotes && quotes.length) {
        var d = new Date();
        var idx = (d.getDate() + d.getMonth() * 31) % quotes.length;
        await Notifications.scheduleNotificationAsync({
          content: { title: tr.notif_quote_title || 'Phrase du jour', body: quotes[idx], sound: false },
          trigger: { hour: quoteHour, minute: 0, repeats: true },
        });
      }
    }
    // Pause Active — Office : toutes les heures 9h-18h en semaine
    if (pauseEnabled) {
      for (var h = 9; h <= 17; h++) {
        for (var wd = 2; wd <= 6; wd++) {
          await Notifications.scheduleNotificationAsync({
            content: { title: tr.notif_pause_title || 'Pause Active', body: tr.notif_pause_body || 'C\'est le moment de bouger ! 5 min d\'étirements au bureau.', sound: true },
            trigger: { weekday: wd, hour: h, minute: 0, repeats: true },
          });
        }
      }
    }
  } catch(e) {}
}

async function sendWelcomeNotification(prenom, lang = 'fr') {
  try {
    if (!Notifications || !Device || !Device.isDevice) return;
    const WELCOME_KEY = 'fluid_welcome_notif_sent';
    if (await AsyncStorage.getItem(WELCOME_KEY)) return;
    const { status } = await Notifications.getPermissionsAsync();
    var granted = status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return;
    const tr = T[lang] || T['fr'];
    const body = typeof tr.notif_welcome_body === 'function' ? tr.notif_welcome_body(prenom) : tr.notif_welcome_body;
    await Notifications.scheduleNotificationAsync({
      content: { title: tr.notif_welcome_title, body: body, sound: true },
      trigger: { seconds: 3 },
    });
    await AsyncStorage.setItem(WELCOME_KEY, '1');
  } catch(e) {}
}

const FLUID_SUB_KEY = 'fluid_sub';
const DONE_KEY = 'fluidbody_done';

// ══════════════════════════════════
// MAIN APP
// ══════════════════════════════════
function MainApp({ prenom, lang, tensionIdxs, supabase, supaUser, onTensionChange }) {
  const tr = T[lang] || T['fr'];
  const [done, setDone] = useState({
    p1: Array(20).fill(false), p2: Array(20).fill(false), p3: Array(20).fill(false),
    p4: Array(20).fill(false), p5: Array(20).fill(false), p6: Array(20).fill(false), p7: Array(20).fill(false), p8: Array(20).fill(false),
  });
  const [streak, setStreak] = useState(0);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const ADMIN_EMAILS = [
    'qcrm6vkbnx@privaterelay.appleid.com',
    'xvan06@gmail.com',
    'yvan.tissot@icloud.com',
    'sabrina.tissot@icloud.com',
  ];
  const isAdmin = !!(supaUser && supaUser.email && ADMIN_EMAILS.indexOf(supaUser.email.toLowerCase()) !== -1);
  const effectiveIsSubscriber = isSubscriber || isAdmin;
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [freeDetailVisible, setFreeDetailVisible] = useState(false);
  const [freeVideoPlaying, setFreeVideoPlaying] = useState(false);
  const [showFirstSeanceModal, setShowFirstSeanceModal] = useState(false);
  const [milestoneNum, setMilestoneNum] = useState(null);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [showStretchTimer, setShowStretchTimer] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingProfileInitial, setEditingProfileInitial] = useState(null);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [rcPackagesByProductId, setRcPackagesByProductId] = useState({});
  const [rcLoadingPrices, setRcLoadingPrices] = useState(false);

  useEffect(function() { try { initHealthKit(); } catch (e) { if (__DEV__) console.warn('initHealthKit throw:', e); } }, []);

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
      if (__DEV__) devLog('IAP Error:', e);
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
      if (__DEV__) devLog('IAP Error:', e);
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
      if (__DEV__) devLog('IAP Error:', e);
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
        if (__DEV__) devLog('IAP Error:', e);
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
        if (__DEV__) devLog('Loading products...', PRODUCT_IDS);
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
          if (__DEV__) devLog('Products loaded:', map);
        }
      } catch (e) {
        if (__DEV__) devLog('IAP Error:', e);
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
    // Milestone celebrations
    if (!done[key][idx]) {
      var MILESTONES = [5, 10, 15, 20, 25, 30, 35, 40];
      var newTotal = 0;
      Object.values(next).forEach(function(arr) {
        if (arr) arr.forEach(function(v) { if (v) newTotal++; });
      });
      if (MILESTONES.includes(newTotal)) {
        AsyncStorage.getItem('fluid_milestones_seen').then(function(raw) {
          var seen = raw ? JSON.parse(raw) : [];
          if (!seen.includes(newTotal)) {
            seen.push(newTotal);
            AsyncStorage.setItem('fluid_milestones_seen', JSON.stringify(seen));
            setMilestoneNum(newTotal);
          }
        });
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
              isDemo={!effectiveIsSubscriber}
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
              <GlassButton
                onPress={function() { setShowFirstSeanceModal(false); setShowAuthScreen(true); }}
                textColor="#AEEF4D"
                style={{ alignSelf: 'stretch', marginBottom: 12 }}
              >
                {tr.first_seance_create || 'Créer mon compte'}
              </GlassButton>
              <GlassButton
                onPress={function() { setShowFirstSeanceModal(false); }}
                size="sm"
                fullWidth={false}
                textColor="rgba(255,255,255,0.7)"
                textStyle={{ fontSize: 13, fontWeight: '500' }}
              >
                {tr.first_seance_later || 'Plus tard'}
              </GlassButton>
            </View>
          </View>
        </Modal>
      )}
      {showAuthScreen && (
        <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent>
          <AuthScreen onSkip={function() { setShowAuthScreen(false); }} onSuccess={function() { setShowAuthScreen(false); }} lang={lang} prenomHint={prenom} langForProfile={lang} tensionIdxsForProfile={tensionIdxs} />
        </Modal>
      )}
      <NavigationContainer>
          <Tab.Navigator tabBar={function(props) { return <CustomTabBar {...props} />; }} screenOptions={{ headerShown: false }}>
          <Tab.Screen name={tr.tabs[0]} options={{ tabBarIcon: (props) => <TabIconMonCorps {...props} /> }}>{() => <MonCorps prenom={prenom} done={done} toggleDone={toggleDone} lang={lang} tensionIdxs={tensionIdxs} onTensionChange={onTensionChange} streak={streak} isSubscriber={effectiveIsSubscriber} onActivateSubscription={openPaywall} onTryFreeSession={() => setFreeDetailVisible(true)} saveHealthKitWorkout={saveHealthKitWorkout} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[1]} options={{ tabBarIcon: (props) => <TabIconResume {...props} /> }}>{() => <ResumeScreen done={done} lang={lang} streak={streak} prenom={prenom} tensionIdxs={tensionIdxs} supaUser={supaUser} onCreateAccount={function() { setShowAuthScreen(true); }} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[2]} options={{ tabBarIcon: (props) => <TabIconBiblio {...props} /> }}>{() => <Biblio lang={lang} isSubscriber={effectiveIsSubscriber} onActivateSubscription={openPaywall} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[3]} options={{ tabBarIcon: (props) => <TabIconProfil {...props} /> }}>{() => <ProfilScreen prenom={prenom} done={done} lang={lang} streak={streak} supabase={supabase} supaUser={supaUser} onLogout={async () => {
            if (!supabase) { Alert.alert('FluidBody+', 'Supabase indisponible.'); return; }
            try {
              const { error } = await supabase.auth.signOut();
              if (error) { Alert.alert('FluidBody+', error.message || 'Erreur de déconnexion.'); return; }
            } catch (e) {
              Alert.alert('FluidBody+', e?.message || 'Erreur de déconnexion.');
            }
          }} onCreateAccount={() => setShowAuthScreen(true)} isSubscriber={effectiveIsSubscriber} isAdmin={isAdmin} onRestorePurchases={() => { setPaywallVisible(true); }} onReset={resetAllData} onOpenTimer={() => setShowStretchTimer(true)} onEditProfile={(initial) => { setEditingProfileInitial(initial || null); setEditingProfile(true); }} profileRefreshKey={profileRefreshKey} />}</Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
      <StretchTimerModal visible={showStretchTimer} onClose={function() { setShowStretchTimer(false); }} lang={lang} />
      <Modal visible={editingProfile} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={function() { setEditingProfile(false); }}>
        <ProfileSetupScreen
          lang={lang}
          initialData={editingProfileInitial}
          ctaLabel={(T[lang] || T.fr).profile_save_btn || 'Enregistrer'}
          onDone={async function(payload) {
            await handleProfileSetupSave(payload);
            setEditingProfile(false);
            setProfileRefreshKey(function(k) { return k + 1; });
          }}
        />
      </Modal>
      {milestoneNum && (
        <Modal visible={true} transparent animationType="fade" statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,14,24,0.92)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Text style={{ fontSize: 60, marginBottom: 16 }}>🏆</Text>
              <Text style={{ fontSize: 48, fontWeight: '900', color: '#AEEF4D', marginBottom: 8 }}>{milestoneNum}</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12 }}>séances</Text>
              <Text style={{ fontSize: 18, fontWeight: '400', color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 32 }}>{tr['milestone_' + milestoneNum] || 'Bravo !'}</Text>
              <GlassButton
                onPress={function() { setMilestoneNum(null); }}
                fullWidth={false}
                textColor="#AEEF4D"
                style={{ paddingHorizontal: 40 }}
              >
                Continuer
              </GlassButton>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════════════
// WELCOME INTRO (3rd onboarding screen)
// ══════════════════════════════════
function WelcomeIntroScreen({ onDone, lang }) {
  const tr = T[lang] || T.fr;
  const [selectedIdxs, setSelectedIdxs] = useState([]);
  const [confettiActive, setConfettiActive] = useState(false);
  const submittingRef = useRef(false);
  const gridGap = 8;
  const tileW = Math.floor((SW - 32 - gridGap * 2) / 3);
  const tileH = Math.floor(tileW * 1.05);
  const tiles = [PILIER_IMAGES.p1, PILIER_IMAGES.p2, PILIER_IMAGES.p3, PILIER_IMAGES.p4, PILIER_IMAGES.p5, PILIER_IMAGES.p6];
  const zones = tr.ob_zones || [];

  function toggleZone(idx) {
    setSelectedIdxs(function(prev) {
      return prev.indexOf(idx) !== -1 ? prev.filter(function(x) { return x !== idx; }) : prev.concat([idx]);
    });
  }

  function handleSubmit() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    if (selectedIdxs.length === 0) {
      onDone(selectedIdxs);
      return;
    }
    setConfettiActive(true);
    setTimeout(function() { onDone(selectedIdxs); }, 2000);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000a1a' }}>
      <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        {BULLES.map((b, i) => <Bulle key={`wi-${i}`} {...b} />)}
      </View>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} pointerEvents="none">
        <FloatingMedusas />
      </View>
      <View style={{ paddingTop: 58, paddingLeft: 22, alignItems: 'flex-start', zIndex: 5 }} pointerEvents="none">
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: 28 }}>+</AnimatedPlus></Text>
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 24, paddingBottom: 32, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gridGap, justifyContent: 'center', marginBottom: 32 }}>
          {tiles.map(function(src, i) {
            return (
              <View key={'wel-' + i} style={{ width: tileW, height: tileH, borderRadius: 14, overflow: 'hidden' }}>
                <ExpoImage source={src} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
                <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,14,24,0.4)']} style={{ flex: 1 }} />
              </View>
            );
          })}
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', textAlign: 'center', letterSpacing: -0.3, marginBottom: 20, paddingHorizontal: 8 }}>{tr.ob_tensions || 'Où ressens-tu des tensions ?'}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 28, paddingHorizontal: 8 }}>
          {zones.map(function(zone, idx) {
            var active = selectedIdxs.indexOf(idx) !== -1;
            return (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.85}
                onPress={function() { toggleZone(idx); }}
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: active ? 'rgba(174,239,77,0.18)' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.1)' }}
              >
                <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? '#AEEF4D' : 'rgba(255,255,255,0.78)', letterSpacing: 0.1 }}>{zone}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={confettiActive}
          activeOpacity={0.85}
          style={{
            marginHorizontal: 12,
            height: 56,
            borderRadius: 30,
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: '#E5FF00',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: confettiActive ? 0.45 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#E5FF00', letterSpacing: 0.2 }}>
            {tr.welcome_program_cta || 'On va créer ton programme'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      {confettiActive && <Confetti count={70} duration={2000} />}
    </View>
  );
}

// ══════════════════════════════════
// PROFILE SETUP (4th onboarding screen)
// ══════════════════════════════════
function ProfileSetupScreen({ onDone, lang, initialData, ctaLabel }) {
  const tr = T[lang] || T.fr;
  const init = initialData || {};
  const initialBirth = init.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(init.birth_date)
    ? new Date(parseInt(init.birth_date.slice(0, 4), 10), parseInt(init.birth_date.slice(5, 7), 10) - 1, parseInt(init.birth_date.slice(8, 10), 10))
    : null;
  const [firstName, setFirstName] = useState(init.prenom || '');
  const [gender, setGender] = useState(init.gender || null);
  const [birthDate, setBirthDate] = useState(initialBirth);
  const [height, setHeight] = useState(init.height_cm != null ? init.height_cm : null);
  const [weight, setWeight] = useState(init.weight_kg != null ? init.weight_kg : null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [editing, setEditing] = useState(null); // 'date' | 'height' | 'weight' | null
  const [tempBirth, setTempBirth] = useState(initialBirth || new Date(1990, 0, 1));
  const [tempValue, setTempValue] = useState('');

  const genders = [
    { key: 'female', label: tr.profile_gender_female || 'Femme' },
    { key: 'male', label: tr.profile_gender_male || 'Homme' },
    { key: 'other', label: tr.profile_gender_other || 'Autre' },
  ];

  const floatingMedusas = useRef([
    { baseX: SW - 90, baseY: SH * 0.22, size: 70, breath: 3400, dx: new Animated.Value(0), dy: new Animated.Value(0) },
    { baseX: 20, baseY: SH * 0.45, size: 58, breath: 3800, dx: new Animated.Value(0), dy: new Animated.Value(0) },
    { baseX: SW * 0.55, baseY: SH * 0.7, size: 54, breath: 4200, dx: new Animated.Value(0), dy: new Animated.Value(0) },
    { baseX: SW * 0.78, baseY: SH * 0.85, size: 48, breath: 4000, dx: new Animated.Value(0), dy: new Animated.Value(0) },
  ]).current;

  useEffect(() => {
    let mounted = true;
    const currentDrifts = [];
    floatingMedusas.forEach(function(m, i) {
      function drift() {
        if (!mounted) return;
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 60 + Math.random() * (SH - m.size - 200);
        var dur = 14000 + Math.random() * 9000;
        var p = Animated.parallel([
          Animated.timing(m.dx, { toValue: toX - m.baseX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
          Animated.timing(m.dy, { toValue: toY - m.baseY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
        ]);
        currentDrifts[i] = p;
        p.start(function() { if (mounted) drift(); });
      }
      drift();
    });
    return () => {
      mounted = false;
      currentDrifts.forEach((d) => { try { d && d.stop && d.stop(); } catch (e) {} });
    };
  }, []);

  function formatDate(d) {
    if (!d) return null;
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  async function submit() {
    if (submittingRef.current) {
      devLog('[ProfileSetupScreen] submit déjà en cours, tap ignoré');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    const payload = {
      prenom: firstName.trim() || null,
      gender: gender || null,
      birth_date: birthDate ? birthDate.getFullYear() + '-' + String(birthDate.getMonth() + 1).padStart(2, '0') + '-' + String(birthDate.getDate()).padStart(2, '0') : null,
      height_cm: height,
      weight_kg: weight,
    };
    devLog('[ProfileSetupScreen] submit tap — payload:', JSON.stringify(payload), 'onDone defined:', typeof onDone === 'function');
    try {
      if (typeof onDone === 'function') await onDone(payload);
    } catch (e) {
      devLog('[ProfileSetupScreen] onDone threw:', e?.message || String(e));
    }
    submittingRef.current = false;
    setSubmitting(false);
  }

  function openEdit(field) {
    if (field === 'date') {
      setTempBirth(birthDate || new Date(1990, 0, 1));
    } else if (field === 'height') {
      setTempValue(height != null ? String(height) : '');
    } else if (field === 'weight') {
      setTempValue(weight != null ? String(weight) : '');
    }
    setEditing(field);
  }

  function saveEdit() {
    if (editing === 'date') {
      setBirthDate(tempBirth);
    } else if (editing === 'height') {
      const n = parseInt(tempValue, 10);
      setHeight(isFinite(n) && n > 0 ? n : null);
    } else if (editing === 'weight') {
      const n = parseInt(tempValue, 10);
      setWeight(isFinite(n) && n > 0 ? n : null);
    }
    setEditing(null);
  }

  function row(label, value, onPress) {
    const filled = value != null && value !== '';
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          height: 56,
          borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          borderColor: 'rgba(229,255,0,0.3)',
          paddingHorizontal: 18,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '500', color: '#ffffff' }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: filled ? '#ffffff' : 'rgba(255,255,255,0.4)' }}>{value || '—'}</Text>
          <Text style={{ fontSize: 18, color: 'rgba(229,255,0,0.7)', fontWeight: '300' }}>{'›'}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000a1a' }}>
      <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        {BULLES_ONBOARDING.map((b, i) => <Bulle key={`ps-${i}`} {...b} />)}
      </View>
      {floatingMedusas.map(function(m, i) {
        return (
          <Animated.View key={'ps-fm-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 1, opacity: 0.85, left: m.baseX, top: m.baseY, transform: [{ translateX: m.dx }, { translateY: m.dy }] }}>
            <MeduseCornerIcon size={m.size} breathCycleMs={m.breath} breathMaxScale={1.35} tint="rgba(174,239,77,1)" />
          </Animated.View>
        );
      })}
      <View style={{ paddingTop: 58, paddingLeft: 22, alignItems: 'flex-start', zIndex: 5 }} pointerEvents="none">
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: 28 }}>+</AnimatedPlus></Text>
      </View>
      <ScrollView style={{ flex: 1, zIndex: 5 }} contentContainerStyle={{ paddingTop: 24, paddingBottom: 32, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff', textAlign: 'center', letterSpacing: -0.4, marginBottom: 8 }}>{tr.profile_title || 'À propos de toi'}</Text>
          <Text style={{ fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 20 }}>{tr.profile_sub || 'Pour personnaliser ton programme'}</Text>
        </View>

        <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(229,255,0,0.7)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>{tr.ob_prenom || 'Prénom'}</Text>
        <TextInput
          value={firstName}
          onChangeText={setFirstName}
          placeholder={tr.ob_placeholder || 'Ton prénom'}
          placeholderTextColor="rgba(229,255,0,0.4)"
          autoCapitalize="words"
          autoCorrect={false}
          textContentType="givenName"
          maxLength={50}
          style={{ height: 50, borderRadius: 25, backgroundColor: 'rgba(229,255,0,0.06)', borderWidth: 1.5, borderColor: '#E5FF00', color: '#ffffff', fontSize: 16, fontWeight: '500', paddingHorizontal: 18, marginBottom: 24 }}
        />

        <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(229,255,0,0.7)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>{tr.profile_gender_label || 'Genre'}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          {genders.map(function(g) {
            var active = gender === g.key;
            return (
              <TouchableOpacity
                key={g.key}
                activeOpacity={0.85}
                onPress={function() { setGender(g.key); }}
                style={{
                  flex: 1,
                  height: 50,
                  borderRadius: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? 'rgba(174,239,77,0.12)' : 'transparent',
                  borderWidth: active ? 1.5 : 1,
                  borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.25)',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? '#AEEF4D' : '#ffffff', letterSpacing: 0.2 }}>{g.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 1, backgroundColor: 'rgba(229,255,0,0.15)', marginBottom: 18 }} />

        {row(tr.profile_birth_label || 'Date de naissance', formatDate(birthDate), function() { openEdit('date'); })}
        {row(tr.profile_height_label || 'Taille (cm)', height != null ? height + ' cm' : null, function() { openEdit('height'); })}
        {row(tr.profile_weight_label || 'Poids (kg)', weight != null ? weight + ' kg' : null, function() { openEdit('weight'); })}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12, zIndex: 5 }}>
        <GlassButton
          onPress={submit}
          loading={submitting}
          variant="yellow"
          size="lg"
          textStyle={{ fontSize: 16, fontWeight: '800' }}
        >
          {submitting ? '…' : (ctaLabel || tr.profile_next_btn || 'Suivant')}
        </GlassButton>
      </View>

      <Modal visible={!!editing} transparent animationType="slide" statusBarTranslucent onRequestClose={function() { setEditing(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={function() { setEditing(null); }} />
          <View style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderBottomWidth: 0 }}>
            <BlurView intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={{ backgroundColor: 'rgba(10,20,35,0.85)', paddingTop: 12, paddingBottom: 32, paddingHorizontal: 24 }}>
              <View style={{ alignItems: 'center', marginBottom: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' }} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
                <TouchableOpacity onPress={function() { setEditing(null); }} hitSlop={10}>
                  <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>{tr.profile_cancel_btn || 'Annuler'}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>
                  {editing === 'date' ? (tr.profile_birth_label || 'Date de naissance') : editing === 'height' ? (tr.profile_height_label || 'Taille (cm)') : (tr.profile_weight_label || 'Poids (kg)')}
                </Text>
                <TouchableOpacity onPress={saveEdit} hitSlop={10}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#E5FF00' }}>{tr.profile_picker_done || 'Terminé'}</Text>
                </TouchableOpacity>
              </View>

              {editing === 'date' ? (
                DateTimePicker ? (
                  <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                    <DateTimePicker
                      value={tempBirth}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      themeVariant="dark"
                      locale={(lang || 'fr').toLowerCase().indexOf('fr') === 0 ? 'fr-FR' : 'en-US'}
                      maximumDate={new Date()}
                      minimumDate={new Date(1900, 0, 1)}
                      onChange={function(_, d) { if (d) setTempBirth(d); }}
                      textColor="#ffffff"
                    />
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 18 }}>
                    <TextInput
                      value={String(tempBirth.getDate()).padStart(2, '0')}
                      onChangeText={function(v) { var n = parseInt(v, 10); if (isFinite(n) && n >= 1 && n <= 31) { var nd = new Date(tempBirth); nd.setDate(n); setTempBirth(nd); } }}
                      placeholder="JJ" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="number-pad" maxLength={2}
                      style={{ flex: 1, height: 52, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 14, color: '#ffffff', fontSize: 18, textAlign: 'center', fontWeight: '600' }}
                    />
                    <TextInput
                      value={String(tempBirth.getMonth() + 1).padStart(2, '0')}
                      onChangeText={function(v) { var n = parseInt(v, 10); if (isFinite(n) && n >= 1 && n <= 12) { var nd = new Date(tempBirth); nd.setMonth(n - 1); setTempBirth(nd); } }}
                      placeholder="MM" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="number-pad" maxLength={2}
                      style={{ flex: 1, height: 52, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 14, color: '#ffffff', fontSize: 18, textAlign: 'center', fontWeight: '600' }}
                    />
                    <TextInput
                      value={String(tempBirth.getFullYear())}
                      onChangeText={function(v) { var n = parseInt(v, 10); if (isFinite(n) && n >= 1900 && n <= new Date().getFullYear()) { var nd = new Date(tempBirth); nd.setFullYear(n); setTempBirth(nd); } }}
                      placeholder="AAAA" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="number-pad" maxLength={4}
                      style={{ flex: 1.4, height: 52, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 14, color: '#ffffff', fontSize: 18, textAlign: 'center', fontWeight: '600' }}
                    />
                  </View>
                )
              ) : (
                <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                  <TextInput
                    value={tempValue}
                    onChangeText={setTempValue}
                    placeholder={editing === 'height' ? '170' : '65'}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="number-pad"
                    maxLength={3}
                    autoFocus
                    style={{ width: 160, height: 64, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 16, color: '#ffffff', fontSize: 28, fontWeight: '700', textAlign: 'center' }}
                  />
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 10, letterSpacing: 0.3 }}>
                    {editing === 'height' ? 'cm' : 'kg'}
                  </Text>
                </View>
              )}
            </BlurView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════
// APP ROOT
// ══════════════════════════════════
function App() {
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [introShown, setIntroShown] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInPrefillEmail, setSignInPrefillEmail] = useState('');
  const [welcomeShown, setWelcomeShown] = useState(null);
  const [profileSetupShown, setProfileSetupShown] = useState(null);
  const [hkPromptShown, setHkPromptShown] = useState(null);
  const [prenom, setPrenom] = useState('');
  const [lang, setLang] = useState(() => getAppLangFromLocale());
  const [tensionIdxs, setTensionIdxs] = useState([]);
  const [supaUser, setSupaUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const splashStart = useRef(Date.now()).current;
  const [showAuth, setShowAuth] = useState(false);
  const profileLocalRef = useRef({ prenom: '', lang: 'fr', tensionIdxs: [] });
  profileLocalRef.current = { prenom, lang, tensionIdxs };

  useEffect(() => {
    if (__DEV__) {
      devLog('[FluidBody] emojis inline', JSON.stringify({ fire: '🔥', lock: '🔒', check: '✓', play: '▶' }));
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('fluid_welcome_intro_done')
      .then(function(v) { setWelcomeShown(v === '1'); })
      .catch(function() { setWelcomeShown(true); });
  }, []);

  function dismissWelcomeIntro() {
    setWelcomeShown(true);
    AsyncStorage.setItem('fluid_welcome_intro_done', '1').catch(function(e) { devWarn('welcome flag persist', e); });
  }

  // Feature flag : écran HealthKitConnect désactivé sur l'onboarding.
  // Cause d'origine (builds 33/34/35) : NSException au décodage de
  // apple-watch-hero.png (882x806, profil Display P3) via RCTImageLoader +
  // CGImageSourceCreateThumbnailAtIndex sous New Architecture / Fabric.
  // Fix appliqué (à valider en TestFlight) :
  //   1. HealthKitConnect.js migré vers <Image> de expo-image (SDWebImage iOS)
  //      au lieu de l'Image RN — même mitigation que commit 6e55733.
  //   2. apple-watch-hero.png reconverti de Display P3 → sRGB via sips.
  // Pour ré-activer après validation : passer ce flag à false, push un build
  // sur TestFlight, observer Sentry. Si zéro crash sur ~24h, retirer le flag.
  // Si crash persiste : (a) tenter newArchEnabled:false temporaire,
  // (b) downscale l'image à 600x548, (c) remplacer par un SVG vectoriel.
  const HEALTHKIT_DISABLED = true;

  useEffect(() => {
    if (HEALTHKIT_DISABLED) {
      setHkPromptShown(true);
      AsyncStorage.setItem('fluid_hk_prompt_done', '1').catch(function() {});
      return;
    }
    AsyncStorage.getItem('fluid_hk_prompt_done')
      .then(function(v) { setHkPromptShown(v === '1'); })
      .catch(function() { setHkPromptShown(true); });
  }, []);

  function dismissHkPrompt() {
    setHkPromptShown(true);
    AsyncStorage.setItem('fluid_hk_prompt_done', '1').catch(function(e) { devWarn('hk flag persist', e); });
  }

  useEffect(() => {
    AsyncStorage.getItem('fluid_profile_setup_done')
      .then(function(v) { setProfileSetupShown(v === '1'); })
      .catch(function() { setProfileSetupShown(true); });
  }, []);

  const profileSetupSavingRef = useRef(false);
  async function handleProfileSetupSave(payload) {
    if (profileSetupSavingRef.current) {
      devLog('[ProfileSetup] save déjà en cours, ignore appel');
      return;
    }
    profileSetupSavingRef.current = true;
    try {
      devLog('[ProfileSetup] === START ===');
      devLog('[ProfileSetup] payload reçu:', JSON.stringify(payload));
      setProfileSetupShown(true);
      AsyncStorage.setItem('fluid_profile_setup_done', '1').catch(function(e) { devWarn('profile setup flag persist', e); });
      const cleanPrenom = payload.prenom ? String(payload.prenom).trim().slice(0, 50) : null;
      if (cleanPrenom) setPrenom(cleanPrenom);
      if (!supabase) { devLog('[ProfileSetup] supabase null, skip cloud save'); return; }

      devLog('[ProfileSetup] >>> getSession()');
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      devLog('[ProfileSetup] <<< getSession() result:', JSON.stringify({ userId: session?.user?.id || null, error: sessionErr?.message || null }));
      if (!session?.user) { devLog('[ProfileSetup] pas de session active, abort'); return; }

      // updateUser en fire-and-forget — secondaire, ne bloque pas l'upsert
      if (cleanPrenom) {
        devLog('[ProfileSetup] >>> auth.updateUser fire-and-forget (prenom:"' + cleanPrenom + '")');
        supabase.auth.updateUser({ data: { prenom: cleanPrenom } })
          .then(function(meta) { devLog('[ProfileSetup] (bg) updateUser done:', JSON.stringify({ ok: !meta.error, error: meta.error?.message || null })); })
          .catch(function(e) { devLog('[ProfileSetup] (bg) updateUser threw:', e?.message || String(e)); });
      }

      const row = {
        id: session.user.id,
        updated_at: new Date().toISOString(),
        prenom: cleanPrenom,
        gender: payload.gender || null,
        birth_date: payload.birth_date || null,
        height_cm: payload.height_cm != null ? payload.height_cm : null,
        weight_kg: payload.weight_kg != null ? payload.weight_kg : null,
      };
      devLog('[ProfileSetup] row complète (toutes colonnes):', JSON.stringify({
        id: row.id,
        prenom: row.prenom,
        gender: row.gender,
        birth_date: row.birth_date,
        height_cm: row.height_cm,
        weight_kg: row.weight_kg,
        updated_at: row.updated_at,
      }));
      devLog('[ProfileSetup] colonnes envoyées:', Object.keys(row).join(', '));

      devLog('[ProfileSetup] >>> profiles.upsert(row)');
      try {
        const TIMEOUT_SENTINEL = { __timeout: true };
        const upsertPromise = supabase.from('profiles').upsert(row);
        const timeoutPromise = new Promise(function(resolve) { setTimeout(function() { resolve(TIMEOUT_SENTINEL); }, 15000); });
        const res = await Promise.race([upsertPromise, timeoutPromise]);
        if (res === TIMEOUT_SENTINEL) {
          devLog('[ProfileSetup] <<< upsert TIMEOUT (15s) — flow continue, upsert poursuit en background');
          // log async result quand la promise se résout finalement
          upsertPromise.then(function(r) {
            devLog('[ProfileSetup] (bg-late) upsert finalement résolu:', JSON.stringify({ error: r.error?.message || null, status: r.status }));
          }).catch(function(e) {
            devLog('[ProfileSetup] (bg-late) upsert finalement rejeté:', e?.message || String(e));
          });
        } else {
          devLog('[ProfileSetup] <<< upsert FULL result:', JSON.stringify({
            data: res.data || null,
            error: res.error ? {
              message: res.error.message,
              details: res.error.details || null,
              hint: res.error.hint || null,
              code: res.error.code || null,
            } : null,
            status: res.status,
            statusText: res.statusText,
            count: res.count,
          }));
          if (res.error) {
            devLog('[ProfileSetup] <<< upsert ERROR (résumé):', res.error.message, '| code:', res.error.code, '| status:', res.status);
          } else {
            devLog('[ProfileSetup] <<< upsert OK — status:', res.status, '| statusText:', res.statusText);
          }
        }
      } catch(e) {
        devLog('[ProfileSetup] <<< upsert threw:', e?.message || String(e));
      }
      devLog('[ProfileSetup] === END ===');
    } catch (e) {
      devLog('[ProfileSetup] catch global:', e?.message || String(e));
      devWarn('Supabase profile setup upsert', e);
    } finally {
      profileSetupSavingRef.current = false;
    }
  }

  useEffect(() => {
    function friendlyFromEmail(email) {
      if (!email || typeof email !== 'string') return '';
      if (email.toLowerCase().indexOf('privaterelay.appleid.com') !== -1) return 'Yvan';
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

    function finishLoading() {
      // Splash minimum = 900 ms (suffisant pour la transition fade-in/scale).
      // Auparavant fixé à 3000 ms : pénalité immédiate sur le cold start ressenti.
      var elapsed = Date.now() - splashStart;
      var remain = Math.max(0, 900 - elapsed);
      if (remain === 0) setLoading(false);
      else setTimeout(function() { setLoading(false); }, remain);
    }
    async function checkSession() {
      try {
        if (!supabase) { finishLoading(); return; }
        const { data: { session }, error: se } = await supabase.auth.getSession();
        if (se) devWarn('getSession', se);
        if (session?.user) {
          setSupaUser(session.user);
          await fetchAndMergeProfile(session.user);
          setShowAuth(false);
          setOnboardingDone(true);
        }
      } catch (e) { devWarn('Session / profil', e); }
      finishLoading();
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

  useEffect(() => {
    if (!Sentry || !SENTRY_DSN) return;
    try {
      if (supaUser?.id) Sentry.setUser({ id: supaUser.id });
      else Sentry.setUser(null);
    } catch (e) {}
  }, [supaUser]);

  async function handleOnboardingDone(p, l, t) {
    setPrenom(p); setLang(l); setTensionIdxs(t); setOnboardingDone(true);
    sendWelcomeNotification(p, l);
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

  async function handleTensionChange(next) {
    const arr = Array.isArray(next) ? next : [];
    setTensionIdxs(arr);
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      await supabase.from('profiles').upsert({
        id: session.user.id,
        tension_idxs: arr,
        updated_at: new Date().toISOString(),
      });
    } catch (e) { devWarn('Supabase tension_idxs upsert', e); }
  }

  // Animated splash
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.7)).current;
  const splashTextOpacity = useRef(new Animated.Value(0)).current;
  const splashGlow = useRef(new Animated.Value(0.3)).current;
  const splashTagOpacity = useRef(new Animated.Value(0)).current;

  useEffect(function() {
    if (loading) {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(splashOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.spring(splashScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
        ]),
        Animated.timing(splashTextOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(splashTagOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(splashGlow, { toValue: 0.8, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(splashGlow, { toValue: 0.3, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    }
  }, [loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000e18', alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
        {/* Glow effect behind medusa */}
        <Animated.View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(0,190,208,0.08)', opacity: splashGlow, transform: [{ scale: splashGlow.interpolate({ inputRange: [0.3, 0.8], outputRange: [1, 1.5] }) }] }} />
        {/* Medusa */}
        <Animated.View style={{ opacity: splashOpacity, transform: [{ scale: splashScale }], marginBottom: 24 }}>
          <MeduseCornerIcon size={120} breathCycleMs={2500} />
        </Animated.View>
        {/* FLUIDBODY+ */}
        <Animated.View style={{ opacity: splashTextOpacity, flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: '#ffffff', letterSpacing: 1 }}>FLUIDBODY</Text>
          <AnimatedPlus style={{ fontSize: 34, fontWeight: '900', color: '#AEEF4D', marginLeft: 8 }}>+</AnimatedPlus>
        </Animated.View>
        {/* Tagline */}
        <Animated.View style={{ opacity: splashTagOpacity }}>
          <Text style={{ color: '#AEEF4D', fontSize: 13, letterSpacing: 3, textTransform: 'uppercase' }}>Pilates & More</Text>
        </Animated.View>
      </View>
    );
  }

  if (!introShown) {
    if (showSignIn) {
      return <SignInScreen
        lang={lang}
        supabase={supabase}
        prefillEmail={signInPrefillEmail}
        onSwitchToSignUp={() => setShowSignIn(false)}
        onSuccess={() => { setShowSignIn(false); setIntroShown(true); }}
        onSkip={() => {
          setShowSignIn(false);
          setIntroShown(true);
          if (!onboardingDone && !supaUser) {
            completeOnboarding('', lang, [], { skipCloudAuth: true });
          }
        }}
      />;
    }
    return <OnboardingScreen
      initialLang={lang}
      onSwitchToSignIn={(em) => { setSignInPrefillEmail(em || ''); setShowSignIn(true); }}
      onDone={(p, l, t, o) => {
        setIntroShown(true);
        if (!onboardingDone && !supaUser) {
          completeOnboarding(p, l, t, o);
        }
      }}
    />;
  }

  if (showAuth && !supaUser) {
    return <AuthScreen onSkip={() => setShowAuth(false)} onSuccess={() => setShowAuth(false)} lang={lang} prenomHint={prenom} langForProfile={lang} tensionIdxsForProfile={tensionIdxs} />;
  }

  if (profileSetupShown === false) {
    return <ProfileSetupScreen lang={lang} onDone={handleProfileSetupSave} />;
  }

  if (welcomeShown === false) {
    return <WelcomeIntroScreen lang={lang} onDone={function(idxs) {
      if (Array.isArray(idxs) && idxs.length > 0) handleTensionChange(idxs);
      dismissWelcomeIntro();
    }} />;
  }

  if (hkPromptShown === false) {
    return <HealthKitConnectScreen lang={lang} onDone={function() { dismissHkPrompt(); }} />;
  }

  return <MainApp prenom={prenom} lang={lang} tensionIdxs={tensionIdxs} supabase={supabase} supaUser={supaUser} onTensionChange={handleTensionChange} />;
}

function AppWithBoundary() {
  return (
    <ErrorBoundary onError={(error, info) => sentryCapture(error, { componentStack: info?.componentStack, source: 'ErrorBoundary' })}>
      <App />
    </ErrorBoundary>
  );
}

export default (Sentry && SENTRY_DSN && typeof Sentry.wrap === 'function')
  ? Sentry.wrap(AppWithBoundary)
  : AppWithBoundary;

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