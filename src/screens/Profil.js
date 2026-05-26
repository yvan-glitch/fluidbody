import { useRef, useState, useEffect } from 'react';
import { Text, StyleSheet, View, TouchableOpacity, ScrollView, Share, Alert, Modal, Dimensions, TextInput, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import GlassButton from '../components/GlassButton';
import { GlassCard, GlassView, GLASS_RADII } from '../components/ui';
import { useTheme } from '../theme/ThemeProvider';
import { THEME_MODES } from '../theme';
import LivingBackground from '../components/LivingBackground';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle } from 'react-native-svg';
// react-native-view-shot: native module manquant sur tvOS, lazy require avec fallback
let ViewShot = null;
try { ViewShot = require('react-native-view-shot').default; } catch(e) {}
if (!ViewShot) ViewShot = require('react-native').View;
import { T, PILIER_IMAGES } from '../constants/data';
import { Bulle, FloatingMedusas, BULLES } from '../components/Meduse';
import AnimatedPlus from '../components/AnimatedPlus';
import healthkit from '../utils/healthkit';
import { getPiliers } from '../utils';
import { getMyReferralCode, getReferralStats } from '../utils/referrals';
import calendarUtil from '../utils/calendar';
import { deleteMyAccount } from '../utils/accountDeletion';
import { ACHIEVEMENTS, getUnlockedSync, subscribe as subscribeAchievements } from '../utils/achievements';
import { Icon } from '../components/Icons';

// Safe-require expo-clipboard pour le tap-to-copy. Si le module n'est
// pas dispo (Expo Go ou ancien build), on retombe sur Share.share — qui
// laisse à l'utilisateur le choix « Copier » dans la feuille système.
let _Clipboard = null;
try { _Clipboard = require('expo-clipboard'); } catch (e) {}

const COACH_IMAGE = require('../../assets/coach.jpg');
const DEV_IMAGE = require('../../assets/yvan.webp');

// ══════════════════════════════════
// PROFIL — Abonnement + Compte
// ══════════════════════════════════
function TimerIcon({ color, size }) {
  var s = size || 22;
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="13" r="8" stroke={color} strokeWidth={1.6} />
      <Path d="M12 5V7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M9.5 3h5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M12 13V9.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M12 13L14.5 15" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

function StatsBarsIcon({ color, size }) {
  var s = size || 22;
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20V12" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M10 20V8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M16 20V4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M3 20h17" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// Lazy-loaded sur iPhone uniquement (référencé via require dans
// openPairAppleTV pour éviter de charger expo-camera tant que l'utilisateur
// ne demande pas explicitement le pairage).
let _PairAppleTV = null;

function ProfilScreen({ prenom, done, lang, streak, supabase, supaUser, onLogout, onCreateAccount, isSubscriber, isAdmin, onRestorePurchases, onReset, onOpenTimer, onOpenStatistics, onOpenSabrina, onOpenDownloads, onOpenPreferences, onOpenAchievements, onEditProfile, profileRefreshKey, onAccountDeleted }) {
  var tr = T[lang] || T['fr'];
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var setThemeMode = themeCtx.setMode;
  var themeMode = themeCtx.mode;
  // Section title accent colour — green on dark glass, the deeper accent
  // text token on light glass. Used by the small caps headings of each
  // settings section.
  var sectionTitleColor = theme.colors.accentText;
  var shareRef = useRef(null);
  var [showCoachBio, setShowCoachBio] = useState(false);
  var [showDevBio, setShowDevBio] = useState(false);
  var [showPairTv, setShowPairTv] = useState(false);
  function openPairAppleTV() {
    if (!_PairAppleTV) {
      try { _PairAppleTV = require('./PairAppleTV').default; }
      catch (e) { Alert.alert('FluidBody+', 'Pairage indisponible.'); return; }
    }
    setShowPairTv(true);
  }
  var [notifHour, setNotifHour] = useState(7);
  var [dailyEnabled, setDailyEnabled] = useState(true);
  var [pauseEnabled, setPauseEnabled] = useState(true);
  var [quoteEnabled, setQuoteEnabled] = useState(true);
  var [quoteHour, setQuoteHour] = useState(8);
  var [showHrEnabled, setShowHrEnabled] = useState(true);
  var [storageUsed, setStorageUsed] = useState('0 B');
  var [achievementsUnlockedCount, setAchievementsUnlockedCount] = useState(function () { return getUnlockedSync().length; });
  var [hkAuthorized, setHkAuthorized] = useState(false);
  // Apple Calendar — auto-schedule sessions in iOS Calendar.
  var [calSyncEnabled, setCalSyncEnabled] = useState(false);
  var [calPreferredHour, setCalPreferredHour] = useState(18);
  var [calDuration, setCalDuration] = useState(20);
  var [calCalendarId, setCalCalendarId] = useState(null);
  var [calCalendars, setCalCalendars] = useState([]);
  var [calBusy, setCalBusy] = useState(false);
  var [calPickerOpen, setCalPickerOpen] = useState(false);
  var [profileData, setProfileData] = useState({ gender: null, birth_date: null, height_cm: null, weight_kg: null, practice_level: null, frequency: null, goals: [] });
  var [profileEditMode, setProfileEditMode] = useState(false);
  var [profileSaving, setProfileSaving] = useState(false);
  var [editGender, setEditGender] = useState(null);
  var [editD, setEditD] = useState('');
  var [editM, setEditM] = useState('');
  var [editY, setEditY] = useState('');
  var [editHeight, setEditHeight] = useState('');
  var [editWeight, setEditWeight] = useState('');
  // Parrainage : code généré paresseusement la 1ère fois qu'on monte ce
  // screen avec un user connecté. Les stats peuvent évoluer (un filleul
  // qui paie pendant la session courante), donc on re-fetch sur
  // profileRefreshKey (le même signal utilisé par le bloc « infos »).
  var [referralCode, setReferralCode] = useState(null);
  var [referralStats, setReferralStats] = useState({ referrals_count: 0, free_months_earned: 0, free_months_used: 0, free_months_available: 0 });
  var [referralCopiedToast, setReferralCopiedToast] = useState(false);
  // Easter egg — 5 taps on the avatar pill within 3s, admin-only. Opens the
  // "Coach mode" debug panel.
  var [coachModeVisible, setCoachModeVisible] = useState(false);
  var [coachModeStats, setCoachModeStats] = useState(null);
  var tapCountRef = useRef(0);
  var tapTimerRef = useRef(null);
  // Account deletion (Apple guideline 5.1.1(v)) — double-confirm flow.
  // Step 1: native Alert "Are you sure?" → continue opens the typed-confirm
  // modal. Step 2: user must type the localized confirmation word
  // (FR: SUPPRIMER, EN: DELETE) before the final destructive button is
  // active. Loading state disables everything during the RPC round trip.
  var [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  var [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  var [deletingAccount, setDeletingAccount] = useState(false);

  function handleAvatarTap() {
    if (!isAdmin) return;
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(function() { tapCountRef.current = 0; }, 3000);
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      try {
        var H = require('expo-haptics');
        H.notificationAsync(H.NotificationFeedbackType.Success);
      } catch (e) {}
      openCoachMode();
    }
  }

  async function openCoachMode() {
    try {
      var keys = await AsyncStorage.getAllKeys();
      var fluidKeys = keys.filter(function(k) { return k.startsWith('fluid'); });
      var totalDone = done ? Object.values(done).flat().filter(Boolean).length : 0;
      // Sum the per-day exercise minutes for context.
      var exerciseKeys = fluidKeys.filter(function(k) { return k.startsWith('fluid_exercise_'); });
      var totalMin = 0;
      for (var i = 0; i < exerciseKeys.length; i++) {
        try {
          var raw = await AsyncStorage.getItem(exerciseKeys[i]);
          totalMin += raw ? parseInt(raw, 10) || 0 : 0;
        } catch (e) {}
      }
      setCoachModeStats({
        totalDone: totalDone,
        streak: streak || 0,
        totalMin: totalMin,
        fluidKeysCount: fluidKeys.length,
        adminEmail: supaUser && supaUser.email,
      });
      setCoachModeVisible(true);
    } catch (e) {}
  }

  // ── Account deletion handlers ──────────────────────────────────────
  // Step 1: native Alert. Continue → opens the typed-confirm modal.
  function startDeleteAccount() {
    Alert.alert(
      tr.delete_account_confirm_title || 'Es-tu sûr ?',
      tr.delete_account_confirm_message || 'Cette action est irréversible.',
      [
        { text: tr.delete_account_cancel || 'Annuler', style: 'cancel' },
        {
          text: tr.delete_account_continue || 'Continuer',
          style: 'destructive',
          onPress: function() {
            setDeleteConfirmInput('');
            setDeleteConfirmOpen(true);
          },
        },
      ]
    );
  }

  // Step 2: only enabled once the typed word matches (case-insensitive).
  async function confirmDeleteAccount() {
    var expected = (tr.delete_account_type_word || 'SUPPRIMER').trim();
    var typed = (deleteConfirmInput || '').trim();
    if (typed.toUpperCase() !== expected.toUpperCase()) {
      Alert.alert(
        tr.delete_account_error_title || 'Erreur',
        tr.delete_account_mismatch || 'Le mot tapé ne correspond pas.'
      );
      return;
    }
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await deleteMyAccount(supabase);
      // Close the modal before showing the success Alert — keeps the
      // Modal underlay from intercepting the OK button.
      setDeleteConfirmOpen(false);
      setDeleteConfirmInput('');
      Alert.alert(
        tr.delete_account_success_title || 'Compte supprimé',
        tr.delete_account_success_message || 'Ton compte a été supprimé.',
        [
          {
            text: 'OK',
            onPress: function() {
              // onAccountDeleted is wired in App.js to reset onboarding
              // state + clear React state. Local storage was already
              // wiped by deleteMyAccount. If the prop isn't passed,
              // signOut() (also inside deleteMyAccount) will still
              // bounce the user to the unauth UI on the next render.
              if (typeof onAccountDeleted === 'function') onAccountDeleted();
            },
          },
        ]
      );
    } catch (e) {
      var msg = (e && e.message) ? e.message : null;
      Alert.alert(
        tr.delete_account_error_title || 'Suppression impossible',
        (tr.delete_account_error_message || 'Une erreur est survenue.') + (msg ? '\n\n(' + msg + ')' : '')
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  async function coachActionResetMilestones() {
    try { await AsyncStorage.removeItem('fluid_milestones_seen'); Alert.alert('Coach mode', 'Milestones réinitialisés.'); } catch (e) {}
  }
  async function coachActionForceBreath() {
    try {
      var k = 'fluid_breath_' + new Date().toISOString().slice(0, 10);
      await AsyncStorage.setItem(k, '1');
      Alert.alert('Coach mode', 'Respiration du jour marquée comme faite.');
    } catch (e) {}
  }
  async function coachActionResetCoachWelcome() {
    try { await AsyncStorage.removeItem('fluid_coach_welcome_seen'); Alert.alert('Coach mode', 'Welcome overlay réarmé pour le prochain lancement.'); } catch (e) {}
  }

  useEffect(function() {
    AsyncStorage.getItem('fluid_notif_hour').then(function(v) { if (v) setNotifHour(parseInt(v) || 7); });
    AsyncStorage.getItem('fluid_notif_daily_enabled').then(function(v) { setDailyEnabled(v !== 'false'); });
    AsyncStorage.getItem('fluid_notif_pause_enabled').then(function(v) { setPauseEnabled(v !== 'false'); });
    AsyncStorage.getItem('fluid_quote_enabled').then(function(v) { setQuoteEnabled(v !== 'false'); });
    AsyncStorage.getItem('fluid_quote_hour').then(function(v) { if (v) setQuoteHour(parseInt(v) || 8); });
    AsyncStorage.getItem('fluid_show_hr').then(function(v) { setShowHrEnabled(v !== 'false'); });
    try {
      var { getStorageUsed, formatBytes } = require('../components/DownloadManager');
      getStorageUsed().then(function(s) { setStorageUsed(formatBytes(s)); });
    } catch(e) {}
    if (Platform.OS === 'ios') {
      healthkit.ensureHealthKitInit().then(function(res) {
        setHkAuthorized(!!(res && res.ok));
      }).catch(function() {});
    }
    // Calendar prefs — restore last-known sync state.
    calendarUtil.getCalendarPrefs().then(function(prefs) {
      if (!prefs) return;
      setCalSyncEnabled(!!prefs.enabled);
      setCalPreferredHour(typeof prefs.preferredHour === 'number' ? prefs.preferredHour : 18);
      setCalDuration(typeof prefs.defaultDurationMin === 'number' ? prefs.defaultDurationMin : 20);
      setCalCalendarId(prefs.calendarId || null);
    }).catch(function(){});
    if (Platform.OS === 'ios' && calendarUtil.isCalendarAvailable()) {
      calendarUtil.getCalendarPermissionStatus().then(function(s) {
        if (s === 'granted') {
          calendarUtil.listWritableCalendars().then(function(list) { setCalCalendars(list || []); }).catch(function(){});
        }
      }).catch(function(){});
    }
  }, []);

  // Achievements live count for the "Mes accomplissements" row subtitle.
  // The pub/sub fires whenever detectNewUnlocks persists a new badge — keeps
  // the badge count in Profil in sync without forcing a manual refresh.
  useEffect(function () {
    setAchievementsUnlockedCount(getUnlockedSync().length);
    var unsub = subscribeAchievements(function (ids) {
      setAchievementsUnlockedCount((ids && ids.length) || 0);
    });
    return unsub;
  }, []);

  async function handleCalendarToggle() {
    if (calBusy) return;
    if (calSyncEnabled) {
      // Turning off: remove future events + persist.
      setCalBusy(true);
      try {
        await calendarUtil.unscheduleAllFluidbody();
        await calendarUtil.setCalendarPrefs({ enabled: false });
        setCalSyncEnabled(false);
      } catch (e) {}
      setCalBusy(false);
      return;
    }
    setCalBusy(true);
    try {
      const granted = await calendarUtil.requestCalendarPermission();
      if (!granted) {
        Alert.alert('FluidBody', tr.calendar_permission_denied || "Permission refusée. Ouvre Réglages > Confidentialité > Calendriers pour autoriser Fluidbody.");
        setCalBusy(false);
        return;
      }
      const list = await calendarUtil.listWritableCalendars();
      setCalCalendars(list || []);
      const defaultId = calCalendarId || await calendarUtil.getDefaultCalendarId();
      setCalCalendarId(defaultId || null);
      await calendarUtil.setCalendarPrefs({
        enabled: true,
        preferredHour: calPreferredHour,
        defaultDurationMin: calDuration,
        calendarId: defaultId || null,
      });
      setCalSyncEnabled(true);
    } catch (e) {}
    setCalBusy(false);
  }

  async function updateCalendarPref(patch) {
    if (patch && typeof patch.preferredHour === 'number') setCalPreferredHour(patch.preferredHour);
    if (patch && typeof patch.defaultDurationMin === 'number') setCalDuration(patch.defaultDurationMin);
    if (patch && 'calendarId' in patch) setCalCalendarId(patch.calendarId);
    try { await calendarUtil.setCalendarPrefs(patch); } catch (e) {}
  }

  function reconnectHealthKit() {
    if (Platform.OS !== 'ios') return;
    healthkit.ensureHealthKitInit().then(function(res) {
      setHkAuthorized(!!(res && res.ok));
    }).catch(function() {});
  }

  useEffect(function() {
    if (!supabase || !supaUser) {
      if (__DEV__) console.log('[Profil] fetch skipped — supabase=' + !!supabase + ' supaUser=' + !!supaUser);
      return;
    }
    if (__DEV__) console.log('[Profil] fetching profile for user.id:', supaUser.id);
    var cancelled = false;
    supabase.from('profiles').select('prenom, gender, birth_date, height_cm, weight_kg, practice_level, frequency, goals').eq('id', supaUser.id).maybeSingle().then(function(res) {
      if (cancelled) return;
      if (__DEV__) console.log('[Profil] fetched res:', JSON.stringify({ data: res?.data || null, error: res?.error?.message || null }));
      if (!res || !res.data) return;
      setProfileData({
        gender: res.data.gender || null,
        birth_date: res.data.birth_date || null,
        height_cm: res.data.height_cm != null ? res.data.height_cm : null,
        weight_kg: res.data.weight_kg != null ? res.data.weight_kg : null,
        practice_level: res.data.practice_level || null,
        frequency: res.data.frequency || null,
        goals: Array.isArray(res.data.goals) ? res.data.goals : [],
      });
      // Miroir AsyncStorage : VideoPlayer en a besoin pour la FCmax.
      try {
        if (res.data.birth_date) AsyncStorage.setItem('fluid_birth_date', res.data.birth_date);
      } catch (e) {}
    }).catch(function(e) {
      if (__DEV__) console.log('[Profil] fetch threw:', e?.message || e);
    });
    return function() { cancelled = true; };
  }, [supaUser && supaUser.id, profileRefreshKey]);

  // Parrainage — fetch (et génère si besoin) le code + les stats du
  // user. Dépend de profileRefreshKey pour que le retour depuis l'écran
  // d'édition rafraîchisse les compteurs si un filleul vient de payer.
  useEffect(function() {
    if (!supabase || !supaUser) return;
    var cancelled = false;
    getMyReferralCode(supabase).then(function(code) {
      if (!cancelled) setReferralCode(code || null);
    });
    getReferralStats(supabase, supaUser.id).then(function(stats) {
      if (!cancelled && stats) setReferralStats(stats);
    });
    return function() { cancelled = true; };
  }, [supaUser && supaUser.id, profileRefreshKey]);

  function startProfileEdit() {
    setEditGender(profileData.gender || null);
    if (profileData.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(profileData.birth_date)) {
      var parts = profileData.birth_date.split('-');
      setEditY(parts[0]); setEditM(parts[1]); setEditD(parts[2]);
    } else { setEditY(''); setEditM(''); setEditD(''); }
    setEditHeight(profileData.height_cm != null ? String(profileData.height_cm) : '');
    setEditWeight(profileData.weight_kg != null ? String(profileData.weight_kg) : '');
    setProfileEditMode(true);
  }

  async function saveProfileEdit() {
    var dd = parseInt(editD, 10), mm = parseInt(editM, 10), yy = parseInt(editY, 10);
    var birth = null;
    // Birth date validation: must be a real calendar date (Date roundtrip),
    // not in the future, and the user must be at least 13 years old. Empty
    // is allowed (clears the field).
    var birthProvided = !!(editD || editM || editY);
    if (birthProvided) {
      var validShape = dd && mm && yy && yy >= 1900 && yy <= new Date().getFullYear() && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
      if (!validShape) {
        Alert.alert('FluidBody', tr.profile_birth_invalid || 'Date de naissance invalide');
        return;
      }
      var probe = new Date(yy, mm - 1, dd);
      if (probe.getFullYear() !== yy || probe.getMonth() !== mm - 1 || probe.getDate() !== dd) {
        Alert.alert('FluidBody', tr.profile_birth_invalid || 'Date de naissance invalide');
        return;
      }
      var today = new Date();
      if (probe.getTime() > today.getTime()) {
        Alert.alert('FluidBody', tr.profile_birth_future || 'La date de naissance ne peut pas être dans le futur');
        return;
      }
      var minAdult = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
      if (probe.getTime() > minAdult.getTime()) {
        Alert.alert('FluidBody', tr.profile_birth_under_age || 'Tu dois avoir au moins 13 ans');
        return;
      }
      birth = yy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
    }
    var h = parseInt(editHeight, 10);
    var w = parseInt(editWeight, 10);
    if (editHeight.trim() !== '' && (!isFinite(h) || h < 120 || h > 220)) {
      Alert.alert('FluidBody', tr.profile_height_invalid || 'La taille doit être entre 120 et 220 cm');
      return;
    }
    if (editWeight.trim() !== '' && (!isFinite(w) || w < 30 || w > 200)) {
      Alert.alert('FluidBody', tr.profile_weight_invalid || 'Le poids doit être entre 30 et 200 kg');
      return;
    }
    var next = {
      gender: editGender || null,
      birth_date: birth,
      height_cm: isFinite(h) && h >= 120 && h <= 220 ? h : null,
      weight_kg: isFinite(w) && w >= 30 && w <= 200 ? w : null,
    };
    setProfileData(next);
    setProfileEditMode(false);
    // Miroir AsyncStorage pour les composants offline (VideoPlayer / FCmax).
    try {
      if (next.birth_date) await AsyncStorage.setItem('fluid_birth_date', next.birth_date);
      else await AsyncStorage.removeItem('fluid_birth_date');
    } catch (e) {}
    if (!supabase || !supaUser) return;
    setProfileSaving(true);
    try {
      await supabase.from('profiles').upsert({
        id: supaUser.id,
        gender: next.gender,
        birth_date: next.birth_date,
        height_cm: next.height_cm,
        weight_kg: next.weight_kg,
        updated_at: new Date().toISOString(),
      });
    } catch(e) {}
    setProfileSaving(false);
  }

  function genderLabel(key) {
    if (key === 'female') return tr.profile_gender_female || tr.onb_gender_female || 'Femme';
    if (key === 'male') return tr.profile_gender_male || tr.onb_gender_male || 'Homme';
    if (key === 'other' || key === 'nonbinary') return tr.onb_gender_nonbinary || tr.profile_gender_other || 'Non-binaire';
    if (key === 'undisclosed') return tr.onb_gender_undisclosed || 'Préfère ne pas dire';
    return tr.profile_not_set || 'Non renseigné';
  }
  function practiceLabel(key) {
    if (key === 'beginner') return tr.onb_practice_beginner || 'Débutant';
    if (key === 'intermediate') return tr.onb_practice_intermediate || 'Intermédiaire';
    if (key === 'advanced') return tr.onb_practice_advanced || 'Avancé';
    return tr.profile_not_set || 'Non renseigné';
  }
  function frequencyLabel(key) {
    if (key === '1-2') return tr.onb_frequency_low || '1–2 fois';
    if (key === '3-4') return tr.onb_frequency_mid || '3–4 fois';
    if (key === '5+') return tr.onb_frequency_high || '5+ fois';
    return tr.profile_not_set || 'Non renseigné';
  }
  function goalsLabel(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return tr.profile_not_set || 'Non renseigné';
    var map = {
      tone: tr.onb_goal_tone || 'Tonifier',
      flex: tr.onb_goal_flex || 'Souplesse',
      posture: tr.onb_goal_posture || 'Posture',
      recovery: tr.onb_goal_recovery || 'Récupération',
      serenity: tr.onb_goal_serenity || 'Sérénité',
    };
    return arr.map(function(k) { return map[k] || k; }).join(' · ');
  }
  function formatBirth(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return tr.profile_not_set || 'Non renseigné';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  var totalDoneVal = done ? Object.values(done).flat().filter(Boolean).length : 0;
  var pctVal = Math.round(totalDoneVal / 160 * 100);
  var piliers = getPiliers(lang);
  var bestPilier = piliers.reduce(function(best, p) { var c = (done[p.key] || []).filter(Boolean).length; return c > best.count ? { p: p, count: c } : best; }, { p: piliers[0], count: 0 });

  async function copyReferralCode() {
    if (!referralCode) return;
    try { var H = require('expo-haptics'); H.selectionAsync(); } catch (e) {}
    if (_Clipboard) {
      try {
        var fn = _Clipboard.setStringAsync || _Clipboard.setString;
        if (fn) await fn(referralCode);
        setReferralCopiedToast(true);
        setTimeout(function() { setReferralCopiedToast(false); }, 1600);
        return;
      } catch (e) {}
    }
    // Fallback : ouvre la feuille de partage avec le seul code, l'user
    // pourra le copier depuis là. Pas idéal mais 0 dépendance.
    var msg = typeof tr.referral_share_message === 'function'
      ? tr.referral_share_message(referralCode)
      : referralCode;
    Share.share({ message: msg }).catch(function() {});
  }

  function shareReferralCode() {
    if (!referralCode) return;
    try { var H = require('expo-haptics'); H.selectionAsync(); } catch (e) {}
    var msg = typeof tr.referral_share_message === 'function'
      ? tr.referral_share_message(referralCode)
      : ('FluidBody+ · ' + referralCode);
    Share.share({ message: msg }).catch(function() {});
  }

  async function shareWithCard() {
    if (shareRef.current) {
      try {
        var uri = await shareRef.current.capture({ format: 'png', quality: 1 });
        Share.share({ url: uri, message: 'FluidBody+ Pilates\nhttps://apps.apple.com/app/fluidbody/id6761364962' }).catch(function() {});
        return;
      } catch(e) {}
    }
    Share.share({ message: (tr.partage_share_msg || 'FluidBody+ Pilates') + '\n' + pctVal + '% · ' + totalDoneVal + ' ' + (tr.m_seances || 'séances') + ' · 🔥' + (streak || 0) + '\nhttps://apps.apple.com/app/fluidbody/id6761364962' }).catch(function() {});
  }
  // Section labels for the regrouped iPhone Profile (Coach / Activité /
  // Réglages / Compte / À propos). Each row pairs a localized label with
  // the icon key from src/components/Icons.js — emoji-free.
  var SECTION_LABELS = {
    coach:    { iconKey: 'user',        fr: 'Votre coach', en: 'Your coach', es: 'Tu coach',     it: 'La tua coach' },
    activity: { iconKey: 'bar_chart',   fr: 'Mon activité', en: 'My activity', es: 'Mi actividad', it: 'La mia attività' },
    settings: { iconKey: 'gear',        fr: 'Réglages',     en: 'Settings',    es: 'Ajustes',      it: 'Impostazioni' },
    account:  { iconKey: 'credit_card', fr: 'Compte',       en: 'Account',     es: 'Cuenta',       it: 'Account' },
    about:    { iconKey: 'info',        fr: 'À propos',     en: 'About',       es: 'Acerca de',    it: 'Informazioni' },
  };
  function sectionLabel(key) {
    var row = SECTION_LABELS[key];
    if (!row) return '';
    return row[lang] || row.fr;
  }
  function sectionIconKey(key) {
    var row = SECTION_LABELS[key];
    return row ? row.iconKey : null;
  }
  function SectionHeader(props) {
    return (
      <View
        accessibilityRole="header"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: 24,
          marginTop: 8,
          marginBottom: 12,
          gap: 8,
        }}
      >
        {props.sectionKey ? (
          <Icon name={sectionIconKey(props.sectionKey)} size={14} color="#AEEF4D" strokeWidth={2} />
        ) : null}
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            color: '#AEEF4D',
            letterSpacing: 2.5,
            textTransform: 'uppercase',
          }}
        >
          {props.label}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={theme.colors.bgGradient} locations={theme.colors.bgGradientStops} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />
      <ScrollView contentContainerStyle={{ paddingTop: 62, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {!supaUser && onCreateAccount && (
          <TouchableOpacity
            onPress={onCreateAccount}
            activeOpacity={0.85}
            style={{
              marginHorizontal: 20,
              marginBottom: 24,
              padding: 18,
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 18,
              backgroundColor: 'rgba(0,18,38,0.55)',
              borderWidth: 1,
              borderColor: 'rgba(174,239,77,0.35)',
              shadowColor: '#AEEF4D',
              shadowOpacity: 0.12,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <LinearGradient
              colors={['rgba(174,239,77,0.28)', 'rgba(174,239,77,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
                borderWidth: 1,
                borderColor: 'rgba(174,239,77,0.45)',
              }}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="8" r="3.8" stroke="#AEEF4D" strokeWidth={1.7} />
                <Path d="M4.5 20.5c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5" stroke="#AEEF4D" strokeWidth={1.7} strokeLinecap="round" />
              </Svg>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.1 }}>{tr.save_progress_title || 'Sauvegarde ta progression'}</Text>
              <Text style={{ fontSize: 12, fontWeight: '400', color: theme.colors.textSecondary, marginTop: 3, lineHeight: 16 }}>{tr.save_progress_sub || 'Crée un compte gratuit pour ne rien perdre'}</Text>
            </View>
            <Text style={{ fontSize: 22, color: '#AEEF4D', fontWeight: '300', marginLeft: 6 }}>{'›'}</Text>
          </TouchableOpacity>
        )}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <TouchableOpacity activeOpacity={0.92} onPress={handleAvatarTap} accessible={false}>
            <GlassCard intensity={60} padding={18} borderRadius={GLASS_RADII.cardLg}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#000000' }}>{prenom ? prenom.slice(0, 2).toUpperCase() : 'YT'}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.4 }}>{prenom || 'Profil'}</Text>
                  <Text style={{ fontSize: 13, color: theme.colors.accentText, opacity: 0.85 }}>FluidBody · Pilates</Text>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: sectionTitleColor, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{tr.partage_title || 'Partage'}</Text>

          <ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
            <LinearGradient colors={['#00bdd0', '#005878', '#002d48', '#000e18']} style={{ borderRadius: 16, padding: 22, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff' }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: 26 }}>+</AnimatedPlus></Text>
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D' }}>
                  <ExpoImage source={COACH_IMAGE} contentFit="cover" cachePolicy="memory-disk" style={{ flex: 1 }} />
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
                  <ExpoImage source={PILIER_IMAGES[bestPilier.p.key]} contentFit="cover" cachePolicy="memory-disk" style={{ flex: 1 }} />
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
              Share.share({ message: (tr.partage_invite_msg || 'Rejoins-moi sur FluidBody+ Pilates !') + '\nhttps://apps.apple.com/app/fluidbody/id6761364962' }).catch(function() {});
            }} activeOpacity={0.85} style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.partage_inviter || 'Inviter'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Mon parrainage ────────────────────────────────────────
            Visible uniquement quand un user Supabase est connecté
            (sinon pas de code à générer). Le bouton de partage et le
            tap-to-copy ouvrent respectivement la share sheet et
            clipboard. Les 3 chiffres en bas reflètent l'état serveur
            (referrals_count, earned, available). */}
        {supaUser && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            <GlassCard intensity={60} padding={20} borderRadius={GLASS_RADII.card} substrateColor={theme.glass.substrateAccent}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: sectionTitleColor, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
                {tr.referral_section_title || 'Mon parrainage'}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '400', color: theme.colors.textSecondary, lineHeight: 19, marginBottom: 16 }}>
                {tr.referral_explainer || 'Chaque amie qui s\'abonne via ton code te fait gagner 1 mois gratuit — à elle aussi.'}
              </Text>

              {/* Code en gros, tap-to-copy */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={copyReferralCode}
                disabled={!referralCode}
                accessibilityLabel={tr.referral_code_label || 'Ton code de parrainage'}
                accessibilityRole="button"
                accessibilityHint={tr.referral_code_tap_to_copy || 'Appuie pour copier'}
                style={{
                  paddingVertical: 18,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  backgroundColor: 'rgba(0,0,0,0.18)',
                  borderWidth: 1,
                  borderColor: 'rgba(174,239,77,0.35)',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>
                  {tr.referral_code_label || 'Ton code'}
                </Text>
                <Text selectable style={{ fontSize: 24, fontWeight: '800', color: '#AEEF4D', letterSpacing: 2, fontVariant: ['tabular-nums'] }}>
                  {referralCode || '— — — —'}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 8 }}>
                  {referralCopiedToast
                    ? (tr.referral_code_copied || 'Code copié !')
                    : (tr.referral_code_tap_to_copy || 'Appuie pour copier')}
                </Text>
              </TouchableOpacity>

              {/* CTA share */}
              <TouchableOpacity
                onPress={shareReferralCode}
                disabled={!referralCode}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={tr.referral_share_btn || 'Partager mon code'}
                style={{ height: 46, borderRadius: 23, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginBottom: 16, opacity: referralCode ? 1 : 0.4 }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#000000' }}>{tr.referral_share_btn || 'Partager mon code'}</Text>
              </TouchableOpacity>

              {/* Stats — 3 chiffres glass mini-cards */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: theme.colors.hairline, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text }}>{referralStats.referrals_count}</Text>
                  <Text numberOfLines={2} style={{ fontSize: 10, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4, letterSpacing: 0.3 }}>
                    {referralStats.referrals_count === 1
                      ? (tr.referral_stat_friends_singular || 'amie parrainée')
                      : (tr.referral_stat_friends || 'amies parrainées')}
                  </Text>
                </View>
                <View style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: theme.colors.hairline, alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#AEEF4D' }}>{referralStats.free_months_earned}</Text>
                  <Text numberOfLines={2} style={{ fontSize: 10, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4, letterSpacing: 0.3 }}>
                    {tr.referral_stat_months_earned || 'mois gratuits gagnés'}
                  </Text>
                </View>
                <View style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(174,239,77,0.10)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#AEEF4D' }}>{referralStats.free_months_available}</Text>
                  <Text numberOfLines={2} style={{ fontSize: 10, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4, letterSpacing: 0.3 }}>
                    {tr.referral_stat_months_available || 'mois disponibles'}
                  </Text>
                </View>
              </View>
            </GlassCard>
          </View>
        )}

        <SectionHeader sectionKey="coach" label={sectionLabel('coach')} />
        <View style={{ marginHorizontal: 20, marginBottom: 16 }}><GlassCard intensity={60} padding={20} borderRadius={GLASS_RADII.card} substrateColor={theme.glass.substrateAccent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 70, height: 70, borderRadius: 35, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D', marginRight: 14 }}>
              <ExpoImage source={COACH_IMAGE} contentFit="cover" cachePolicy="memory-disk" style={{ flex: 1 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text }}>{tr.coach_name || 'Sabrina'}</Text>
              <Text style={{ fontSize: 12, color: '#AEEF4D', marginTop: 2 }}>{tr.coach_subtitle || 'Experte Pilates · 30 ans d\'expérience'}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '300', color: theme.colors.textSecondary, lineHeight: 20, fontStyle: 'italic', marginBottom: 14 }}>{tr.coach_bio || 'Passionnée par le mouvement conscient, je vous guide vers un corps plus libre et plus fort.'}</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={function() {
            if (onOpenSabrina) onOpenSabrina();
            else setShowCoachBio(true);
          }} style={{ paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.coach_more || 'En savoir plus'}</Text>
          </TouchableOpacity>
        </GlassCard></View>

        <Modal visible={showCoachBio} animationType="slide" transparent statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,14,24,0.6)', justifyContent: 'center' }}>
            <View style={{ marginHorizontal: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', maxHeight: Dimensions.get('window').height * 0.8, shadowColor: '#ffffff', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
              <BlurView intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={{ backgroundColor: 'rgba(10,20,35,0.6)', padding: 24 }}>
                <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']} locations={[0, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%' }} pointerEvents="none" />
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 90, height: 90, borderRadius: 45, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D', marginBottom: 12 }}>
                    <ExpoImage source={COACH_IMAGE} contentFit="cover" cachePolicy="memory-disk" style={{ flex: 1 }} />
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text }}>{tr.coach_name || 'Sabrina'}</Text>
                  <Text style={{ fontSize: 13, color: '#AEEF4D', marginTop: 4 }}>{tr.coach_subtitle || 'Experte Pilates · 30 ans d\'expérience'}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '300', color: 'rgba(255,255,255,0.8)', lineHeight: 22 }}>{tr.coach_full_bio || ''}</Text>
              </ScrollView>
              <TouchableOpacity onPress={function() { setShowCoachBio(false); }} style={{ marginTop: 18, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.15)', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>Fermer</Text>
              </TouchableOpacity>
              </BlurView>
            </View>
          </View>
        </Modal>

        <SectionHeader sectionKey="activity" label={sectionLabel('activity')} />
        {onOpenStatistics && (
          <TouchableOpacity
            onPress={onOpenStatistics}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={tr.stats_a11y_open || 'Ouvrir les statistiques avancées'}
            style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(174,239,77,0.18)' }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(174,239,77,0.14)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <StatsBarsIcon color="#AEEF4D" size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{tr.stats_title || 'Statistiques'}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{tr.stats_subtitle || 'Ta progression dans le temps'}</Text>
            </View>
            <Text style={{ fontSize: 22, color: 'rgba(174,239,77,0.7)', fontWeight: '300' }}>{'›'}</Text>
          </TouchableOpacity>
        )}

        {/* Mes accomplissements — accès direct vers la vue dédiée 2-col
            des 15 badges (catalogue dans utils/achievements.js). Le compteur
            se met à jour live via le pub/sub achievements. */}
        {onOpenAchievements && (
          <TouchableOpacity
            onPress={onOpenAchievements}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={tr.profile_my_achievements_title || 'Mes accomplissements'}
            style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(174,239,77,0.18)' }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(174,239,77,0.14)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Icon name="trophy" size={22} color="#AEEF4D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{tr.profile_my_achievements_title || (lang === 'fr' ? 'Mes accomplissements' : 'My achievements')}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>
                {(function () {
                  if (typeof tr.profile_my_achievements_sub === 'function') return tr.profile_my_achievements_sub(achievementsUnlockedCount);
                  return achievementsUnlockedCount + (lang === 'fr'
                    ? (achievementsUnlockedCount > 1 ? ' badges débloqués' : ' badge débloqué')
                    : (achievementsUnlockedCount === 1 ? ' badge unlocked' : ' badges unlocked'));
                })()}
              </Text>
            </View>
            <Text style={{ fontSize: 22, color: 'rgba(174,239,77,0.7)', fontWeight: '300' }}>{'›'}</Text>
          </TouchableOpacity>
        )}

        {/* Mes téléchargements — accessible aux iPhone abonnés. La gestion
            réelle des fichiers (cache, suppression, espace) vit dans le
            screen dédié MesTelechargements. */}
        {onOpenDownloads && (
          <TouchableOpacity
            onPress={onOpenDownloads}
            activeOpacity={0.85}
            style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(174,239,77,0.18)' }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(174,239,77,0.14)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Icon name="download" size={22} color="#AEEF4D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{tr.downloads_title || (lang === 'fr' ? 'Mes téléchargements' : 'My downloads')}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{tr.downloads_sub || (lang === 'fr' ? 'Séances disponibles hors-ligne' : 'Sessions available offline')}</Text>
            </View>
            <Text style={{ fontSize: 22, color: 'rgba(174,239,77,0.7)', fontWeight: '300' }}>{'›'}</Text>
          </TouchableOpacity>
        )}

        {onOpenTimer && (
          <TouchableOpacity
            onPress={onOpenTimer}
            activeOpacity={0.85}
            style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(174,239,77,0.18)' }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(174,239,77,0.14)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <TimerIcon color="#AEEF4D" size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{tr.timer_title || 'Minuteur Stretching & Eldoa'}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{tr.timer_sub || 'Lance un minuteur pour tes étirements'}</Text>
            </View>
            <Text style={{ fontSize: 22, color: 'rgba(174,239,77,0.7)', fontWeight: '300' }}>{'›'}</Text>
          </TouchableOpacity>
        )}

        <SectionHeader sectionKey="settings" label={sectionLabel('settings')} />

        {/* Apple TV pairing — visible uniquement si loggué (sinon
            le redeem côté edge function échouera). Section discrète :
            une ligne avec icône + label + chevron. */}
        {supaUser && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            <GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
              <TouchableOpacity
                onPress={openPairAppleTV}
                accessibilityRole="button"
                accessibilityLabel={tr.tv_pair_btn || 'Pairer une Apple TV'}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
              >
                {/* Icône Apple TV minimaliste — écran + stand, monochrome
                    accent vert pour rester cohérent avec le design system. */}
                <View style={{ width: 28, height: 28, marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 15.5v-9A1.5 1.5 0 0 1 4 5z"
                      stroke="#AEEF4D"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M9 20.5h6M12 17v3.5"
                      stroke="#AEEF4D"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                    />
                    <Circle cx={6.5} cy={10.5} r={1} fill="#AEEF4D" />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text, letterSpacing: -0.1 }}>
                    {tr.tv_pair_btn || 'Pairer une Apple TV'}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>
                    {tr.tv_pair_sub || 'Scanne le QR code affiché sur ta TV'}
                  </Text>
                </View>
                <Text style={{ fontSize: 18, color: theme.colors.textTertiary || theme.colors.textSecondary }}>›</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        )}

        {/* Préférences — qualité streaming, audio background, HD systématique,
            Wi-Fi only download. Écran dédié, état persistant via AsyncStorage. */}
        {onOpenPreferences && (
          <TouchableOpacity
            onPress={onOpenPreferences}
            activeOpacity={0.85}
            style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(174,239,77,0.18)' }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(174,239,77,0.14)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Icon name="gear" size={22} color="#AEEF4D" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{tr.prefs_title || (lang === 'fr' ? 'Préférences' : 'Preferences')}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{tr.prefs_row_sub || (lang === 'fr' ? 'Qualité, audio, téléchargements' : 'Quality, audio, downloads')}</Text>
            </View>
            <Text style={{ fontSize: 22, color: 'rgba(174,239,77,0.7)', fontWeight: '300' }}>{'›'}</Text>
          </TouchableOpacity>
        )}

        <View style={{ marginHorizontal: 20, marginBottom: 16 }}><GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: sectionTitleColor, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.notif_section || 'Rappels'}</Text>

          {/* Rappel quotidien \u2014 master toggle */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.notif_daily_label || 'Rappel quotidien'}</Text>
              <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }}>{tr.notif_daily_sub || "Sabrina t'attend pour ta pratique du jour"}</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="switch"
              accessibilityState={{ checked: dailyEnabled }}
              onPress={function() {
                var next = !dailyEnabled;
                setDailyEnabled(next);
                AsyncStorage.setItem('fluid_notif_daily_enabled', String(next));
              }}
              style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: dailyEnabled ? '#AEEF4D' : 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 2 }}
            >
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#ffffff', alignSelf: dailyEnabled ? 'flex-end' : 'flex-start' }} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, opacity: dailyEnabled ? 1 : 0.4 }}>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.notif_hour_label || 'Heure du rappel'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity disabled={!dailyEnabled} onPress={function() {
                var h = Math.max(5, notifHour - 1);
                setNotifHour(h);
                AsyncStorage.setItem('fluid_notif_hour', String(h));
              }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, color: '#AEEF4D', fontWeight: '700' }}>{'\u2212'}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, minWidth: 50, textAlign: 'center' }}>{notifHour}h00</Text>
              <TouchableOpacity disabled={!dailyEnabled} onPress={function() {
                var h = Math.min(22, notifHour + 1);
                setNotifHour(h);
                AsyncStorage.setItem('fluid_notif_hour', String(h));
              }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, color: '#AEEF4D', fontWeight: '700' }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.notif_pause_label || 'Pauses actives au bureau'}</Text>
              <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }}>{tr.notif_pause_sub || '9h-17h en semaine'}</Text>
            </View>
            <TouchableOpacity onPress={function() {
              var next = !pauseEnabled;
              setPauseEnabled(next);
              AsyncStorage.setItem('fluid_notif_pause_enabled', String(next));
            }} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: pauseEnabled ? '#AEEF4D' : 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 2 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#ffffff', alignSelf: pauseEnabled ? 'flex-end' : 'flex-start' }} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: quoteEnabled ? 16 : 0 }}>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, flex: 1, paddingRight: 12 }}>{tr.notif_quote_label || 'Phrase du jour de Sabrina'}</Text>
            <TouchableOpacity onPress={function() {
              var next = !quoteEnabled;
              setQuoteEnabled(next);
              AsyncStorage.setItem('fluid_quote_enabled', String(next));
            }} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: quoteEnabled ? '#AEEF4D' : 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 2 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#ffffff', alignSelf: quoteEnabled ? 'flex-end' : 'flex-start' }} />
            </TouchableOpacity>
          </View>

          {quoteEnabled && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.notif_quote_hour_label || 'Heure de la phrase'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={function() {
                  var h = Math.max(5, quoteHour - 1);
                  setQuoteHour(h);
                  AsyncStorage.setItem('fluid_quote_hour', String(h));
                }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18, color: '#AEEF4D', fontWeight: '700' }}>{'−'}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, minWidth: 50, textAlign: 'center' }}>{quoteHour}h00</Text>
                <TouchableOpacity onPress={function() {
                  var h = Math.min(22, quoteHour + 1);
                  setQuoteHour(h);
                  AsyncStorage.setItem('fluid_quote_hour', String(h));
                }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18, color: '#AEEF4D', fontWeight: '700' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </GlassCard></View>

        {Platform.OS === 'ios' && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}><GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: sectionTitleColor, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.session_settings_title || 'Pendant la séance'}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.show_hr_label || 'Afficher la fréquence cardiaque'}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }}>{tr.show_hr_sub || 'Lit la fréquence via Apple Santé · pill discret en haut à droite'}</Text>
              </View>
              <TouchableOpacity onPress={function() {
                var next = !showHrEnabled;
                setShowHrEnabled(next);
                AsyncStorage.setItem('fluid_show_hr', String(next));
              }} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: showHrEnabled ? '#AEEF4D' : 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 2 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#ffffff', alignSelf: showHrEnabled ? 'flex-end' : 'flex-start' }} />
              </TouchableOpacity>
            </View>
          </GlassCard></View>
        )}

{Platform.OS === 'ios' && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}><GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: sectionTitleColor, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.watch_section || 'Connexions'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1, paddingRight: 12 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hkAuthorized ? '#34c759' : 'rgba(255,255,255,0.35)', marginRight: 10, marginTop: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>
                    {hkAuthorized ? (tr.watch_healthkit_status_ok || 'Apple Santé autorisé') : (tr.watch_healthkit_status_off || 'Apple Santé non autorisé')}
                  </Text>
                  {hkAuthorized ? (
                    <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }}>{tr.watch_healthkit_status_hint || 'Lit les données de ton iPhone et Apple Watch via Apple Santé'}</Text>
                  ) : null}
                </View>
              </View>
              {!hkAuthorized ? (
                <TouchableOpacity onPress={reconnectHealthKit} activeOpacity={0.7} hitSlop={10} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#AEEF4D' }}>{tr.watch_reconnect || 'Reconnecter'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </GlassCard></View>
        )}

        {Platform.OS === 'ios' && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}><GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: sectionTitleColor, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.calendar_section_title || 'Planification'}</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: calSyncEnabled ? 16 : 0 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.calendar_sync_toggle || 'Synchroniser avec mon agenda'}</Text>
                <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 2 }}>{tr.calendar_sync_sub || 'Crée des événements pour tes séances dans l’app Calendrier'}</Text>
              </View>
              <TouchableOpacity
                onPress={handleCalendarToggle}
                disabled={calBusy}
                accessibilityRole="switch"
                accessibilityState={{ checked: calSyncEnabled, disabled: calBusy }}
                accessibilityLabel={tr.calendar_sync_toggle || 'Synchroniser avec mon agenda'}
                style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: calSyncEnabled ? '#AEEF4D' : 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 2, opacity: calBusy ? 0.5 : 1 }}
              >
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#ffffff', alignSelf: calSyncEnabled ? 'flex-end' : 'flex-start' }} />
              </TouchableOpacity>
            </View>

            {calSyncEnabled && (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.calendar_preferred_time || 'Heure préférée'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={function() {
                      var h = Math.max(5, calPreferredHour - 1);
                      updateCalendarPref({ preferredHour: h });
                    }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18, color: '#AEEF4D', fontWeight: '700' }}>{'−'}</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, minWidth: 50, textAlign: 'center' }}>{calPreferredHour}h00</Text>
                    <TouchableOpacity onPress={function() {
                      var h = Math.min(22, calPreferredHour + 1);
                      updateCalendarPref({ preferredHour: h });
                    }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18, color: '#AEEF4D', fontWeight: '700' }}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 10 }}>{tr.calendar_default_duration || 'Durée par défaut'}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[15, 20, 30, 45].map(function(d) {
                      var active = calDuration === d;
                      return (
                        <TouchableOpacity
                          key={'cal-dur-' + d}
                          onPress={function() { updateCalendarPref({ defaultDurationMin: d }); }}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: active ? 'rgba(174,239,77,0.22)' : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: active ? 'rgba(174,239,77,0.55)' : 'rgba(255,255,255,0.10)' }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#AEEF4D' : theme.colors.text }}>{d}{tr.calendar_min_short || ' min'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {calCalendars && calCalendars.length > 0 && (
                  <View style={{ marginBottom: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, color: theme.colors.textSecondary, flex: 1, paddingRight: 12 }}>{tr.calendar_target_calendar || 'Calendrier cible'}</Text>
                      <TouchableOpacity
                        onPress={function() { setCalPickerOpen(function(v) { return !v; }); }}
                        activeOpacity={0.75}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(174,239,77,0.10)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.30)' }}
                      >
                        <Text style={{ fontSize: 13, color: '#AEEF4D', fontWeight: '700' }} numberOfLines={1}>
                          {(function() {
                            var c = calCalendars.find(function(x) { return x.id === calCalendarId; });
                            return (c && c.title) || (tr.calendar_default_calendar || 'Par défaut');
                          })()}
                        </Text>
                        <Icon name={calPickerOpen ? 'chevron_up' : 'chevron_down'} size={12} color="#AEEF4D" strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                    {calPickerOpen && (
                      <View style={{ marginTop: 10, gap: 6 }}>
                        {calCalendars.map(function(c) {
                          var active = c.id === calCalendarId;
                          return (
                            <TouchableOpacity
                              key={c.id}
                              onPress={function() { updateCalendarPref({ calendarId: c.id }); setCalPickerOpen(false); }}
                              activeOpacity={0.8}
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: active ? 'rgba(174,239,77,0.14)' : 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: active ? 'rgba(174,239,77,0.40)' : 'rgba(255,255,255,0.08)' }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color || '#AEEF4D' }} />
                                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text, flex: 1 }} numberOfLines={1}>{c.title}</Text>
                                {c.source ? (
                                  <Text style={{ fontSize: 11, color: theme.colors.textTertiary }} numberOfLines={1}>{c.source}</Text>
                                ) : null}
                              </View>
                              {active ? <Text style={{ fontSize: 14, color: '#AEEF4D', marginLeft: 8 }}>✓</Text> : null}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </GlassCard></View>
        )}

        {/* Apparence — segmented Auto/Clair/Sombre. Lives high in the
            screen so it's easy to find. The active segment uses the brand
            accent substrate; theme switches happen instantly via context,
            the ThemeProvider's cross-fade handles the visual transition. */}
        <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: sectionTitleColor, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.appearance_section || 'Apparence'}</Text>
            <View style={{ flexDirection: 'row', borderRadius: 14, padding: 4, backgroundColor: theme.mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: theme.colors.hairline }}>
              {THEME_MODES.map(function(m) {
                var active = themeMode === m;
                var label = (
                  m === 'auto' ? (tr.appearance_auto || 'Automatique')
                  : m === 'light' ? (tr.appearance_light || 'Clair')
                  : (tr.appearance_dark || 'Sombre')
                );
                var iconKey = m === 'auto' ? 'auto_theme' : m === 'light' ? 'sun' : 'moon';
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={function() { setThemeMode(m); }}
                    activeOpacity={0.85}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={label}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 11,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active
                        ? (theme.mode === 'light' ? 'rgba(91,168,0,0.18)' : 'rgba(174,239,77,0.18)')
                        : 'transparent',
                      borderWidth: active ? 1 : 0,
                      borderColor: active ? theme.colors.accent : 'transparent',
                    }}
                  >
                    <View style={{ marginBottom: 4 }}>
                      <Icon name={iconKey} size={16} color={active ? theme.colors.accentText : theme.colors.textSecondary} strokeWidth={1.8} />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: active ? '700' : '500', color: active ? theme.colors.accentText : theme.colors.textSecondary }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ fontSize: 11, color: theme.colors.textTertiary, marginTop: 10, lineHeight: 16 }}>
              {tr.appearance_hint || 'Automatique suit le réglage iOS.'}
            </Text>
          </GlassCard>
        </View>

        <View style={{ marginHorizontal: 20, marginBottom: 16 }}><GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: sectionTitleColor, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.dl_title || 'Téléchargements'}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.dl_storage || 'Espace utilisé'}</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text }}>{storageUsed}</Text>
          </View>
          <TouchableOpacity onPress={function() {
            Alert.alert(tr.dl_confirm_delete_all || 'Supprimer tous les téléchargements ?', '', [
              { text: tr.reset_cancel || 'Annuler', style: 'cancel' },
              { text: tr.dl_delete_all || 'Tout supprimer', style: 'destructive', onPress: async function() {
                try {
                  var { deleteAllDownloads } = require('../components/DownloadManager');
                  await deleteAllDownloads();
                  setStorageUsed('0 B');
                } catch(e) {}
              }},
            ]);
          }} style={{ paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,50,50,0.1)', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,90,90,0.9)' }}>{tr.dl_delete_all || 'Tout supprimer'}</Text>
          </TouchableOpacity>
        </GlassCard></View>

        <SectionHeader sectionKey="account" label={sectionLabel('account')} />
        <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 12, letterSpacing: -0.2 }}>{tr.subscription_status_label}</Text>
            <Text style={{ fontSize: 15, fontWeight: '400', color: '#AEEF4D', marginBottom: 16 }}>{isAdmin ? 'Admin · accès complet' : (isSubscriber ? tr.subscription_status_active : tr.subscription_status_free)}</Text>
            <TouchableOpacity onPress={onRestorePurchases} accessibilityRole="button" accessibilityLabel={tr.subscription_reset} style={{ paddingVertical: 13, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.10)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.22)', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>{tr.subscription_reset}</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>

        {supaUser && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}><GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text }}>{tr.profile_section_personal || tr.profile_card_title || 'Mes infos personnelles'}</Text>
              <TouchableOpacity
                onPress={function() {
                  if (onEditProfile) {
                    onEditProfile({
                      prenom: prenom || '',
                      gender: profileData.gender,
                      birth_date: profileData.birth_date,
                      height_cm: profileData.height_cm,
                      weight_kg: profileData.weight_kg,
                      practice_level: profileData.practice_level,
                      frequency: profileData.frequency,
                      goals: profileData.goals,
                    });
                  } else {
                    startProfileEdit();
                  }
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.accentText }}>{tr.profile_edit_btn || 'Modifier'}</Text>
              </TouchableOpacity>
            </View>

            {!profileEditMode ? (
              <View>
                {/* Identité */}
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.accentText, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 }}>
                  {tr.profile_section_identity || 'Identité'}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.colors.hairline }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.profile_gender_label || 'Genre'}</Text>
                  <Text style={{ fontSize: 14, color: theme.colors.accentText }}>{genderLabel(profileData.gender)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.colors.hairline }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.profile_birth_label || 'Date de naissance'}</Text>
                  <Text style={{ fontSize: 14, color: theme.colors.accentText }}>{formatBirth(profileData.birth_date)}</Text>
                </View>

                {/* Mesures */}
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.accentText, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 14, marginBottom: 4 }}>
                  {tr.profile_section_measures || 'Mesures'}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.colors.hairline }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.profile_height_label || 'Taille (cm)'}</Text>
                  <Text style={{ fontSize: 14, color: theme.colors.accentText }}>{profileData.height_cm != null ? profileData.height_cm + ' cm' : (tr.profile_not_set || 'Non renseigné')}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.colors.hairline }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.profile_weight_label || 'Poids (kg)'}</Text>
                  <Text style={{ fontSize: 14, color: theme.colors.accentText }}>{profileData.weight_kg != null ? profileData.weight_kg + ' kg' : (tr.profile_not_set || 'Non renseigné')}</Text>
                </View>

                {/* Pratique */}
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.accentText, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 14, marginBottom: 4 }}>
                  {tr.profile_section_practice || 'Pratique'}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.colors.hairline }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.profile_practice_level || 'Niveau'}</Text>
                  <Text style={{ fontSize: 14, color: theme.colors.accentText }}>{practiceLabel(profileData.practice_level)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.colors.hairline }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.profile_frequency || 'Fréquence'}</Text>
                  <Text style={{ fontSize: 14, color: theme.colors.accentText }}>{frequencyLabel(profileData.frequency)}</Text>
                </View>

                {/* Objectifs */}
                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.accentText, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 14, marginBottom: 4 }}>
                  {tr.profile_section_goals || 'Objectifs'}
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{tr.profile_goals || 'Objectifs'}</Text>
                  <Text style={{ fontSize: 14, color: theme.colors.accentText, flex: 1, textAlign: 'right' }} numberOfLines={2}>{goalsLabel(profileData.goals)}</Text>
                </View>
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase', marginTop: 4, marginBottom: 8 }}>{tr.profile_gender_label || 'Genre'}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  {[
                    { key: 'female', label: tr.profile_gender_female || 'Femme' },
                    { key: 'male', label: tr.profile_gender_male || 'Homme' },
                    { key: 'other', label: tr.profile_gender_other || 'Autre' },
                  ].map(function(g) {
                    var active = editGender === g.key;
                    return (
                      <TouchableOpacity key={g.key} activeOpacity={0.85} onPress={function() { setEditGender(g.key); }} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: active ? 'rgba(174,239,77,0.18)' : 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.12)' }}>
                        <Text style={{ fontSize: 13, fontWeight: active ? '700' : '500', color: active ? '#AEEF4D' : 'rgba(255,255,255,0.78)' }}>{g.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{tr.profile_birth_label || 'Date de naissance'}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  <TextInput value={editD} onChangeText={setEditD} accessibilityLabel={tr.a11y_birth_day_input || 'Jour de naissance'} placeholder={tr.profile_birth_ph_d || 'JJ'} placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="number-pad" maxLength={2} style={{ flex: 1, height: 44, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, color: theme.colors.text, fontSize: 15, paddingHorizontal: 12, textAlign: 'center' }} />
                  <TextInput value={editM} onChangeText={setEditM} accessibilityLabel={tr.a11y_birth_month_input || 'Mois de naissance'} placeholder={tr.profile_birth_ph_m || 'MM'} placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="number-pad" maxLength={2} style={{ flex: 1, height: 44, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, color: theme.colors.text, fontSize: 15, paddingHorizontal: 12, textAlign: 'center' }} />
                  <TextInput value={editY} onChangeText={setEditY} accessibilityLabel={tr.a11y_birth_year_input || 'Année de naissance'} placeholder={tr.profile_birth_ph_y || 'AAAA'} placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="number-pad" maxLength={4} style={{ flex: 1.4, height: 44, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, color: theme.colors.text, fontSize: 15, paddingHorizontal: 12, textAlign: 'center' }} />
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 18 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{tr.profile_height_label || 'Taille (cm)'}</Text>
                    <TextInput value={editHeight} onChangeText={setEditHeight} accessibilityLabel={tr.a11y_height_cm_input || 'Taille en centimètres'} placeholder="170" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="number-pad" maxLength={3} style={{ height: 44, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, color: theme.colors.text, fontSize: 15, paddingHorizontal: 12, textAlign: 'center' }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>{tr.profile_weight_label || 'Poids (kg)'}</Text>
                    <TextInput value={editWeight} onChangeText={setEditWeight} accessibilityLabel={tr.a11y_weight_kg_input || 'Poids en kilogrammes'} placeholder="65" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="number-pad" maxLength={3} style={{ height: 44, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, color: theme.colors.text, fontSize: 15, paddingHorizontal: 12, textAlign: 'center' }} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <GlassButton
                      onPress={function() { setProfileEditMode(false); }}
                      disabled={profileSaving}
                      size="sm"
                      textColor="rgba(255,255,255,0.7)"
                      textStyle={{ fontSize: 14, fontWeight: '600' }}
                    >
                      {tr.profile_cancel_btn || 'Annuler'}
                    </GlassButton>
                  </View>
                  <View style={{ flex: 1.4 }}>
                    <GlassButton
                      onPress={saveProfileEdit}
                      loading={profileSaving}
                      size="sm"
                      textColor="#AEEF4D"
                      textStyle={{ fontSize: 14, fontWeight: '800' }}
                    >
                      {profileSaving ? '…' : (tr.profile_save_btn || 'Enregistrer')}
                    </GlassButton>
                  </View>
                </View>
              </View>
            )}
          </GlassCard></View>
        )}

        {!supaUser && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            <TouchableOpacity onPress={function() {
              Alert.alert(
                tr.reset_title || 'R\u00E9initialiser',
                tr.reset_confirm || 'Toutes tes donn\u00E9es seront effac\u00E9es : progression, nom de m\u00E9duse, pr\u00E9nom. Cette action est irr\u00E9versible.',
                [
                  { text: tr.reset_cancel || 'Annuler', style: 'cancel' },
                  { text: tr.reset_ok || 'R\u00E9initialiser', style: 'destructive', onPress: function() { if (onReset) onReset(); } },
                ]
              );
            }} style={{ paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,50,50,0.15)', borderWidth: 1, borderColor: 'rgba(255,80,80,0.35)', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,90,90,1)' }}>{tr.reset_btn || 'R\u00E9initialiser toutes les donn\u00E9es'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {supaUser && onLogout && (
          <View style={{ marginHorizontal: 20, marginTop: 40, marginBottom: 16 }}>
            <GlassButton
              onPress={onLogout}
              textColor="#AEEF4D"
              leftIcon={
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 3H6a2 2 0 00-2 2v14a2 2 0 002 2h3" stroke="#AEEF4D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M16 17l5-5-5-5" stroke="#AEEF4D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M21 12H10" stroke="#AEEF4D" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              }
            >
              Se déconnecter
            </GlassButton>
          </View>
        )}

        {/*
          Danger Zone — Apple guideline 5.1.1(v) requires in-app account
          deletion. Shown only when the user actually has a server-side
          account (anonymous/local users have nothing to delete server-
          side; they get the "Réinitialiser toutes les données" button
          above instead). The double-confirm flow lives in
          startDeleteAccount + confirmDeleteAccount.
        */}
        {supaUser && (
          <View style={{ marginHorizontal: 20, marginBottom: 48 }}>
            <View style={{
              padding: 18,
              borderRadius: 16,
              backgroundColor: 'rgba(255,50,50,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(255,80,80,0.3)',
            }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: 'rgba(255,120,120,0.95)', marginBottom: 8, letterSpacing: 0.3 }}>
                {tr.delete_account_section_title || 'Zone dangereuse'}
              </Text>
              <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', lineHeight: 18, marginBottom: 14 }}>
                {tr.delete_account_warning || 'Cette action est définitive.'}
              </Text>
              <TouchableOpacity
                onPress={startDeleteAccount}
                disabled={deletingAccount}
                activeOpacity={0.85}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,50,50,0.18)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,80,80,0.45)',
                  alignItems: 'center',
                  opacity: deletingAccount ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: 'rgba(255,110,110,1)' }}>
                  {tr.delete_account_btn || 'Supprimer mon compte'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <SectionHeader sectionKey="about" label={sectionLabel('about')} />

        <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 14, letterSpacing: -0.2 }}>{tr.mon_compte}</Text>
            {supaUser && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>Email</Text>
                <Text style={{ fontSize: 14, color: '#AEEF4D' }} numberOfLines={1}>{supaUser.email}</Text>
              </View>
            )}
            {tr.compte_info.map(function(item, i) {
              return (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: i < tr.compte_info.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>{item[0]}</Text>
                  <Text style={{ fontSize: 14, color: '#AEEF4D' }}>{item[1]}</Text>
                </View>
              );
            })}
          </GlassCard>
        </View>

        <View style={{ marginHorizontal: 20, marginBottom: 16 }}><GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 12 }}>{tr.profil_donnees_title || 'Confidentialité'}</Text>
          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20, marginBottom: 14 }}>{tr.profil_donnees_desc || 'Vos données restent sur votre appareil. Aucune donnée personnelle n\'est envoyée à des serveurs tiers. Les séances, la progression et les préférences sont stockées localement via AsyncStorage. Si vous vous connectez, seul votre email est synchronisé via Supabase pour sauvegarder votre profil.'}</Text>
          <View style={{ borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="lock" size={14} color="rgba(174,239,77,0.7)" />
              <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.7)', flex: 1 }}>{tr.profil_donnees_local || 'Données stockées localement sur votre appareil'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="no_tracking" size={14} color="rgba(174,239,77,0.7)" />
              <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.7)', flex: 1 }}>{tr.profil_donnees_no_tracking || 'Aucun tracking publicitaire'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="apple" size={14} color="rgba(174,239,77,0.7)" />
              <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.7)', flex: 1 }}>{tr.profil_donnees_healthkit || 'HealthKit : données lues uniquement, jamais partagées'}</Text>
            </View>
          </View>
        </GlassCard></View>

        <View style={{ marginHorizontal: 20, marginBottom: 16 }}><GlassCard intensity={55} padding={20} borderRadius={GLASS_RADII.card}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: sectionTitleColor, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.dev_title || 'Développeur'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 70, height: 70, borderRadius: 35, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D', marginRight: 14 }}>
              <ExpoImage source={DEV_IMAGE} contentFit="cover" cachePolicy="memory-disk" style={{ flex: 1 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text }}>{tr.dev_name || 'Yvan'}</Text>
              <Text style={{ fontSize: 12, color: '#AEEF4D', marginTop: 2 }}>{tr.dev_subtitle || 'Fondateur · Ingénieur & Spécialiste Pilates'}</Text>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.85} onPress={function() { setShowDevBio(true); }} style={{ paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.dev_more || 'En savoir plus'}</Text>
          </TouchableOpacity>
        </GlassCard></View>

        <Modal visible={showDevBio} animationType="slide" transparent statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,14,24,0.6)', justifyContent: 'center' }}>
            <View style={{ marginHorizontal: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', maxHeight: Dimensions.get('window').height * 0.8, shadowColor: '#ffffff', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
              <BlurView intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={{ backgroundColor: 'rgba(10,20,35,0.6)', padding: 24 }}>
                <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']} locations={[0, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%' }} pointerEvents="none" />
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 90, height: 90, borderRadius: 45, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D', marginBottom: 12 }}>
                    <ExpoImage source={DEV_IMAGE} contentFit="cover" cachePolicy="memory-disk" style={{ flex: 1 }} />
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text }}>{tr.dev_name || 'Yvan'}</Text>
                  <Text style={{ fontSize: 13, color: '#AEEF4D', marginTop: 4 }}>{tr.dev_subtitle || 'Fondateur · Ingénieur & Spécialiste Pilates'}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '300', color: 'rgba(255,255,255,0.8)', lineHeight: 22 }}>{tr.dev_full_bio || ''}</Text>
              </ScrollView>
              <TouchableOpacity onPress={function() { setShowDevBio(false); }} style={{ marginTop: 18, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.15)', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>Fermer</Text>
              </TouchableOpacity>
              </BlurView>
            </View>
          </View>
        </Modal>

        {__DEV__ && (
          <View style={{ marginHorizontal: 20, marginBottom: 48, padding: 16, borderWidth: 1, borderColor: 'rgba(255,200,0,0.4)', borderRadius: 12 }}>
            <Text style={{ color: '#FFCC00', fontSize: 12, marginBottom: 8, fontWeight: '700', letterSpacing: 1 }}>DEV ONLY</Text>
            <TouchableOpacity
              onPress={async () => {
                await AsyncStorage.removeItem('fluid_hk_prompt_done');
                Alert.alert('OK', 'Flag HealthKit prompt resetté. Relance l\'app pour voir l\'écran.');
              }}
              style={{ padding: 12, backgroundColor: 'rgba(255,200,0,0.15)', borderRadius: 8 }}
            >
              <Text style={{ color: '#FFCC00' }}>Reset HealthKit prompt flag</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/*
        Account deletion — typed-confirm modal (step 2 of the double
        confirm). User must type the localized confirmation word
        (FR: SUPPRIMER, EN: DELETE) before the destructive button is
        enabled. Cross-platform Modal (rather than Alert.prompt which is
        iOS-only) so the same UX ships on Android too.
      */}
      <Modal
        visible={deleteConfirmOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={function() { if (!deletingAccount) setDeleteConfirmOpen(false); }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,8,18,0.85)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,80,80,0.35)' }}>
            <BlurView intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={{ padding: 24, backgroundColor: 'rgba(20,8,12,0.78)' }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,120,120,0.95)', letterSpacing: 3, fontWeight: '700', marginBottom: 8 }}>
                {(tr.delete_account_section_title || 'ZONE DANGEREUSE').toUpperCase()}
              </Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 12, letterSpacing: -0.3 }}>
                {tr.delete_account_type_title || 'Dernière confirmation'}
              </Text>
              <Text style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.78)', lineHeight: 20, marginBottom: 16 }}>
                {tr.delete_account_type_confirm || 'Tape SUPPRIMER pour confirmer.'}
              </Text>
              <TextInput
                value={deleteConfirmInput}
                onChangeText={setDeleteConfirmInput}
                editable={!deletingAccount}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                placeholder={tr.delete_account_type_placeholder || 'SUPPRIMER'}
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,80,80,0.35)',
                  color: '#ffffff',
                  fontSize: 16,
                  fontWeight: '600',
                  letterSpacing: 1.5,
                  marginBottom: 18,
                }}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={function() {
                    if (deletingAccount) return;
                    setDeleteConfirmOpen(false);
                    setDeleteConfirmInput('');
                  }}
                  disabled={deletingAccount}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    paddingVertical: 13,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.12)',
                    alignItems: 'center',
                    opacity: deletingAccount ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 13.5, fontWeight: '600' }}>
                    {tr.delete_account_cancel || 'Annuler'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmDeleteAccount}
                  disabled={deletingAccount || (deleteConfirmInput || '').trim().toUpperCase() !== (tr.delete_account_type_word || 'SUPPRIMER').toUpperCase()}
                  activeOpacity={0.85}
                  style={{
                    flex: 1.4,
                    paddingVertical: 13,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255,50,50,0.22)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,80,80,0.55)',
                    alignItems: 'center',
                    opacity: (deletingAccount || (deleteConfirmInput || '').trim().toUpperCase() !== (tr.delete_account_type_word || 'SUPPRIMER').toUpperCase()) ? 0.4 : 1,
                  }}
                >
                  <Text style={{ color: 'rgba(255,110,110,1)', fontSize: 13.5, fontWeight: '700' }}>
                    {deletingAccount ? (tr.delete_account_loading || 'Suppression…') : (tr.delete_account_final_btn || 'Supprimer définitivement')}
                  </Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        </View>
      </Modal>

      <Modal visible={coachModeVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={function() { setCoachModeVisible(false); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,8,18,0.85)', justifyContent: 'center', paddingHorizontal: 20 }}>
          <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
            <BlurView intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={{ padding: 24, backgroundColor: 'rgba(10,20,35,0.7)' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.85)', letterSpacing: 3, fontWeight: '700' }}>COACH MODE</Text>
                <TouchableOpacity onPress={function() { setCoachModeVisible(false); }} hitSlop={10}>
                  <Icon name="close" size={16} color="rgba(255,255,255,0.7)" strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 4, letterSpacing: -0.3 }}>Outils admin</Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 18 }}>{coachModeStats && coachModeStats.adminEmail ? coachModeStats.adminEmail : 'Admin'}</Text>

              {coachModeStats && (
                <View style={{ marginBottom: 18, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Séances cochées</Text>
                    <Text style={{ color: '#AEEF4D', fontSize: 13, fontWeight: '700' }}>{coachModeStats.totalDone}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Streak</Text>
                    <Text style={{ color: '#AEEF4D', fontSize: 13, fontWeight: '700' }}>{coachModeStats.streak} j</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Minutes cumulées</Text>
                    <Text style={{ color: '#AEEF4D', fontSize: 13, fontWeight: '700' }}>{coachModeStats.totalMin}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Clés AsyncStorage</Text>
                    <Text style={{ color: '#AEEF4D', fontSize: 13, fontWeight: '700' }}>{coachModeStats.fluidKeysCount}</Text>
                  </View>
                </View>
              )}

              <View style={{ gap: 10 }}>
                <TouchableOpacity onPress={coachActionResetMilestones} activeOpacity={0.85} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Reset jalons "déjà vus"</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={coachActionForceBreath} activeOpacity={0.85} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Marquer respiration faite</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={coachActionResetCoachWelcome} activeOpacity={0.85} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                  <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Réarmer Coach welcome overlay</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 18, textAlign: 'center', letterSpacing: 1 }}>
                Easter egg admin · 5 taps sur le pavé prénom
              </Text>
            </BlurView>
          </View>
        </View>
      </Modal>

      {/* Modal de pairage Apple TV — lazy require, ne tape pas
          expo-camera tant que l'utilisateur n'a pas demandé. */}
      {showPairTv && _PairAppleTV ? (
        <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={function() { setShowPairTv(false); }}>
          {(function() {
            var Comp = _PairAppleTV;
            return (
              <Comp
                lang={lang}
                supaUser={supaUser}
                onClose={function() { setShowPairTv(false); }}
              />
            );
          })()}
        </Modal>
      ) : null}
    </View>
  );
}

export default ProfilScreen;
