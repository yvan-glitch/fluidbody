import 'react-native-url-polyfill/auto';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, Animated, Easing, View, TouchableOpacity, Pressable, ScrollView, TextInput, Dimensions, Alert, Modal, Platform, AppState, KeyboardAvoidingView, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LiquidGlass from './src/components/LiquidGlass';
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
import { withTimeout } from './src/utils/withTimeout';
import { chromeAnim, showChrome } from './src/utils/chromeScroll';
import { breadcrumb } from './src/utils/breadcrumb';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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

// Connexion Google native (@react-native-google-signin) — require protégé.
let GoogleSignin = null, GoogleStatusCodes = null;
try {
  const g = require('@react-native-google-signin/google-signin');
  GoogleSignin = g.GoogleSignin;
  GoogleStatusCodes = g.statusCodes;
} catch(e) {}
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
let _googleConfigured = false;
function ensureGoogleConfigured() {
  if (_googleConfigured || !GoogleSignin || !GOOGLE_WEB_CLIENT_ID) return;
  try {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID || undefined, offlineAccess: false });
    _googleConfigured = true;
  } catch (e) { if (__DEV__) console.warn('GoogleSignin.configure', e?.message); }
}

let DateTimePicker = null;
try { DateTimePicker = require('@react-native-community/datetimepicker').default; } catch(e) {}
let HK = null;
try {
  HK = require('@kingstinct/react-native-healthkit');
} catch (e) {
  if (__DEV__) console.warn('@kingstinct/react-native-healthkit unavailable:', e);
}
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Path, Circle, Ellipse, G } from 'react-native-svg';
// expo-screen-orientation: native module manquant sur tvOS, lazy require avec fallback
let ScreenOrientation = null;
try { ScreenOrientation = require('expo-screen-orientation'); } catch(e) { if (__DEV__) console.warn('expo-screen-orientation unavailable:', e?.message); }
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
// react-native-view-shot: native module manquant sur tvOS, lazy require avec fallback
let ViewShot = null;
try { ViewShot = require('react-native-view-shot').default; } catch(e) {}
import { U_JELLY, ZONE_TO_PILIER, T, PILIER_IMAGES, SABRINA_QUOTES } from './src/constants/data';
import { LEGAL, getTermsUrl, TERMS_ACCEPTED_STORAGE_KEY } from './src/constants/legal';
import { Linking as RNLinking } from 'react-native';
import { Bulle, Meduse, MeduseCornerIcon, BULLES, BULLES_ONBOARDING, FloatingMedusas } from './src/components/Meduse';
import VideoPlayer from './src/components/VideoPlayer';
import { prefetchSignedVideoUrl, buildSessionId } from './src/utils/videoUrl';
import supabase from './src/lib/supabase';
import PaywallModal, { PRODUCT_IDS } from './src/components/PaywallModal';
import StretchTimerModal from './src/components/Timer';
import AnimatedPlus from './src/components/AnimatedPlus';
import GlassButton from './src/components/GlassButton';
import { GlassView } from './src/components/ui';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import ThemedStatusBar from './src/theme/ThemedStatusBar';
import Confetti from './src/components/Confetti';
import LivingBackground from './src/components/LivingBackground';
import CoachWelcomeOverlay, { isCoachWelcomeSeen } from './src/components/CoachWelcomeOverlay';
import MedicalDisclaimerOverlay, { isMedicalDisclaimerSeen } from './src/components/MedicalDisclaimerOverlay';
import OtaUpdateBanner from './src/components/OtaUpdateBanner';
import AnniversaryOverlay, { shouldShowAnniversary } from './src/components/AnniversaryOverlay';
import WelcomeAnimation, { isWelcomeAnimationShown } from './src/components/WelcomeAnimation';
import SignInScreen from './src/screens/SignIn';
import HealthKitConnectScreen from './src/screens/HealthKitConnect';
import MonCorps from './src/screens/MonCorps';
import TVLoginScreen from './src/screens/TVLoginScreen';
import ProfilTV from './src/screens/ProfilTV';
import { IS_TV } from './src/utils/platformTV';
import ActivityScreen from './src/screens/Activity';
// ProgressScreen (fusion Résumé+Activité) mis de côté à la demande de Yvan —
// src/screens/Progress.js reste dispo si on refusionne plus tard.
import ProfileOnboardingScreen from './src/screens/ProfileOnboarding';
import SabrinaProfileTVScreen, { SabrinaProfileModal } from './src/screens/SabrinaProfile';
import { detectNewUnlocks, prime as primeAchievements, getAchievementById, recordPilierUsage, getRecentPiliers, clearAchievements } from './src/utils/achievements';
import { flushPendingProfileSync, refreshFromRemote, clearCachedProfile } from './src/utils/profileSync';
import { sweepTempVideos } from './src/components/DownloadManager';
import {
  getPreferredHour,
  scheduleStreakProtectionToday,
  schedulePostOnboardingNudge,
  scheduleMilestoneReward,
  cancelPauseActiveNotifications,
} from './src/utils/notifications';
import { isUserAlreadyActive } from './src/utils/activityCheck';
import { getPiliers, getSeances, getSeanceDuJour, canAccessSeanceIndex, getResumeIndicesForPilier, hapticLight, hapticSuccess } from './src/utils';
import { primeCatalogVisibility } from './src/utils/catalogVisibility';
import { creditReferralOnPaid, getReferralStats, parseReferralCodeFromUrl, savePendingReferralCode } from './src/utils/referrals';
import { safeNativeCall, safeNativeFire, diag } from './src/utils/safeNativeCall';
import { maybeAskForReview } from './src/utils/reviewPrompt';
import { reportError } from './src/utils/reportError';

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
// Migré depuis react-native-health 1.19 vers @kingstinct/react-native-healthkit
// v14 (Nitro Modules). Le binding moderne contourne le bridge ObjC
// TurboModule responsable du crash NSException de build #43 sur iOS 26.5 +
// New Arch (EXC_BAD_ACCESS dans convertNSExceptionToJSError → dladdr).
//
// HEALTHKIT_DISABLED — kill switch hoisté au scope module. Garde-fou pour
// désactiver HealthKit côté JS si un nouveau crash apparaît sur une version
// iOS future (ex: iOS 27), sans avoir à pousser un build natif. false par
// défaut maintenant que la migration Kingstinct est en place.
const HEALTHKIT_DISABLED = false;

// HKWorkoutActivityType.pilates = 66 (cf. Apple HKWorkoutActivityType.pilates,
// dispo depuis watchOS 5 / iOS 10). On hardcode l'entier pour ne pas avoir à
// importer l'enum depuis le binding au load time du module.
const WORKOUT_ACTIVITY_PILATES = 66;

const HK_READ_PERMS = [
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierAppleStandTime',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierHeight',
  'HKCharacteristicTypeIdentifierDateOfBirth',
  'HKCharacteristicTypeIdentifierBiologicalSex',
  'HKWorkoutTypeIdentifier',
];

const HK_WRITE_PERMS = [
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierHeartRate',
  'HKWorkoutTypeIdentifier',
];
// WorkoutEffortScore (évaluation d'effort post-séance → charge d'entraînement
// Apple) n'existe qu'à partir d'iOS 18 — le référencer avant ferait échouer
// toute la requestAuthorization.
if (Platform.OS === 'ios' && parseInt(Platform.Version, 10) >= 18) {
  HK_WRITE_PERMS.push('HKQuantityTypeIdentifierWorkoutEffortScore');
}

let hkInitialized = false;

function initHealthKit() {
  if (HEALTHKIT_DISABLED) return;
  if (!HK || hkInitialized || Platform.OS !== 'ios') return;
  // requestAuthorization retourne `Promise<boolean>` — true = la feuille a été
  // présentée (accepté ou refusé, on ne peut pas le distinguer côté READ par
  // confidentialité). On considère cela suffisant pour marquer hkInitialized.
  HK.requestAuthorization({ toShare: HK_WRITE_PERMS, toRead: HK_READ_PERMS })
    .then(function () {
      hkInitialized = true;
      if (__DEV__) devLog('HealthKit initialized (kingstinct)');
    })
    .catch(function (err) {
      if (__DEV__) devLog('HealthKit init error:', err);
      sentryCapture(err instanceof Error ? err : new Error(String(err && err.message || err)), { where: 'initHealthKit.kingstinct' });
    });
}

function saveHealthKitWorkout(durationMinutes, extras) {
  if (HEALTHKIT_DISABLED) return;
  if (!HK || !hkInitialized || Platform.OS !== 'ios') return;
  try {
    var endDate = new Date();
    var startDate = new Date(endDate.getTime() - durationMinutes * 60000);
    // Calories : si la live HR a tourné, on a une estimation plus juste via avg HR.
    // Sinon on garde l'estimation forfaitaire 5 kcal/min (Pilates léger).
    var calories = (extras && Number.isFinite(extras.energyBurned))
      ? Math.max(1, Math.round(extras.energyBurned))
      : Math.round(durationMinutes * 5);
    // Quantities échantillonnées pendant le workout : energy burned. On
    // pourrait aussi pousser les HR samples ici mais ils sont déjà côté
    // HealthKit (authored par le device source) — éviter les doublons.
    var quantities = [{
      startDate: startDate,
      endDate: endDate,
      quantityType: 'HKQuantityTypeIdentifierActiveEnergyBurned',
      quantity: calories,
      unit: 'kcal',
    }];
    var totals = { energyBurned: calories };
    HK.saveWorkoutSample(WORKOUT_ACTIVITY_PILATES, quantities, startDate, endDate, totals)
      .then(function () {
        if (__DEV__) devLog('HealthKit workout saved:', durationMinutes + 'min, ' + calories + 'cal');
      })
      .catch(function (err) {
        if (__DEV__) devLog('HealthKit workout save error:', err);
        sentryCapture(err instanceof Error ? err : new Error(String(err && err.message || err)), { where: 'saveHealthKitWorkout.kingstinct' });
      });
  } catch (e) {
    if (__DEV__) console.warn('HealthKit save throw:', e);
    sentryCapture(e, { where: 'saveHealthKitWorkout.syncThrow' });
  }
}

/** Pictogrammes restants (autres que 🔥🔒✓▶) — chaînes UTF-8. */

/** Valeur numérique du streak pour l'affichage à côté de {'🔥'} dans le JSX. */

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

// PERF : mémoïsé — la barre (et son BlurView intensity 80) ne re-rend plus à
// chaque setState de MainApp, seulement quand l'état de navigation change.
const CustomTabBar = memo(function CustomTabBar({ state, descriptors, navigation }) {
  var theme = useTheme().theme;
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
    // Changement d'onglet → la barre revient toujours (sinon on atterrit sur
    // un écran sans barre si on avait scrollé avant de naviguer).
    showChrome();
  }, [state.index]);

  // Masquage au scroll (chromeScroll) : translateY vers le bas de quoi sortir
  // entièrement de l'écran (barre 60 + bottom 24 + marge ombre).
  var chromeTranslateY = useRef(chromeAnim.interpolate({ inputRange: [0, 1], outputRange: [BAR_H + 40, 0] })).current;

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
    <Animated.View style={{ position: 'absolute', bottom: 24, left: 20, right: 20, height: BAR_H, zIndex: 1000, transform: [{ translateY: chromeTranslateY }] }} {...panResponder.panHandlers}>
      <GlassView
        intensity={80}
        borderRadius={BAR_H / 2}
        elevated
        contentStyle={{ height: BAR_H }}
      >
        {/* Animated focus pill — drawn above the substrate so it sits on top of
            the specular highlight but under the row of icons. Substrate
            picks the brand accent's substrateAccent token so it works on
            both light and dark glass. */}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: (BAR_H - pillH) / 2, left: 0, width: pillW, height: pillH, borderRadius: pillH / 2, backgroundColor: theme.glass.substrateAccent, borderWidth: 1, borderColor: theme.colors.accent, transform: [{ translateX: indicatorX }] }}>
          <LinearGradient colors={theme.glass.highlightColors} locations={[0, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', borderTopLeftRadius: pillH / 2, borderTopRightRadius: pillH / 2 }} pointerEvents="none" />
        </Animated.View>
        <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        {state.routes.map(function(route, index) {
          var options = descriptors[route.key].options;
          var isFocused = state.index === index;
          var color = isFocused ? theme.colors.accentText : theme.colors.textSecondary;
          var onPress = function() {
            var event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          var IconComp = options.tabBarIcon;
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityLabel={route.name}
              accessibilityState={isFocused ? { selected: true } : undefined}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: BAR_H }}
            >
              {IconComp && IconComp({ color: color, size: 20, focused: isFocused })}
              <Text style={{ fontSize: 10, fontWeight: '600', color: color, marginTop: 2, letterSpacing: 0.2 }}>{route.name}</Text>
            </TouchableOpacity>
          );
        })}
        </View>
      </GlassView>
    </Animated.View>
  );
});

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

function TabIconActivity({ color, size }) {
  var c = tabBarIconTint(color);
  var s = size ?? 22;
  // Three concentric circles, Apple Fitness style — keeps Apple's red/green/
  // blue palette so the icon reads correctly in both light and dark themes.
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={10} stroke="#FF375F" strokeWidth={2.2} fill="none" opacity={0.95} />
        <Circle cx={12} cy={12} r={6.5}  stroke="#A0FF49" strokeWidth={2.0} fill="none" opacity={0.95} />
        <Circle cx={12} cy={12} r={3}   stroke="#1AECFF" strokeWidth={1.8} fill="none" opacity={0.95} />
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
 // Scale factor relative to iPhone 390px
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

const RC_ENTITLEMENT_ID = 'Fluidbody Pilates Pro';
const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_RC_API_KEY_IOS || '';

const COACH_IMAGE = require('./assets/coach.jpg');

// getResumeIndicesForPilier and canAccessSeanceIndex moved to src/utils.js



// getSeanceDuJour moved to src/utils.js



// ARTICLES, FICHES, ArticleDetail, FicheDetail, Biblio moved to src/screens/Bibliotheque.js
// (2026-07-23) Onglet Biblio retiré du menu — import conservé nulle part ;
// l'écran reste dans src/screens/Bibliotheque.js pour un retour futur.

import ResumeScreen from './src/screens/Resume';
import StatisticsScreen from './src/screens/Statistics';


// ══════════════════════════════════
// PROGRESSER
// ══════════════════════════════════








// ProfilScreen moved to src/screens/Profil.js
import ProfilScreen from './src/screens/Profil';
import MesTelechargements from './src/screens/MesTelechargements';
import PreferencesScreen from './src/screens/Preferences';
import AchievementsScreen from './src/screens/Achievements';
import { Icon, IconJellyfish } from './src/components/Icons';
import { primePreferencesCache } from './src/utils/userPreferences';

// ══════════════════════════════════
// PERF (2026-07-23) — stabilisation de l'arbre de navigation.
// MainApp détient ~30 useState et rend directement le Tab.Navigator : avant,
// CHAQUE setState (paywall, overlay, confetti…) re-rendait les 5 écrans
// montés, car les écrans n'étaient pas mémoïsés et tous les callbacks/options
// étaient recréés inline à chaque rendu. Désormais :
//   1. les 5 écrans d'onglet sont enveloppés dans React.memo ;
//   2. les handlers passés en props ont une identité stable (useStableCallback) ;
//   3. les objets options/tabBar/listeners sont hoistés au niveau module ;
//   4. freezeOnBlur gèle le rendu des onglets non focus.
// Résultat : un setState sans rapport ne re-rend plus que MainApp lui-même.
// ══════════════════════════════════
const MonCorpsMemo = memo(MonCorps);
const ActivityScreenMemo = memo(ActivityScreen);
const ResumeScreenMemo = memo(ResumeScreen);
const ProfilScreenMemo = memo(ProfilScreen);

// Handler à identité stable : la ref pointe toujours vers la dernière closure,
// l'identité de la fonction retournée ne change JAMAIS entre les rendus.
// (Équivalent du futur useEvent de React.)
function useStableCallback(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  return useRef(function() { return ref.current.apply(null, arguments); }).current;
}

// Options d'onglets hoistées (les TabIcon* sont des déclarations hoistées).
// (2026-07-23) Séances était le SEUL onglet sans icône — la méduse de la
// marque (IconJellyfish) prend sa place, même famille de tracé que les autres.
const TAB_OPTIONS_HOME = { tabBarIcon: function(props) { return <IconJellyfish color={tabBarIconTint(props && props.color)} size={(props && props.size) || 20} strokeWidth={1.8} />; } };
const TAB_OPTIONS_ACTIVITY = { tabBarIcon: function(props) { return <TabIconActivity {...props} />; } };
const TAB_OPTIONS_RESUME = { tabBarIcon: function(props) { return <TabIconResume {...props} />; } };
const TAB_OPTIONS_BIBLIO = { tabBarIcon: function(props) { return <TabIconBiblio {...props} />; } };
const TAB_OPTIONS_PROFIL = { tabBarIcon: function(props) { return <TabIconProfil {...props} />; } };
const TAB_NAV_SCREEN_OPTIONS = { headerShown: false, animation: 'fade', freezeOnBlur: true };
const TAB_NAV_SCREEN_LISTENERS = { tabPress: function() { hapticLight(); } };
function renderCustomTabBar(props) { return <CustomTabBar {...props} />; }


// ══════════════════════════════════
// SEANCE DETAIL MODAL
// ══════════════════════════════════
function SeanceDetailModal({ visible, onClose, sdj, lang, onPlay }) {
  if (!visible || !sdj || !Array.isArray(sdj.seance)) return null;
  var tr = T[lang] || T["fr"];
  var titre = sdj.seance[0] || '';
  var duree = sdj.seance[1] || '';
  var etape = sdj.seance[2] || '';
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000000" }}>
        <View style={{ height: SH * 0.42, width: "100%" }}>
          <ExpoImage source={PILIER_IMAGES[sdj.pilier.key]} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(0,0,0,0.2)", "rgba(0,0,0,0.7)"]} style={{ flex: 1 }}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Retour" style={{ position: "absolute", top: 56, left: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
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
  // ToS acceptance — pre-checked if the user already accepted on this
  // device. We hydrate from AsyncStorage so users who accepted before an
  // app update don't need to re-tick.
  const [termsAccepted, setTermsAccepted] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(TERMS_ACCEPTED_STORAGE_KEY)
      .then(v => { if (!cancelled && v) setTermsAccepted(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPass = password.length >= 6;
  const canSubmit = validEmail && validPass && !loading;
  const appleAvailable = !!AppleAuth && Platform.OS === 'ios';
  const googleAvailable = !!GoogleSignin && !!GOOGLE_WEB_CLIENT_ID;

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
      } catch (e) { reportError('profiles.upsert.postAuth', e); }
    } catch(e) { reportError('profiles.postAuthProfileSync', e); }
  }

  async function handleEmailAuth(mode) {
    if (!supabase) return;
    const em = email.trim().toLowerCase();
    if (!validEmail) { setError(tr.ob_auth_err_email); return; }
    if (!validPass) { setError(tr.ob_auth_err_short); return; }
    if (mode === 'up' && !termsAccepted) {
      setError(tr.ob_auth_terms_required || 'Tu dois accepter les CGU pour créer un compte.');
      return;
    }
    setLoading(true); setError('');
    try {
      if (mode === 'up') {
        const { data, error: err } = await withTimeout(supabase.auth.signUp({
          email: em,
          password,
          options: { data: { prenom: String(prenomHint || '').trim().slice(0, 50).replace(/[<>]/g, '') } },
        }), 15000, 'signUp');
        if (err) { setError(err.message); setLoading(false); return; }
        if (!data.session) { setError(tr.ob_auth_confirm); setLoading(false); return; }
        AsyncStorage.setItem(TERMS_ACCEPTED_STORAGE_KEY, String(LEGAL.termsVersion || '1.0')).catch(() => {});
      } else {
        const { error: err } = await withTimeout(supabase.auth.signInWithPassword({ email: em, password }), 15000, 'signIn');
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
    if (!supabase) { Alert.alert('FluidBody+', tr.err_supabase_unavailable || 'Supabase indisponible.'); return; }
    if (!AppleAuth) { Alert.alert('Apple Sign In', tr.err_apple_module || 'Module expo-apple-authentication non chargé. Vérifie le plugin dans app.json.'); return; }
    if (!appleAvailable) {
      Alert.alert('FluidBody+', tr.auth_apple_unavailable || 'Sign in with Apple est disponible sur iOS uniquement.');
      return;
    }
    if (!termsAccepted) {
      setError(tr.ob_auth_terms_required || 'Tu dois accepter les CGU pour créer un compte.');
      return;
    }
    setLoading(true); setError('');
    try {
      const credential = await withTimeout(AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      }), 45000, 'appleSheet');
      if (!credential.identityToken) {
        const msg = tr.err_apple_token_missing || 'Apple identity token manquant.';
        setError(msg); Alert.alert('Apple Sign In', msg);
        setLoading(false); return;
      }
      const { error: err } = await withTimeout(supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      }), 15000, 'appleSignIn');
      if (err) {
        setError(err.message); Alert.alert('Apple Sign In : Supabase', err.message || tr.err_supabase_generic || 'Erreur Supabase');
        setLoading(false); return;
      }
      const applePrenom = credential.fullName?.givenName || '';
      AsyncStorage.setItem(TERMS_ACCEPTED_STORAGE_KEY, String(LEGAL.termsVersion || '1.0')).catch(() => {});
      setLoading(false);
      onSuccess && onSuccess();
      postAuthProfileSync(applePrenom).catch(function(e) { devWarn('postAuthProfileSync apple (background)', e); });
      return;
    } catch (e) {
      if (e?.message && e.message.indexOf('timeout') !== -1) {
        setError(tr.ob_auth_err_apple_timeout || "L'identification Apple a pris trop de temps. Vérifie ta connexion.");
      } else if (e?.code !== 'ERR_REQUEST_CANCELED') {
        const msg = e?.message || tr.ob_auth_err_net || 'Erreur Apple Sign In';
        setError(msg);
        Alert.alert('Apple Sign In : erreur', `${msg}\n\nCode: ${e?.code || 'n/a'}`);
      }
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!supabase) { Alert.alert('FluidBody+', tr.err_supabase_unavailable || 'Supabase indisponible.'); return; }
    if (!GoogleSignin) { Alert.alert('Google Sign In', tr.err_google_module || 'Module @react-native-google-signin non chargé. Rebuild requis.'); return; }
    if (!GOOGLE_WEB_CLIENT_ID) { Alert.alert('Google Sign In', tr.err_google_not_configured || "Connexion Google pas encore configurée (webClientId manquant)."); return; }
    if (!termsAccepted) { setError(tr.ob_auth_terms_required || 'Tu dois accepter les CGU pour créer un compte.'); return; }
    ensureGoogleConfigured();
    setLoading(true); setError('');
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res = await withTimeout(GoogleSignin.signIn(), 60000, 'googleSheet');
      if (res?.type === 'cancelled') { setLoading(false); return; }
      const idToken = res?.data?.idToken || res?.idToken || null;
      if (!idToken) { const msg = tr.err_google_token_missing || 'Google : identity token manquant.'; setError(msg); Alert.alert('Google Sign In', msg); setLoading(false); return; }
      const { error: err } = await withTimeout(supabase.auth.signInWithIdToken({ provider: 'google', token: idToken }), 15000, 'googleSignIn');
      if (err) { setError(err.message); Alert.alert('Google Sign In : Supabase', err.message || tr.err_supabase_generic || 'Erreur Supabase'); setLoading(false); return; }
      const gName = res?.data?.user?.givenName || res?.user?.givenName || '';
      AsyncStorage.setItem(TERMS_ACCEPTED_STORAGE_KEY, String(LEGAL.termsVersion || '1.0')).catch(() => {});
      setLoading(false);
      onSuccess && onSuccess();
      postAuthProfileSync(gName).catch(function(e) { devWarn('postAuthProfileSync google (background)', e); });
      return;
    } catch (e) {
      const code = e?.code;
      if (GoogleStatusCodes && code === GoogleStatusCodes.SIGN_IN_CANCELLED) { setLoading(false); return; }
      if (e?.message && e.message.indexOf('timeout') !== -1) { setError(tr.ob_auth_err_net || 'La connexion Google a pris trop de temps.'); }
      else { const msg = e?.message || tr.ob_auth_err_net || 'Erreur.'; setError(msg); Alert.alert('Google Sign In : erreur', `${msg}\n\nCode: ${code || 'n/a'}`); }
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
      <LiquidGlass intensity={Platform.OS === 'ios' ? 30 : 0} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,20,35,0.4)' }} pointerEvents="none" />

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

          {googleAvailable ? (
            <GlassButton
              onPress={handleGoogleSignIn}
              loading={loading}
              size="md"
              style={{ marginBottom: 20 }}
              leftIcon={
                <Svg width={18} height={18} viewBox="0 0 48 48">
                  <Path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107" />
                  <Path d="M3.2 14.7l7 5.1C12 16 17.5 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 15.4 2 7.9 6.9 3.2 14.7z" fill="#FF3D00" />
                  <Path d="M24 46c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 36.5 26.9 37 24 37c-6.1 0-10.7-3.1-12.5-8.4l-7 5.4C7.7 41.1 15.2 46 24 46z" fill="#4CAF50" />
                  <Path d="M44.5 20H24v8.5h11.8c-.8 2.3-2.3 4.3-4.1 5.8l6.6 5.6C42.2 36.6 45 31 45 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2" />
                </Svg>
              }
            >
              {tr.auth_google || 'Continuer avec Google'}
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
            accessibilityLabel={tr.a11y_email_input || 'Adresse e-mail'}
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
            accessibilityLabel={tr.a11y_password_input || 'Mot de passe'}
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

          <Pressable
            onPress={() => setTermsAccepted(v => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: termsAccepted }}
            accessibilityLabel={(tr.ob_auth_terms_prefix || '') + (tr.ob_auth_terms_link || '')}
            style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 14, paddingHorizontal: 4 }}
          >
            <View style={{
              width: 20, height: 20, borderRadius: 6,
              borderWidth: 1.5,
              borderColor: termsAccepted ? '#AEEF4D' : 'rgba(255,255,255,0.35)',
              backgroundColor: termsAccepted ? 'rgba(174,239,77,0.18)' : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 10, marginTop: 1,
            }}>
              {termsAccepted ? <Icon name="check" size={13} color="#AEEF4D" strokeWidth={2.4} /> : null}
            </View>
            <Text style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 17 }}>
              {tr.ob_auth_terms_prefix || "En créant un compte, j'accepte les "}
              <Text
                style={{ color: '#AEEF4D', textDecorationLine: 'underline', fontWeight: '600' }}
                onPress={() => RNLinking.openURL(getTermsUrl(lang) || LEGAL.termsUrl)}
              >
                {tr.ob_auth_terms_link || "Conditions d'utilisation"}
              </Text>
              {tr.ob_auth_terms_and || ' et la '}
              <Text
                style={{ color: '#AEEF4D', textDecorationLine: 'underline', fontWeight: '600' }}
                onPress={() => RNLinking.openURL(LEGAL.privacyUrl)}
              >
                {tr.ob_auth_privacy_link || 'Politique de confidentialité'}
              </Text>
              .
            </Text>
          </Pressable>

          <GlassButton
            onPress={() => handleEmailAuth('up')}
            disabled={!canSubmit || !termsAccepted}
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
  const googleAvailable = !!GoogleSignin && !!GOOGLE_WEB_CLIENT_ID;

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
    if (!supabase) { Alert.alert('FluidBody+', tr.err_supabase_unavailable || 'Supabase indisponible.'); return; }
    const em = email.trim().toLowerCase();
    if (!validEmail) { setError(tr.ob_auth_err_email); return; }
    if (!validPass) { setError(tr.ob_auth_err_short); return; }
    setLoading(true); setError(''); setEmailExistsErr(false);
    try {
      if (mode === 'up') {
        const { data, error: err } = await withTimeout(supabase.auth.signUp({ email: em, password }), 15000, 'signUp');
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
        const { error: err } = await withTimeout(supabase.auth.signInWithPassword({ email: em, password }), 15000, 'signIn');
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
    if (!supabase) { Alert.alert('FluidBody+', tr.err_supabase_unavailable || 'Supabase indisponible.'); return; }
    if (!AppleAuth) { Alert.alert('Apple Sign In', tr.err_apple_module || 'Module expo-apple-authentication non chargé. Vérifie le plugin dans app.json.'); return; }
    if (!appleAvailable) { Alert.alert('FluidBody+', tr.auth_apple_unavailable || 'Sign in with Apple est disponible sur iOS uniquement.'); return; }
    setLoading(true); setError('');
    try {
      const credential = await withTimeout(AppleAuth.signInAsync({
        requestedScopes: [AppleAuth.AppleAuthenticationScope.FULL_NAME, AppleAuth.AppleAuthenticationScope.EMAIL],
      }), 45000, 'appleSheet');
      if (!credential.identityToken) {
        const msg = tr.err_apple_token_missing || 'Apple identity token manquant.';
        setError(msg); Alert.alert('Apple Sign In', msg);
        setLoading(false); return;
      }
      const { error: err } = await withTimeout(supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken }), 15000, 'appleSignIn');
      if (err) {
        setError(err.message); Alert.alert('Apple Sign In : Supabase', err.message || tr.err_supabase_generic || 'Erreur Supabase');
        setLoading(false); return;
      }
      const applePrenom = credential.fullName?.givenName || '';
      if (applePrenom) {
        try { await supabase.auth.updateUser({ data: { prenom: applePrenom } }); } catch(_) {}
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase.from('profiles').upsert({ id: session.user.id, prenom: applePrenom, updated_at: new Date().toISOString() });
          }
        } catch(e) { reportError('profiles.upsert.onboardingApple', e); }
      }
      // CGU (2026-07-23) : consentement implicite affiché à l'écran
      // (« En continuant, tu acceptes… ») — on trace la version acceptée.
      AsyncStorage.setItem(TERMS_ACCEPTED_STORAGE_KEY, String(LEGAL.termsVersion || '1.0')).catch(() => {});
      setLoading(false);
      finish();
    } catch (e) {
      if (e?.message && e.message.indexOf('timeout') !== -1) {
        setError(tr.ob_auth_err_apple_timeout || "L'identification Apple a pris trop de temps. Vérifie ta connexion.");
      } else if (e?.code !== 'ERR_REQUEST_CANCELED') {
        const msg = e?.message || tr.ob_auth_err_net || 'Erreur Apple Sign In';
        setError(msg);
        Alert.alert('Apple Sign In : erreur', `${msg}\n\nCode: ${e?.code || 'n/a'}`);
      }
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!supabase) { Alert.alert('FluidBody+', tr.err_supabase_unavailable || 'Supabase indisponible.'); return; }
    if (!GoogleSignin) { Alert.alert('Google Sign In', tr.err_google_module || 'Module @react-native-google-signin non chargé. Rebuild requis.'); return; }
    if (!GOOGLE_WEB_CLIENT_ID) { Alert.alert('Google Sign In', tr.err_google_not_configured || "Connexion Google pas encore configurée (webClientId manquant)."); return; }
    ensureGoogleConfigured();
    setLoading(true); setError('');
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res = await withTimeout(GoogleSignin.signIn(), 60000, 'googleSheet');
      if (res?.type === 'cancelled') { setLoading(false); return; }
      const idToken = res?.data?.idToken || res?.idToken || null;
      if (!idToken) { const msg = tr.err_google_token_missing || 'Google : identity token manquant.'; setError(msg); Alert.alert('Google Sign In', msg); setLoading(false); return; }
      const { error: err } = await withTimeout(supabase.auth.signInWithIdToken({ provider: 'google', token: idToken }), 15000, 'googleSignIn');
      if (err) { setError(err.message); Alert.alert('Google Sign In : Supabase', err.message || tr.err_supabase_generic || 'Erreur Supabase'); setLoading(false); return; }
      const gName = res?.data?.user?.givenName || res?.user?.givenName || '';
      if (gName) {
        try { await supabase.auth.updateUser({ data: { prenom: gName } }); } catch(_) {}
        try { const { data: { session } } = await supabase.auth.getSession(); if (session?.user) { await supabase.from('profiles').upsert({ id: session.user.id, prenom: gName, updated_at: new Date().toISOString() }); } } catch(e) { reportError('profiles.upsert.onboardingGoogle', e); }
      }
      // CGU (2026-07-23) : idem Apple — trace de la version acceptée.
      AsyncStorage.setItem(TERMS_ACCEPTED_STORAGE_KEY, String(LEGAL.termsVersion || '1.0')).catch(() => {});
      setLoading(false);
      finish();
    } catch (e) {
      const code = e?.code;
      if (GoogleStatusCodes && code === GoogleStatusCodes.SIGN_IN_CANCELLED) { setLoading(false); return; }
      if (e?.message && e.message.indexOf('timeout') !== -1) { setError(tr.ob_auth_err_apple_timeout || 'La connexion Google a pris trop de temps.'); }
      else { const msg = e?.message || tr.ob_auth_err_net || 'Erreur.'; setError(msg); Alert.alert('Google Sign In : erreur', `${msg}\n\nCode: ${code || 'n/a'}`); }
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
                  color: '#AEEF4D',
                  textShadowColor: 'rgba(0, 0, 0, 0.4)',
                  textShadowOffset: { width: 0, height: 3 },
                  textShadowRadius: 14,
                  ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
                }}
              >+</AnimatedPlus>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'nowrap', marginTop: -2, width: '100%', paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 28, fontWeight: '400', color: '#AEEF4D', letterSpacing: 16, textTransform: 'uppercase', textShadowColor: 'rgba(0, 12, 28, 0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10, ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}) }}>PILATES</Text>
            <Text style={{ marginLeft: 14, fontSize: 28, fontWeight: '300', color: '#AEEF4D', letterSpacing: 2, textShadowColor: 'rgba(0, 12, 28, 0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6, ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}) }}>{'& More'}</Text>
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
          {googleAvailable ? (
            <GlassButton
              onPress={handleGoogleSignIn}
              loading={loading}
              size="md"
              style={{ marginBottom: 16 }}
              leftIcon={
                <Svg width={18} height={18} viewBox="0 0 48 48">
                  <Path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107" />
                  <Path d="M3.2 14.7l7 5.1C12 16 17.5 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 15.4 2 7.9 6.9 3.2 14.7z" fill="#FF3D00" />
                  <Path d="M24 46c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 36.5 26.9 37 24 37c-6.1 0-10.7-3.1-12.5-8.4l-7 5.4C7.7 41.1 15.2 46 24 46z" fill="#4CAF50" />
                  <Path d="M44.5 20H24v8.5h11.8c-.8 2.3-2.3 4.3-4.1 5.8l6.6 5.6C42.2 36.6 45 31 45 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2" />
                </Svg>
              }
            >
              {tr.auth_google || 'Continuer avec Google'}
            </GlassButton>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(174,239,77,0.25)' }} />
            <Text style={{ fontSize: 11, color: '#AEEF4D', marginHorizontal: 14, letterSpacing: 1, textTransform: 'uppercase' }}>{tr.auth_or || 'ou'}</Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(174,239,77,0.25)' }} />
          </View>
          <TextInput
            value={email} onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            accessibilityLabel={tr.a11y_email_input || 'Adresse e-mail'}
            placeholder={tr.ob_email_ph}
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!loading}
            style={{ width: '100%', height: 48, backgroundColor: emailFocused ? 'rgba(174,239,77,0.06)' : 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: emailFocused ? '#AEEF4D' : 'rgba(255,255,255,0.25)', borderRadius: 25, color: '#ffffff', fontSize: 15, paddingHorizontal: 18, marginBottom: 8 }}
          />
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 14, marginBottom: 10, paddingHorizontal: 2 }}>
            En continuant, tu acceptes nos Conditions d'utilisation et notre{' '}
            <Text onPress={function() { RNLinking.openURL('https://yvan-glitch.github.io/fluidbody-privacy/'); }} style={{ color: 'rgba(174,239,77,0.7)', textDecorationLine: 'underline' }}>{tr.ob_auth_privacy_link || 'Politique de confidentialité'}</Text>
          </Text>
          <TextInput
            value={password} onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            accessibilityLabel={tr.a11y_password_input || 'Mot de passe'}
            placeholder={tr.ob_pass_ph}
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!loading}
            style={{ width: '100%', height: 48, backgroundColor: passwordFocused ? 'rgba(174,239,77,0.06)' : 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: passwordFocused ? '#AEEF4D' : 'rgba(255,255,255,0.25)', borderRadius: 25, color: '#ffffff', fontSize: 15, paddingHorizontal: 18, marginBottom: 10 }}
          />
          {error ? (
            emailExistsErr ? (
              <View style={{ marginBottom: 10, padding: 10, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.06)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.4)' }}>
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
  safeNativeFire('notif.setNotificationHandler', function() {
    Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }) });
  });
}

// expo-notifications 0.32 + iOS 26.5: l'ancien format de trigger
// `{ weekday, hour, minute, repeats: true }` lève une NSException côté
// natif (cf. crash build #43, EXC_BAD_ACCESS dans NSException→JSError
// converter, dladdr sur callStackReturnAddresses). Helpers ci-dessous.
function _trigDaily(hour, minute) {
  var TYPES = Notifications && Notifications.SchedulableTriggerInputTypes;
  return { type: (TYPES && TYPES.DAILY) || 'daily', hour: hour, minute: minute };
}
function _trigWeekly(weekday, hour, minute) {
  var TYPES = Notifications && Notifications.SchedulableTriggerInputTypes;
  return { type: (TYPES && TYPES.WEEKLY) || 'weekly', weekday: weekday, hour: hour, minute: minute };
}
function _trigTimeInterval(seconds, repeats) {
  var TYPES = Notifications && Notifications.SchedulableTriggerInputTypes;
  return { type: (TYPES && TYPES.TIME_INTERVAL) || 'timeInterval', seconds: seconds, repeats: !!repeats };
}

async function setupNotifications(lang = 'fr') {
  try {
    if (!Notifications || !Device) return;
    if (!Device.isDevice) return;
    const perm = await safeNativeCall('notif.requestPermissionsAsync', function() { return Notifications.requestPermissionsAsync(); }, null);
    if (!perm || perm.status !== 'granted') return;
    await safeNativeCall('notif.cancelAllScheduled', function() { return Notifications.cancelAllScheduledNotificationsAsync(); }, null);
    const tr = T[lang] || T['fr'];
    // Adaptive default: if the user never set a custom hour, lean on the
    // 14-day session-hour median (falls back to 18h when we don't have
    // enough data). Once the user picks an hour from Settings the explicit
    // value wins.
    var rawHour = await AsyncStorage.getItem('fluid_notif_hour');
    var savedHour = rawHour != null && rawHour !== '' ? parseInt(rawHour) : await getPreferredHour();
    if (!Number.isFinite(savedHour) || savedHour < 0 || savedHour > 23) savedHour = 18;
    var pauseEnabled = (await AsyncStorage.getItem('fluid_notif_pause_enabled')) !== 'false';
    var quoteEnabled = (await AsyncStorage.getItem('fluid_quote_enabled')) !== 'false';
    var quoteHour = parseInt(await AsyncStorage.getItem('fluid_quote_hour')) || 8;
    // Master toggle pour le rappel quotidien (default ON).
    var dailyEnabled = (await AsyncStorage.getItem('fluid_notif_daily_enabled')) !== 'false';
    if (dailyEnabled) {
      await safeNativeCall('notif.schedule.dailyMain', function() {
        return Notifications.scheduleNotificationAsync({
          content: {
            title: tr.notif_daily_title || tr.notif_title || ('FluidBody ' + U_JELLY),
            body: tr.notif_daily_body || tr.notif_body || "Sabrina t'attend pour ta pratique du jour " + U_JELLY,
            sound: true,
          },
          trigger: _trigDaily(savedHour, 0),
        });
      }, null);
    }
    // Phrase du jour — Sabrina : rotation quotidienne, re-schedulée à chaque ouverture
    if (quoteEnabled) {
      var quotes = SABRINA_QUOTES[lang] || SABRINA_QUOTES['fr'];
      if (quotes && quotes.length) {
        var d = new Date();
        var idx = (d.getDate() + d.getMonth() * 31) % quotes.length;
        await safeNativeCall('notif.schedule.quote', function() {
          return Notifications.scheduleNotificationAsync({
            content: { title: tr.notif_quote_title || 'Phrase du jour', body: quotes[idx], sound: false },
            trigger: _trigDaily(quoteHour, 0),
          });
        }, null);
      }
    }
    // Pause Active — Office : toutes les heures 9h-18h en semaine.
    // Tagged with `data.type = 'pause_active'` so the smart-notifications
    // layer can identify them via getAllScheduledNotificationsAsync() and
    // cancel selectively when HealthKit reports the user is already active.
    if (pauseEnabled) {
      for (var h = 9; h <= 17; h++) {
        for (var wd = 2; wd <= 6; wd++) {
          await safeNativeCall('notif.schedule.pause', (function(wd_, h_) { return function() {
            return Notifications.scheduleNotificationAsync({
              content: {
                title: tr.notif_pause_title || 'Pause Active',
                body: tr.notif_pause_body || 'C\'est le moment de bouger ! 5 min d\'étirements au bureau.',
                sound: true,
                data: { type: 'pause_active', scheduledHour: h_, scheduledWeekday: wd_ },
              },
              trigger: _trigWeekly(wd_, h_, 0),
            });
          }; })(wd, h), null);
        }
      }
    }
  } catch(e) { sentryCapture(e, { where: 'setupNotifications.outer' }); }
}

async function sendWelcomeNotification(prenom, lang = 'fr') {
  try {
    if (!Notifications || !Device || !Device.isDevice) return;
    const WELCOME_KEY = 'fluid_welcome_notif_sent';
    if (await AsyncStorage.getItem(WELCOME_KEY)) return;
    const perm = await safeNativeCall('notif.getPermissionsAsync.welcome', function() { return Notifications.getPermissionsAsync(); }, null);
    var granted = perm && perm.status === 'granted';
    if (!granted) {
      const req = await safeNativeCall('notif.requestPermissionsAsync.welcome', function() { return Notifications.requestPermissionsAsync(); }, null);
      granted = req && req.status === 'granted';
    }
    if (!granted) return;
    const tr = T[lang] || T['fr'];
    const body = typeof tr.notif_welcome_body === 'function' ? tr.notif_welcome_body(prenom) : tr.notif_welcome_body;
    await safeNativeCall('notif.schedule.welcome', function() {
      return Notifications.scheduleNotificationAsync({
        content: { title: tr.notif_welcome_title, body: body, sound: true },
        trigger: _trigTimeInterval(3, false),
      });
    }, null);
    await AsyncStorage.setItem(WELCOME_KEY, '1');
  } catch(e) { sentryCapture(e, { where: 'sendWelcomeNotification' }); }
}

const FLUID_SUB_KEY = 'fluid_sub';
const DONE_KEY = 'fluidbody_done';
// Seance-streak (count of consecutive days a séance was completed). Distinct
// from the *closed-rings* streak handled in ActivityScreen.
const STREAK_KEY = 'fluid_streak_seance_count';
const STREAK_DATE_KEY = 'fluid_streak_seance_last_date';

// ══════════════════════════════════
// TVMainView — Apple TV : MonCorps fullscreen + corner profile button.
// Aucune tab bar (la Siri Remote n'a pas de geste équivalent). Le
// bouton Menu de la Siri Remote ferme automatiquement le Modal
// VideoPlayer / Modal PilierPanel ouverts (RN tvOS gère `onRequestClose`
// nativement).
// ══════════════════════════════════
function TVMainView({ prenom, done, toggleDone, lang, tensionIdxs, onTensionChange, streak, isSubscriber, isAdmin, openPaywall, saveHealthKitWorkout, supaUser, onLogout }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileBtnFocused, setProfileBtnFocused] = useState(false);
  const [sabrinaOpen, setSabrinaOpen] = useState(false);
  const [sabrinaBtnFocused, setSabrinaBtnFocused] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <MonCorps
        prenom={prenom}
        done={done}
        toggleDone={toggleDone}
        lang={lang}
        tensionIdxs={tensionIdxs}
        onTensionChange={onTensionChange}
        streak={streak}
        isSubscriber={isSubscriber}
        onActivateSubscription={openPaywall}
        saveHealthKitWorkout={saveHealthKitWorkout}
        onOpenProfile={function() { setProfileOpen(true); }}
      />
      {/* Le point d'entrée Profil vit désormais dans la TVTopBar (avatar en
          haut à droite, rendu par MonCorps) → onOpenProfile ci-dessus. */}

      <Modal visible={profileOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={function() { setProfileOpen(false); }}>
        <ProfilTV
          lang={lang}
          supaUser={supaUser}
          isSubscriber={isSubscriber}
          isAdmin={isAdmin}
          onClose={function() { setProfileOpen(false); }}
          onOpenSabrina={function() { setSabrinaOpen(true); }}
          onLogout={async function() {
            setProfileOpen(false);
            await onLogout();
          }}
        />
      </Modal>

      {/* Avatar Sabrina — pill focusable à gauche du bouton "Mon compte".
          Ouvre l'écran SabrinaProfile (bio, citation, parcours). */}
      <TouchableOpacity
        hasTVPreferredFocus={false}
        onPress={function() { setSabrinaOpen(true); }}
        onFocus={function() { setSabrinaBtnFocused(true); }}
        onBlur={function() { setSabrinaBtnFocused(false); }}
        activeOpacity={0.85}
        accessibilityLabel="Sabrina"
        style={{
          position: 'absolute',
          top: 56, right: 270,
          paddingLeft: 8, paddingRight: 18, paddingVertical: 8,
          borderRadius: 28,
          flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: sabrinaBtnFocused ? 'rgba(174,239,77,0.18)' : 'rgba(255,255,255,0.08)',
          borderWidth: 2,
          borderColor: sabrinaBtnFocused ? '#AEEF4D' : 'rgba(255,255,255,0.15)',
          zIndex: 50,
        }}
      >
        <ExpoImage source={require('./assets/coach/sabrina_avatar.jpg')} contentFit="cover" cachePolicy="memory-disk" style={{ width: 36, height: 36, borderRadius: 18 }} />
        <Text style={{ fontSize: 15, color: '#ffffff', fontWeight: '600', letterSpacing: 0.3 }}>Sabrina</Text>
      </TouchableOpacity>

      <Modal visible={sabrinaOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={function() { setSabrinaOpen(false); }}>
        <SabrinaProfileTVScreen lang={lang} onClose={function() { setSabrinaOpen(false); }} />
      </Modal>
    </View>
  );
}

// ══════════════════════════════════
// MAIN APP
// ══════════════════════════════════
function MainApp({ prenom, lang, tensionIdxs, supabase, supaUser, onTensionChange, onAccountDeleted, onProfileSave }) {
  diag('MainApp.render', 'enter');
  const tr = T[lang] || T['fr'];
  const [done, setDone] = useState({
    p1: Array(20).fill(false), p2: Array(20).fill(false), p3: Array(20).fill(false),
    p4: Array(20).fill(false), p5: Array(20).fill(false), p6: Array(20).fill(false), p7: Array(20).fill(false), p8: Array(20).fill(false),
  });
  const [streak, setStreak] = useState(0);
  const [isSubscriber, setIsSubscriber] = useState(false);
  // Allowlist d'emails qui bypass IAP. Réduit à un seul email dédié
  // (utilisé pour la review Apple + admin officiel). À sortir en env var
  // / Supabase row à terme — pour l'instant hardcodé pour ne pas bloquer
  // la submission.
  const ADMIN_EMAILS = ['admin@fluidbody.ch', 'yvan@espace-pilates.ch', 'sabrina@espace-pilates.ch'];
  const isAdmin = !!(supaUser && supaUser.email && ADMIN_EMAILS.indexOf(supaUser.email.toLowerCase()) !== -1);
  const effectiveIsSubscriber = isSubscriber || isAdmin;
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [freeDetailVisible, setFreeDetailVisible] = useState(false);
  const [freeVideoPlaying, setFreeVideoPlaying] = useState(false);
  const [showFirstSeanceModal, setShowFirstSeanceModal] = useState(false);
  const [milestoneNum, setMilestoneNum] = useState(null);
  const [newAchievement, setNewAchievement] = useState(null);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [showStretchTimer, setShowStretchTimer] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [showSabrinaProfile, setShowSabrinaProfile] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [pendingDownloadOpen, setPendingDownloadOpen] = useState(null); // { pilier, idx } pour ouvrir VideoPlayer depuis MesTelechargements

  // Précharge le cache des préférences au mount pour que les composants
  // critiques (VideoPlayer audio mode, getSignedVideoUrl quality, DownloadButton)
  // puissent lire en sync dès le 1er rendu.
  useEffect(function() { primePreferencesCache(); }, []);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingProfileInitial, setEditingProfileInitial] = useState(null);
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [rcPackagesByProductId, setRcPackagesByProductId] = useState({});
  const [rcLoadingPrices, setRcLoadingPrices] = useState(false);
  const [coachWelcomeVisible, setCoachWelcomeVisible] = useState(false);
  const [medicalDisclaimerVisible, setMedicalDisclaimerVisible] = useState(false);
  const [purchaseConfettiActive, setPurchaseConfettiActive] = useState(false);
  const [annivVisible, setAnnivVisible] = useState(false);
  const [welcomeAnimVisible, setWelcomeAnimVisible] = useState(false);
  // Parrainage — mois gratuits en attente pour afficher le bandeau dans
  // le paywall. Source de vérité : Supabase. Refresh quand le paywall
  // s'ouvre + après un achat (cf. purchaseSubscription).
  const [freeDaysAvailable, setFreeDaysAvailable] = useState(0);

  async function refreshFreeDaysAvailable() {
    if (!supabase || !supaUser) {
      setFreeDaysAvailable(0);
      return;
    }
    try {
      const stats = await getReferralStats(supabase, supaUser.id);
      setFreeDaysAvailable(stats?.free_days_available || 0);
    } catch (e) {}
  }

  // First-launch coach welcome — once per install, opened ~700ms after MainApp
  // mounts so the user sees the tab bar settle first (less jarring than a hard
  // takeover). Flag in AsyncStorage; see `CoachWelcomeOverlay`.
  //
  // tvOS : on n'affiche jamais l'overlay coach. Le press de dismiss
  // (« Je commence ») laissait fuiter le focus vers le bouton « Mon compte »
  // → ProfilTV s'ouvrait tout seul. On le coupe purement sur TV.
  const coachWelcomeTriggeredRef = useRef(false);
  function maybeShowCoachWelcome() {
    if (coachWelcomeTriggeredRef.current || IS_TV) return;
    isCoachWelcomeSeen().then(function(seen) {
      if (seen || coachWelcomeTriggeredRef.current) return;
      coachWelcomeTriggeredRef.current = true;
      setTimeout(function() { setCoachWelcomeVisible(true); }, 700);
    });
  }

  // First-launch medical disclaimer — legal safety gate shown once per install,
  // BEFORE the coach welcome and before any session can start (protection
  // contre les claims de blessure). Flag in AsyncStorage; see
  // `MedicalDisclaimerOverlay`. Skipped on tvOS. When already acknowledged we
  // jump straight to the coach welcome so the two never stack.
  function runMedicalGate() {
    isMedicalDisclaimerSeen().then(function(seen) {
      if (seen || IS_TV) {
        maybeShowCoachWelcome();
      } else {
        setMedicalDisclaimerVisible(true);
      }
    });
  }

  // Enchainement des overlays de PREMIERE ouverture, en file indienne :
  // 1. WelcomeAnimation (meduse + prenom, une fois par install)
  // 2. puis avertissement medical (via runMedicalGate au onDone)
  // 3. puis mot de bienvenue de la coach (via maybeShowCoachWelcome)
  // Avant : welcome et disclaimer se declenchaient en parallele au premier
  // lancement et se chevauchaient a l'ecran pour les nouveaux comptes.
  useEffect(function() {
    let cancelled = false;
    isWelcomeAnimationShown().then(function(shown) {
      if (cancelled) return;
      if (shown) { runMedicalGate(); }
      else { setWelcomeAnimVisible(true); }
    });
    return function() { cancelled = true; };
  }, []);

  // 14 May anniversary easter egg. Fires once per calendar year (gated by
  // `fluid_anniv_seen_<year>` in AsyncStorage). Delayed ~1500ms so it lands
  // after MainApp + tab bar settle, not on top of a still-mounting screen.
  useEffect(function() {
    let cancelled = false;
    let timer = null;
    shouldShowAnniversary().then(function(should) {
      if (cancelled || !should) return;
      timer = setTimeout(function() { if (!cancelled) setAnnivVisible(true); }, 1500);
    });
    return function() {
      cancelled = true;
      if (timer) { try { clearTimeout(timer); } catch (e) {} }
    };
  }, []);

  useEffect(function() {
    // Defer HK init by ~400ms so it doesn't compete with the mount-time
    // RC + notification burst (which themselves are deferred 800ms). HK is
    // already proven stable post-Kingstinct migration but we keep it off
    // the first paint to be safe.
    diag('mainapp.initHealthKit.deferred', 'scheduled');
    var hkTimer = setTimeout(function() {
      diag('mainapp.initHealthKit.deferred', 'fired');
      try { initHealthKit(); } catch (e) { if (__DEV__) console.warn('initHealthKit throw:', e); }
    }, 400);
    return function() { try { clearTimeout(hkTimer); } catch (e) {} };
  }, []);

  useEffect(function() {
    // Visibilité du catalogue : cache local immédiat + refresh Supabase
    // best-effort (liste des session_id ayant une vidéo). Fire and forget.
    try { primeCatalogVisibility(); } catch (e) {}
    // Audit sécu 26/07 : purge des MP4 déchiffrés temporaires des sessions
    // précédentes (rien n'est en lecture au boot, delete sans race). Différé
    // pour ne pas concurrencer le premier rendu.
    var sweepTimer = setTimeout(function() {
      try { sweepTempVideos(); } catch (e) {}
    }, 3000);
    return function() { try { clearTimeout(sweepTimer); } catch (e) {} };
  }, []);

  const rcSupported = Platform.OS === 'ios';
  const rcDisabled = !Purchases || !rcSupported || (Device && Device.isDevice === false);

  const openPaywall = useStableCallback(function() {
    setPaywallVisible(true);
    // Refresh "à l'ouverture" plutôt que de mounter un listener continu :
    // l'utilisateur n'ouvre le paywall qu'en pressant un CTA, donc on a
    // un point d'entrée clair où re-fetcher.
    refreshFreeDaysAvailable();
  });

  async function setSubscriptionActive(active) {
    setIsSubscriber(!!active);
    try {
      await AsyncStorage.setItem(FLUID_SUB_KEY, active ? 'true' : 'false');
      // (2026-07-23) clé morte `is_subscription_active` supprimée : écrite ici
      // mais jamais relue nulle part — resetAllData continue de la purger.
    } catch (e) {}
  }

  async function refreshCustomerInfo() {
    const info = await safeNativeCall('rc.getCustomerInfo', function() { return Purchases.getCustomerInfo(); }, null);
    const active = !!info?.entitlements?.active?.[RC_ENTITLEMENT_ID];
    await setSubscriptionActive(active);
    return { info: info || null, active: active };
  }

  async function purchaseSubscription(pkg) {
    if (rcDisabled) return;
    const result = await safeNativeCall('rc.purchasePackage', function() { return Purchases.purchasePackage(pkg); }, null);
    if (!result) return;
    const customerInfo = result.customerInfo;
    const active = !!customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];
    await setSubscriptionActive(active);
    setPaywallVisible(false);
    if (active) {
      // Confettis méduses — fires after the paywall slide-out so the
      // transition reads as a reward, not a flash on top of the modal.
      setTimeout(function() {
        setPurchaseConfettiActive(true);
        setTimeout(function() { setPurchaseConfettiActive(false); }, 3000);
      }, 350);
      // Sync server-side (audit 2026-06-10 C-1/C-2) : l'edge function
      // confirm-purchase vérifie le paiement via l'API RevenueCat (clé
      // secrète), pose profiles.is_subscriber / rc_app_user_id (colonnes
      // verrouillées côté client) et crédite le parrain. Idempotent,
      // best-effort — l'utilisateur ne doit pas attendre.
      syncEntitlementServerSide();
    }
  }

  // Fire-and-forget : pousse l'entitlement RC vérifié vers Supabase.
  // C'est ce qui alimente profiles.is_subscriber pour le flux Apple TV.
  function syncEntitlementServerSide() {
    try {
      if (!supabase || !supaUser || rcDisabled) return;
      Promise.resolve(
        safeNativeCall('rc.getAppUserID', function() { return Purchases.getAppUserID(); }, null)
      ).then(function(rcId) {
        if (!rcId) return null;
        return creditReferralOnPaid(supabase, rcId);
      }).then(function(res) {
        if (res && __DEV__) devLog('confirm-purchase result:', res);
        // Rafraîchit les stats locales — le badge sur Profil bouge.
        refreshFreeDaysAvailable();
      }).catch(function() {});
    } catch (e) {}
  }

  async function restoreSubscription() {
    if (rcDisabled) return;
    const info = await safeNativeCall('rc.restorePurchases', function() { return Purchases.restorePurchases(); }, null);
    if (!info) return;
    const active = !!info?.entitlements?.active?.[RC_ENTITLEMENT_ID];
    await setSubscriptionActive(active);
    // Un restore réussi doit aussi resynchroniser is_subscriber côté
    // Supabase (cas : nouvel iPhone, ou TV pairée avant le restore).
    if (active) syncEntitlementServerSide();
  }

  // Apple TV : RevenueCat n'est pas dispo sur tvOS — on doit se reposer
  // sur `profiles.is_subscriber` côté Supabase (alimenté par le user qui
  // a payé sur iPhone). Sans ça, un user payé qui paire sa TV verrait le
  // paywall s'ouvrir — interdit par la règle « jamais de paywall TV ».
  // Le fetch est aussi exposé via `tvRefreshSubscriber` pour le bouton
  // Refresh du fallback paywall.
  const [tvSubFetchCount, setTvSubFetchCount] = useState(0);
  const tvRefreshSubscriber = useRef(null);
  useEffect(function() {
    if (!IS_TV) return;
    if (!supabase || !supaUser?.id) return;
    let cancelled = false;
    async function fetchTvSub() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_subscriber, subscription_expires_at')
          .eq('id', supaUser.id)
          .single();
        if (error) {
          if (__DEV__) devWarn('[TV] profile fetch failed', error.message);
          return;
        }
        // FIX audit 2026-06-10 (I-4) : on respecte l'expiry — un abonné
        // résilié ne doit pas garder l'accès TV indéfiniment via le flag.
        // expires_at null = abonnement sans échéance connue (legacy/admin).
        const expMs = data?.subscription_expires_at ? Date.parse(data.subscription_expires_at) : 0;
        const stillValid = !expMs || expMs > Date.now();
        if (!cancelled && data && data.is_subscriber === true && stillValid) {
          setIsSubscriber(true);
          try { await AsyncStorage.setItem(FLUID_SUB_KEY, 'true'); } catch (e) {}
        }
      } catch (e) {
        if (__DEV__) devWarn('[TV] profile fetch threw', e && e.message);
      }
    }
    tvRefreshSubscriber.current = function() { setTvSubFetchCount(function(n) { return n + 1; }); };
    fetchTvSub();
    return function() { cancelled = true; };
  }, [supaUser?.id, tvSubFetchCount]);

  useEffect(() => {
    async function loadData() {
      try {
        // Vérification abonnement : RevenueCat d'abord, cache AsyncStorage en fallback offline
        var subVerified = false;
        if (Purchases && !rcDisabled) {
          var info = await safeNativeCall('rc.getCustomerInfo.loadData', function() { return Purchases.getCustomerInfo(); }, null);
          if (info) {
            subVerified = !!(info?.entitlements?.active?.[RC_ENTITLEMENT_ID]);
            try { await AsyncStorage.setItem(FLUID_SUB_KEY, subVerified ? 'true' : 'false'); } catch (e) {}
          } else {
            // RC threw or returned nothing → fall back to cache
            var cachedRcFallback = await AsyncStorage.getItem(FLUID_SUB_KEY);
            subVerified = cachedRcFallback === 'true';
          }
        } else {
          // Offline fallback : cache local (non fiable, mais mieux que rien)
          var cachedOffline = await AsyncStorage.getItem(FLUID_SUB_KEY);
          subVerified = cachedOffline === 'true';
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
    // Defer native-heavy startup work by 800ms so the WelcomeIntro → MainApp
    // transition (and its confetti) finishes before we hammer the RN
    // TurboModule queue with RC + notification scheduling. This is a
    // mitigation for the build #46 crash on iOS 26.4.2 where an NSException
    // thrown during this very burst kills the converter.
    diag('mainapp.mount.deferred', 'scheduled');
    var deferTimer = setTimeout(function() {
      diag('mainapp.mount.deferred', 'fired');
      loadData();
      setupNotifications(lang);
      // Schedule the 24h post-onboarding nudge (no-op if already scheduled or
      // permission denied).
      schedulePostOnboardingNudge({ lang: lang });
      // Prime achievements cache for instant render in Stats/Activité.
      primeAchievements().catch(function () {});
    }, 800);
    return function() { try { clearTimeout(deferTimer); } catch (e) {} };
  }, []);

  // Smart suppression — on app foreground, check HealthKit and cancel
  // today's remaining "pause active" notifs if the user has already moved
  // enough. Throttled to one HK probe every 30 min to keep the bridge cool.
  useEffect(function() {
    var THROTTLE_MS = 30 * 60 * 1000;
    var THROTTLE_KEY = 'fluid_last_activity_check';
    async function maybeSuppress(source) {
      try {
        var lastRaw = await AsyncStorage.getItem(THROTTLE_KEY);
        var last = lastRaw ? parseInt(lastRaw, 10) : 0;
        if (Number.isFinite(last) && Date.now() - last < THROTTLE_MS) return;
        await AsyncStorage.setItem(THROTTLE_KEY, String(Date.now()));
        var probe = await isUserAlreadyActive();
        if (!probe || !probe.active) return;
        var count = await cancelPauseActiveNotifications('today');
        if (__DEV__) devLog('[SmartNotif] ' + source + ' - cancelled ' + count + ' pause notifs (reason: ' + probe.reason + ')', probe.values);
      } catch (e) {
        if (__DEV__) devWarn('[SmartNotif] maybeSuppress error', e);
      }
    }
    // Run once on mount (covers cold-start case) — deferred so it doesn't
    // pile on top of the existing 800ms setup burst.
    var bootTimer = setTimeout(function() { maybeSuppress('boot'); }, 1600);
    var sub = AppState.addEventListener('change', function(next) {
      if (next === 'active') { maybeSuppress('foreground'); }
    });
    return function() {
      try { clearTimeout(bootTimer); } catch (e) {}
      try { sub && sub.remove && sub.remove(); } catch (e) {}
    };
  }, []);

  // Streak protection — re-evaluated on every streak change, on cold start,
  // and when the user backgrounds + foregrounds the app (AppState handler in
  // the inner App component already triggers a re-render via setSupaUser /
  // setSubscriptionActive paths, so we just react to `streak`).
  useEffect(() => {
    if (!streak || streak < 3) return;
    scheduleStreakProtectionToday({ streak: streak, lang: lang });
  }, [streak, lang]);

  useEffect(() => {
    if (rcDisabled) return;
    let mounted = true;
    let customerInfoListener = null;
    let rcDeferTimer = null;

    async function initRevenueCat() {
      const configured = safeNativeCall('rc.configure', function() {
        Purchases.configure({ apiKey: RC_API_KEY_IOS });
        return true;
      }, false);
      if (!configured) return;

      try { await refreshCustomerInfo(); } catch (e) {}

      customerInfoListener = async (info) => {
        try {
          const active = !!info?.entitlements?.active?.[RC_ENTITLEMENT_ID];
          await setSubscriptionActive(active);
        } catch (e) {}
      };
      safeNativeCall('rc.addCustomerInfoUpdateListener', function() {
        Purchases.addCustomerInfoUpdateListener(customerInfoListener);
        return true;
      }, false);

      try {
        if (__DEV__) devLog('Loading products...', PRODUCT_IDS);
        setRcLoadingPrices(true);
        const offerings = await safeNativeCall('rc.getOfferings', function() { return Purchases.getOfferings(); }, null);
        if (!offerings) {
          if (mounted) setRcLoadingPrices(false);
          return;
        }
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

    // Defer the RC init burst by ~1.2s so the WelcomeIntro → MainApp
    // transition finishes first. The deferred-loadData hook above already
    // shifts the early getCustomerInfo by 800ms; pushing the listener +
    // offerings fetch slightly further keeps them off the same animation
    // frame as the confetti tear-down.
    diag('mainapp.initRevenueCat.deferred', 'scheduled');
    rcDeferTimer = setTimeout(function() {
      if (!mounted) return;
      diag('mainapp.initRevenueCat.deferred', 'fired');
      initRevenueCat();
    }, 1200);
    return () => {
      mounted = false;
      if (rcDeferTimer) { try { clearTimeout(rcDeferTimer); } catch (e) {} }
      if (customerInfoListener) {
        safeNativeCall('rc.removeCustomerInfoUpdateListener', function() {
          Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
          return true;
        }, false);
      }
    };
  }, []);

  const resetAllData = useStableCallback(async function() {
    try {
      var keys = await AsyncStorage.getAllKeys();
      var fluidKeys = keys.filter(function(k) { return k.startsWith('fluid') || k === DONE_KEY || k === 'is_subscription_active'; });
      if (fluidKeys.length > 0) await AsyncStorage.multiRemove(fluidKeys);
    } catch(e) {}
    setDone({ p1: Array(20).fill(false), p2: Array(20).fill(false), p3: Array(20).fill(false), p4: Array(20).fill(false), p5: Array(20).fill(false), p6: Array(20).fill(false), p7: Array(20).fill(false), p8: Array(20).fill(false) });
    setStreak(0);
    setIsSubscriber(false);
    try { await clearAchievements(); } catch (e) {}
  });

  // PERF (2026-07-23, audit constat 3) : le corps du handler ne fait plus que
  // haptique + setState — TOUTE la persistance (AsyncStorage, Supabase,
  // milestones, calendar, achievements, streak) part en tâche de fond sans
  // bloquer le retour visuel du tap. L'ordre interne des blocs de fond est
  // préservé à l'identique (calendar → achievements → streak).
  const toggleDone = useStableCallback(function(key, idx) {
    const wasDone = !!done[key][idx];
    const next = { ...done, [key]: [...done[key]] };
    next[key][idx] = !next[key][idx];
    // Retour haptique : fierté quand on valide une séance, discret quand on décoche.
    if (next[key][idx]) { hapticSuccess(); } else { hapticLight(); }
    setDone(next);
    // Persistance fire-and-forget.
    AsyncStorage.setItem(DONE_KEY, JSON.stringify(next)).catch(function() {});
    if (supabase && supaUser) {
      Promise.resolve(
        supabase.from('progression').upsert({ user_id: supaUser.id, done: next, updated_at: new Date().toISOString() })
      ).then(function(r) { if (r && r.error) reportError('progression.upsert', r.error); })
       .catch(function(e) { reportError('progression.upsert', e); });
    }
    if (wasDone) return; // Décocher : rien d'autre à déclencher.
    // First séance modal
    if (!supaUser) {
      var prevTotal = Object.values(done).flat().filter(Boolean).length;
      if (prevTotal === 0) {
        setTimeout(function() { setShowFirstSeanceModal(true); }, 1500);
      }
    }
    // Milestone celebrations
    var MILESTONES = [5, 7, 10, 15, 20, 25, 30, 35, 40, 100];
    var PUSH_MILESTONES = [7, 30, 100];
    var newTotal = 0;
    Object.values(next).forEach(function(arr) {
      if (arr) arr.forEach(function(v) { if (v) newTotal++; });
    });
    if (MILESTONES.includes(newTotal)) {
      AsyncStorage.getItem('fluid_milestones_seen').then(function(raw) {
        var seen = raw ? JSON.parse(raw) : [];
        if (!seen.includes(newTotal)) {
          seen.push(newTotal);
          AsyncStorage.setItem('fluid_milestones_seen', JSON.stringify(seen)).catch(function() {});
          setMilestoneNum(newTotal);
          if (PUSH_MILESTONES.includes(newTotal)) {
            scheduleMilestoneReward({ milestoneNum: newTotal, lang: lang, prenom: prenom });
          }
        }
      }).catch(function() {});
    }
    // Tâche de fond : calendar → achievements → streak (ordre historique).
    (async function() {
      // Calendar heatmap
      try {
        var calKey = 'fluid_activity_calendar';
        var calRaw = await AsyncStorage.getItem(calKey);
        var cal = calRaw ? JSON.parse(calRaw) : {};
        var todayCal = new Date().toISOString().slice(0, 10);
        cal[todayCal] = (cal[todayCal] || 0) + 1;
        await AsyncStorage.setItem(calKey, JSON.stringify(cal));
      } catch(e) {}
      // Achievements — auto-détection en parallèle des milestones.
      try {
        await recordPilierUsage(key);
        const recent = await getRecentPiliers();
        const streakNow = parseInt(await AsyncStorage.getItem(STREAK_KEY) || '0') || streak;
        const fresh = await detectNewUnlocks({
          done: next,
          streak: streakNow,
          nowHour: new Date().getHours(),
          recentPiliers: recent,
        });
        if (fresh && fresh.length > 0) {
          // On affiche le premier débloqué ; les éventuels suivants seront
          // visibles dans la section "Badges" de l'écran Activité.
          setTimeout(function () { setNewAchievement(fresh[0]); }, 800);
        }
      } catch (e) {}
      // Streak
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
      // Demande d'avis App Store — sur un moment positif, jamais en même
      // temps qu'un milestone (qui a son propre overlay). Délai pour laisser
      // la célébration de séance se terminer. No-op tant que expo-store-review
      // n'est pas dans le build natif (safe-require).
      if (!MILESTONES.includes(newTotal)) {
        var streakForReview = parseInt(await AsyncStorage.getItem(STREAK_KEY) || '0') || streak;
        setTimeout(function() {
          maybeAskForReview({ totalDone: newTotal, streak: streakForReview }).catch(function() {});
        }, 2600);
      }
    })();
  });

  // Flush any pending profile sync on cold start when a session is available.
  useEffect(function() {
    if (!supaUser?.id) return undefined;
    flushPendingProfileSync({ userId: supaUser.id }).catch(function() {});
  }, [supaUser?.id]);

  // PERF — handlers à identité stable passés aux écrans mémoïsés (avant :
  // recréés inline à chaque rendu → tous les onglets re-rendaient à chaque
  // setState de MainApp).
  const onTryFreeSession = useStableCallback(function() { setFreeDetailVisible(true); });
  const onCreateAccount = useStableCallback(function() { setShowAuthScreen(true); });
  const onOpenStatistics = useStableCallback(function() { setShowStatistics(true); });
  const onOpenTimer = useStableCallback(function() { setShowStretchTimer(true); });
  const onOpenSabrina = useStableCallback(function() { setShowSabrinaProfile(true); });
  const onOpenAchievements = useStableCallback(function() { setShowAchievements(true); });
  const onOpenDownloads = useStableCallback(function() { setShowDownloads(true); });
  const onOpenPreferences = useStableCallback(function() { setShowPreferences(true); });
  const onRestorePurchases = useStableCallback(function() { setPaywallVisible(true); });
  const onEditProfile = useStableCallback(function(initial) { setEditingProfileInitial(initial || null); setEditingProfile(true); });
  const onProfilLogout = useStableCallback(async function() {
    if (!supabase) { Alert.alert('FluidBody+', tr.err_supabase_unavailable || 'Supabase indisponible.'); return; }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) { Alert.alert('FluidBody+', error.message || tr.err_signout || 'Erreur de déconnexion.'); return; }
      // Audit sécu 26/07 : purge du profil caché (prénom, mensurations…) et
      // de la file de sync en attente. Sans ça, sur un appareil partagé le
      // compte suivant héritait des données perso du précédent, et la file
      // pending (non scoppée à un user) pouvait pousser les données de
      // l'ancien compte dans le profil du nouveau.
      try { await clearCachedProfile(); } catch (e) {}
    } catch (e) {
      Alert.alert('FluidBody+', e?.message || tr.err_signout || 'Erreur de déconnexion.');
    }
  });
  // Séance du jour mémoïsée (avant : getSeanceDuJour recalculé à chaque rendu
  // de MainApp, même modale fermée — audit I-7 du 23/07).
  const sdj = useMemo(function() { return getSeanceDuJour(done, tensionIdxs, lang); }, [done, tensionIdxs, lang]);

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
        freeDaysAvailable={freeDaysAvailable}
        isSubscriber={effectiveIsSubscriber}
        onTvRefreshSubscriber={() => { if (tvRefreshSubscriber.current) tvRefreshSubscriber.current(); }}
      />
      <SeanceDetailModal
        visible={freeDetailVisible}
        onClose={() => { setFreeDetailVisible(false); setFreeVideoPlaying(false); }}
        sdj={sdj}
        lang={lang}
        onPlay={() => {
          const sid = sdj ? buildSessionId(sdj.pilier.key, sdj.idx) : null;
          if (sid) prefetchSignedVideoUrl(sid, 'mp4');
          setFreeDetailVisible(false);
          setFreeVideoPlaying(true);
        }}
      />
      {freeVideoPlaying && (function() {
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
              <View style={{ marginTop: 12 }}>
                <Icon name="confetti" size={36} color="#AEEF4D" />
              </View>
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
      {IS_TV ? (
        <TVMainView
          prenom={prenom}
          done={done}
          toggleDone={toggleDone}
          lang={lang}
          tensionIdxs={tensionIdxs}
          onTensionChange={onTensionChange}
          streak={streak}
          isSubscriber={effectiveIsSubscriber}
          isAdmin={isAdmin}
          openPaywall={openPaywall}
          saveHealthKitWorkout={saveHealthKitWorkout}
          supaUser={supaUser}
          onLogout={async () => {
            if (!supabase) { Alert.alert('FluidBody+', tr.err_supabase_unavailable || 'Supabase indisponible.'); return; }
            try { await supabase.auth.signOut(); } catch (e) {}
            try { await clearCachedProfile(); } catch (e) {}
          }}
        />
      ) : (
        <NavigationContainer>
            <Tab.Navigator
              tabBar={renderCustomTabBar}
              screenOptions={TAB_NAV_SCREEN_OPTIONS}
              screenListeners={TAB_NAV_SCREEN_LISTENERS}
            >
            {/* Refonte IA 2026-07-23 (rev. 2, demande Yvan) : 4 onglets —
                Séances · Activité · Progrès (ex-Résumé) · Profil.
                Biblio retirée du menu pour l'instant (focus vidéos). */}
            <Tab.Screen name={tr.tabs[0]} options={TAB_OPTIONS_HOME}>{() => <MonCorpsMemo prenom={prenom} done={done} toggleDone={toggleDone} lang={lang} tensionIdxs={tensionIdxs} onTensionChange={onTensionChange} streak={streak} isSubscriber={effectiveIsSubscriber} onActivateSubscription={openPaywall} onTryFreeSession={onTryFreeSession} saveHealthKitWorkout={saveHealthKitWorkout} supabase={supabase} supaUser={supaUser} />}</Tab.Screen>
            <Tab.Screen name={tr.activity_tab || 'Activité'} options={TAB_OPTIONS_ACTIVITY}>{() => <ActivityScreenMemo lang={lang} supabase={supabase} supaUser={supaUser} done={done} />}</Tab.Screen>
            <Tab.Screen name={tr.tabs[1]} options={TAB_OPTIONS_RESUME}>{() => <ResumeScreenMemo done={done} lang={lang} streak={streak} prenom={prenom} tensionIdxs={tensionIdxs} supaUser={supaUser} onCreateAccount={onCreateAccount} onOpenStatistics={onOpenStatistics} />}</Tab.Screen>
            <Tab.Screen name={tr.tabs[3]} options={TAB_OPTIONS_PROFIL}>{() => <ProfilScreenMemo prenom={prenom} done={done} lang={lang} streak={streak} supabase={supabase} supaUser={supaUser} onLogout={onProfilLogout} onCreateAccount={onCreateAccount} isSubscriber={effectiveIsSubscriber} isAdmin={isAdmin} onRestorePurchases={onRestorePurchases} onReset={resetAllData} onOpenTimer={onOpenTimer} onOpenStatistics={onOpenStatistics} onOpenSabrina={onOpenSabrina} onOpenAchievements={onOpenAchievements} onOpenDownloads={onOpenDownloads} onOpenPreferences={onOpenPreferences} onEditProfile={onEditProfile} profileRefreshKey={profileRefreshKey} onAccountDeleted={onAccountDeleted} />}</Tab.Screen>
          </Tab.Navigator>
        </NavigationContainer>
      )}
      <StretchTimerModal visible={showStretchTimer} onClose={function() { setShowStretchTimer(false); }} lang={lang} />
      <SabrinaProfileModal visible={showSabrinaProfile} lang={lang} onClose={function() { setShowSabrinaProfile(false); }} />
      <Modal visible={showStatistics} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={function() { setShowStatistics(false); }}>
        <StatisticsScreen lang={lang} done={done} streak={streak} supaUser={supaUser} onClose={function() { setShowStatistics(false); }} />
      </Modal>
      <Modal visible={showPreferences} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={function() { setShowPreferences(false); }}>
        <PreferencesScreen
          visible={showPreferences}
          lang={lang}
          onClose={function() { setShowPreferences(false); }}
        />
      </Modal>
      <Modal visible={showAchievements} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={function() { setShowAchievements(false); }}>
        <AchievementsScreen
          visible={showAchievements}
          lang={lang}
          onClose={function() { setShowAchievements(false); }}
        />
      </Modal>
      <Modal visible={showDownloads} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={function() { setShowDownloads(false); }}>
        <MesTelechargements
          visible={showDownloads}
          lang={lang}
          onClose={function() { setShowDownloads(false); }}
          onOpenSeance={function(pilier, idx) {
            // Au tap d'un download, on ferme la modal et on ouvre le
            // VideoPlayer (qui auto-detect le local file via DownloadManager).
            setShowDownloads(false);
            setTimeout(function() { setPendingDownloadOpen({ pilier: pilier, idx: idx }); }, 220);
          }}
        />
      </Modal>
      {pendingDownloadOpen ? (
        <Modal visible animationType="fade" presentationStyle="fullScreen" statusBarTranslucent supportedOrientations={['portrait', 'landscape-left', 'landscape-right']} onRequestClose={function() { setPendingDownloadOpen(null); }}>
          <VideoPlayer
            key={'dl-' + pendingDownloadOpen.pilier.key + '-' + pendingDownloadOpen.idx}
            seance={(getSeances(lang)[pendingDownloadOpen.pilier.key] || [])[pendingDownloadOpen.idx]}
            pilier={pendingDownloadOpen.pilier}
            lang={lang}
            seanceIndex={pendingDownloadOpen.idx}
            isDemo={false}
            onClose={function() { setPendingDownloadOpen(null); }}
            onComplete={function() { setPendingDownloadOpen(null); }}
            saveHealthKitWorkout={saveHealthKitWorkout}
          />
        </Modal>
      ) : null}
      <Modal visible={editingProfile} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={function() { setEditingProfile(false); }}>
        <ProfileOnboardingScreen
          lang={lang}
          initialData={editingProfileInitial}
          supaUser={supaUser}
          ctaLabel={(T[lang] || T.fr).profile_save_btn || 'Enregistrer'}
          onClose={function() { setEditingProfile(false); }}
          onDone={function(payload) {
            // FIX audit 2026-06-10 (E-3) : handleProfileSetupSave vit dans
            // App(), pas dans MainApp — l'appel direct levait un
            // ReferenceError et laissait la modal bloquée. La fonction est
            // passée en prop (onProfileSave).
            // FIX 2026-06-11 (lenteur) : PAS de await ici. Quand onDone est
            // appelé, ProfileOnboarding a DÉJÀ tout sauvé via syncProfilePatch
            // (AsyncStorage + upsert Supabase + file de retry offline).
            // onProfileSave ne fait que du mirroring (state prenom, flag
            // AsyncStorage, metadata auth) + un upsert redondant hérité du
            // debug onboarding, avec des timeouts de secours de 15 s qui
            // faisaient poireauter l'utilisateur sur la modal. Fire-and-forget.
            try {
              if (onProfileSave) {
                Promise.resolve(onProfileSave(payload)).catch(function(e) { devWarn('profile save (bg)', e); });
              }
            } catch (e) { devWarn('profile save', e); }
            setEditingProfile(false);
            setProfileRefreshKey(function(k) { return k + 1; });
          }}
        />
      </Modal>
      {milestoneNum && (
        <Modal visible={true} transparent animationType="fade" statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,14,24,0.92)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ alignItems: 'center', padding: 40 }}>
              <View style={{ marginBottom: 16 }}>
                <Icon name="trophy" size={72} color="#AEEF4D" />
              </View>
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
      {newAchievement ? (function () {
        var meta = getAchievementById(newAchievement);
        if (!meta) return null;
        var isFrLang = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
        return (
          <Modal visible={true} transparent animationType="fade" statusBarTranslucent>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,14,24,0.92)', justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ alignItems: 'center', padding: 40, maxWidth: 360 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#AEEF4D', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 18 }}>
                  {isFrLang ? 'Badge débloqué' : 'Badge unlocked'}
                </Text>
                <View style={{ width: 96, height: 96, marginBottom: 18, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={meta.iconKey} size={84} color="#AEEF4D" />
                </View>
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 10, letterSpacing: -0.3 }}>
                  {isFrLang ? meta.titleFr : meta.titleEn}
                </Text>
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
                  {isFrLang ? meta.descFr : meta.descEn}
                </Text>
                <GlassButton
                  onPress={function () { setNewAchievement(null); }}
                  fullWidth={false}
                  textColor="#AEEF4D"
                  style={{ paddingHorizontal: 40 }}
                >
                  {isFrLang ? 'Continuer' : 'Continue'}
                </GlassButton>
              </View>
            </View>
          </Modal>
        );
      })() : null}
      <MedicalDisclaimerOverlay
        visible={medicalDisclaimerVisible}
        lang={lang}
        onDone={function() {
          setMedicalDisclaimerVisible(false);
          maybeShowCoachWelcome();
        }}
      />
      <CoachWelcomeOverlay
        visible={coachWelcomeVisible}
        lang={lang}
        prenom={prenom}
        onDone={function() { setCoachWelcomeVisible(false); }}
      />
      <AnniversaryOverlay
        visible={annivVisible}
        lang={lang}
        prenom={prenom}
        onDismiss={function() { setAnnivVisible(false); }}
      />
      <WelcomeAnimation
        visible={welcomeAnimVisible}
        lang={lang}
        prenom={prenom}
        tr={tr}
        onDone={function() {
          setWelcomeAnimVisible(false);
          // Etape suivante de la file : avertissement medical, puis coach.
          runMedicalGate();
        }}
      />
      {purchaseConfettiActive && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }}>
          <Confetti count={90} duration={2800} />
        </View>
      )}
      <OtaUpdateBanner lang={lang} />
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
    diag('welcomeIntro.handleSubmit', 'start');
    if (selectedIdxs.length === 0) {
      diag('welcomeIntro.handleSubmit.noConfetti', 'done');
      onDone(selectedIdxs);
      return;
    }
    diag('welcomeIntro.confetti', 'start');
    setConfettiActive(true);
    // Bumped from 2000 → 2500ms so the confetti animation + RN cleanup
    // finish on the main thread before MainApp mounts and the deferred
    // native burst kicks in. Mitigation for the build #46 iOS 26.4.2
    // crash in the TurboModule queue.
    setTimeout(function() {
      diag('welcomeIntro.onDone', 'fire');
      onDone(selectedIdxs);
    }, 2500);
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
            borderColor: '#AEEF4D',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: confettiActive ? 0.45 : 1,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#AEEF4D', letterSpacing: 0.2 }}>
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
    diag('dismissWelcomeIntro', 'start');
    setWelcomeShown(true);
    AsyncStorage.setItem('fluid_welcome_intro_done', '1').catch(function(e) { devWarn('welcome flag persist', e); });
    diag('dismissWelcomeIntro', 'done');
  }

  // HEALTHKIT_DISABLED est hoisté au scope module (cf. App.js ~ligne 142).
  // Si activé en kill-switch, on auto-marque le prompt comme done pour que
  // l'utilisateur ne voie pas l'écran de permission HK.

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
      // Miroir AsyncStorage de la DOB pour les composants offline (VideoPlayer / FCmax).
      try {
        if (payload && payload.birth_date) await AsyncStorage.setItem('fluid_birth_date', payload.birth_date);
      } catch (e) {}
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
          devLog('[ProfileSetup] <<< upsert TIMEOUT (15s) - flow continue, upsert poursuit en background');
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
            devLog('[ProfileSetup] <<< upsert OK - status:', res.status, '| statusText:', res.statusText);
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
      // Adresse Apple « Masquer mon e-mail » : le local-part est un hash
      // aléatoire, impossible d'en dériver un prénom — on n'invente rien.
      // (FIX audit 2026-06-10 E-4 : un 'Yvan' de debug était hardcodé ici
      // et saluait tous les utilisateurs private-relay par ce prénom.)
      if (email.toLowerCase().indexOf('privaterelay.appleid.com') !== -1) return '';
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
      // Push any pending offline edits (best effort).
      try { await flushPendingProfileSync({ userId: user.id }); } catch (e) { devWarn('flushPendingProfileSync', e); }
      // Refresh the local cache with the authoritative remote row so the
      // Activity / ProfileOnboarding screens see latest goals + streak.
      try { await refreshFromRemote(user.id); } catch (e) {}
      // If the remote row already marks onboarding complete, skip the
      // ProfileOnboarding gate even if AsyncStorage hasn't been written
      // yet on this device.
      if (profile && profile.onboarding_completed) {
        setProfileSetupShown(true);
        AsyncStorage.setItem('fluid_profile_setup_done', '1').catch(function() {});
      }
    }

    // Helper : Promise.race avec timeout pour proteger les appels reseau.
    // Si la promesse ne resout pas en `ms` millisecondes, on rejette avec une erreur.
    function withTimeout(promise, ms, label) {
      return Promise.race([
        promise,
        new Promise(function(_, reject) {
          setTimeout(function() {
            reject(new Error(label + ' timeout after ' + ms + 'ms'));
          }, ms);
        })
      ]);
    }
    function finishLoading() {
      // Splash minimum = 2000 ms (reduit de 3000 le 2026-07-07 : l'app parait
      // nettement plus fluide au demarrage, la meduse reste bien visible).
      var elapsed = Date.now() - splashStart;
      var remain = Math.max(0, 2000 - elapsed);
      if (remain === 0) setLoading(false);
      else setTimeout(function() { setLoading(false); }, remain);
    }
    async function checkSession() {
      try {
        if (!supabase) { finishLoading(); return; }
        // Timeout 5s sur getSession : evite que le splash reste fige si Supabase ne repond pas.
        const { data: { session }, error: se } = await withTimeout(
          supabase.auth.getSession(),
          5000,
          'getSession'
        );
        if (se) devWarn('getSession', se);
        if (session?.user) {
          setSupaUser(session.user);
          // Timeout 5s sur fetchAndMergeProfile : meme protection.
          // Le fetch profil a son propre try/catch : s'il echoue (reseau lent),
          // on laisse quand meme entrer l'utilisateur avec ses donnees locales
          // au lieu de le renvoyer vers l'ecran de connexion.
          try {
            await withTimeout(fetchAndMergeProfile(session.user), 5000, 'fetchProfile');
          } catch (pe) { devWarn('fetchProfile boot', pe); }
          setShowAuth(false);
          setOnboardingDone(true);
          // Session restaurée → l'utilisateur a déjà passé l'intro/sign-in.
          // Sans ce flag, le gate `!introShown` (renderActiveScreen) afficherait
          // l'OnboardingScreen à chaque cold-start malgré la session valide,
          // donnant l'impression qu'il faut "se reconnecter".
          setIntroShown(true);
        }
      } catch (e) { devWarn('Session / profil', e); }
      finishLoading();
    }
    checkSession();
    if (!supabase) return undefined;
    // ATTENTION deadlock supabase-js : il ne faut JAMAIS `await` un appel
    // reseau directement dans le callback onAuthStateChange. Le client tient
    // un verrou interne pendant le callback ; si fetchAndMergeProfile traine
    // (reseau flaky au demarrage), TOUS les autres appels auth (getSession,
    // refresh de token...) se bloquent en attendant le verrou → spinner
    // infini "a la connexion" jusqu'au kill de l'app. On differe donc le
    // travail avec setTimeout(0) pour sortir du callback immediatement,
    // et on ajoute un timeout dur de 8s sur le fetch profil.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_IN') breadcrumb('Login', { uid: session?.user?.id }, { category: 'auth' });
      else if (_event === 'SIGNED_OUT') breadcrumb('Logout', undefined, { category: 'auth' });
      setSupaUser(session?.user || null);
      if (session?.user) {
        const u = session.user;
        setTimeout(async function() {
          try {
            await withTimeout(fetchAndMergeProfile(u), 8000, 'fetchProfileAuthChange');
          } catch (e) { devWarn('Profil après connexion', e); }
          // Session valide → on laisse entrer, meme si le profil distant n'a
          // pas pu etre recupere (les donnees locales prennent le relais).
          setShowAuth(false);
          setOnboardingDone(true);
          // Idem : si le SIGNED_IN ou TOKEN_REFRESHED arrive après le bootstrap
          // (rare mais possible), on s'assure aussi de passer l'intro.
          setIntroShown(true);
        }, 0);
      }
    });
    // Safety net absolu : force la sortie du splash apres 8s maximum,
    // peu importe ce qui se passe avec les appels async ci-dessus.
    // Cette protection garantit que l'utilisateur ne reste JAMAIS coince
    // sur le splash, meme si une exception non-attrapee survient.
    const splashSafetyTimer = setTimeout(function() {
      setLoading(false);
    }, 8000);
    return () => {
      clearTimeout(splashSafetyTimer);
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!Sentry || !SENTRY_DSN) return;
    safeNativeFire('sentry.setUser', function() {
      if (supaUser?.id) Sentry.setUser({ id: supaUser.id });
      else Sentry.setUser(null);
    });
  }, [supaUser]);

  // ── Deep linking : fluidbody://invite?code=XYZ ─────────────────────
  // Cas 1 (app lancée par tap sur lien) : getInitialURL au mount.
  // Cas 2 (app déjà ouverte) : addEventListener('url').
  // Dans les 2 cas, on extrait le code et on le stocke en pending. Le
  // ProfileOnboarding le consommera au prochain mount (prefill). Si
  // l'utilisateur est *déjà* dans l'app sans avoir fait l'onboarding,
  // un re-mount ne se produit pas — c'est volontaire pour MVP (l'user
  // doit relancer ou refaire l'onboarding pour appliquer le code).
  useEffect(function() {
    function handleUrl(url) {
      if (!url) return;
      var code = parseReferralCodeFromUrl(url);
      if (!code) return;
      if (__DEV__) devLog('referral deep link, code captured:', code);
      savePendingReferralCode(code);
    }
    try {
      RNLinking.getInitialURL().then(handleUrl).catch(function() {});
    } catch (e) {}
    var sub = null;
    try {
      sub = RNLinking.addEventListener('url', function(evt) { handleUrl(evt?.url); });
    } catch (e) {}
    return function() {
      try { if (sub && sub.remove) sub.remove(); } catch (e) {}
    };
  }, []);

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

  // Called from ProfilScreen after delete_my_account + signOut +
  // clearLocalUserData all succeeded. Storage is already wiped (except
  // fluid_lang / fluid_theme_mode kept by clearLocalUserData), so all
  // we need to do here is reset React state back to the first-launch
  // shape — that re-triggers OnboardingScreen on the next render.
  function handleAccountDeleted() {
    setOnboardingDone(false);
    setIntroShown(false);
    setPrenom('');
    setTensionIdxs([]);
    setWelcomeShown(null);
    setProfileSetupShown(null);
    setHkPromptShown(null);
    setShowAuth(false);
    setShowSignIn(false);
    setSignInPrefillEmail('');
    setSupaUser(null);
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
  // Splash → first screen cross-fade. Apple bezier (0.32, 0.72, 0, 1), 480ms,
  // plus a subtle 8px horizontal slide so the splash feels like a page that
  // turns rather than a hard cut.
  const splashOverlayOpacity = useRef(new Animated.Value(1)).current;
  const splashOverlayTx = useRef(new Animated.Value(0)).current;
  const [splashOverlayMounted, setSplashOverlayMounted] = useState(true);

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

  useEffect(function() {
    if (loading) return undefined;
    // Splash is done. The next screen is already rendered underneath; fade
    // the splash overlay out with Apple's preferred easing curve so the
    // transition reads as a continuous page passage, not a cut.
    // 150ms hold lets the logo breathe a fraction of a second more before
    // the fade starts; the 12px slide (up from 8px) makes the page-turn
    // feel intentional without crossing into parallax.
    const appleEase = Easing.bezier(0.32, 0.72, 0, 1);
    const anim = Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(splashOverlayOpacity, { toValue: 0, duration: 600, easing: appleEase, useNativeDriver: true }),
        Animated.timing(splashOverlayTx, { toValue: -12, duration: 600, easing: appleEase, useNativeDriver: true }),
      ]),
    ]);
    anim.start(function() { setSplashOverlayMounted(false); });
    return function() { try { anim.stop && anim.stop(); } catch (e) {} };
  }, [loading]);

  function renderActiveScreen() {
    // Apple TV : flow simplifié — pas d'onboarding (HealthKit /
    // notifications / profile setup tous incompatibles tvOS), pas
    // d'OnboardingScreen avec entrée e-mail/clavier (clavier Siri
    // Remote pénible). On affiche TVLoginScreen tant que pas loggué,
    // puis MainApp dès qu'on a un supaUser. Le bouton Menu de la Siri
    // Remote ferme la séance en cours (déjà géré par les Modals).
    if (IS_TV) {
      if (!supaUser) {
        return <TVLoginScreen lang={lang} />;
      }
      return <MainApp prenom={prenom} lang={lang} tensionIdxs={tensionIdxs} supabase={supabase} supaUser={supaUser} onTensionChange={handleTensionChange} onProfileSave={handleProfileSetupSave} />;
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
      return <ProfileOnboardingScreen
        lang={lang}
        supaUser={supaUser}
        onDone={handleProfileSetupSave}
      />;
    }
    if (welcomeShown === false) {
      return <WelcomeIntroScreen lang={lang} onDone={function(idxs) {
        if (Array.isArray(idxs) && idxs.length > 0) handleTensionChange(idxs);
        dismissWelcomeIntro();
      }} />;
    }
    // HealthKit = iOS uniquement. Sur Android on saute cet écran d'onboarding
    // (Apple Santé n'existe pas ; l'équivalent Health Connect viendra plus tard).
    if (hkPromptShown === false && Platform.OS === 'ios') {
      return <HealthKitConnectScreen lang={lang} onDone={function() { dismissHkPrompt(); }} />;
    }
    return <MainApp prenom={prenom} lang={lang} tensionIdxs={tensionIdxs} supabase={supabase} supaUser={supaUser} onTensionChange={handleTensionChange} onAccountDeleted={handleAccountDeleted} onProfileSave={handleProfileSetupSave} />;
  }

  return (
    <View style={{ flex: 1 }}>
      {!loading && renderActiveScreen()}
      {splashOverlayMounted && (
        <Animated.View
          pointerEvents={loading ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000e18',
            opacity: splashOverlayOpacity,
            transform: [{ translateX: splashOverlayTx }],
          }}
        >
          <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
          {/* Aquatic bubbles — keep the splash alive while the app boots. */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {BULLES_ONBOARDING.map(function(b, i) { return <Bulle key={'sp-' + i} {...b} />; })}
          </View>
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
        </Animated.View>
      )}
    </View>
  );
}

function AppWithBoundary() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary onError={(error, info) => sentryCapture(error, { componentStack: info?.componentStack, source: 'ErrorBoundary' })}>
        <ThemeProvider>
          <ThemedStatusBar />
          <App />
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default (Sentry && SENTRY_DSN && typeof Sentry.wrap === 'function')
  ? Sentry.wrap(AppWithBoundary)
  : AppWithBoundary;

