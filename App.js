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
import { Linking as RNLinking } from 'react-native';

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
      if (err) console.log('HealthKit workout save error:', err);
      else console.log('HealthKit workout saved:', durationMinutes + 'min, ' + calories + 'cal');
    }
  });
}

function getHealthKitSummary(cb) {
  if (!AppleHealthKit || !hkInitialized || Platform.OS !== 'ios') { cb({ cal: 0, exMin: 0, standHr: 0 }); return; }
  var now = new Date();
  var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  var opts = { startDate: startOfDay, endDate: now.toISOString() };
  var result = { cal: 0, exMin: 0, standHr: 0 };
  var remaining = 3;
  function done() { remaining--; if (remaining <= 0) cb(result); }
  try {
    AppleHealthKit.getActiveEnergyBurned(opts, function(err, res) { if (!err && res && res.length) { result.cal = Math.round(res.reduce(function(s, r) { return s + (r.value || 0); }, 0)); } done(); });
  } catch(e) { done(); }
  try {
    AppleHealthKit.getAppleExerciseTime(opts, function(err, res) { if (!err && res && res.length) { result.exMin = Math.round(res.reduce(function(s, r) { return s + (r.value || 0); }, 0)); } done(); });
  } catch(e) { done(); }
  try {
    AppleHealthKit.getAppleStandTime(opts, function(err, res) { if (!err && res && res.length) { result.standHr = Math.round(res.reduce(function(s, r) { return s + (r.value || 0); }, 0) / 60); } done(); });
  } catch(e) { done(); }
}

/** Pictogrammes restants (autres que 🔥🔒✓▶) — chaînes UTF-8. */
const U_JELLY = '\uD83E\uDEBC';
const U_WAVE = '\uD83C\uDF0A';
const U_STAR = '\u2B50';
const U_SEED = '\uD83C\uDF31';
const U_DROP = '\uD83D\uDCA7';

/** Valeur numérique du streak pour l'affichage à côté de {'🔥'} dans le JSX. */
function streakCountValue(streak) {
  const n = Number(streak);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
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

function devWarn(...args) {
  if (__DEV__) console.warn('[FluidBody]', ...args);
}

function hapticLight() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  try { void HapticsMod.impactAsync(HapticsMod.ImpactFeedbackStyle.Light); } catch (e) {}
}
function hapticSuccess() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  try { void HapticsMod.notificationAsync(HapticsMod.NotificationFeedbackType.Success); } catch (e) {}
}

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

function TabIconTimer({ color, size }) {
  var c = tabBarIconTint(color);
  var s = size ?? 22;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="13" r="8" stroke={c} strokeWidth={1.6} />
        <Path d="M12 5V7" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M9.5 3h5" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M12 13V9.5" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M12 13L14.5 15" stroke={c} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const Tab = createBottomTabNavigator();
const { width: SW, height: SH } = Dimensions.get('window');
const IS_IPAD = SW >= 768;
const SCALE = IS_IPAD ? SW / 390 : 1; // Scale factor relative to iPhone 390px
const VIDEO_DEMO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

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

/** Indices 0 et 1 gratuits ; le reste verrouillé si pas d'abonnement simulé (AsyncStorage `fluid_sub`). */
const FREE_SEANCE_INDEX = 0;

const PRODUCT_IDS = {
  monthly: 'com.fluidbody.app.premium.monthly',
  yearly: 'com.fluidbody.app.premium.yearly',
};
const ALL_PRODUCT_IDS = Object.values(PRODUCT_IDS);
const RC_ENTITLEMENT_ID = 'Fluidbody Pilates Pro';
const RC_API_KEY_IOS = 'appl_hqCGakwrJAfotXKNQtMBAgLnqcX';

const VIDEO_RESUME_PREFIX = 'fluid_video_resume_v1_';
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

async function getResumeIndicesForPilier(pilierKey) {
  const indices = new Set();
  try {
    const keys = await AsyncStorage.getAllKeys();
    const prefix = `${VIDEO_RESUME_PREFIX}${pilierKey}_`;
    for (const k of keys) {
      if (!k.startsWith(prefix)) continue;
      const idx = parseInt(k.slice(prefix.length), 10);
      if (!Number.isNaN(idx)) indices.add(idx);
    }
  } catch (e) {}
  return indices;
}

function canAccessSeanceIndex(idx, isSubscriber) {
  return idx < FREE_SEANCE_INDEX || isSubscriber;
}


// ══════════════════════════════════
// MAPPING TENSIONS → PILIERS
// Index des zones dans ob_zones : 0=Dos/Nuque, 1=Épaules, 2=Hanches, 3=Posture, 4=Respiration, 5=Stress
// ══════════════════════════════════
const ZONE_TO_PILIER = { 0: 'p2', 1: 'p1', 2: 'p3', 3: 'p4', 4: 'p5', 5: 'p6', 6: 'p8' };

// ── SÉANCE DU JOUR ──────────────────────────────────────────
// Choisit une séance non faite selon le jour + profil utilisateur
function getSeanceDuJour(done, tensionIdxs, lang) {
  const piliers = getPiliers(lang);
  const seances = getSeances(lang);
  const allSeances = [];
  piliers.forEach(function(p) {
    var ps = seances[p.key] || [];
    ps.forEach(function(s, i) {
      allSeances.push({ seance: s, idx: i, key: p.key, pilier: p });
    });
  });
  if (allSeances.length === 0) return null;
  // Séance gratuite fixe : Mobilité — Comprendre la hanche (p3, index 0)
  var pick = allSeances.find(function(s) { return s.key === 'p3' && s.idx === 0; });
  return pick || allSeances[0];
}


// ══════════════════════════════════
// TRADUCTIONS
// ══════════════════════════════════
const T = {
  fr: {
    lang: 'fr', flag: '🇫🇷', nom: 'Français',
    tabs: ['FluidBody+', 'Résumé', 'Biblio', 'Timer', 'Profil'],
    resume_title: 'Résumé', resume_activite: 'Activité', resume_bouger: 'Bouger', resume_exercice: 'Exercice', resume_debout: 'Debout', resume_seances: 'Séances FluidBody', resume_no_seance: 'Aucune séance complétée', resume_progression: 'Progression', resume_global: 'Global', resume_streak: 'Streak',
    bonjour: (p) => p ? `Bonjour ${p}` : '',
    bonjour_mot: 'Bonjour',
    ob_tag: 'Une nouvelle façon d\'habiter son corps',
    ob_l1: 'Les autres apps te montrent ',
    ob_l1b: 'quoi faire.',
    ob_l2: 'FluidBody te montre ',
    ob_l2b: 'comment te préparer.',
    ob_sub: 'Parce qu\'un corps qui se comprend peut vraiment changer.',
    ob_cta: 'Commencer →',
    ob_compte: 'J\'ai déjà un compte',
    ob_bilan: 'Bilan corporel',
    ob_tensions: 'Où ressens-tu\ndes tensions ?',
    ob_select: 'Sélectionne une ou plusieurs zones',
    ob_zones: ['Dos / Nuque', 'Épaules', 'Hanches', 'Posture', 'Respiration', 'Stress', 'Bureau / Sédentaire'],
    ob_continuer: 'Continuer →',
    ob_explorer: 'Je veux tout explorer',
    ob_rythme_tag: 'Ton rythme',
    ob_rythme: 'Combien de temps\nas-tu chaque jour ?',
    ob_temps: ['5–10 min', '15–20 min', '30 min', '45 min +'],
    ob_varie: 'Ça varie',
    ob_prenom_tag: 'Dernière étape',
    ob_prenom: 'Comment\nt\'appelles-tu ?',
    ob_prenom_sub: 'Ton programme s\'adapte à ton profil.\nFluidBody t\'accompagne au quotidien.',
    ob_placeholder: 'Ton prénom...',
    ob_demarrer: 'Démarrer →',
    ob_anon: 'Entrer anonymement',
    ob_auth_tag: 'Compte FluidBody',
    ob_auth_title: 'Sauvegarde du profil',
    ob_auth_signup_title: 'Inscription',
    ob_auth_signin_title: 'Connexion',
    ob_auth_sub: 'Email et mot de passe pour synchroniser ta progression dans le cloud.',
    ob_auth_sub_signin: 'Entre tes identifiants pour retrouver ta progression.',
    ob_email_ph: 'ton@email.com',
    ob_pass_ph: 'Mot de passe (6 car. min.)',
    ob_auth_submit_up: 'Créer mon compte',
    ob_auth_submit_in: 'Me connecter',
    ob_auth_toggle_in: 'J\'ai déjà un compte →',
    ob_auth_toggle_up: 'Pas de compte ? S\'inscrire',
    ob_auth_skip: 'Continuer sans compte nuage →',
    ob_auth_err_short: 'Mot de passe : au moins 6 caractères.',
    ob_auth_err_email: 'Entre une adresse email valide.',
    ob_auth_confirm: 'Si une confirmation est demandée, vérifie ta boîte mail puis reconnecte-toi.',
    ob_auth_err_net: 'Erreur réseau.',
    ob_auth_no_cloud: 'Sauvegarde cloud indisponible sur cet environnement. Tes identifiants ne seront pas enregistrés sur un serveur.',
    ob_auth_continue_local: 'Continuer en local →',
    piliers: ['Épaules', 'Dos', 'Mobilité', 'Posture', 'Eldoa', 'Golf', 'Mat Pilates', 'Office'],
    etapes: { Comprendre: 'Comprendre', Ressentir: 'Ressentir', Préparer: 'Préparer', Exécuter: 'Exécuter', Évoluer: 'Évoluer' },
    retour: '← Mon Corps',
    seances_done: (n) => `${n} / 20 séances complétées`,
    m_seances: 'Séances', m_streak: 'Streak', m_progress: 'Progression',
    retour_video: '← Retour',
    video_resume: (t) => `Reprise · ${t}`,
    reprise_badge: 'Reprise',
    video_load_error: `La vidéo n'a pas pu être chargée.`,
    video_retry: 'Réessayer',
    seance_done: '✓  Séance terminée',
    biblio_titre: 'Bibliothèque',
    biblio_sub: 'Comprendre pour mieux ressentir',
    tab_piliers: 'Les 6 piliers',
    tab_methode: 'La méthode',
    tab_pour_vous: 'Pour vous',
    tab_explorer: 'Explorer',
    tab_programmes: 'Programmes',
    tab_recherche: '\uD83D\uDD0D',
    explore_free_title: 'Sélection gratuite du mois',
    explore_free_sub: 'Essayez cette séance une fois, sans abonnement requis',
    explore_new: 'Nouvelles sélections pour vous',
    prog_section_title: 'Vos programmes sur mesure',
    prog_section_sub: 'Programmes prédéfinis pour continuer sur votre lancée ou intensifier votre routine.',
    prog_debuter: 'Débuter',
    prog_debuter_sub: 'Épaules, Dos et Mobilité',
    prog_debuter_duree: '3 JOURS · 10 MIN/JOUR',
    prog_apercu: 'Aperçu du programme',
    prog_custom_title: 'Créez votre propre programme',
    prog_custom_sub: 'Choisissez les activités et définissez votre programme.',
    prog_custom_card: 'Programme personnalisé',
    prog_custom_card_sub: 'Vos activités, la durée de vos exercices, vos jours et votre rythme.',
    prog_custom_btn: 'Créer un programme',
    prog_create_title: 'Créer un programme',
    prog_select_piliers: 'Sélectionne tes piliers',
    prog_duree_label: 'Durée par séance',
    prog_jours_label: 'Jours par semaine',
    prog_save: 'Enregistrer',
    prog_saved: 'Programme enregistré !',
    prog_mes_programmes: 'Mes programmes',
    prog_notif_days: 'Jours de rappel', prog_notif_hour: 'Heure de rappel', prog_notif_body: "C'est l'heure de ta séance",
    partage_title: 'Partage', partage_progression: 'Partager ma progression', partage_btn: 'Partager', partage_share_msg: 'Ma progression FluidBody+ Pilates', partage_inviter: 'Inviter des amis', partage_invite_btn: 'Inviter par SMS / Email', partage_invite_msg: 'Rejoins-moi sur FluidBody+ Pilates !', partage_en_attente: 'En attente', partage_invitation: 'Invitation', partage_defis: 'Défis', partage_creer_defi: 'Créer un défi', partage_choisir_pilier: 'Choisis un pilier', partage_duree_defi: 'Durée', partage_lancer: 'Lancer',
    profil_donnees_title: 'Confidentialité', profil_donnees_desc: 'Découvrez comment sont gérées vos données. Vos données restent sur votre appareil. Aucune donnée personnelle n\'est envoyée à des serveurs tiers. Les séances, la progression et les préférences sont stockées localement. Si vous vous connectez, seul votre email est synchronisé pour sauvegarder votre profil.', profil_donnees_local: 'Données stockées localement sur votre appareil', profil_donnees_no_tracking: 'Aucun tracking publicitaire', profil_donnees_healthkit: 'HealthKit : données lues uniquement, jamais partagées',
    biblio_intro: 'La méthode FluidBody repose sur 5 étapes progressives. Chaque séance les traverse dans l\'ordre.',
    lire: ' de lecture',
    retour_biblio: '← Bibliothèque',
    points_cles: 'Points clés',
    mon_parcours: 'Mon Parcours',
    prog_globale: 'Progression globale',
    par_pilier: 'Par pilier',
    parcours_langue: 'Langue',
    mon_compte: 'Mon compte',
    compte_info: [['Application', 'FluidBody · Pilates'], ['Version', 'FluidBody Beta 1.0'], ['Méthode', 'Pilates Conscient · 30 ans']],
    progresser_sub: (p) => `${p}% du parcours complété`,
    recommande_pour_toi: 'POUR TOI',
    seance_gratuite: 'Séance gratuite',
    seance_du_jour_sub: "Recommandée pour toi aujourd'hui",
    commencer_seance: 'Commencer →',
    deja_faite: "✓ Déjà faite aujourd'hui",
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: "Ta séance démo t'attend. Ton corps a besoin de toi.",
    notif_pause_title: 'Pause Active 🪑', notif_pause_body: "C'est le moment de bouger ! 5 min d'étirements au bureau.",
    coach_title: 'Votre Coach', coach_name: 'Sabrina', coach_subtitle: 'Experte Pilates · 30 ans d\'expérience', coach_bio: 'Passionnée par le mouvement conscient, je vous guide vers un corps plus libre et plus fort.', coach_more: 'En savoir plus', coach_avec: 'Avec Sabrina', coach_exp: '30 ans d\'expérience', coach_quote: '"Je vous accompagne pas à pas vers un corps plus libre."',
    first_seance_title: 'Bravo !', first_seance_sub: 'Première séance terminée !\nCrée un compte gratuit pour sauvegarder ta progression et ne jamais la perdre.', first_seance_create: 'Créer mon compte', first_seance_later: 'Plus tard',
    save_progress_title: 'Sauvegarde ta progression', save_progress_sub: 'Crée un compte gratuit pour ne rien perdre',
    meduse_card_title: 'Ta méduse',
    calendar_title: 'Activité récente', recommended_next: 'Recommandée pour toi', weekly_goal: 'Objectif semaine', weekly_done: 'Objectif atteint ! 🎉', weekly_remaining: 'séance(s) restante(s)',
    body_map_title: 'Bilan corporel', streak_protect_title: 'Protège ton streak !', streak_protect_sub: 'Fais une micro-séance de 2 min pour ne pas perdre tes jours',
    pause_bureau_tag: 'Pause active', pause_bureau_title: '5 min au bureau', pause_bureau_sub: 'Étire-toi sans quitter ta chaise',
    meduse_name_btn: 'Donne-lui un nom', meduse_name_ph: 'Nom de ta méduse', meduse_rename: 'Renommer',
    auth_apple: 'Continuer avec Apple', auth_google: 'Continuer avec Google', auth_or: 'ou', auth_social_soon: 'Disponible dans la version App Store.',
    demo_limit: "Abonne-toi pour voir la suite",
    motivation: (streak) => streak === 0 ? '"Commence aujourd\'hui.\nTon corps t\'attend."' :
      streak < 3  ? `"${streak} jour${streak > 1 ? 's' : ''} de suite. Continue."` :
      streak < 7  ? `"${streak} jours consécutifs !\nTon corps s\'éveille."` :
      streak < 14 ? `"${streak} jours ! Une vraie habitude\nse construit."` :
      `"${streak} jours. Tu es remarquable. ${U_WAVE}"`,
    celebration: 'Ton corps a progressé.\nContinue comme ça \uD83D\uDCAA',
    biblio_signature: '— FluidBody',
    premium_alert_title: 'Contenu Premium',
    premium_alert_simulate: 'Voir les offres',
    premium_alert_later: 'Plus tard',
    paywall_title: 'Du Pilates pour tout le monde',
    paywall_sub: 'Accès illimité à 160 séances guidées par Sabrina, experte Pilates depuis 30 ans',
    paywall_badge: '7 JOURS GRATUITS',
    paywall_yearly_link: '99 CHF/an · Économisez 35%',
    paywall_monthly: 'Mensuel',
    paywall_yearly: 'Annuel',
    paywall_buy_monthly: 'Acheter mensuel',
    paywall_buy_yearly: 'Acheter annuel',
    paywall_restore: 'Restaurer mes achats',
    paywall_close: 'Fermer',
    paywall_prices_loading: 'Chargement des prix…',
    paywall_not_available: 'Achats indisponibles (Expo Go / simulateur).',
    paywall_start: 'Commencer — 7 jours gratuits',
    paywall_per_month: '/mois',
    paywall_price_detail: 'Puis 12.90 CHF/mois · Annulez quand vous voulez',
    paywall_access: 'Accès immédiat à tous les piliers · Sans engagement',
    paywall_try_free: 'Essayer avec la séance gratuite',
    free_try_once: 'Essayez une fois cet épisode gratuitement',
    free_go: "C'est parti !",
    subscription_status_label: 'Abonnement FluidBody+',
    subscription_status_active: 'Actif — toutes les séances',
    subscription_status_free: 'Inactif',
    subscription_reset: 'Restaurer mes achats',
  },
  en: {
    lang: 'en', flag: '🇬🇧', nom: 'English',
    tabs: ['FluidBody+', 'Summary', 'Library', 'Timer', 'Profile'],
    resume_title: 'Summary', resume_activite: 'Activity', resume_bouger: 'Move', resume_exercice: 'Exercise', resume_debout: 'Stand', resume_seances: 'FluidBody Sessions', resume_no_seance: 'No sessions completed', resume_progression: 'Progress', resume_global: 'Overall', resume_streak: 'Streak',
    bonjour: (p) => p ? `Hello ${p}` : '',
    bonjour_mot: 'Hello',
    ob_tag: 'A new way to inhabit your body',
    ob_l1: 'Other apps show you ',
    ob_l1b: 'what to do.',
    ob_l2: 'FluidBody shows you ',
    ob_l2b: 'how to prepare.',
    ob_sub: 'Because a body that understands itself can truly change.',
    ob_cta: 'Get Started →',
    ob_compte: 'I already have an account',
    ob_bilan: 'Body assessment',
    ob_tensions: 'Where do you feel\ntension?',
    ob_select: 'Select one or more areas',
    ob_zones: ['Back / Neck', 'Shoulders', 'Hips', 'Posture', 'Breathing', 'Stress', 'Office / Sedentary'],
    ob_continuer: 'Continue →',
    ob_explorer: 'I want to explore everything',
    ob_rythme_tag: 'Your rhythm',
    ob_rythme: 'How much time do you\nhave each day?',
    ob_temps: ['5–10 min', '15–20 min', '30 min', '45 min +'],
    ob_varie: 'It varies',
    ob_prenom_tag: 'Last step',
    ob_prenom: 'What\'s\nyour name?',
    ob_prenom_sub: 'Your program adapts to your profile.\nFluidBody supports you every day.',
    ob_placeholder: 'Your first name...',
    ob_demarrer: 'Get started →',
    ob_anon: 'Enter anonymously',
    ob_auth_tag: 'FluidBody account',
    ob_auth_title: 'Save your profile',
    ob_auth_signup_title: 'Sign up',
    ob_auth_signin_title: 'Sign in',
    ob_auth_sub: 'Use email and password to sync your progress in the cloud.',
    ob_auth_sub_signin: 'Enter your credentials to restore your progress.',
    ob_email_ph: 'you@email.com',
    ob_pass_ph: 'Password (min. 6 characters)',
    ob_auth_submit_up: 'Create account',
    ob_auth_submit_in: 'Sign in',
    ob_auth_toggle_in: 'I already have an account →',
    ob_auth_toggle_up: 'No account? Sign up',
    ob_auth_skip: 'Continue without cloud account →',
    ob_auth_err_short: 'Password must be at least 6 characters.',
    ob_auth_err_email: 'Enter a valid email address.',
    ob_auth_confirm: 'If email confirmation is required, check your inbox then sign in.',
    ob_auth_err_net: 'Network error.',
    ob_auth_no_cloud: `Cloud backup isn't available in this build. Your credentials won't be saved to a server.`,
    ob_auth_continue_local: 'Continue locally →',
    piliers: ['Shoulders', 'Back', 'Mobility', 'Posture', 'Eldoa', 'Golf', 'Mat Pilates', 'Office'],
    etapes: { Comprendre: 'Understand', Ressentir: 'Feel', Préparer: 'Prepare', Exécuter: 'Execute', Évoluer: 'Evolve' },
    retour: '← My Body',
    seances_done: (n) => `${n} / 20 sessions completed`,
    m_seances: 'Sessions', m_streak: 'Streak', m_progress: 'Progress',
    retour_video: '← Back',
    video_resume: (t) => `Resumed · ${t}`,
    reprise_badge: 'Resume',
    video_load_error: `Couldn't load the video.`,
    video_retry: 'Try again',
    seance_done: '✓  Session complete',
    biblio_titre: 'Library',
    biblio_sub: 'Understand to feel better',
    tab_piliers: 'The 6 pillars',
    tab_methode: 'The method',
    tab_pour_vous: 'For You',
    tab_explorer: 'Explore',
    tab_programmes: 'Programs',
    tab_recherche: '\uD83D\uDD0D',
    explore_free_title: 'Free pick of the month',
    explore_free_sub: 'Try this session once, no subscription required',
    explore_new: 'New picks for you',
    prog_section_title: 'Your tailored programs',
    prog_section_sub: 'Pre-built programs to keep your momentum or intensify your routine.',
    prog_debuter: 'Get started',
    prog_debuter_sub: 'Shoulders, Back and Mobility',
    prog_debuter_duree: '3 DAYS · 10 MIN/DAY',
    prog_apercu: 'Program overview',
    prog_custom_title: 'Create your own program',
    prog_custom_sub: 'Choose activities and define your program.',
    prog_custom_card: 'Custom program',
    prog_custom_card_sub: 'Your activities, exercise duration, your days and your pace.',
    prog_custom_btn: 'Create a program',
    prog_create_title: 'Create a program',
    prog_select_piliers: 'Select your pillars',
    prog_duree_label: 'Duration per session',
    prog_jours_label: 'Days per week',
    prog_save: 'Save',
    prog_saved: 'Program saved!',
    prog_mes_programmes: 'My programs',
    prog_notif_days: 'Reminder days', prog_notif_hour: 'Reminder time', prog_notif_body: 'Time for your session',
    partage_title: 'Share', partage_progression: 'Share my progress', partage_btn: 'Share', partage_share_msg: 'My FluidBody+ Pilates progress', partage_inviter: 'Invite friends', partage_invite_btn: 'Invite via SMS / Email', partage_invite_msg: 'Join me on FluidBody+ Pilates!', partage_en_attente: 'Pending', partage_invitation: 'Invitation', partage_defis: 'Challenges', partage_creer_defi: 'Create a challenge', partage_choisir_pilier: 'Choose a pillar', partage_duree_defi: 'Duration', partage_lancer: 'Start',
    profil_donnees_title: 'Privacy', profil_donnees_desc: 'Learn how your data is managed. Your data stays on your device. No personal data is sent to third-party servers. Sessions, progress and preferences are stored locally. If you sign in, only your email is synced to save your profile.', profil_donnees_local: 'Data stored locally on your device', profil_donnees_no_tracking: 'No advertising tracking', profil_donnees_healthkit: 'HealthKit: data read only, never shared',
    biblio_intro: 'The FluidBody method is built on 5 progressive steps. Each session follows them in order.',
    lire: ' read',
    retour_biblio: '← Library',
    points_cles: 'Key points',
    mon_parcours: 'My Journey',
    prog_globale: 'Overall progress',
    par_pilier: 'By pillar',
    parcours_langue: 'Language',
    mon_compte: 'My account',
    compte_info: [['App', 'FluidBody · Pilates'], ['Version', 'FluidBody Beta 1.0'], ['Method', 'Conscious Pilates · 30 years']],
    progresser_sub: (p) => `${p}% of journey completed`,
    recommande_pour_toi: 'FOR YOU',
    seance_gratuite: 'Free session',
    seance_du_jour_sub: 'Recommended for you today',
    commencer_seance: 'Start →',
    deja_faite: '✓ Already done today',
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: 'Your demo session is waiting. Your body needs you.',
    notif_pause_title: 'Active Break 🪑', notif_pause_body: 'Time to move! 5 min desk stretches.',
    coach_title: 'Your Coach', coach_name: 'Sabrina', coach_subtitle: 'Pilates Expert · 30 years experience', coach_bio: 'Passionate about conscious movement, I guide you towards a freer, stronger body.', coach_more: 'Learn more', coach_avec: 'With Sabrina', coach_exp: '30 years experience', coach_quote: '"I guide you step by step towards a freer body."',
    first_seance_title: 'Well done!', first_seance_sub: 'First session complete!\nCreate a free account to save your progress.', first_seance_create: 'Create my account', first_seance_later: 'Later',
    save_progress_title: 'Save your progress', save_progress_sub: 'Create a free account to keep everything',
    meduse_card_title: 'Your jellyfish',
    calendar_title: 'Recent activity', recommended_next: 'Recommended for you', weekly_goal: 'Weekly goal', weekly_done: 'Goal reached! 🎉', weekly_remaining: 'session(s) remaining',
    body_map_title: 'Body assessment', streak_protect_title: 'Protect your streak!', streak_protect_sub: 'Do a 2-min micro-session to keep your days',
    pause_bureau_tag: 'Active break', pause_bureau_title: '5 min at your desk', pause_bureau_sub: 'Stretch without leaving your chair',
    meduse_name_btn: 'Give it a name', meduse_name_ph: 'Your jellyfish name', meduse_rename: 'Rename',
    auth_apple: 'Continue with Apple', auth_google: 'Continue with Google', auth_or: 'or', auth_social_soon: 'Available in the App Store version.',
    demo_limit: 'Subscribe to see the rest',
    motivation: (streak) => streak === 0 ? '"Start today.\nYour body is waiting."' :
      streak < 3  ? `"${streak} day${streak > 1 ? 's' : ''} in a row. Keep going."` :
      streak < 7  ? `"${streak} days in a row!\nYour body is awakening."` :
      streak < 14 ? `"${streak} days! A real habit\nis forming."` :
      `"${streak} days. You are remarkable. ${U_WAVE}"`,
    celebration: 'Your body has progressed.\nKeep it up \uD83D\uDCAA',
    biblio_signature: '— FluidBody',
    premium_alert_title: 'Premium content',
    premium_alert_simulate: 'See offers',
    premium_alert_later: 'Later',
    paywall_title: 'Pilates for everyone',
    paywall_sub: 'Unlimited access to 160 sessions guided by Sabrina, Pilates expert for 30 years',
    paywall_badge: '7 DAYS FREE',
    paywall_yearly_link: '99 CHF/year · Save 35%',
    paywall_monthly: 'Monthly',
    paywall_yearly: 'Yearly',
    paywall_buy_monthly: 'Buy monthly',
    paywall_buy_yearly: 'Buy yearly',
    paywall_restore: 'Restore purchases',
    paywall_close: 'Close',
    paywall_prices_loading: 'Loading prices…',
    paywall_not_available: 'Purchases unavailable (Expo Go / simulator).',
    paywall_start: 'Start — 7 days free',
    paywall_per_month: '/month',
    paywall_price_detail: 'Then 12.90 CHF/month · Cancel anytime',
    paywall_access: 'Instant access to all pillars · No commitment',
    paywall_try_free: 'Try the free session',
    free_try_once: 'Try this episode once for free',
    free_go: "Let's go!",
    subscription_status_label: 'FluidBody+ Subscription',
    subscription_status_active: 'Active — all sessions',
    subscription_status_free: 'Inactive',
    subscription_reset: 'Restore purchases',
  },
  es: {
    lang: 'es', flag: '🇪🇸', nom: 'Español',
    tabs: ['FluidBody+', 'Resumen', 'Biblioteca', 'Timer', 'Perfil'],
    resume_title: 'Resumen', resume_activite: 'Actividad', resume_bouger: 'Movimiento', resume_exercice: 'Ejercicio', resume_debout: 'De pie', resume_seances: 'Sesiones FluidBody', resume_no_seance: 'Ninguna sesión completada', resume_progression: 'Progresión', resume_global: 'Global', resume_streak: 'Racha',
    bonjour: (p) => p ? `Hola ${p}` : '',
    bonjour_mot: 'Hola',
    ob_tag: 'Una nueva forma de habitar tu cuerpo',
    ob_l1: 'Otras apps te muestran ',
    ob_l1b: 'qué hacer.',
    ob_l2: 'FluidBody te muestra ',
    ob_l2b: 'cómo prepararte.',
    ob_sub: 'Porque un cuerpo que se entiende puede realmente cambiar.',
    ob_cta: 'Comenzar →',
    ob_compte: 'Ya tengo una cuenta',
    ob_bilan: 'Evaluación corporal',
    ob_tensions: '¿Dónde sientes\ntensión?',
    ob_select: 'Selecciona una o varias zonas',
    ob_zones: ['Espalda / Cuello', 'Hombros', 'Caderas', 'Postura', 'Respiración', 'Estrés', 'Oficina / Sedentario'],
    ob_continuer: 'Continuar →',
    ob_explorer: 'Quiero explorarlo todo',
    ob_rythme_tag: 'Tu ritmo',
    ob_rythme: '¿Cuánto tiempo tienes\ncada día?',
    ob_temps: ['5–10 min', '15–20 min', '30 min', '45 min +'],
    ob_varie: 'Varía',
    ob_prenom_tag: 'Último paso',
    ob_prenom: '¿Cómo\nte llamas?',
    ob_prenom_sub: 'Tu programa se adapta a tu perfil.\nFluidBody te acompaña cada día.',
    ob_placeholder: 'Tu nombre...',
    ob_demarrer: 'Empezar →',
    ob_anon: 'Entrar anónimamente',
    ob_auth_tag: 'Cuenta FluidBody',
    ob_auth_title: 'Guardar tu perfil',
    ob_auth_signup_title: 'Registro',
    ob_auth_signin_title: 'Entrar',
    ob_auth_sub: 'Email y contraseña para sincronizar tu progreso en la nube.',
    ob_auth_sub_signin: 'Introduce tus datos para recuperar tu progreso.',
    ob_email_ph: 'tu@email.com',
    ob_pass_ph: 'Contraseña (mín. 6 caracteres)',
    ob_auth_submit_up: 'Crear cuenta',
    ob_auth_submit_in: 'Iniciar sesión',
    ob_auth_toggle_in: 'Ya tengo cuenta →',
    ob_auth_toggle_up: '¿Sin cuenta? Registrarse',
    ob_auth_skip: 'Continuar sin cuenta en la nube →',
    ob_auth_err_short: 'La contraseña debe tener al menos 6 caracteres.',
    ob_auth_err_email: 'Introduce un email válido.',
    ob_auth_confirm: 'Si pide confirmación, revisa tu correo y vuelve a entrar.',
    ob_auth_err_net: 'Error de red.',
    ob_auth_no_cloud: 'La copia en la nube no está disponible en este entorno. Tus datos no se guardarán en un servidor.',
    ob_auth_continue_local: 'Continuar en local →',
    piliers: ['Hombros', 'Espalda', 'Movilidad', 'Postura', 'Eldoa', 'Golf', 'Mat Pilates', 'Oficina'],
    etapes: { Comprendre: 'Comprender', Ressentir: 'Sentir', Préparer: 'Preparar', Exécuter: 'Ejecutar', Évoluer: 'Evolucionar' },
    retour: '← Mi Cuerpo',
    seances_done: (n) => `${n} / 20 sesiones completadas`,
    m_seances: 'Sesiones', m_streak: 'Racha', m_progress: 'Progreso',
    retour_video: '← Volver',
    video_resume: (t) => `Continuación · ${t}`,
    reprise_badge: 'Continuar',
    video_load_error: 'No se pudo cargar el vídeo.',
    video_retry: 'Reintentar',
    seance_done: '✓  Sesión terminada',
    biblio_titre: 'Biblioteca',
    biblio_sub: 'Comprender para sentir mejor',
    tab_piliers: 'Los 6 pilares',
    tab_methode: 'El método',
    tab_pour_vous: 'Para ti',
    tab_explorer: 'Explorar',
    tab_programmes: 'Programas',
    tab_recherche: '\uD83D\uDD0D',
    explore_free_title: 'Selección gratuita del mes',
    explore_free_sub: 'Prueba esta sesión una vez, sin suscripción',
    explore_new: 'Nuevas selecciones para ti',
    prog_section_title: 'Tus programas a medida',
    prog_section_sub: 'Programas predefinidos para mantener tu ritmo o intensificar tu rutina.',
    prog_debuter: 'Empezar',
    prog_debuter_sub: 'Hombros, Espalda y Movilidad',
    prog_debuter_duree: '3 DÍAS · 10 MIN/DÍA',
    prog_apercu: 'Vista del programa',
    prog_custom_title: 'Crea tu propio programa',
    prog_custom_sub: 'Elige las actividades y define tu programa.',
    prog_custom_card: 'Programa personalizado',
    prog_custom_card_sub: 'Tus actividades, la duración, tus días y tu ritmo.',
    prog_custom_btn: 'Crear un programa',
    prog_create_title: 'Crear un programa',
    prog_select_piliers: 'Selecciona tus pilares',
    prog_duree_label: 'Duración por sesión',
    prog_jours_label: 'Días por semana',
    prog_save: 'Guardar',
    prog_saved: '¡Programa guardado!',
    prog_mes_programmes: 'Mis programas',
    prog_notif_days: 'Días de recordatorio', prog_notif_hour: 'Hora de recordatorio', prog_notif_body: 'Es hora de tu sesión',
    partage_title: 'Compartir', partage_progression: 'Compartir mi progreso', partage_btn: 'Compartir', partage_share_msg: 'Mi progreso en FluidBody+ Pilates', partage_inviter: 'Invitar amigos', partage_invite_btn: 'Invitar por SMS / Email', partage_invite_msg: '¡Únete a FluidBody+ Pilates!', partage_en_attente: 'Pendiente', partage_invitation: 'Invitación', partage_defis: 'Desafíos', partage_creer_defi: 'Crear un desafío', partage_choisir_pilier: 'Elige un pilar', partage_duree_defi: 'Duración', partage_lancer: 'Iniciar',
    profil_donnees_title: 'Privacidad', profil_donnees_desc: 'Descubre cómo se gestionan tus datos. Tus datos permanecen en tu dispositivo. Ningún dato personal se envía a servidores de terceros. Las sesiones, el progreso y las preferencias se almacenan localmente. Si inicias sesión, solo tu email se sincroniza para guardar tu perfil.', profil_donnees_local: 'Datos almacenados localmente en tu dispositivo', profil_donnees_no_tracking: 'Sin seguimiento publicitario', profil_donnees_healthkit: 'HealthKit: datos solo de lectura, nunca compartidos',
    biblio_intro: 'El método FluidBody se basa en 5 pasos progresivos. Cada sesión los recorre en orden.',
    lire: ' de lectura',
    retour_biblio: '← Biblioteca',
    points_cles: 'Puntos clave',
    mon_parcours: 'Mi Recorrido',
    prog_globale: 'Progreso global',
    par_pilier: 'Por pilar',
    parcours_langue: 'Idioma',
    mon_compte: 'Mi cuenta',
    compte_info: [['Aplicación', 'FluidBody · Pilates'], ['Versión', 'FluidBody Beta 1.0'], ['Método', 'Pilates Consciente · 30 años']],
    progresser_sub: (p) => `${p}% del recorrido completado`,
    recommande_pour_toi: 'PARA TI',
    seance_gratuite: 'Sesión gratuita',
    seance_du_jour_sub: 'Recomendada para ti hoy',
    commencer_seance: 'Empezar →',
    deja_faite: '✓ Ya hecha hoy',
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: 'Tu sesión demo te espera. Tu cuerpo te necesita.',
    notif_pause_title: 'Pausa Activa 🪑', notif_pause_body: '¡Es hora de moverse! 5 min de estiramientos.',
    coach_title: 'Tu Coach', coach_name: 'Sabrina', coach_subtitle: 'Experta Pilates · 30 años de experiencia', coach_bio: 'Apasionada por el movimiento consciente, te guío hacia un cuerpo más libre y más fuerte.', coach_more: 'Saber más', coach_avec: 'Con Sabrina', coach_exp: '30 años de experiencia', coach_quote: '"Te acompaño paso a paso hacia un cuerpo más libre."',
    first_seance_title: '¡Bravo!', first_seance_sub: '¡Primera sesión completada!\nCrea una cuenta gratis para guardar tu progreso.', first_seance_create: 'Crear mi cuenta', first_seance_later: 'Más tarde',
    save_progress_title: 'Guarda tu progreso', save_progress_sub: 'Crea una cuenta gratis para no perder nada',
    demo_limit: 'Suscríbete para ver el resto',
    motivation: (streak) => streak === 0 ? '"Empieza hoy.\nTu cuerpo te espera."' :
      streak < 3  ? `"${streak} día${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''}. Sigue."` :
      streak < 7  ? `"¡${streak} días seguidos!\nTu cuerpo despierta."` :
      streak < 14 ? `"¡${streak} días! Un hábito real\nse está formando."` :
      `"${streak} días. Eres extraordinario. ${U_WAVE}"`,
    celebration: 'Tu cuerpo ha progresado.\n¡Sigue así! \uD83D\uDCAA',
    biblio_signature: '— FluidBody',
    premium_alert_title: 'Contenido Premium',
    premium_alert_simulate: 'Ver ofertas',
    premium_alert_later: 'Más tarde',
    paywall_title: 'Pilates para todos',
    paywall_sub: 'Acceso ilimitado a 160 sesiones guiadas por Sabrina, experta Pilates desde hace 30 años',
    paywall_badge: '7 DÍAS GRATIS',
    paywall_yearly_link: '99 CHF/año · Ahorra 35%',
    paywall_monthly: 'Mensual',
    paywall_yearly: 'Anual',
    paywall_buy_monthly: 'Comprar mensual',
    paywall_buy_yearly: 'Comprar anual',
    paywall_restore: 'Restaurar compras',
    paywall_close: 'Cerrar',
    paywall_prices_loading: 'Cargando precios…',
    paywall_not_available: 'Compras no disponibles (Expo Go / simulador).',
    paywall_start: 'Empezar — 7 días gratis',
    paywall_per_month: '/mes',
    paywall_price_detail: 'Luego 12.90 CHF/mes · Cancela cuando quieras',
    paywall_access: 'Acceso inmediato a todos los pilares · Sin compromiso',
    paywall_try_free: 'Prueba la sesión gratuita',
    free_try_once: 'Prueba este episodio una vez gratis',
    free_go: '¡Vamos!',
    subscription_status_label: 'Suscripción FluidBody+',
    subscription_status_active: 'Activa — todas las sesiones',
    subscription_status_free: 'Inactivo',
    subscription_reset: 'Restaurar compras',
  },
  it: {
    lang: 'it', flag: '🇮🇹', nom: 'Italiano',
    tabs: ['FluidBody+', 'Riepilogo', 'Biblioteca', 'Timer', 'Profilo'],
    resume_title: 'Riepilogo', resume_activite: 'Attività', resume_bouger: 'Movimento', resume_exercice: 'Esercizio', resume_debout: 'In piedi', resume_seances: 'Sessioni FluidBody', resume_no_seance: 'Nessuna sessione completata', resume_progression: 'Progressione', resume_global: 'Globale', resume_streak: 'Serie',
    bonjour: (p) => p ? `Ciao ${p}` : '',
    bonjour_mot: 'Ciao',
    ob_tag: 'Un nuovo modo di abitare il tuo corpo',
    ob_l1: 'Le altre app ti mostrano ',
    ob_l1b: 'cosa fare.',
    ob_l2: 'FluidBody ti mostra ',
    ob_l2b: 'come prepararti.',
    ob_sub: 'Perché un corpo che si comprende può davvero cambiare.',
    ob_cta: 'Inizia →',
    ob_compte: 'Ho già un account',
    ob_bilan: 'Valutazione corporea',
    ob_tensions: 'Dove senti\ntensione?',
    ob_select: 'Seleziona una o più zone',
    ob_zones: ['Schiena / Collo', 'Spalle', 'Fianchi', 'Postura', 'Respirazione', 'Stress', 'Ufficio / Sedentario'],
    ob_continuer: 'Continua →',
    ob_explorer: 'Voglio esplorare tutto',
    ob_rythme_tag: 'Il tuo ritmo',
    ob_rythme: 'Quanto tempo hai\nogni giorno?',
    ob_temps: ['5–10 min', '15–20 min', '30 min', '45 min +'],
    ob_varie: 'Varia',
    ob_prenom_tag: 'Ultimo passo',
    ob_prenom: 'Come ti\nchiami?',
    ob_prenom_sub: 'Il tuo programma si adatta al tuo profilo.\nFluidBody ti accompagna ogni giorno.',
    ob_placeholder: 'Il tuo nome...',
    ob_demarrer: 'Inizia →',
    ob_anon: 'Entra anonimamente',
    ob_auth_tag: 'Account FluidBody',
    ob_auth_title: 'Salva il profilo',
    ob_auth_signup_title: 'Registrazione',
    ob_auth_signin_title: 'Accedi',
    ob_auth_sub: 'Email e password per sincronizzare i progressi nel cloud.',
    ob_auth_sub_signin: 'Inserisci le credenziali per recuperare i progressi.',
    ob_email_ph: 'tu@email.com',
    ob_pass_ph: 'Password (min. 6 caratteri)',
    ob_auth_submit_up: 'Crea account',
    ob_auth_submit_in: 'Accedi',
    ob_auth_toggle_in: 'Ho già un account →',
    ob_auth_toggle_up: 'Nessun account? Registrati',
    ob_auth_skip: 'Continua senza account cloud →',
    ob_auth_err_short: 'La password deve avere almeno 6 caratteri.',
    ob_auth_err_email: 'Inserisci un indirizzo email valido.',
    ob_auth_confirm: 'Se serve conferma email, controlla la posta e rientra.',
    ob_auth_err_net: 'Errore di rete.',
    ob_auth_no_cloud: 'Il salvataggio cloud non è disponibile in questa build. Le credenziali non verranno salvate su un server.',
    ob_auth_continue_local: 'Continua in locale →',
    piliers: ['Spalle', 'Schiena', 'Mobilità', 'Postura', 'Eldoa', 'Golf', 'Mat Pilates', 'Ufficio'],
    etapes: { Comprendre: 'Capire', Ressentir: 'Sentire', Préparer: 'Preparare', Exécuter: 'Eseguire', Évoluer: 'Evolvere' },
    retour: '← Il Mio Corpo',
    seances_done: (n) => `${n} / 20 sessioni completate`,
    m_seances: 'Sessioni', m_streak: 'Serie', m_progress: 'Progresso',
    retour_video: '← Indietro',
    video_resume: (t) => `Ripresa · ${t}`,
    reprise_badge: 'Riprendi',
    video_load_error: 'Impossibile caricare il video.',
    video_retry: 'Riprova',
    seance_done: '✓  Sessione completata',
    biblio_titre: 'Biblioteca',
    biblio_sub: 'Capire per sentire meglio',
    tab_piliers: 'I 6 pilastri',
    tab_methode: 'Il metodo',
    tab_pour_vous: 'Per te',
    tab_explorer: 'Esplora',
    tab_programmes: 'Programmi',
    tab_recherche: '\uD83D\uDD0D',
    explore_free_title: 'Selezione gratuita del mese',
    explore_free_sub: 'Prova questa sessione una volta, senza abbonamento',
    explore_new: 'Nuove selezioni per te',
    prog_section_title: 'I tuoi programmi su misura',
    prog_section_sub: 'Programmi predefiniti per mantenere il ritmo o intensificare la routine.',
    prog_debuter: 'Iniziare',
    prog_debuter_sub: 'Spalle, Schiena e Mobilità',
    prog_debuter_duree: '3 GIORNI · 10 MIN/GIORNO',
    prog_apercu: 'Anteprima del programma',
    prog_custom_title: 'Crea il tuo programma',
    prog_custom_sub: 'Scegli le attività e definisci il tuo programma.',
    prog_custom_card: 'Programma personalizzato',
    prog_custom_card_sub: 'Le tue attività, la durata, i tuoi giorni e il tuo ritmo.',
    prog_custom_btn: 'Crea un programma',
    prog_create_title: 'Crea un programma',
    prog_select_piliers: 'Seleziona i tuoi pilastri',
    prog_duree_label: 'Durata per sessione',
    prog_jours_label: 'Giorni a settimana',
    prog_save: 'Salva',
    prog_saved: 'Programma salvato!',
    prog_mes_programmes: 'I miei programmi',
    prog_notif_days: 'Giorni promemoria', prog_notif_hour: 'Ora promemoria', prog_notif_body: 'È ora della tua sessione',
    partage_title: 'Condividi', partage_progression: 'Condividi i miei progressi', partage_btn: 'Condividi', partage_share_msg: 'I miei progressi su FluidBody+ Pilates', partage_inviter: 'Invita amici', partage_invite_btn: 'Invita via SMS / Email', partage_invite_msg: 'Unisciti a FluidBody+ Pilates!', partage_en_attente: 'In attesa', partage_invitation: 'Invito', partage_defis: 'Sfide', partage_creer_defi: 'Crea una sfida', partage_choisir_pilier: 'Scegli un pilastro', partage_duree_defi: 'Durata', partage_lancer: 'Inizia',
    profil_donnees_title: 'Privacy', profil_donnees_desc: 'Scopri come vengono gestiti i tuoi dati. I tuoi dati restano sul tuo dispositivo. Nessun dato personale viene inviato a server di terze parti. Le sessioni, i progressi e le preferenze sono memorizzati localmente. Se accedi, solo la tua email viene sincronizzata per salvare il profilo.', profil_donnees_local: 'Dati memorizzati localmente sul dispositivo', profil_donnees_no_tracking: 'Nessun tracciamento pubblicitario', profil_donnees_healthkit: 'HealthKit: dati solo in lettura, mai condivisi',
    biblio_intro: 'Il metodo FluidBody si basa su 5 passaggi progressivi. Ogni sessione li percorre in ordine.',
    lire: ' di lettura',
    retour_biblio: '← Biblioteca',
    points_cles: 'Punti chiave',
    mon_parcours: 'Il Mio Percorso',
    prog_globale: 'Progresso globale',
    par_pilier: 'Per pilastro',
    parcours_langue: 'Lingua',
    mon_compte: 'Il mio account',
    compte_info: [['App', 'FluidBody · Pilates'], ['Versione', 'FluidBody Beta 1.0'], ['Metodo', 'Pilates Consapevole · 30 anni']],
    progresser_sub: (p) => `${p}% del percorso completato`,
    recommande_pour_toi: 'PER TE',
    seance_gratuite: 'Sessione gratuita',
    seance_du_jour_sub: 'Consigliata per te oggi',
    commencer_seance: 'Inizia →',
    deja_faite: '✓ Già fatta oggi',
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: 'La tua sessione demo ti aspetta. Il tuo corpo ha bisogno di te.',
    notif_pause_title: 'Pausa Attiva 🪑', notif_pause_body: 'È ora di muoversi! 5 min di stretching alla scrivania.',
    coach_title: 'Il Tuo Coach', coach_name: 'Sabrina', coach_subtitle: 'Esperta Pilates · 30 anni di esperienza', coach_bio: 'Appassionata di movimento consapevole, vi guido verso un corpo più libero e più forte.', coach_more: 'Scopri di più', coach_avec: 'Con Sabrina', coach_exp: '30 anni di esperienza', coach_quote: '"Vi accompagno passo dopo passo verso un corpo più libero."',
    first_seance_title: 'Bravo!', first_seance_sub: 'Prima sessione completata!\nCrea un account gratuito per salvare i tuoi progressi.', first_seance_create: 'Crea il mio account', first_seance_later: 'Più tardi',
    save_progress_title: 'Salva i tuoi progressi', save_progress_sub: 'Crea un account gratuito per non perdere nulla',
    demo_limit: 'Abbonati per vedere il resto',
    motivation: (streak) => streak === 0 ? '"Inizia oggi.\nIl tuo corpo ti aspetta."' :
      streak < 3  ? `"${streak} giorno${streak > 1 ? 'i' : ''} di fila. Continua."` :
      streak < 7  ? `"${streak} giorni consecutivi!\nIl tuo corpo si risveglia."` :
      streak < 14 ? `"${streak} giorni! Una vera abitudine\nsi sta formando."` :
      `"${streak} giorni. Sei straordinario. ${U_WAVE}"`,
    celebration: 'Il tuo corpo ha progredito.\nContinua così! \uD83D\uDCAA',
    biblio_signature: '— FluidBody',
    premium_alert_title: 'Contenuto Premium',
    premium_alert_simulate: 'Vedi offerte',
    premium_alert_later: 'Più tardi',
    paywall_title: 'Pilates per tutti',
    paywall_sub: 'Accesso illimitato a 160 sessioni guidate da Sabrina, esperta Pilates da 30 anni',
    paywall_badge: '7 GIORNI GRATIS',
    paywall_yearly_link: '99 CHF/anno · Risparmia 35%',
    paywall_monthly: 'Mensile',
    paywall_yearly: 'Annuale',
    paywall_buy_monthly: 'Acquista mensile',
    paywall_buy_yearly: 'Acquista annuale',
    paywall_start: 'Inizia — 7 giorni gratis',
    paywall_per_month: '/mese',
    paywall_price_detail: 'Poi 12.90 CHF/mese · Cancella quando vuoi',
    paywall_access: 'Accesso immediato a tutti i pilastri · Senza impegno',
    paywall_try_free: 'Prova la sessione gratuita',
    free_try_once: 'Prova questo episodio una volta gratis',
    free_go: 'Andiamo!',
    paywall_restore: 'Ripristina acquisti',
    paywall_close: 'Chiudi',
    paywall_prices_loading: 'Caricamento prezzi…',
    paywall_not_available: 'Acquisti non disponibili (Expo Go / simulatore).',
    subscription_status_label: 'Abbonamento FluidBody+',
    subscription_status_active: 'Attivo — tutte le sessioni',
    subscription_status_free: 'Inattivo',
    subscription_reset: 'Ripristina acquisti',
  },
  de: {
    lang: 'de', flag: '🇩🇪', nom: 'Deutsch',
    tabs: ['FluidBody+', 'Zusammenfassung', 'Bibliothek', 'Timer', 'Profil'],
    resume_title: 'Zusammenfassung', resume_activite: 'Aktivität', resume_bouger: 'Bewegen', resume_exercice: 'Übung', resume_debout: 'Stehen', resume_seances: 'FluidBody Sitzungen', resume_no_seance: 'Keine Sitzungen abgeschlossen', resume_progression: 'Fortschritt', resume_global: 'Gesamt', resume_streak: 'Serie',
    bonjour: (p) => p ? `Hallo ${p}` : '',
    bonjour_mot: 'Hallo',
    ob_tag: 'Eine neue Art, deinen Körper zu bewohnen',
    ob_l1: 'Andere Apps zeigen dir ',
    ob_l1b: 'was du tun sollst.',
    ob_l2: 'FluidBody zeigt dir ',
    ob_l2b: 'wie du dich vorbereitest.',
    ob_sub: 'Denn ein Körper, der sich selbst versteht, kann sich wirklich verändern.',
    ob_cta: 'Starten →',
    ob_compte: 'Ich habe bereits ein Konto',
    ob_bilan: 'Körperbewertung',
    ob_tensions: 'Wo spürst du\nVerspannungen?',
    ob_select: 'Wähle eine oder mehrere Zonen',
    ob_zones: ['Rücken / Nacken', 'Schultern', 'Hüften', 'Haltung', 'Atmung', 'Stress', 'Büro / Sitzend'],
    ob_continuer: 'Weiter →',
    ob_explorer: 'Ich möchte alles erkunden',
    ob_rythme_tag: 'Dein Rhythmus',
    ob_rythme: 'Wie viel Zeit hast du\njeden Tag?',
    ob_temps: ['5–10 Min', '15–20 Min', '30 Min', '45 Min +'],
    ob_varie: 'Variiert',
    ob_prenom_tag: 'Letzter Schritt',
    ob_prenom: 'Wie heißt\ndu?',
    ob_prenom_sub: 'Dein Programm passt sich deinem Profil an.\nFluidBody begleitet dich jeden Tag.',
    ob_placeholder: 'Dein Vorname...',
    ob_demarrer: 'Starten →',
    ob_anon: 'Anonym eintreten',
    ob_auth_tag: 'FluidBody Konto',
    ob_auth_title: 'Profil speichern',
    ob_auth_signup_title: 'Registrierung',
    ob_auth_signin_title: 'Anmelden',
    ob_auth_sub: 'E-Mail und Passwort, um deinen Fortschritt in der Cloud zu synchronisieren.',
    ob_auth_sub_signin: 'Gib deine Daten ein, um deinen Fortschritt wiederherzustellen.',
    ob_email_ph: 'deine@email.com',
    ob_pass_ph: 'Passwort (mind. 6 Zeichen)',
    ob_auth_submit_up: 'Konto erstellen',
    ob_auth_submit_in: 'Anmelden',
    ob_auth_toggle_in: 'Ich habe bereits ein Konto →',
    ob_auth_toggle_up: 'Kein Konto? Registrieren',
    ob_auth_skip: 'Ohne Cloud-Konto fortfahren →',
    ob_auth_err_short: 'Passwort muss mindestens 6 Zeichen haben.',
    ob_auth_err_email: 'Gib eine gültige E-Mail-Adresse ein.',
    ob_auth_confirm: 'Falls eine Bestätigung erforderlich ist, prüfe dein Postfach und melde dich erneut an.',
    ob_auth_err_net: 'Netzwerkfehler.',
    ob_auth_no_cloud: 'Cloud-Sicherung ist in dieser Version nicht verfügbar. Deine Daten werden nicht auf einem Server gespeichert.',
    ob_auth_continue_local: 'Lokal fortfahren →',
    piliers: ['Schultern', 'Rücken', 'Mobilität', 'Haltung', 'Eldoa', 'Golf', 'Mat Pilates', 'Büro'],
    etapes: { Comprendre: 'Verstehen', Ressentir: 'Spüren', Préparer: 'Vorbereiten', Exécuter: 'Ausführen', Évoluer: 'Weiterentwickeln' },
    retour: '← Mein Körper',
    seances_done: (n) => `${n} / 20 Sitzungen abgeschlossen`,
    m_seances: 'Sitzungen', m_streak: 'Serie', m_progress: 'Fortschritt',
    retour_video: '← Zurück',
    video_resume: (t) => `Fortgesetzt · ${t}`,
    reprise_badge: 'Fortsetzen',
    video_load_error: 'Das Video konnte nicht geladen werden.',
    video_retry: 'Erneut versuchen',
    seance_done: '✓  Sitzung abgeschlossen',
    biblio_titre: 'Bibliothek',
    biblio_sub: 'Verstehen, um besser zu spüren',
    tab_piliers: 'Die 6 Säulen',
    tab_methode: 'Die Methode',
    tab_pour_vous: 'Für dich',
    tab_explorer: 'Entdecken',
    tab_programmes: 'Programme',
    tab_recherche: '\uD83D\uDD0D',
    explore_free_title: 'Kostenlose Auswahl des Monats',
    explore_free_sub: 'Probiere diese Sitzung einmal aus, ohne Abo',
    explore_new: 'Neue Auswahl für dich',
    prog_section_title: 'Deine maßgeschneiderten Programme',
    prog_section_sub: 'Vordefinierte Programme, um deinen Schwung beizubehalten oder deine Routine zu intensivieren.',
    prog_debuter: 'Anfangen',
    prog_debuter_sub: 'Schultern, Rücken und Mobilität',
    prog_debuter_duree: '3 TAGE · 10 MIN/TAG',
    prog_apercu: 'Programmvorschau',
    prog_custom_title: 'Erstelle dein eigenes Programm',
    prog_custom_sub: 'Wähle Aktivitäten und definiere dein Programm.',
    prog_custom_card: 'Individuelles Programm',
    prog_custom_card_sub: 'Deine Aktivitäten, die Dauer, deine Tage und dein Rhythmus.',
    prog_custom_btn: 'Programm erstellen',
    prog_create_title: 'Programm erstellen',
    prog_select_piliers: 'Wähle deine Säulen',
    prog_duree_label: 'Dauer pro Sitzung',
    prog_jours_label: 'Tage pro Woche',
    prog_save: 'Speichern',
    prog_saved: 'Programm gespeichert!',
    prog_mes_programmes: 'Meine Programme',
    prog_notif_days: 'Erinnerungstage', prog_notif_hour: 'Erinnerungszeit', prog_notif_body: 'Zeit für deine Sitzung',
    partage_title: 'Teilen', partage_progression: 'Meinen Fortschritt teilen', partage_btn: 'Teilen', partage_share_msg: 'Mein FluidBody+ Pilates Fortschritt', partage_inviter: 'Freunde einladen', partage_invite_btn: 'Per SMS / E-Mail einladen', partage_invite_msg: 'Komm zu FluidBody+ Pilates!', partage_en_attente: 'Ausstehend', partage_invitation: 'Einladung', partage_defis: 'Challenges', partage_creer_defi: 'Challenge erstellen', partage_choisir_pilier: 'Wähle eine Säule', partage_duree_defi: 'Dauer', partage_lancer: 'Starten',
    profil_donnees_title: 'Datenschutz', profil_donnees_desc: 'Erfahre, wie deine Daten verwaltet werden. Deine Daten bleiben auf deinem Gerät. Keine persönlichen Daten werden an Drittserver gesendet. Sitzungen, Fortschritt und Einstellungen werden lokal gespeichert. Wenn du dich anmeldest, wird nur deine E-Mail synchronisiert, um dein Profil zu speichern.', profil_donnees_local: 'Daten lokal auf deinem Gerät gespeichert', profil_donnees_no_tracking: 'Kein Werbe-Tracking', profil_donnees_healthkit: 'HealthKit: Daten nur gelesen, nie geteilt',
    biblio_intro: 'Die FluidBody-Methode basiert auf 5 aufeinander aufbauenden Schritten. Jede Sitzung durchläuft sie der Reihe nach.',
    lire: ' Lesezeit',
    retour_biblio: '← Bibliothek',
    points_cles: 'Kernpunkte',
    mon_parcours: 'Mein Weg',
    prog_globale: 'Gesamtfortschritt',
    par_pilier: 'Nach Säule',
    parcours_langue: 'Sprache',
    mon_compte: 'Mein Konto',
    compte_info: [['App', 'FluidBody · Pilates'], ['Version', 'FluidBody Beta 1.0'], ['Methode', 'Bewusstes Pilates · 30 Jahre']],
    progresser_sub: (p) => `${p}% des Weges abgeschlossen`,
    recommande_pour_toi: 'FÜR DICH',
    seance_gratuite: 'Kostenlose Sitzung',
    seance_du_jour_sub: 'Heute für dich empfohlen',
    commencer_seance: 'Starten →',
    deja_faite: '✓ Heute schon gemacht',
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: 'Deine Demo-Sitzung wartet. Dein Körper braucht dich.',
    notif_pause_title: 'Aktive Pause 🪑', notif_pause_body: 'Zeit, sich zu bewegen! 5 Min Dehnübungen am Schreibtisch.',
    coach_title: 'Dein Coach', coach_name: 'Sabrina', coach_subtitle: 'Pilates-Expertin · 30 Jahre Erfahrung', coach_bio: 'Begeistert von bewusster Bewegung, führe ich dich zu einem freieren und stärkeren Körper.', coach_more: 'Mehr erfahren', coach_avec: 'Mit Sabrina', coach_exp: '30 Jahre Erfahrung', coach_quote: '"Ich begleite dich Schritt für Schritt zu einem freieren Körper."',
    demo_limit: 'Abonniere, um den Rest zu sehen',
    motivation: (streak) => streak === 0 ? '"Fang heute an.\nDein Körper wartet auf dich."' :
      streak < 3  ? `"${streak} Tag${streak > 1 ? 'e' : ''} am Stück. Weiter so."` :
      streak < 7  ? `"${streak} Tage hintereinander!\nDein Körper erwacht."` :
      streak < 14 ? `"${streak} Tage! Eine echte Gewohnheit\nentsteht."` :
      `"${streak} Tage. Du bist bemerkenswert. ${U_WAVE}"`,
    celebration: 'Dein Körper hat Fortschritte gemacht.\nWeiter so! \uD83D\uDCAA',
    biblio_signature: '— FluidBody',
    premium_alert_title: 'Premium-Inhalt',
    premium_alert_simulate: 'Angebote ansehen',
    premium_alert_later: 'Später',
    paywall_title: 'Pilates für alle',
    paywall_sub: 'Unbegrenzter Zugang zu 160 Sitzungen mit Sabrina, Pilates-Expertin seit 30 Jahren',
    paywall_badge: '7 TAGE KOSTENLOS',
    paywall_yearly_link: '99 CHF/Jahr · 35% sparen',
    paywall_monthly: 'Monatlich',
    paywall_yearly: 'Jährlich',
    paywall_buy_monthly: 'Monatlich kaufen',
    paywall_buy_yearly: 'Jährlich kaufen',
    paywall_restore: 'Käufe wiederherstellen',
    paywall_close: 'Schließen',
    paywall_prices_loading: 'Preise werden geladen…',
    paywall_not_available: 'Käufe nicht verfügbar (Expo Go / Simulator).',
    paywall_start: 'Starten — 7 Tage kostenlos',
    paywall_per_month: '/Monat',
    paywall_price_detail: 'Dann 12.90 CHF/Monat · Jederzeit kündbar',
    paywall_access: 'Sofortiger Zugang zu allen Säulen · Ohne Bindung',
    paywall_try_free: 'Kostenlose Sitzung testen',
    free_try_once: 'Teste diese Episode einmal kostenlos',
    free_go: 'Los geht\'s!',
    subscription_status_label: 'FluidBody+ Abonnement',
    subscription_status_active: 'Aktiv — alle Sitzungen',
    subscription_status_free: 'Inaktiv',
    subscription_reset: 'Käufe wiederherstellen',
  },
  pt: {
    lang: 'pt', flag: '🇧🇷', nom: 'Português',
    tabs: ['FluidBody+', 'Resumo', 'Biblioteca', 'Timer', 'Perfil'],
    resume_title: 'Resumo', resume_activite: 'Atividade', resume_bouger: 'Movimento', resume_exercice: 'Exercício', resume_debout: 'Em pé', resume_seances: 'Sessões FluidBody', resume_no_seance: 'Nenhuma sessão concluída', resume_progression: 'Progresso', resume_global: 'Geral', resume_streak: 'Sequência',
    bonjour: (p) => p ? `Olá ${p}` : '',
    bonjour_mot: 'Olá',
    ob_tag: 'Uma nova forma de habitar o seu corpo',
    ob_l1: 'Outros apps mostram ',
    ob_l1b: 'o que fazer.',
    ob_l2: 'O FluidBody mostra ',
    ob_l2b: 'como se preparar.',
    ob_sub: 'Porque um corpo que se compreende pode realmente mudar.',
    ob_cta: 'Começar →',
    ob_compte: 'Já tenho uma conta',
    ob_bilan: 'Avaliação corporal',
    ob_tensions: 'Onde você sente\ntensão?',
    ob_select: 'Selecione uma ou mais áreas',
    ob_zones: ['Costas / Pescoço', 'Ombros', 'Quadris', 'Postura', 'Respiração', 'Estresse', 'Escritório / Sedentário'],
    ob_continuer: 'Continuar →',
    ob_explorer: 'Quero explorar tudo',
    ob_rythme_tag: 'Seu ritmo',
    ob_rythme: 'Quanto tempo você tem\ncada dia?',
    ob_temps: ['5–10 min', '15–20 min', '30 min', '45 min +'],
    ob_varie: 'Varia',
    ob_prenom_tag: 'Último passo',
    ob_prenom: 'Qual é o\nseu nome?',
    ob_prenom_sub: 'Seu programa se adapta ao seu perfil.\nO FluidBody acompanha você todos os dias.',
    ob_placeholder: 'Seu nome...',
    ob_demarrer: 'Começar →',
    ob_anon: 'Entrar anonimamente',
    ob_auth_tag: 'Conta FluidBody',
    ob_auth_title: 'Salvar perfil',
    ob_auth_signup_title: 'Cadastro',
    ob_auth_signin_title: 'Entrar',
    ob_auth_sub: 'E-mail e senha para sincronizar seu progresso na nuvem.',
    ob_auth_sub_signin: 'Insira suas credenciais para recuperar seu progresso.',
    ob_email_ph: 'seu@email.com',
    ob_pass_ph: 'Senha (mín. 6 caracteres)',
    ob_auth_submit_up: 'Criar conta',
    ob_auth_submit_in: 'Entrar',
    ob_auth_toggle_in: 'Já tenho uma conta →',
    ob_auth_toggle_up: 'Sem conta? Cadastre-se',
    ob_auth_skip: 'Continuar sem conta na nuvem →',
    ob_auth_err_short: 'A senha deve ter pelo menos 6 caracteres.',
    ob_auth_err_email: 'Insira um endereço de e-mail válido.',
    ob_auth_confirm: 'Se for necessária confirmação, verifique seu e-mail e entre novamente.',
    ob_auth_err_net: 'Erro de rede.',
    ob_auth_no_cloud: 'Backup na nuvem não está disponível nesta versão. Suas credenciais não serão salvas em um servidor.',
    ob_auth_continue_local: 'Continuar localmente →',
    piliers: ['Ombros', 'Costas', 'Mobilidade', 'Postura', 'Eldoa', 'Golf', 'Mat Pilates', 'Escritório'],
    etapes: { Comprendre: 'Compreender', Ressentir: 'Sentir', Préparer: 'Preparar', Exécuter: 'Executar', Évoluer: 'Evoluir' },
    retour: '← Meu Corpo',
    seances_done: (n) => `${n} / 20 sessões concluídas`,
    m_seances: 'Sessões', m_streak: 'Sequência', m_progress: 'Progresso',
    retour_video: '← Voltar',
    video_resume: (t) => `Retomado · ${t}`,
    reprise_badge: 'Retomar',
    video_load_error: 'Não foi possível carregar o vídeo.',
    video_retry: 'Tentar novamente',
    seance_done: '✓  Sessão concluída',
    biblio_titre: 'Biblioteca',
    biblio_sub: 'Compreender para sentir melhor',
    tab_piliers: 'Os 6 pilares',
    tab_methode: 'O método',
    tab_pour_vous: 'Para você',
    tab_explorer: 'Explorar',
    tab_programmes: 'Programas',
    tab_recherche: '\uD83D\uDD0D',
    explore_free_title: 'Seleção gratuita do mês',
    explore_free_sub: 'Experimente esta sessão uma vez, sem assinatura',
    explore_new: 'Novas seleções para você',
    prog_section_title: 'Seus programas personalizados',
    prog_section_sub: 'Programas predefinidos para manter seu ritmo ou intensificar sua rotina.',
    prog_debuter: 'Começar',
    prog_debuter_sub: 'Ombros, Costas e Mobilidade',
    prog_debuter_duree: '3 DIAS · 10 MIN/DIA',
    prog_apercu: 'Visão geral do programa',
    prog_custom_title: 'Crie seu próprio programa',
    prog_custom_sub: 'Escolha atividades e defina seu programa.',
    prog_custom_card: 'Programa personalizado',
    prog_custom_card_sub: 'Suas atividades, a duração, seus dias e seu ritmo.',
    prog_custom_btn: 'Criar um programa',
    prog_create_title: 'Criar um programa',
    prog_select_piliers: 'Selecione seus pilares',
    prog_duree_label: 'Duração por sessão',
    prog_jours_label: 'Dias por semana',
    prog_save: 'Salvar',
    prog_saved: 'Programa salvo!',
    prog_mes_programmes: 'Meus programas',
    prog_notif_days: 'Dias de lembrete', prog_notif_hour: 'Hora do lembrete', prog_notif_body: 'Hora da sua sessão',
    partage_title: 'Compartilhar', partage_progression: 'Compartilhar meu progresso', partage_btn: 'Compartilhar', partage_share_msg: 'Meu progresso no FluidBody+ Pilates', partage_inviter: 'Convidar amigos', partage_invite_btn: 'Convidar por SMS / E-mail', partage_invite_msg: 'Junte-se a mim no FluidBody+ Pilates!', partage_en_attente: 'Pendente', partage_invitation: 'Convite', partage_defis: 'Desafios', partage_creer_defi: 'Criar um desafio', partage_choisir_pilier: 'Escolha um pilar', partage_duree_defi: 'Duração', partage_lancer: 'Iniciar',
    profil_donnees_title: 'Privacidade', profil_donnees_desc: 'Saiba como seus dados são gerenciados. Seus dados ficam no seu dispositivo. Nenhum dado pessoal é enviado a servidores de terceiros. Sessões, progresso e preferências são armazenados localmente. Se você entrar, apenas seu e-mail é sincronizado para salvar seu perfil.', profil_donnees_local: 'Dados armazenados localmente no seu dispositivo', profil_donnees_no_tracking: 'Sem rastreamento publicitário', profil_donnees_healthkit: 'HealthKit: dados apenas lidos, nunca compartilhados',
    biblio_intro: 'O método FluidBody se baseia em 5 etapas progressivas. Cada sessão as percorre em ordem.',
    lire: ' de leitura',
    retour_biblio: '← Biblioteca',
    points_cles: 'Pontos-chave',
    mon_parcours: 'Meu Percurso',
    prog_globale: 'Progresso geral',
    par_pilier: 'Por pilar',
    parcours_langue: 'Idioma',
    mon_compte: 'Minha conta',
    compte_info: [['App', 'FluidBody · Pilates'], ['Versão', 'FluidBody Beta 1.0'], ['Método', 'Pilates Consciente · 30 anos']],
    progresser_sub: (p) => `${p}% do percurso concluído`,
    recommande_pour_toi: 'PARA VOCÊ',
    seance_gratuite: 'Sessão gratuita',
    seance_du_jour_sub: 'Recomendada para você hoje',
    commencer_seance: 'Começar →',
    deja_faite: '✓ Já feita hoje',
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: 'Sua sessão demo está esperando. Seu corpo precisa de você.',
    notif_pause_title: 'Pausa Ativa 🪑', notif_pause_body: 'Hora de se mover! 5 min de alongamento na mesa.',
    coach_title: 'Seu Coach', coach_name: 'Sabrina', coach_subtitle: 'Especialista em Pilates · 30 anos de experiência', coach_bio: 'Apaixonada pelo movimento consciente, eu guio você rumo a um corpo mais livre e mais forte.', coach_more: 'Saiba mais', coach_avec: 'Com Sabrina', coach_exp: '30 anos de experiência', coach_quote: '"Eu acompanho você passo a passo rumo a um corpo mais livre."',
    demo_limit: 'Assine para ver o restante',
    motivation: (streak) => streak === 0 ? '"Comece hoje.\nSeu corpo está esperando."' :
      streak < 3  ? `"${streak} dia${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''}. Continue."` :
      streak < 7  ? `"${streak} dias seguidos!\nSeu corpo está despertando."` :
      streak < 14 ? `"${streak} dias! Um hábito real\nestá se formando."` :
      `"${streak} dias. Você é notável. ${U_WAVE}"`,
    celebration: 'Seu corpo progrediu.\nContinue assim! \uD83D\uDCAA',
    biblio_signature: '— FluidBody',
    premium_alert_title: 'Conteúdo Premium',
    premium_alert_simulate: 'Ver ofertas',
    premium_alert_later: 'Mais tarde',
    paywall_title: 'Pilates para todos',
    paywall_sub: 'Acesso ilimitado a 160 sessões guiadas por Sabrina, especialista em Pilates há 30 anos',
    paywall_badge: '7 DIAS GRÁTIS',
    paywall_yearly_link: '99 CHF/ano · Economize 35%',
    paywall_monthly: 'Mensal',
    paywall_yearly: 'Anual',
    paywall_buy_monthly: 'Comprar mensal',
    paywall_buy_yearly: 'Comprar anual',
    paywall_restore: 'Restaurar compras',
    paywall_close: 'Fechar',
    paywall_prices_loading: 'Carregando preços…',
    paywall_not_available: 'Compras indisponíveis (Expo Go / simulador).',
    paywall_start: 'Começar — 7 dias grátis',
    paywall_per_month: '/mês',
    paywall_price_detail: 'Depois 12.90 CHF/mês · Cancele quando quiser',
    paywall_access: 'Acesso imediato a todos os pilares · Sem compromisso',
    paywall_try_free: 'Experimente a sessão gratuita',
    free_try_once: 'Experimente este episódio uma vez de graça',
    free_go: 'Vamos lá!',
    subscription_status_label: 'Assinatura FluidBody+',
    subscription_status_active: 'Ativa — todas as sessões',
    subscription_status_free: 'Inativo',
    subscription_reset: 'Restaurar compras',
  },
  zh: {
    lang: 'zh', flag: '🇨🇳', nom: '中文',
    tabs: ['FluidBody+', '摘要', '资料库', '计时器', '个人'],
    resume_title: '摘要', resume_activite: '活动', resume_bouger: '运动', resume_exercice: '锻炼', resume_debout: '站立', resume_seances: 'FluidBody 课程', resume_no_seance: '尚未完成任何课程', resume_progression: '进度', resume_global: '总体', resume_streak: '连续',
    bonjour: (p) => p ? `你好 ${p}` : '',
    bonjour_mot: '你好',
    ob_tag: '一种全新的方式来感受你的身体',
    ob_l1: '其他应用告诉你',
    ob_l1b: '做什么。',
    ob_l2: 'FluidBody 告诉你',
    ob_l2b: '如何准备。',
    ob_sub: '因为一个理解自己的身体才能真正改变。',
    ob_cta: '开始 →',
    ob_compte: '我已有账户',
    ob_bilan: '身体评估',
    ob_tensions: '你在哪里感到\n紧张？',
    ob_select: '选择一个或多个区域',
    ob_zones: ['背部 / 颈部', '肩膀', '髋部', '姿势', '呼吸', '压力', '办公 / 久坐'],
    ob_continuer: '继续 →',
    ob_explorer: '我想全部探索',
    ob_rythme_tag: '你的节奏',
    ob_rythme: '你每天有\n多少时间？',
    ob_temps: ['5–10 分钟', '15–20 分钟', '30 分钟', '45 分钟 +'],
    ob_varie: '不一定',
    ob_prenom_tag: '最后一步',
    ob_prenom: '你叫\n什么名字？',
    ob_prenom_sub: '你的计划会根据你的档案进行调整。\nFluidBody 每天陪伴你。',
    ob_placeholder: '你的名字...',
    ob_demarrer: '开始 →',
    ob_anon: '匿名进入',
    ob_auth_tag: 'FluidBody 账户',
    ob_auth_title: '保存个人资料',
    ob_auth_signup_title: '注册',
    ob_auth_signin_title: '登录',
    ob_auth_sub: '使用电子邮件和密码在云端同步你的进度。',
    ob_auth_sub_signin: '输入你的凭据以恢复进度。',
    ob_email_ph: 'your@email.com',
    ob_pass_ph: '密码（至少6个字符）',
    ob_auth_submit_up: '创建账户',
    ob_auth_submit_in: '登录',
    ob_auth_toggle_in: '我已有账户 →',
    ob_auth_toggle_up: '没有账户？注册',
    ob_auth_skip: '不使用云账户继续 →',
    ob_auth_err_short: '密码至少需要6个字符。',
    ob_auth_err_email: '请输入有效的电子邮件地址。',
    ob_auth_confirm: '如需确认，请查看邮箱后重新登录。',
    ob_auth_err_net: '网络错误。',
    ob_auth_no_cloud: '此版本不支持云备份。你的凭据不会保存到服务器。',
    ob_auth_continue_local: '本地继续 →',
    piliers: ['肩膀', '背部', '灵活性', '姿势', 'Eldoa', '高尔夫', '垫上普拉提', '办公'],
    etapes: { Comprendre: '理解', Ressentir: '感受', Préparer: '准备', Exécuter: '执行', Évoluer: '进阶' },
    retour: '← 我的身体',
    seances_done: (n) => `${n} / 20 节课程已完成`,
    m_seances: '课程', m_streak: '连续', m_progress: '进度',
    retour_video: '← 返回',
    video_resume: (t) => `继续播放 · ${t}`,
    reprise_badge: '继续',
    video_load_error: '视频无法加载。',
    video_retry: '重试',
    seance_done: '✓  课程完成',
    biblio_titre: '资料库',
    biblio_sub: '理解才能更好地感受',
    tab_piliers: '六大支柱',
    tab_methode: '方法',
    tab_pour_vous: '为你推荐',
    tab_explorer: '探索',
    tab_programmes: '计划',
    tab_recherche: '\uD83D\uDD0D',
    explore_free_title: '本月免费精选',
    explore_free_sub: '免费试用此课程一次，无需订阅',
    explore_new: '为你精选的新内容',
    prog_section_title: '你的定制计划',
    prog_section_sub: '预设计划，帮助你保持势头或加强日常锻炼。',
    prog_debuter: '开始',
    prog_debuter_sub: '肩膀、背部和灵活性',
    prog_debuter_duree: '3 天 · 每天 10 分钟',
    prog_apercu: '计划预览',
    prog_custom_title: '创建你自己的计划',
    prog_custom_sub: '选择活动并定义你的计划。',
    prog_custom_card: '自定义计划',
    prog_custom_card_sub: '你的活动、锻炼时长、天数和节奏。',
    prog_custom_btn: '创建计划',
    prog_create_title: '创建计划',
    prog_select_piliers: '选择你的支柱',
    prog_duree_label: '每节时长',
    prog_jours_label: '每周天数',
    prog_save: '保存',
    prog_saved: '计划已保存！',
    prog_mes_programmes: '我的计划',
    prog_notif_days: '提醒日', prog_notif_hour: '提醒时间', prog_notif_body: '该做课程了',
    partage_title: '分享', partage_progression: '分享我的进度', partage_btn: '分享', partage_share_msg: '我的 FluidBody+ 普拉提进度', partage_inviter: '邀请朋友', partage_invite_btn: '通过短信/邮件邀请', partage_invite_msg: '加入我的 FluidBody+ 普拉提！', partage_en_attente: '等待中', partage_invitation: '邀请', partage_defis: '挑战', partage_creer_defi: '创建挑战', partage_choisir_pilier: '选择一个支柱', partage_duree_defi: '时长', partage_lancer: '开始',
    profil_donnees_title: '隐私', profil_donnees_desc: '了解你的数据如何管理。你的数据保留在你的设备上。没有个人数据被发送到第三方服务器。课程、进度和偏好都存储在本地。如果你登录，只有你的电子邮件会被同步以保存你的个人资料。', profil_donnees_local: '数据本地存储在你的设备上', profil_donnees_no_tracking: '无广告追踪', profil_donnees_healthkit: 'HealthKit：仅读取数据，从不分享',
    biblio_intro: 'FluidBody 方法基于5个渐进步骤。每节课按顺序进行。',
    lire: ' 阅读时间',
    retour_biblio: '← 资料库',
    points_cles: '要点',
    mon_parcours: '我的旅程',
    prog_globale: '总体进度',
    par_pilier: '按支柱',
    parcours_langue: '语言',
    mon_compte: '我的账户',
    compte_info: [['应用', 'FluidBody · 普拉提'], ['版本', 'FluidBody Beta 1.0'], ['方法', '意识普拉提 · 30 年']],
    progresser_sub: (p) => `${p}% 的旅程已完成`,
    recommande_pour_toi: '为你推荐',
    seance_gratuite: '免费课程',
    seance_du_jour_sub: '今天为你推荐',
    commencer_seance: '开始 →',
    deja_faite: '✓ 今天已完成',
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: '你的体验课程正在等你。你的身体需要你。',
    notif_pause_title: '活力休息 🪑', notif_pause_body: '是时候动一动了！5分钟桌前拉伸。',
    coach_title: '你的教练', coach_name: 'Sabrina', coach_subtitle: '普拉提专家 · 30年经验', coach_bio: '热爱有意识的运动，我引导你走向更自由、更强健的身体。', coach_more: '了解更多', coach_avec: '与 Sabrina', coach_exp: '30年经验', coach_quote: '"我一步一步引导你走向更自由的身体。"',
    demo_limit: '订阅以查看更多内容',
    motivation: (streak) => streak === 0 ? '"从今天开始。\n你的身体在等你。"' :
      streak < 3  ? `"连续${streak}天。继续加油。"` :
      streak < 7  ? `"连续${streak}天！\n你的身体正在觉醒。"` :
      streak < 14 ? `"${streak}天！一个真正的习惯\n正在形成。"` :
      `"${streak}天。你真了不起。${U_WAVE}"`,
    celebration: '你的身体有了进步。\n继续加油！\uD83D\uDCAA',
    biblio_signature: '— FluidBody',
    premium_alert_title: '高级内容',
    premium_alert_simulate: '查看优惠',
    premium_alert_later: '稍后',
    paywall_title: '人人都能练的普拉提',
    paywall_sub: '无限畅享160节由30年经验的普拉提专家Sabrina指导的课程',
    paywall_badge: '免费试用7天',
    paywall_yearly_link: '99 CHF/年 · 节省35%',
    paywall_monthly: '月度',
    paywall_yearly: '年度',
    paywall_buy_monthly: '购买月度',
    paywall_buy_yearly: '购买年度',
    paywall_restore: '恢复购买',
    paywall_close: '关闭',
    paywall_prices_loading: '正在加载价格…',
    paywall_not_available: '购买不可用（Expo Go / 模拟器）。',
    paywall_start: '开始 — 免费7天',
    paywall_per_month: '/月',
    paywall_price_detail: '之后12.90 CHF/月 · 随时取消',
    paywall_access: '立即访问所有课程 · 无需承诺',
    paywall_try_free: '试试免费课程',
    free_try_once: '免费试用此集一次',
    free_go: '开始吧！',
    subscription_status_label: 'FluidBody+ 订阅',
    subscription_status_active: '已激活 — 所有课程',
    subscription_status_free: '未激活',
    subscription_reset: '恢复购买',
  },
  ja: {
    lang: 'ja', flag: '🇯🇵', nom: '日本語',
    tabs: ['FluidBody+', '概要', 'ライブラリ', 'タイマー', 'プロフィール'],
    resume_title: '概要', resume_activite: 'アクティビティ', resume_bouger: '運動', resume_exercice: 'エクササイズ', resume_debout: '立位', resume_seances: 'FluidBody セッション', resume_no_seance: '完了したセッションなし', resume_progression: '進捗', resume_global: '全体', resume_streak: '連続',
    bonjour: (p) => p ? `こんにちは ${p}` : '',
    bonjour_mot: 'こんにちは',
    ob_tag: '身体と向き合う新しい方法',
    ob_l1: '他のアプリは',
    ob_l1b: '何をすべきか教えます。',
    ob_l2: 'FluidBody は',
    ob_l2b: 'どう準備するか教えます。',
    ob_sub: '自分を理解する身体こそ、本当に変われるから。',
    ob_cta: 'はじめる →',
    ob_compte: 'すでにアカウントがあります',
    ob_bilan: 'ボディ評価',
    ob_tensions: 'どこに緊張を\n感じますか？',
    ob_select: '1つ以上のエリアを選択',
    ob_zones: ['背中 / 首', '肩', '股関節', '姿勢', '呼吸', 'ストレス', 'デスクワーク / 座りがち'],
    ob_continuer: '続ける →',
    ob_explorer: 'すべてを探索したい',
    ob_rythme_tag: 'あなたのリズム',
    ob_rythme: '毎日どれくらい\n時間がありますか？',
    ob_temps: ['5〜10分', '15〜20分', '30分', '45分以上'],
    ob_varie: 'まちまち',
    ob_prenom_tag: '最後のステップ',
    ob_prenom: 'お名前は\n何ですか？',
    ob_prenom_sub: 'プログラムはあなたのプロフィールに合わせて調整されます。\nFluidBody は毎日あなたをサポートします。',
    ob_placeholder: 'あなたの名前...',
    ob_demarrer: 'はじめる →',
    ob_anon: '匿名で入る',
    ob_auth_tag: 'FluidBody アカウント',
    ob_auth_title: 'プロフィールを保存',
    ob_auth_signup_title: '登録',
    ob_auth_signin_title: 'ログイン',
    ob_auth_sub: 'メールとパスワードでクラウドに進捗を同期します。',
    ob_auth_sub_signin: '認証情報を入力して進捗を復元します。',
    ob_email_ph: 'your@email.com',
    ob_pass_ph: 'パスワード（6文字以上）',
    ob_auth_submit_up: 'アカウント作成',
    ob_auth_submit_in: 'ログイン',
    ob_auth_toggle_in: 'すでにアカウントがあります →',
    ob_auth_toggle_up: 'アカウントがない？登録する',
    ob_auth_skip: 'クラウドアカウントなしで続ける →',
    ob_auth_err_short: 'パスワードは6文字以上必要です。',
    ob_auth_err_email: '有効なメールアドレスを入力してください。',
    ob_auth_confirm: '確認が必要な場合は、受信トレイを確認してから再度ログインしてください。',
    ob_auth_err_net: 'ネットワークエラー。',
    ob_auth_no_cloud: 'このビルドではクラウドバックアップは利用できません。認証情報はサーバーに保存されません。',
    ob_auth_continue_local: 'ローカルで続ける →',
    piliers: ['肩', '背中', 'モビリティ', '姿勢', 'Eldoa', 'ゴルフ', 'マットピラティス', 'オフィス'],
    etapes: { Comprendre: '理解する', Ressentir: '感じる', Préparer: '準備する', Exécuter: '実行する', Évoluer: '進化する' },
    retour: '← マイボディ',
    seances_done: (n) => `${n} / 20 セッション完了`,
    m_seances: 'セッション', m_streak: '連続', m_progress: '進捗',
    retour_video: '← 戻る',
    video_resume: (t) => `再開 · ${t}`,
    reprise_badge: '再開',
    video_load_error: '動画を読み込めませんでした。',
    video_retry: '再試行',
    seance_done: '✓  セッション完了',
    biblio_titre: 'ライブラリ',
    biblio_sub: '理解することでより良く感じる',
    tab_piliers: '6つの柱',
    tab_methode: 'メソッド',
    tab_pour_vous: 'あなたへ',
    tab_explorer: '探索',
    tab_programmes: 'プログラム',
    tab_recherche: '\uD83D\uDD0D',
    explore_free_title: '今月の無料セレクション',
    explore_free_sub: 'サブスク不要で1回お試しいただけます',
    explore_new: 'あなたへの新しいセレクション',
    prog_section_title: 'あなた専用のプログラム',
    prog_section_sub: '勢いを維持、またはルーティンを強化するためのプログラム。',
    prog_debuter: '始める',
    prog_debuter_sub: '肩、背中、モビリティ',
    prog_debuter_duree: '3日間 · 1日10分',
    prog_apercu: 'プログラム概要',
    prog_custom_title: '自分だけのプログラムを作る',
    prog_custom_sub: 'アクティビティを選んでプログラムを定義しましょう。',
    prog_custom_card: 'カスタムプログラム',
    prog_custom_card_sub: 'アクティビティ、時間、曜日、ペースを自由に。',
    prog_custom_btn: 'プログラムを作る',
    prog_create_title: 'プログラム作成',
    prog_select_piliers: '柱を選択',
    prog_duree_label: '1セッションの時間',
    prog_jours_label: '週の日数',
    prog_save: '保存',
    prog_saved: 'プログラムを保存しました！',
    prog_mes_programmes: 'マイプログラム',
    prog_notif_days: 'リマインダー曜日', prog_notif_hour: 'リマインダー時間', prog_notif_body: 'セッションの時間です',
    partage_title: 'シェア', partage_progression: '進捗をシェア', partage_btn: 'シェア', partage_share_msg: 'FluidBody+ ピラティスの進捗', partage_inviter: '友達を招待', partage_invite_btn: 'SMS / メールで招待', partage_invite_msg: 'FluidBody+ ピラティスに参加しよう！', partage_en_attente: '保留中', partage_invitation: '招待', partage_defis: 'チャレンジ', partage_creer_defi: 'チャレンジを作る', partage_choisir_pilier: '柱を選ぶ', partage_duree_defi: '期間', partage_lancer: '開始',
    profil_donnees_title: 'プライバシー', profil_donnees_desc: 'データの管理方法をご覧ください。データはお使いのデバイスに保存されます。個人データが第三者サーバーに送信されることはありません。セッション、進捗、設定はローカルに保存されます。ログインした場合、プロフィール保存のためメールのみが同期されます。', profil_donnees_local: 'データはデバイスにローカル保存', profil_donnees_no_tracking: '広告トラッキングなし', profil_donnees_healthkit: 'HealthKit：読み取りのみ、共有なし',
    biblio_intro: 'FluidBody メソッドは5つの段階的ステップに基づいています。各セッションは順番に進みます。',
    lire: ' 読了時間',
    retour_biblio: '← ライブラリ',
    points_cles: 'ポイント',
    mon_parcours: 'マイジャーニー',
    prog_globale: '全体の進捗',
    par_pilier: '柱ごと',
    parcours_langue: '言語',
    mon_compte: 'マイアカウント',
    compte_info: [['アプリ', 'FluidBody · ピラティス'], ['バージョン', 'FluidBody Beta 1.0'], ['メソッド', '意識的ピラティス · 30年']],
    progresser_sub: (p) => `旅の${p}%が完了`,
    recommande_pour_toi: 'あなたへ',
    seance_gratuite: '無料セッション',
    seance_du_jour_sub: '今日のおすすめ',
    commencer_seance: 'はじめる →',
    deja_faite: '✓ 今日は完了済み',
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: 'デモセッションが待っています。あなたの身体があなたを必要としています。',
    notif_pause_title: 'アクティブ休憩 🪑', notif_pause_body: '動く時間です！デスクで5分間のストレッチ。',
    coach_title: 'あなたのコーチ', coach_name: 'Sabrina', coach_subtitle: 'ピラティス専門家 · 30年の経験', coach_bio: '意識的な動きに情熱を注ぎ、より自由で強い身体へと導きます。', coach_more: '詳しく見る', coach_avec: 'Sabrina と', coach_exp: '30年の経験', coach_quote: '"一歩ずつ、より自由な身体へとお導きします。"',
    demo_limit: '続きを見るにはサブスクリプションが必要です',
    motivation: (streak) => streak === 0 ? '"今日から始めましょう。\nあなたの身体が待っています。"' :
      streak < 3  ? `"${streak}日連続。続けましょう。"` :
      streak < 7  ? `"${streak}日連続！\nあなたの身体が目覚めています。"` :
      streak < 14 ? `"${streak}日！本物の習慣が\n形成されています。"` :
      `"${streak}日。あなたは素晴らしい。${U_WAVE}"`,
    celebration: 'あなたの身体は進歩しました。\nこの調子で！\uD83D\uDCAA',
    biblio_signature: '— FluidBody',
    premium_alert_title: 'プレミアムコンテンツ',
    premium_alert_simulate: 'プランを見る',
    premium_alert_later: '後で',
    paywall_title: 'みんなのピラティス',
    paywall_sub: '30年の経験を持つピラティス専門家Sabrinaが指導する160セッションに無制限アクセス',
    paywall_badge: '7日間無料',
    paywall_yearly_link: '99 CHF/年 · 35%お得',
    paywall_monthly: '月額',
    paywall_yearly: '年額',
    paywall_buy_monthly: '月額を購入',
    paywall_buy_yearly: '年額を購入',
    paywall_restore: '購入を復元',
    paywall_close: '閉じる',
    paywall_prices_loading: '価格を読み込み中…',
    paywall_not_available: '購入不可（Expo Go / シミュレーター）。',
    paywall_start: 'はじめる — 7日間無料',
    paywall_per_month: '/月',
    paywall_price_detail: 'その後12.90 CHF/月 · いつでもキャンセル可能',
    paywall_access: 'すべてのコースに即時アクセス · 縛りなし',
    paywall_try_free: '無料セッションを試す',
    free_try_once: 'このエピソードを1回無料でお試し',
    free_go: 'さあ始めよう！',
    subscription_status_label: 'FluidBody+ サブスクリプション',
    subscription_status_active: '有効 — すべてのセッション',
    subscription_status_free: '無効',
    subscription_reset: '購入を復元',
  },
  ko: {
    lang: 'ko', flag: '🇰🇷', nom: '한국어',
    tabs: ['FluidBody+', '요약', '라이브러리', '타이머', '프로필'],
    resume_title: '요약', resume_activite: '활동', resume_bouger: '움직임', resume_exercice: '운동', resume_debout: '서기', resume_seances: 'FluidBody 세션', resume_no_seance: '완료된 세션 없음', resume_progression: '진행', resume_global: '전체', resume_streak: '연속',
    bonjour: (p) => p ? `안녕하세요 ${p}` : '',
    bonjour_mot: '안녕하세요',
    ob_tag: '당신의 몸을 느끼는 새로운 방법',
    ob_l1: '다른 앱은 ',
    ob_l1b: '무엇을 할지 알려줍니다.',
    ob_l2: 'FluidBody는 ',
    ob_l2b: '어떻게 준비할지 알려줍니다.',
    ob_sub: '자기 몸을 이해하는 것이 진정한 변화의 시작이니까요.',
    ob_cta: '시작하기 →',
    ob_compte: '이미 계정이 있습니다',
    ob_bilan: '신체 평가',
    ob_tensions: '어디에서\n긴장을 느끼나요?',
    ob_select: '하나 이상의 부위를 선택하세요',
    ob_zones: ['등 / 목', '어깨', '골반', '자세', '호흡', '스트레스', '사무실 / 좌식'],
    ob_continuer: '계속 →',
    ob_explorer: '모두 탐색하고 싶어요',
    ob_rythme_tag: '나의 리듬',
    ob_rythme: '매일 얼마나\n시간이 있나요?',
    ob_temps: ['5~10분', '15~20분', '30분', '45분 이상'],
    ob_varie: '그때그때 달라요',
    ob_prenom_tag: '마지막 단계',
    ob_prenom: '이름이\n무엇인가요?',
    ob_prenom_sub: '프로그램이 프로필에 맞게 조정됩니다.\nFluidBody가 매일 함께합니다.',
    ob_placeholder: '이름...',
    ob_demarrer: '시작하기 →',
    ob_anon: '익명으로 입장',
    ob_auth_tag: 'FluidBody 계정',
    ob_auth_title: '프로필 저장',
    ob_auth_signup_title: '가입',
    ob_auth_signin_title: '로그인',
    ob_auth_sub: '이메일과 비밀번호로 클라우드에 진행 상황을 동기화합니다.',
    ob_auth_sub_signin: '진행 상황을 복원하려면 자격 증명을 입력하세요.',
    ob_email_ph: 'your@email.com',
    ob_pass_ph: '비밀번호 (최소 6자)',
    ob_auth_submit_up: '계정 만들기',
    ob_auth_submit_in: '로그인',
    ob_auth_toggle_in: '이미 계정이 있습니다 →',
    ob_auth_toggle_up: '계정이 없으신가요? 가입하기',
    ob_auth_skip: '클라우드 계정 없이 계속 →',
    ob_auth_err_short: '비밀번호는 최소 6자 이상이어야 합니다.',
    ob_auth_err_email: '유효한 이메일 주소를 입력하세요.',
    ob_auth_confirm: '확인이 필요한 경우 받은편지함을 확인한 후 다시 로그인하세요.',
    ob_auth_err_net: '네트워크 오류.',
    ob_auth_no_cloud: '이 버전에서는 클라우드 백업을 사용할 수 없습니다. 자격 증명은 서버에 저장되지 않습니다.',
    ob_auth_continue_local: '로컬로 계속 →',
    piliers: ['어깨', '등', '유연성', '자세', 'Eldoa', '골프', '매트 필라테스', '오피스'],
    etapes: { Comprendre: '이해하기', Ressentir: '느끼기', Préparer: '준비하기', Exécuter: '실행하기', Évoluer: '발전하기' },
    retour: '← 내 몸',
    seances_done: (n) => `${n} / 20 세션 완료`,
    m_seances: '세션', m_streak: '연속', m_progress: '진행',
    retour_video: '← 뒤로',
    video_resume: (t) => `이어보기 · ${t}`,
    reprise_badge: '이어보기',
    video_load_error: '동영상을 불러올 수 없습니다.',
    video_retry: '다시 시도',
    seance_done: '✓  세션 완료',
    biblio_titre: '라이브러리',
    biblio_sub: '이해하면 더 잘 느낄 수 있습니다',
    tab_piliers: '6개의 기둥',
    tab_methode: '방법론',
    tab_pour_vous: '추천',
    tab_explorer: '탐색',
    tab_programmes: '프로그램',
    tab_recherche: '\uD83D\uDD0D',
    explore_free_title: '이달의 무료 세션',
    explore_free_sub: '구독 없이 이 세션을 한 번 체험해보세요',
    explore_new: '새로운 추천 콘텐츠',
    prog_section_title: '맞춤형 프로그램',
    prog_section_sub: '흐름을 유지하거나 루틴을 강화하기 위한 프로그램.',
    prog_debuter: '시작하기',
    prog_debuter_sub: '어깨, 등, 유연성',
    prog_debuter_duree: '3일 · 하루 10분',
    prog_apercu: '프로그램 미리보기',
    prog_custom_title: '나만의 프로그램 만들기',
    prog_custom_sub: '활동을 선택하고 프로그램을 정의하세요.',
    prog_custom_card: '맞춤 프로그램',
    prog_custom_card_sub: '활동, 운동 시간, 요일, 속도를 자유롭게.',
    prog_custom_btn: '프로그램 만들기',
    prog_create_title: '프로그램 만들기',
    prog_select_piliers: '기둥 선택',
    prog_duree_label: '세션당 시간',
    prog_jours_label: '주당 일수',
    prog_save: '저장',
    prog_saved: '프로그램이 저장되었습니다!',
    prog_mes_programmes: '내 프로그램',
    prog_notif_days: '알림 요일', prog_notif_hour: '알림 시간', prog_notif_body: '세션 시간입니다',
    partage_title: '공유', partage_progression: '내 진행 상황 공유', partage_btn: '공유', partage_share_msg: 'FluidBody+ 필라테스 진행 상황', partage_inviter: '친구 초대', partage_invite_btn: 'SMS / 이메일로 초대', partage_invite_msg: 'FluidBody+ 필라테스에 함께하세요!', partage_en_attente: '대기 중', partage_invitation: '초대', partage_defis: '챌린지', partage_creer_defi: '챌린지 만들기', partage_choisir_pilier: '기둥 선택', partage_duree_defi: '기간', partage_lancer: '시작',
    profil_donnees_title: '개인정보', profil_donnees_desc: '데이터가 어떻게 관리되는지 알아보세요. 데이터는 기기에 저장됩니다. 개인 데이터가 제3자 서버로 전송되지 않습니다. 세션, 진행 상황, 설정은 로컬에 저장됩니다. 로그인 시 프로필 저장을 위해 이메일만 동기화됩니다.', profil_donnees_local: '데이터는 기기에 로컬 저장', profil_donnees_no_tracking: '광고 추적 없음', profil_donnees_healthkit: 'HealthKit: 읽기 전용, 공유 안 함',
    biblio_intro: 'FluidBody 방법론은 5개의 단계적 스텝에 기반합니다. 각 세션은 순서대로 진행됩니다.',
    lire: ' 읽기 시간',
    retour_biblio: '← 라이브러리',
    points_cles: '핵심 포인트',
    mon_parcours: '나의 여정',
    prog_globale: '전체 진행',
    par_pilier: '기둥별',
    parcours_langue: '언어',
    mon_compte: '내 계정',
    compte_info: [['앱', 'FluidBody · 필라테스'], ['버전', 'FluidBody Beta 1.0'], ['방법', '의식적 필라테스 · 30년']],
    progresser_sub: (p) => `여정의 ${p}% 완료`,
    recommande_pour_toi: '추천',
    seance_gratuite: '무료 세션',
    seance_du_jour_sub: '오늘의 추천',
    commencer_seance: '시작하기 →',
    deja_faite: '✓ 오늘 이미 완료',
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: '데모 세션이 기다리고 있습니다. 당신의 몸이 당신을 필요로 합니다.',
    notif_pause_title: '활동적 휴식 🪑', notif_pause_body: '움직일 시간입니다! 책상에서 5분 스트레칭.',
    coach_title: '당신의 코치', coach_name: 'Sabrina', coach_subtitle: '필라테스 전문가 · 30년 경험', coach_bio: '의식적인 움직임에 열정을 가지고, 더 자유롭고 강한 몸으로 안내합니다.', coach_more: '더 알아보기', coach_avec: 'Sabrina와 함께', coach_exp: '30년 경험', coach_quote: '"한 걸음씩, 더 자유로운 몸으로 안내합니다."',
    demo_limit: '나머지를 보려면 구독하세요',
    motivation: (streak) => streak === 0 ? '"오늘부터 시작하세요.\n당신의 몸이 기다리고 있습니다."' :
      streak < 3  ? `"${streak}일 연속. 계속하세요."` :
      streak < 7  ? `"${streak}일 연속!\n당신의 몸이 깨어나고 있습니다."` :
      streak < 14 ? `"${streak}일! 진정한 습관이\n만들어지고 있습니다."` :
      `"${streak}일. 당신은 대단합니다. ${U_WAVE}"`,
    celebration: '당신의 몸이 발전했습니다.\n계속 이대로! \uD83D\uDCAA',
    biblio_signature: '— FluidBody',
    premium_alert_title: '프리미엄 콘텐츠',
    premium_alert_simulate: '혜택 보기',
    premium_alert_later: '나중에',
    paywall_title: '모두를 위한 필라테스',
    paywall_sub: '30년 경력의 필라테스 전문가 Sabrina가 안내하는 160개 세션 무제한 이용',
    paywall_badge: '7일 무료',
    paywall_yearly_link: '99 CHF/년 · 35% 절약',
    paywall_monthly: '월간',
    paywall_yearly: '연간',
    paywall_buy_monthly: '월간 구매',
    paywall_buy_yearly: '연간 구매',
    paywall_restore: '구매 복원',
    paywall_close: '닫기',
    paywall_prices_loading: '가격 로딩 중…',
    paywall_not_available: '구매 불가 (Expo Go / 시뮬레이터).',
    paywall_start: '시작 — 7일 무료',
    paywall_per_month: '/월',
    paywall_price_detail: '이후 12.90 CHF/월 · 언제든 해지 가능',
    paywall_access: '모든 코스 즉시 이용 · 약정 없음',
    paywall_try_free: '무료 세션 체험',
    free_try_once: '이 에피소드를 한 번 무료로 체험',
    free_go: '시작합시다!',
    subscription_status_label: 'FluidBody+ 구독',
    subscription_status_active: '활성 — 모든 세션',
    subscription_status_free: '비활성',
    subscription_reset: '구매 복원',
  },
};

const ARTICLES = {
  fr: [
    { key: 'p1', titre: 'L\'épaule — l\'articulaire la plus libre', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'L\'épaule est l\'articulation la plus mobile du corps humain. Cette liberté extraordinaire a un prix : la stabilité ne vient pas de l\'os, mais entièrement des muscles.', corps: `La coiffe des rotateurs — quatre muscles profonds — est le vrai chef d'orchestre de chaque mouvement. Quand elle est faible ou mal activée, les tensions s'installent insidieusement dans les trapèzes, le cou, parfois jusqu'aux lombaires.\n\nLe problème n'est jamais là où ça fait mal.\n\nAvant de renforcer, il faut comprendre. Sentir comment l'omoplate glisse sur la cage thoracique. Ressentir le poids du bras se déposer dans l'articulation. Laisser la tête de l'humérus s'ancrer dans la glène.\n\nC'est depuis cette conscience que naît le mouvement juste — fluide, sans effort apparent, sans douleur.`, citation: 'L\'épaule libre, c\'est une épaule qui a appris à se poser avant de s\'élever.' },
    { key: 'p2', titre: 'Le dos — pourquoi ça souffre vraiment', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Huit personnes sur dix souffriront du dos à un moment de leur vie. Pourtant, la douleur est rarement là où le problème se trouve.', corps: `La colonne vertébrale est une architecture de génie : 33 vertèbres, des dizaines de muscles, des ligaments, des disques amortisseurs. Tout est conçu pour le mouvement — pas pour l'immobilité.\n\nLe vrai ennemi du dos, c'est la sédentarité. Rester assis des heures raccourcit le psoas, déséquilibre le bassin, écrase les disques.\n\nMais le dos répond extraordinairement bien quand on lui redonne de la conscience. Sentir la respiration gonfler les côtes postérieures. Percevoir l'espace entre chaque vertèbre.\n\nLe dos ne guérit pas par le repos. Il guérit par le mouvement conscient.`, citation: 'Un dos qui souffre est un dos qui demande à être entendu.' },
    { key: 'p3', titre: 'La mobilité — la jeunesse du corps', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'On ne vieillit pas d\'abord dans la peau, mais dans les articulations. La mobilité est la mesure la plus fidèle de la jeunesse corporelle.', corps: `La hanche est le centre de gravité du corps. Quand elle se bloque, tout compense : les lombaires, les genoux, les épaules.\n\nLa mobilité ne se confond pas avec la souplesse. On peut être souple sans être mobile. La mobilité, c'est la capacité à contrôler activement une amplitude de mouvement.\n\nC'est une compétence. Elle s'acquiert, se travaille, s'entretient. Et chaque degré de liberté retrouvé dans une articulation est une invitation à habiter le corps différemment.\n\nMobiliser, c'est rajeunir.`, citation: 'La liberté de mouvement n\'est pas un luxe. C\'est une nécessité vitale.' },
    { key: 'p4', titre: 'La posture — l\'empreinte de notre histoire', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'La posture raconte qui nous sommes — nos habitudes, nos émotions, notre rapport au monde. Changer sa posture, c\'est transformer bien plus que son corps.', corps: `Il n'existe pas une "bonne posture" figée. La meilleure posture est celle que vous quittez.\n\nPourtant, certains schémas créent de la souffrance : tête en avant, épaules enroulées, bassin basculé. Ces déséquilibres s'installent silencieusement sur des années.\n\nLa rééducation posturale commence par la perception. Sentir où est le poids dans les pieds. Percevoir la hauteur relative des hanches.\n\nLa posture juste émerge de l'intérieur — elle ne se plaque pas de l'extérieur.`, citation: 'Se tenir droit ne signifie pas se raidir. Ça signifie s\'aligner.' },
    { key: 'p5', titre: 'La respiration — le chef d\'orchestre oublié', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'On respire 20 000 fois par jour sans y penser. Et c\'est précisément le problème.', corps: `Le diaphragme est le muscle respiratoire principal. Quand il fonctionne pleinement, il masse les organes internes, stabilise la colonne, régule le système nerveux.\n\nMais la plupart d'entre nous respirons trop haut, trop vite, trop superficiellement.\n\nUne seule minute de respiration abdominale consciente peut diminuer le cortisol, ralentir le rythme cardiaque, libérer les tensions du bas du dos.\n\nApprendre à respirer — vraiment — c'est l'un des actes les plus transformateurs qu'on puisse poser pour son corps.`, citation: 'Dans chaque souffle conscient, le corps retrouve son chemin vers le calme.' },
    { key: 'p6', titre: 'La conscience corporelle — sentir pour bouger juste', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'La proprioception est le sens le moins connu — et pourtant le plus fondamental. C\'est grâce à elle qu\'on sait où est notre corps dans l\'espace.', corps: `Des milliers de récepteurs sensoriels dans les muscles, les tendons et les articulations envoient en permanence des informations au cerveau.\n\nQuand cette carte intérieure est précise, le mouvement est fluide, économe, sans effort inutile. Quand elle est floue, le corps compense, surmène certains muscles, en ignore d'autres.\n\nLa conscience corporelle se cultive. Par le mouvement lent. Par l'attention portée aux sensations. Par le travail en fermeture des yeux.\n\nSentir juste, c'est la condition du mouvement juste.`, citation: 'Le corps sait. Il faut juste apprendre à l\'écouter.' },
    { key: 'p7', titre: 'Le Mat Pilates — le sol comme fondation', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'Le Mat Pilates est la forme la plus pure de la méthode. Sans machine, sans accessoire — juste le corps, le sol, et la conscience.', corps: `Joseph Pilates l'appelait "Contrology" — l'art de contrôler le corps avec l'esprit. Le travail au sol en est l'expression la plus directe.\n\nSans le support du Reformer, le corps apprend à s'auto-stabiliser. Les muscles profonds — transverse de l'abdomen, multifides, plancher pelvien — deviennent les véritables acteurs du mouvement.\n\nChaque exercice au sol est une invitation à revenir à l'essentiel. Sentir le contact du dos sur le tapis. Percevoir la neutralité de la colonne. Activer le centre avant d'initier tout mouvement.\n\nLe Mat Pilates n'est pas une pratique "facile". C'est une pratique profonde, qui exige une conscience totale à chaque instant.`, citation: 'Le sol ne ment pas. Il révèle exactement où tu en es.' },
  ],
  en: [
    { key: 'p1', titre: 'The shoulder — the most free joint', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'The shoulder is the most mobile joint in the human body. This extraordinary freedom comes at a price: stability comes not from bone, but entirely from muscles.', corps: `The rotator cuff — four deep muscles — is the true conductor of every movement. When it is weak or poorly activated, tension insidiously settles in the trapezius, neck, sometimes down to the lower back.\n\nThe problem is never where it hurts.\n\nBefore strengthening, you must understand. Feel how the shoulder blade glides on the rib cage. Sense the weight of the arm settling into the joint.\n\nFrom this awareness, the right movement is born — fluid, effortless, pain-free.`, citation: 'A free shoulder is one that has learned to settle before it rises.' },
    { key: 'p2', titre: 'The back — why it really hurts', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Eight out of ten people will suffer from back pain at some point in their lives. Yet the pain is rarely where the problem lies.', corps: `The spine is a work of genius: 33 vertebrae, dozens of muscles, ligaments, shock-absorbing discs. Everything is designed for movement — not immobility.\n\nThe true enemy of the back is sedentary life. Sitting for hours shortens the psoas, imbalances the pelvis, crushes the discs.\n\nBut the back responds extraordinarily well when you restore awareness to it. Feel the breath inflate the posterior ribs. Perceive the space between each vertebra.\n\nThe back does not heal through rest. It heals through conscious movement.`, citation: 'A back in pain is a back asking to be heard.' },
    { key: 'p3', titre: 'Mobility — the youth of the body', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'We don\'t age first in our skin, but in our joints. Mobility is the most faithful measure of physical youth.', corps: `The hip is the body's center of gravity. When it locks up, everything compensates: the lower back, the knees, the shoulders.\n\nMobility is not the same as flexibility. You can be flexible without being mobile. Mobility is the ability to actively control a range of movement.\n\nIt is a skill. It is acquired, practiced, maintained. And every degree of freedom regained in a joint is an invitation to inhabit the body differently.\n\nTo mobilize is to rejuvenate.`, citation: 'Freedom of movement is not a luxury. It is a vital necessity.' },
    { key: 'p4', titre: 'Posture — the imprint of our history', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'Posture tells the story of who we are — our habits, emotions, relationship with the world. Changing your posture transforms far more than your body.', corps: `There is no single "correct posture". The best posture is the one you leave.\n\nYet certain patterns create suffering: head forward, rounded shoulders, tilted pelvis. These imbalances settle silently over years.\n\nPostural re-education begins with perception. Feel where the weight is in your feet. Sense the relative height of your hips.\n\nThe right posture emerges from within — it cannot be imposed from outside.`, citation: 'Standing tall doesn\'t mean stiffening up. It means aligning.' },
    { key: 'p5', titre: 'Breathing — the forgotten conductor', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'We breathe 20,000 times a day without thinking about it. And that is precisely the problem.', corps: `The diaphragm is the primary breathing muscle. When it works fully, it massages the internal organs, stabilizes the spine, regulates the nervous system.\n\nBut most of us breathe too high, too fast, too shallow.\n\nJust one minute of conscious abdominal breathing can lower cortisol, slow the heart rate, release lower back tension.\n\nLearning to breathe — truly — is one of the most transformative acts you can do for your body.`, citation: 'In every conscious breath, the body finds its way back to calm.' },
    { key: 'p6', titre: 'Body awareness — feel to move right', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'Proprioception is the least known sense — and yet the most fundamental. It is thanks to it that we know where our body is in space.', corps: `Thousands of sensory receptors in muscles, tendons and joints constantly send information to the brain.\n\nWhen this inner map is precise, movement is fluid, economical, effortless. When it is blurry, the body compensates, overworks some muscles, ignores others.\n\nBody awareness is cultivated. Through slow movement. Through attention to sensations. Through working with eyes closed.\n\nFeeling right is the condition for moving right.`, citation: 'The body knows. You just need to learn to listen to it.' },
    { key: 'p7', titre: 'Mat Pilates — the floor as foundation', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'Mat Pilates is the purest form of the method. No machine, no accessory — just the body, the floor, and awareness.', corps: `Joseph Pilates called it "Contrology" — the art of controlling the body with the mind. Floorwork is its most direct expression.\n\nWithout the support of the Reformer, the body learns to self-stabilize. The deep muscles — transverse abdominis, multifidus, pelvic floor — become the true actors of movement.\n\nEach mat exercise is an invitation to return to the essential. Feel the contact of the back on the mat. Perceive the neutrality of the spine.\n\nMat Pilates is not an "easy" practice. It is a deep practice, demanding total awareness at every moment.`, citation: 'The floor doesn\'t lie. It reveals exactly where you are.' },
  ],
  es: [
    { key: 'p1', titre: 'El hombro — la articulación más libre', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'El hombro es la articulación más móvil del cuerpo humano. Esta libertad extraordinaria tiene un precio: la estabilidad no viene del hueso, sino completamente de los músculos.', corps: `El manguito rotador — cuatro músculos profundos — es el verdadero director de cada movimiento. Cuando está débil o mal activado, las tensiones se instalan insidiosamente en los trapecios, el cuello, a veces hasta los lumbares.\n\nEl problema nunca está donde duele.\n\nAntes de fortalecer, hay que comprender. Sentir cómo el omóplato se desliza sobre la caja torácica.\n\nDesde esta conciencia nace el movimiento correcto — fluido, sin esfuerzo aparente, sin dolor.`, citation: 'Un hombro libre es uno que ha aprendido a posarse antes de elevarse.' },
    { key: 'p2', titre: 'La espalda — por qué realmente duele', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Ocho de cada diez personas sufrirán de dolor de espalda en algún momento de su vida. Sin embargo, el dolor rara vez está donde está el problema.', corps: `La columna vertebral es una obra maestra: 33 vértebras, decenas de músculos, ligamentos, discos amortiguadores. Todo está diseñado para el movimiento — no para la inmovilidad.\n\nEl verdadero enemigo de la espalda es el sedentarismo. Estar sentado horas acorta el psoas, desequilibra la pelvis, aplasta los discos.\n\nLa espalda no sana con el reposo. Sana con el movimiento consciente.`, citation: 'Una espalda que duele es una espalda que pide ser escuchada.' },
    { key: 'p3', titre: 'La movilidad — la juventud del cuerpo', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'No envejecemos primero en la piel, sino en las articulaciones. La movilidad es la medida más fiel de la juventud corporal.', corps: `La cadera es el centro de gravedad del cuerpo. Cuando se bloquea, todo compensa: los lumbares, las rodillas, los hombros.\n\nLa movilidad no se confunde con la flexibilidad. Puedes ser flexible sin ser móvil. La movilidad es la capacidad de controlar activamente un rango de movimiento.\n\nMovilizar es rejuvenecer.`, citation: 'La libertad de movimiento no es un lujo. Es una necesidad vital.' },
    { key: 'p4', titre: 'La postura — la huella de nuestra historia', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'La postura cuenta quiénes somos — nuestros hábitos, emociones, relación con el mundo. Cambiar la postura es transformar mucho más que el cuerpo.', corps: `No existe una "buena postura" fija. La mejor postura es la que abandonas.\n\nSin embargo, ciertos esquemas crean sufrimiento: cabeza adelantada, hombros encorvados, pelvis inclinada.\n\nLa postura correcta emerge desde adentro — no se impone desde afuera.`, citation: 'Mantenerse erguido no significa ponerse rígido. Significa alinearse.' },
    { key: 'p5', titre: 'La respiración — el director olvidado', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'Respiramos 20.000 veces al día sin pensarlo. Y ese es precisamente el problema.', corps: `El diafragma es el músculo respiratorio principal. Cuando funciona plenamente, masajea los órganos internos, estabiliza la columna, regula el sistema nervioso.\n\nAprender a respirar — de verdad — es uno de los actos más transformadores que puedes hacer por tu cuerpo.`, citation: 'En cada respiración consciente, el cuerpo encuentra su camino hacia la calma.' },
    { key: 'p6', titre: 'La conciencia corporal — sentir para moverse bien', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'La propiocepción es el sentido menos conocido — y sin embargo el más fundamental.', corps: `Miles de receptores sensoriales en músculos, tendones y articulaciones envían constantemente información al cerebro.\n\nLa conciencia corporal se cultiva. A través del movimiento lento. A través de la atención a las sensaciones.\n\nSentir bien es la condición para moverse bien.`, citation: 'El cuerpo sabe. Solo hay que aprender a escucharlo.' },
    { key: 'p7', titre: 'Mat Pilates — el suelo como fundación', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'El Mat Pilates es la forma más pura del método. Sin máquina, sin accesorio — solo el cuerpo, el suelo y la conciencia.', corps: `Joseph Pilates lo llamaba "Contrología" — el arte de controlar el cuerpo con la mente. El trabajo en suelo es su expresión más directa.\n\nSin el soporte del Reformer, el cuerpo aprende a autoestabilizarse. Los músculos profundos se convierten en los verdaderos actores del movimiento.\n\nEl Mat Pilates no es una práctica "fácil". Es una práctica profunda que exige total conciencia en cada instante.`, citation: 'El suelo no miente. Revela exactamente dónde estás.' },
  ],
  it: [
    { key: 'p1', titre: 'La spalla — l\'articolazione più libera', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'La spalla è l\'articolazione più mobile del corpo umano.', corps: `La cuffia dei rotatori — quattro muscoli profondi — è il vero direttore d'orchestra di ogni movimento.\n\nIl problema non è mai dove fa male.\n\nDa questa consapevolezza nasce il movimento giusto — fluido, senza sforzo apparente, senza dolore.`, citation: 'Una spalla libera è una spalla che ha imparato a posarsi prima di elevarsi.' },
    { key: 'p2', titre: 'La schiena — perché fa davvero male', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Otto persone su dieci soffriranno di mal di schiena a un certo punto della loro vita.', corps: `La schiena non guarisce con il riposo. Guarisce con il movimento consapevole.`, citation: 'Una schiena che soffre è una schiena che chiede di essere ascoltata.' },
    { key: 'p3', titre: 'La mobilità — la giovinezza del corpo', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'Non invecchiamo prima nella pelle, ma nelle articolazioni.', corps: `Mobilizzare è ringiovanire.`, citation: 'La libertà di movimento non è un lusso. È una necessità vitale.' },
    { key: 'p4', titre: 'La postura — l\'impronta della nostra storia', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'La postura racconta chi siamo.', corps: `La postura giusta emerge dall'interno — non si impone dall'esterno.`, citation: 'Stare dritti non significa irrigidirsi. Significa allinearsi.' },
    { key: 'p5', titre: 'La respirazione — il direttore dimenticato', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'Respiriamo 20.000 volte al giorno senza pensarci.', corps: `Imparare a respirare — davvero — è uno degli atti più trasformativi che si possano fare per il proprio corpo.`, citation: 'In ogni respiro consapevole, il corpo ritrova la sua strada verso la calma.' },
    { key: 'p6', titre: 'La consapevolezza corporea — sentire per muoversi bene', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'La propriocezione è il senso meno conosciuto — eppure il più fondamentale.', corps: `La consapevolezza corporea si coltiva. Attraverso il movimento lento.\n\nSentire bene è la condizione per muoversi bene.`, citation: 'Il corpo sa. Bisogna solo imparare ad ascoltarlo.' },
    { key: 'p7', titre: 'Mat Pilates — il pavimento come fondamento', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'Il Mat Pilates è la forma più pura del metodo. Senza macchine, senza accessori — solo il corpo, il pavimento e la consapevolezza.', corps: `Joseph Pilates lo chiamava "Contrologia" — l'arte di controllare il corpo con la mente. Il lavoro a terra ne è l'espressione più diretta.\n\nSenza il supporto del Reformer, il corpo impara ad auto-stabilizzarsi. I muscoli profondi diventano i veri protagonisti del movimento.\n\nIl Mat Pilates non è una pratica "facile". È una pratica profonda che richiede totale consapevolezza in ogni istante.`, citation: 'Il pavimento non mente. Rivela esattamente dove sei.' },
  ],
  de: [
    { key: 'p1', titre: 'Die Schulter — das freieste Gelenk', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'Die Schulter ist das beweglichste Gelenk des menschlichen Körpers. Diese außergewöhnliche Freiheit hat einen Preis: Stabilität kommt nicht vom Knochen, sondern vollständig von den Muskeln.', corps: `Die Rotatorenmanschette — vier tiefe Muskeln — ist der wahre Dirigent jeder Bewegung. Wenn sie schwach oder schlecht aktiviert ist, setzen sich Verspannungen schleichend im Trapezmuskel, Nacken und manchmal bis in den unteren Rücken fest.\n\nDas Problem ist nie dort, wo es schmerzt.\n\nBevor man stärkt, muss man verstehen. Spüren, wie das Schulterblatt über den Brustkorb gleitet.\n\nAus diesem Bewusstsein entsteht die richtige Bewegung — fließend, mühelos, schmerzfrei.`, citation: 'Eine freie Schulter ist eine, die gelernt hat, sich niederzulassen, bevor sie sich hebt.' },
    { key: 'p2', titre: 'Der Rücken — warum er wirklich schmerzt', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Acht von zehn Menschen werden irgendwann in ihrem Leben Rückenschmerzen haben. Doch der Schmerz ist selten dort, wo das Problem liegt.', corps: `Die Wirbelsäule ist ein Meisterwerk: 33 Wirbel, Dutzende Muskeln, Bänder, stoßdämpfende Bandscheiben. Alles ist für Bewegung gemacht — nicht für Stillstand.\n\nDer wahre Feind des Rückens ist das Sitzen. Stundenlanges Sitzen verkürzt den Psoas, bringt das Becken aus dem Gleichgewicht.\n\nDer Rücken heilt nicht durch Ruhe. Er heilt durch bewusste Bewegung.`, citation: 'Ein schmerzender Rücken ist ein Rücken, der gehört werden möchte.' },
    { key: 'p3', titre: 'Mobilität — die Jugend des Körpers', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'Wir altern nicht zuerst in der Haut, sondern in den Gelenken. Mobilität ist das treueste Maß körperlicher Jugend.', corps: `Die Hüfte ist der Schwerpunkt des Körpers. Wenn sie blockiert, kompensiert alles: der untere Rücken, die Knie, die Schultern.\n\nMobilität ist nicht dasselbe wie Flexibilität. Mobilisieren heißt verjüngen.`, citation: 'Bewegungsfreiheit ist kein Luxus. Sie ist eine lebenswichtige Notwendigkeit.' },
    { key: 'p4', titre: 'Haltung — der Abdruck unserer Geschichte', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'Die Haltung erzählt, wer wir sind — unsere Gewohnheiten, Emotionen, unsere Beziehung zur Welt.', corps: `Es gibt keine einzige "richtige Haltung". Die beste Haltung ist die, die man verlässt.\n\nDie richtige Haltung entsteht von innen — sie lässt sich nicht von außen aufzwingen.`, citation: 'Aufrecht stehen bedeutet nicht, sich zu versteifen. Es bedeutet, sich auszurichten.' },
    { key: 'p5', titre: 'Die Atmung — der vergessene Dirigent', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'Wir atmen 20.000 Mal am Tag, ohne darüber nachzudenken. Und genau das ist das Problem.', corps: `Das Zwerchfell ist der wichtigste Atemmuskel. Richtig atmen zu lernen — wirklich — ist einer der transformativsten Akte für den Körper.`, citation: 'In jedem bewussten Atemzug findet der Körper seinen Weg zur Ruhe.' },
    { key: 'p6', titre: 'Körperbewusstsein — spüren, um richtig zu bewegen', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'Propriozeption ist der am wenigsten bekannte Sinn — und doch der grundlegendste.', corps: `Körperbewusstsein wird kultiviert. Durch langsame Bewegung. Durch Aufmerksamkeit auf Empfindungen.\n\nRichtig spüren ist die Voraussetzung für richtige Bewegung.`, citation: 'Der Körper weiß. Man muss nur lernen, ihm zuzuhören.' },
    { key: 'p7', titre: 'Mat Pilates — der Boden als Fundament', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'Mat Pilates ist die reinste Form der Methode. Keine Maschine, kein Zubehör — nur der Körper, der Boden und das Bewusstsein.', corps: `Joseph Pilates nannte es "Contrology" — die Kunst, den Körper mit dem Geist zu kontrollieren. Die Bodenarbeit ist ihr direktester Ausdruck.\n\nMat Pilates ist keine "einfache" Praxis. Es ist eine tiefe Praxis, die in jedem Moment vollständige Bewusstheit verlangt.`, citation: 'Der Boden lügt nicht. Er zeigt genau, wo du stehst.' },
  ],
  pt: [
    { key: 'p1', titre: 'O ombro — a articulação mais livre', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'O ombro é a articulação mais móvel do corpo humano. Essa liberdade extraordinária tem um preço: a estabilidade vem não do osso, mas inteiramente dos músculos.', corps: `O manguito rotador — quatro músculos profundos — é o verdadeiro maestro de cada movimento. Quando está fraco ou mal ativado, as tensões se instalam nos trapézios, pescoço e às vezes até a lombar.\n\nO problema nunca está onde dói.\n\nAntes de fortalecer, é preciso entender. Sentir como a escápula desliza sobre a caixa torácica.\n\nDessa consciência nasce o movimento correto — fluido, sem esforço, sem dor.`, citation: 'Um ombro livre é um ombro que aprendeu a pousar antes de se elevar.' },
    { key: 'p2', titre: 'As costas — por que realmente dói', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Oito em cada dez pessoas terão dor nas costas em algum momento da vida. No entanto, a dor raramente está onde o problema se encontra.', corps: `A coluna vertebral é uma obra-prima: 33 vértebras, dezenas de músculos, ligamentos, discos amortecedores. Tudo é projetado para o movimento — não para a imobilidade.\n\nAs costas não curam com repouso. Curam com movimento consciente.`, citation: 'Uma coluna que dói é uma coluna que pede para ser ouvida.' },
    { key: 'p3', titre: 'Mobilidade — a juventude do corpo', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'Não envelhecemos primeiro na pele, mas nas articulações. A mobilidade é a medida mais fiel da juventude corporal.', corps: `O quadril é o centro de gravidade do corpo. Quando bloqueia, tudo compensa.\n\nMobilizar é rejuvenescer.`, citation: 'Liberdade de movimento não é luxo. É uma necessidade vital.' },
    { key: 'p4', titre: 'A postura — a marca da nossa história', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'A postura conta quem somos — nossos hábitos, emoções, relação com o mundo.', corps: `A postura correta emerge de dentro — não se impõe de fora.`, citation: 'Ficar ereto não significa enrijecer. Significa alinhar-se.' },
    { key: 'p5', titre: 'A respiração — o maestro esquecido', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'Respiramos 20.000 vezes por dia sem pensar. E esse é exatamente o problema.', corps: `Aprender a respirar — de verdade — é um dos atos mais transformadores que se pode fazer pelo corpo.`, citation: 'Em cada respiração consciente, o corpo encontra seu caminho para a calma.' },
    { key: 'p6', titre: 'Consciência corporal — sentir para se mover bem', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'A propriocepção é o sentido menos conhecido — e, no entanto, o mais fundamental.', corps: `A consciência corporal se cultiva. Através do movimento lento.\n\nSentir bem é a condição para se mover bem.`, citation: 'O corpo sabe. Basta aprender a ouvi-lo.' },
    { key: 'p7', titre: 'Mat Pilates — o chão como fundação', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'O Mat Pilates é a forma mais pura do método. Sem máquinas, sem acessórios — apenas o corpo, o chão e a consciência.', corps: `Joseph Pilates chamava de "Contrologia" — a arte de controlar o corpo com a mente. O trabalho no solo é sua expressão mais direta.\n\nO Mat Pilates não é uma prática "fácil". É uma prática profunda que exige consciência total em cada instante.`, citation: 'O chão não mente. Ele revela exatamente onde você está.' },
  ],
  zh: [
    { key: 'p1', titre: '肩膀 — 最自由的关节', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: '肩膀是人体最灵活的关节。这种非凡的自由是有代价的：稳定性不来自骨骼，而完全来自肌肉。', corps: `肩袖 — 四块深层肌肉 — 是每个动作的真正指挥者。当它虚弱或激活不良时，紧张会悄然蔓延到斜方肌、颈部，甚至腰部。\n\n问题从来不在疼痛的地方。\n\n在加强之前，必须先理解。感受肩胛骨如何在胸廓上滑动。\n\n从这种意识中，正确的动作诞生了 — 流畅、毫不费力、无痛。`, citation: '自由的肩膀是学会先安定再提升的肩膀。' },
    { key: 'p2', titre: '背部 — 为什么真的会痛', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: '十个人中有八个会在一生中某个时候经历背痛。然而，疼痛很少出现在问题所在的地方。', corps: `脊柱是一项杰作：33节椎骨、数十块肌肉、韧带、减震椎间盘。一切都是为运动设计的 — 而不是静止。\n\n背部不靠休息痊愈。它靠有意识的运动痊愈。`, citation: '疼痛的背部是一个请求被倾听的背部。' },
    { key: 'p3', titre: '灵活性 — 身体的青春', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: '我们不是先从皮肤开始衰老，而是从关节。灵活性是身体青春最忠实的衡量标准。', corps: `髋部是身体的重心。当它锁住时，一切都在代偿。\n\n活动就是重返青春。`, citation: '运动自由不是奢侈。它是生命的必需。' },
    { key: 'p4', titre: '姿势 — 我们历史的印记', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: '姿势讲述了我们是谁 — 我们的习惯、情感、与世界的关系。', corps: `正确的姿势从内在产生 — 不能从外部强加。`, citation: '站直不意味着僵硬。它意味着对齐。' },
    { key: 'p5', titre: '呼吸 — 被遗忘的指挥者', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: '我们每天呼吸20000次却不加思考。这恰恰就是问题所在。', corps: `学会真正地呼吸 — 是你能为身体做的最具变革性的行为之一。`, citation: '在每一次有意识的呼吸中，身体找到了通往平静的道路。' },
    { key: 'p6', titre: '身体意识 — 感受以正确运动', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: '本体感觉是最不为人知的感觉 — 却是最基本的。', corps: `身体意识需要培养。通过缓慢的运动。\n\n正确地感受是正确运动的前提。`, citation: '身体知道。你只需要学会倾听它。' },
    { key: 'p7', titre: '垫上普拉提 — 以地面为基础', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: '垫上普拉提是该方法最纯粹的形式。没有器械，没有配件 — 只有身体、地面和意识。', corps: `Joseph Pilates称其为"控制学" — 用心灵控制身体的艺术。地面训练是其最直接的表达。\n\n垫上普拉提不是一种"简单"的练习。它是一种深层练习，要求每时每刻的全面意识。`, citation: '地面不会撒谎。它准确地揭示你所处的位置。' },
  ],
  ja: [
    { key: 'p1', titre: '肩 — 最も自由な関節', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: '肩は人体で最も可動性の高い関節です。この並外れた自由には代償があります：安定性は骨からではなく、完全に筋肉から生まれます。', corps: `回旋筋腱板 — 4つの深層筋 — はすべての動きの真の指揮者です。弱かったり活性化が不十分だと、緊張は僧帽筋、首、時には腰まで忍び寄ります。\n\n問題は痛みのある場所にはありません。\n\n強化する前に理解すること。肩甲骨が胸郭の上を滑る感覚。\n\nこの意識から正しい動きが生まれます — 流れるように、無理なく、痛みなく。`, citation: '自由な肩とは、上がる前にまず落ち着くことを学んだ肩です。' },
    { key: 'p2', titre: '背中 — なぜ本当に痛むのか', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: '10人中8人が人生のどこかで背中の痛みに悩まされます。しかし、痛みの場所と問題の場所は違うことが多いのです。', corps: `脊柱は天才的な構造です：33の椎骨、数十の筋肉、靭帯、衝撃吸収椎間板。すべては動きのために設計されています。\n\n背中は安静では治りません。意識的な動きで治ります。`, citation: '痛む背中は、聞いてほしいと訴えている背中です。' },
    { key: 'p3', titre: 'モビリティ — 身体の若さ', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: '私たちは肌からではなく、関節から老化します。モビリティは身体の若さの最も忠実な指標です。', corps: `股関節は体の重心です。固まると、すべてが代償します。\n\n動かすことは若返ること。`, citation: '動きの自由は贅沢ではありません。生命の必需品です。' },
    { key: 'p4', titre: '姿勢 — 私たちの歴史の刻印', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: '姿勢は私たちが誰であるかを語ります — 習慣、感情、世界との関係。', corps: `正しい姿勢は内側から生まれます — 外側から押し付けることはできません。`, citation: 'まっすぐ立つとは、硬くなることではありません。整列することです。' },
    { key: 'p5', titre: '呼吸 — 忘れられた指揮者', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: '私たちは1日に2万回、考えずに呼吸しています。そして、まさにそれが問題なのです。', corps: `本当の呼吸を学ぶこと — それは身体のためにできる最も変革的な行為の一つです。`, citation: '意識的な一呼吸のたびに、身体は静けさへの道を見つけます。' },
    { key: 'p6', titre: '身体意識 — 正しく動くために感じる', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: '固有受容感覚は最も知られていない感覚 — しかし最も基本的な感覚です。', corps: `身体意識は育まれるものです。ゆっくりとした動きを通して。\n\n正しく感じることが、正しく動くための条件です。`, citation: '身体は知っている。ただ耳を傾けることを学ぶだけです。' },
    { key: 'p7', titre: 'マットピラティス — 床を基盤として', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'マットピラティスはメソッドの最も純粋な形です。マシンなし、器具なし — 身体と床と意識だけ。', corps: `ジョセフ・ピラティスはこれを「コントロロジー」と呼びました — 心で体をコントロールする技術。マット運動はその最も直接的な表現です。\n\nマットピラティスは「簡単な」実践ではありません。毎瞬間の完全な意識を要求する深い実践です。`, citation: '床は嘘をつきません。あなたが今どこにいるかを正確に明らかにします。' },
  ],
  ko: [
    { key: 'p1', titre: '어깨 — 가장 자유로운 관절', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: '어깨는 인체에서 가장 움직임이 많은 관절입니다. 이 놀라운 자유에는 대가가 있습니다: 안정성은 뼈가 아닌 근육에서 나옵니다.', corps: `회전근개 — 네 개의 심부 근육 — 는 모든 움직임의 진정한 지휘자입니다. 약하거나 제대로 활성화되지 않으면 긴장이 승모근, 목, 때로는 허리까지 은밀히 퍼집니다.\n\n문제는 아픈 곳에 있지 않습니다.\n\n강화하기 전에 이해해야 합니다. 견갑골이 흉곽 위로 미끄러지는 느낌.\n\n이 인식에서 올바른 움직임이 탄생합니다 — 유연하게, 힘들이지 않고, 통증 없이.`, citation: '자유로운 어깨는 올라가기 전에 먼저 안정되는 법을 배운 어깨입니다.' },
    { key: 'p2', titre: '등 — 왜 정말 아픈가', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: '10명 중 8명이 살면서 한 번은 허리 통증을 겪습니다. 하지만 통증이 있는 곳이 문제가 있는 곳은 아닙니다.', corps: `척추는 걸작입니다: 33개의 척추뼈, 수십 개의 근육, 인대, 충격 흡수 디스크.\n\n등은 휴식으로 낫지 않습니다. 의식적인 움직임으로 낫습니다.`, citation: '아픈 등은 들어달라고 요청하는 등입니다.' },
    { key: 'p3', titre: '유연성 — 몸의 젊음', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: '우리는 피부가 아닌 관절에서 먼저 노화합니다. 유연성은 신체 젊음의 가장 정확한 척도입니다.', corps: `골반은 몸의 무게 중심입니다. 막히면 모든 것이 보상합니다.\n\n움직이는 것이 젊어지는 것입니다.`, citation: '움직임의 자유는 사치가 아닙니다. 생명의 필수입니다.' },
    { key: 'p4', titre: '자세 — 우리 역사의 흔적', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: '자세는 우리가 누구인지를 말합니다 — 습관, 감정, 세상과의 관계.', corps: `올바른 자세는 내면에서 나옵니다 — 외부에서 강요할 수 없습니다.`, citation: '곧게 서는 것은 뻣뻣해지는 것이 아닙니다. 정렬하는 것입니다.' },
    { key: 'p5', titre: '호흡 — 잊혀진 지휘자', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: '우리는 하루에 2만 번 생각 없이 숨을 쉽니다. 바로 그것이 문제입니다.', corps: `진정으로 호흡하는 법을 배우는 것 — 그것은 몸을 위해 할 수 있는 가장 변혁적인 행위 중 하나입니다.`, citation: '의식적인 호흡 하나하나에서 몸은 평온으로 가는 길을 찾습니다.' },
    { key: 'p6', titre: '신체 인식 — 올바르게 움직이기 위해 느끼기', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: '고유수용감각은 가장 잘 알려지지 않은 감각이지만, 가장 근본적인 감각입니다.', corps: `신체 인식은 배양됩니다. 느린 움직임을 통해.\n\n올바르게 느끼는 것이 올바르게 움직이기 위한 조건입니다.`, citation: '몸은 알고 있습니다. 단지 귀 기울이는 법을 배우면 됩니다.' },
    { key: 'p7', titre: '매트 필라테스 — 바닥을 기반으로', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: '매트 필라테스는 이 방법의 가장 순수한 형태입니다. 기계도 도구도 없이 — 몸, 바닥, 그리고 인식만으로.', corps: `조셉 필라테스는 이것을 "컨트롤로지"라고 불렀습니다 — 마음으로 몸을 제어하는 기술. 바닥 운동은 그 가장 직접적인 표현입니다.\n\n매트 필라테스는 "쉬운" 수련이 아닙니다. 매 순간 완전한 인식을 요구하는 깊은 수련입니다.`, citation: '바닥은 거짓말을 하지 않습니다. 당신이 어디에 있는지 정확히 보여줍니다.' },
  ],
};

const FICHES = {
  fr: [
    { etape: 'Comprendre', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Savoir ce qu\'on fait et pourquoi', description: 'Avant de bouger, comprendre. Quelle articulation travaille ? Quel muscle s\'active ? La compréhension anatomique transforme un exercice mécanique en acte conscient.', points: ['Nommer ce qu\'on ressent', 'Comprendre la mécanique articulaire', 'Identifier les compensations habituelles', 'Visualiser le mouvement avant de le faire'] },
    { etape: 'Ressentir', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Développer la carte intérieure', description: 'Fermer les yeux. Écouter. Où est la tension ? Où est le relâchement ? Le ressenti précède toujours le mouvement juste.', points: ['Scanner le corps sans jugement', 'Distinguer tension utile et tension parasite', 'Sentir les asymétries gauche/droite', 'Habiter chaque partie du corps tour à tour'] },
    { etape: 'Préparer', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Activer avant de performer', description: 'Le corps ne passe pas de 0 à 100. La préparation éveille les stabilisateurs profonds, chauffe les articulations, active les connexions neuromusculaires.', points: ['Mobiliser les articulations concernées', 'Activer les muscles stabilisateurs', 'Établir le pattern respiratoire', 'Centrer l\'attention sur la zone de travail'] },
    { etape: 'Exécuter', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'Le geste juste, pas le geste fort', description: 'L\'exécution dans la méthode FluidBody n\'est jamais brutale. La qualité prime sur la quantité. Un mouvement lent, précis, respiré, a cent fois plus de valeur.', points: ['Maintenir la conscience pendant l\'effort', 'Respirer — ne jamais bloquer le souffle', 'Travailler en amplitude contrôlée', 'Sentir le muscle cible, pas les compensations'] },
    { etape: 'Évoluer', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progresser sans se perdre', description: 'L\'évolution n\'est pas une course. C\'est une spirale ascendante — on revient aux mêmes gestes, mais avec une conscience plus fine, une capacité plus grande.', points: ['Augmenter l\'amplitude avant la charge', 'Intégrer le mouvement au quotidien', 'Mesurer le progrès par la qualité', 'Revenir aux bases pour mieux avancer'] },
  ],
  en: [
    { etape: 'Understand', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Know what you\'re doing and why', description: 'Before moving, understand. Which joint is working? Which muscle is activating? Anatomical understanding transforms a mechanical exercise into a conscious act.', points: ['Name what you feel', 'Understand joint mechanics', 'Identify habitual compensations', 'Visualize the movement before doing it'] },
    { etape: 'Feel', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Develop your inner map', description: 'Close your eyes. Listen. Where is the tension? Where is the release? Feeling always precedes the right movement.', points: ['Scan the body without judgment', 'Distinguish useful tension from parasitic tension', 'Feel left/right asymmetries', 'Inhabit each part of the body in turn'] },
    { etape: 'Prepare', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Activate before performing', description: 'The body doesn\'t go from 0 to 100. Preparation awakens deep stabilizers, warms the joints, activates neuromuscular connections.', points: ['Mobilize the relevant joints', 'Activate stabilizer muscles', 'Establish breathing pattern', 'Center attention on the work area'] },
    { etape: 'Execute', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'The right gesture, not the strong one', description: 'Execution in the FluidBody method is never brutal. Quality trumps quantity. A slow, precise, breathing movement has a hundred times more value.', points: ['Maintain awareness during effort', 'Breathe — never hold your breath', 'Work in controlled range', 'Feel the target muscle, not compensations'] },
    { etape: 'Evolve', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progress without getting lost', description: 'Evolution is not a race. It is an upward spiral — we return to the same movements, but with finer awareness, greater capacity.', points: ['Increase range before load', 'Integrate movement into daily life', 'Measure progress by quality', 'Return to basics to move forward better'] },
  ],
  es: [
    { etape: 'Comprender', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Saber qué hacemos y por qué', description: 'Antes de moverse, comprender. ¿Qué articulación trabaja? ¿Qué músculo se activa?', points: ['Nombrar lo que se siente', 'Comprender la mecánica articular', 'Identificar las compensaciones habituales', 'Visualizar el movimiento antes de hacerlo'] },
    { etape: 'Sentir', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Desarrollar el mapa interior', description: 'Cerrar los ojos. Escuchar. ¿Dónde está la tensión?', points: ['Escanear el cuerpo sin juicio', 'Distinguir tensión útil de tensión parásita', 'Sentir las asimetrías izquierda/derecha', 'Habitar cada parte del cuerpo por turno'] },
    { etape: 'Preparar', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Activar antes de rendir', description: 'El cuerpo no pasa de 0 a 100. La preparación despierta los estabilizadores profundos.', points: ['Movilizar las articulaciones implicadas', 'Activar los músculos estabilizadores', 'Establecer el patrón respiratorio', 'Centrar la atención en la zona de trabajo'] },
    { etape: 'Ejecutar', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'El gesto correcto, no el forzado', description: 'La ejecución en el método FluidBody nunca es brusca. La calidad prima sobre la cantidad.', points: ['Mantener la conciencia durante el esfuerzo', 'Respirar — nunca bloquear el aliento', 'Trabajar en amplitud controlada', 'Sentir el músculo objetivo, no las compensaciones'] },
    { etape: 'Evolucionar', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progresar sin perderse', description: 'La evolución no es una carrera. Es una espiral ascendente.', points: ['Aumentar la amplitud antes de la carga', 'Integrar el movimiento en la vida diaria', 'Medir el progreso por la calidad', 'Volver a lo básico para avanzar mejor'] },
  ],
  it: [
    { etape: 'Capire', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Sapere cosa si fa e perché', description: 'Prima di muoversi, capire.', points: ['Nominare ciò che si sente', 'Capire la meccanica articolare', 'Identificare le compensazioni abituali', 'Visualizzare il movimento prima di farlo'] },
    { etape: 'Sentire', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Sviluppare la mappa interiore', description: 'Chiudere gli occhi. Ascoltare.', points: ['Scansionare il corpo senza giudizio', 'Distinguere tensione utile da tensione parassita', 'Sentire le asimmetrie sinistra/destra', 'Abitare ogni parte del corpo a turno'] },
    { etape: 'Preparare', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Attivare prima di performare', description: 'Il corpo non passa da 0 a 100.', points: ['Mobilizzare le articolazioni coinvolte', 'Attivare i muscoli stabilizzatori', 'Stabilire il pattern respiratorio', 'Centrare l\'attenzione sulla zona di lavoro'] },
    { etape: 'Eseguire', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'Il gesto giusto, non quello forte', description: 'L\'esecuzione nel metodo FluidBody non è mai brusca.', points: ['Mantenere la consapevolezza durante lo sforzo', 'Respirare — non bloccare mai il respiro', 'Lavorare in ampiezza controllata', 'Sentire il muscolo bersaglio, non le compensazioni'] },
    { etape: 'Evolvere', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progredire senza perdersi', description: 'L\'evoluzione non è una corsa.', points: ['Aumentare l\'ampiezza prima del carico', 'Integrare il movimento nella vita quotidiana', 'Misurare il progresso dalla qualità', 'Tornare alle basi per andare avanti meglio'] },
  ],
  de: [
    { etape: 'Verstehen', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Wissen, was man tut und warum', description: 'Bevor man sich bewegt, verstehen. Welches Gelenk arbeitet? Welcher Muskel wird aktiviert?', points: ['Benennen, was man spürt', 'Die Gelenkmechanik verstehen', 'Gewohnheitskompensationen erkennen', 'Die Bewegung visualisieren, bevor man sie ausführt'] },
    { etape: 'Spüren', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Die innere Landkarte entwickeln', description: 'Augen schließen. Lauschen. Wo ist die Spannung?', points: ['Den Körper ohne Urteil scannen', 'Nützliche von parasitärer Spannung unterscheiden', 'Links/Rechts-Asymmetrien spüren', 'Jeden Körperteil nacheinander bewohnen'] },
    { etape: 'Vorbereiten', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Aktivieren vor dem Ausführen', description: 'Der Körper geht nicht von 0 auf 100. Vorbereitung weckt die tiefen Stabilisatoren.', points: ['Die betroffenen Gelenke mobilisieren', 'Stabilisierungsmuskeln aktivieren', 'Das Atemmuster etablieren', 'Die Aufmerksamkeit auf den Arbeitsbereich zentrieren'] },
    { etape: 'Ausführen', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'Die richtige Geste, nicht die kräftige', description: 'Ausführung in der FluidBody-Methode ist nie brutal. Qualität vor Quantität.', points: ['Bewusstsein während der Anstrengung beibehalten', 'Atmen — nie den Atem anhalten', 'In kontrolliertem Bewegungsumfang arbeiten', 'Den Zielmuskel spüren, nicht die Kompensationen'] },
    { etape: 'Weiterentwickeln', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Fortschreiten ohne sich zu verlieren', description: 'Entwicklung ist kein Rennen. Es ist eine aufsteigende Spirale.', points: ['Bewegungsumfang vor Belastung steigern', 'Bewegung in den Alltag integrieren', 'Fortschritt an der Qualität messen', 'Zu den Grundlagen zurückkehren, um besser voranzukommen'] },
  ],
  pt: [
    { etape: 'Compreender', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Saber o que se faz e por quê', description: 'Antes de se mover, compreender. Qual articulação trabalha? Qual músculo se ativa?', points: ['Nomear o que se sente', 'Compreender a mecânica articular', 'Identificar compensações habituais', 'Visualizar o movimento antes de fazê-lo'] },
    { etape: 'Sentir', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Desenvolver o mapa interior', description: 'Fechar os olhos. Ouvir. Onde está a tensão?', points: ['Escanear o corpo sem julgamento', 'Distinguir tensão útil de tensão parasita', 'Sentir assimetrias esquerda/direita', 'Habitar cada parte do corpo por vez'] },
    { etape: 'Preparar', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Ativar antes de performar', description: 'O corpo não passa de 0 a 100. A preparação desperta os estabilizadores profundos.', points: ['Mobilizar as articulações envolvidas', 'Ativar os músculos estabilizadores', 'Estabelecer o padrão respiratório', 'Centrar a atenção na área de trabalho'] },
    { etape: 'Executar', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'O gesto certo, não o forçado', description: 'A execução no método FluidBody nunca é brusca. Qualidade acima de quantidade.', points: ['Manter a consciência durante o esforço', 'Respirar — nunca prender a respiração', 'Trabalhar em amplitude controlada', 'Sentir o músculo-alvo, não as compensações'] },
    { etape: 'Evoluir', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progredir sem se perder', description: 'Evolução não é uma corrida. É uma espiral ascendente.', points: ['Aumentar a amplitude antes da carga', 'Integrar o movimento no dia a dia', 'Medir o progresso pela qualidade', 'Voltar ao básico para avançar melhor'] },
  ],
  zh: [
    { etape: '理解', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: '知道做什么以及为什么', description: '在运动之前，先理解。哪个关节在工作？哪块肌肉在激活？', points: ['命名你的感受', '理解关节力学', '识别习惯性代偿', '在做动作前先想象它'] },
    { etape: '感受', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: '发展内在地图', description: '闭上眼睛。倾听。哪里有紧张？', points: ['不带评判地扫描身体', '区分有用的紧张和多余的紧张', '感受左右不对称', '依次感知身体的每个部位'] },
    { etape: '准备', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: '先激活再执行', description: '身体不会从0直接到100。准备唤醒深层稳定肌。', points: ['活动相关关节', '激活稳定肌群', '建立呼吸模式', '将注意力集中在工作区域'] },
    { etape: '执行', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: '正确的动作，而非用力的动作', description: 'FluidBody方法中的执行从不粗暴。质量优于数量。', points: ['在用力时保持意识', '呼吸 — 永远不要屏住呼吸', '在可控幅度内工作', '感受目标肌肉，而非代偿'] },
    { etape: '进阶', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: '进步而不迷失', description: '进化不是竞赛。它是一个上升的螺旋。', points: ['先增加幅度再增加负荷', '将运动融入日常生活', '以质量衡量进步', '回归基础以更好地前进'] },
  ],
  ja: [
    { etape: '理解する', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: '何をなぜ行うのかを知る', description: '動く前にまず理解する。どの関節が働く？どの筋肉が活性化する？', points: ['感じることに名前をつける', '関節の仕組みを理解する', '習慣的な代償を見つける', '動く前に動きをイメージする'] },
    { etape: '感じる', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: '内なる地図を育てる', description: '目を閉じる。耳を澄ます。どこに緊張がある？', points: ['判断せずに身体をスキャンする', '有用な緊張と不要な緊張を区別する', '左右の非対称を感じる', '身体の各部位を順に意識する'] },
    { etape: '準備する', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: '実行する前に活性化する', description: '身体は0から100には行けません。準備が深層安定筋を目覚めさせます。', points: ['関連する関節を動かす', '安定筋を活性化する', '呼吸パターンを確立する', '作業領域に注意を集中する'] },
    { etape: '実行する', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: '正しい動き、力任せではなく', description: 'FluidBodyメソッドの実行は決して乱暴ではありません。量より質。', points: ['努力中も意識を保つ', '呼吸する — 息を止めない', 'コントロールされた範囲で動く', '代償ではなくターゲット筋を感じる'] },
    { etape: '進化する', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: '迷わずに進歩する', description: '進化はレースではありません。上昇する螺旋です。', points: ['負荷の前に可動域を広げる', '日常生活に動きを取り入れる', '質で進歩を測る', 'より良く進むために基本に戻る'] },
  ],
  ko: [
    { etape: '이해하기', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: '무엇을 왜 하는지 알기', description: '움직이기 전에 이해하기. 어떤 관절이 작동하는가? 어떤 근육이 활성화되는가?', points: ['느끼는 것에 이름 붙이기', '관절 역학 이해하기', '습관적 보상 패턴 파악하기', '동작 전에 움직임 시각화하기'] },
    { etape: '느끼기', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: '내면의 지도 개발하기', description: '눈을 감으세요. 귀를 기울이세요. 어디에 긴장이 있나요?', points: ['판단 없이 몸을 스캔하기', '유용한 긴장과 불필요한 긴장 구분하기', '좌우 비대칭 느끼기', '몸의 각 부위를 차례로 의식하기'] },
    { etape: '준비하기', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: '실행 전에 활성화하기', description: '몸은 0에서 100으로 갈 수 없습니다. 준비가 깊은 안정근을 깨웁니다.', points: ['관련 관절 동원하기', '안정근 활성화하기', '호흡 패턴 확립하기', '작업 영역에 주의 집중하기'] },
    { etape: '실행하기', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: '올바른 동작, 강한 동작이 아닌', description: 'FluidBody 방법의 실행은 결코 거칠지 않습니다. 양보다 질.', points: ['노력 중에도 인식 유지하기', '호흡하기 — 숨을 참지 않기', '제어된 범위에서 작업하기', '보상이 아닌 목표 근육 느끼기'] },
    { etape: '발전하기', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: '길을 잃지 않고 진보하기', description: '진화는 경주가 아닙니다. 상승하는 나선입니다.', points: ['부하 전에 가동 범위 늘리기', '일상에 움직임 통합하기', '질로 진행 상황 측정하기', '더 나아가기 위해 기본으로 돌아가기'] },
  ],
};

const SEANCES_FR = {
  p1: [['Comprendre l\'épaule', '12 min', 'Comprendre'], ['La coiffe des rotateurs', '15 min', 'Comprendre'], ['Ressentir les omoplates', '12 min', 'Ressentir'], ['Le poids du bras', '15 min', 'Ressentir'], ['Cercles de conscience', '18 min', 'Ressentir'], ['Libérer les trapèzes', '20 min', 'Préparer'], ['Mobiliser la scapula', '22 min', 'Préparer'], ['Activer le dentelé', '25 min', 'Préparer'], ['Ouverture thoracique', '28 min', 'Préparer'], ['Proprioception épaule', '30 min', 'Préparer'], ['Le geste juste', '25 min', 'Exécuter'], ['Élévation consciente', '28 min', 'Exécuter'], ['Rotation externe guidée', '30 min', 'Exécuter'], ['Tirés et poussés', '32 min', 'Exécuter'], ['Circuit épaule complète', '35 min', 'Exécuter'], ['Force & souplesse I', '35 min', 'Évoluer'], ['Épaule sous charge', '38 min', 'Évoluer'], ['Équilibre scapulaire', '40 min', 'Évoluer'], ['L\'épaule athlétique', '42 min', 'Évoluer'], ['Maîtrise totale', '45 min', 'Évoluer']],
  p2: [['Le dos expliqué', '12 min', 'Comprendre'], ['Pourquoi le dos souffre', '15 min', 'Comprendre'], ['La nuque et ses tensions', '15 min', 'Comprendre'], ['Ressentir sa colonne', '12 min', 'Ressentir'], ['Le sacrum comme base', '18 min', 'Ressentir'], ['Relâcher le psoas', '20 min', 'Préparer'], ['Décompression lombaire', '22 min', 'Préparer'], ['Mobiliser les thoraciques', '25 min', 'Préparer'], ['Cat-Cow conscient', '20 min', 'Préparer'], ['Libérer la nuque', '22 min', 'Préparer'], ['Renforcement profond I', '25 min', 'Exécuter'], ['La planche consciente', '28 min', 'Exécuter'], ['Pont fessier guidé', '28 min', 'Exécuter'], ['Rotation vertébrale', '30 min', 'Exécuter'], ['Extension du dos', '32 min', 'Exécuter'], ['Programme anti-douleur I', '30 min', 'Évoluer'], ['Programme anti-douleur II', '35 min', 'Évoluer'], ['Dos & respiration', '38 min', 'Évoluer'], ['Colonne intégrée', '40 min', 'Évoluer'], ['La colonne parfaite', '45 min', 'Évoluer']],
  p3: [['Comprendre la hanche', '2 min 10 s', 'Comprendre', 'https://vz-1a4e2cac-0dc.b-cdn.net/596e732b-fa75-4606-aa8a-45fb034d2e0b/playlist.m3u8'], ['Le genou fragile', '15 min', 'Comprendre'], ['La cheville oubliée', '12 min', 'Comprendre'], ['Ressentir la hanche', '15 min', 'Ressentir'], ['Cartographie bas du corps', '20 min', 'Ressentir'], ['Mobilisation de hanche I', '20 min', 'Préparer'], ['Libération des fléchisseurs', '22 min', 'Préparer'], ['Mobilisation de hanche II', '25 min', 'Préparer'], ['Mobilité du genou', '20 min', 'Préparer'], ['La cheville en action', '22 min', 'Préparer'], ['Squat conscient I', '25 min', 'Exécuter'], ['Fente guidée', '28 min', 'Exécuter'], ['Pont et rotation de hanche', '28 min', 'Exécuter'], ['Station unipodale', '30 min', 'Exécuter'], ['Circuit mobilité', '32 min', 'Exécuter'], ['Mobilité & Pilates I', '30 min', 'Évoluer'], ['Profondeur de hanche', '35 min', 'Évoluer'], ['Genoux & force', '38 min', 'Évoluer'], ['La chaîne postérieure', '40 min', 'Évoluer'], ['Corps libre en bas', '45 min', 'Évoluer']],
  p4: [['La posture expliquée', '12 min', 'Comprendre'], ['Les 4 courbes naturelles', '15 min', 'Comprendre'], ['Posture & douleur', '15 min', 'Comprendre'], ['Ressentir l\'alignement', '12 min', 'Ressentir'], ['L\'axe vertical', '18 min', 'Ressentir'], ['Débloquer la cage thoracique', '20 min', 'Préparer'], ['Activer les stabilisateurs', '22 min', 'Préparer'], ['Rééquilibrer le bassin', '25 min', 'Préparer'], ['Aligner le cou', '22 min', 'Préparer'], ['Proprioception posturale', '25 min', 'Préparer'], ['Debout conscient', '25 min', 'Exécuter'], ['Marche consciente', '28 min', 'Exécuter'], ['Assis sans souffrir', '25 min', 'Exécuter'], ['Travail en miroir', '30 min', 'Exécuter'], ['Posture sous charge', '32 min', 'Exécuter'], ['Programme bureau I', '25 min', 'Évoluer'], ['Programme bureau II', '30 min', 'Évoluer'], ['Posture & respiration', '35 min', 'Évoluer'], ['Corps en équilibre', '40 min', 'Évoluer'], ['L\'alignement parfait', '45 min', 'Évoluer']],
  p5: [['Comprendre le souffle', '12 min', 'Comprendre'], ['Le diaphragme', '15 min', 'Comprendre'], ['Respiration & nerfs', '15 min', 'Comprendre'], ['Ressentir son souffle', '10 min', 'Ressentir'], ['Le souffle tridimensionnel', '15 min', 'Ressentir'], ['Cohérence cardiaque I', '12 min', 'Préparer'], ['Libérer le diaphragme', '15 min', 'Préparer'], ['Respiration latérale', '18 min', 'Préparer'], ['Respiration dorsale', '20 min', 'Préparer'], ['Plancher pelvien', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Souffle & mouvement', '25 min', 'Exécuter'], ['Cohérence cardiaque II', '20 min', 'Exécuter'], ['Souffle & gainage', '28 min', 'Exécuter'], ['Séquence souffle complet', '30 min', 'Exécuter'], ['Techniques avancées I', '25 min', 'Évoluer'], ['Souffle & performance', '30 min', 'Évoluer'], ['Respiration & émotions', '32 min', 'Évoluer'], ['Anti-stress respiratoire', '35 min', 'Évoluer'], ['Maître du souffle', '40 min', 'Évoluer']],
  p6: [['Qu\'est-ce que la proprioception', '12 min', 'Comprendre'], ['Le corps dans l\'espace', '15 min', 'Comprendre'], ['Conscience & douleur', '15 min', 'Comprendre'], ['Le scan corporel I', '12 min', 'Ressentir'], ['Sentir sans voir', '15 min', 'Ressentir'], ['Équilibre statique I', '15 min', 'Préparer'], ['Micro-mouvements', '18 min', 'Préparer'], ['Équilibre instable', '20 min', 'Préparer'], ['Le regard intérieur', '22 min', 'Préparer'], ['Mapping corporel', '25 min', 'Préparer'], ['Mouvement lent I', '20 min', 'Exécuter'], ['Coordination fine', '25 min', 'Exécuter'], ['Anticipation & réaction', '28 min', 'Exécuter'], ['Mouvement lent II', '30 min', 'Exécuter'], ['Fluidité consciente', '32 min', 'Exécuter'], ['Méditation en mouvement', '25 min', 'Évoluer'], ['Inversion consciente', '30 min', 'Évoluer'], ['Conscience des fascias', '35 min', 'Évoluer'], ['Intelligence corporelle', '38 min', 'Évoluer'], ['L\'être dans le corps', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & sa méthode', '12 min', 'Comprendre'], ['Les 6 principes du Mat', '15 min', 'Comprendre'], ['Le centre — powerhouse', '15 min', 'Comprendre'], ['Sentir le tapis sous soi', '12 min', 'Ressentir'], ['Connexion bassin-plancher', '15 min', 'Ressentir'], ['Le Hundred — initiation', '20 min', 'Préparer'], ['Roll-Up conscient', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Activation du centre', '22 min', 'Préparer'], ['La série des 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Séquence Mat niveau 1', '35 min', 'Évoluer'], ['Séquence Mat niveau 2', '38 min', 'Évoluer'], ['Teaser guidé', '40 min', 'Évoluer'], ['Mat flow complet', '42 min', 'Évoluer'], ['Maîtrise du Mat', '45 min', 'Évoluer']],
  p8: [['Pourquoi le bureau fatigue', '5 min', 'Comprendre'], ['Nuque & écrans — le vrai danger', '5 min', 'Comprendre'], ['Assis toute la journée — conséquences', '6 min', 'Comprendre'], ['Ressentir ses tensions assises', '5 min', 'Ressentir'], ['Scan corporel sur chaise', '7 min', 'Ressentir'], ['Étirements nuque assis', '5 min', 'Préparer'], ['Poignets & avant-bras — clavier', '6 min', 'Préparer'], ['Épaules au bureau — relâcher', '7 min', 'Préparer'], ['Dos assis — décompression', '8 min', 'Préparer'], ['Hanches assises — libérer', '7 min', 'Préparer'], ['Respiration anti-stress au bureau', '5 min', 'Exécuter'], ['Rotation thoracique sur chaise', '6 min', 'Exécuter'], ['Micro-pause active — 3 min', '3 min', 'Exécuter'], ['Renforcement postural assis', '8 min', 'Exécuter'], ['Circuit bureau express', '10 min', 'Exécuter'], ['Pause active complète I', '8 min', 'Évoluer'], ['Pause active complète II', '10 min', 'Évoluer'], ['Anti-fatigue écran & nuque', '7 min', 'Évoluer'], ['Routine matin au bureau', '8 min', 'Évoluer'], ['Journée sans douleur — protocole', '10 min', 'Évoluer']],
};

const SEANCES_EN = {
  p1: [['Understanding the shoulder', '12 min', 'Comprendre'], ['The rotator cuff', '15 min', 'Comprendre'], ['Feeling the shoulder blades', '12 min', 'Ressentir'], ['The weight of the arm', '15 min', 'Ressentir'], ['Awareness circles', '18 min', 'Ressentir'], ['Releasing the trapezius', '20 min', 'Préparer'], ['Mobilizing the scapula', '22 min', 'Préparer'], ['Activating the serratus', '25 min', 'Préparer'], ['Thoracic opening', '28 min', 'Préparer'], ['Shoulder proprioception', '30 min', 'Préparer'], ['The right gesture', '25 min', 'Exécuter'], ['Conscious elevation', '28 min', 'Exécuter'], ['Guided external rotation', '30 min', 'Exécuter'], ['Pulls and pushes', '32 min', 'Exécuter'], ['Full shoulder circuit', '35 min', 'Exécuter'], ['Strength & flexibility I', '35 min', 'Évoluer'], ['Loaded shoulder', '38 min', 'Évoluer'], ['Scapular balance', '40 min', 'Évoluer'], ['The athletic shoulder', '42 min', 'Évoluer'], ['Total mastery', '45 min', 'Évoluer']],
  p2: [['The back explained', '12 min', 'Comprendre'], ['Why the back hurts', '15 min', 'Comprendre'], ['The neck and its tensions', '15 min', 'Comprendre'], ['Feeling the spine', '12 min', 'Ressentir'], ['The sacrum as base', '18 min', 'Ressentir'], ['Releasing the psoas', '20 min', 'Préparer'], ['Lumbar decompression', '22 min', 'Préparer'], ['Mobilizing the thoracics', '25 min', 'Préparer'], ['Conscious Cat-Cow', '20 min', 'Préparer'], ['Releasing the neck', '22 min', 'Préparer'], ['Deep strengthening I', '25 min', 'Exécuter'], ['The conscious plank', '28 min', 'Exécuter'], ['Guided glute bridge', '28 min', 'Exécuter'], ['Vertebral rotation', '30 min', 'Exécuter'], ['Back extension', '32 min', 'Exécuter'], ['Anti-pain program I', '30 min', 'Évoluer'], ['Anti-pain program II', '35 min', 'Évoluer'], ['Back & breathing', '38 min', 'Évoluer'], ['Integrated spine', '40 min', 'Évoluer'], ['The perfect spine', '45 min', 'Évoluer']],
  p3: [['Understanding the hip', '2 min 10 s', 'Comprendre'], ['The fragile knee', '15 min', 'Comprendre'], ['The forgotten ankle', '12 min', 'Comprendre'], ['Feeling the hip', '15 min', 'Ressentir'], ['Lower body mapping', '20 min', 'Ressentir'], ['Hip mobilization I', '20 min', 'Préparer'], ['Releasing the flexors', '22 min', 'Préparer'], ['Hip mobilization II', '25 min', 'Préparer'], ['Knee mobility', '20 min', 'Préparer'], ['The ankle in action', '22 min', 'Préparer'], ['Conscious squat I', '25 min', 'Exécuter'], ['Guided lunge', '28 min', 'Exécuter'], ['Hip bridge & rotation', '28 min', 'Exécuter'], ['Single leg stance', '30 min', 'Exécuter'], ['Mobility circuit', '32 min', 'Exécuter'], ['Mobility & Pilates I', '30 min', 'Évoluer'], ['Hip depth', '35 min', 'Évoluer'], ['Knees & strength', '38 min', 'Évoluer'], ['The posterior chain', '40 min', 'Évoluer'], ['Free lower body', '45 min', 'Évoluer']],
  p4: [['Posture explained', '12 min', 'Comprendre'], ['The 4 natural curves', '15 min', 'Comprendre'], ['Posture & pain', '15 min', 'Comprendre'], ['Feeling alignment', '12 min', 'Ressentir'], ['The vertical axis', '18 min', 'Ressentir'], ['Opening the chest', '20 min', 'Préparer'], ['Activating stabilizers', '22 min', 'Préparer'], ['Rebalancing the pelvis', '25 min', 'Préparer'], ['Aligning the neck', '22 min', 'Préparer'], ['Postural proprioception', '25 min', 'Préparer'], ['Standing consciously', '25 min', 'Exécuter'], ['Conscious walking', '28 min', 'Exécuter'], ['Sitting without pain', '25 min', 'Exécuter'], ['Mirror work', '30 min', 'Exécuter'], ['Posture under load', '32 min', 'Exécuter'], ['Desk program I', '25 min', 'Évoluer'], ['Desk program II', '30 min', 'Évoluer'], ['Posture & breathing', '35 min', 'Évoluer'], ['Body in balance', '40 min', 'Évoluer'], ['Perfect alignment', '45 min', 'Évoluer']],
  p5: [['Understanding the breath', '12 min', 'Comprendre'], ['The diaphragm', '15 min', 'Comprendre'], ['Breathing & nerves', '15 min', 'Comprendre'], ['Feeling your breath', '10 min', 'Ressentir'], ['3D breathing', '15 min', 'Ressentir'], ['Cardiac coherence I', '12 min', 'Préparer'], ['Releasing the diaphragm', '15 min', 'Préparer'], ['Lateral breathing', '18 min', 'Préparer'], ['Dorsal breathing', '20 min', 'Préparer'], ['Pelvic floor', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Breath & movement', '25 min', 'Exécuter'], ['Cardiac coherence II', '20 min', 'Exécuter'], ['Breath & core', '28 min', 'Exécuter'], ['Full breath sequence', '30 min', 'Exécuter'], ['Advanced techniques I', '25 min', 'Évoluer'], ['Breath & performance', '30 min', 'Évoluer'], ['Breathing & emotions', '32 min', 'Évoluer'], ['Anti-stress breathing', '35 min', 'Évoluer'], ['Master of breath', '40 min', 'Évoluer']],
  p6: [['What is proprioception', '12 min', 'Comprendre'], ['The body in space', '15 min', 'Comprendre'], ['Awareness & pain', '15 min', 'Comprendre'], ['Body scan I', '12 min', 'Ressentir'], ['Feeling without seeing', '15 min', 'Ressentir'], ['Static balance I', '15 min', 'Préparer'], ['Micro-movements', '18 min', 'Préparer'], ['Unstable balance', '20 min', 'Préparer'], ['The inner gaze', '22 min', 'Préparer'], ['Body mapping', '25 min', 'Préparer'], ['Slow movement I', '20 min', 'Exécuter'], ['Fine coordination', '25 min', 'Exécuter'], ['Anticipation & reaction', '28 min', 'Exécuter'], ['Slow movement II', '30 min', 'Exécuter'], ['Conscious fluidity', '32 min', 'Exécuter'], ['Movement meditation', '25 min', 'Évoluer'], ['Conscious inversion', '30 min', 'Évoluer'], ['Fascia awareness', '35 min', 'Évoluer'], ['Body intelligence', '38 min', 'Évoluer'], ['Being in the body', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & his method', '12 min', 'Comprendre'], ['The 6 Mat principles', '15 min', 'Comprendre'], ['The center — powerhouse', '15 min', 'Comprendre'], ['Feeling the mat beneath you', '12 min', 'Ressentir'], ['Pelvis-floor connection', '15 min', 'Ressentir'], ['The Hundred — initiation', '20 min', 'Préparer'], ['Conscious Roll-Up', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Center activation', '22 min', 'Préparer'], ['The series of 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Mat sequence level 1', '35 min', 'Évoluer'], ['Mat sequence level 2', '38 min', 'Évoluer'], ['Guided Teaser', '40 min', 'Évoluer'], ['Full Mat flow', '42 min', 'Évoluer'], ['Mat mastery', '45 min', 'Évoluer']],
  p8: [['Why the office tires your body', '5 min', 'Comprendre'], ['Neck & screens — the real danger', '5 min', 'Comprendre'], ['Sitting all day — consequences', '6 min', 'Comprendre'], ['Feel your seated tensions', '5 min', 'Ressentir'], ['Body scan on a chair', '7 min', 'Ressentir'], ['Seated neck stretches', '5 min', 'Préparer'], ['Wrists & forearms — keyboard', '6 min', 'Préparer'], ['Shoulders at desk — release', '7 min', 'Préparer'], ['Seated back — decompress', '8 min', 'Préparer'], ['Seated hips — unlock', '7 min', 'Préparer'], ['Anti-stress desk breathing', '5 min', 'Exécuter'], ['Thoracic rotation on chair', '6 min', 'Exécuter'], ['Active micro-break — 3 min', '3 min', 'Exécuter'], ['Seated postural strengthening', '8 min', 'Exécuter'], ['Express desk circuit', '10 min', 'Exécuter'], ['Full active break I', '8 min', 'Évoluer'], ['Full active break II', '10 min', 'Évoluer'], ['Anti-fatigue screen & neck', '7 min', 'Évoluer'], ['Morning office routine', '8 min', 'Évoluer'], ['Pain-free workday — protocol', '10 min', 'Évoluer']],
};

const SEANCES_ES = {
  p1: [['Entender el hombro', '12 min', 'Comprendre'], ['El manguito rotador', '15 min', 'Comprendre'], ['Sentir los omóplatos', '12 min', 'Ressentir'], ['El peso del brazo', '15 min', 'Ressentir'], ['Círculos de conciencia', '18 min', 'Ressentir'], ['Liberar los trapecios', '20 min', 'Préparer'], ['Movilizar la escápula', '22 min', 'Préparer'], ['Activar el serrato', '25 min', 'Préparer'], ['Apertura torácica', '28 min', 'Préparer'], ['Propiocepción hombro', '30 min', 'Préparer'], ['El gesto correcto', '25 min', 'Exécuter'], ['Elevación consciente', '28 min', 'Exécuter'], ['Rotación externa guiada', '30 min', 'Exécuter'], ['Jalones y empujes', '32 min', 'Exécuter'], ['Circuito hombro completo', '35 min', 'Exécuter'], ['Fuerza & flexibilidad I', '35 min', 'Évoluer'], ['Hombro con carga', '38 min', 'Évoluer'], ['Equilibrio escapular', '40 min', 'Évoluer'], ['El hombro atlético', '42 min', 'Évoluer'], ['Dominio total', '45 min', 'Évoluer']],
  p2: [['La espalda explicada', '12 min', 'Comprendre'], ['Por qué duele la espalda', '15 min', 'Comprendre'], ['El cuello y sus tensiones', '15 min', 'Comprendre'], ['Sentir la columna', '12 min', 'Ressentir'], ['El sacro como base', '18 min', 'Ressentir'], ['Liberar el psoas', '20 min', 'Préparer'], ['Descompresión lumbar', '22 min', 'Préparer'], ['Movilizar las torácicas', '25 min', 'Préparer'], ['Cat-Cow consciente', '20 min', 'Préparer'], ['Liberar el cuello', '22 min', 'Préparer'], ['Fortalecimiento profundo I', '25 min', 'Exécuter'], ['La plancha consciente', '28 min', 'Exécuter'], ['Puente glúteo guiado', '28 min', 'Exécuter'], ['Rotación vertebral', '30 min', 'Exécuter'], ['Extensión de espalda', '32 min', 'Exécuter'], ['Programa antidolor I', '30 min', 'Évoluer'], ['Programa antidolor II', '35 min', 'Évoluer'], ['Espalda & respiración', '38 min', 'Évoluer'], ['Columna integrada', '40 min', 'Évoluer'], ['La columna perfecta', '45 min', 'Évoluer']],
  p3: [['Entender la cadera', '2 min 10 s', 'Comprendre'], ['La rodilla frágil', '15 min', 'Comprendre'], ['El tobillo olvidado', '12 min', 'Comprendre'], ['Sentir la cadera', '15 min', 'Ressentir'], ['Cartografía parte inferior', '20 min', 'Ressentir'], ['Movilización de cadera I', '20 min', 'Préparer'], ['Liberación de flexores', '22 min', 'Préparer'], ['Movilización de cadera II', '25 min', 'Préparer'], ['Movilidad de rodilla', '20 min', 'Préparer'], ['El tobillo en acción', '22 min', 'Préparer'], ['Sentadilla consciente I', '25 min', 'Exécuter'], ['Zancada guiada', '28 min', 'Exécuter'], ['Puente y rotación cadera', '28 min', 'Exécuter'], ['Postura unipodal', '30 min', 'Exécuter'], ['Circuito movilidad', '32 min', 'Exécuter'], ['Movilidad & Pilates I', '30 min', 'Évoluer'], ['Profundidad de cadera', '35 min', 'Évoluer'], ['Rodillas & fuerza', '38 min', 'Évoluer'], ['La cadena posterior', '40 min', 'Évoluer'], ['Cuerpo libre abajo', '45 min', 'Évoluer']],
  p4: [['La postura explicada', '12 min', 'Comprendre'], ['Las 4 curvas naturales', '15 min', 'Comprendre'], ['Postura & dolor', '15 min', 'Comprendre'], ['Sentir la alineación', '12 min', 'Ressentir'], ['El eje vertical', '18 min', 'Ressentir'], ['Abrir la caja torácica', '20 min', 'Préparer'], ['Activar estabilizadores', '22 min', 'Préparer'], ['Reequilibrar la pelvis', '25 min', 'Préparer'], ['Alinear el cuello', '22 min', 'Préparer'], ['Propiocepción postural', '25 min', 'Préparer'], ['De pie consciente', '25 min', 'Exécuter'], ['Caminar consciente', '28 min', 'Exécuter'], ['Sentado sin dolor', '25 min', 'Exécuter'], ['Trabajo frente al espejo', '30 min', 'Exécuter'], ['Postura bajo carga', '32 min', 'Exécuter'], ['Programa oficina I', '25 min', 'Évoluer'], ['Programa oficina II', '30 min', 'Évoluer'], ['Postura & respiración', '35 min', 'Évoluer'], ['Cuerpo en equilibrio', '40 min', 'Évoluer'], ['Alineación perfecta', '45 min', 'Évoluer']],
  p5: [['Entender el aliento', '12 min', 'Comprendre'], ['El diafragma', '15 min', 'Comprendre'], ['Respiración & nervios', '15 min', 'Comprendre'], ['Sentir la respiración', '10 min', 'Ressentir'], ['Respiración 3D', '15 min', 'Ressentir'], ['Coherencia cardíaca I', '12 min', 'Préparer'], ['Liberar el diafragma', '15 min', 'Préparer'], ['Respiración lateral', '18 min', 'Préparer'], ['Respiración dorsal', '20 min', 'Préparer'], ['Suelo pélvico', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Aliento & movimiento', '25 min', 'Exécuter'], ['Coherencia cardíaca II', '20 min', 'Exécuter'], ['Aliento & core', '28 min', 'Exécuter'], ['Secuencia aliento completo', '30 min', 'Exécuter'], ['Técnicas avanzadas I', '25 min', 'Évoluer'], ['Aliento & rendimiento', '30 min', 'Évoluer'], ['Respiración & emociones', '32 min', 'Évoluer'], ['Respiración antiestres', '35 min', 'Évoluer'], ['Maestro del aliento', '40 min', 'Évoluer']],
  p6: [['Qué es la propiocepción', '12 min', 'Comprendre'], ['El cuerpo en el espacio', '15 min', 'Comprendre'], ['Conciencia & dolor', '15 min', 'Comprendre'], ['Scan corporal I', '12 min', 'Ressentir'], ['Sentir sin ver', '15 min', 'Ressentir'], ['Equilibrio estático I', '15 min', 'Préparer'], ['Micro-movimientos', '18 min', 'Préparer'], ['Equilibrio inestable', '20 min', 'Préparer'], ['La mirada interior', '22 min', 'Préparer'], ['Mapeo corporal', '25 min', 'Préparer'], ['Movimiento lento I', '20 min', 'Exécuter'], ['Coordinación fina', '25 min', 'Exécuter'], ['Anticipación & reacción', '28 min', 'Exécuter'], ['Movimiento lento II', '30 min', 'Exécuter'], ['Fluidez consciente', '32 min', 'Exécuter'], ['Meditación en movimiento', '25 min', 'Évoluer'], ['Inversión consciente', '30 min', 'Évoluer'], ['Conciencia de fascias', '35 min', 'Évoluer'], ['Inteligencia corporal', '38 min', 'Évoluer'], ['Ser en el cuerpo', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & su método', '12 min', 'Comprendre'], ['Los 6 principios del Mat', '15 min', 'Comprendre'], ['El centro — powerhouse', '15 min', 'Comprendre'], ['Sentir la colchoneta', '12 min', 'Ressentir'], ['Conexión pelvis-suelo', '15 min', 'Ressentir'], ['El Hundred — iniciación', '20 min', 'Préparer'], ['Roll-Up consciente', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Activación del centro', '22 min', 'Préparer'], ['La serie de los 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Secuencia Mat nivel 1', '35 min', 'Évoluer'], ['Secuencia Mat nivel 2', '38 min', 'Évoluer'], ['Teaser guiado', '40 min', 'Évoluer'], ['Flujo Mat completo', '42 min', 'Évoluer'], ['Dominio del Mat', '45 min', 'Évoluer']],
  p8: [['Por qué la oficina cansa', '5 min', 'Comprendre'], ['Cuello y pantallas — el peligro', '5 min', 'Comprendre'], ['Sentado todo el día — efectos', '6 min', 'Comprendre'], ['Siente tus tensiones sentado', '5 min', 'Ressentir'], ['Escaneo corporal en silla', '7 min', 'Ressentir'], ['Estiramientos de cuello sentado', '5 min', 'Préparer'], ['Muñecas y antebrazos — teclado', '6 min', 'Préparer'], ['Hombros en el escritorio', '7 min', 'Préparer'], ['Espalda sentada — descomprimir', '8 min', 'Préparer'], ['Caderas sentadas — liberar', '7 min', 'Préparer'], ['Respiración anti-estrés', '5 min', 'Exécuter'], ['Rotación torácica en silla', '6 min', 'Exécuter'], ['Micro-pausa activa — 3 min', '3 min', 'Exécuter'], ['Fortalecimiento postural sentado', '8 min', 'Exécuter'], ['Circuito express oficina', '10 min', 'Exécuter'], ['Pausa activa completa I', '8 min', 'Évoluer'], ['Pausa activa completa II', '10 min', 'Évoluer'], ['Anti-fatiga pantalla y cuello', '7 min', 'Évoluer'], ['Rutina matinal de oficina', '8 min', 'Évoluer'], ['Día sin dolor — protocolo', '10 min', 'Évoluer']],
};

const SEANCES_IT = {
  p1: [['Capire la spalla', '12 min', 'Comprendre'], ['La cuffia dei rotatori', '15 min', 'Comprendre'], ['Sentire le scapole', '12 min', 'Ressentir'], ['Il peso del braccio', '15 min', 'Ressentir'], ['Cerchi di consapevolezza', '18 min', 'Ressentir'], ['Liberare i trapezi', '20 min', 'Préparer'], ['Mobilizzare la scapola', '22 min', 'Préparer'], ['Attivare il dentato', '25 min', 'Préparer'], ['Apertura toracica', '28 min', 'Préparer'], ['Propriocezione spalla', '30 min', 'Préparer'], ['Il gesto giusto', '25 min', 'Exécuter'], ['Elevazione consapevole', '28 min', 'Exécuter'], ['Rotazione esterna guidata', '30 min', 'Exécuter'], ['Tirate e spinte', '32 min', 'Exécuter'], ['Circuito spalla completo', '35 min', 'Exécuter'], ['Forza & flessibilità I', '35 min', 'Évoluer'], ['Spalla sotto carico', '38 min', 'Évoluer'], ['Equilibrio scapolare', '40 min', 'Évoluer'], ['La spalla atletica', '42 min', 'Évoluer'], ['Maestria totale', '45 min', 'Évoluer']],
  p2: [['La schiena spiegata', '12 min', 'Comprendre'], ['Perché fa male la schiena', '15 min', 'Comprendre'], ['Il collo e le sue tensioni', '15 min', 'Comprendre'], ['Sentire la colonna', '12 min', 'Ressentir'], ['Il sacro come base', '18 min', 'Ressentir'], ['Rilasciare lo psoas', '20 min', 'Préparer'], ['Decompressione lombare', '22 min', 'Préparer'], ['Mobilizzare le toraciche', '25 min', 'Préparer'], ['Cat-Cow consapevole', '20 min', 'Préparer'], ['Liberare il collo', '22 min', 'Préparer'], ['Rinforzo profondo I', '25 min', 'Exécuter'], ['Il plank consapevole', '28 min', 'Exécuter'], ['Ponte glutei guidato', '28 min', 'Exécuter'], ['Rotazione vertebrale', '30 min', 'Exécuter'], ['Estensione della schiena', '32 min', 'Exécuter'], ['Programma antidolore I', '30 min', 'Évoluer'], ['Programma antidolore II', '35 min', 'Évoluer'], ['Schiena & respirazione', '38 min', 'Évoluer'], ['Colonna integrata', '40 min', 'Évoluer'], ['La colonna perfetta', '45 min', 'Évoluer']],
  p3: [['Capire l\'anca', '2 min 10 s', 'Comprendre'], ['Il ginocchio fragile', '15 min', 'Comprendre'], ['La caviglia dimenticata', '12 min', 'Comprendre'], ['Sentire l\'anca', '15 min', 'Ressentir'], ['Mappatura parte inferiore', '20 min', 'Ressentir'], ['Mobilizzazione anca I', '20 min', 'Préparer'], ['Liberare i flessori', '22 min', 'Préparer'], ['Mobilizzazione anca II', '25 min', 'Préparer'], ['Mobilità del ginocchio', '20 min', 'Préparer'], ['La caviglia in azione', '22 min', 'Préparer'], ['Squat consapevole I', '25 min', 'Exécuter'], ['Affondo guidato', '28 min', 'Exécuter'], ['Ponte e rotazione anca', '28 min', 'Exécuter'], ['Stazione monopodica', '30 min', 'Exécuter'], ['Circuito mobilità', '32 min', 'Exécuter'], ['Mobilità & Pilates I', '30 min', 'Évoluer'], ['Profondità dell\'anca', '35 min', 'Évoluer'], ['Ginocchia & forza', '38 min', 'Évoluer'], ['La catena posteriore', '40 min', 'Évoluer'], ['Corpo libero in basso', '45 min', 'Évoluer']],
  p4: [['La postura spiegata', '12 min', 'Comprendre'], ['Le 4 curve naturali', '15 min', 'Comprendre'], ['Postura & dolore', '15 min', 'Comprendre'], ['Sentire l\'allineamento', '12 min', 'Ressentir'], ['L\'asse verticale', '18 min', 'Ressentir'], ['Aprire la gabbia toracica', '20 min', 'Préparer'], ['Attivare gli stabilizzatori', '22 min', 'Préparer'], ['Riequilibrare il bacino', '25 min', 'Préparer'], ['Allineare il collo', '22 min', 'Préparer'], ['Propriocezione posturale', '25 min', 'Préparer'], ['In piedi consapevole', '25 min', 'Exécuter'], ['Camminata consapevole', '28 min', 'Exécuter'], ['Seduti senza dolore', '25 min', 'Exécuter'], ['Lavoro allo specchio', '30 min', 'Exécuter'], ['Postura sotto carico', '32 min', 'Exécuter'], ['Programma ufficio I', '25 min', 'Évoluer'], ['Programma ufficio II', '30 min', 'Évoluer'], ['Postura & respirazione', '35 min', 'Évoluer'], ['Corpo in equilibrio', '40 min', 'Évoluer'], ['L\'allineamento perfetto', '45 min', 'Évoluer']],
  p5: [['Capire il respiro', '12 min', 'Comprendre'], ['Il diaframma', '15 min', 'Comprendre'], ['Respirazione & nervi', '15 min', 'Comprendre'], ['Sentire il proprio respiro', '10 min', 'Ressentir'], ['Respirazione 3D', '15 min', 'Ressentir'], ['Coerenza cardiaca I', '12 min', 'Préparer'], ['Liberare il diaframma', '15 min', 'Préparer'], ['Respirazione laterale', '18 min', 'Préparer'], ['Respirazione dorsale', '20 min', 'Préparer'], ['Pavimento pelvico', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Respiro & movimento', '25 min', 'Exécuter'], ['Coerenza cardiaca II', '20 min', 'Exécuter'], ['Respiro & core', '28 min', 'Exécuter'], ['Sequenza respiro completo', '30 min', 'Exécuter'], ['Tecniche avanzate I', '25 min', 'Évoluer'], ['Respiro & prestazione', '30 min', 'Évoluer'], ['Respirazione & emozioni', '32 min', 'Évoluer'], ['Anti-stress respiratorio', '35 min', 'Évoluer'], ['Maestro del respiro', '40 min', 'Évoluer']],
  p6: [['Cos\'è la propriocezione', '12 min', 'Comprendre'], ['Il corpo nello spazio', '15 min', 'Comprendre'], ['Consapevolezza & dolore', '15 min', 'Comprendre'], ['Scan corporeo I', '12 min', 'Ressentir'], ['Sentire senza vedere', '15 min', 'Ressentir'], ['Equilibrio statico I', '15 min', 'Préparer'], ['Micro-movimenti', '18 min', 'Préparer'], ['Equilibrio instabile', '20 min', 'Préparer'], ['Lo sguardo interiore', '22 min', 'Préparer'], ['Mappatura corporea', '25 min', 'Préparer'], ['Movimento lento I', '20 min', 'Exécuter'], ['Coordinazione fine', '25 min', 'Exécuter'], ['Anticipazione & reazione', '28 min', 'Exécuter'], ['Movimento lento II', '30 min', 'Exécuter'], ['Fluidità consapevole', '32 min', 'Exécuter'], ['Meditazione in movimento', '25 min', 'Évoluer'], ['Inversione consapevole', '30 min', 'Évoluer'], ['Consapevolezza delle fasce', '35 min', 'Évoluer'], ['Intelligenza corporea', '38 min', 'Évoluer'], ['Essere nel corpo', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & il suo metodo', '12 min', 'Comprendre'], ['I 6 principi del Mat', '15 min', 'Comprendre'], ['Il centro — powerhouse', '15 min', 'Comprendre'], ['Sentire il tappetino', '12 min', 'Ressentir'], ['Connessione bacino-pavimento', '15 min', 'Ressentir'], ['Il Hundred — iniziazione', '20 min', 'Préparer'], ['Roll-Up consapevole', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Attivazione del centro', '22 min', 'Préparer'], ['La serie dei 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Sequenza Mat livello 1', '35 min', 'Évoluer'], ['Sequenza Mat livello 2', '38 min', 'Évoluer'], ['Teaser guidato', '40 min', 'Évoluer'], ['Flusso Mat completo', '42 min', 'Évoluer'], ['Maestria del Mat', '45 min', 'Évoluer']],
  p8: [['Perché l\'ufficio stanca', '5 min', 'Comprendre'], ['Collo e schermi — il vero pericolo', '5 min', 'Comprendre'], ['Seduti tutto il giorno — conseguenze', '6 min', 'Comprendre'], ['Senti le tue tensioni seduto', '5 min', 'Ressentir'], ['Scansione corporea su sedia', '7 min', 'Ressentir'], ['Stretching collo seduto', '5 min', 'Préparer'], ['Polsi e avambracci — tastiera', '6 min', 'Préparer'], ['Spalle alla scrivania — rilascia', '7 min', 'Préparer'], ['Schiena seduta — decomprimere', '8 min', 'Préparer'], ['Anche sedute — sbloccare', '7 min', 'Préparer'], ['Respirazione anti-stress', '5 min', 'Exécuter'], ['Rotazione toracica su sedia', '6 min', 'Exécuter'], ['Micro-pausa attiva — 3 min', '3 min', 'Exécuter'], ['Rinforzo posturale seduto', '8 min', 'Exécuter'], ['Circuito express ufficio', '10 min', 'Exécuter'], ['Pausa attiva completa I', '8 min', 'Évoluer'], ['Pausa attiva completa II', '10 min', 'Évoluer'], ['Anti-fatica schermo e collo', '7 min', 'Évoluer'], ['Routine mattutina ufficio', '8 min', 'Évoluer'], ['Giornata senza dolore — protocollo', '10 min', 'Évoluer']],
};

const SEANCES_DE = {
  p1: [['Die Schulter verstehen', '12 min', 'Comprendre'], ['Die Rotatorenmanschette', '15 min', 'Comprendre'], ['Die Schulterblätter spüren', '12 min', 'Ressentir'], ['Das Gewicht des Arms', '15 min', 'Ressentir'], ['Bewusstseinskreise', '18 min', 'Ressentir'], ['Den Trapezmuskel lösen', '20 min', 'Préparer'], ['Die Scapula mobilisieren', '22 min', 'Préparer'], ['Den Serratus aktivieren', '25 min', 'Préparer'], ['Brustöffnung', '28 min', 'Préparer'], ['Schulter-Propriozeption', '30 min', 'Préparer'], ['Die richtige Geste', '25 min', 'Exécuter'], ['Bewusste Elevation', '28 min', 'Exécuter'], ['Geführte Außenrotation', '30 min', 'Exécuter'], ['Ziehen und Drücken', '32 min', 'Exécuter'], ['Kompletter Schulterzirkel', '35 min', 'Exécuter'], ['Kraft & Flexibilität I', '35 min', 'Évoluer'], ['Schulter unter Last', '38 min', 'Évoluer'], ['Schulterblatt-Balance', '40 min', 'Évoluer'], ['Die athletische Schulter', '42 min', 'Évoluer'], ['Totale Meisterschaft', '45 min', 'Évoluer']],
  p2: [['Der Rücken erklärt', '12 min', 'Comprendre'], ['Warum der Rücken schmerzt', '15 min', 'Comprendre'], ['Der Nacken und seine Spannungen', '15 min', 'Comprendre'], ['Die Wirbelsäule spüren', '12 min', 'Ressentir'], ['Das Kreuzbein als Basis', '18 min', 'Ressentir'], ['Den Psoas lösen', '20 min', 'Préparer'], ['Lumbale Dekompression', '22 min', 'Préparer'], ['Die Brustwirbel mobilisieren', '25 min', 'Préparer'], ['Bewusste Cat-Cow', '20 min', 'Préparer'], ['Den Nacken befreien', '22 min', 'Préparer'], ['Tiefenkräftigung I', '25 min', 'Exécuter'], ['Die bewusste Planke', '28 min', 'Exécuter'], ['Geführte Gesäßbrücke', '28 min', 'Exécuter'], ['Wirbelrotation', '30 min', 'Exécuter'], ['Rückenstreckung', '32 min', 'Exécuter'], ['Anti-Schmerz-Programm I', '30 min', 'Évoluer'], ['Anti-Schmerz-Programm II', '35 min', 'Évoluer'], ['Rücken & Atmung', '38 min', 'Évoluer'], ['Integrierte Wirbelsäule', '40 min', 'Évoluer'], ['Die perfekte Wirbelsäule', '45 min', 'Évoluer']],
  p3: [['Die Hüfte verstehen', '2 min 10 s', 'Comprendre', 'https://vz-1a4e2cac-0dc.b-cdn.net/596e732b-fa75-4606-aa8a-45fb034d2e0b/playlist.m3u8'], ['Das fragile Knie', '15 min', 'Comprendre'], ['Der vergessene Knöchel', '12 min', 'Comprendre'], ['Die Hüfte spüren', '15 min', 'Ressentir'], ['Kartierung Unterkörper', '20 min', 'Ressentir'], ['Hüftmobilisation I', '20 min', 'Préparer'], ['Beuger lösen', '22 min', 'Préparer'], ['Hüftmobilisation II', '25 min', 'Préparer'], ['Kniemobilität', '20 min', 'Préparer'], ['Der Knöchel in Aktion', '22 min', 'Préparer'], ['Bewusste Kniebeuge I', '25 min', 'Exécuter'], ['Geführter Ausfallschritt', '28 min', 'Exécuter'], ['Brücke & Hüftrotation', '28 min', 'Exécuter'], ['Einbeinstand', '30 min', 'Exécuter'], ['Mobilitätszirkel', '32 min', 'Exécuter'], ['Mobilität & Pilates I', '30 min', 'Évoluer'], ['Hüfttiefe', '35 min', 'Évoluer'], ['Knie & Kraft', '38 min', 'Évoluer'], ['Die hintere Kette', '40 min', 'Évoluer'], ['Freier Unterkörper', '45 min', 'Évoluer']],
  p4: [['Haltung erklärt', '12 min', 'Comprendre'], ['Die 4 natürlichen Kurven', '15 min', 'Comprendre'], ['Haltung & Schmerz', '15 min', 'Comprendre'], ['Ausrichtung spüren', '12 min', 'Ressentir'], ['Die vertikale Achse', '18 min', 'Ressentir'], ['Den Brustkorb öffnen', '20 min', 'Préparer'], ['Stabilisatoren aktivieren', '22 min', 'Préparer'], ['Das Becken ausbalancieren', '25 min', 'Préparer'], ['Den Nacken ausrichten', '22 min', 'Préparer'], ['Posturale Propriozeption', '25 min', 'Préparer'], ['Bewusst stehen', '25 min', 'Exécuter'], ['Bewusst gehen', '28 min', 'Exécuter'], ['Sitzen ohne Schmerzen', '25 min', 'Exécuter'], ['Spiegelarbeit', '30 min', 'Exécuter'], ['Haltung unter Last', '32 min', 'Exécuter'], ['Büroprogramm I', '25 min', 'Évoluer'], ['Büroprogramm II', '30 min', 'Évoluer'], ['Haltung & Atmung', '35 min', 'Évoluer'], ['Körper im Gleichgewicht', '40 min', 'Évoluer'], ['Perfekte Ausrichtung', '45 min', 'Évoluer']],
  p5: [['Den Atem verstehen', '12 min', 'Comprendre'], ['Das Zwerchfell', '15 min', 'Comprendre'], ['Atmung & Nerven', '15 min', 'Comprendre'], ['Seinen Atem spüren', '10 min', 'Ressentir'], ['3D-Atmung', '15 min', 'Ressentir'], ['Herzkohärenz I', '12 min', 'Préparer'], ['Das Zwerchfell befreien', '15 min', 'Préparer'], ['Laterale Atmung', '18 min', 'Préparer'], ['Dorsale Atmung', '20 min', 'Préparer'], ['Beckenboden', '22 min', 'Préparer'], ['Pilates-Atmung I', '20 min', 'Exécuter'], ['Atem & Bewegung', '25 min', 'Exécuter'], ['Herzkohärenz II', '20 min', 'Exécuter'], ['Atem & Rumpf', '28 min', 'Exécuter'], ['Vollständige Atemsequenz', '30 min', 'Exécuter'], ['Fortgeschrittene Techniken I', '25 min', 'Évoluer'], ['Atem & Leistung', '30 min', 'Évoluer'], ['Atmung & Emotionen', '32 min', 'Évoluer'], ['Anti-Stress-Atmung', '35 min', 'Évoluer'], ['Meister des Atems', '40 min', 'Évoluer']],
  p6: [['Was ist Propriozeption', '12 min', 'Comprendre'], ['Der Körper im Raum', '15 min', 'Comprendre'], ['Bewusstsein & Schmerz', '15 min', 'Comprendre'], ['Körperscan I', '12 min', 'Ressentir'], ['Spüren ohne Sehen', '15 min', 'Ressentir'], ['Statisches Gleichgewicht I', '15 min', 'Préparer'], ['Mikrobewegungen', '18 min', 'Préparer'], ['Instabiles Gleichgewicht', '20 min', 'Préparer'], ['Der innere Blick', '22 min', 'Préparer'], ['Körperkartierung', '25 min', 'Préparer'], ['Langsame Bewegung I', '20 min', 'Exécuter'], ['Feinkoordination', '25 min', 'Exécuter'], ['Antizipation & Reaktion', '28 min', 'Exécuter'], ['Langsame Bewegung II', '30 min', 'Exécuter'], ['Bewusste Fluidität', '32 min', 'Exécuter'], ['Bewegungsmeditation', '25 min', 'Évoluer'], ['Bewusste Inversion', '30 min', 'Évoluer'], ['Faszien-Bewusstsein', '35 min', 'Évoluer'], ['Körperintelligenz', '38 min', 'Évoluer'], ['Sein im Körper', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & seine Methode', '12 min', 'Comprendre'], ['Die 6 Mat-Prinzipien', '15 min', 'Comprendre'], ['Das Zentrum — Powerhouse', '15 min', 'Comprendre'], ['Die Matte unter sich spüren', '12 min', 'Ressentir'], ['Becken-Boden-Verbindung', '15 min', 'Ressentir'], ['The Hundred — Einführung', '20 min', 'Préparer'], ['Bewusster Roll-Up', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Zentrumsaktivierung', '22 min', 'Préparer'], ['Die 5er-Serie', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Mat-Sequenz Level 1', '35 min', 'Évoluer'], ['Mat-Sequenz Level 2', '38 min', 'Évoluer'], ['Geführter Teaser', '40 min', 'Évoluer'], ['Kompletter Mat-Flow', '42 min', 'Évoluer'], ['Mat-Meisterschaft', '45 min', 'Évoluer']],
  p8: [['Warum das Büro ermüdet', '5 min', 'Comprendre'], ['Nacken & Bildschirme — die echte Gefahr', '5 min', 'Comprendre'], ['Den ganzen Tag sitzen — Folgen', '6 min', 'Comprendre'], ['Sitzspannungen spüren', '5 min', 'Ressentir'], ['Körperscan auf dem Stuhl', '7 min', 'Ressentir'], ['Nackendehnung im Sitzen', '5 min', 'Préparer'], ['Handgelenke & Unterarme — Tastatur', '6 min', 'Préparer'], ['Schultern am Schreibtisch — lösen', '7 min', 'Préparer'], ['Rücken im Sitzen — entlasten', '8 min', 'Préparer'], ['Hüften im Sitzen — befreien', '7 min', 'Préparer'], ['Anti-Stress-Atmung am Schreibtisch', '5 min', 'Exécuter'], ['Brustrotation auf dem Stuhl', '6 min', 'Exécuter'], ['Aktive Mikropause — 3 Min', '3 min', 'Exécuter'], ['Haltungskräftigung im Sitzen', '8 min', 'Exécuter'], ['Express-Bürozirkel', '10 min', 'Exécuter'], ['Komplette aktive Pause I', '8 min', 'Évoluer'], ['Komplette aktive Pause II', '10 min', 'Évoluer'], ['Anti-Müdigkeit Bildschirm & Nacken', '7 min', 'Évoluer'], ['Morgenroutine im Büro', '8 min', 'Évoluer'], ['Schmerzfreier Tag — Protokoll', '10 min', 'Évoluer']],
};

const SEANCES_PT = {
  p1: [['Entendendo o ombro', '12 min', 'Comprendre'], ['O manguito rotador', '15 min', 'Comprendre'], ['Sentindo as escápulas', '12 min', 'Ressentir'], ['O peso do braço', '15 min', 'Ressentir'], ['Círculos de consciência', '18 min', 'Ressentir'], ['Liberando o trapézio', '20 min', 'Préparer'], ['Mobilizando a escápula', '22 min', 'Préparer'], ['Ativando o serrátil', '25 min', 'Préparer'], ['Abertura torácica', '28 min', 'Préparer'], ['Propriocepção do ombro', '30 min', 'Préparer'], ['O gesto certo', '25 min', 'Exécuter'], ['Elevação consciente', '28 min', 'Exécuter'], ['Rotação externa guiada', '30 min', 'Exécuter'], ['Puxadas e empurradas', '32 min', 'Exécuter'], ['Circuito completo de ombro', '35 min', 'Exécuter'], ['Força & flexibilidade I', '35 min', 'Évoluer'], ['Ombro sob carga', '38 min', 'Évoluer'], ['Equilíbrio escapular', '40 min', 'Évoluer'], ['O ombro atlético', '42 min', 'Évoluer'], ['Domínio total', '45 min', 'Évoluer']],
  p2: [['As costas explicadas', '12 min', 'Comprendre'], ['Por que as costas doem', '15 min', 'Comprendre'], ['O pescoço e suas tensões', '15 min', 'Comprendre'], ['Sentindo a coluna', '12 min', 'Ressentir'], ['O sacro como base', '18 min', 'Ressentir'], ['Liberando o psoas', '20 min', 'Préparer'], ['Descompressão lombar', '22 min', 'Préparer'], ['Mobilizando as torácicas', '25 min', 'Préparer'], ['Cat-Cow consciente', '20 min', 'Préparer'], ['Liberando o pescoço', '22 min', 'Préparer'], ['Fortalecimento profundo I', '25 min', 'Exécuter'], ['A prancha consciente', '28 min', 'Exécuter'], ['Ponte glútea guiada', '28 min', 'Exécuter'], ['Rotação vertebral', '30 min', 'Exécuter'], ['Extensão das costas', '32 min', 'Exécuter'], ['Programa antidor I', '30 min', 'Évoluer'], ['Programa antidor II', '35 min', 'Évoluer'], ['Costas & respiração', '38 min', 'Évoluer'], ['Coluna integrada', '40 min', 'Évoluer'], ['A coluna perfeita', '45 min', 'Évoluer']],
  p3: [['Entendendo o quadril', '2 min 10 s', 'Comprendre', 'https://vz-1a4e2cac-0dc.b-cdn.net/596e732b-fa75-4606-aa8a-45fb034d2e0b/playlist.m3u8'], ['O joelho frágil', '15 min', 'Comprendre'], ['O tornozelo esquecido', '12 min', 'Comprendre'], ['Sentindo o quadril', '15 min', 'Ressentir'], ['Mapeamento da parte inferior', '20 min', 'Ressentir'], ['Mobilização do quadril I', '20 min', 'Préparer'], ['Liberação dos flexores', '22 min', 'Préparer'], ['Mobilização do quadril II', '25 min', 'Préparer'], ['Mobilidade do joelho', '20 min', 'Préparer'], ['O tornozelo em ação', '22 min', 'Préparer'], ['Agachamento consciente I', '25 min', 'Exécuter'], ['Avanço guiado', '28 min', 'Exécuter'], ['Ponte e rotação de quadril', '28 min', 'Exécuter'], ['Apoio unipodal', '30 min', 'Exécuter'], ['Circuito de mobilidade', '32 min', 'Exécuter'], ['Mobilidade & Pilates I', '30 min', 'Évoluer'], ['Profundidade do quadril', '35 min', 'Évoluer'], ['Joelhos & força', '38 min', 'Évoluer'], ['A cadeia posterior', '40 min', 'Évoluer'], ['Corpo livre embaixo', '45 min', 'Évoluer']],
  p4: [['A postura explicada', '12 min', 'Comprendre'], ['As 4 curvas naturais', '15 min', 'Comprendre'], ['Postura & dor', '15 min', 'Comprendre'], ['Sentindo o alinhamento', '12 min', 'Ressentir'], ['O eixo vertical', '18 min', 'Ressentir'], ['Abrindo a caixa torácica', '20 min', 'Préparer'], ['Ativando estabilizadores', '22 min', 'Préparer'], ['Reequilibrando a pelve', '25 min', 'Préparer'], ['Alinhando o pescoço', '22 min', 'Préparer'], ['Propriocepção postural', '25 min', 'Préparer'], ['Em pé consciente', '25 min', 'Exécuter'], ['Caminhada consciente', '28 min', 'Exécuter'], ['Sentado sem dor', '25 min', 'Exécuter'], ['Trabalho no espelho', '30 min', 'Exécuter'], ['Postura sob carga', '32 min', 'Exécuter'], ['Programa escritório I', '25 min', 'Évoluer'], ['Programa escritório II', '30 min', 'Évoluer'], ['Postura & respiração', '35 min', 'Évoluer'], ['Corpo em equilíbrio', '40 min', 'Évoluer'], ['Alinhamento perfeito', '45 min', 'Évoluer']],
  p5: [['Entendendo a respiração', '12 min', 'Comprendre'], ['O diafragma', '15 min', 'Comprendre'], ['Respiração & nervos', '15 min', 'Comprendre'], ['Sentindo sua respiração', '10 min', 'Ressentir'], ['Respiração 3D', '15 min', 'Ressentir'], ['Coerência cardíaca I', '12 min', 'Préparer'], ['Liberando o diafragma', '15 min', 'Préparer'], ['Respiração lateral', '18 min', 'Préparer'], ['Respiração dorsal', '20 min', 'Préparer'], ['Assoalho pélvico', '22 min', 'Préparer'], ['Respiração Pilates I', '20 min', 'Exécuter'], ['Respiração & movimento', '25 min', 'Exécuter'], ['Coerência cardíaca II', '20 min', 'Exécuter'], ['Respiração & core', '28 min', 'Exécuter'], ['Sequência respiratória completa', '30 min', 'Exécuter'], ['Técnicas avançadas I', '25 min', 'Évoluer'], ['Respiração & performance', '30 min', 'Évoluer'], ['Respiração & emoções', '32 min', 'Évoluer'], ['Respiração antiestresse', '35 min', 'Évoluer'], ['Mestre da respiração', '40 min', 'Évoluer']],
  p6: [['O que é propriocepção', '12 min', 'Comprendre'], ['O corpo no espaço', '15 min', 'Comprendre'], ['Consciência & dor', '15 min', 'Comprendre'], ['Scan corporal I', '12 min', 'Ressentir'], ['Sentir sem ver', '15 min', 'Ressentir'], ['Equilíbrio estático I', '15 min', 'Préparer'], ['Micromovimentos', '18 min', 'Préparer'], ['Equilíbrio instável', '20 min', 'Préparer'], ['O olhar interior', '22 min', 'Préparer'], ['Mapeamento corporal', '25 min', 'Préparer'], ['Movimento lento I', '20 min', 'Exécuter'], ['Coordenação fina', '25 min', 'Exécuter'], ['Antecipação & reação', '28 min', 'Exécuter'], ['Movimento lento II', '30 min', 'Exécuter'], ['Fluidez consciente', '32 min', 'Exécuter'], ['Meditação em movimento', '25 min', 'Évoluer'], ['Inversão consciente', '30 min', 'Évoluer'], ['Consciência das fáscias', '35 min', 'Évoluer'], ['Inteligência corporal', '38 min', 'Évoluer'], ['Ser no corpo', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & seu método', '12 min', 'Comprendre'], ['Os 6 princípios do Mat', '15 min', 'Comprendre'], ['O centro — powerhouse', '15 min', 'Comprendre'], ['Sentindo o tapete', '12 min', 'Ressentir'], ['Conexão pelve-assoalho', '15 min', 'Ressentir'], ['O Hundred — iniciação', '20 min', 'Préparer'], ['Roll-Up consciente', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Ativação do centro', '22 min', 'Préparer'], ['A série dos 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Sequência Mat nível 1', '35 min', 'Évoluer'], ['Sequência Mat nível 2', '38 min', 'Évoluer'], ['Teaser guiado', '40 min', 'Évoluer'], ['Fluxo Mat completo', '42 min', 'Évoluer'], ['Domínio do Mat', '45 min', 'Évoluer']],
  p8: [['Por que o escritório cansa', '5 min', 'Comprendre'], ['Pescoço e telas — o verdadeiro perigo', '5 min', 'Comprendre'], ['Sentado o dia todo — consequências', '6 min', 'Comprendre'], ['Sinta suas tensões sentado', '5 min', 'Ressentir'], ['Scan corporal na cadeira', '7 min', 'Ressentir'], ['Alongamento de pescoço sentado', '5 min', 'Préparer'], ['Pulsos e antebraços — teclado', '6 min', 'Préparer'], ['Ombros na mesa — soltar', '7 min', 'Préparer'], ['Costas sentado — descomprimir', '8 min', 'Préparer'], ['Quadris sentado — liberar', '7 min', 'Préparer'], ['Respiração antiestresse na mesa', '5 min', 'Exécuter'], ['Rotação torácica na cadeira', '6 min', 'Exécuter'], ['Micropausa ativa — 3 min', '3 min', 'Exécuter'], ['Fortalecimento postural sentado', '8 min', 'Exécuter'], ['Circuito express escritório', '10 min', 'Exécuter'], ['Pausa ativa completa I', '8 min', 'Évoluer'], ['Pausa ativa completa II', '10 min', 'Évoluer'], ['Antifadiga tela e pescoço', '7 min', 'Évoluer'], ['Rotina matinal no escritório', '8 min', 'Évoluer'], ['Dia sem dor — protocolo', '10 min', 'Évoluer']],
};

const SEANCES_ZH = {
  p1: [['理解肩膀', '12 min', 'Comprendre'], ['肩袖肌群', '15 min', 'Comprendre'], ['感受肩胛骨', '12 min', 'Ressentir'], ['手臂的重量', '15 min', 'Ressentir'], ['意识圈', '18 min', 'Ressentir'], ['释放斜方肌', '20 min', 'Préparer'], ['活动肩胛骨', '22 min', 'Préparer'], ['激活前锯肌', '25 min', 'Préparer'], ['胸廓打开', '28 min', 'Préparer'], ['肩部本体感觉', '30 min', 'Préparer'], ['正确的动作', '25 min', 'Exécuter'], ['有意识的上举', '28 min', 'Exécuter'], ['引导外旋', '30 min', 'Exécuter'], ['拉与推', '32 min', 'Exécuter'], ['完整肩部循环', '35 min', 'Exécuter'], ['力量与柔韧 I', '35 min', 'Évoluer'], ['负重肩部', '38 min', 'Évoluer'], ['肩胛平衡', '40 min', 'Évoluer'], ['运动型肩部', '42 min', 'Évoluer'], ['完全掌控', '45 min', 'Évoluer']],
  p2: [['背部解析', '12 min', 'Comprendre'], ['为什么背部疼痛', '15 min', 'Comprendre'], ['颈部及其紧张', '15 min', 'Comprendre'], ['感受脊柱', '12 min', 'Ressentir'], ['骶骨作为基础', '18 min', 'Ressentir'], ['释放腰大肌', '20 min', 'Préparer'], ['腰椎减压', '22 min', 'Préparer'], ['活动胸椎', '25 min', 'Préparer'], ['有意识的猫牛式', '20 min', 'Préparer'], ['释放颈部', '22 min', 'Préparer'], ['深层强化 I', '25 min', 'Exécuter'], ['有意识的平板支撑', '28 min', 'Exécuter'], ['引导臀桥', '28 min', 'Exécuter'], ['脊椎旋转', '30 min', 'Exécuter'], ['背部伸展', '32 min', 'Exécuter'], ['止痛方案 I', '30 min', 'Évoluer'], ['止痛方案 II', '35 min', 'Évoluer'], ['背部与呼吸', '38 min', 'Évoluer'], ['整合脊柱', '40 min', 'Évoluer'], ['完美脊柱', '45 min', 'Évoluer']],
  p3: [['理解髋关节', '2 min 10 s', 'Comprendre', 'https://vz-1a4e2cac-0dc.b-cdn.net/596e732b-fa75-4606-aa8a-45fb034d2e0b/playlist.m3u8'], ['脆弱的膝盖', '15 min', 'Comprendre'], ['被遗忘的脚踝', '12 min', 'Comprendre'], ['感受髋关节', '15 min', 'Ressentir'], ['下半身地图', '20 min', 'Ressentir'], ['髋部活动 I', '20 min', 'Préparer'], ['释放屈肌', '22 min', 'Préparer'], ['髋部活动 II', '25 min', 'Préparer'], ['膝关节灵活性', '20 min', 'Préparer'], ['脚踝动起来', '22 min', 'Préparer'], ['有意识的深蹲 I', '25 min', 'Exécuter'], ['引导弓步', '28 min', 'Exécuter'], ['桥式与髋旋转', '28 min', 'Exécuter'], ['单腿站立', '30 min', 'Exécuter'], ['灵活性循环', '32 min', 'Exécuter'], ['灵活性与普拉提 I', '30 min', 'Évoluer'], ['深层髋部', '35 min', 'Évoluer'], ['膝盖与力量', '38 min', 'Évoluer'], ['后链', '40 min', 'Évoluer'], ['自由下半身', '45 min', 'Évoluer']],
  p4: [['姿势解析', '12 min', 'Comprendre'], ['4条自然曲线', '15 min', 'Comprendre'], ['姿势与疼痛', '15 min', 'Comprendre'], ['感受对齐', '12 min', 'Ressentir'], ['垂直轴', '18 min', 'Ressentir'], ['打开胸腔', '20 min', 'Préparer'], ['激活稳定肌', '22 min', 'Préparer'], ['重新平衡骨盆', '25 min', 'Préparer'], ['对齐颈部', '22 min', 'Préparer'], ['姿势本体感觉', '25 min', 'Préparer'], ['有意识地站立', '25 min', 'Exécuter'], ['有意识地行走', '28 min', 'Exécuter'], ['无痛坐姿', '25 min', 'Exécuter'], ['镜像练习', '30 min', 'Exécuter'], ['负重姿势', '32 min', 'Exécuter'], ['办公方案 I', '25 min', 'Évoluer'], ['办公方案 II', '30 min', 'Évoluer'], ['姿势与呼吸', '35 min', 'Évoluer'], ['平衡的身体', '40 min', 'Évoluer'], ['完美对齐', '45 min', 'Évoluer']],
  p5: [['理解呼吸', '12 min', 'Comprendre'], ['横膈膜', '15 min', 'Comprendre'], ['呼吸与神经', '15 min', 'Comprendre'], ['感受你的呼吸', '10 min', 'Ressentir'], ['三维呼吸', '15 min', 'Ressentir'], ['心脏相干 I', '12 min', 'Préparer'], ['释放横膈膜', '15 min', 'Préparer'], ['侧向呼吸', '18 min', 'Préparer'], ['背部呼吸', '20 min', 'Préparer'], ['骨盆底', '22 min', 'Préparer'], ['普拉提呼吸 I', '20 min', 'Exécuter'], ['呼吸与运动', '25 min', 'Exécuter'], ['心脏相干 II', '20 min', 'Exécuter'], ['呼吸与核心', '28 min', 'Exécuter'], ['完整呼吸序列', '30 min', 'Exécuter'], ['高级技术 I', '25 min', 'Évoluer'], ['呼吸与表现', '30 min', 'Évoluer'], ['呼吸与情绪', '32 min', 'Évoluer'], ['减压呼吸', '35 min', 'Évoluer'], ['呼吸大师', '40 min', 'Évoluer']],
  p6: [['什么是本体感觉', '12 min', 'Comprendre'], ['身体在空间中', '15 min', 'Comprendre'], ['意识与疼痛', '15 min', 'Comprendre'], ['身体扫描 I', '12 min', 'Ressentir'], ['不看也能感受', '15 min', 'Ressentir'], ['静态平衡 I', '15 min', 'Préparer'], ['微运动', '18 min', 'Préparer'], ['不稳定平衡', '20 min', 'Préparer'], ['内在目光', '22 min', 'Préparer'], ['身体地图', '25 min', 'Préparer'], ['缓慢运动 I', '20 min', 'Exécuter'], ['精细协调', '25 min', 'Exécuter'], ['预判与反应', '28 min', 'Exécuter'], ['缓慢运动 II', '30 min', 'Exécuter'], ['有意识的流动', '32 min', 'Exécuter'], ['运动冥想', '25 min', 'Évoluer'], ['有意识的倒转', '30 min', 'Évoluer'], ['筋膜意识', '35 min', 'Évoluer'], ['身体智慧', '38 min', 'Évoluer'], ['存在于身体中', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates与其方法', '12 min', 'Comprendre'], ['垫上6大原则', '15 min', 'Comprendre'], ['核心 — powerhouse', '15 min', 'Comprendre'], ['感受身下的垫子', '12 min', 'Ressentir'], ['骨盆-底连接', '15 min', 'Ressentir'], ['百次 — 入门', '20 min', 'Préparer'], ['有意识的卷起', '22 min', 'Préparer'], ['单腿画圈', '20 min', 'Préparer'], ['滚球练习', '18 min', 'Préparer'], ['核心激活', '22 min', 'Préparer'], ['五式系列', '25 min', 'Exécuter'], ['脊柱前伸', '28 min', 'Exécuter'], ['打开腿摇摆', '30 min', 'Exécuter'], ['天鹅与婴儿', '28 min', 'Exécuter'], ['侧踢系列', '32 min', 'Exécuter'], ['垫上序列 第1级', '35 min', 'Évoluer'], ['垫上序列 第2级', '38 min', 'Évoluer'], ['引导式Teaser', '40 min', 'Évoluer'], ['完整垫上流', '42 min', 'Évoluer'], ['垫上精通', '45 min', 'Évoluer']],
  p8: [['为什么办公室让人疲劳', '5 min', 'Comprendre'], ['颈部与屏幕 — 真正的危险', '5 min', 'Comprendre'], ['整天坐着 — 后果', '6 min', 'Comprendre'], ['感受坐姿紧张', '5 min', 'Ressentir'], ['椅上身体扫描', '7 min', 'Ressentir'], ['坐姿颈部拉伸', '5 min', 'Préparer'], ['手腕和前臂 — 键盘', '6 min', 'Préparer'], ['办公桌前放松肩膀', '7 min', 'Préparer'], ['坐姿背部 — 减压', '8 min', 'Préparer'], ['坐姿髋部 — 释放', '7 min', 'Préparer'], ['办公减压呼吸', '5 min', 'Exécuter'], ['椅上胸椎旋转', '6 min', 'Exécuter'], ['活力微休息 — 3分钟', '3 min', 'Exécuter'], ['坐姿姿势强化', '8 min', 'Exécuter'], ['快速办公循环', '10 min', 'Exécuter'], ['完整活力休息 I', '8 min', 'Évoluer'], ['完整活力休息 II', '10 min', 'Évoluer'], ['抗疲劳屏幕与颈部', '7 min', 'Évoluer'], ['办公晨间例程', '8 min', 'Évoluer'], ['无痛工作日 — 方案', '10 min', 'Évoluer']],
};

const SEANCES_JA = {
  p1: [['肩を理解する', '12 min', 'Comprendre'], ['回旋筋腱板', '15 min', 'Comprendre'], ['肩甲骨を感じる', '12 min', 'Ressentir'], ['腕の重さ', '15 min', 'Ressentir'], ['意識の円', '18 min', 'Ressentir'], ['僧帽筋を解放する', '20 min', 'Préparer'], ['肩甲骨を動かす', '22 min', 'Préparer'], ['前鋸筋を活性化', '25 min', 'Préparer'], ['胸郭を開く', '28 min', 'Préparer'], ['肩の固有受容感覚', '30 min', 'Préparer'], ['正しい動き', '25 min', 'Exécuter'], ['意識的な挙上', '28 min', 'Exécuter'], ['ガイド付き外旋', '30 min', 'Exécuter'], ['引きと押し', '32 min', 'Exécuter'], ['肩の完全サーキット', '35 min', 'Exécuter'], ['筋力と柔軟性 I', '35 min', 'Évoluer'], ['負荷下の肩', '38 min', 'Évoluer'], ['肩甲骨バランス', '40 min', 'Évoluer'], ['アスリートの肩', '42 min', 'Évoluer'], ['完全なマスタリー', '45 min', 'Évoluer']],
  p2: [['背中の解説', '12 min', 'Comprendre'], ['なぜ背中が痛むのか', '15 min', 'Comprendre'], ['首とその緊張', '15 min', 'Comprendre'], ['脊柱を感じる', '12 min', 'Ressentir'], ['仙骨を基盤に', '18 min', 'Ressentir'], ['腸腰筋を解放', '20 min', 'Préparer'], ['腰椎の減圧', '22 min', 'Préparer'], ['胸椎を動かす', '25 min', 'Préparer'], ['意識的なキャット・カウ', '20 min', 'Préparer'], ['首を解放する', '22 min', 'Préparer'], ['深層強化 I', '25 min', 'Exécuter'], ['意識的なプランク', '28 min', 'Exécuter'], ['ガイド付きブリッジ', '28 min', 'Exécuter'], ['脊椎回旋', '30 min', 'Exécuter'], ['背中の伸展', '32 min', 'Exécuter'], ['痛み対策プログラム I', '30 min', 'Évoluer'], ['痛み対策プログラム II', '35 min', 'Évoluer'], ['背中と呼吸', '38 min', 'Évoluer'], ['統合された脊柱', '40 min', 'Évoluer'], ['完璧な脊柱', '45 min', 'Évoluer']],
  p3: [['股関節を理解する', '2 min 10 s', 'Comprendre', 'https://vz-1a4e2cac-0dc.b-cdn.net/596e732b-fa75-4606-aa8a-45fb034d2e0b/playlist.m3u8'], ['脆い膝', '15 min', 'Comprendre'], ['忘れられた足首', '12 min', 'Comprendre'], ['股関節を感じる', '15 min', 'Ressentir'], ['下半身マッピング', '20 min', 'Ressentir'], ['股関節モビリゼーション I', '20 min', 'Préparer'], ['屈筋を解放', '22 min', 'Préparer'], ['股関節モビリゼーション II', '25 min', 'Préparer'], ['膝のモビリティ', '20 min', 'Préparer'], ['足首を活かす', '22 min', 'Préparer'], ['意識的なスクワット I', '25 min', 'Exécuter'], ['ガイド付きランジ', '28 min', 'Exécuter'], ['ブリッジと股関節回旋', '28 min', 'Exécuter'], ['片足立ち', '30 min', 'Exécuter'], ['モビリティサーキット', '32 min', 'Exécuter'], ['モビリティ&ピラティス I', '30 min', 'Évoluer'], ['股関節の深さ', '35 min', 'Évoluer'], ['膝と筋力', '38 min', 'Évoluer'], ['後方チェーン', '40 min', 'Évoluer'], ['自由な下半身', '45 min', 'Évoluer']],
  p4: [['姿勢の解説', '12 min', 'Comprendre'], ['4つの自然なカーブ', '15 min', 'Comprendre'], ['姿勢と痛み', '15 min', 'Comprendre'], ['整列を感じる', '12 min', 'Ressentir'], ['垂直軸', '18 min', 'Ressentir'], ['胸郭を開く', '20 min', 'Préparer'], ['安定筋を活性化', '22 min', 'Préparer'], ['骨盤のバランス', '25 min', 'Préparer'], ['首の整列', '22 min', 'Préparer'], ['姿勢の固有受容感覚', '25 min', 'Préparer'], ['意識的に立つ', '25 min', 'Exécuter'], ['意識的に歩く', '28 min', 'Exécuter'], ['痛みなく座る', '25 min', 'Exécuter'], ['鏡のワーク', '30 min', 'Exécuter'], ['負荷下の姿勢', '32 min', 'Exécuter'], ['デスクプログラム I', '25 min', 'Évoluer'], ['デスクプログラム II', '30 min', 'Évoluer'], ['姿勢と呼吸', '35 min', 'Évoluer'], ['バランスの取れた身体', '40 min', 'Évoluer'], ['完璧な整列', '45 min', 'Évoluer']],
  p5: [['呼吸を理解する', '12 min', 'Comprendre'], ['横隔膜', '15 min', 'Comprendre'], ['呼吸と神経', '15 min', 'Comprendre'], ['自分の呼吸を感じる', '10 min', 'Ressentir'], ['3D呼吸', '15 min', 'Ressentir'], ['心臓コヒーレンス I', '12 min', 'Préparer'], ['横隔膜を解放', '15 min', 'Préparer'], ['側方呼吸', '18 min', 'Préparer'], ['背面呼吸', '20 min', 'Préparer'], ['骨盤底', '22 min', 'Préparer'], ['ピラティス呼吸 I', '20 min', 'Exécuter'], ['呼吸と動き', '25 min', 'Exécuter'], ['心臓コヒーレンス II', '20 min', 'Exécuter'], ['呼吸とコア', '28 min', 'Exécuter'], ['完全呼吸シーケンス', '30 min', 'Exécuter'], ['上級テクニック I', '25 min', 'Évoluer'], ['呼吸とパフォーマンス', '30 min', 'Évoluer'], ['呼吸と感情', '32 min', 'Évoluer'], ['アンチストレス呼吸', '35 min', 'Évoluer'], ['呼吸のマスター', '40 min', 'Évoluer']],
  p6: [['固有受容感覚とは', '12 min', 'Comprendre'], ['空間の中の身体', '15 min', 'Comprendre'], ['意識と痛み', '15 min', 'Comprendre'], ['ボディスキャン I', '12 min', 'Ressentir'], ['見ずに感じる', '15 min', 'Ressentir'], ['静的バランス I', '15 min', 'Préparer'], ['マイクロムーブメント', '18 min', 'Préparer'], ['不安定なバランス', '20 min', 'Préparer'], ['内なる視線', '22 min', 'Préparer'], ['ボディマッピング', '25 min', 'Préparer'], ['ゆっくりした動き I', '20 min', 'Exécuter'], ['精密な協調', '25 min', 'Exécuter'], ['予測と反応', '28 min', 'Exécuter'], ['ゆっくりした動き II', '30 min', 'Exécuter'], ['意識的な流動性', '32 min', 'Exécuter'], ['動く瞑想', '25 min', 'Évoluer'], ['意識的な逆転', '30 min', 'Évoluer'], ['筋膜の意識', '35 min', 'Évoluer'], ['身体知性', '38 min', 'Évoluer'], ['身体の中に在る', '45 min', 'Évoluer']],
  p7: [['ジョセフ・ピラティスと彼の方法', '12 min', 'Comprendre'], ['マットの6原則', '15 min', 'Comprendre'], ['センター — パワーハウス', '15 min', 'Comprendre'], ['マットを感じる', '12 min', 'Ressentir'], ['骨盤底のつながり', '15 min', 'Ressentir'], ['ザ・ハンドレッド — 入門', '20 min', 'Préparer'], ['意識的なロールアップ', '22 min', 'Préparer'], ['シングルレッグサークル', '20 min', 'Préparer'], ['ローリングライクアボール', '18 min', 'Préparer'], ['センターの活性化', '22 min', 'Préparer'], ['5つのシリーズ', '25 min', 'Exécuter'], ['スパインストレッチフォワード', '28 min', 'Exécuter'], ['オープンレッグロッカー', '30 min', 'Exécuter'], ['スワン&チャイルド', '28 min', 'Exécuter'], ['サイドキックシリーズ', '32 min', 'Exécuter'], ['マットシーケンス レベル1', '35 min', 'Évoluer'], ['マットシーケンス レベル2', '38 min', 'Évoluer'], ['ガイド付きティーザー', '40 min', 'Évoluer'], ['フルマットフロー', '42 min', 'Évoluer'], ['マットマスタリー', '45 min', 'Évoluer']],
  p8: [['なぜオフィスは疲れるのか', '5 min', 'Comprendre'], ['首と画面 — 本当の危険', '5 min', 'Comprendre'], ['一日中座る — その影響', '6 min', 'Comprendre'], ['座位の緊張を感じる', '5 min', 'Ressentir'], ['椅子でのボディスキャン', '7 min', 'Ressentir'], ['座位の首ストレッチ', '5 min', 'Préparer'], ['手首と前腕 — キーボード', '6 min', 'Préparer'], ['デスクで肩を解放', '7 min', 'Préparer'], ['座位の背中 — 減圧', '8 min', 'Préparer'], ['座位の股関節 — 解放', '7 min', 'Préparer'], ['デスクでの減圧呼吸', '5 min', 'Exécuter'], ['椅子での胸椎回旋', '6 min', 'Exécuter'], ['アクティブマイクロ休憩 — 3分', '3 min', 'Exécuter'], ['座位の姿勢強化', '8 min', 'Exécuter'], ['エクスプレスデスクサーキット', '10 min', 'Exécuter'], ['フルアクティブ休憩 I', '8 min', 'Évoluer'], ['フルアクティブ休憩 II', '10 min', 'Évoluer'], ['抗疲労 画面と首', '7 min', 'Évoluer'], ['オフィス朝のルーティン', '8 min', 'Évoluer'], ['痛みのない一日 — プロトコル', '10 min', 'Évoluer']],
};

const SEANCES_KO = {
  p1: [['어깨 이해하기', '12 min', 'Comprendre'], ['회전근개', '15 min', 'Comprendre'], ['견갑골 느끼기', '12 min', 'Ressentir'], ['팔의 무게', '15 min', 'Ressentir'], ['인식의 원', '18 min', 'Ressentir'], ['승모근 풀기', '20 min', 'Préparer'], ['견갑골 움직이기', '22 min', 'Préparer'], ['전거근 활성화', '25 min', 'Préparer'], ['흉곽 열기', '28 min', 'Préparer'], ['어깨 고유수용감각', '30 min', 'Préparer'], ['올바른 동작', '25 min', 'Exécuter'], ['의식적 거상', '28 min', 'Exécuter'], ['가이드 외회전', '30 min', 'Exécuter'], ['당기기와 밀기', '32 min', 'Exécuter'], ['완전한 어깨 서킷', '35 min', 'Exécuter'], ['근력 & 유연성 I', '35 min', 'Évoluer'], ['부하 하의 어깨', '38 min', 'Évoluer'], ['견갑골 균형', '40 min', 'Évoluer'], ['운동형 어깨', '42 min', 'Évoluer'], ['완벽한 마스터리', '45 min', 'Évoluer']],
  p2: [['등 해설', '12 min', 'Comprendre'], ['왜 등이 아픈가', '15 min', 'Comprendre'], ['목과 그 긴장', '15 min', 'Comprendre'], ['척추 느끼기', '12 min', 'Ressentir'], ['천골을 기반으로', '18 min', 'Ressentir'], ['장요근 풀기', '20 min', 'Préparer'], ['요추 감압', '22 min', 'Préparer'], ['흉추 움직이기', '25 min', 'Préparer'], ['의식적 캣-카우', '20 min', 'Préparer'], ['목 풀기', '22 min', 'Préparer'], ['심층 강화 I', '25 min', 'Exécuter'], ['의식적 플랭크', '28 min', 'Exécuter'], ['가이드 브릿지', '28 min', 'Exécuter'], ['척추 회전', '30 min', 'Exécuter'], ['등 신전', '32 min', 'Exécuter'], ['통증 대응 프로그램 I', '30 min', 'Évoluer'], ['통증 대응 프로그램 II', '35 min', 'Évoluer'], ['등과 호흡', '38 min', 'Évoluer'], ['통합된 척추', '40 min', 'Évoluer'], ['완벽한 척추', '45 min', 'Évoluer']],
  p3: [['고관절 이해하기', '2 min 10 s', 'Comprendre', 'https://vz-1a4e2cac-0dc.b-cdn.net/596e732b-fa75-4606-aa8a-45fb034d2e0b/playlist.m3u8'], ['취약한 무릎', '15 min', 'Comprendre'], ['잊혀진 발목', '12 min', 'Comprendre'], ['고관절 느끼기', '15 min', 'Ressentir'], ['하체 매핑', '20 min', 'Ressentir'], ['고관절 가동 I', '20 min', 'Préparer'], ['굴곡근 풀기', '22 min', 'Préparer'], ['고관절 가동 II', '25 min', 'Préparer'], ['무릎 유연성', '20 min', 'Préparer'], ['발목 활용하기', '22 min', 'Préparer'], ['의식적 스쿼트 I', '25 min', 'Exécuter'], ['가이드 런지', '28 min', 'Exécuter'], ['브릿지와 고관절 회전', '28 min', 'Exécuter'], ['한 다리 서기', '30 min', 'Exécuter'], ['유연성 서킷', '32 min', 'Exécuter'], ['유연성 & 필라테스 I', '30 min', 'Évoluer'], ['고관절 깊이', '35 min', 'Évoluer'], ['무릎과 근력', '38 min', 'Évoluer'], ['후방 체인', '40 min', 'Évoluer'], ['자유로운 하체', '45 min', 'Évoluer']],
  p4: [['자세 해설', '12 min', 'Comprendre'], ['4가지 자연 커브', '15 min', 'Comprendre'], ['자세와 통증', '15 min', 'Comprendre'], ['정렬 느끼기', '12 min', 'Ressentir'], ['수직축', '18 min', 'Ressentir'], ['흉곽 열기', '20 min', 'Préparer'], ['안정근 활성화', '22 min', 'Préparer'], ['골반 재균형', '25 min', 'Préparer'], ['목 정렬', '22 min', 'Préparer'], ['자세 고유수용감각', '25 min', 'Préparer'], ['의식적으로 서기', '25 min', 'Exécuter'], ['의식적으로 걷기', '28 min', 'Exécuter'], ['통증 없이 앉기', '25 min', 'Exécuter'], ['거울 작업', '30 min', 'Exécuter'], ['부하 하의 자세', '32 min', 'Exécuter'], ['사무실 프로그램 I', '25 min', 'Évoluer'], ['사무실 프로그램 II', '30 min', 'Évoluer'], ['자세와 호흡', '35 min', 'Évoluer'], ['균형 잡힌 몸', '40 min', 'Évoluer'], ['완벽한 정렬', '45 min', 'Évoluer']],
  p5: [['호흡 이해하기', '12 min', 'Comprendre'], ['횡격막', '15 min', 'Comprendre'], ['호흡과 신경', '15 min', 'Comprendre'], ['자신의 호흡 느끼기', '10 min', 'Ressentir'], ['3D 호흡', '15 min', 'Ressentir'], ['심장 코히어런스 I', '12 min', 'Préparer'], ['횡격막 해방', '15 min', 'Préparer'], ['측면 호흡', '18 min', 'Préparer'], ['배면 호흡', '20 min', 'Préparer'], ['골반저', '22 min', 'Préparer'], ['필라테스 호흡 I', '20 min', 'Exécuter'], ['호흡과 움직임', '25 min', 'Exécuter'], ['심장 코히어런스 II', '20 min', 'Exécuter'], ['호흡과 코어', '28 min', 'Exécuter'], ['완전 호흡 시퀀스', '30 min', 'Exécuter'], ['고급 기술 I', '25 min', 'Évoluer'], ['호흡과 퍼포먼스', '30 min', 'Évoluer'], ['호흡과 감정', '32 min', 'Évoluer'], ['스트레스 해소 호흡', '35 min', 'Évoluer'], ['호흡의 달인', '40 min', 'Évoluer']],
  p6: [['고유수용감각이란', '12 min', 'Comprendre'], ['공간 속의 몸', '15 min', 'Comprendre'], ['인식과 통증', '15 min', 'Comprendre'], ['바디 스캔 I', '12 min', 'Ressentir'], ['보지 않고 느끼기', '15 min', 'Ressentir'], ['정적 균형 I', '15 min', 'Préparer'], ['미세 움직임', '18 min', 'Préparer'], ['불안정 균형', '20 min', 'Préparer'], ['내면의 시선', '22 min', 'Préparer'], ['바디 매핑', '25 min', 'Préparer'], ['느린 움직임 I', '20 min', 'Exécuter'], ['세밀한 협응', '25 min', 'Exécuter'], ['예측과 반응', '28 min', 'Exécuter'], ['느린 움직임 II', '30 min', 'Exécuter'], ['의식적 유동성', '32 min', 'Exécuter'], ['움직이는 명상', '25 min', 'Évoluer'], ['의식적 전환', '30 min', 'Évoluer'], ['근막 인식', '35 min', 'Évoluer'], ['신체 지능', '38 min', 'Évoluer'], ['몸 안에 존재하기', '45 min', 'Évoluer']],
  p7: [['조셉 필라테스와 그의 방법', '12 min', 'Comprendre'], ['매트의 6가지 원칙', '15 min', 'Comprendre'], ['센터 — 파워하우스', '15 min', 'Comprendre'], ['매트를 느끼기', '12 min', 'Ressentir'], ['골반-바닥 연결', '15 min', 'Ressentir'], ['더 헌드레드 — 입문', '20 min', 'Préparer'], ['의식적 롤업', '22 min', 'Préparer'], ['싱글 레그 서클', '20 min', 'Préparer'], ['롤링 라이크 어 볼', '18 min', 'Préparer'], ['센터 활성화', '22 min', 'Préparer'], ['5개 시리즈', '25 min', 'Exécuter'], ['스파인 스트레치 포워드', '28 min', 'Exécuter'], ['오픈 레그 로커', '30 min', 'Exécuter'], ['스완 & 차일드', '28 min', 'Exécuter'], ['사이드 킥 시리즈', '32 min', 'Exécuter'], ['매트 시퀀스 레벨 1', '35 min', 'Évoluer'], ['매트 시퀀스 레벨 2', '38 min', 'Évoluer'], ['가이드 티저', '40 min', 'Évoluer'], ['풀 매트 플로우', '42 min', 'Évoluer'], ['매트 마스터리', '45 min', 'Évoluer']],
  p8: [['왜 사무실은 피곤하게 하는가', '5 min', 'Comprendre'], ['목과 화면 — 진짜 위험', '5 min', 'Comprendre'], ['하루 종일 앉기 — 그 결과', '6 min', 'Comprendre'], ['앉은 자세의 긴장 느끼기', '5 min', 'Ressentir'], ['의자에서 바디 스캔', '7 min', 'Ressentir'], ['앉은 자세 목 스트레칭', '5 min', 'Préparer'], ['손목과 전완 — 키보드', '6 min', 'Préparer'], ['책상 앞 어깨 — 풀기', '7 min', 'Préparer'], ['앉은 자세 등 — 감압', '8 min', 'Préparer'], ['앉은 자세 골반 — 풀기', '7 min', 'Préparer'], ['사무실 스트레스 해소 호흡', '5 min', 'Exécuter'], ['의자에서 흉추 회전', '6 min', 'Exécuter'], ['활동적 미니 휴식 — 3분', '3 min', 'Exécuter'], ['앉은 자세 자세 강화', '8 min', 'Exécuter'], ['빠른 사무실 서킷', '10 min', 'Exécuter'], ['완전한 활동적 휴식 I', '8 min', 'Évoluer'], ['완전한 활동적 휴식 II', '10 min', 'Évoluer'], ['피로 방지 화면과 목', '7 min', 'Évoluer'], ['사무실 아침 루틴', '8 min', 'Évoluer'], ['통증 없는 하루 — 프로토콜', '10 min', 'Évoluer']],
};

function getSeances(lang) {
  if (lang === 'en') return SEANCES_EN;
  if (lang === 'es') return SEANCES_ES;
  if (lang === 'it') return SEANCES_IT;
  if (lang === 'de') return SEANCES_DE;
  if (lang === 'pt') return SEANCES_PT;
  if (lang === 'zh') return SEANCES_ZH;
  if (lang === 'ja') return SEANCES_JA;
  if (lang === 'ko') return SEANCES_KO;
  return SEANCES_FR;
}

const ETAPE_COLORS = {
  'Comprendre': 'rgba(0,220,170,0.9)',
  'Ressentir': 'rgba(100,190,255,0.9)',
  'Préparer': 'rgba(255,200,80,0.9)',
  'Exécuter': 'rgba(255,145,100,0.9)',
  'Évoluer': 'rgba(185,135,255,0.9)',
};

/** Couleurs saturées + fonds plus opaques pour lisibilité sur dégradé cyan clair (bas d'écran). */
const PILIERS_BASE = [
  // Ordre = placement autour du cercle (uniforme).
  { key: 'p7', color: 'rgba(255,35,155,1)', bg: 'rgba(255,35,155,0.42)' },
  { key: 'p3', color: 'rgba(0,110,255,1)', bg: 'rgba(0,110,255,0.38)' },
  { key: 'p4', color: 'rgba(245,75,10,1)', bg: 'rgba(245,75,10,0.40)' },
  { key: 'p6', color: 'rgba(185,45,255,1)', bg: 'rgba(185,45,255,0.44)' },
  { key: 'p5', color: 'rgba(55,130,255,1)', bg: 'rgba(55,130,255,0.44)' },
  { key: 'p1', color: 'rgba(0,170,110,1)', bg: 'rgba(0,170,110,0.40)' },
  { key: 'p2', color: 'rgba(255,155,0,1)', bg: 'rgba(255,155,0,0.42)' },
  { key: 'p8', color: 'rgba(0,206,209,1)', bg: 'rgba(0,206,209,0.40)' },
];

const PILIER_LABEL_IDX = { p1: 0, p2: 1, p3: 2, p4: 3, p5: 4, p6: 5, p7: 6, p8: 7 };
function getPiliers(lang) {
  const t = T[lang] || T["fr"];
  return PILIERS_BASE.map((p) => ({ ...p, label: t.piliers[PILIER_LABEL_IDX[p.key]] }));
}

function tentaclePath(bx, by, angle, length, t, phase, amp) {
  const N = 12;
  const cos = Math.cos(angle); const sin = Math.sin(angle);
  const px = -sin; const py = cos;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const dist = s * length;
    const wave = Math.sin(s * Math.PI * 4 - t * 2.5 + phase) * amp * Math.pow(s, 0.5);
    pts.push([bx + cos * dist + px * wave, by + sin * dist + py * wave]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = i > 1 ? pts[i - 2] : pts[0];
    const p1 = pts[i - 1]; const p2 = pts[i];
    const p3 = i < pts.length - 1 ? pts[i + 1] : p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) * 0.25; const cp1y = p1[1] + (p2[1] - p0[1]) * 0.25;
    const cp2x = p2[0] - (p3[0] - p1[0]) * 0.25; const cp2y = p2[1] - (p3[1] - p1[1]) * 0.25;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// ── SUBTITLES (VTT) ──────────────────────────────────────
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

const TENTS2 = [
  { sx:42,  sy:122, angle:Math.PI*0.560, len:300, phase:0.0, amp:16, color:'rgba(220,228,255,0.55)', w:0.9 },
  { sx:68,  sy:135, angle:Math.PI*0.535, len:350, phase:1.4, amp:20, color:'rgba(215,225,255,0.50)', w:0.75},
  { sx:95,  sy:143, angle:Math.PI*0.518, len:320, phase:2.7, amp:18, color:'rgba(225,232,255,0.50)', w:0.80},
  { sx:118, sy:148, angle:Math.PI*0.508, len:400, phase:0.8, amp:26, color:'rgba(218,226,255,0.42)', w:0.62},
  { sx:140, sy:151, angle:Math.PI*0.500, len:440, phase:2.1, amp:30, color:'rgba(220,228,255,0.38)', w:0.55},
  { sx:162, sy:148, angle:Math.PI*0.492, len:400, phase:1.2, amp:26, color:'rgba(218,226,255,0.42)', w:0.62},
  { sx:185, sy:143, angle:Math.PI*0.482, len:320, phase:0.4, amp:18, color:'rgba(225,232,255,0.50)', w:0.80},
  { sx:212, sy:135, angle:Math.PI*0.465, len:350, phase:3.1, amp:20, color:'rgba(215,225,255,0.50)', w:0.75},
  { sx:238, sy:122, angle:Math.PI*0.440, len:300, phase:1.9, amp:16, color:'rgba(220,228,255,0.55)', w:0.9 },
  { sx:82,  sy:140, angle:Math.PI*0.525, len:470, phase:1.0, amp:36, color:'rgba(210,220,255,0.28)', w:0.48},
  { sx:198, sy:140, angle:Math.PI*0.475, len:450, phase:2.5, amp:32, color:'rgba(210,220,255,0.28)', w:0.48},
  { sx:55,  sy:128, angle:Math.PI*0.548, len:260, phase:3.5, amp:14, color:'rgba(222,230,255,0.45)', w:0.70},
  { sx:225, sy:128, angle:Math.PI*0.452, len:260, phase:0.7, amp:14, color:'rgba(222,230,255,0.45)', w:0.70},
];

function IconEpaules({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Path d="M22 62 Q18 46 30 36 Q44 26 44 18 Q44 26 58 36 Q70 46 66 62" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/><Circle cx="44" cy="13" r="6" stroke={color} strokeWidth="3.5" fill="none"/></Svg>; }
function IconDos({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Line x1="44" y1="10" x2="44" y2="78" stroke={color} strokeWidth="3.5" strokeLinecap="round"/><Rect x="38" y="16" width="12" height="8" rx="2.5" stroke={color} strokeWidth="3.5" fill="none"/><Rect x="38" y="29" width="12" height="8" rx="2.5" stroke={color} strokeWidth="3.5" fill="none"/><Rect x="38" y="42" width="12" height="8" rx="2.5" stroke={color} strokeWidth="3.5" fill="none"/><Rect x="38" y="55" width="12" height="8" rx="2.5" stroke={color} strokeWidth="3.5" fill="none"/></Svg>; }
function IconMobilite({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Circle cx="44" cy="44" r="16" stroke={color} strokeWidth="3.5" fill="none"/><Path d="M44 28 A16 16 0 0 1 60 44" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M60 36 L60 44 L52 44" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Path d="M24 44 A20 20 0 0 0 44 64" stroke={color} strokeWidth="2.5" strokeDasharray="4 3" strokeLinecap="round" fill="none" opacity="0.6"/></Svg>; }
function IconPosture({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Circle cx="44" cy="14" r="6" stroke={color} strokeWidth="3.5" fill="none"/><Line x1="44" y1="20" x2="44" y2="54" stroke={color} strokeWidth="3.5" strokeLinecap="round"/><Path d="M28 30 L44 38 L60 30" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Path d="M44 54 L34 72" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M44 54 L54 72" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Line x1="24" y1="8" x2="24" y2="76" stroke={color} strokeWidth="2.5" strokeDasharray="3 3" opacity="0.45"/></Svg>; }
function IconRespiration({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Path d="M8 44 Q18 22 28 44 Q38 66 44 44 Q50 22 60 44 Q70 66 80 44" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M16 54 Q24 44 32 54 Q40 64 48 54 Q56 44 64 54 Q70 50 76 54" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.5"/></Svg>; }
function IconConscience({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Path d="M14 44 Q28 22 44 44 Q58 66 72 44 Q58 22 44 44 Q28 66 14 44Z" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Circle cx="44" cy="44" r="8" stroke={color} strokeWidth="3.5" fill="none"/><Circle cx="44" cy="44" r="3" fill={color}/></Svg>; }
function IconMatPilates({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Circle cx="30" cy="28" r="6" stroke={color} strokeWidth="3.5" fill="none"/><Line x1="30" y1="34" x2="30" y2="56" stroke={color} strokeWidth="3.5" strokeLinecap="round"/><Path d="M30 42 L18 36" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M30 42 L42 36" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M30 56 L22 70" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M30 56 L38 70" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Rect x="10" y="72" width="68" height="6" rx="3" stroke={color} strokeWidth="2.5" fill="none" opacity="0.6"/><Path d="M42 36 C54 26 64 20 74 18" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 3" fill="none" opacity="0.7"/><Circle cx="74" cy="18" r="3.5" fill={color} opacity="0.8"/></Svg>; }
function IconOffice({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Path d="M24 72h40" stroke={color} strokeWidth="3.5" strokeLinecap="round"/><Path d="M30 72V52c0-2 1-3 3-3h22c2 0 3 1 3 3v20" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Path d="M36 49V38c0-2 2-4 4-6l4-4 4 4c2 2 4 4 4 6v11" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Circle cx="44" cy="22" r="6" stroke={color} strokeWidth="3.5" fill="none"/><Path d="M28 72c0 0-2-8-4-8" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/><Path d="M60 72c0 0 2-8 4-8" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/></Svg>; }
const ICONS = { p1: IconEpaules, p2: IconDos, p3: IconMobilite, p4: IconPosture, p5: IconRespiration, p6: IconConscience, p7: IconMatPilates, p8: IconOffice };

/** Bulles ancrées en bas ; translateY positif = sous le bord, puis montée jusqu'en hors écran. */
const BULLE_DEPART_SOUS_BORD = 72;

function Bulle({ delay, x, size, duration, colorIndex }) {
  const a = useRef(new Animated.Value(0)).current;
  const isWhite = (colorIndex != null ? colorIndex : Math.round(x)) % 2 === 1;
  useEffect(() => { setTimeout(() => { Animated.loop(Animated.timing(a, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })).start(); }, delay); }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: x,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.2,
        borderColor: isWhite ? 'rgba(255,255,255,0.5)' : 'rgba(0,189,208,0.5)',
        backgroundColor: isWhite ? 'rgba(255,255,255,0.3)' : 'rgba(0,189,208,0.3)',
        opacity: a.interpolate({ inputRange: [0, 0.04, 0.12, 0.86, 1], outputRange: [0.45, 1, 1, 0.55, 0] }),
        transform: [{
          translateY: a.interpolate({
            inputRange: [0, 1],
            outputRange: [BULLE_DEPART_SOUS_BORD, -(SH + 120)],
          }),
        }],
      }}
    />
  );
}

function Rayon({ left, width, delay, duration, opacity }) {
  const a = useRef(new Animated.Value(opacity * 0.5)).current;
  useEffect(() => { setTimeout(() => { Animated.loop(Animated.sequence([Animated.timing(a, { toValue: opacity, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(a, { toValue: opacity * 0.2, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true })])).start(); }, delay); }, []);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left, width, bottom: 0, backgroundColor: 'rgba(0,255,255,0.12)', opacity: a, transform: [{ skewX: '-5deg' }] }} />;
}

function Meduse() {
  const anim  = useRef(new Animated.Value(0)).current;
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    const id = setInterval(() => { tickRef.current += 0.026; setTick(tickRef.current); }, 36);
    return () => clearInterval(id);
  }, []);

  const N = 20;
  const pts = Array.from({ length: N + 1 }, (_, i) => i / N);
  const bellScale = anim.interpolate({
    inputRange:  pts,
    outputRange: pts.map(t => 1.0 + (IS_IPAD ? 0.22 : 0.11) * Math.sin(Math.PI * t)),
  });
  const floatY = anim.interpolate({
    inputRange:  pts,
    outputRange: pts.map(t => -18 * Math.sin(Math.PI * t)),
  });

  const tentPaths = TENTS2.map(t => tentaclePath(t.sx, t.sy, t.angle, t.len, tick, t.phase, t.amp));

  return (
    <Animated.View style={{ transform: [{ translateY: floatY }], alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ scale: bellScale }] }}>
        <Svg width={260} height={460} viewBox="0 0 280 520" overflow="visible">
          {tentPaths.map((d, i) => (
            <Path key={i} d={d} stroke={TENTS2[i].color} strokeWidth={TENTS2[i].w} fill="none" strokeLinecap="round" />
          ))}
          <Defs>
            <RadialGradient id="bellGrad" cx="50%" cy="28%" rx="55%" ry="60%" fx="48%" fy="22%">
              <Stop offset="0%"   stopColor="#ffffff" stopOpacity="0.75" />
              <Stop offset="20%"  stopColor="#f8faff" stopOpacity="0.58" />
              <Stop offset="45%"  stopColor="#f0f4ff" stopOpacity="0.40" />
              <Stop offset="70%"  stopColor="#e4ecff" stopOpacity="0.22" />
              <Stop offset="88%"  stopColor="#d8e4ff" stopOpacity="0.10" />
              <Stop offset="100%" stopColor="#c8d8f8" stopOpacity="0.04" />
            </RadialGradient>
            <RadialGradient id="topGlow" cx="40%" cy="20%" rx="42%" ry="35%">
              <Stop offset="0%"   stopColor="#ffffff" stopOpacity="0.45" />
              <Stop offset="50%"  stopColor="#f8f8ff" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.00" />
            </RadialGradient>
          </Defs>
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(220,230,255,0.15)" strokeWidth="18" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(230,235,255,0.20)" strokeWidth="10" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(240,242,255,0.30)" strokeWidth="5" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(255,255,255,0.90)" strokeWidth="1.5" />
          <Path d="M 55 62 C 75 28 115 10 160 14 C 190 17 215 32 232 55" fill="none" stroke="rgba(255,255,255,0.70)" strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M 62 58 C 82 26 118 9 158 13" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="rgba(240,245,255,0.28)" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#bellGrad)" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#topGlow)" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2" />
          <Path d="M 140 105 Q 108 88 78  98"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 115 78 100 52"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 132 68 130 38"  stroke="rgba(205,218,255,0.22)" strokeWidth="1.2" fill="none"/>
          <Path d="M 140 105 Q 140 66 140 36"  stroke="rgba(210,220,255,0.26)" strokeWidth="1.4" fill="none"/>
          <Path d="M 140 105 Q 148 68 150 38"  stroke="rgba(205,218,255,0.22)" strokeWidth="1.2" fill="none"/>
          <Path d="M 140 105 Q 165 78 180 52"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 172 88 202 98"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 95  95  68 108"  stroke="rgba(200,212,255,0.20)" strokeWidth="1.1" fill="none"/>
          <Path d="M 140 105 Q 185 95 212 108"  stroke="rgba(200,212,255,0.20)" strokeWidth="1.1" fill="none"/>
          <Path d="M 46 122 Q 62 136 80 132 Q 96 142 112 138 Q 126 144 140 144 Q 154 144 168 138 Q 184 142 200 132 Q 218 136 234 122" stroke="rgba(220,228,255,0.50)" strokeWidth="1.8" fill="none" />
          <Path d="M 58 126 Q 68 134 78 130 Q 88 138 100 134 Q 112 142 124 138 Q 132 144 140 143 Q 148 144 156 138 Q 168 142 180 134 Q 192 138 202 130 Q 212 134 222 126" stroke="rgba(228,235,255,0.35)" strokeWidth="1.2" fill="none" />
          <Path d="M 140 148 C 134 160 126 172 122 186 C 118 198 124 208 130 218 C 124 228 118 240 122 254 C 118 264 112 274 115 288" stroke="rgba(200,210,255,0.65)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          <Path d="M 140 148 C 146 160 154 172 158 186 C 162 198 156 208 150 218 C 156 228 162 240 158 254 C 162 264 168 274 165 288" stroke="rgba(200,210,255,0.65)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          <Path d="M 140 148 C 140 164 138 178 136 192 C 134 204 138 215 140 225 C 142 215 146 204 144 192 C 142 178 140 164 140 148" stroke="rgba(210,218,255,0.58)" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
          <Circle cx="96"  cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
          <Circle cx="184" cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
          <Circle cx="68"  cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
          <Circle cx="212" cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
          <Circle cx="140" cy="28" r="2.8" fill="rgba(240,250,255,0.95)" />
          <Circle cx="120" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
          <Circle cx="160" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/** Même SVG animé que `Meduse`, teinte #00B4D8 — option `breathCycleMs` : respiration 1 → 1,08 → 1. */
const MEDUSE_CORNER_BLUE = '#00B4D8';
function blueMeduse(a) {
  return `rgba(0,180,216,${a})`;
}

function MeduseCornerIcon({ size = 50, breathCycleMs = null, breathMaxScale = 1.08, tint = null }) {
  const anim = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(1)).current;
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  const { bellScale, floatY } = useMemo(() => {
    const N = 20;
    const pts = Array.from({ length: N + 1 }, (_, i) => i / N);
    const amp = IS_IPAD ? 0.14 : 0.12;
    const floatAmp = IS_IPAD ? 12 : 10;
    return {
      bellScale: anim.interpolate({
        inputRange: pts,
        outputRange: pts.map((t) => 1.0 + amp * Math.sin(Math.PI * t)),
      }),
      floatY: anim.interpolate({
        inputRange: pts,
        outputRange: pts.map((t) => -floatAmp * Math.sin(Math.PI * t)),
      }),
    };
  }, [anim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    const id = setInterval(() => {
      tickRef.current += 0.026;
      setTick(tickRef.current);
    }, 36);
    return () => {
      loop.stop();
      clearInterval(id);
    };
  }, [anim]);

  useEffect(() => {
    if (!breathCycleMs) return;
    breath.setValue(1);
    const half = breathCycleMs / 2;
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: breathMaxScale, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 1.0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    breathLoop.start();
    return () => breathLoop.stop();
  }, [breathCycleMs, breath, breathMaxScale]);

  const tentPaths = TENTS2.map(t => tentaclePath(t.sx, t.sy, t.angle, t.len, tick, t.phase, t.amp));
  var mc = tint ? function(a) { return tint.replace('1)', a + ')').replace('rgb(', 'rgba('); } : blueMeduse;
  var mcSolid = tint || MEDUSE_CORNER_BLUE;

  return (
    <Animated.View style={{ width: size, height: size, overflow: 'visible', transform: [{ translateY: floatY }], alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ scale: breathCycleMs ? breath : bellScale }] }}>
        <Svg width={size} height={size} viewBox="0 0 280 520" preserveAspectRatio="xMidYMid meet" overflow="visible">
          {tentPaths.map((d, i) => (
            <Path key={i} d={d} stroke={mc(0.35 + (i % 7) * 0.02)} strokeWidth={TENTS2[i].w} fill="none" strokeLinecap="round" />
          ))}
          <Defs>
            <RadialGradient id="cornerBellGrad" cx="50%" cy="28%" rx="55%" ry="60%" fx="48%" fy="22%">
              <Stop offset="0%" stopColor="#E8F8FC" stopOpacity="0.92" />
              <Stop offset="28%" stopColor={MEDUSE_CORNER_BLUE} stopOpacity="0.62" />
              <Stop offset="58%" stopColor={MEDUSE_CORNER_BLUE} stopOpacity="0.38" />
              <Stop offset="80%" stopColor="#0095B8" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#006884" stopOpacity="0.06" />
            </RadialGradient>
            <RadialGradient id="cornerTopGlow" cx="40%" cy="20%" rx="42%" ry="35%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
              <Stop offset="50%" stopColor="#7FD8EC" stopOpacity="0.22" />
              <Stop offset="100%" stopColor={MEDUSE_CORNER_BLUE} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke={mc(0.35)} strokeWidth="18" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke={mc(0.45)} strokeWidth="10" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke={mc(0.55)} strokeWidth="5" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth="1.5" />
          <Path d="M 55 62 C 75 28 115 10 160 14 C 190 17 215 32 232 55" fill="none" stroke={mc(0.78)} strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M 62 58 C 82 26 118 9 158 13" fill="none" stroke={mc(0.55)} strokeWidth="1.2" strokeLinecap="round" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill={mc(0.34)} />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#cornerBellGrad)" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#cornerTopGlow)" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke={mc(0.72)} strokeWidth="1.2" />
          <Path d="M 140 105 Q 108 88 78  98" stroke={mc(0.35)} strokeWidth="1.3" fill="none" />
          <Path d="M 140 105 Q 115 78 100 52" stroke={mc(0.35)} strokeWidth="1.3" fill="none" />
          <Path d="M 140 105 Q 132 68 130 38" stroke={mc(0.32)} strokeWidth="1.2" fill="none" />
          <Path d="M 140 105 Q 140 66 140 36" stroke={mc(0.38)} strokeWidth="1.4" fill="none" />
          <Path d="M 140 105 Q 148 68 150 38" stroke={mc(0.32)} strokeWidth="1.2" fill="none" />
          <Path d="M 140 105 Q 165 78 180 52" stroke={mc(0.35)} strokeWidth="1.3" fill="none" />
          <Path d="M 140 105 Q 172 88 202 98" stroke={mc(0.35)} strokeWidth="1.3" fill="none" />
          <Path d="M 140 105 Q 95  95  68 108" stroke={mc(0.28)} strokeWidth="1.1" fill="none" />
          <Path d="M 140 105 Q 185 95 212 108" stroke={mc(0.28)} strokeWidth="1.1" fill="none" />
          <Path d="M 46 122 Q 62 136 80 132 Q 96 142 112 138 Q 126 144 140 144 Q 154 144 168 138 Q 184 142 200 132 Q 218 136 234 122" stroke={mc(0.55)} strokeWidth="1.8" fill="none" />
          <Path d="M 58 126 Q 68 134 78 130 Q 88 138 100 134 Q 112 142 124 138 Q 132 144 140 143 Q 148 144 156 138 Q 168 142 180 134 Q 192 138 202 130 Q 212 134 222 126" stroke={mc(0.42)} strokeWidth="1.2" fill="none" />
          <Path d="M 140 148 C 134 160 126 172 122 186 C 118 198 124 208 130 218 C 124 228 118 240 122 254 C 118 264 112 274 115 288" stroke={mc(0.58)} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <Path d="M 140 148 C 146 160 154 172 158 186 C 162 198 156 208 150 218 C 156 228 162 240 158 254 C 162 264 168 274 165 288" stroke={mc(0.58)} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <Path d="M 140 148 C 140 164 138 178 136 192 C 134 204 138 215 140 225 C 142 215 146 204 144 192 C 142 178 140 164 140 148" stroke={mc(0.5)} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <Circle cx="96" cy="60" r="2.2" fill={mc(0.88)} />
          <Circle cx="184" cy="60" r="2.2" fill={mc(0.88)} />
          <Circle cx="68" cy="95" r="1.8" fill={mc(0.72)} />
          <Circle cx="212" cy="95" r="1.8" fill={mc(0.72)} />
          <Circle cx="140" cy="28" r="2.8" fill="rgba(255,255,255,0.92)" />
          <Circle cx="120" cy="22" r="1.5" fill={mc(0.78)} />
          <Circle cx="160" cy="22" r="1.5" fill={mc(0.78)} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/** Placeholder séance sans vidéo Bunny : méduse SVG + flottement vertical (Animated). */
function VideoPlaceholderMeduse({ size }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [float]);
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [8, -16] });
  const tick = 0;
  const tentPaths = TENTS2.map(t => tentaclePath(t.sx, t.sy, t.angle, t.len, tick, t.phase, t.amp));
  const w = size;
  const h = size * (460 / 260);
  return (
    <Animated.View style={{ transform: [{ translateY: floatY }], alignItems: 'center' }}>
      <Svg width={w} height={h} viewBox="0 0 280 520" overflow="visible">
        {tentPaths.map((d, i) => (
          <Path key={i} d={d} stroke={TENTS2[i].color} strokeWidth={TENTS2[i].w} fill="none" strokeLinecap="round" />
        ))}
        <Defs>
          <RadialGradient id="ph_bellGrad" cx="50%" cy="28%" rx="55%" ry="60%" fx="48%" fy="22%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
            <Stop offset="20%" stopColor="#f8faff" stopOpacity="0.58" />
            <Stop offset="45%" stopColor="#f0f4ff" stopOpacity="0.40" />
            <Stop offset="70%" stopColor="#e4ecff" stopOpacity="0.22" />
            <Stop offset="88%" stopColor="#d8e4ff" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#c8d8f8" stopOpacity="0.04" />
          </RadialGradient>
          <RadialGradient id="ph_topGlow" cx="40%" cy="20%" rx="42%" ry="35%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <Stop offset="50%" stopColor="#f8f8ff" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(220,230,255,0.15)" strokeWidth="18" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(230,235,255,0.20)" strokeWidth="10" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(240,242,255,0.30)" strokeWidth="5" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(255,255,255,0.90)" strokeWidth="1.5" />
        <Path d="M 55 62 C 75 28 115 10 160 14 C 190 17 215 32 232 55" fill="none" stroke="rgba(255,255,255,0.70)" strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M 62 58 C 82 26 118 9 158 13" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="rgba(240,245,255,0.28)" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#ph_bellGrad)" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#ph_topGlow)" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2" />
        <Path d="M 140 105 Q 108 88 78  98" stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none" />
        <Path d="M 140 105 Q 115 78 100 52" stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none" />
        <Path d="M 140 105 Q 132 68 130 38" stroke="rgba(205,218,255,0.22)" strokeWidth="1.2" fill="none" />
        <Path d="M 140 105 Q 140 66 140 36" stroke="rgba(210,220,255,0.26)" strokeWidth="1.4" fill="none" />
        <Path d="M 140 105 Q 148 68 150 38" stroke="rgba(205,218,255,0.22)" strokeWidth="1.2" fill="none" />
        <Path d="M 140 105 Q 165 78 180 52" stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none" />
        <Path d="M 140 105 Q 172 88 202 98" stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none" />
        <Path d="M 140 105 Q 95  95  68 108" stroke="rgba(200,212,255,0.20)" strokeWidth="1.1" fill="none" />
        <Path d="M 140 105 Q 185 95 212 108" stroke="rgba(200,212,255,0.20)" strokeWidth="1.1" fill="none" />
        <Path d="M 46 122 Q 62 136 80 132 Q 96 142 112 138 Q 126 144 140 144 Q 154 144 168 138 Q 184 142 200 132 Q 218 136 234 122" stroke="rgba(220,228,255,0.50)" strokeWidth="1.8" fill="none" />
        <Path d="M 58 126 Q 68 134 78 130 Q 88 138 100 134 Q 112 142 124 138 Q 132 144 140 143 Q 148 144 156 138 Q 168 142 180 134 Q 192 138 202 130 Q 212 134 222 126" stroke="rgba(228,235,255,0.35)" strokeWidth="1.2" fill="none" />
        <Path d="M 140 148 C 134 160 126 172 122 186 C 118 198 124 208 130 218 C 124 228 118 240 122 254 C 118 264 112 274 115 288" stroke="rgba(200,210,255,0.65)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <Path d="M 140 148 C 146 160 154 172 158 186 C 162 198 156 208 150 218 C 156 228 162 240 158 254 C 162 264 168 274 165 288" stroke="rgba(200,210,255,0.65)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <Path d="M 140 148 C 140 164 138 178 136 192 C 134 204 138 215 140 225 C 142 215 146 204 144 192 C 142 178 140 164 140 148" stroke="rgba(210,218,255,0.58)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <Circle cx="96" cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
        <Circle cx="184" cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
        <Circle cx="68" cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
        <Circle cx="212" cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
        <Circle cx="140" cy="28" r="2.8" fill="rgba(240,250,255,0.95)" />
        <Circle cx="120" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
        <Circle cx="160" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
      </Svg>
    </Animated.View>
  );
}


const BULLES = [
  { x: 337, size: 2, delay: 409,   duration: 11506 },
  { x: 135, size: 3, delay: 2286,  duration: 8679  },
  { x: 356, size: 5, delay: 1424,  duration: 13912 },
  { x: 26,  size: 2, delay: 1535,  duration: 10582 },
  { x: 129, size: 5, delay: 9863,  duration: 7434  },
  { x: 297, size: 3, delay: 11731, duration: 15928 },
  { x: 224, size: 3, delay: 7359,  duration: 11557 },
  { x: 13,  size: 3, delay: 11438, duration: 13924 },
  { x: 184, size: 3, delay: 2547,  duration: 10527 },
  { x: 182, size: 2, delay: 1519,  duration: 13224 },
  { x: 59,  size: 4, delay: 5635,  duration: 11333 },
  { x: 32,  size: 5, delay: 8785,  duration: 9045  },
  { x: 203, size: 2, delay: 9044,  duration: 11803 },
  { x: 331, size: 6, delay: 5925,  duration: 10150 },
  { x: 370, size: 2, delay: 750,   duration: 10733 },
  { x: 158, size: 2, delay: 3814,  duration: 8654  },
  { x: 204, size: 3, delay: 7428,  duration: 12977 },
  { x: 93,  size: 4, delay: 5820,  duration: 10432 },
  { x: 353, size: 3, delay: 11498, duration: 8169  },
  { x: 321, size: 7, delay: 2803,  duration: 15751 },
  { x: 135, size: 3, delay: 7573,  duration: 13216 },
  { x: 148, size: 7, delay: 11274, duration: 10598 },
  { x: 360, size: 4, delay: 916,   duration: 10752 },
  { x: 26,  size: 4, delay: 6572,  duration: 11386 },
  { x: 43,  size: 3, delay: 9292,  duration: 12155 },
  { x: 118, size: 7, delay: 8179,  duration: 13482 },
  { x: 339, size: 5, delay: 2340,  duration: 11339 },
  { x: 81,  size: 3, delay: 9197,  duration: 15830 },
  { x: 144, size: 6, delay: 7019,  duration: 13543 },
  { x: 195, size: 3, delay: 2266,  duration: 15348 },
  { x: 262, size: 2, delay: 771,   duration: 8796  },
];

/** Moins dense qu'avant : 24 bulles × 3 décalages (les autres écrans gardent `BULLES` complet). */
const BULLES_MONCORPS_BASE = BULLES.slice(0, 10);
const BULLES_MONCORPS = [
  ...BULLES_MONCORPS_BASE,
];

/** Onboarding : quelques vagues décalées + bulles en plus (moins dense que la version max). */
const BULLES_ONBOARDING = BULLES.slice(0, 12);

function CelebrationOverlay({ visible, onDone, pilier, lang }) {
  const tr = T[lang] || T['fr'];
  const scaleAnim  = useRef(new Animated.Value(0)).current;
  const opacAnim   = useRef(new Animated.Value(0)).current;
  const medalAnim  = useRef(new Animated.Value(0)).current;
  const particles  = useRef(Array.from({ length: 18 }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    o: new Animated.Value(1),
    s: new Animated.Value(0),
    dx: (Math.random() - 0.5) * 320,
    dy: -(80 + Math.random() * 280),
  }))).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(opacAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(medalAnim, { toValue: 1,  duration: 400, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.timing(medalAnim, { toValue: 0.9,duration: 200, easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
      Animated.timing(medalAnim, { toValue: 1,  duration: 200, easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
    ]).start();
    particles.forEach((p, i) => {
      setTimeout(() => {
        p.s.setValue(0.4 + Math.random() * 0.6);
        Animated.parallel([
          Animated.timing(p.x, { toValue: p.dx, duration: 900 + Math.random()*400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(p.y, { toValue: p.dy, duration: 900 + Math.random()*400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(p.o, { toValue: 0,    duration: 1100 + Math.random()*300, useNativeDriver: true }),
        ]).start();
      }, i * 40);
    });
    setTimeout(onDone, 3200);
  }, [visible]);

  if (!visible) return null;
  const EMOJIS = ['\u2728', U_WAVE, U_DROP, U_STAR, '\uD83E\uDEA7', '\uD83D\uDCAB', '\uD83C\uDF38'];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,5,15,0.82)', opacity: opacAnim }} />
      {particles.map((p, i) => (
        <Animated.Text key={i} style={{ position: 'absolute', fontSize: 18, transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.s }], opacity: p.o }}>
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
        width: 300,
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
      </Animated.View>
    </View>
  );
}

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

function VideoPlayer({ seance, pilier, onClose, onComplete, lang, seanceIndex, isDemo, onDemoLimit }) {
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
    if (!msDur) return '−00:00';
    const rem = Math.max(0, msDur - (msPos || 0));
    const s = Math.floor(rem / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `−${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `−${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
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
    saveHealthKitWorkout(minutes);
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
                  {active && <Text style={{ fontSize: 12, color: '#AEEF4D' }}>✓</Text>}
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
                  <Text style={{ fontSize: 22, color: '#fff', fontWeight: '300' }}>✕</Text>
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

function PilierPanel({ pilier, done, onToggle, onClose, lang, isRecommended, isSubscriber, onActivateSubscription, sdjIndex }) {
  const tr = T[lang] || T['fr'];
  const seances = getSeances(lang)[pilier.key] || [];
  const doneCount = (done || []).filter(Boolean).length;
  const [activeVideo, setActiveVideo] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showDemoLimit, setShowDemoLimit] = useState(false);
  const [resumeIndices, setResumeIndices] = useState(() => new Set());

  var ppMedusas = useRef([
    { x: new Animated.Value(SW - 80), y: new Animated.Value(40), size: 70 },
    { x: new Animated.Value(20), y: new Animated.Value(SH * 0.06), size: 54 },
    { x: new Animated.Value(SW * 0.4), y: new Animated.Value(SH * 0.1), size: 42 },
  ]).current;

  useEffect(function() {
    ppMedusas.forEach(function(m) {
      function drift() {
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 40 + Math.random() * (SH - m.size - 140);
        var dur = 10000 + Math.random() * 6000;
        Animated.parallel([
          Animated.timing(m.x, { toValue: toX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
          Animated.timing(m.y, { toValue: toY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
        ]).start(function() { drift(); });
      }
      setTimeout(function() { drift(); }, Math.random() * 2000);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await getResumeIndicesForPilier(pilier.key);
      if (!cancelled) setResumeIndices(next);
    })();
    return () => { cancelled = true; };
  }, [pilier.key, activeVideo]);

  function tryOpenSeance(i) {
    if (i !== sdjIndex && !canAccessSeanceIndex(i, isSubscriber)) {
      onActivateSubscription?.();
      return;
    }
    hapticLight();
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
          onComplete={() => { onToggle(activeVideo); setActiveVideo(null); setShowCelebration(true); }}
          onDemoLimit={() => setShowDemoLimit(true)}
        />
        {showDemoLimit && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)', paddingVertical: 24, paddingHorizontal: 28, alignItems: 'center', zIndex: 50 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', textAlign: 'center', marginBottom: 12 }}>{tr.demo_limit}</Text>
            <TouchableOpacity onPress={() => { setShowDemoLimit(false); setActiveVideo(null); if (onActivateSubscription) onActivateSubscription(); }} style={{ backgroundColor: '#E5FF00', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 25 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#000000' }}>{tr.paywall_start}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    );
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.18} />
      <Rayon left={280} width={40} delay={4000} duration={8000} opacity={0.12} />
      {BULLES.map((b, i) => <Bulle key={i} {...b} />)}{IS_IPAD && BULLES.map((b, i) => <Bulle key={'r'+i} delay={b.delay + 2000} x={b.x + SW * 0.35} size={b.size} duration={b.duration} />)}{IS_IPAD && BULLES.map((b, i) => <Bulle key={'r2'+i} delay={b.delay + 5000} x={b.x + SW * 0.65} size={b.size} duration={b.duration} />)}
      {ppMedusas.map(function(m, i) {
        return (
          <Animated.View key={'ppm-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 2, opacity: 0.9, left: m.x, top: m.y }}>
            <MeduseCornerIcon size={m.size} breathCycleMs={3000 + i * 600} breathMaxScale={1.35} tint="rgba(174,239,77,1)" />
          </Animated.View>
        );
      })}
      <View style={{ paddingTop: 54, paddingHorizontal: 22, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={{ paddingVertical: 8, paddingHorizontal: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#E5FF00', letterSpacing: 1.5, textTransform: 'uppercase' }}>{tr.retour}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: IS_IPAD ? 44 : 40, fontWeight: '200', color: 'rgba(195,242,255,0.94)', letterSpacing: -0.3 }}>{pilier.label}</Text>
          {isRecommended && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(0,215,255,0.2)', borderWidth: 1, borderColor: 'rgba(0,215,255,0.7)' }}>
              <Text style={{ fontSize: 9, color: 'rgba(0,220,255,0.9)', letterSpacing: 1 }}>★ {tr.recommande_pour_toi}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 10, color: pilier.color, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.seances_done(doneCount)}</Text>
        <View style={{ height: 3, backgroundColor: 'rgba(0,200,240,0.1)', borderRadius: 2, marginTop: 10, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ height: 3, flex: doneCount / 20, backgroundColor: pilier.color, borderRadius: 2 }} />
        </View>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        {seances.map(([titre, duree, etape], i) => {
          const isDone = done[i] === true || done[i] === 'true';
          const locked = i !== sdjIndex && !canAccessSeanceIndex(i, isSubscriber);
          return (
            <TouchableOpacity key={i} onPress={() => tryOpenSeance(i)} activeOpacity={0.88} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12, height: 110, opacity: locked ? 0.4 : 1 }}>
              <ImageBackground source={PILIER_IMAGES[pilier.key]} resizeMode="cover" style={{ flex: 1 }}>
                <LinearGradient colors={isDone ? ['rgba(0,30,22,0.75)', 'rgba(0,30,22,0.85)'] : locked ? ['rgba(0,14,24,0.75)', 'rgba(0,14,24,0.9)'] : ['rgba(0,14,24,0.55)', 'rgba(0,14,24,0.8)']} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Text style={{ fontSize: 18, color: isDone ? 'rgba(0,230,160,0.95)' : '#ffffff' }}>{isDone ? '✓' : '▶'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: isDone ? 'rgba(0,220,150,0.9)' : '#ffffff', marginBottom: 6 }} numberOfLines={1}>{titre}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,195,240,0.15)', color: ETAPE_COLORS[etape], letterSpacing: 0.5 }}>{tr.etapes[etape] || etape}</Text>
                      <Text style={{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,195,240,0.15)', color: 'rgba(0,212,248,0.8)' }}>{duree}</Text>
                      {resumeIndices.has(i) && !locked ? (
                        <Text style={{ fontSize: 9, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,235,200,0.2)', color: 'rgba(0,245,220,0.95)', fontWeight: '600' }}>{tr.reprise_badge}</Text>
                      ) : null}
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', fontWeight: '300' }}>{String(i + 1).padStart(2, '0')}</Text>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>
      <CelebrationOverlay visible={showCelebration} onDone={() => setShowCelebration(false)} pilier={pilier} lang={lang} />
    </View>
  );
}

const CARD_W = Math.floor((SW - 48) / 2);
const CARD_H = Math.floor(CARD_W * 0.75);

const PILIER_IMAGES = {
  p1: require("./assets/piliers/epaules.jpg"),
  p2: require("./assets/piliers/dos.jpg"),
  p3: require("./assets/piliers/mobilite.jpg"),
  p4: require("./assets/piliers/posture.jpg"),
  p5: require("./assets/piliers/eldoa.jpg"),
  p6: require("./assets/piliers/golf.jpg"),
  p7: require("./assets/piliers/mat_pilates.jpg"),
  p8: require("./assets/piliers/office.jpg"),
  sdj: require("./assets/piliers/seance_du_jour.jpg"),
};
const COACH_IMAGE = require("./assets/coach.jpg");

function PilierCard({ pilier, doneCount, onPress, recommended, lang, imageKey }) {
  var tr = T[lang] || T["fr"];
  var imgSrc = PILIER_IMAGES[imageKey || pilier.key];
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      accessibilityLabel={pilier.label}
      accessibilityRole="button"
      onPress={function() { hapticLight(); onPress(pilier); }}
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: 20,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 10,
      }}
    >
      <LinearGradient
        colors={["#000e18", pilier.bg, pilier.color]}
        locations={[0.0, 0.55, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ flex: 1 }}
      >
        <ImageBackground
          source={imgSrc}
          resizeMode={pilier.key === 'p8' ? 'contain' : 'cover'}
          style={{ flex: 1 }}
          imageStyle={{ opacity: 0.70 }}
        >
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.65)"]}
            locations={[0.3, 1]}
            style={{ flex: 1, padding: 14, justifyContent: "flex-end" }}
          >
            {recommended && (
              <View style={{ position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(0,215,255,0.22)", borderWidth: 1, borderColor: "rgba(0,215,255,0.6)" }}>
                <Text style={{ fontSize: 8, color: "rgba(0,225,255,0.95)", fontWeight: "700", letterSpacing: 0.5 }}>{"\u2605"} {tr.recommande_pour_toi}</Text>
              </View>
            )}
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>{pilier.label}</Text>
          </LinearGradient>
        </ImageBackground>
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** Tuiles SÉANCES / STREAK / PROGRESSION — verre (BlurView) comme les contrôles vidéo. */
function MetricTile({ children }) {
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.metricShell, styles.metricWebFallback]}>
        <View style={styles.metricBlurInner}>{children}</View>
      </View>
    );
  }
  return (
    <View style={styles.metricShell}>
      <BlurView intensity={Platform.OS === 'ios' ? 34 : 26} tint="dark" style={styles.metricBlurInner}>
        {children}
      </BlurView>
    </View>
  );
}

function MonCorps({ prenom, done, toggleDone, lang, tensionIdxs, streak, isSubscriber, onActivateSubscription, onTryFreeSession }) {
  var tr = T[lang] || T["fr"];
  var [openPilier, setOpenPilier] = useState(null);
  var [mcTab, setMcTab] = useState('pour_vous');
  var [showCreateProg, setShowCreateProg] = useState(false);
  var [savedPrograms, setSavedPrograms] = useState([]);

  useEffect(function() { loadSavedPrograms(); }, []);
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
  var MC_TABS = ['pour_vous', 'explorer', 'programmes', 'recherche'];
  var mcTabLabels = { pour_vous: tr.tab_pour_vous, explorer: tr.tab_explorer, programmes: tr.tab_programmes, recherche: tr.tab_recherche };
  var piliers = getPiliers(lang);
  var recommendedPiliers = tensionIdxs.map(function(i) { return ZONE_TO_PILIER[i]; });
  var effectiveRecommended = recommendedPiliers.length > 0 ? recommendedPiliers : [];
  var sdj = getSeanceDuJour(done, tensionIdxs, lang);

  var mcMedusas = useRef([
    { x: new Animated.Value(20), y: new Animated.Value(SH * 0.05), size: 72, speed: 0.8, cx: 20, cy: SH * 0.05 },
    { x: new Animated.Value(SW * 0.7), y: new Animated.Value(SH * 0.1), size: 58, speed: 0.9, cx: SW * 0.7, cy: SH * 0.1 },
    { x: new Animated.Value(SW * 0.4), y: new Animated.Value(SH * 0.15), size: 64, speed: 0.85, cx: SW * 0.4, cy: SH * 0.15 },
    { x: new Animated.Value(SW * 0.85), y: new Animated.Value(SH * 0.08), size: 50, speed: 0.75, cx: SW * 0.85, cy: SH * 0.08 },
  ]).current;

  useEffect(function() {
    mcMedusas.forEach(function(m) {
      function drift() {
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 40 + Math.random() * (SH - m.size - 140);
        var dur = 12000 + Math.random() * 8000;
        Animated.parallel([
          Animated.timing(m.x, { toValue: toX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
          Animated.timing(m.y, { toValue: toY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
        ]).start(function() { drift(); });
      }
      setTimeout(function() { drift(); }, Math.random() * 3000);
    });
  }, []);

  var sortedPiliers = [...piliers].sort(function(a, b) {
    var aRec = effectiveRecommended.includes(a.key) ? 0 : 1;
    var bRec = effectiveRecommended.includes(b.key) ? 0 : 1;
    return aRec - bRec;
  });

  return (
    <View style={styles.screen}>
      <LinearGradient colors={["#000e18", "#001828", "#002d48", "#005878", "#00bdd0"]} locations={[0, 0.2, 0.45, 0.70, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: "none" }}>
        <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.18} />
        <Rayon left={140} width={55} delay={2000} duration={11000} opacity={0.15} />
        <Rayon left={280} width={40} delay={4000} duration={8000} opacity={0.12} />
      </View>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: "none", overflow: "visible" }}>
        {BULLES_MONCORPS.map(function(b, i) { return <Bulle key={"mc-" + i} {...b} />; })}
        {IS_IPAD && BULLES_MONCORPS.map(function(b, i) { return <Bulle key={"mc-ipad1-" + i} delay={b.delay + 2000} x={Math.max(0, Math.min(SW - 8, b.x + SW * 0.35))} size={b.size} duration={b.duration} />; })}
        {IS_IPAD && BULLES_MONCORPS.map(function(b, i) { return <Bulle key={"mc-ipad2-" + i} delay={b.delay + 5000} x={Math.max(0, Math.min(SW - 8, b.x + SW * 0.65))} size={b.size} duration={b.duration} />; })}
      </View>
      {mcTab !== 'programmes' && mcMedusas.map(function(m, i) {
        return (
          <Animated.View key={'mcm-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 4, opacity: 1, left: m.x, top: m.y }}>
            <MeduseCornerIcon size={m.size} breathCycleMs={2800 + i * 500} breathMaxScale={1.35} tint="rgba(174,239,77,1)" />
          </Animated.View>
        );
      })}
      <View style={[styles.logoRow, { justifyContent: "space-between", paddingLeft: 20, paddingRight: 20, paddingTop: 10, marginBottom: 20, flexDirection: 'row', alignItems: 'center' }]} pointerEvents="box-none">
        <Text style={styles.logoWordmark} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          FLUIDBODY<Text style={{ fontWeight: "900", color: "#AEEF4D", fontSize: 34 }}>+</Text>
        </Text>
        {prenom ? <Text style={{ fontSize: 14, fontWeight: '300', color: 'rgba(174,239,77,0.6)' }}>{tr.bonjour(prenom)}</Text> : null}
      </View>
      <View style={{ position: "absolute", top: 105, left: 0, right: 0, zIndex: 5, marginTop: 20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {MC_TABS.map(function(t) {
            var active = mcTab === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={function() { setMcTab(t); }}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: active ? "#ffffff" : "rgba(255,255,255,0.12)",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: active ? "#000000" : "#ffffff" }}>
                  {mcTabLabels[t]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView
        key={mcTab}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 3 }}
        contentContainerStyle={{ paddingTop: 170, paddingBottom: 120, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {mcTab === 'pour_vous' && (
          <TouchableOpacity onPress={function() { var p = piliers.find(function(x) { return x.key === 'p8'; }); if (p) setOpenPilier(p); }} activeOpacity={0.9} style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,206,209,0.5)' }}>
            <LinearGradient colors={['rgba(0,206,209,0.2)', 'rgba(0,18,38,0.8)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
              <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,206,209,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 18h16M6 18V10c0-1 1-2 2-2h8c1 0 2 1 2 2v8" stroke="#00CED1" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx="12" cy="5" r="3" stroke="#00CED1" strokeWidth={1.5} />
                  <Path d="M9 14h6" stroke="#00CED1" strokeWidth={1.4} strokeLinecap="round" />
                </Svg>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: '#00CED1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>{tr.pause_bureau_tag || 'Pause active'}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{tr.pause_bureau_title || '5 min au bureau'}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{tr.pause_bureau_sub || 'Étire-toi sans quitter ta chaise'}</Text>
              </View>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#00CED1', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, color: '#000' }}>▶</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {mcTab === 'explorer' && sdj && (
          <TouchableOpacity onPress={function() { if (onTryFreeSession) onTryFreeSession(); }} activeOpacity={0.9} style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#AEEF4D' }}>
            <ImageBackground source={PILIER_IMAGES[sdj.pilier.key]} resizeMode="cover" style={{ height: 110 }}>
              <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.85)']} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Text style={{ fontSize: 20, color: '#000000' }}>▶</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <View style={{ backgroundColor: '#FF3B30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff', letterSpacing: 1 }}>NOUVEAU</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#ffffff' }}>{sdj.seance[0]}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{sdj.pilier.label} · {sdj.seance[1]}</Text>
                </View>
              </LinearGradient>
            </ImageBackground>
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
          return (
            <View key="pour-vous">
              <View style={{ flexDirection: "row", gap: gridGap, marginBottom: gridGap }}>
                <View style={{ width: halfW, height: rowH1, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[0]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ width: halfW, height: rowH1, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[1]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: gridGap, marginBottom: gridGap }}>
                <View style={{ width: thirdW, height: rowH2, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[2]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ width: thirdW, height: rowH2, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[3]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ width: thirdW, height: rowH2, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[4]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: gridGap, marginBottom: 0 }}>
                <View style={{ width: halfW, height: rowH1, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[5]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ width: halfW, height: rowH1, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[6]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
              </View>
              <LinearGradient colors={["rgba(28,28,30,0.3)", "rgba(28,28,30,0.85)", "rgba(28,28,30,0.95)"]} locations={[0, 0.3, 1]} style={{ borderRadius: 16, marginTop: -60, paddingTop: 90, paddingBottom: 80, paddingHorizontal: 20, alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", textAlign: "center", marginBottom: 6 }}>{tr.paywall_title}</Text>
                <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 17, marginBottom: 14 }}>{tr.paywall_sub}</Text>
                <TouchableOpacity
                  onPress={function() { onActivateSubscription && onActivateSubscription(); }}
                  activeOpacity={0.85}
                  style={{ alignSelf: "stretch", height: 46, borderRadius: 23, backgroundColor: "#E5FF00", alignItems: "center", justifyContent: "center", marginBottom: 8 }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#000000", letterSpacing: 0.3 }}>{tr.paywall_start}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>{tr.paywall_per_month ? "CHF 9.90" + tr.paywall_per_month : ""}</Text>
                <TouchableOpacity onPress={function() { onActivateSubscription && onActivateSubscription(); }} activeOpacity={0.8}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#ffffff" }}>{tr.paywall_yearly_link}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          );
        })()}
        {mcTab === 'programmes' && (
          <View key="programmes">
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
                          <Text style={{ fontSize: 12, color: 'rgba(255,100,100,0.7)' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {progPiliers.map(function(p) {
                          return (
                            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.1)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)' }}>
                              <View style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden' }}>
                                <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} />
                              </View>
                              <Text style={{ fontSize: 12, color: '#AEEF4D' }}>{p.label}</Text>
                            </View>
                          );
                        })}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 16 }}>
                        <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.6)' }}>{prog.duree} / {tr.resume_seances ? 'séance' : 'session'}</Text>
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
          return (
            <View key="explorer-sections">
              {piliers.map(function(p) {
                var ps = seancesData[p.key] || [];
                var doneCount = done[p.key] ? done[p.key].filter(Boolean).length : 0;
                return (
                  <TouchableOpacity
                    key={"exp-" + p.key}
                    activeOpacity={0.88}
                    onPress={function() { setOpenPilier(p); }}
                    style={{ marginBottom: 16, borderRadius: 16, overflow: "hidden", height: cardH }}
                  >
                    <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} imageStyle={p.key === 'p8' ? { top: -20 } : undefined}>
                      <LinearGradient colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.7)"]} style={{ flex: 1, justifyContent: "flex-end", padding: 16 }}>
                        <Text style={{ fontSize: 24, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{p.label}</Text>
                        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{ps.length} {tr.m_seances} · {doneCount}/{ps.length}</Text>
                      </LinearGradient>
                    </ImageBackground>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })()}
        {mcTab === 'recherche' && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
          {sortedPiliers.map(function(p) {
            return <PilierCard key={p.key} pilier={p} doneCount={done[p.key] ? done[p.key].filter(Boolean).length : 0} onPress={setOpenPilier} recommended={effectiveRecommended.includes(p.key)} lang={lang} />;
          })}
        </View>
        )}
      </ScrollView>
      {openPilier && (
        <PilierPanel pilier={openPilier} done={done[openPilier.key] || Array(20).fill(false)} onToggle={function(idx) { toggleDone(openPilier.key, idx); }} onClose={function() { setOpenPilier(null); }} lang={lang} isRecommended={effectiveRecommended.includes(openPilier.key)} isSubscriber={isSubscriber} onActivateSubscription={onActivateSubscription} sdjIndex={sdj && sdj.pilier && sdj.pilier.key === openPilier.key ? sdj.idx : null} />
      )}
      <CreateProgramScreen visible={showCreateProg} onClose={function() { setShowCreateProg(false); }} lang={lang} onSaved={loadSavedPrograms} />
    </View>
  );
}

/** Abonnement vidéos simulé — pas de module IAP dans l'app. */
const FLUID_SUB_KEY = 'fluid_sub';
const DONE_KEY = 'fluidbody_done';
const STREAK_KEY = 'fluidbody_streak';
const STREAK_DATE_KEY = 'fluidbody_streak_date';
/** Dernière demande OTP email — évite un 2ᵉ envoi si l'utilisateur repasse par « J'ai déjà un compte » ou rouvre l'écran. */
const AUTH_OTP_PENDING_KEY = 'fluid_auth_otp_pending_v1';
const AUTH_OTP_RESEND_COOLDOWN_MS = 90 * 1000;
const AUTH_OTP_STEP_RESTORE_MS = 25 * 60 * 1000;

function getPriceString(p) {
  if (!p) return '';
  if (typeof p.priceString === 'string' && p.priceString.trim()) return p.priceString.trim();
  if (typeof p.localizedPrice === 'string' && p.localizedPrice.trim()) return p.localizedPrice.trim();
  if (p.price != null && p.currencyCode) return `${p.price} ${p.currencyCode}`;
  if (p.price != null) return String(p.price);
  return '';
}

function getRcPriceString(pkg) {
  const p = pkg?.product;
  if (!p) return '';
  if (typeof p.priceString === 'string' && p.priceString.trim()) return p.priceString.trim();
  if (typeof p.localizedPriceString === 'string' && p.localizedPriceString.trim()) return p.localizedPriceString.trim();
  if (typeof p.localizedPrice === 'string' && p.localizedPrice.trim()) return p.localizedPrice.trim();
  if (p.price != null && p.currencyCode) return `${p.price} ${p.currencyCode}`;
  if (p.price != null) return String(p.price);
  return '';
}

var JOUR_LABELS = { fr: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], de: ['Mo','Di','Mi','Do','Fr','Sa','So'], pt: ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'], zh: ['一','二','三','四','五','六','日'], ja: ['月','火','水','木','金','土','日'], ko: ['월','화','수','목','금','토','일'], es: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'], it: ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'] };

async function scheduleProgNotifications(prog, idx, lang) {
  if (!Notifications) return [];
  try {
    var status = await Notifications.requestPermissionsAsync();
    if (status.status !== 'granted') return [];
  } catch(e) { return []; }
  var tr = T[lang] || T['fr'];
  var pilierNames = getPiliers(lang).filter(function(p) { return prog.piliers.includes(p.key); }).map(function(p) { return p.label; });
  var pilierStr = pilierNames.join(', ');
  var hour = prog.notifHour || 8;
  var ids = [];
  var selectedDays = prog.selectedDays || [1, 2, 3, 4, 5];
  for (var d = 0; d < selectedDays.length; d++) {
    try {
      var weekday = selectedDays[d] + 1;
      if (weekday > 7) weekday = 1;
      var id = await Notifications.scheduleNotificationAsync({
        content: { title: 'FluidBody+ 💪', body: (tr.prog_notif_body || "C'est l'heure de ta séance") + ' ' + pilierStr + ' · ' + prog.duree, sound: true },
        trigger: { weekday: weekday, hour: hour, minute: 0, repeats: true },
      });
      ids.push(id);
    } catch(e) {}
  }
  return ids;
}

async function cancelProgNotifications(notifIds) {
  if (!Notifications || !notifIds) return;
  for (var i = 0; i < notifIds.length; i++) {
    try { await Notifications.cancelScheduledNotificationAsync(notifIds[i]); } catch(e) {}
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
    var prog = { piliers: selected, duree: dureeOptions[duree], jours: joursOptions[jours - 2 < 0 ? 0 : jours - 2], date: new Date().toISOString(), notifHour: notifHour, selectedDays: selectedDays };
    var notifIds = await scheduleProgNotifications(prog, 0, lang);
    prog.notifIds = notifIds;
    try {
      var raw = await AsyncStorage.getItem('fluid_custom_programs');
      var list = raw ? JSON.parse(raw) : [];
      list.push(prog);
      await AsyncStorage.setItem('fluid_custom_programs', JSON.stringify(list));
    } catch(e) {}
    setSaved(true);
    setTimeout(function() { if (onSaved) onSaved(); onClose(); setSaved(false); }, 1500);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000e18" }}>
        <LinearGradient colors={['#000e18', '#002d48', '#005878']} style={StyleSheet.absoluteFill} />
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
                    <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} />
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
              <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>−</Text>
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

function PaywallModal({ visible, onClose, lang, packagesByProductId, loadingPrices, disabled, onBuyMonthly, onBuyYearly, onRestore, onTryFree }) {
  var tr = T[lang] || T["fr"];
  var monthlyPkg = packagesByProductId && packagesByProductId[PRODUCT_IDS.monthly];
  var yearlyPkg = packagesByProductId && packagesByProductId[PRODUCT_IDS.yearly];
  var monthlyPrice = getRcPriceString(monthlyPkg);
  var yearlyPrice = getRcPriceString(yearlyPkg);
  var showYearly = !!(yearlyPkg || loadingPrices);
  var paywallGridImages = [
    PILIER_IMAGES.p7, PILIER_IMAGES.p5, PILIER_IMAGES.p3,
    PILIER_IMAGES.p2, PILIER_IMAGES.p6, PILIER_IMAGES.p4,
  ];
  var gridItemW = Math.floor((SW - 56 - 16) / 3);

  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000000" }}>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ position: "absolute", top: 56, right: 20, zIndex: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>{"\u2715"}</Text>
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 50, alignItems: "center" }}>

          <View style={{ backgroundColor: '#AEEF4D', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#000000', letterSpacing: 1 }}>{tr.paywall_badge || '7 JOURS GRATUITS'}</Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", paddingHorizontal: 28, marginBottom: 28 }}>
            {paywallGridImages.map(function(src, i) {
              return (
                <View key={"pw-img-" + i} style={{ width: gridItemW, height: gridItemW, borderRadius: 14, overflow: "hidden" }}>
                  <ImageBackground source={src} resizeMode="cover" style={{ flex: 1 }}>
                    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }} />
                  </ImageBackground>
                </View>
              );
            })}
          </View>

          <Text style={{ fontSize: 28, fontWeight: "800", color: "#ffffff", textAlign: "center", marginBottom: 10, paddingHorizontal: 28 }}>{tr.paywall_title}</Text>
          <Text style={{ fontSize: 14, fontWeight: "400", color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 21, marginBottom: 24, paddingHorizontal: 32 }}>{tr.paywall_sub}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 28, marginBottom: 28, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14 }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', borderWidth: 2.5, borderColor: '#AEEF4D' }}>
              <ImageBackground source={COACH_IMAGE} resizeMode="cover" style={{ flex: 1 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '300', color: 'rgba(255,255,255,0.85)', lineHeight: 18, fontStyle: 'italic' }}>{tr.coach_quote || '"Je vous accompagne pas à pas vers un corps plus libre et plus fort."'}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#AEEF4D', marginTop: 6 }}>{tr.coach_avec || 'Avec Sabrina'} · {tr.coach_exp || '30 ans d\'expérience'}</Text>
            </View>
          </View>

          {disabled && (
            <View style={{ alignSelf: "stretch", marginHorizontal: 28, marginBottom: 16, backgroundColor: "rgba(255,200,80,0.10)", borderWidth: 1, borderColor: "rgba(255,200,80,0.25)", borderRadius: 16, padding: 14 }}>
              <Text style={{ color: "rgba(255,220,140,0.9)", fontSize: 12, lineHeight: 18, textAlign: "center" }}>{tr.paywall_not_available}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={function() { if (monthlyPkg) { onBuyMonthly && onBuyMonthly(monthlyPkg); } else { Alert.alert('FluidBody+', 'Abonnement disponible dans la version App Store.'); } }}
            disabled={false}
            activeOpacity={0.85}
            style={{
              alignSelf: "stretch",
              marginHorizontal: 28,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#AEEF4D",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
              opacity: (disabled || loadingPrices) ? 0.4 : 1,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#000000", letterSpacing: 0.3 }}>
              {tr.paywall_start}
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.40)", textAlign: "center", marginBottom: 16 }}>
            {tr.paywall_price_detail || 'Puis 12.90 CHF/mois · Annulez quand vous voulez'}
          </Text>

          <TouchableOpacity
            onPress={function() { if (yearlyPkg) { onBuyYearly && onBuyYearly(yearlyPkg); } else { Alert.alert('FluidBody+', 'Abonnement disponible dans la version App Store.'); } }}
            disabled={false}
            activeOpacity={0.85}
            style={{
              alignSelf: "stretch",
              marginHorizontal: 28,
              height: 50,
              borderRadius: 25,
              backgroundColor: "rgba(0,189,208,0.15)",
              borderWidth: 1,
              borderColor: "#00BDD0",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#00BDD0" }}>
              {tr.paywall_yearly_link}
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 11, fontWeight: "400", color: "rgba(255,255,255,0.30)", textAlign: "center", marginBottom: 20, paddingHorizontal: 40 }}>
            {tr.paywall_access || 'Accès immédiat à tous les piliers · Sans engagement'}
          </Text>

          <TouchableOpacity
            onPress={onRestore}
            disabled={disabled}
            activeOpacity={0.7}
            style={{ marginTop: 8 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.25)", textAlign: "center" }}>{tr.paywall_restore}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

async function readAuthOtpPending() {
  try {
    const raw = await AsyncStorage.getItem(AUTH_OTP_PENDING_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o?.email || typeof o.sentAt !== 'number') return null;
    return o;
  } catch {
    return null;
  }
}

async function writeAuthOtpPending(email) {
  await AsyncStorage.setItem(AUTH_OTP_PENDING_KEY, JSON.stringify({ email: String(email).trim().toLowerCase(), sentAt: Date.now() }));
}

async function clearAuthOtpPending() {
  await AsyncStorage.removeItem(AUTH_OTP_PENDING_KEY);
}

function ArticleDetail({ article, onClose, lang }) {
  const tr = T[lang] || T['fr'];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible', opacity: 0.3 }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <ScrollView style={{ zIndex: 2 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingTop: 58, paddingHorizontal: 22 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity onPress={onClose} style={{ paddingVertical: 6 }}><Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1 }}>{tr.retour_biblio}</Text></TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 30 }}>+</Text></Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,18,32,0.7)', borderWidth: 0.5, borderColor: '#AEEF4D' }}>
              <Text style={{ fontSize: 9, color: '#AEEF4D', letterSpacing: 1 }}>{article.duree}{tr.lire}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '200', color: 'rgba(215,248,255,0.95)', lineHeight: 36, marginBottom: 20 }}>{article.titre}</Text>
          <Text style={{ fontSize: 17, fontWeight: '300', color: article.color, lineHeight: 28, marginBottom: 24, fontStyle: 'italic' }}>{article.intro}</Text>
          <Text style={{ fontSize: 15, fontWeight: '200', color: 'rgba(195,235,255,0.82)', lineHeight: 26, marginBottom: 32 }}>{article.corps}</Text>
          <View style={{ borderLeftWidth: 2, borderLeftColor: article.color, paddingLeft: 16, marginBottom: 32 }}>
            <Text style={{ fontSize: 16, fontWeight: '200', color: 'rgba(215,248,255,0.9)', lineHeight: 26, fontStyle: 'italic' }}>{article.citation}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(0,210,250,0.4)', marginTop: 8, letterSpacing: 1, textTransform: 'uppercase' }}>{tr.biblio_signature}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function FicheDetail({ fiche, onClose, lang }) {
  const tr = T[lang] || T['fr'];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible', opacity: 0.3 }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <ScrollView style={{ zIndex: 2 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingTop: 58, paddingHorizontal: 22 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity onPress={onClose} style={{ paddingVertical: 6 }}><Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1 }}>{tr.retour_biblio}</Text></TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 30 }}>+</Text></Text>
          </View>
          <Text style={{ fontSize: 72, fontWeight: '200', color: '#AEEF4D', opacity: 0.3, lineHeight: 80 }}>{fiche.num}</Text>
          <Text style={{ fontSize: 32, fontWeight: '200', color: 'rgba(215,248,255,0.95)', lineHeight: 40, marginBottom: 8 }}>{fiche.etape}</Text>
          <Text style={{ fontSize: 16, fontWeight: '300', color: fiche.color, marginBottom: 24, fontStyle: 'italic' }}>{fiche.soustitre}</Text>
          <View style={{ backgroundColor: 'rgba(0,18,38,0.7)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.15)', borderRadius: 18, padding: 20, marginBottom: 24 }}>
            <Text style={{ fontSize: 15, fontWeight: '200', color: 'rgba(195,235,255,0.85)', lineHeight: 26 }}>{fiche.description}</Text>
          </View>
          <Text style={{ fontSize: 11, color: 'rgba(0,210,250,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>{tr.points_cles}</Text>
          {fiche.points.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,18,32,0.8)', borderWidth: 1, borderColor: fiche.color, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                <Text style={{ fontSize: 10, color: fiche.color, fontWeight: '500' }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '200', color: 'rgba(195,235,255,0.85)', lineHeight: 24 }}>{p}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}


// ══════════════════════════════════
// BIBLIOTHEQUE — sans player podcast
// ══════════════════════════════════
function Biblio({ lang }) {
  const tr = T[lang] || T['fr'];
  const [tab, setTab] = useState('piliers');
  const [openArticle, setOpenArticle] = useState(null);
  const [openFiche, setOpenFiche] = useState(null);
  const articles = ARTICLES[lang] || ARTICLES.fr;
  const fiches = FICHES[lang] || FICHES.fr;

  if (openArticle) return <ArticleDetail article={openArticle} onClose={() => setOpenArticle(null)} lang={lang} />;
  if (openFiche) return <FicheDetail fiche={openFiche} onClose={() => setOpenFiche(null)} lang={lang} />;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.15} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map((b, i) => <Bulle key={i} {...b} />)}
      </View>
      <FloatingMedusas />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingBottom: 40 }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={true}
      >
        <View style={{ paddingTop: 62, paddingHorizontal: 6, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 34 }}>+</Text></Text>
          </View>
          <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.biblio_sub}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            {['piliers', 'methode'].map(t => (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: tab === t ? 'rgba(174,239,77,0.7)' : 'rgba(174,239,77,0.2)', backgroundColor: tab === t ? 'rgba(174,239,77,0.18)' : 'rgba(0,18,32,0.5)' }}>
                <Text style={{ fontSize: 12, fontWeight: '300', color: tab === t ? '#AEEF4D' : 'rgba(174,239,77,0.5)' }}>{t === 'piliers' ? tr.tab_piliers : tr.tab_methode}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {tab === 'piliers' && (
          <View style={{ gap: 12 }}>
            {articles.map((a, i) => {
              const IconComp = ICONS[a.key];
              return (
                <TouchableOpacity key={i} onPress={() => setOpenArticle(a)} style={{ backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 14 }}>
                      <ImageBackground source={PILIER_IMAGES[a.key]} resizeMode="cover" style={{ flex: 1 }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '300', color: '#ffffff', lineHeight: 22 }}>{a.titre}</Text>
                      <Text style={{ fontSize: 10, color: '#AEEF4D', marginTop: 3 }}>{a.duree}{tr.lire}</Text>
                    </View>
                    <Text style={{ fontSize: 18, color: 'rgba(174,239,77,0.3)' }}>›</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '200', color: 'rgba(174,239,77,0.55)', lineHeight: 20 }} numberOfLines={2}>{a.intro}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {tab === 'methode' && (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: 'rgba(0,18,38,0.7)', borderWidth: 0.5, borderColor: 'rgba(174,239,77,0.15)', borderRadius: 20, padding: 18, marginBottom: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '200', color: 'rgba(174,239,77,0.7)', lineHeight: 22 }}>{tr.biblio_intro}</Text>
            </View>
            {fiches.map((f, i) => (
              <TouchableOpacity key={i} onPress={() => setOpenFiche(f)} style={{ backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,18,32,0.8)', borderWidth: 1.5, borderColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#AEEF4D' }}>{f.num}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '200', color: '#ffffff' }}>{f.etape}</Text>
                    <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.5)', marginTop: 2 }}>{f.soustitre}</Text>
                  </View>
                  <Text style={{ fontSize: 18, color: 'rgba(174,239,77,0.3)' }}>›</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '200', color: 'rgba(174,239,77,0.55)', lineHeight: 20 }} numberOfLines={2}>{f.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════
// RÉSUMÉ — style Apple Fitness
// ══════════════════════════════════
function ActivityRing({ radius, strokeWidth, progress, color, bgColor }) {
  var circ = 2 * Math.PI * radius;
  var anim = useRef(new Animated.Value(0)).current;
  useEffect(function() { Animated.timing(anim, { toValue: Math.min(progress, 1), duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [progress]);
  var dashOffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });
  var size = (radius + strokeWidth) * 2;
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Circle cx={radius + strokeWidth} cy={radius + strokeWidth} r={radius} stroke={bgColor || 'rgba(255,255,255,0.08)'} strokeWidth={strokeWidth} fill="none" />
      <AnimatedCircle cx={radius + strokeWidth} cy={radius + strokeWidth} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dashOffset} transform={'rotate(-90 ' + (radius + strokeWidth) + ' ' + (radius + strokeWidth) + ')'} />
    </Svg>
  );
}

var AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ══════════════════════════════════
// CALENDRIER HEATMAP + RECOMMANDATION
// ══════════════════════════════════
function ActivityCalendar({ lang }) {
  var [history, setHistory] = useState({});
  useEffect(function() {
    AsyncStorage.getItem('fluid_activity_calendar').then(function(raw) {
      if (raw) try { setHistory(JSON.parse(raw)); } catch(e) {}
    });
  }, []);
  var today = new Date();
  var days = [];
  for (var i = 27; i >= 0; i--) {
    var d = new Date(today); d.setDate(d.getDate() - i);
    var key = d.toISOString().slice(0, 10);
    days.push({ key: key, day: d.getDate(), dow: d.getDay(), count: history[key] || 0 });
  }
  var dayLabels = { fr: ['L','M','M','J','V','S','D'], en: ['M','T','W','T','F','S','S'] };
  var labels = dayLabels[lang] || dayLabels.fr;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        {labels.map(function(l, i) { return <Text key={i} style={{ fontSize: 8, color: 'rgba(174,239,77,0.4)', width: Math.floor((SW - 80) / 7), textAlign: 'center' }}>{l}</Text>; })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
        {days.map(function(d) {
          var intensity = d.count === 0 ? 0 : d.count === 1 ? 0.3 : d.count === 2 ? 0.6 : 1;
          return (
            <View key={d.key} style={{ width: Math.floor((SW - 80 - 18) / 7), height: Math.floor((SW - 80 - 18) / 7), borderRadius: 4, backgroundColor: d.count > 0 ? ('rgba(174,239,77,' + intensity + ')') : 'rgba(174,239,77,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 7, color: d.count > 0 ? '#000000' : 'rgba(255,255,255,0.2)', fontWeight: d.count > 0 ? '700' : '400' }}>{d.day}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ══════════════════════════════════
// BILAN CORPOREL VISUEL
// ══════════════════════════════════
var BODY_ZONES = [
  { key: 'p1', label: 'Épaules', path: 'M38 28L32 34L30 42L34 42L38 36L42 36L46 42L50 42L48 34L42 28Z', cx: 40, cy: 35 },
  { key: 'p2', label: 'Dos', path: 'M36 42L34 60L38 60L40 48L42 48L44 60L48 60L46 42Z', cx: 40, cy: 50 },
  { key: 'p3', label: 'Mobilité', path: 'M34 60L30 78L36 78L38 68L42 68L44 78L50 78L46 60Z', cx: 40, cy: 70 },
  { key: 'p4', label: 'Posture', path: 'M38 42L36 48L38 48L40 45L42 48L44 48L42 42Z', cx: 40, cy: 45 },
  { key: 'p8', label: 'Office', path: 'M36 48L34 56L38 56L40 52L42 56L46 56L44 48Z', cx: 40, cy: 52 },
];

function BodyMapVisual({ done, lang }) {
  var piliers = getPiliers(lang);
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={160} height={180} viewBox="0 0 80 90">
        {/* Tête */}
        <Circle cx="40" cy="14" r="8" fill="rgba(255,255,255,0.08)" stroke="rgba(174,239,77,0.3)" strokeWidth={0.8} />
        {/* Cou */}
        <Rect x="38" y="22" width="4" height="6" fill="rgba(255,255,255,0.06)" rx="1" />
        {/* Corps outline */}
        <Path d="M28 28Q22 32 20 42L22 62L28 78L32 86L36 86L38 80L40 86L42 80L44 86L48 86L52 78L58 62L60 42Q58 32 52 28L46 26L40 24L34 26Z" fill="rgba(255,255,255,0.04)" stroke="rgba(174,239,77,0.15)" strokeWidth={0.6} />
        {/* Bras gauche */}
        <Path d="M28 34L18 50L16 60L20 60L22 52L28 42" fill="rgba(255,255,255,0.04)" stroke="rgba(174,239,77,0.12)" strokeWidth={0.5} />
        {/* Bras droit */}
        <Path d="M52 34L62 50L64 60L60 60L58 52L52 42" fill="rgba(255,255,255,0.04)" stroke="rgba(174,239,77,0.12)" strokeWidth={0.5} />
        {/* Zones colorées selon progression */}
        {piliers.map(function(p) {
          var count = (done[p.key] || []).filter(Boolean).length;
          var pctZone = count / 20;
          var zone = BODY_ZONES.find(function(z) { return z.key === p.key; });
          if (!zone) return null;
          var color = pctZone === 0 ? 'rgba(255,60,60,0.25)' : pctZone < 0.3 ? 'rgba(255,180,60,0.35)' : pctZone < 0.6 ? 'rgba(174,239,77,0.4)' : 'rgba(174,239,77,0.7)';
          return (
            <G key={p.key}>
              <Path d={zone.path} fill={color} />
              {pctZone > 0 && <Circle cx={zone.cx} cy={zone.cy} r={2} fill="#AEEF4D" opacity={pctZone} />}
            </G>
          );
        })}
        {/* Tête couleur p1 (épaules liées) */}
        <Circle cx="40" cy="14" r="7" fill={((done.p1 || []).filter(Boolean).length / 20) > 0.3 ? 'rgba(174,239,77,0.3)' : 'rgba(255,60,60,0.15)'} />
      </Svg>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,60,60,0.4)' }} />
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>À travailler</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,180,60,0.5)' }} />
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>En progrès</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#AEEF4D' }} />
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Maîtrisé</Text>
        </View>
      </View>
    </View>
  );
}

// ══════════════════════════════════
// STREAK PROTECTOR
// ══════════════════════════════════
function getStreakStatus(streak, lastStreakDate) {
  if (!lastStreakDate) return 'none';
  var today = new Date().toDateString();
  var yesterday = new Date(Date.now() - 86400000).toDateString();
  if (lastStreakDate === today) return 'safe';
  if (lastStreakDate === yesterday) return 'at_risk';
  return 'lost';
}

function getSmartRecommendation(done, tensionIdxs, lang) {
  var piliers = getPiliers(lang);
  var seances = getSeances(lang);
  var best = null; var bestScore = -1;
  piliers.forEach(function(p) {
    var d = done[p.key] || [];
    var nextIdx = d.findIndex(function(v) { return !v; });
    if (nextIdx === -1) return;
    var isRecommended = (tensionIdxs || []).some(function(ti) { return ZONE_TO_PILIER[ti] === p.key; });
    var doneCount = d.filter(Boolean).length;
    var score = (isRecommended ? 50 : 0) + (20 - doneCount) + (nextIdx < 5 ? 10 : 0);
    if (score > bestScore) { bestScore = score; best = { pilier: p, idx: nextIdx, seance: (seances[p.key] || [])[nextIdx] }; }
  });
  return best;
}

function ResumeScreen({ done, lang, streak, prenom, tensionIdxs, supaUser, onCreateAccount }) {
  var tr = T[lang] || T['fr'];
  var piliers = getPiliers(lang);
  var [meduseName, setMeduseName] = useState('');
  var [showNameInput, setShowNameInput] = useState(false);
  var [nameInput, setNameInput] = useState('');
  useEffect(function() {
    AsyncStorage.getItem('fluid_meduse_name').then(function(n) { if (n) setMeduseName(n); });
  }, []);
  function saveMeduseName() {
    var name = nameInput.trim();
    if (!name) return;
    setMeduseName(name);
    setShowNameInput(false);
    AsyncStorage.setItem('fluid_meduse_name', name);
  }
  var totalDone = Object.values(done).flat().filter(Boolean).length;
  var pct = Math.round(totalDone / 160 * 100);
  var recommendedPiliers = (tensionIdxs || []).map(function(i) { return ZONE_TO_PILIER[i]; });
  var [hkData, setHkData] = useState({ cal: 0, exMin: 0, standHr: 0 });
  var [localExMin, setLocalExMin] = useState(0);

  useEffect(function() {
    function refresh() {
      getHealthKitSummary(function(data) { setHkData(data); });
      var key = 'fluid_exercise_' + new Date().toISOString().slice(0, 10);
      AsyncStorage.getItem(key).then(function(raw) { if (raw) setLocalExMin(parseInt(raw) || 0); });
    }
    refresh();
    var interval = setInterval(refresh, 60000);
    return function() { clearInterval(interval); };
  }, []);

  var now = new Date();
  var dayNames = { fr: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'], en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], es: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'], it: ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'] };
  var monthNames = { fr: ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'], en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], es: ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sep.','oct.','nov.','dic.'], it: ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'] };
  var dn = (dayNames[lang] || dayNames.fr)[now.getDay()];
  var mn = (monthNames[lang] || monthNames.fr)[now.getMonth()];
  var dateStr = dn + ' ' + now.getDate() + ' ' + mn;

  var calGoal = 400; var exGoal = 30; var standGoal = 12;
  var effectiveExMin = Math.max(hkData.exMin, localExMin);
  var effectiveCal = Math.max(hkData.cal, localExMin * 5);
  var calPct = effectiveCal / calGoal; var exPct = effectiveExMin / exGoal; var standPct = hkData.standHr / standGoal;

  var recentSeances = [];
  piliers.forEach(function(p) {
    var d = done[p.key];
    if (d) d.forEach(function(v, i) { if (v === true || v === 'true') recentSeances.push({ pilier: p, idx: i }); });
  });
  recentSeances = recentSeances.slice(-5).reverse();

  var sortedPiliers = [].concat(piliers).sort(function(a, b) { return (recommendedPiliers.includes(a.key) ? 0 : 1) - (recommendedPiliers.includes(b.key) ? 0 : 1); });

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 62, paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 34 }}>+</Text></Text>
              <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{dateStr}</Text>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#000000' }}>{prenom ? prenom.slice(0, 2).toUpperCase() : 'YT'}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 18 }}>{tr.resume_activite || 'Activité'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityRing radius={60} strokeWidth={8} progress={calPct} color="#FF3B30" bgColor="rgba(255,59,48,0.2)" />
              <ActivityRing radius={48} strokeWidth={8} progress={exPct} color="#30D158" bgColor="rgba(48,209,88,0.2)" />
              <ActivityRing radius={36} strokeWidth={8} progress={standPct} color="#0A84FF" bgColor="rgba(10,132,255,0.2)" />
            </View>
            <View style={{ flex: 1, marginLeft: 20, gap: 14 }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' }} />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{tr.resume_bouger || 'Bouger'}</Text>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#FF3B30', marginTop: 2 }}>{effectiveCal}<Text style={{ fontSize: 13, fontWeight: '400' }}>/{calGoal} cal</Text></Text>
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#30D158' }} />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{tr.resume_exercice || 'Exercice'}</Text>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#30D158', marginTop: 2 }}>{effectiveExMin}<Text style={{ fontSize: 13, fontWeight: '400' }}>/{exGoal} min</Text></Text>
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0A84FF' }} />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{tr.resume_debout || 'Debout'}</Text>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#0A84FF', marginTop: 2 }}>{hkData.standHr}<Text style={{ fontSize: 13, fontWeight: '400' }}>/{standGoal} h</Text></Text>
              </View>
            </View>
          </View>
        </View>

        {(function() {
          var stIdx = getMeduseState(pct, streak);
          var ms = MEDUSA_STATES[stIdx];
          var names = MEDUSA_STATE_NAMES[lang] || MEDUSA_STATE_NAMES.fr;
          var score = Math.min(100, pct * 0.7 + Math.min(streak || 0, 14) * 2);
          var nextState = stIdx < MEDUSA_STATES.length - 1 ? MEDUSA_STATES[stIdx + 1] : null;
          var progressToNext = nextState ? Math.min(1, (score - ms.min) / (nextState.min - ms.min)) : 1;
          var motivTexts = {
            fr: ['Fais 3 séances pour l\'éveiller !', 'Continue pour la rendre active !', 'Elle brille de plus en plus !', 'Presque rayonnante, encore un effort !', 'Maîtrise totale atteinte !'],
            en: ['Do 3 sessions to awaken her!', 'Keep going to make her active!', 'She shines more and more!', 'Almost radiant, one more push!', 'Total mastery achieved!'],
            de: ['Mache 3 Sitzungen, um sie zu wecken!', 'Weiter so, um sie aktiv zu machen!', 'Sie strahlt immer mehr!', 'Fast strahlend, noch eine Anstrengung!', 'Totale Meisterschaft erreicht!'],
            pt: ['Faça 3 sessões para despertá-la!', 'Continue para torná-la ativa!', 'Ela brilha cada vez mais!', 'Quase radiante, mais um esforço!', 'Domínio total alcançado!'],
            zh: ['做3节课来唤醒她！', '继续让她变得活跃！', '她越来越闪耀！', '快要闪耀了，再加油！', '完全掌握！'],
            ja: ['3セッションで目覚めさせよう！', '続けてアクティブに！', 'どんどん輝いている！', 'もう少しで輝く！', '完全制覇！'],
            ko: ['3세션으로 깨우세요!', '계속하면 활동적이 됩니다!', '점점 빛나고 있어요!', '거의 빛나요, 조금만 더!', '완전 정복!'],
            es: ['¡Haz 3 sesiones para despertarla!', '¡Sigue para activarla!', '¡Brilla cada vez más!', '¡Casi radiante, un esfuerzo más!', '¡Dominio total!'],
            it: ['Fai 3 sessioni per svegliarla!', 'Continua per renderla attiva!', 'Brilla sempre di più!', 'Quasi radiante, ancora uno sforzo!', 'Padronanza totale!'],
          };
          var motiv = (motivTexts[lang] || motivTexts.fr)[stIdx];
          return (
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, alignSelf: 'flex-start' }}>{meduseName || (tr.meduse_card_title || 'Ta méduse')}</Text>
              <LivingMedusa pct={pct} streak={streak} lang={lang} showLabel={false} />
              {meduseName ? (
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff', marginTop: 14 }}>{meduseName}</Text>
              ) : null}
              <Text style={{ fontSize: 14, fontWeight: '600', color: ms.color.replace('1)', '0.9)'), marginTop: meduseName ? 4 : 14 }}>{names[stIdx]}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, alignSelf: 'stretch' }}>
                <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(174,239,77,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ height: 4, width: (progressToNext * 100) + '%', backgroundColor: ms.color, borderRadius: 2 }} />
                </View>
                {nextState && <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{names[stIdx + 1]}</Text>}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '300', color: 'rgba(255,255,255,0.5)', marginTop: 10, textAlign: 'center', fontStyle: 'italic' }}>{motiv}</Text>
              {!meduseName && !showNameInput && (
                <TouchableOpacity onPress={function() { setShowNameInput(true); }} activeOpacity={0.85} style={{ marginTop: 14, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#AEEF4D' }}>{tr.meduse_name_btn || 'Donne-lui un nom'}</Text>
                </TouchableOpacity>
              )}
              {showNameInput && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, alignSelf: 'stretch' }}>
                  <TextInput value={nameInput} onChangeText={setNameInput} placeholder={tr.meduse_name_ph || 'Nom de ta méduse'} placeholderTextColor="rgba(174,239,77,0.3)" autoFocus style={{ flex: 1, height: 40, backgroundColor: 'rgba(0,18,32,0.6)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, color: '#ffffff', fontSize: 14, paddingHorizontal: 12 }} />
                  <TouchableOpacity onPress={saveMeduseName} style={{ height: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#000000' }}>OK</Text>
                  </TouchableOpacity>
                </View>
              )}
              {meduseName && (
                <TouchableOpacity onPress={function() { setShowNameInput(true); setNameInput(meduseName); }} activeOpacity={0.7} style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{tr.meduse_rename || 'Renommer'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 14 }}>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Text style={{ fontSize: 28, fontWeight: '200', color: '#AEEF4D' }}>{totalDone}</Text>
            <Text style={[styles.statLbl, { color: 'rgba(174,239,77,0.6)' }]}>{tr.m_seances}</Text>
          </View>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Text style={{ fontSize: 28, fontWeight: '200', color: '#AEEF4D' }}>{'🔥'} {streak > 0 ? streak : 0}</Text>
            <Text style={[styles.statLbl, { color: 'rgba(174,239,77,0.6)' }]}>{tr.resume_streak || 'Streak'}</Text>
          </View>
          <View style={[styles.statCard, { flex: 1 }]}>
            <Text style={{ fontSize: 28, fontWeight: '200', color: '#AEEF4D' }}>{pct}%</Text>
            <Text style={[styles.statLbl, { color: 'rgba(174,239,77,0.6)' }]}>{tr.resume_global || 'Global'}</Text>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 14, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, alignSelf: 'flex-start' }}>{tr.body_map_title || 'Bilan corporel'}</Text>
          <BodyMapVisual done={done} lang={lang} />
        </View>

        {(function() {
          var streakStatus = 'safe';
          if (streak > 0) {
            var allDoneToday = Object.values(done).flat().filter(Boolean).length;
          }
          var atRisk = streak > 0 && totalDone > 0;
          return atRisk && streak >= 2 ? (
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(255,150,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,180,60,0.4)', borderRadius: 12, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 24 }}>🔥</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFB43C' }}>{tr.streak_protect_title || 'Protège ton streak !'}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,180,60,0.6)', marginTop: 2 }}>{tr.streak_protect_sub || 'Fais une micro-séance de 2 min pour ne pas perdre tes ' + streak + ' jours'}</Text>
              </View>
            </View>
          ) : null;
        })()}

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.calendar_title || 'Activité récente'}</Text>
          <ActivityCalendar lang={lang} />
        </View>

        {(function() {
          var rec = getSmartRecommendation(done, tensionIdxs, lang);
          if (!rec || !rec.seance) return null;
          return (
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 14 }}>
                  <ImageBackground source={PILIER_IMAGES[rec.pilier.key]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>{tr.recommended_next || 'Recommandée pour toi'}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{rec.seance[0]}</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{rec.pilier.label} · {rec.seance[1]}</Text>
                </View>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#000000' }}>▶</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {(function() {
          var weekGoal = 3;
          var now = new Date();
          var startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() + 1);
          var weekDone = 0;
          for (var d = 0; d < 7; d++) {
            var day = new Date(startOfWeek); day.setDate(startOfWeek.getDate() + d);
            var key = day.toISOString().slice(0, 10);
          }
          var allDone = Object.values(done).flat();
          weekDone = Math.min(totalDone, weekGoal);
          var weekPct = Math.min(1, weekDone / weekGoal);
          return (
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={50} height={50} viewBox="0 0 50 50">
                  <Circle cx="25" cy="25" r="20" stroke="rgba(174,239,77,0.12)" strokeWidth={4} fill="none" />
                  <Circle cx="25" cy="25" r="20" stroke="#AEEF4D" strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 20} strokeDashoffset={2 * Math.PI * 20 * (1 - weekPct)} transform="rotate(-90 25 25)" />
                </Svg>
                <Text style={{ position: 'absolute', fontSize: 14, fontWeight: '800', color: '#AEEF4D' }}>{weekDone}/{weekGoal}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>{tr.weekly_goal || 'Objectif semaine'}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.5)', marginTop: 2 }}>{weekDone >= weekGoal ? (tr.weekly_done || 'Objectif atteint ! 🎉') : (tr.weekly_remaining || (weekGoal - weekDone) + ' séance(s) restante(s)')}</Text>
              </View>
            </View>
          );
        })()}

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.resume_seances || 'Séances FluidBody'}</Text>
          {recentSeances.length === 0 && (
            <Text style={{ fontSize: 14, color: 'rgba(174,239,77,0.4)', fontStyle: 'italic' }}>{tr.resume_no_seance || 'Aucune séance complétée'}</Text>
          )}
          {recentSeances.map(function(s, i) {
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < recentSeances.length - 1 ? 0.5 : 0, borderBottomColor: 'rgba(174,239,77,0.12)' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginRight: 12, borderWidth: 1.5, borderColor: '#AEEF4D' }}>
                  <ImageBackground source={PILIER_IMAGES[s.pilier.key]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#ffffff' }}>{s.pilier.label}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.4)' }}>{'Séance ' + (s.idx + 1)}</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#AEEF4D' }}>✓</Text>
              </View>
            );
          })}
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.par_pilier}</Text>
          {sortedPiliers.map(function(p, idx) {
            var count = done[p.key].filter(function(v) { return v === true || v === 'true'; }).length;
            var pct2 = Math.round(count / 20 * 100);
            var isRec = recommendedPiliers.includes(p.key);
            return (
              <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: idx < sortedPiliers.length - 1 ? 0.5 : 0, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginRight: 12, borderWidth: 1.5, borderColor: '#AEEF4D' }}>
                  <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#ffffff' }}>{p.label}{isRec ? ' ★' : ''}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                    <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(174,239,77,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: 4, width: pct2 + '%', backgroundColor: '#AEEF4D', borderRadius: 2 }} />
                    </View>
                    <Text style={{ fontSize: 11, color: '#AEEF4D', width: 38 }}>{count}/20</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#AEEF4D', marginLeft: 8 }}>{pct2}%</Text>
              </View>
            );
          })}
        </View>

        {!supaUser && totalDone >= 3 && (
          <TouchableOpacity onPress={function() { if (onCreateAccount) onCreateAccount(); }} activeOpacity={0.85} style={{ marginHorizontal: 20, marginTop: 14, backgroundColor: 'rgba(174,239,77,0.08)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <Path d="M6 18.5c-2.2 0-4-1.6-4-3.5 0-1.6 1.1-3 2.7-3.4C5.1 8.5 7.8 6 11 6c2.7 0 5 1.7 5.8 4.1C19.1 10.3 21 12 21 14.2c0 2.4-2 4.3-4.5 4.3H6z" stroke="#AEEF4D" strokeWidth={1.6} strokeLinejoin="round" />
                <Path d="M12 13v5M10 16l2 2 2-2" stroke="#AEEF4D" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.save_progress_title || 'Sauvegarde ta progression'}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.5)', marginTop: 2 }}>{tr.save_progress_sub || 'Crée un compte gratuit pour ne rien perdre'}</Text>
            </View>
            <Text style={{ fontSize: 16, color: 'rgba(174,239,77,0.4)' }}>›</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

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

// ══════════════════════════════════
// MÉDUSE VIVANTE — évolue avec la progression
// ══════════════════════════════════
var MEDUSA_STATES = [
  { name: 'dormante', nameEn: 'dormant', min: 0, color: 'rgba(200,210,230,1)', opacity: 0.35, size: 60, breath: 8000, glowR: 0, particles: 0 },
  { name: 'éveillée', nameEn: 'awakened', min: 11, color: 'rgba(0,189,208,1)', opacity: 0.6, size: 75, breath: 5000, glowR: 0, particles: 0 },
  { name: 'active', nameEn: 'active', min: 31, color: 'rgba(0,220,240,1)', opacity: 0.8, size: 90, breath: 3000, glowR: 30, particles: 3 },
  { name: 'rayonnante', nameEn: 'radiant', min: 61, color: 'rgba(174,239,77,1)', opacity: 0.9, size: 105, breath: 2000, glowR: 50, particles: 5 },
  { name: 'légendaire', nameEn: 'legendary', min: 91, color: 'rgba(255,215,0,1)', opacity: 1, size: 120, breath: 1500, glowR: 70, particles: 8 },
];

var MEDUSA_STATE_NAMES = {
  fr: ['Dormante', 'Éveillée', 'Active', 'Rayonnante', 'Légendaire'],
  en: ['Dormant', 'Awakened', 'Active', 'Radiant', 'Legendary'],
  de: ['Schlafend', 'Erwacht', 'Aktiv', 'Strahlend', 'Legendär'],
  pt: ['Adormecida', 'Desperta', 'Ativa', 'Radiante', 'Lendária'],
  zh: ['沉睡', '觉醒', '活跃', '闪耀', '传奇'],
  ja: ['眠り', '覚醒', '活動', '輝き', '伝説'],
  ko: ['잠든', '깨어난', '활동적', '빛나는', '전설적'],
  es: ['Dormida', 'Despierta', 'Activa', 'Radiante', 'Legendaria'],
  it: ['Dormiente', 'Risvegliata', 'Attiva', 'Radiante', 'Leggendaria'],
};

function getMeduseState(pct, streak) {
  var score = Math.min(100, pct * 0.7 + Math.min(streak, 14) * 2);
  for (var i = MEDUSA_STATES.length - 1; i >= 0; i--) {
    if (score >= MEDUSA_STATES[i].min) return i;
  }
  return 0;
}

function LivingMedusa({ pct, streak, lang, showLabel }) {
  var stateIdx = getMeduseState(pct, streak || 0);
  var ms = MEDUSA_STATES[stateIdx];
  var names = MEDUSA_STATE_NAMES[lang] || MEDUSA_STATE_NAMES.fr;
  var floatAnim = useRef(new Animated.Value(0)).current;
  var glowAnim = useRef(new Animated.Value(0)).current;
  var [particles, setParticles] = useState([]);

  useEffect(function() {
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: ms.breath, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(floatAnim, { toValue: 0, duration: ms.breath, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ])).start();
    if (ms.glowR > 0) {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: ms.breath * 0.8, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: ms.breath * 0.8, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])).start();
    }
    if (ms.particles > 0) {
      var pts = [];
      for (var i = 0; i < ms.particles; i++) {
        pts.push({ angle: (i / ms.particles) * Math.PI * 2, dist: ms.size * 0.5 + 10 + Math.random() * 20, speed: 2000 + Math.random() * 3000, anim: new Animated.Value(0) });
      }
      pts.forEach(function(p) {
        Animated.loop(Animated.sequence([
          Animated.timing(p.anim, { toValue: 1, duration: p.speed, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(p.anim, { toValue: 0, duration: p.speed, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])).start();
      });
      setParticles(pts);
    }
  }, [stateIdx]);

  var translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] });
  var scale = floatAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.95, 1.05, 0.95] });
  var glowOpacity = ms.glowR > 0 ? glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.4] }) : 0;
  var rainbowHue = stateIdx === 4 ? floatAnim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['rgba(255,100,100,1)', 'rgba(255,215,0,1)', 'rgba(100,255,100,1)', 'rgba(100,200,255,1)', 'rgba(255,100,255,1)'] }) : null;

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ translateY: translateY }, { scale: scale }], alignItems: 'center' }}>
        {ms.glowR > 0 && (
          <Animated.View style={{ position: 'absolute', width: ms.size + ms.glowR * 2, height: ms.size + ms.glowR * 2, borderRadius: (ms.size + ms.glowR * 2) / 2, backgroundColor: ms.color.replace('1)', '0.08)'), opacity: glowOpacity, top: -ms.glowR, left: -ms.glowR }} />
        )}
        {particles.map(function(p, i) {
          var px = p.anim.interpolate({ inputRange: [0, 1], outputRange: [Math.cos(p.angle) * p.dist - 2, Math.cos(p.angle) * (p.dist + 8) - 2] });
          var py = p.anim.interpolate({ inputRange: [0, 1], outputRange: [Math.sin(p.angle) * p.dist - 2, Math.sin(p.angle) * (p.dist + 8) - 2] });
          var po = p.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 0.8, 0.2] });
          return (
            <Animated.View key={i} style={{ position: 'absolute', width: stateIdx >= 4 ? 5 : 4, height: stateIdx >= 4 ? 5 : 4, borderRadius: 3, backgroundColor: stateIdx >= 4 ? '#FFD700' : '#AEEF4D', opacity: po, left: Animated.add(ms.size / 2, px), top: Animated.add(ms.size / 2, py) }} />
          );
        })}
        <MeduseCornerIcon size={ms.size} breathCycleMs={ms.breath} breathMaxScale={stateIdx >= 3 ? 1.3 : 1.15} tint={stateIdx < 4 ? ms.color : 'rgba(255,215,0,1)'} />
      </Animated.View>
      {showLabel && (
        <View style={{ marginTop: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: ms.color.replace('1)', '0.9)'), letterSpacing: 1 }}>{names[stateIdx]}</Text>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{pct}% · 🔥{streak || 0}</Text>
        </View>
      )}
    </View>
  );
}

function FloatingMedusas() {
  var meds = useRef([
    { x: new Animated.Value(20), y: new Animated.Value(SH * 0.08), size: 80, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.65), y: new Animated.Value(SH * 0.15), size: 68, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.3), y: new Animated.Value(SH * 0.35), size: 74, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.8), y: new Animated.Value(SH * 0.5), size: 60, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.15), y: new Animated.Value(SH * 0.65), size: 76, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.5), y: new Animated.Value(SH * 0.78), size: 64, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.75), y: new Animated.Value(SH * 0.3), size: 56, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
  ]).current;
  useEffect(function() {
    meds.forEach(function(m, i) {
      // Drift lent à travers l'écran
      var delay = 300 + i * 500;
      function drift() {
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 40 + Math.random() * (SH - m.size - 140);
        var dur = 12000 + Math.random() * 10000;
        Animated.parallel([
          Animated.timing(m.x, { toValue: toX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
          Animated.timing(m.y, { toValue: toY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
        ]).start(function() { drift(); });
      }
      setTimeout(drift, delay);
      // Bob (haut/bas sinusoïdal)
      var bobDur = 2400 + i * 380;
      Animated.loop(Animated.sequence([
        Animated.timing(m.bob, { toValue: 1, duration: bobDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(m.bob, { toValue: 0, duration: bobDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])).start();
      // Sway (gauche/droite)
      var swayDur = 3200 + i * 450;
      setTimeout(function() {
        Animated.loop(Animated.sequence([
          Animated.timing(m.sway, { toValue: 1, duration: swayDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(m.sway, { toValue: 0, duration: swayDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])).start();
      }, i * 300);
      // Rotation douce
      var rotDur = 4000 + i * 600;
      Animated.loop(Animated.sequence([
        Animated.timing(m.rot, { toValue: 1, duration: rotDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(m.rot, { toValue: 0, duration: rotDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])).start();
      // Pulse (scale)
      var pulseDur = 2800 + i * 350;
      Animated.loop(Animated.sequence([
        Animated.timing(m.pulse, { toValue: 1, duration: pulseDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(m.pulse, { toValue: 0, duration: pulseDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])).start();
    });
  }, []);
  return meds.map(function(m, i) {
    var bobAmp = 8 + i * 2;
    var swayAmp = 5 + i * 1.5;
    var translateY = m.bob.interpolate({ inputRange: [0, 1], outputRange: [-bobAmp, bobAmp] });
    var translateX = m.sway.interpolate({ inputRange: [0, 1], outputRange: [-swayAmp, swayAmp] });
    var rotate = m.rot.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] });
    var scale = m.pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
    return (
      <Animated.View key={'bg-m-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 0, opacity: 0.6, left: m.x, top: m.y, transform: [{ translateY: translateY }, { translateX: translateX }, { rotate: rotate }, { scale: scale }] }}>
        <MeduseCornerIcon size={m.size} breathCycleMs={2200 + i * 300} breathMaxScale={1.25} tint="rgba(174,239,77,1)" />
      </Animated.View>
    );
  });
}

function Progresser({ done, lang, tensionIdxs }) {
  const tr = T[lang] || T['fr'];
  const totalDone = Object.values(done).flat().filter(Boolean).length;
  const pct = Math.round(totalDone / 160 * 100);
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
          <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.45)', textAlign: 'right', marginTop: 4 }}>{totalDone} / 160</Text>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {sortedPiliers.map((p, idx) => {
            const count = done[p.key].filter(v => v === true || v === 'true').length;
            const IconComp = ICONS[p.key];
            const isRec = recommendedPiliers.includes(p.key);
            const pct2 = Math.round(count / 20 * 100);
            return (
              <View key={p.key} style={{ backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 14 }}>
                    <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '300', color: '#ffffff' }}>{p.label}</Text>
                      {isRec && <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(174,239,77,0.15)', borderWidth: 0.5, borderColor: 'rgba(174,239,77,0.5)' }}><Text style={{ fontSize: 8, color: '#AEEF4D', letterSpacing: 1 }}>★ {tr.recommande_pour_toi}</Text></View>}
                    </View>
                    <Text style={{ fontSize: 11, color: '#AEEF4D', letterSpacing: 1, marginTop: 3 }}>{count}/20{count === 20 ? ' ✓' : ''}</Text>
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '200', color: '#AEEF4D' }}>{pct2}%</Text>
                </View>
                <AnimatedBar value={count} max={20} color={'#AEEF4D'} delay={idx * 100} />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════
// PARTAGE — Social & Défis
// ══════════════════════════════════
var AVATARS = [
  { skin: '#8D5524', hair: '#2C1810', hairStyle: 'afro', bg: 'rgba(174,239,77,0.25)' },
  { skin: '#F1C27D', hair: '#D4A24C', hairStyle: 'long', bg: 'rgba(255,150,200,0.25)' },
  { skin: '#FFDBB4', hair: '#C94C16', hairStyle: 'short', bg: 'rgba(100,200,255,0.25)' },
  { skin: '#E0AC69', hair: '#1C1C1C', hairStyle: 'curly', bg: 'rgba(255,200,80,0.25)' },
  { skin: '#F7D5AA', hair: '#5C3317', hairStyle: 'bun', bg: 'rgba(180,130,255,0.25)' },
];

function AvatarFace({ size = 60, avatarIdx = 0 }) {
  var a = AVATARS[avatarIdx % AVATARS.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#AEEF4D' }}>
      <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 60 60">
        <Circle cx="30" cy="32" r="18" fill={a.skin} />
        {a.hairStyle === 'afro' && <Path d="M12 28c0-14 10-22 18-22s18 8 18 22c0 2-1 3-2 3h-4c0-8-4-14-12-14s-12 6-12 14h-4c-1 0-2-1-2-3z" fill={a.hair} />}
        {a.hairStyle === 'long' && <Path d="M14 30c0-12 7-20 16-20s16 8 16 20c0 1-0.5 2-1 2h-2c1-4 1-8 0-12-2-6-6-8-13-8s-11 2-13 8c-1 4-1 8 0 12h-2c-0.5 0-1-1-1-2z" fill={a.hair} />}
        {a.hairStyle === 'short' && <Path d="M15 28c0-10 7-18 15-18s15 8 15 18c0 1-0.5 1.5-1 1.5h-1c0-6-3-12-13-12s-13 6-13 12h-1c-0.5 0-1-0.5-1-1.5z" fill={a.hair} />}
        {a.hairStyle === 'curly' && <><Path d="M13 30c-1-14 8-22 17-22s18 8 17 22" fill={a.hair} /><Circle cx="14" cy="26" r="4" fill={a.hair} /><Circle cx="46" cy="26" r="4" fill={a.hair} /><Circle cx="22" cy="10" r="4" fill={a.hair} /><Circle cx="38" cy="10" r="4" fill={a.hair} /><Circle cx="30" cy="8" r="4" fill={a.hair} /></>}
        {a.hairStyle === 'bun' && <><Path d="M16 28c0-10 6-17 14-17s14 7 14 17c0 1-0.5 1.5-1 1.5h-1c0-5-3-11-12-11s-12 6-12 11h-1c-0.5 0-1-0.5-1-1.5z" fill={a.hair} /><Circle cx="30" cy="8" r="7" fill={a.hair} /></>}
        <Circle cx="24" cy="33" r="2.2" fill="#1C1C1C" />
        <Circle cx="36" cy="33" r="2.2" fill="#1C1C1C" />
        <Circle cx="25" cy="32" r="0.8" fill="#ffffff" />
        <Circle cx="37" cy="32" r="0.8" fill="#ffffff" />
        <Path d="M26 40Q30 44 34 40" stroke="#1C1C1C" strokeWidth={1.5} strokeLinecap="round" fill="none" />
        <Circle cx="20" cy="37" r="3" fill="rgba(255,130,130,0.3)" />
        <Circle cx="40" cy="37" r="3" fill="rgba(255,130,130,0.3)" />
      </Svg>
    </View>
  );
}

function AvatarConstellation({ prenom }) {
  var floatY = useRef(new Animated.Value(0)).current;
  var floatX = useRef(new Animated.Value(0)).current;
  var scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(function() {
    Animated.loop(Animated.sequence([
      Animated.timing(floatY, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatY, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(floatX, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatX, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.08, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);
  var translateY = floatY.interpolate({ inputRange: [0, 1], outputRange: [8, -12] });
  var translateX = floatX.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] });
  return (
    <View style={{ height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
      <Animated.View style={{ transform: [{ translateY: translateY }, { translateX: translateX }, { scale: scaleAnim }] }}>
        <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: 'transparent', borderWidth: 3, borderColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
          <AvatarFace size={94} avatarIdx={0} />
        </View>
      </Animated.View>
    </View>
  );
}

function FloatingAvatars() {
  var faces = useRef([
    { x: new Animated.Value(20), y: new Animated.Value(SH * 0.1), size: 70 },
    { x: new Animated.Value(SW * 0.65), y: new Animated.Value(SH * 0.18), size: 58 },
    { x: new Animated.Value(SW * 0.3), y: new Animated.Value(SH * 0.4), size: 64 },
    { x: new Animated.Value(SW * 0.8), y: new Animated.Value(SH * 0.55), size: 52 },
    { x: new Animated.Value(SW * 0.15), y: new Animated.Value(SH * 0.7), size: 66 },
  ]).current;
  useEffect(function() {
    faces.forEach(function(f, i) {
      setTimeout(function() {
        (function drift() {
          var toX = 10 + Math.random() * (SW - f.size - 20);
          var toY = 60 + Math.random() * (SH - f.size - 160);
          var dur = 10000 + Math.random() * 6000;
          Animated.parallel([
            Animated.timing(f.x, { toValue: toX, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
            Animated.timing(f.y, { toValue: toY, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          ]).start(function() { drift(); });
        })();
      }, 300 + i * 600);
    });
  }, []);
  return faces.map(function(f, i) {
    return (
      <Animated.View key={'fa-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 0, opacity: 0.55, left: f.x, top: f.y }}>
        <AvatarFace size={f.size} avatarIdx={i} />
      </Animated.View>
    );
  });
}

function PartageScreen({ done, lang, streak, prenom }) {
  var tr = T[lang] || T['fr'];
  var piliers = getPiliers(lang);
  var totalDone = Object.values(done).flat().filter(Boolean).length;
  var pct = Math.round(totalDone / 160 * 100);
  var [defis, setDefis] = useState([]);
  var [invites, setInvites] = useState([]);
  var [showCreateDefi, setShowCreateDefi] = useState(false);
  var [defiPilier, setDefiPilier] = useState(null);
  var [defiDuree, setDefiDuree] = useState('7 jours');

  useEffect(function() {
    AsyncStorage.getItem('fluid_defis').then(function(raw) { if (raw) try { setDefis(JSON.parse(raw)); } catch(e) {} });
    AsyncStorage.getItem('fluid_invites').then(function(raw) { if (raw) try { setInvites(JSON.parse(raw)); } catch(e) {} });
  }, []);

  var shareCardRef = useRef(null);
  var [capturing, setCapturing] = useState(false);

  async function captureCard() {
    if (!shareCardRef.current) return null;
    try {
      var uri = await shareCardRef.current.capture({ format: 'png', quality: 1 });
      return uri;
    } catch(e) { return null; }
  }

  async function shareProgression() {
    setCapturing(true);
    setTimeout(async function() {
      var uri = await captureCard();
      setCapturing(false);
      if (uri) {
        Share.share({ url: uri, message: 'FluidBody+ Pilates\nhttps://apps.apple.com/app/fluidbody/id6746387875' }).catch(function() {});
      } else {
        var msg = (tr.partage_share_msg || 'FluidBody+ Pilates') + '\n' + pct + '% · ' + totalDone + ' ' + (tr.m_seances || 'séances') + ' · 🔥' + (streak || 0) + '\nhttps://apps.apple.com/app/fluidbody/id6746387875';
        Share.share({ message: msg }).catch(function() {});
      }
    }, 300);
  }

  async function shareInstagram() {
    setCapturing(true);
    setTimeout(async function() {
      var uri = await captureCard();
      setCapturing(false);
      if (uri) {
        Share.share({ url: uri }).catch(function() {});
      }
    }, 300);
  }

  async function shareWhatsApp() {
    var msg = (tr.partage_share_msg || 'FluidBody+ Pilates') + '\n' + pct + '% · ' + totalDone + ' ' + (tr.m_seances || 'séances') + ' · 🔥' + (streak || 0) + '\nhttps://apps.apple.com/app/fluidbody/id6746387875';
    try {
      var canOpen = await RNLinking.canOpenURL('whatsapp://send');
      if (canOpen) { await RNLinking.openURL('whatsapp://send?text=' + encodeURIComponent(msg)); }
      else { Share.share({ message: msg }).catch(function() {}); }
    } catch(e) { Share.share({ message: msg }).catch(function() {}); }
  }

  function inviteAmis() {
    var msg = (tr.partage_invite_msg || 'Rejoins-moi sur FluidBody+ Pilates !') + '\nhttps://apps.apple.com/app/fluidbody/id6746387875';
    Share.share({ message: msg }).then(function(result) {
      if (result.action === Share.sharedAction) {
        var updated = [].concat(invites, [{ date: new Date().toISOString(), status: 'pending' }]);
        setInvites(updated);
        AsyncStorage.setItem('fluid_invites', JSON.stringify(updated));
      }
    }).catch(function() {});
  }

  function createDefi() {
    if (!defiPilier) return;
    var defi = { pilier: defiPilier, duree: defiDuree, date: new Date().toISOString(), progress: 0 };
    var updated = [].concat(defis, [defi]);
    setDefis(updated);
    AsyncStorage.setItem('fluid_defis', JSON.stringify(updated));
    setShowCreateDefi(false);
    setDefiPilier(null);
  }

  function deleteDefi(idx) {
    var updated = defis.filter(function(_, i) { return i !== idx; });
    setDefis(updated);
    AsyncStorage.setItem('fluid_defis', JSON.stringify(updated));
  }

  var dureeOptions = ['3 jours', '7 jours', '14 jours', '30 jours'];

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 62, paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 34 }}>+</Text></Text>
            <MeduseCornerIcon size={40} breathCycleMs={3000} tint="rgba(174,239,77,1)" />
          </View>
          <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.partage_title || 'Partage'}</Text>
        </View>


        <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{tr.partage_progression || 'Partager ma progression'}</Text>

          <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }}>
            <LinearGradient colors={['#00bdd0', '#005878', '#002d48', '#000e18']} style={{ borderRadius: 16, padding: 24, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 28 }}>+</Text></Text>
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D' }}>
                  <ImageBackground source={COACH_IMAGE} resizeMode="cover" style={{ flex: 1 }} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, fontWeight: '800', color: '#ffffff' }}>{pct}%</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{tr.resume_global || 'Global'}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, fontWeight: '800', color: '#ffffff' }}>{'🔥'}{streak || 0}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>Streak</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, fontWeight: '800', color: '#ffffff' }}>{totalDone}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{tr.m_seances || 'Séances'}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                {(function() {
                  var bestP = piliers.reduce(function(best, p) { var c = (done[p.key] || []).filter(Boolean).length; return c > best.count ? { p: p, count: c } : best; }, { p: piliers[0], count: 0 });
                  return (
                    <>
                      <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 12 }}>
                        <ImageBackground source={PILIER_IMAGES[bestP.p.key]} resizeMode="cover" style={{ flex: 1 }} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>{bestP.p.label}</Text>
                        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{bestP.count}/20 {tr.m_seances || 'séances'}</Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#AEEF4D' }}>{Math.round(bestP.count / 20 * 100)}%</Text>
                    </>
                  );
                })()}
              </View>

              <Text style={{ fontSize: 14, fontWeight: '300', color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontStyle: 'italic', lineHeight: 20 }}>{tr.coach_quote || '"Je vous accompagne pas à pas vers un corps plus libre."'}</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 8 }}>fluidbody.app · Pilates & More</Text>
            </LinearGradient>
          </ViewShot>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity onPress={shareProgression} activeOpacity={0.85} style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#000000' }}>{tr.partage_btn || 'Partager'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={shareInstagram} activeOpacity={0.85} style={{ height: 48, borderRadius: 24, backgroundColor: 'rgba(225,48,108,0.9)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 6 }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Rect x="2" y="2" width="20" height="20" rx="5" stroke="#fff" strokeWidth={1.8} />
                <Circle cx="12" cy="12" r="5" stroke="#fff" strokeWidth={1.8} />
                <Circle cx="17.5" cy="6.5" r="1.5" fill="#fff" />
              </Svg>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>Story</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={shareWhatsApp} activeOpacity={0.85} style={{ height: 48, borderRadius: 24, backgroundColor: 'rgba(37,211,102,0.9)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 6 }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2C6.48 2 2 6.48 2 12c0 1.77.46 3.43 1.27 4.88L2 22l5.23-1.23A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" stroke="#fff" strokeWidth={1.6} />
                <Path d="M8.5 10.5c.4 1.2 1.3 2.4 2.5 3.2l1.5-.5c.3-.1.6 0 .8.2l1.2 1.5c.2.3.1.6-.2.8l-1 .6c-.5.3-1.1.2-1.5-.1-2-1.3-3.5-3.2-4.2-5.2-.1-.4 0-.9.3-1.2l.7-.9c.2-.3.6-.3.8-.1l1.3 1.3c.2.2.2.5.1.7l-.6 1" fill="#fff" opacity={0.9} />
              </Svg>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>{tr.partage_inviter || 'Inviter des amis'}</Text>
          <TouchableOpacity onPress={inviteAmis} activeOpacity={0.85} style={{ height: 48, borderRadius: 24, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>{tr.partage_invite_btn || 'Inviter par SMS / Email'}</Text>
          </TouchableOpacity>
          {invites.length > 0 && (
            <View>
              <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>{tr.partage_en_attente || 'En attente'} ({invites.length})</Text>
              {invites.slice(-5).reverse().map(function(inv, i) {
                var d = new Date(inv.date);
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < Math.min(invites.length, 5) - 1 ? 0.5 : 0, borderBottomColor: 'rgba(174,239,77,0.12)' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Text style={{ fontSize: 14, color: '#AEEF4D' }}>✉</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: 'rgba(174,239,77,0.6)' }}>{tr.partage_invitation || 'Invitation'} {invites.length - i}</Text>
                    <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.4)' }}>{d.getDate() + '/' + (d.getMonth() + 1)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>{tr.partage_defis || 'Défis'}</Text>

          {!showCreateDefi ? (
            <TouchableOpacity onPress={function() { setShowCreateDefi(true); }} activeOpacity={0.85} style={{ height: 48, borderRadius: 24, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginBottom: defis.length > 0 ? 16 : 0 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>{tr.partage_creer_defi || 'Créer un défi'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, color: '#AEEF4D', marginBottom: 10 }}>{tr.partage_choisir_pilier || 'Choisis un pilier'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
                {piliers.map(function(p) {
                  var active = defiPilier === p.key;
                  return (
                    <TouchableOpacity key={p.key} onPress={function() { setDefiPilier(p.key); }} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(174,239,77,0.15)' : 'rgba(0,18,32,0.6)' }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden' }}>
                        <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} />
                      </View>
                      <Text style={{ fontSize: 12, color: active ? '#AEEF4D' : 'rgba(255,255,255,0.5)' }}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={{ fontSize: 12, color: '#AEEF4D', marginBottom: 10 }}>{tr.partage_duree_defi || 'Durée'}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {dureeOptions.map(function(d) {
                  var active = defiDuree === d;
                  return (
                    <TouchableOpacity key={d} onPress={function() { setDefiDuree(d); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(174,239,77,0.15)' : 'rgba(0,18,32,0.6)', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: active ? '#AEEF4D' : 'rgba(255,255,255,0.5)' }}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={function() { setShowCreateDefi(false); setDefiPilier(null); }} style={{ flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{tr.retour || 'Annuler'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={createDefi} disabled={!defiPilier} style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: defiPilier ? '#AEEF4D' : 'rgba(174,239,77,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#000000' }}>{tr.partage_lancer || 'Lancer'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {defis.map(function(defi, idx) {
            var p = piliers.find(function(x) { return x.key === defi.pilier; });
            var doneCount = done[defi.pilier] ? done[defi.pilier].filter(Boolean).length : 0;
            var defiPct = Math.round(doneCount / 20 * 100);
            return (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: idx === 0 && !showCreateDefi ? 0 : 0.5, borderTopColor: 'rgba(174,239,77,0.12)' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 12 }}>
                  <ImageBackground source={p ? PILIER_IMAGES[p.key] : null} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>{p ? p.label : defi.pilier}</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.5)', marginTop: 2 }}>{defi.duree}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                    <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(174,239,77,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: 4, width: defiPct + '%', backgroundColor: '#AEEF4D', borderRadius: 2 }} />
                    </View>
                    <Text style={{ fontSize: 11, color: '#AEEF4D' }}>{defiPct}%</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={function() { deleteDefi(idx); }} style={{ padding: 6 }}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,100,100,0.6)' }}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════
// PROFIL — Abonnement + Compte
// ══════════════════════════════════
function ProfilScreen({ prenom, done, lang, streak, supabase, supaUser, onLogout, isSubscriber, onRestorePurchases }) {
  var tr = T[lang] || T['fr'];
  var shareRef = useRef(null);
  var totalDoneVal = done ? Object.values(done).flat().filter(Boolean).length : 0;
  var pctVal = Math.round(totalDoneVal / 160 * 100);
  var piliers = getPiliers(lang);
  var bestPilier = piliers.reduce(function(best, p) { var c = (done[p.key] || []).filter(Boolean).length; return c > best.count ? { p: p, count: c } : best; }, { p: piliers[0], count: 0 });

  async function shareWithCard() {
    if (shareRef.current) {
      try {
        var uri = await shareRef.current.capture({ format: 'png', quality: 1 });
        Share.share({ url: uri, message: 'FluidBody+ Pilates\nhttps://apps.apple.com/app/fluidbody/id6746387875' }).catch(function() {});
        return;
      } catch(e) {}
    }
    Share.share({ message: (tr.partage_share_msg || 'FluidBody+ Pilates') + '\n' + pctVal + '% · ' + totalDoneVal + ' ' + (tr.m_seances || 'séances') + ' · 🔥' + (streak || 0) + '\nhttps://apps.apple.com/app/fluidbody/id6746387875' }).catch(function() {});
  }
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />
      <ScrollView contentContainerStyle={{ paddingTop: 62, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#000000' }}>{prenom ? prenom.slice(0, 2).toUpperCase() : 'YT'}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff' }}>{prenom || 'Profil'}</Text>
              <Text style={{ fontSize: 13, color: 'rgba(174,239,77,0.6)' }}>FluidBody · Pilates</Text>
            </View>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{tr.partage_title || 'Partage'}</Text>

          <ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
            <LinearGradient colors={['#00bdd0', '#005878', '#002d48', '#000e18']} style={{ borderRadius: 16, padding: 22, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff' }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 26 }}>+</Text></Text>
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D' }}>
                  <ImageBackground source={COACH_IMAGE} resizeMode="cover" style={{ flex: 1 }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff' }}>{pctVal}%</Text>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{tr.resume_global || 'Global'}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff' }}>{'🔥'}{streak || 0}</Text>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>Streak</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff' }}>{totalDoneVal}</Text>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{tr.m_seances || 'Séances'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 10 }}>
                  <ImageBackground source={PILIER_IMAGES[bestPilier.p.key]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>{bestPilier.p.label}</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{bestPilier.count}/20</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#AEEF4D' }}>{Math.round(bestPilier.count / 20 * 100)}%</Text>
              </View>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 12 }}>fluidbody.app · Pilates & More</Text>
            </LinearGradient>
          </ViewShot>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity onPress={shareWithCard} activeOpacity={0.85} style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M12 2l3 3h-2v8h-2V5H9l3-3z" fill="#000" /><Path d="M4 14v6h16v-6" stroke="#000" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#000000' }}>{tr.partage_btn || 'Partager'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={function() {
              Share.share({ message: (tr.partage_invite_msg || 'Rejoins-moi sur FluidBody+ Pilates !') + '\nhttps://apps.apple.com/app/fluidbody/id6746387875' }).catch(function() {});
            }} activeOpacity={0.85} style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.partage_inviter || 'Inviter'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#AEEF4D' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.coach_title || 'Votre Coach'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 70, height: 70, borderRadius: 35, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D', marginRight: 14 }}>
              <ImageBackground source={COACH_IMAGE} resizeMode="cover" style={{ flex: 1 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff' }}>{tr.coach_name || 'Sabrina'}</Text>
              <Text style={{ fontSize: 12, color: '#AEEF4D', marginTop: 2 }}>{tr.coach_subtitle || 'Experte Pilates · 30 ans d\'expérience'}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '300', color: 'rgba(255,255,255,0.7)', lineHeight: 20, fontStyle: 'italic', marginBottom: 14 }}>{tr.coach_bio || 'Passionnée par le mouvement conscient, je vous guide vers un corps plus libre et plus fort.'}</Text>
          <TouchableOpacity activeOpacity={0.85} style={{ paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.coach_more || 'En savoir plus'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 12 }}>{tr.subscription_status_label}</Text>
          <Text style={{ fontSize: 15, fontWeight: '400', color: '#AEEF4D', marginBottom: 16 }}>{isSubscriber ? tr.subscription_status_active : tr.subscription_status_free}</Text>
          <TouchableOpacity onPress={onRestorePurchases} style={{ paddingVertical: 13, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.10)', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>{tr.subscription_reset}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 14 }}>{tr.mon_compte}</Text>
          {supaUser && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Email</Text>
              <Text style={{ fontSize: 14, color: '#AEEF4D' }} numberOfLines={1}>{supaUser.email}</Text>
            </View>
          )}
          {tr.compte_info.map(function(item, i) {
            return (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: i < tr.compte_info.length - 1 ? 0.5 : 0, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>{item[0]}</Text>
                <Text style={{ fontSize: 14, color: '#AEEF4D' }}>{item[1]}</Text>
              </View>
            );
          })}
        </View>

        {supaUser && onLogout && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            <TouchableOpacity onPress={onLogout} style={{ paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,50,50,0.08)', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,100,100,0.85)' }}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 12 }}>{tr.profil_donnees_title || 'Confidentialité'}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20, marginBottom: 14 }}>{tr.profil_donnees_desc || 'Vos données restent sur votre appareil. Aucune donnée personnelle n\'est envoyée à des serveurs tiers. Les séances, la progression et les préférences sont stockées localement via AsyncStorage. Si vous vous connectez, seul votre email est synchronisé via Supabase pour sauvegarder votre profil.'}</Text>
          <View style={{ borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14 }}>🔒</Text>
              <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.7)', flex: 1 }}>{tr.profil_donnees_local || 'Données stockées localement sur votre appareil'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14 }}>🚫</Text>
              <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.7)', flex: 1 }}>{tr.profil_donnees_no_tracking || 'Aucun tracking publicitaire'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14 }}>🍎</Text>
              <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.7)', flex: 1 }}>{tr.profil_donnees_healthkit || 'HealthKit : données lues uniquement, jamais partagées'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
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
    if (!em.includes('@') || em.length < 5) { setError(tr.ob_auth_err_email); return; }
    if (password.length < 6) { setError(tr.ob_auth_err_short); return; }
    setLoading(true); setError('');
    try {
      if (mode === 'up') {
        const { data, error: err } = await supabase.auth.signUp({
          email: em,
          password,
          options: { data: { prenom: String(prenomHint || '').trim() } },
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

// ══════════════════════════════════
// SUPABASE
// ══════════════════════════════════
const SUPABASE_URL = 'https://ctvtjeidkqpdsmhsjsij.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dnRqZWlka3FwZHNtaHNqc2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODk0MzksImV4cCI6MjA4OTc2NTQzOX0.TlgVvI3znB7T5uEY4LSUGkdNnpZKah1c9ooDSr1iB_8';

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
  console.log('Supabase créé avec succès');
} catch (e) {
  supabase = null;
  console.error('Erreur Supabase:', e?.message != null ? e.message : String(e));
}

// ══════════════════════════════════
// MAIN APP
// ══════════════════════════════════
// ══════════════════════════════════
// STRETCH TIMER
// ══════════════════════════════════
var TIMER_BEEP = null;
try { TIMER_BEEP = require('./assets/timer-beep.mp3'); } catch(e) {}

function StretchTimerModal({ visible, onClose, lang }) {
  var tr = T[lang] || T['fr'];
  var [duration, setDuration] = useState(30);
  var [reps, setReps] = useState(1);
  var [phase, setPhase] = useState('idle');
  var [remaining, setRemaining] = useState(0);
  var [currentRep, setCurrentRep] = useState(1);
  var [paused, setPaused] = useState(false);
  var intervalRef = useRef(null);
  var startRef = useRef(0);
  var elapsedBeforePause = useRef(0);
  var progressAnim = useRef(new Animated.Value(1)).current;
  var soundRef = useRef(null);

  var durations = [15, 30, 45, 60, 90, 120, 180, 300];
  var durLabels = { 15: '15s', 30: '30s', 45: '45s', 60: '1 min', 90: '1m30', 120: '2 min', 180: '3 min', 300: '5 min' };

  async function playBeep() {
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync().catch(function() {}); }
      if (TIMER_BEEP) {
        var result = await Audio.Sound.createAsync(TIMER_BEEP);
        soundRef.current = result.sound;
        await result.sound.setVolumeAsync(1.0);
        await result.sound.playAsync();
      }
    } catch(e) {}
    hapticSuccess();
    hapticSuccess();
  }

  function runCycle(dur, rep) {
    setRemaining(dur);
    setCurrentRep(rep);
    setPhase('running');
    setPaused(false);
    elapsedBeforePause.current = 0;
    startRef.current = Date.now();
    progressAnim.setValue(1);
    Animated.timing(progressAnim, { toValue: 0, duration: dur * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(function() {
      var elapsed = elapsedBeforePause.current + Math.floor((Date.now() - startRef.current) / 1000);
      var rem = dur - elapsed;
      if (rem <= 0) {
        clearInterval(intervalRef.current);
        setRemaining(0);
        playBeep();
        if (rep < reps) {
          setPhase('rest');
          var restCount = 6;
          setRemaining(restCount);
          var restInterval = setInterval(function() {
            restCount--;
            setRemaining(restCount);
            if (restCount <= 0) { clearInterval(restInterval); runCycle(dur, rep + 1); }
          }, 1000);
          intervalRef.current = restInterval;
        } else {
          setPhase('done');
        }
      } else {
        setRemaining(rem);
      }
    }, 250);
  }

  function startTimer() { runCycle(duration, 1); }

  function pauseTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    elapsedBeforePause.current += Math.floor((Date.now() - startRef.current) / 1000);
    progressAnim.stopAnimation();
    setPaused(true);
  }

  function resumeTimer() {
    setPaused(false);
    startRef.current = Date.now();
    var rem = remaining;
    Animated.timing(progressAnim, { toValue: 0, duration: rem * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    intervalRef.current = setInterval(function() {
      var elapsed = elapsedBeforePause.current + Math.floor((Date.now() - startRef.current) / 1000);
      var r = duration - elapsed;
      if (r <= 0) {
        clearInterval(intervalRef.current);
        setRemaining(0);
        playBeep();
        if (currentRep < reps) {
          setPhase('rest');
          var rc = 6; setRemaining(rc);
          var ri = setInterval(function() { rc--; setRemaining(rc); if (rc <= 0) { clearInterval(ri); runCycle(duration, currentRep + 1); } }, 1000);
          intervalRef.current = ri;
        } else { setPhase('done'); }
      } else { setRemaining(r); }
    }, 250);
  }

  function resetTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('idle');
    setRemaining(0);
    setCurrentRep(1);
    setPaused(false);
    elapsedBeforePause.current = 0;
    progressAnim.setValue(1);
  }

  useEffect(function() { return function() { if (intervalRef.current) clearInterval(intervalRef.current); if (soundRef.current) soundRef.current.unloadAsync().catch(function() {}); }; }, []);

  var circR = 100;
  var circC = 2 * Math.PI * circR;
  var dashOffset = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [circC, 0] });
  var remMin = Math.floor(remaining / 60);
  var remSec = remaining % 60;
  var isActive = phase === 'running' || phase === 'rest';

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={function() { resetTimer(); onClose(); }}>
      <View style={{ flex: 1 }}>
        <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible', opacity: 0.3 }} pointerEvents="none">
          {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
        </View>

        <FloatingMedusas />

        <View style={{ paddingTop: 58, paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 30 }}>+</Text></Text>
          <TouchableOpacity onPress={function() { resetTimer(); onClose(); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }}>✕</Text></TouchableOpacity>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 30, zIndex: 2, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>{tr.timer_title || 'Minuteur Stretching & Eldoa'}</Text>
          <Text style={{ fontSize: 12, fontWeight: '300', color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 18, marginBottom: 16, paddingHorizontal: 20 }}>{tr.timer_desc || 'Maintenez chaque étirement pendant la durée choisie. Respirez profondément et relâchez à chaque bip.'}</Text>
          <View style={{ backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' }}>

            <View style={{ width: (circR + 12) * 2, height: (circR + 12) * 2, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Svg width={(circR + 12) * 2} height={(circR + 12) * 2}>
                <Circle cx={circR + 12} cy={circR + 12} r={circR} stroke="rgba(174,239,77,0.12)" strokeWidth={6} fill="none" />
                <AnimatedCircle cx={circR + 12} cy={circR + 12} r={circR} stroke={phase === 'rest' ? '#00BDD0' : '#AEEF4D'} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={circC} strokeDashoffset={isActive ? dashOffset : 0} transform={'rotate(-90 ' + (circR + 12) + ' ' + (circR + 12) + ')'} />
              </Svg>
              <View style={{ position: 'absolute', alignItems: 'center' }}>
                {phase === 'rest' ? (
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#00BDD0', marginBottom: 4 }}>{tr.timer_rest || 'Repos'}</Text>
                ) : null}
                <Text style={{ fontSize: 48, fontWeight: '200', color: '#ffffff', fontVariant: ['tabular-nums'] }}>
                  {isActive || phase === 'done' ? <>{String(remMin).padStart(2, '0')}:<Text style={{ color: '#FF3B30' }}>{String(remSec).padStart(2, '0')}</Text></> : durLabels[duration] || duration + 's'}
                </Text>
                {isActive && reps > 1 && <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', marginTop: 4 }}>{currentRep} / {reps}</Text>}
                {phase === 'done' && <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', marginTop: 4 }}>{tr.timer_done || 'Terminé !'}</Text>}
              </View>
            </View>

            {phase === 'idle' && (
              <>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>{tr.timer_duree || 'Durée'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20, maxHeight: 40 }} contentContainerStyle={{ gap: 8 }}>
                  {durations.map(function(d) {
                    var active = duration === d;
                    return (
                      <TouchableOpacity key={d} onPress={function() { setDuration(d); }} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.12)', backgroundColor: active ? 'rgba(174,239,77,0.15)' : 'transparent' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#AEEF4D' : 'rgba(255,255,255,0.4)' }}>{durLabels[d]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={{ fontSize: 11, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>{tr.timer_reps || 'Répétitions'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 24 }}>
                  <TouchableOpacity onPress={function() { setReps(Math.max(1, reps - 1)); }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '300', color: 'rgba(255,255,255,0.5)' }}>−</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: '#ffffff', width: 50, textAlign: 'center' }}>{reps}x</Text>
                  <TouchableOpacity onPress={function() { setReps(Math.min(10, reps + 1)); }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '300', color: 'rgba(255,255,255,0.5)' }}>+</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            {phase === 'idle' && (
              <TouchableOpacity onPress={startTimer} activeOpacity={0.85} style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#000000', letterSpacing: 0.5 }}>START</Text>
              </TouchableOpacity>
            )}
            {phase === 'running' && !paused && (
              <TouchableOpacity onPress={pauseTimer} activeOpacity={0.85} style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>PAUSE</Text>
              </TouchableOpacity>
            )}
            {phase === 'running' && paused && (
              <>
                <TouchableOpacity onPress={resumeTimer} activeOpacity={0.85} style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#000000', letterSpacing: 0.5 }}>REPRENDRE</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resetTimer} activeOpacity={0.85} style={{ height: 56, width: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>↺</Text>
                </TouchableOpacity>
              </>
            )}
            {(phase === 'done' || phase === 'rest') && (
              <TouchableOpacity onPress={resetTimer} activeOpacity={0.85} style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 }}>RESET</Text>
              </TouchableOpacity>
            )}
          </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TimerScreenTab({ lang }) {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible', opacity: 0.3 }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />
      <StretchTimerInline lang={lang} />
    </View>
  );
}

function StretchTimerInline({ lang }) {
  var tr = T[lang] || T['fr'];
  var [duration, setDuration] = useState(30);
  var [reps, setReps] = useState(1);
  var [phase, setPhase] = useState('idle');
  var [remaining, setRemaining] = useState(0);
  var [currentRep, setCurrentRep] = useState(1);
  var [paused, setPaused] = useState(false);
  var intervalRef = useRef(null);
  var startRef = useRef(0);
  var elapsedBeforePause = useRef(0);
  var progressAnim = useRef(new Animated.Value(1)).current;
  var soundRef = useRef(null);

  var durations = [15, 30, 45, 60, 90, 120, 180, 300];
  var durLabels = { 15: '15s', 30: '30s', 45: '45s', 60: '1 min', 90: '1m30', 120: '2 min', 180: '3 min', 300: '5 min' };

  async function playBeep() {
    try { if (soundRef.current) await soundRef.current.unloadAsync().catch(function() {}); if (TIMER_BEEP) { var r = await Audio.Sound.createAsync(TIMER_BEEP); soundRef.current = r.sound; await r.sound.setVolumeAsync(1.0); await r.sound.playAsync(); } } catch(e) {}
    hapticSuccess(); hapticSuccess();
  }

  function runCycle(dur, rep) {
    setRemaining(dur); setCurrentRep(rep); setPhase('running'); setPaused(false); elapsedBeforePause.current = 0; startRef.current = Date.now();
    progressAnim.setValue(1); Animated.timing(progressAnim, { toValue: 0, duration: dur * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(function() {
      var el = elapsedBeforePause.current + Math.floor((Date.now() - startRef.current) / 1000); var rem = dur - el;
      if (rem <= 0) { clearInterval(intervalRef.current); setRemaining(0); playBeep();
        if (rep < reps) { setPhase('rest'); var rc = 6; setRemaining(rc); var ri = setInterval(function() { rc--; setRemaining(rc); if (rc <= 0) { clearInterval(ri); runCycle(dur, rep + 1); } }, 1000); intervalRef.current = ri; }
        else { setPhase('done'); }
      } else { setRemaining(rem); }
    }, 250);
  }

  function startTimer() { runCycle(duration, 1); }
  function pauseTimer() { if (intervalRef.current) clearInterval(intervalRef.current); elapsedBeforePause.current += Math.floor((Date.now() - startRef.current) / 1000); progressAnim.stopAnimation(); setPaused(true); }
  function resumeTimer() { setPaused(false); startRef.current = Date.now(); Animated.timing(progressAnim, { toValue: 0, duration: remaining * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    intervalRef.current = setInterval(function() { var el = elapsedBeforePause.current + Math.floor((Date.now() - startRef.current) / 1000); var r = duration - el;
      if (r <= 0) { clearInterval(intervalRef.current); setRemaining(0); playBeep(); if (currentRep < reps) { setPhase('rest'); var rc = 6; setRemaining(rc); var ri = setInterval(function() { rc--; setRemaining(rc); if (rc <= 0) { clearInterval(ri); runCycle(duration, currentRep + 1); } }, 1000); intervalRef.current = ri; } else { setPhase('done'); } } else { setRemaining(r); }
    }, 250);
  }
  function resetTimer() { if (intervalRef.current) clearInterval(intervalRef.current); setPhase('idle'); setRemaining(0); setCurrentRep(1); setPaused(false); elapsedBeforePause.current = 0; progressAnim.setValue(1); }
  useEffect(function() { return function() { if (intervalRef.current) clearInterval(intervalRef.current); if (soundRef.current) soundRef.current.unloadAsync().catch(function() {}); }; }, []);

  var circR = 90; var circC = 2 * Math.PI * circR;
  var dashOffset = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [circC, 0] });
  var remMin = Math.floor(remaining / 60); var remSec = remaining % 60;
  var isActive = phase === 'running' || phase === 'rest';

  return (
    <ScrollView style={{ flex: 1, zIndex: 2 }} contentContainerStyle={{ paddingTop: 62, paddingBottom: 120, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 20, alignSelf: 'stretch', marginBottom: 16 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 34 }}>+</Text></Text>
        <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.timer_title || 'Minuteur Stretching & Eldoa'}</Text>
      </View>
      <Text style={{ fontSize: 12, fontWeight: '300', color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 18, marginBottom: 20, paddingHorizontal: 32 }}>{tr.timer_desc || 'Maintenez chaque étirement pendant la durée choisie. Respirez profondément et relâchez à chaque bip.'}</Text>

      <View style={{ backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 24, padding: 24, alignItems: 'center', marginHorizontal: 20, alignSelf: 'stretch' }}>
        <View style={{ width: (circR + 10) * 2, height: (circR + 10) * 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Svg width={(circR + 10) * 2} height={(circR + 10) * 2}>
            <Circle cx={circR + 10} cy={circR + 10} r={circR} stroke="rgba(174,239,77,0.12)" strokeWidth={5} fill="none" />
            <AnimatedCircle cx={circR + 10} cy={circR + 10} r={circR} stroke={phase === 'rest' ? '#00BDD0' : '#AEEF4D'} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={circC} strokeDashoffset={isActive ? dashOffset : 0} transform={'rotate(-90 ' + (circR + 10) + ' ' + (circR + 10) + ')'} />
          </Svg>
          <View style={{ position: 'absolute', alignItems: 'center' }}>
            {phase === 'rest' && <Text style={{ fontSize: 14, fontWeight: '600', color: '#00BDD0', marginBottom: 4 }}>{tr.timer_rest || 'Repos'}</Text>}
            <Text style={{ fontSize: 44, fontWeight: '200', color: '#ffffff', fontVariant: ['tabular-nums'] }}>
              {isActive || phase === 'done' ? <>{String(remMin).padStart(2, '0')}:<Text style={{ color: '#FF3B30' }}>{String(remSec).padStart(2, '0')}</Text></> : durLabels[duration] || duration + 's'}
            </Text>
            {isActive && reps > 1 && <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D', marginTop: 4 }}>{currentRep} / {reps}</Text>}
            {phase === 'done' && <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D', marginTop: 4 }}>{tr.timer_done || 'Terminé !'}</Text>}
          </View>
        </View>

        {phase === 'idle' && (
          <>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>{tr.timer_duree || 'Durée'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18, maxHeight: 38 }} contentContainerStyle={{ gap: 6 }}>
              {durations.map(function(d) { var active = duration === d; return (
                <TouchableOpacity key={d} onPress={function() { setDuration(d); }} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.12)', backgroundColor: active ? 'rgba(174,239,77,0.15)' : 'transparent' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#AEEF4D' : 'rgba(255,255,255,0.4)' }}>{durLabels[d]}</Text>
                </TouchableOpacity>);
              })}
            </ScrollView>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>{tr.timer_reps || 'Répétitions'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <TouchableOpacity onPress={function() { setReps(Math.max(1, reps - 1)); }} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>−</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff', width: 45, textAlign: 'center' }}>{reps}x</Text>
              <TouchableOpacity onPress={function() { setReps(Math.min(10, reps + 1)); }} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>+</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
          {phase === 'idle' && <TouchableOpacity onPress={startTimer} activeOpacity={0.85} style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16, fontWeight: '800', color: '#000000' }}>START</Text></TouchableOpacity>}
          {phase === 'running' && !paused && <TouchableOpacity onPress={pauseTimer} activeOpacity={0.85} style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>PAUSE</Text></TouchableOpacity>}
          {phase === 'running' && paused && <><TouchableOpacity onPress={resumeTimer} activeOpacity={0.85} style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16, fontWeight: '800', color: '#000000' }}>REPRENDRE</Text></TouchableOpacity><TouchableOpacity onPress={resetTimer} activeOpacity={0.85} style={{ height: 50, width: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>↺</Text></TouchableOpacity></>}
          {(phase === 'done' || phase === 'rest') && <TouchableOpacity onPress={resetTimer} activeOpacity={0.85} style={{ flex: 1, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 16, fontWeight: '800', color: '#ffffff' }}>RESET</Text></TouchableOpacity>}
        </View>
      </View>
    </ScrollView>
  );
}

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
      console.log('IAP Error:', e);
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
      console.log('IAP Error:', e);
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
      console.log('IAP Error:', e);
      devWarn('RevenueCat restorePurchases', e);
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        let sub = await AsyncStorage.getItem(FLUID_SUB_KEY);
        if (sub === null) {
          const legacyA = await AsyncStorage.getItem('fluid_subscription_active');
          const legacyB = await AsyncStorage.getItem('fluidbody_is_subscriber');
          if (legacyA === 'true' || legacyB === 'true') {
            try {
              await AsyncStorage.setItem(FLUID_SUB_KEY, 'true');
              await AsyncStorage.multiRemove(['fluid_subscription_active', 'fluidbody_is_subscriber']);
            } catch (e2) {}
            sub = 'true';
          }
        }
        if (sub === 'true') setIsSubscriber(true);
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
        console.log('IAP Error:', e);
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
        console.log('Loading products...', PRODUCT_IDS);
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
          console.log('Products loaded:', map);
        }
      } catch (e) {
        console.log('IAP Error:', e);
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
          <Tab.Screen name={tr.tabs[0]} options={{ tabBarIcon: (props) => <TabIconMonCorps {...props} /> }}>{() => <MonCorps prenom={prenom} done={done} toggleDone={toggleDone} lang={lang} tensionIdxs={tensionIdxs} streak={streak} isSubscriber={isSubscriber} onActivateSubscription={openPaywall} onTryFreeSession={() => setFreeDetailVisible(true)} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[1]} options={{ tabBarIcon: (props) => <TabIconResume {...props} /> }}>{() => <ResumeScreen done={done} lang={lang} streak={streak} prenom={prenom} tensionIdxs={tensionIdxs} supaUser={supaUser} onCreateAccount={function() { setShowAuthScreen(true); }} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[2]} options={{ tabBarIcon: (props) => <TabIconBiblio {...props} /> }}>{() => <Biblio lang={lang} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[3]} options={{ tabBarIcon: (props) => <TabIconTimer {...props} /> }}>{() => <TimerScreenTab lang={lang} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[4]} options={{ tabBarIcon: (props) => <TabIconProfil {...props} /> }}>{() => <ProfilScreen prenom={prenom} done={done} lang={lang} streak={streak} supabase={supabase} supaUser={supaUser} onLogout={() => { supabase?.auth.signOut(); }} isSubscriber={isSubscriber} onRestorePurchases={() => { setPaywallVisible(true); }} />}</Tab.Screen>
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