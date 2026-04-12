import 'react-native-url-polyfill/auto';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, Animated, Easing, View, TouchableOpacity, Pressable, ScrollView, TextInput, Dimensions, Alert, Modal, Platform, AppState, KeyboardAvoidingView, ImageBackground, PanResponder } from 'react-native';
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
        <Path d="M12 2C8 2 5 6 5 10c0 3 2 5 5 6v6" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M12 16c3-1 7-3 7-6 0-4-3-8-7-8" stroke={c} strokeWidth={1.6} strokeLinecap="round" opacity={0.5} />
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

const Tab = createBottomTabNavigator();
const { width: SW, height: SH } = Dimensions.get('window');
const IS_IPAD = SW >= 768;
const SCALE = IS_IPAD ? SW / 390 : 1; // Scale factor relative to iPhone 390px
const VIDEO_DEMO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

const SUPPORTED_APP_LANGS = ['fr', 'en', 'es', 'it'];

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
const ZONE_TO_PILIER = { 0: 'p2', 1: 'p1', 2: 'p3', 3: 'p4', 4: 'p5', 5: 'p6' };

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
  // Séance démo basée sur le mois : change chaque mois
  var monthIndex = new Date().getMonth() + new Date().getFullYear() * 12;
  var pick = allSeances[monthIndex % allSeances.length];
  return pick;
}


// ══════════════════════════════════
// TRADUCTIONS
// ══════════════════════════════════
const T = {
  fr: {
    lang: 'fr', flag: '🇫🇷', nom: 'Français',
    tabs: ['FluidBody+', 'Résumé', 'Biblio', 'Profil'],
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
    ob_zones: ['Dos / Nuque', 'Épaules', 'Hanches', 'Posture', 'Respiration', 'Stress'],
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
    piliers: ['Épaules', 'Dos', 'Mobilité', 'Posture', 'Eldoa', 'Golf', 'Mat Pilates'],
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
    biblio_intro: 'La méthode FluidBody repose sur 5 étapes progressives. Chaque séance les traverse dans l\'ordre.',
    lire: ' de lecture',
    retour_biblio: '← Bibliothèque',
    points_cles: 'Points clés',
    mon_parcours: 'Mon Parcours',
    prog_globale: 'Progression globale',
    par_pilier: 'Par pilier',
    parcours_langue: 'Langue',
    mon_compte: 'Mon compte',
    compte_info: [['Application', 'FluidBody · Pilates'], ['Version', 'FluidBody Beta 1.0'], ['Méthode', 'Pilates Conscient · 23 ans']],
    progresser_sub: (p) => `${p}% du parcours complété`,
    recommande_pour_toi: 'POUR TOI',
    seance_gratuite: 'Séance gratuite',
    seance_du_jour_sub: "Recommandée pour toi aujourd'hui",
    commencer_seance: 'Commencer →',
    deja_faite: "✓ Déjà faite aujourd'hui",
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: "Ta séance démo t'attend. Ton corps a besoin de toi.",
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
    paywall_title: 'Des exercices pour tout le monde',
    paywall_sub: "D\u00e9couvrez de nouveaux exercices con\u00e7us pour tous les niveaux.",
    paywall_yearly_link: "\u00c9conomisez avec l\u2019abonnement annuel \u203a",
    paywall_monthly: 'Mensuel',
    paywall_yearly: 'Annuel',
    paywall_buy_monthly: 'Acheter mensuel',
    paywall_buy_yearly: 'Acheter annuel',
    paywall_restore: 'Restaurer mes achats',
    paywall_close: 'Fermer',
    paywall_prices_loading: 'Chargement des prix…',
    paywall_not_available: 'Achats indisponibles (Expo Go / simulateur).',
    paywall_start: 'Commencer',
    paywall_per_month: '/mois',
    paywall_try_free: 'Essayer avec la séance du mois gratuite',
    free_try_once: 'Essayez une fois cet épisode gratuitement',
    free_go: "C'est parti !",
    subscription_status_label: 'Abonnement vidéos',
    subscription_status_active: 'Actif — toutes les séances',
    subscription_status_free: 'Inactif — séances 1 et 2 gratuites',
    subscription_reset: 'Restaurer mes achats',
  },
  en: {
    lang: 'en', flag: '🇬🇧', nom: 'English',
    tabs: ['FluidBody+', 'Summary', 'Library', 'Profile'],
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
    ob_zones: ['Back / Neck', 'Shoulders', 'Hips', 'Posture', 'Breathing', 'Stress'],
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
    piliers: ['Shoulders', 'Back', 'Mobility', 'Posture', 'Eldoa', 'Golf', 'Mat Pilates'],
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
    biblio_intro: 'The FluidBody method is built on 5 progressive steps. Each session follows them in order.',
    lire: ' read',
    retour_biblio: '← Library',
    points_cles: 'Key points',
    mon_parcours: 'My Journey',
    prog_globale: 'Overall progress',
    par_pilier: 'By pillar',
    parcours_langue: 'Language',
    mon_compte: 'My account',
    compte_info: [['App', 'FluidBody · Pilates'], ['Version', 'FluidBody Beta 1.0'], ['Method', 'Conscious Pilates · 23 years']],
    progresser_sub: (p) => `${p}% of journey completed`,
    recommande_pour_toi: 'FOR YOU',
    seance_gratuite: 'Free session',
    seance_du_jour_sub: 'Recommended for you today',
    commencer_seance: 'Start →',
    deja_faite: '✓ Already done today',
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: 'Your demo session is waiting. Your body needs you.',
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
    paywall_title: 'Exercises for everyone',
    paywall_sub: 'Discover new exercises designed for all levels.',
    paywall_yearly_link: "Save with an annual subscription \u203a",
    paywall_monthly: 'Monthly',
    paywall_yearly: 'Yearly',
    paywall_buy_monthly: 'Buy monthly',
    paywall_buy_yearly: 'Buy yearly',
    paywall_restore: 'Restore purchases',
    paywall_close: 'Close',
    paywall_prices_loading: 'Loading prices…',
    paywall_not_available: 'Purchases unavailable (Expo Go / simulator).',
    paywall_start: 'Start',
    paywall_per_month: '/month',
    paywall_try_free: 'Try the free session of the month',
    free_try_once: 'Try this episode once for free',
    free_go: "Let's go!",
    subscription_status_label: 'Video subscription',
    subscription_status_active: 'Active — all sessions',
    subscription_status_free: 'Inactive — sessions 1–2 free',
    subscription_reset: 'Restore purchases',
  },
  es: {
    lang: 'es', flag: '🇪🇸', nom: 'Español',
    tabs: ['FluidBody+', 'Resumen', 'Biblioteca', 'Perfil'],
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
    ob_zones: ['Espalda / Cuello', 'Hombros', 'Caderas', 'Postura', 'Respiración', 'Estrés'],
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
    piliers: ['Hombros', 'Espalda', 'Movilidad', 'Postura', 'Eldoa', 'Golf', 'Mat Pilates'],
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
    biblio_intro: 'El método FluidBody se basa en 5 pasos progresivos. Cada sesión los recorre en orden.',
    lire: ' de lectura',
    retour_biblio: '← Biblioteca',
    points_cles: 'Puntos clave',
    mon_parcours: 'Mi Recorrido',
    prog_globale: 'Progreso global',
    par_pilier: 'Por pilar',
    parcours_langue: 'Idioma',
    mon_compte: 'Mi cuenta',
    compte_info: [['Aplicación', 'FluidBody · Pilates'], ['Versión', 'FluidBody Beta 1.0'], ['Método', 'Pilates Consciente · 23 años']],
    progresser_sub: (p) => `${p}% del recorrido completado`,
    recommande_pour_toi: 'PARA TI',
    seance_gratuite: 'Sesión gratuita',
    seance_du_jour_sub: 'Recomendada para ti hoy',
    commencer_seance: 'Empezar →',
    deja_faite: '✓ Ya hecha hoy',
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: 'Tu sesión demo te espera. Tu cuerpo te necesita.',
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
    paywall_title: 'Ejercicios para todos',
    paywall_sub: 'Descubre nuevos ejercicios dise\u00f1ados para todos los niveles.',
    paywall_yearly_link: "Ahorra con la suscripci\u00f3n anual \u203a",
    paywall_monthly: 'Mensual',
    paywall_yearly: 'Anual',
    paywall_buy_monthly: 'Comprar mensual',
    paywall_buy_yearly: 'Comprar anual',
    paywall_restore: 'Restaurar compras',
    paywall_close: 'Cerrar',
    paywall_prices_loading: 'Cargando precios…',
    paywall_not_available: 'Compras no disponibles (Expo Go / simulador).',
    paywall_start: 'Empezar',
    paywall_per_month: '/mes',
    paywall_try_free: 'Prueba la sesión gratuita del mes',
    free_try_once: 'Prueba este episodio una vez gratis',
    free_go: '¡Vamos!',
    subscription_status_label: 'Suscripción de vídeo',
    subscription_status_active: 'Activa — todas las sesiones',
    subscription_status_free: 'Inactiva — sesiones 1–2 gratis',
    subscription_reset: 'Restaurar compras',
  },
  it: {
    lang: 'it', flag: '🇮🇹', nom: 'Italiano',
    tabs: ['FluidBody+', 'Riepilogo', 'Biblioteca', 'Profilo'],
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
    ob_zones: ['Schiena / Collo', 'Spalle', 'Fianchi', 'Postura', 'Respirazione', 'Stress'],
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
    piliers: ['Spalle', 'Schiena', 'Mobilità', 'Postura', 'Eldoa', 'Golf', 'Mat Pilates'],
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
    biblio_intro: 'Il metodo FluidBody si basa su 5 passaggi progressivi. Ogni sessione li percorre in ordine.',
    lire: ' di lettura',
    retour_biblio: '← Biblioteca',
    points_cles: 'Punti chiave',
    mon_parcours: 'Il Mio Percorso',
    prog_globale: 'Progresso globale',
    par_pilier: 'Per pilastro',
    parcours_langue: 'Lingua',
    mon_compte: 'Il mio account',
    compte_info: [['App', 'FluidBody · Pilates'], ['Versione', 'FluidBody Beta 1.0'], ['Metodo', 'Pilates Consapevole · 23 anni']],
    progresser_sub: (p) => `${p}% del percorso completato`,
    recommande_pour_toi: 'PER TE',
    seance_gratuite: 'Sessione gratuita',
    seance_du_jour_sub: 'Consigliata per te oggi',
    commencer_seance: 'Inizia →',
    deja_faite: '✓ Già fatta oggi',
    notif_title: `FluidBody ${U_JELLY}`,
    notif_body: 'La tua sessione demo ti aspetta. Il tuo corpo ha bisogno di te.',
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
    paywall_title: 'Esercizi per tutti',
    paywall_sub: 'Scopri nuovi esercizi pensati per tutti i livelli.',
    paywall_yearly_link: "Risparmia con l\u2019abbonamento annuale \u203a",
    paywall_monthly: 'Mensile',
    paywall_yearly: 'Annuale',
    paywall_buy_monthly: 'Acquista mensile',
    paywall_buy_yearly: 'Acquista annuale',
    paywall_start: 'Inizia',
    paywall_per_month: '/mese',
    paywall_try_free: 'Prova la sessione gratuita del mese',
    free_try_once: 'Prova questo episodio una volta gratis',
    free_go: 'Andiamo!',
    paywall_restore: 'Ripristina acquisti',
    paywall_close: 'Chiudi',
    paywall_prices_loading: 'Caricamento prezzi…',
    paywall_not_available: 'Acquisti non disponibili (Expo Go / simulatore).',
    subscription_status_label: 'Abbonamento video',
    subscription_status_active: 'Attivo — tutte le sessioni',
    subscription_status_free: 'Inattivo — sessioni 1–2 gratuite',
    subscription_reset: 'Ripristina acquisti',
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
};

const SEANCES_FR = {
  p1: [['Comprendre l\'épaule', '12 min', 'Comprendre'], ['La coiffe des rotateurs', '15 min', 'Comprendre'], ['Ressentir les omoplates', '12 min', 'Ressentir'], ['Le poids du bras', '15 min', 'Ressentir'], ['Cercles de conscience', '18 min', 'Ressentir'], ['Libérer les trapèzes', '20 min', 'Préparer'], ['Mobiliser la scapula', '22 min', 'Préparer'], ['Activer le dentelé', '25 min', 'Préparer'], ['Ouverture thoracique', '28 min', 'Préparer'], ['Proprioception épaule', '30 min', 'Préparer'], ['Le geste juste', '25 min', 'Exécuter'], ['Élévation consciente', '28 min', 'Exécuter'], ['Rotation externe guidée', '30 min', 'Exécuter'], ['Tirés et poussés', '32 min', 'Exécuter'], ['Circuit épaule complète', '35 min', 'Exécuter'], ['Force & souplesse I', '35 min', 'Évoluer'], ['Épaule sous charge', '38 min', 'Évoluer'], ['Équilibre scapulaire', '40 min', 'Évoluer'], ['L\'épaule athlétique', '42 min', 'Évoluer'], ['Maîtrise totale', '45 min', 'Évoluer']],
  p2: [['Le dos expliqué', '12 min', 'Comprendre'], ['Pourquoi le dos souffre', '15 min', 'Comprendre'], ['La nuque et ses tensions', '15 min', 'Comprendre'], ['Ressentir sa colonne', '12 min', 'Ressentir'], ['Le sacrum comme base', '18 min', 'Ressentir'], ['Relâcher le psoas', '20 min', 'Préparer'], ['Décompression lombaire', '22 min', 'Préparer'], ['Mobiliser les thoraciques', '25 min', 'Préparer'], ['Cat-Cow conscient', '20 min', 'Préparer'], ['Libérer la nuque', '22 min', 'Préparer'], ['Renforcement profond I', '25 min', 'Exécuter'], ['La planche consciente', '28 min', 'Exécuter'], ['Pont fessier guidé', '28 min', 'Exécuter'], ['Rotation vertébrale', '30 min', 'Exécuter'], ['Extension du dos', '32 min', 'Exécuter'], ['Programme anti-douleur I', '30 min', 'Évoluer'], ['Programme anti-douleur II', '35 min', 'Évoluer'], ['Dos & respiration', '38 min', 'Évoluer'], ['Colonne intégrée', '40 min', 'Évoluer'], ['La colonne parfaite', '45 min', 'Évoluer']],
  p3: [['Comprendre la hanche', '2 min 10 s', 'Comprendre', 'https://vz-1a4e2cac-0dc.b-cdn.net/596e732b-fa75-4606-aa8a-45fb034d2e0b/playlist.m3u8'], ['Le genou fragile', '15 min', 'Comprendre'], ['La cheville oubliée', '12 min', 'Comprendre'], ['Ressentir la hanche', '15 min', 'Ressentir'], ['Cartographie bas du corps', '20 min', 'Ressentir'], ['Mobilisation de hanche I', '20 min', 'Préparer'], ['Libération des fléchisseurs', '22 min', 'Préparer'], ['Mobilisation de hanche II', '25 min', 'Préparer'], ['Mobilité du genou', '20 min', 'Préparer'], ['La cheville en action', '22 min', 'Préparer'], ['Squat conscient I', '25 min', 'Exécuter'], ['Fente guidée', '28 min', 'Exécuter'], ['Pont et rotation de hanche', '28 min', 'Exécuter'], ['Station unipodale', '30 min', 'Exécuter'], ['Circuit mobilité', '32 min', 'Exécuter'], ['Mobilité & Pilates I', '30 min', 'Évoluer'], ['Profondeur de hanche', '35 min', 'Évoluer'], ['Genoux & force', '38 min', 'Évoluer'], ['La chaîne postérieure', '40 min', 'Évoluer'], ['Corps libre en bas', '45 min', 'Évoluer']],
  p4: [['La posture expliquée', '12 min', 'Comprendre'], ['Les 4 courbes naturelles', '15 min', 'Comprendre'], ['Posture & douleur', '15 min', 'Comprendre'], ['Ressentir l\'alignement', '12 min', 'Ressentir'], ['L\'axe vertical', '18 min', 'Ressentir'], ['Débloquer la cage thoracique', '20 min', 'Préparer'], ['Activer les stabilisateurs', '22 min', 'Préparer'], ['Rééquilibrer le bassin', '25 min', 'Préparer'], ['Aligner le cou', '22 min', 'Préparer'], ['Proprioception posturale', '25 min', 'Préparer'], ['Debout conscient', '25 min', 'Exécuter'], ['Marche consciente', '28 min', 'Exécuter'], ['Assis sans souffrir', '25 min', 'Exécuter'], ['Travail en miroir', '30 min', 'Exécuter'], ['Posture sous charge', '32 min', 'Exécuter'], ['Programme bureau I', '25 min', 'Évoluer'], ['Programme bureau II', '30 min', 'Évoluer'], ['Posture & respiration', '35 min', 'Évoluer'], ['Corps en équilibre', '40 min', 'Évoluer'], ['L\'alignement parfait', '45 min', 'Évoluer']],
  p5: [['Comprendre le souffle', '12 min', 'Comprendre'], ['Le diaphragme', '15 min', 'Comprendre'], ['Respiration & nerfs', '15 min', 'Comprendre'], ['Ressentir son souffle', '10 min', 'Ressentir'], ['Le souffle tridimensionnel', '15 min', 'Ressentir'], ['Cohérence cardiaque I', '12 min', 'Préparer'], ['Libérer le diaphragme', '15 min', 'Préparer'], ['Respiration latérale', '18 min', 'Préparer'], ['Respiration dorsale', '20 min', 'Préparer'], ['Plancher pelvien', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Souffle & mouvement', '25 min', 'Exécuter'], ['Cohérence cardiaque II', '20 min', 'Exécuter'], ['Souffle & gainage', '28 min', 'Exécuter'], ['Séquence souffle complet', '30 min', 'Exécuter'], ['Techniques avancées I', '25 min', 'Évoluer'], ['Souffle & performance', '30 min', 'Évoluer'], ['Respiration & émotions', '32 min', 'Évoluer'], ['Anti-stress respiratoire', '35 min', 'Évoluer'], ['Maître du souffle', '40 min', 'Évoluer']],
  p6: [['Qu\'est-ce que la proprioception', '12 min', 'Comprendre'], ['Le corps dans l\'espace', '15 min', 'Comprendre'], ['Conscience & douleur', '15 min', 'Comprendre'], ['Le scan corporel I', '12 min', 'Ressentir'], ['Sentir sans voir', '15 min', 'Ressentir'], ['Équilibre statique I', '15 min', 'Préparer'], ['Micro-mouvements', '18 min', 'Préparer'], ['Équilibre instable', '20 min', 'Préparer'], ['Le regard intérieur', '22 min', 'Préparer'], ['Mapping corporel', '25 min', 'Préparer'], ['Mouvement lent I', '20 min', 'Exécuter'], ['Coordination fine', '25 min', 'Exécuter'], ['Anticipation & réaction', '28 min', 'Exécuter'], ['Mouvement lent II', '30 min', 'Exécuter'], ['Fluidité consciente', '32 min', 'Exécuter'], ['Méditation en mouvement', '25 min', 'Évoluer'], ['Inversion consciente', '30 min', 'Évoluer'], ['Conscience des fascias', '35 min', 'Évoluer'], ['Intelligence corporelle', '38 min', 'Évoluer'], ['L\'être dans le corps', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & sa méthode', '12 min', 'Comprendre'], ['Les 6 principes du Mat', '15 min', 'Comprendre'], ['Le centre — powerhouse', '15 min', 'Comprendre'], ['Sentir le tapis sous soi', '12 min', 'Ressentir'], ['Connexion bassin-plancher', '15 min', 'Ressentir'], ['Le Hundred — initiation', '20 min', 'Préparer'], ['Roll-Up conscient', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Activation du centre', '22 min', 'Préparer'], ['La série des 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Séquence Mat niveau 1', '35 min', 'Évoluer'], ['Séquence Mat niveau 2', '38 min', 'Évoluer'], ['Teaser guidé', '40 min', 'Évoluer'], ['Mat flow complet', '42 min', 'Évoluer'], ['Maîtrise du Mat', '45 min', 'Évoluer']],
};

const SEANCES_EN = {
  p1: [['Understanding the shoulder', '12 min', 'Comprendre'], ['The rotator cuff', '15 min', 'Comprendre'], ['Feeling the shoulder blades', '12 min', 'Ressentir'], ['The weight of the arm', '15 min', 'Ressentir'], ['Awareness circles', '18 min', 'Ressentir'], ['Releasing the trapezius', '20 min', 'Préparer'], ['Mobilizing the scapula', '22 min', 'Préparer'], ['Activating the serratus', '25 min', 'Préparer'], ['Thoracic opening', '28 min', 'Préparer'], ['Shoulder proprioception', '30 min', 'Préparer'], ['The right gesture', '25 min', 'Exécuter'], ['Conscious elevation', '28 min', 'Exécuter'], ['Guided external rotation', '30 min', 'Exécuter'], ['Pulls and pushes', '32 min', 'Exécuter'], ['Full shoulder circuit', '35 min', 'Exécuter'], ['Strength & flexibility I', '35 min', 'Évoluer'], ['Loaded shoulder', '38 min', 'Évoluer'], ['Scapular balance', '40 min', 'Évoluer'], ['The athletic shoulder', '42 min', 'Évoluer'], ['Total mastery', '45 min', 'Évoluer']],
  p2: [['The back explained', '12 min', 'Comprendre'], ['Why the back hurts', '15 min', 'Comprendre'], ['The neck and its tensions', '15 min', 'Comprendre'], ['Feeling the spine', '12 min', 'Ressentir'], ['The sacrum as base', '18 min', 'Ressentir'], ['Releasing the psoas', '20 min', 'Préparer'], ['Lumbar decompression', '22 min', 'Préparer'], ['Mobilizing the thoracics', '25 min', 'Préparer'], ['Conscious Cat-Cow', '20 min', 'Préparer'], ['Releasing the neck', '22 min', 'Préparer'], ['Deep strengthening I', '25 min', 'Exécuter'], ['The conscious plank', '28 min', 'Exécuter'], ['Guided glute bridge', '28 min', 'Exécuter'], ['Vertebral rotation', '30 min', 'Exécuter'], ['Back extension', '32 min', 'Exécuter'], ['Anti-pain program I', '30 min', 'Évoluer'], ['Anti-pain program II', '35 min', 'Évoluer'], ['Back & breathing', '38 min', 'Évoluer'], ['Integrated spine', '40 min', 'Évoluer'], ['The perfect spine', '45 min', 'Évoluer']],
  p3: [['Understanding the hip', '2 min 10 s', 'Comprendre'], ['The fragile knee', '15 min', 'Comprendre'], ['The forgotten ankle', '12 min', 'Comprendre'], ['Feeling the hip', '15 min', 'Ressentir'], ['Lower body mapping', '20 min', 'Ressentir'], ['Hip mobilization I', '20 min', 'Préparer'], ['Releasing the flexors', '22 min', 'Préparer'], ['Hip mobilization II', '25 min', 'Préparer'], ['Knee mobility', '20 min', 'Préparer'], ['The ankle in action', '22 min', 'Préparer'], ['Conscious squat I', '25 min', 'Exécuter'], ['Guided lunge', '28 min', 'Exécuter'], ['Hip bridge & rotation', '28 min', 'Exécuter'], ['Single leg stance', '30 min', 'Exécuter'], ['Mobility circuit', '32 min', 'Exécuter'], ['Mobility & Pilates I', '30 min', 'Évoluer'], ['Hip depth', '35 min', 'Évoluer'], ['Knees & strength', '38 min', 'Évoluer'], ['The posterior chain', '40 min', 'Évoluer'], ['Free lower body', '45 min', 'Évoluer']],
  p4: [['Posture explained', '12 min', 'Comprendre'], ['The 4 natural curves', '15 min', 'Comprendre'], ['Posture & pain', '15 min', 'Comprendre'], ['Feeling alignment', '12 min', 'Ressentir'], ['The vertical axis', '18 min', 'Ressentir'], ['Opening the chest', '20 min', 'Préparer'], ['Activating stabilizers', '22 min', 'Préparer'], ['Rebalancing the pelvis', '25 min', 'Préparer'], ['Aligning the neck', '22 min', 'Préparer'], ['Postural proprioception', '25 min', 'Préparer'], ['Standing consciously', '25 min', 'Exécuter'], ['Conscious walking', '28 min', 'Exécuter'], ['Sitting without pain', '25 min', 'Exécuter'], ['Mirror work', '30 min', 'Exécuter'], ['Posture under load', '32 min', 'Exécuter'], ['Desk program I', '25 min', 'Évoluer'], ['Desk program II', '30 min', 'Évoluer'], ['Posture & breathing', '35 min', 'Évoluer'], ['Body in balance', '40 min', 'Évoluer'], ['Perfect alignment', '45 min', 'Évoluer']],
  p5: [['Understanding the breath', '12 min', 'Comprendre'], ['The diaphragm', '15 min', 'Comprendre'], ['Breathing & nerves', '15 min', 'Comprendre'], ['Feeling your breath', '10 min', 'Ressentir'], ['3D breathing', '15 min', 'Ressentir'], ['Cardiac coherence I', '12 min', 'Préparer'], ['Releasing the diaphragm', '15 min', 'Préparer'], ['Lateral breathing', '18 min', 'Préparer'], ['Dorsal breathing', '20 min', 'Préparer'], ['Pelvic floor', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Breath & movement', '25 min', 'Exécuter'], ['Cardiac coherence II', '20 min', 'Exécuter'], ['Breath & core', '28 min', 'Exécuter'], ['Full breath sequence', '30 min', 'Exécuter'], ['Advanced techniques I', '25 min', 'Évoluer'], ['Breath & performance', '30 min', 'Évoluer'], ['Breathing & emotions', '32 min', 'Évoluer'], ['Anti-stress breathing', '35 min', 'Évoluer'], ['Master of breath', '40 min', 'Évoluer']],
  p6: [['What is proprioception', '12 min', 'Comprendre'], ['The body in space', '15 min', 'Comprendre'], ['Awareness & pain', '15 min', 'Comprendre'], ['Body scan I', '12 min', 'Ressentir'], ['Feeling without seeing', '15 min', 'Ressentir'], ['Static balance I', '15 min', 'Préparer'], ['Micro-movements', '18 min', 'Préparer'], ['Unstable balance', '20 min', 'Préparer'], ['The inner gaze', '22 min', 'Préparer'], ['Body mapping', '25 min', 'Préparer'], ['Slow movement I', '20 min', 'Exécuter'], ['Fine coordination', '25 min', 'Exécuter'], ['Anticipation & reaction', '28 min', 'Exécuter'], ['Slow movement II', '30 min', 'Exécuter'], ['Conscious fluidity', '32 min', 'Exécuter'], ['Movement meditation', '25 min', 'Évoluer'], ['Conscious inversion', '30 min', 'Évoluer'], ['Fascia awareness', '35 min', 'Évoluer'], ['Body intelligence', '38 min', 'Évoluer'], ['Being in the body', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & his method', '12 min', 'Comprendre'], ['The 6 Mat principles', '15 min', 'Comprendre'], ['The center — powerhouse', '15 min', 'Comprendre'], ['Feeling the mat beneath you', '12 min', 'Ressentir'], ['Pelvis-floor connection', '15 min', 'Ressentir'], ['The Hundred — initiation', '20 min', 'Préparer'], ['Conscious Roll-Up', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Center activation', '22 min', 'Préparer'], ['The series of 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Mat sequence level 1', '35 min', 'Évoluer'], ['Mat sequence level 2', '38 min', 'Évoluer'], ['Guided Teaser', '40 min', 'Évoluer'], ['Full Mat flow', '42 min', 'Évoluer'], ['Mat mastery', '45 min', 'Évoluer']],
};

const SEANCES_ES = {
  p1: [['Entender el hombro', '12 min', 'Comprendre'], ['El manguito rotador', '15 min', 'Comprendre'], ['Sentir los omóplatos', '12 min', 'Ressentir'], ['El peso del brazo', '15 min', 'Ressentir'], ['Círculos de conciencia', '18 min', 'Ressentir'], ['Liberar los trapecios', '20 min', 'Préparer'], ['Movilizar la escápula', '22 min', 'Préparer'], ['Activar el serrato', '25 min', 'Préparer'], ['Apertura torácica', '28 min', 'Préparer'], ['Propiocepción hombro', '30 min', 'Préparer'], ['El gesto correcto', '25 min', 'Exécuter'], ['Elevación consciente', '28 min', 'Exécuter'], ['Rotación externa guiada', '30 min', 'Exécuter'], ['Jalones y empujes', '32 min', 'Exécuter'], ['Circuito hombro completo', '35 min', 'Exécuter'], ['Fuerza & flexibilidad I', '35 min', 'Évoluer'], ['Hombro con carga', '38 min', 'Évoluer'], ['Equilibrio escapular', '40 min', 'Évoluer'], ['El hombro atlético', '42 min', 'Évoluer'], ['Dominio total', '45 min', 'Évoluer']],
  p2: [['La espalda explicada', '12 min', 'Comprendre'], ['Por qué duele la espalda', '15 min', 'Comprendre'], ['El cuello y sus tensiones', '15 min', 'Comprendre'], ['Sentir la columna', '12 min', 'Ressentir'], ['El sacro como base', '18 min', 'Ressentir'], ['Liberar el psoas', '20 min', 'Préparer'], ['Descompresión lumbar', '22 min', 'Préparer'], ['Movilizar las torácicas', '25 min', 'Préparer'], ['Cat-Cow consciente', '20 min', 'Préparer'], ['Liberar el cuello', '22 min', 'Préparer'], ['Fortalecimiento profundo I', '25 min', 'Exécuter'], ['La plancha consciente', '28 min', 'Exécuter'], ['Puente glúteo guiado', '28 min', 'Exécuter'], ['Rotación vertebral', '30 min', 'Exécuter'], ['Extensión de espalda', '32 min', 'Exécuter'], ['Programa antidolor I', '30 min', 'Évoluer'], ['Programa antidolor II', '35 min', 'Évoluer'], ['Espalda & respiración', '38 min', 'Évoluer'], ['Columna integrada', '40 min', 'Évoluer'], ['La columna perfecta', '45 min', 'Évoluer']],
  p3: [['Entender la cadera', '2 min 10 s', 'Comprendre'], ['La rodilla frágil', '15 min', 'Comprendre'], ['El tobillo olvidado', '12 min', 'Comprendre'], ['Sentir la cadera', '15 min', 'Ressentir'], ['Cartografía parte inferior', '20 min', 'Ressentir'], ['Movilización de cadera I', '20 min', 'Préparer'], ['Liberación de flexores', '22 min', 'Préparer'], ['Movilización de cadera II', '25 min', 'Préparer'], ['Movilidad de rodilla', '20 min', 'Préparer'], ['El tobillo en acción', '22 min', 'Préparer'], ['Sentadilla consciente I', '25 min', 'Exécuter'], ['Zancada guiada', '28 min', 'Exécuter'], ['Puente y rotación cadera', '28 min', 'Exécuter'], ['Postura unipodal', '30 min', 'Exécuter'], ['Circuito movilidad', '32 min', 'Exécuter'], ['Movilidad & Pilates I', '30 min', 'Évoluer'], ['Profundidad de cadera', '35 min', 'Évoluer'], ['Rodillas & fuerza', '38 min', 'Évoluer'], ['La cadena posterior', '40 min', 'Évoluer'], ['Cuerpo libre abajo', '45 min', 'Évoluer']],
  p4: [['La postura explicada', '12 min', 'Comprendre'], ['Las 4 curvas naturales', '15 min', 'Comprendre'], ['Postura & dolor', '15 min', 'Comprendre'], ['Sentir la alineación', '12 min', 'Ressentir'], ['El eje vertical', '18 min', 'Ressentir'], ['Abrir la caja torácica', '20 min', 'Préparer'], ['Activar estabilizadores', '22 min', 'Préparer'], ['Reequilibrar la pelvis', '25 min', 'Préparer'], ['Alinear el cuello', '22 min', 'Préparer'], ['Propiocepción postural', '25 min', 'Préparer'], ['De pie consciente', '25 min', 'Exécuter'], ['Caminar consciente', '28 min', 'Exécuter'], ['Sentado sin dolor', '25 min', 'Exécuter'], ['Trabajo frente al espejo', '30 min', 'Exécuter'], ['Postura bajo carga', '32 min', 'Exécuter'], ['Programa oficina I', '25 min', 'Évoluer'], ['Programa oficina II', '30 min', 'Évoluer'], ['Postura & respiración', '35 min', 'Évoluer'], ['Cuerpo en equilibrio', '40 min', 'Évoluer'], ['Alineación perfecta', '45 min', 'Évoluer']],
  p5: [['Entender el aliento', '12 min', 'Comprendre'], ['El diafragma', '15 min', 'Comprendre'], ['Respiración & nervios', '15 min', 'Comprendre'], ['Sentir la respiración', '10 min', 'Ressentir'], ['Respiración 3D', '15 min', 'Ressentir'], ['Coherencia cardíaca I', '12 min', 'Préparer'], ['Liberar el diafragma', '15 min', 'Préparer'], ['Respiración lateral', '18 min', 'Préparer'], ['Respiración dorsal', '20 min', 'Préparer'], ['Suelo pélvico', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Aliento & movimiento', '25 min', 'Exécuter'], ['Coherencia cardíaca II', '20 min', 'Exécuter'], ['Aliento & core', '28 min', 'Exécuter'], ['Secuencia aliento completo', '30 min', 'Exécuter'], ['Técnicas avanzadas I', '25 min', 'Évoluer'], ['Aliento & rendimiento', '30 min', 'Évoluer'], ['Respiración & emociones', '32 min', 'Évoluer'], ['Respiración antiestres', '35 min', 'Évoluer'], ['Maestro del aliento', '40 min', 'Évoluer']],
  p6: [['Qué es la propiocepción', '12 min', 'Comprendre'], ['El cuerpo en el espacio', '15 min', 'Comprendre'], ['Conciencia & dolor', '15 min', 'Comprendre'], ['Scan corporal I', '12 min', 'Ressentir'], ['Sentir sin ver', '15 min', 'Ressentir'], ['Equilibrio estático I', '15 min', 'Préparer'], ['Micro-movimientos', '18 min', 'Préparer'], ['Equilibrio inestable', '20 min', 'Préparer'], ['La mirada interior', '22 min', 'Préparer'], ['Mapeo corporal', '25 min', 'Préparer'], ['Movimiento lento I', '20 min', 'Exécuter'], ['Coordinación fina', '25 min', 'Exécuter'], ['Anticipación & reacción', '28 min', 'Exécuter'], ['Movimiento lento II', '30 min', 'Exécuter'], ['Fluidez consciente', '32 min', 'Exécuter'], ['Meditación en movimiento', '25 min', 'Évoluer'], ['Inversión consciente', '30 min', 'Évoluer'], ['Conciencia de fascias', '35 min', 'Évoluer'], ['Inteligencia corporal', '38 min', 'Évoluer'], ['Ser en el cuerpo', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & su método', '12 min', 'Comprendre'], ['Los 6 principios del Mat', '15 min', 'Comprendre'], ['El centro — powerhouse', '15 min', 'Comprendre'], ['Sentir la colchoneta', '12 min', 'Ressentir'], ['Conexión pelvis-suelo', '15 min', 'Ressentir'], ['El Hundred — iniciación', '20 min', 'Préparer'], ['Roll-Up consciente', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Activación del centro', '22 min', 'Préparer'], ['La serie de los 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Secuencia Mat nivel 1', '35 min', 'Évoluer'], ['Secuencia Mat nivel 2', '38 min', 'Évoluer'], ['Teaser guiado', '40 min', 'Évoluer'], ['Flujo Mat completo', '42 min', 'Évoluer'], ['Dominio del Mat', '45 min', 'Évoluer']],
};

const SEANCES_IT = {
  p1: [['Capire la spalla', '12 min', 'Comprendre'], ['La cuffia dei rotatori', '15 min', 'Comprendre'], ['Sentire le scapole', '12 min', 'Ressentir'], ['Il peso del braccio', '15 min', 'Ressentir'], ['Cerchi di consapevolezza', '18 min', 'Ressentir'], ['Liberare i trapezi', '20 min', 'Préparer'], ['Mobilizzare la scapola', '22 min', 'Préparer'], ['Attivare il dentato', '25 min', 'Préparer'], ['Apertura toracica', '28 min', 'Préparer'], ['Propriocezione spalla', '30 min', 'Préparer'], ['Il gesto giusto', '25 min', 'Exécuter'], ['Elevazione consapevole', '28 min', 'Exécuter'], ['Rotazione esterna guidata', '30 min', 'Exécuter'], ['Tirate e spinte', '32 min', 'Exécuter'], ['Circuito spalla completo', '35 min', 'Exécuter'], ['Forza & flessibilità I', '35 min', 'Évoluer'], ['Spalla sotto carico', '38 min', 'Évoluer'], ['Equilibrio scapolare', '40 min', 'Évoluer'], ['La spalla atletica', '42 min', 'Évoluer'], ['Maestria totale', '45 min', 'Évoluer']],
  p2: [['La schiena spiegata', '12 min', 'Comprendre'], ['Perché fa male la schiena', '15 min', 'Comprendre'], ['Il collo e le sue tensioni', '15 min', 'Comprendre'], ['Sentire la colonna', '12 min', 'Ressentir'], ['Il sacro come base', '18 min', 'Ressentir'], ['Rilasciare lo psoas', '20 min', 'Préparer'], ['Decompressione lombare', '22 min', 'Préparer'], ['Mobilizzare le toraciche', '25 min', 'Préparer'], ['Cat-Cow consapevole', '20 min', 'Préparer'], ['Liberare il collo', '22 min', 'Préparer'], ['Rinforzo profondo I', '25 min', 'Exécuter'], ['Il plank consapevole', '28 min', 'Exécuter'], ['Ponte glutei guidato', '28 min', 'Exécuter'], ['Rotazione vertebrale', '30 min', 'Exécuter'], ['Estensione della schiena', '32 min', 'Exécuter'], ['Programma antidolore I', '30 min', 'Évoluer'], ['Programma antidolore II', '35 min', 'Évoluer'], ['Schiena & respirazione', '38 min', 'Évoluer'], ['Colonna integrata', '40 min', 'Évoluer'], ['La colonna perfetta', '45 min', 'Évoluer']],
  p3: [['Capire l\'anca', '2 min 10 s', 'Comprendre'], ['Il ginocchio fragile', '15 min', 'Comprendre'], ['La caviglia dimenticata', '12 min', 'Comprendre'], ['Sentire l\'anca', '15 min', 'Ressentir'], ['Mappatura parte inferiore', '20 min', 'Ressentir'], ['Mobilizzazione anca I', '20 min', 'Préparer'], ['Liberare i flessori', '22 min', 'Préparer'], ['Mobilizzazione anca II', '25 min', 'Préparer'], ['Mobilità del ginocchio', '20 min', 'Préparer'], ['La caviglia in azione', '22 min', 'Préparer'], ['Squat consapevole I', '25 min', 'Exécuter'], ['Affondo guidato', '28 min', 'Exécuter'], ['Ponte e rotazione anca', '28 min', 'Exécuter'], ['Stazione monopodica', '30 min', 'Exécuter'], ['Circuito mobilità', '32 min', 'Exécuter'], ['Mobilità & Pilates I', '30 min', 'Évoluer'], ['Profondità dell\'anca', '35 min', 'Évoluer'], ['Ginocchia & forza', '38 min', 'Évoluer'], ['La catena posteriore', '40 min', 'Évoluer'], ['Corpo libero in basso', '45 min', 'Évoluer']],
  p4: [['La postura spiegata', '12 min', 'Comprendre'], ['Le 4 curve naturali', '15 min', 'Comprendre'], ['Postura & dolore', '15 min', 'Comprendre'], ['Sentire l\'allineamento', '12 min', 'Ressentir'], ['L\'asse verticale', '18 min', 'Ressentir'], ['Aprire la gabbia toracica', '20 min', 'Préparer'], ['Attivare gli stabilizzatori', '22 min', 'Préparer'], ['Riequilibrare il bacino', '25 min', 'Préparer'], ['Allineare il collo', '22 min', 'Préparer'], ['Propriocezione posturale', '25 min', 'Préparer'], ['In piedi consapevole', '25 min', 'Exécuter'], ['Camminata consapevole', '28 min', 'Exécuter'], ['Seduti senza dolore', '25 min', 'Exécuter'], ['Lavoro allo specchio', '30 min', 'Exécuter'], ['Postura sotto carico', '32 min', 'Exécuter'], ['Programma ufficio I', '25 min', 'Évoluer'], ['Programma ufficio II', '30 min', 'Évoluer'], ['Postura & respirazione', '35 min', 'Évoluer'], ['Corpo in equilibrio', '40 min', 'Évoluer'], ['L\'allineamento perfetto', '45 min', 'Évoluer']],
  p5: [['Capire il respiro', '12 min', 'Comprendre'], ['Il diaframma', '15 min', 'Comprendre'], ['Respirazione & nervi', '15 min', 'Comprendre'], ['Sentire il proprio respiro', '10 min', 'Ressentir'], ['Respirazione 3D', '15 min', 'Ressentir'], ['Coerenza cardiaca I', '12 min', 'Préparer'], ['Liberare il diaframma', '15 min', 'Préparer'], ['Respirazione laterale', '18 min', 'Préparer'], ['Respirazione dorsale', '20 min', 'Préparer'], ['Pavimento pelvico', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Respiro & movimento', '25 min', 'Exécuter'], ['Coerenza cardiaca II', '20 min', 'Exécuter'], ['Respiro & core', '28 min', 'Exécuter'], ['Sequenza respiro completo', '30 min', 'Exécuter'], ['Tecniche avanzate I', '25 min', 'Évoluer'], ['Respiro & prestazione', '30 min', 'Évoluer'], ['Respirazione & emozioni', '32 min', 'Évoluer'], ['Anti-stress respiratorio', '35 min', 'Évoluer'], ['Maestro del respiro', '40 min', 'Évoluer']],
  p6: [['Cos\'è la propriocezione', '12 min', 'Comprendre'], ['Il corpo nello spazio', '15 min', 'Comprendre'], ['Consapevolezza & dolore', '15 min', 'Comprendre'], ['Scan corporeo I', '12 min', 'Ressentir'], ['Sentire senza vedere', '15 min', 'Ressentir'], ['Equilibrio statico I', '15 min', 'Préparer'], ['Micro-movimenti', '18 min', 'Préparer'], ['Equilibrio instabile', '20 min', 'Préparer'], ['Lo sguardo interiore', '22 min', 'Préparer'], ['Mappatura corporea', '25 min', 'Préparer'], ['Movimento lento I', '20 min', 'Exécuter'], ['Coordinazione fine', '25 min', 'Exécuter'], ['Anticipazione & reazione', '28 min', 'Exécuter'], ['Movimento lento II', '30 min', 'Exécuter'], ['Fluidità consapevole', '32 min', 'Exécuter'], ['Meditazione in movimento', '25 min', 'Évoluer'], ['Inversione consapevole', '30 min', 'Évoluer'], ['Consapevolezza delle fasce', '35 min', 'Évoluer'], ['Intelligenza corporea', '38 min', 'Évoluer'], ['Essere nel corpo', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & il suo metodo', '12 min', 'Comprendre'], ['I 6 principi del Mat', '15 min', 'Comprendre'], ['Il centro — powerhouse', '15 min', 'Comprendre'], ['Sentire il tappetino', '12 min', 'Ressentir'], ['Connessione bacino-pavimento', '15 min', 'Ressentir'], ['Il Hundred — iniziazione', '20 min', 'Préparer'], ['Roll-Up consapevole', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Attivazione del centro', '22 min', 'Préparer'], ['La serie dei 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Sequenza Mat livello 1', '35 min', 'Évoluer'], ['Sequenza Mat livello 2', '38 min', 'Évoluer'], ['Teaser guidato', '40 min', 'Évoluer'], ['Flusso Mat completo', '42 min', 'Évoluer'], ['Maestria del Mat', '45 min', 'Évoluer']],
};

function getSeances(lang) {
  if (lang === 'en') return SEANCES_EN;
  if (lang === 'es') return SEANCES_ES;
  if (lang === 'it') return SEANCES_IT;
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
];

const PILIER_LABEL_IDX = { p1: 0, p2: 1, p3: 2, p4: 3, p5: 4, p6: 5, p7: 6 };
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
const ICONS = { p1: IconEpaules, p2: IconDos, p3: IconMobilite, p4: IconPosture, p5: IconRespiration, p6: IconConscience, p7: IconMatPilates };

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

  const progress = status.durationMillis ? status.positionMillis / status.durationMillis : 0;
  const barW = Math.max(40, dims.width - 40);
  const thumbSize = 16;
  const thumbLeft = Math.max(0, Math.min(barW - thumbSize, progress * barW - thumbSize / 2));

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
              <TouchableOpacity onPress={() => { void handleCloseVideo(); }} hitSlop={14} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22, color: '#fff', fontWeight: '300' }}>✕</Text>
              </TouchableOpacity>
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
              <Pressable
                onPress={() => {
                  bumpTimer();
                  hapticSuccess();
                  Animated.sequence([
                    Animated.timing(doneScale, { toValue: 0.97, duration: 60, useNativeDriver: true }),
                    Animated.spring(doneScale, { toValue: 1, friction: 4, tension: 280, useNativeDriver: true }),
                  ]).start();
                  completedRef.current = true;
                  if (pilier?.key != null && seanceIndex != null) clearVideoResume(pilier.key, seanceIndex);
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
              </Pressable>
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
  const doneCount = done.filter(Boolean).length;
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
          onComplete={() => { var dur = parseInt(seances[activeVideo]?.[1]) || 15; saveHealthKitWorkout(dur); onToggle(activeVideo); setActiveVideo(null); setShowCelebration(true); }}
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
  sdj: require("./assets/piliers/seance_du_jour.jpg"),
};

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
          resizeMode="cover"
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

function MonCorps({ prenom, done, toggleDone, lang, tensionIdxs, streak, isSubscriber, onActivateSubscription }) {
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
      <View style={[styles.logoRow, { justifyContent: "flex-start", paddingLeft: 20, paddingTop: 10, marginBottom: 20 }]} pointerEvents="box-none">
        <Text style={styles.logoWordmark} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          FLUIDBODY<Text style={{ fontWeight: "900", color: "#E5FF00", fontSize: 34 }}>+</Text>
        </Text>
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
                    <View key={idx} style={{ backgroundColor: 'rgba(0,18,38,0.55)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 16, marginBottom: 12 }}>
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
                    <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }}>
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
        <PilierPanel pilier={openPilier} done={done[openPilier.key]} onToggle={function(idx) { toggleDone(openPilier.key, idx); }} onClose={function() { setOpenPilier(null); }} lang={lang} isRecommended={effectiveRecommended.includes(openPilier.key)} isSubscriber={isSubscriber} onActivateSubscription={onActivateSubscription} sdjIndex={sdj && sdj.pilier && sdj.pilier.key === openPilier.key ? sdj.idx : null} />
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

function CreateProgramScreen({ visible, onClose, lang, onSaved }) {
  if (!visible) return null;
  var tr = T[lang] || T["fr"];
  var piliers = getPiliers(lang);
  var [selected, setSelected] = useState([]);
  var [duree, setDuree] = useState(1);
  var [jours, setJours] = useState(3);
  var [saved, setSaved] = useState(false);
  var dureeOptions = ['10 min', '15 min', '20 min', '30 min', '45 min'];
  var joursOptions = [2, 3, 4, 5, 6, 7];

  function togglePilier(key) {
    setSelected(function(prev) { return prev.includes(key) ? prev.filter(function(k) { return k !== key; }) : [...prev, key]; });
  }

  async function saveProg() {
    var prog = { piliers: selected, duree: dureeOptions[duree], jours: joursOptions[jours - 2 < 0 ? 0 : jours - 2], date: new Date().toISOString() };
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
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", paddingHorizontal: 28, marginBottom: 32 }}>
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

          <Text style={{ fontSize: 30, fontWeight: "800", color: "#ffffff", textAlign: "center", marginBottom: 12, paddingHorizontal: 28 }}>{tr.paywall_title}</Text>
          <Text style={{ fontSize: 15, fontWeight: "400", color: "rgba(255,255,255,0.50)", textAlign: "center", lineHeight: 22, marginBottom: 36, paddingHorizontal: 36 }}>{tr.paywall_sub}</Text>

          {disabled && (
            <View style={{ alignSelf: "stretch", marginHorizontal: 28, marginBottom: 20, backgroundColor: "rgba(255,200,80,0.10)", borderWidth: 1, borderColor: "rgba(255,200,80,0.25)", borderRadius: 16, padding: 14 }}>
              <Text style={{ color: "rgba(255,220,140,0.9)", fontSize: 12, lineHeight: 18, textAlign: "center" }}>{tr.paywall_not_available}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={function() { monthlyPkg && onBuyMonthly && onBuyMonthly(monthlyPkg); }}
            disabled={disabled || loadingPrices || !monthlyPkg}
            activeOpacity={0.85}
            style={{
              alignSelf: "stretch",
              marginHorizontal: 28,
              height: 58,
              borderRadius: 29,
              backgroundColor: "#E5FF00",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
              opacity: (disabled || loadingPrices) ? 0.4 : 1,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#000000", letterSpacing: 0.5 }}>
              {tr.paywall_start}{loadingPrices ? "" : (monthlyPrice ? " \u2014 " + monthlyPrice + tr.paywall_per_month : "")}
            </Text>
          </TouchableOpacity>

          {!loadingPrices && monthlyPrice ? (
            <Text style={{ fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.40)", textAlign: "center", marginBottom: 12 }}>
              {monthlyPrice}{tr.paywall_per_month}
            </Text>
          ) : null}

          {showYearly && (
            <TouchableOpacity
              onPress={function() { yearlyPkg && onBuyYearly && onBuyYearly(yearlyPkg); }}
              disabled={disabled || loadingPrices || !yearlyPkg}
              activeOpacity={0.85}
              style={{ marginBottom: 16 }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#ffffff", textAlign: "center" }}>
                {tr.paywall_yearly_link || tr.paywall_buy_yearly}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={function() { onTryFree && onTryFree(); }}
            activeOpacity={0.85}
            style={{
              alignSelf: "stretch",
              marginHorizontal: 28,
              height: 50,
              borderRadius: 25,
              backgroundColor: "rgba(0,189,208,0.15)",
              borderWidth: 1,
              borderColor: "rgba(0,189,208,0.4)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#00BDD0", letterSpacing: 0.3 }}>
              {tr.paywall_try_free}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onRestore}
            disabled={disabled}
            activeOpacity={0.7}
            style={{ marginTop: 24 }}
          >
            <Text style={{ fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.30)", textAlign: "center" }}>{tr.paywall_restore}</Text>
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
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.15} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingTop: 58, paddingHorizontal: 22 }}>
          <TouchableOpacity onPress={onClose} style={{ marginBottom: 20 }}><Text style={{ fontSize: 10, color: 'rgba(0,205,248,0.44)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.retour_biblio}</Text></TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,18,32,0.7)', borderWidth: 0.5, borderColor: article.color }}>
              <Text style={{ fontSize: 9, color: article.color, letterSpacing: 1 }}>{article.duree}{tr.lire}</Text>
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
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.15} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingTop: 58, paddingHorizontal: 22 }}>
          <TouchableOpacity onPress={onClose} style={{ marginBottom: 20 }}><Text style={{ fontSize: 10, color: 'rgba(0,205,248,0.44)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.retour_biblio}</Text></TouchableOpacity>
          <Text style={{ fontSize: 72, fontWeight: '200', color: fiche.color, opacity: 0.3, lineHeight: 80 }}>{fiche.num}</Text>
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
                <TouchableOpacity key={i} onPress={() => setOpenArticle(a)} style={{ backgroundColor: 'rgba(0,18,38,0.55)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 18 }}>
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
              <TouchableOpacity key={i} onPress={() => setOpenFiche(f)} style={{ backgroundColor: 'rgba(0,18,38,0.55)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 18 }}>
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

function ResumeScreen({ done, lang, streak, prenom, tensionIdxs }) {
  var tr = T[lang] || T['fr'];
  var piliers = getPiliers(lang);
  var totalDone = Object.values(done).flat().filter(Boolean).length;
  var pct = Math.round(totalDone / 140 * 100);
  var recommendedPiliers = (tensionIdxs || []).map(function(i) { return ZONE_TO_PILIER[i]; });
  var [hkData, setHkData] = useState({ cal: 0, exMin: 0, standHr: 0 });

  useEffect(function() {
    getHealthKitSummary(function(data) { setHkData(data); });
    var interval = setInterval(function() { getHealthKitSummary(function(data) { setHkData(data); }); }, 60000);
    return function() { clearInterval(interval); };
  }, []);

  var now = new Date();
  var dayNames = { fr: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'], en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], es: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'], it: ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'] };
  var monthNames = { fr: ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'], en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], es: ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sep.','oct.','nov.','dic.'], it: ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'] };
  var dn = (dayNames[lang] || dayNames.fr)[now.getDay()];
  var mn = (monthNames[lang] || monthNames.fr)[now.getMonth()];
  var dateStr = dn + ' ' + now.getDate() + ' ' + mn;

  var calGoal = 400; var exGoal = 30; var standGoal = 12;
  var calPct = hkData.cal / calGoal; var exPct = hkData.exMin / exGoal; var standPct = hkData.standHr / standGoal;

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

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.55)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 14 }}>
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
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#FF3B30', marginTop: 2 }}>{hkData.cal}<Text style={{ fontSize: 13, fontWeight: '400' }}>/{calGoal} cal</Text></Text>
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#30D158' }} />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{tr.resume_exercice || 'Exercice'}</Text>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#30D158', marginTop: 2 }}>{hkData.exMin}<Text style={{ fontSize: 13, fontWeight: '400' }}>/{exGoal} min</Text></Text>
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

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.55)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 14 }}>
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

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.55)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20 }}>
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

function FloatingMedusas() {
  var meds = useRef([
    { x: new Animated.Value(20), y: new Animated.Value(SH * 0.08), size: 62 },
    { x: new Animated.Value(SW * 0.65), y: new Animated.Value(SH * 0.15), size: 48 },
    { x: new Animated.Value(SW * 0.3), y: new Animated.Value(SH * 0.35), size: 54 },
    { x: new Animated.Value(SW * 0.8), y: new Animated.Value(SH * 0.5), size: 40 },
    { x: new Animated.Value(SW * 0.15), y: new Animated.Value(SH * 0.65), size: 56 },
    { x: new Animated.Value(SW * 0.5), y: new Animated.Value(SH * 0.78), size: 44 },
    { x: new Animated.Value(SW * 0.75), y: new Animated.Value(SH * 0.3), size: 36 },
  ]).current;
  useEffect(function() {
    meds.forEach(function(m, i) {
      var delay = 500 + i * 700;
      function drift() {
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 40 + Math.random() * (SH - m.size - 140);
        var dur = 8000 + Math.random() * 7000;
        Animated.parallel([
          Animated.timing(m.x, { toValue: toX, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(m.y, { toValue: toY, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ]).start(function() { drift(); });
      }
      setTimeout(drift, delay);
    });
  }, []);
  return meds.map(function(m, i) {
    return (
      <Animated.View key={'bg-m-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 0, opacity: 0.6, left: m.x, top: m.y }}>
        <MeduseCornerIcon size={m.size} breathCycleMs={2800 + i * 400} breathMaxScale={1.35} tint="rgba(174,239,77,1)" />
      </Animated.View>
    );
  });
}

function Progresser({ done, lang, tensionIdxs }) {
  const tr = T[lang] || T['fr'];
  const totalDone = Object.values(done).flat().filter(Boolean).length;
  const pct = Math.round(totalDone / 140 * 100);
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
          <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.45)', textAlign: 'right', marginTop: 4 }}>{totalDone} / 140</Text>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {sortedPiliers.map((p, idx) => {
            const count = done[p.key].filter(v => v === true || v === 'true').length;
            const IconComp = ICONS[p.key];
            const isRec = recommendedPiliers.includes(p.key);
            const pct2 = Math.round(count / 20 * 100);
            return (
              <View key={p.key} style={{ backgroundColor: 'rgba(0,18,38,0.55)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 18 }}>
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
// PROFIL — Abonnement + Compte
// ══════════════════════════════════
function ProfilScreen({ prenom, lang, supabase, supaUser, onLogout, isSubscriber, onRestorePurchases }) {
  var tr = T[lang] || T['fr'];
  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
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

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(30,30,32,0.95)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 12 }}>{tr.subscription_status_label}</Text>
          <Text style={{ fontSize: 15, fontWeight: '400', color: '#AEEF4D', marginBottom: 16 }}>{isSubscriber ? tr.subscription_status_active : tr.subscription_status_free}</Text>
          <TouchableOpacity onPress={onRestorePurchases} style={{ paddingVertical: 13, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.10)', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>{tr.subscription_reset}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(30,30,32,0.95)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
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
          <View style={{ marginHorizontal: 20 }}>
            <TouchableOpacity onPress={onLogout} style={{ paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,50,50,0.08)', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,100,100,0.85)' }}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        )}
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
      {BULLES.map((b, i) => <Bulle key={i} {...b} />)}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 88, height: 88, marginRight: 14, overflow: 'visible' }} pointerEvents="none">
              <MeduseCornerIcon size={88} breathCycleMs={3000} />
            </View>
            <View style={{ justifyContent: 'center' }}>
              <Text style={{ fontSize: 36, fontWeight: '200', color: 'rgba(215,248,255,0.96)', letterSpacing: 6, textTransform: 'uppercase', marginBottom: 2 }}>FluidBody</Text>
              <Text style={{ fontSize: 11, color: 'rgba(0,210,250,0.6)', letterSpacing: 6, textTransform: 'uppercase' }}>Pilates</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: 'rgba(0,225,255,0.6)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>{tr.ob_auth_tag}</Text>
          <Text style={{ fontSize: 22, fontWeight: '300', color: 'rgba(235,252,255,0.95)', textAlign: 'center', marginBottom: 10 }}>{tr.ob_auth_title}</Text>
          <Text style={{ fontSize: 14, color: 'rgba(170,220,240,0.85)', textAlign: 'center', marginBottom: 22, lineHeight: 21 }}>{tr.ob_auth_sub}</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder={tr.ob_email_ph} placeholderTextColor="rgba(0,180,220,0.35)" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            style={{ width: '100%', height: 52, backgroundColor: 'rgba(0,18,32,0.88)', borderWidth: 1, borderColor: email ? 'rgba(0,220,255,0.45)' : 'rgba(0,200,240,0.2)', borderRadius: 14, color: 'rgba(240,252,255,0.95)', fontSize: 16, paddingHorizontal: 16, marginBottom: 10 }}
          />
          <TextInput value={password} onChangeText={setPassword} placeholder={tr.ob_pass_ph} placeholderTextColor="rgba(0,180,220,0.35)" secureTextEntry autoCapitalize="none" autoCorrect={false}
            style={{ width: '100%', height: 52, backgroundColor: 'rgba(0,18,32,0.88)', borderWidth: 1, borderColor: password ? 'rgba(0,220,255,0.45)' : 'rgba(0,200,240,0.2)', borderRadius: 14, color: 'rgba(240,252,255,0.95)', fontSize: 16, paddingHorizontal: 16, marginBottom: 12 }}
          />
          {error ? <Text style={{ color: 'rgba(255,120,120,0.9)', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>{error}</Text> : null}
          <TouchableOpacity onPress={submit} disabled={loading} style={{ width: '100%', height: 52, borderRadius: 26, backgroundColor: email.trim() && password.length >= 6 ? 'rgba(0,180,235,0.35)' : 'rgba(0,100,140,0.12)', borderWidth: 1.5, borderColor: email.trim() && password.length >= 6 ? 'rgba(0,235,255,0.75)' : 'rgba(0,150,190,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '500', color: 'rgba(215,248,255,0.92)', letterSpacing: 1 }}>{loading ? '…' : (mode === 'up' ? tr.ob_auth_submit_up : tr.ob_auth_submit_in)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setMode(m => m === 'up' ? 'in' : 'up'); setError(''); }} style={{ paddingVertical: 10 }}>
            <Text style={{ fontSize: 13, color: 'rgba(0,210,250,0.7)', letterSpacing: 0.5 }}>{mode === 'up' ? tr.ob_auth_toggle_in : tr.ob_auth_toggle_up}</Text>
          </TouchableOpacity>
          <View style={{ width: '100%', borderTopWidth: 0.5, borderTopColor: 'rgba(0,195,240,0.15)', paddingTop: 20, alignItems: 'center', marginTop: 12 }}>
            <TouchableOpacity onPress={onSkip} style={{ paddingVertical: 14, paddingHorizontal: 32, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(0,195,240,0.3)', backgroundColor: 'rgba(0,18,32,0.5)' }}>
              <Text style={{ fontSize: 13, color: 'rgba(0,210,250,0.75)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.ob_auth_skip}</Text>
            </TouchableOpacity>
          </View>
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

  useEffect(function() {
    if (step === 0) {
      var timer = setTimeout(function() { nextStep(1); }, 3000);
      return function() { clearTimeout(timer); };
    }
  }, [step]);

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
          <View style={{ alignItems: 'center', paddingHorizontal: 32, alignSelf: 'stretch' }} />
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
    p4: Array(20).fill(false), p5: Array(20).fill(false), p6: Array(20).fill(false), p7: Array(20).fill(false),
  });
  const [streak, setStreak] = useState(0);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [freeDetailVisible, setFreeDetailVisible] = useState(false);
  const [freeVideoPlaying, setFreeVideoPlaying] = useState(false);
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
          Object.keys(parsed).forEach(k => { fixed[k] = parsed[k].map(v => v === true || v === 'true'); });
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
              onComplete={() => { var dur = parseInt(sdj?.seance?.[1]) || 15; saveHealthKitWorkout(dur); setFreeVideoPlaying(false); }}
              onDemoLimit={() => { setFreeVideoPlaying(false); setPaywallVisible(true); }}
            />
          </Modal>
        );
      })()}
      <NavigationContainer>
          <Tab.Navigator tabBar={function(props) { return <CustomTabBar {...props} />; }} screenOptions={{ headerShown: false }}>
          <Tab.Screen name={tr.tabs[0]} options={{ tabBarIcon: (props) => <TabIconMonCorps {...props} /> }}>{() => <MonCorps prenom={prenom} done={done} toggleDone={toggleDone} lang={lang} tensionIdxs={tensionIdxs} streak={streak} isSubscriber={isSubscriber} onActivateSubscription={openPaywall} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[1]} options={{ tabBarIcon: (props) => <TabIconResume {...props} /> }}>{() => <ResumeScreen done={done} lang={lang} streak={streak} prenom={prenom} tensionIdxs={tensionIdxs} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[2]} options={{ tabBarIcon: (props) => <TabIconBiblio {...props} /> }}>{() => <Biblio lang={lang} />}</Tab.Screen>
          <Tab.Screen name={tr.tabs[3]} options={{ tabBarIcon: (props) => <TabIconProfil {...props} /> }}>{() => <ProfilScreen prenom={prenom} lang={lang} supabase={supabase} supaUser={supaUser} onLogout={() => { supabase?.auth.signOut(); }} isSubscriber={isSubscriber} onRestorePurchases={() => { setPaywallVisible(true); }} />}</Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
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
  btnCtaLarge: { alignSelf: 'stretch', height: 66, borderRadius: 33, backgroundColor: 'rgba(229,255,0,0.15)', borderWidth: 2, borderColor: '#E5FF00', alignItems: 'center', justifyContent: 'center' },
  btnCtaOff: { opacity: 0.3 },
  btnCtaLargeTxt: { fontSize: 19, fontWeight: '700', color: '#E5FF00', letterSpacing: 3, textTransform: 'uppercase' },
  statCard: { flex: 1, backgroundColor: 'rgba(0,18,38,0.55)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 14, alignItems: 'center' },
  statLbl: { fontSize: 9, fontWeight: '200', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(174,239,77,0.6)' },
});