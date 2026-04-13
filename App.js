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

// getResumeIndicesForPilier and canAccessSeanceIndex moved to src/utils.js



// getSeanceDuJour moved to src/utils.js


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


// getSeances moved to src/utils.js

// ETAPE_COLORS, PILIER_LABEL_IDX, getPiliers moved to src/utils.js

function IconEpaules({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Path d="M22 62 Q18 46 30 36 Q44 26 44 18 Q44 26 58 36 Q70 46 66 62" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/><Circle cx="44" cy="13" r="6" stroke={color} strokeWidth="3.5" fill="none"/></Svg>; }
function IconDos({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Line x1="44" y1="10" x2="44" y2="78" stroke={color} strokeWidth="3.5" strokeLinecap="round"/><Rect x="38" y="16" width="12" height="8" rx="2.5" stroke={color} strokeWidth="3.5" fill="none"/><Rect x="38" y="29" width="12" height="8" rx="2.5" stroke={color} strokeWidth="3.5" fill="none"/><Rect x="38" y="42" width="12" height="8" rx="2.5" stroke={color} strokeWidth="3.5" fill="none"/><Rect x="38" y="55" width="12" height="8" rx="2.5" stroke={color} strokeWidth="3.5" fill="none"/></Svg>; }
function IconMobilite({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Circle cx="44" cy="44" r="16" stroke={color} strokeWidth="3.5" fill="none"/><Path d="M44 28 A16 16 0 0 1 60 44" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M60 36 L60 44 L52 44" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Path d="M24 44 A20 20 0 0 0 44 64" stroke={color} strokeWidth="2.5" strokeDasharray="4 3" strokeLinecap="round" fill="none" opacity="0.6"/></Svg>; }
function IconPosture({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Circle cx="44" cy="14" r="6" stroke={color} strokeWidth="3.5" fill="none"/><Line x1="44" y1="20" x2="44" y2="54" stroke={color} strokeWidth="3.5" strokeLinecap="round"/><Path d="M28 30 L44 38 L60 30" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Path d="M44 54 L34 72" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M44 54 L54 72" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Line x1="24" y1="8" x2="24" y2="76" stroke={color} strokeWidth="2.5" strokeDasharray="3 3" opacity="0.45"/></Svg>; }
function IconRespiration({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Path d="M8 44 Q18 22 28 44 Q38 66 44 44 Q50 22 60 44 Q70 66 80 44" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M16 54 Q24 44 32 54 Q40 64 48 54 Q56 44 64 54 Q70 50 76 54" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.5"/></Svg>; }
function IconConscience({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Path d="M14 44 Q28 22 44 44 Q58 66 72 44 Q58 22 44 44 Q28 66 14 44Z" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Circle cx="44" cy="44" r="8" stroke={color} strokeWidth="3.5" fill="none"/><Circle cx="44" cy="44" r="3" fill={color}/></Svg>; }
function IconMatPilates({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Circle cx="30" cy="28" r="6" stroke={color} strokeWidth="3.5" fill="none"/><Line x1="30" y1="34" x2="30" y2="56" stroke={color} strokeWidth="3.5" strokeLinecap="round"/><Path d="M30 42 L18 36" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M30 42 L42 36" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M30 56 L22 70" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Path d="M30 56 L38 70" stroke={color} strokeWidth="3.5" strokeLinecap="round" fill="none"/><Rect x="10" y="72" width="68" height="6" rx="3" stroke={color} strokeWidth="2.5" fill="none" opacity="0.6"/><Path d="M42 36 C54 26 64 20 74 18" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 3" fill="none" opacity="0.7"/><Circle cx="74" cy="18" r="3.5" fill={color} opacity="0.8"/></Svg>; }
function IconOffice({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Path d="M24 72h40" stroke={color} strokeWidth="3.5" strokeLinecap="round"/><Path d="M30 72V52c0-2 1-3 3-3h22c2 0 3 1 3 3v20" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Path d="M36 49V38c0-2 2-4 4-6l4-4 4 4c2 2 4 4 4 6v11" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Circle cx="44" cy="22" r="6" stroke={color} strokeWidth="3.5" fill="none"/><Path d="M28 72c0 0-2-8-4-8" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/><Path d="M60 72c0 0 2-8 4-8" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/></Svg>; }
const ICONS = { p1: IconEpaules, p2: IconDos, p3: IconMobilite, p4: IconPosture, p5: IconRespiration, p6: IconConscience, p7: IconMatPilates, p8: IconOffice };

// CelebrationOverlay moved to src/screens/MonCorps.js

// PilierPanel moved to src/screens/MonCorps.js
/* PilierPanel body removed — see src/screens/MonCorps.js */

const COACH_IMAGE = require("./assets/coach.jpg");

// MetricTile moved to src/screens/MonCorps.js (exported as named export)

// MonCorps moved to src/screens/MonCorps.js

/** Abonnement vidéos simulé — pas de module IAP dans l'app. */
const FLUID_SUB_KEY = 'fluid_sub';
const DONE_KEY = 'fluidbody_done';
const STREAK_KEY = 'fluidbody_streak';
const STREAK_DATE_KEY = 'fluidbody_streak_date';
/** Dernière demande OTP email — évite un 2ᵉ envoi si l'utilisateur repasse par « J'ai déjà un compte » ou rouvre l'écran. */
const AUTH_OTP_PENDING_KEY = 'fluid_auth_otp_pending_v1';
const AUTH_OTP_RESEND_COOLDOWN_MS = 90 * 1000;
const AUTH_OTP_STEP_RESTORE_MS = 25 * 60 * 1000;



// JOUR_LABELS, scheduleProgNotifications, cancelProgNotifications, CreateProgramScreen moved to src/screens/MonCorps.js

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
  function zoneColor(key) {
    var count = (done[key] || []).filter(Boolean).length;
    var p = count / 20;
    if (p === 0) return 'rgba(255,70,70,0.3)';
    if (p < 0.25) return 'rgba(255,140,60,0.45)';
    if (p < 0.5) return 'rgba(255,210,60,0.5)';
    if (p < 0.75) return 'rgba(174,239,77,0.55)';
    return 'rgba(174,239,77,0.8)';
  }
  function zonePct(key) { return ((done[key] || []).filter(Boolean).length / 20 * 100).toFixed(0); }
  var tr = T[lang] || T['fr'];
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 0 }}>
        {/* Labels gauche */}
        <View style={{ width: 65, paddingTop: 30, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p1') }} />
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p1'})||{}).label} {zonePct('p1')}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p2') }} />
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p2'})||{}).label} {zonePct('p2')}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p4') }} />
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p4'})||{}).label} {zonePct('p4')}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p8') }} />
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p8'})||{}).label} {zonePct('p8')}%</Text>
          </View>
        </View>
        {/* Mannequin image + zones colorées */}
        <View style={{ width: 110, height: 250, position: 'relative' }}>
          <ImageBackground source={require('./assets/mannequin.png')} resizeMode="contain" style={{ width: 110, height: 250, opacity: 0.6 }} imageStyle={{ tintColor: '#AEEF4D' }} />
          {/* Zones colorées superposées */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Svg width={110} height={250} viewBox="0 0 100 280">
          {/* Zones colorées sur le mannequin */}
          {/* Épaules p1 */}
          <Ellipse cx="34" cy="46" rx="10" ry="6" fill={zoneColor('p1')} opacity={0.6} />
          <Ellipse cx="66" cy="46" rx="10" ry="6" fill={zoneColor('p1')} opacity={0.6} />
          {/* Torse p2 */}
          <Ellipse cx="50" cy="68" rx="14" ry="16" fill={zoneColor('p2')} opacity={0.5} />
          {/* Core p4 */}
          <Ellipse cx="50" cy="95" rx="10" ry="14" fill={zoneColor('p4')} opacity={0.45} />
          {/* Obliques p5 */}
          <Ellipse cx="36" cy="82" rx="5" ry="12" fill={zoneColor('p5')} opacity={0.35} />
          <Ellipse cx="64" cy="82" rx="5" ry="12" fill={zoneColor('p5')} opacity={0.35} />
          {/* Bras p7 */}
          <Ellipse cx="24" cy="80" rx="5" ry="18" fill={zoneColor('p7')} opacity={0.45} />
          <Ellipse cx="76" cy="80" rx="5" ry="18" fill={zoneColor('p7')} opacity={0.45} />
          {/* Avant-bras p8 */}
          <Ellipse cx="22" cy="115" rx="4" ry="14" fill={zoneColor('p8')} opacity={0.35} />
          <Ellipse cx="78" cy="115" rx="4" ry="14" fill={zoneColor('p8')} opacity={0.35} />
          {/* Hanches p3 */}
          <Ellipse cx="50" cy="118" rx="16" ry="10" fill={zoneColor('p3')} opacity={0.5} />
          {/* Cuisses p3 */}
          <Ellipse cx="40" cy="160" rx="7" ry="24" fill={zoneColor('p3')} opacity={0.4} />
          <Ellipse cx="60" cy="160" rx="7" ry="24" fill={zoneColor('p3')} opacity={0.4} />
          {/* Mollets p6 */}
          <Ellipse cx="38" cy="215" rx="5" ry="18" fill={zoneColor('p6')} opacity={0.4} />
          <Ellipse cx="62" cy="215" rx="5" ry="18" fill={zoneColor('p6')} opacity={0.4} />
        </Svg>
          </View>
        </View>
        {/* Labels droite */}
        <View style={{ width: 65, paddingTop: 30, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p3')}% {(piliers.find(function(x){return x.key==='p3'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p3') }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p5')}% {(piliers.find(function(x){return x.key==='p5'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p5') }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p6')}% {(piliers.find(function(x){return x.key==='p6'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p6') }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p7')}% {(piliers.find(function(x){return x.key==='p7'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p7') }} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,70,70,0.4)' }} />
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{tr.body_neglected || 'À travailler'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,210,60,0.6)' }} />
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{tr.body_progress || 'En progrès'}</Text>
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

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 18 }}>{tr.resume_activite || 'Activité'}</Text>
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
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, alignSelf: 'flex-start' }}>{meduseName || (tr.meduse_card_title || 'Ta méduse')}</Text>
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

        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 }}>
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

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, alignSelf: 'flex-start' }}>{tr.body_map_title || 'Bilan corporel'}</Text>
          <BodyMapVisual done={done} lang={lang} />
        </View>

        {(function() {
          var streakStatus = 'safe';
          if (streak > 0) {
            var allDoneToday = Object.values(done).flat().filter(Boolean).length;
          }
          var atRisk = streak > 0 && totalDone > 0;
          return atRisk && streak >= 2 ? (
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(255,150,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,180,60,0.4)', borderRadius: 12, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 24 }}>🔥</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFB43C' }}>{tr.streak_protect_title || 'Protège ton streak !'}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,180,60,0.6)', marginTop: 2 }}>{tr.streak_protect_sub || 'Fais une micro-séance de 2 min pour ne pas perdre tes ' + streak + ' jours'}</Text>
              </View>
            </View>
          ) : null;
        })()}

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.calendar_title || 'Activité récente'}</Text>
          <ActivityCalendar lang={lang} />
        </View>

        {(function() {
          var rec = getSmartRecommendation(done, tensionIdxs, lang);
          if (!rec || !rec.seance) return null;
          return (
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
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
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
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

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.resume_seances || 'Séances FluidBody'}</Text>
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
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.par_pilier}</Text>
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
                <Text style={{ fontSize: pct2 === 0 ? 13 : 16, fontWeight: '600', color: pct2 === 0 ? '#00BDD0' : '#AEEF4D', marginLeft: 8 }}>{pct2 === 0 ? (tr.cest_parti || "C'est parti ! 🌊") : pct2 + '%'}</Text>
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
                  <Text style={{ fontSize: pct2 === 0 ? 16 : 22, fontWeight: pct2 === 0 ? '600' : '200', color: pct2 === 0 ? '#00BDD0' : '#AEEF4D' }}>{pct2 === 0 ? (tr.cest_parti || "C'est parti ! 🌊") : pct2 + '%'}</Text>
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
          <Tab.Screen name={tr.tabs[3]} options={{ tabBarIcon: (props) => <TabIconProfil {...props} /> }}>{() => <ProfilScreen prenom={prenom} done={done} lang={lang} streak={streak} supabase={supabase} supaUser={supaUser} onLogout={() => { supabase?.auth.signOut(); }} isSubscriber={isSubscriber} onRestorePurchases={() => { setPaywallVisible(true); }} />}</Tab.Screen>
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