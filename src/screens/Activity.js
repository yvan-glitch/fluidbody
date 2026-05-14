// ActivityScreen — Apple-Fitness-style daily activity view.
//
// Sources:
//   • HealthKit (via src/utils/healthkit.js) for the three rings, daily
//     details (steps, distance, FC, etc.), workouts, and the week strip.
//   • profiles.ring_goal_* in Supabase (mirrored in AsyncStorage) for the
//     per-user goals.
//   • profiles.rings_streak_count / rings_streak_last_date for streak.
//
// Memory model:
//   We cache HK reads in a 60s memory bag so scrolling never re-polls,
//   but a pull-to-refresh always invalidates. Date navigation invalidates
//   the bag (different day → different read).
//
// Streak rule:
//   A day "closes" when all three rings reach their goal (>= 1.0). We
//   tick the streak forward at most once per day; missing a day resets
//   it to 0 (matching Apple's all-or-nothing logic on the closed-rings
//   stat). Streak is persisted both locally and remotely via profileSync.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Animated, Easing, RefreshControl,
  Dimensions, StyleSheet, Platform, Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { T } from '../constants/data';
import { GlassCard, GlassButton, GlassSheet, GlassView, GLASS_RADII } from '../components/ui';
import { useTheme } from '../theme/ThemeProvider';
import LivingBackground from '../components/LivingBackground';
import { FloatingMedusas, Bulle, BULLES, MeduseCornerIcon } from '../components/Meduse';
import Confetti from '../components/Confetti';
import ActivityRings, { MiniActivityRings, RING_COLORS } from '../components/ActivityRings';
import healthkit from '../utils/healthkit';
import { syncProfilePatch, readCachedProfile } from '../utils/profileSync';

const { width: SW } = Dimensions.get('window');

const DEFAULT_GOALS = { move: 350, exercise: 30, stand: 12 };

const CACHE_TTL_MS = 60 * 1000;
const dailyCache = new Map(); // key: YYYY-MM-DD → { ts, summary, details, workouts }
const historyCache = { ts: 0, data: null };

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function dayKeyFromDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDateLabel(d, tr, isToday, isYesterday) {
  if (isToday) return tr.activity_today || 'Today';
  if (isYesterday) return tr.activity_yesterday || 'Yesterday';
  const day = d.getDate();
  const month = d.toLocaleString(undefined, { month: 'short' });
  return day + ' ' + month;
}

function shortTime(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function ChevronLeft({ color }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ChevronRight({ color }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SmallIcon({ kind, color, size = 18 }) {
  // Minimal line-icons — Footprints, Distance, Flight, Flame, Heart.
  if (kind === 'steps') return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 4c1 0 2 1 2 3s-1 5-2 6-2 0-2-2 1-7 2-7zM14 8c1 0 2 1 2 3s-1 5-2 6-2 0-2-2 1-7 2-7zM4 17h4v3H4zM12 21h4v3h-4z" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
  if (kind === 'distance') return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l9 4-9 4-9-4 9-4zM3 11l9 4 9-4M3 15l9 4 9-4" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
  if (kind === 'flights') return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20h4v-4h4v-4h4V8h4V4" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
  if (kind === 'flame') return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3c1.5 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1.5-3.5 3-5-.5 2 .5 3 2 3 0-3-1-5 0-7z" stroke={color} strokeWidth={1.4} fill="none" strokeLinejoin="round" />
    </Svg>
  );
  if (kind === 'heart') return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" stroke={color} strokeWidth={1.4} fill="none" strokeLinejoin="round" />
    </Svg>
  );
  if (kind === 'edit') return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20h8M4 20l4-1L18 9l-3-3L5 16z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
  return null;
}

function MetricRow({ icon, label, value, sub, color }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
      <View style={{ width: 28, alignItems: 'center', marginRight: 12 }}>
        <SmallIcon kind={icon} color={color} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '500', color: color }}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: color, letterSpacing: -0.2 }}>{value}</Text>
        {sub ? <Text style={{ fontSize: 11, color: color, opacity: 0.6 }}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ───────── Sparkline ─────────
function Sparkline({ data, color, max, height = 36 }) {
  const width = SW - 80;
  const n = data.length;
  if (n < 2) return <View style={{ width, height }} />;
  const ceil = Math.max(max, 1, ...data);
  const stepX = width / (n - 1);
  const points = data.map(function (v, i) {
    const x = i * stepX;
    const y = height - (v / ceil) * (height - 4) - 2;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ───────── Detail bottom-sheet ─────────
function RingDetailSheet({ visible, ringName, values, goals, history, onClose, tr, colors }) {
  if (!visible) return null;
  const color = RING_COLORS[ringName] || RING_COLORS.move;
  const labelMap = {
    move:     { title: tr.activity_ring_move || 'Move',         unit: tr.activity_unit_kcal || 'kcal' },
    exercise: { title: tr.activity_ring_exercise || 'Exercise', unit: tr.activity_unit_min || 'min' },
    stand:    { title: tr.activity_ring_stand || 'Stand',       unit: tr.activity_unit_hrs || 'hrs' },
  };
  const value = values[ringName];
  const goal = goals[ringName];
  const pct = Math.round((value / Math.max(1, goal)) * 100);
  const meta = labelMap[ringName];
  const dowLabels = tr.activity_dow_short || ['M','T','W','T','F','S','S'];
  const last7 = history.slice(-7).map(function (h) { return h[ringName + ((ringName === 'move' || ringName === 'exercise') ? (ringName === 'move' ? 'Kcal' : 'Min') : 'Hours')]; });
  const last7Max = Math.max(goal, ...last7, 1);
  return (
    <Modal visible animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <GlassSheet onClose={onClose}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color.glow, marginRight: 10 }} />
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 }}>{meta.title}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 }}>
            <Text style={{ fontSize: 44, fontWeight: '300', color: color.glow, letterSpacing: -1 }}>{value || 0}</Text>
            <Text style={{ fontSize: 18, fontWeight: '500', color: colors.textSecondary, marginLeft: 10 }}>/ {goal} {meta.unit}</Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>{pct}%</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>{tr.activity_week || 'This week'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            {last7.map(function (v, i) {
              const h = Math.max(8, Math.round((v / last7Max) * 60));
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={{ width: '100%', height: h, borderRadius: 4, backgroundColor: color.glow, opacity: v >= goal ? 1 : 0.45 }} />
                  <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4 }}>{dowLabels[i]}</Text>
                </View>
              );
            })}
          </View>
        </GlassSheet>
      </View>
    </Modal>
  );
}

// ───────── Goal editor sheet ─────────
function GoalEditorSheet({ visible, goals, onClose, onSave, tr, colors }) {
  const [m, setM] = useState(String(goals.move));
  const [e, setE] = useState(String(goals.exercise));
  const [s, setS] = useState(String(goals.stand));
  useEffect(function () {
    if (visible) {
      setM(String(goals.move));
      setE(String(goals.exercise));
      setS(String(goals.stand));
    }
  }, [visible]);
  if (!visible) return null;
  function commit() {
    const parsed = {
      move: Math.max(50, Math.min(2000, parseInt(m, 10) || DEFAULT_GOALS.move)),
      exercise: Math.max(5, Math.min(300, parseInt(e, 10) || DEFAULT_GOALS.exercise)),
      stand: Math.max(1, Math.min(24, parseInt(s, 10) || DEFAULT_GOALS.stand)),
    };
    onSave(parsed);
  }
  function row(label, color, value, setter, suffix) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 12 }} />
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={setter}
          keyboardType="number-pad"
          maxLength={4}
          style={{
            width: 88,
            height: 44,
            backgroundColor: colors.surface,
            borderColor: colors.hairline,
            borderWidth: 1,
            borderRadius: 12,
            color: colors.text,
            fontSize: 16,
            fontWeight: '700',
            textAlign: 'center',
          }}
        />
        <Text style={{ marginLeft: 10, fontSize: 13, color: colors.textSecondary, width: 36 }}>{suffix}</Text>
      </View>
    );
  }
  return (
    <Modal visible animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <GlassSheet onClose={onClose}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 18, letterSpacing: -0.3 }}>
            {tr.activity_goals_title || 'My personal goals'}
          </Text>
          {row(tr.activity_ring_move || 'Move', RING_COLORS.move.glow, m, setM, tr.activity_unit_kcal || 'kcal')}
          {row(tr.activity_ring_exercise || 'Exercise', RING_COLORS.exercise.glow, e, setE, tr.activity_unit_min || 'min')}
          {row(tr.activity_ring_stand || 'Stand', RING_COLORS.stand.glow, s, setS, tr.activity_unit_hrs || 'hrs')}
          <GlassButton onPress={commit} variant="accent" size="lg" style={{ marginTop: 8 }}>
            {tr.activity_goals_save || 'Save'}
          </GlassButton>
        </GlassSheet>
      </View>
    </Modal>
  );
}

// ───────── Main screen ─────────
export default function ActivityScreen({ lang, supabase, supaUser, done }) {
  const tr = T[lang] || T.fr;
  const insets = useSafeAreaInsets();
  const themeCtx = useTheme();
  const theme = themeCtx.theme;
  const colors = theme.colors;

  const [selectedDate, setSelectedDate] = useState(function () { return new Date(); });
  const dateKey = useMemo(function () { return dayKeyFromDate(selectedDate); }, [selectedDate]);
  const isToday = dateKey === todayKey();
  const yKey = (function () { const d = new Date(); d.setDate(d.getDate() - 1); return dayKeyFromDate(d); })();
  const isYesterday = dateKey === yKey;

  const [hkAuthorized, setHkAuthorized] = useState(false);
  const [hkChecked, setHkChecked] = useState(false);
  const [summary, setSummary] = useState({ moveKcal: 0, exerciseMin: 0, standHours: 0 });
  const [details, setDetails] = useState({ steps: 0, distanceKm: 0, flights: 0, totalKcal: 0, avgHr: null, maxHr: null });
  const [workouts, setWorkouts] = useState([]);
  const [history, setHistory] = useState([]); // 30 days for trends + 7 for week strip
  const [refreshing, setRefreshing] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState(null);
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [streakCount, setStreakCount] = useState(0);
  const [streakLastDate, setStreakLastDate] = useState(null);
  const [showRingDetail, setShowRingDetail] = useState(null);
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebratedDate, setCelebratedDate] = useState(null);

  // Header date appearance animation.
  const headerY = useRef(new Animated.Value(8)).current;
  const headerO = useRef(new Animated.Value(0)).current;
  useEffect(function () {
    Animated.parallel([
      Animated.timing(headerO, { toValue: 1, duration: 320, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }),
      Animated.timing(headerY, { toValue: 0, duration: 320, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }),
    ]).start();
  }, [dateKey]);

  // ── HealthKit lifecycle ──
  // Eager seed from the last-good AsyncStorage cache *before* HK init finishes,
  // so the rings render with the previous value within the first frame instead
  // of waiting for the auth handshake (which can take 4–8s on a cold boot).
  // The fresh read still kicks in as soon as init resolves.
  useEffect(function () {
    let cancelled = false;
    AsyncStorage.getItem('fluid_activity_last_good_' + todayKey()).then(function (raw) {
      if (cancelled || !raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.summary) setSummary(parsed.summary);
        if (parsed && parsed.details) setDetails(parsed.details);
        if (parsed && Array.isArray(parsed.workouts)) setWorkouts(parsed.workouts);
      } catch (e) {}
    }).catch(function () {});
    return function () { cancelled = true; };
  }, []);

  useEffect(function () {
    let cancelled = false;
    // If healthkit.js was already initialised earlier (e.g. via MonCorps), skip
    // the redundant requestAuthorization and let the loader run immediately.
    if (healthkit.isHealthKitReady && healthkit.isHealthKitReady()) {
      setHkChecked(true);
      setHkAuthorized(true);
      return function () { cancelled = true; };
    }
    healthkit.ensureHealthKitInit().then(function (res) {
      if (cancelled) return;
      setHkChecked(true);
      setHkAuthorized(!!(res && res.ok));
    });
    return function () { cancelled = true; };
  }, []);

  // ── Load goals + streak from cache ──
  useEffect(function () {
    let cancelled = false;
    readCachedProfile().then(function (cached) {
      if (cancelled) return;
      const next = Object.assign({}, DEFAULT_GOALS);
      if (cached) {
        if (isFinite(cached.ring_goal_move_kcal) && cached.ring_goal_move_kcal > 0) next.move = cached.ring_goal_move_kcal;
        if (isFinite(cached.ring_goal_exercise_min) && cached.ring_goal_exercise_min > 0) next.exercise = cached.ring_goal_exercise_min;
        if (isFinite(cached.ring_goal_stand_hours) && cached.ring_goal_stand_hours > 0) next.stand = cached.ring_goal_stand_hours;
      }
      setGoals(next);
      if (cached && isFinite(cached.rings_streak_count)) setStreakCount(cached.rings_streak_count);
      if (cached && cached.rings_streak_last_date) setStreakLastDate(cached.rings_streak_last_date);
    });
    return function () { cancelled = true; };
  }, []);

  // ── Data loader (per-day) ──
  async function loadForDate(d, force) {
    const key = dayKeyFromDate(d);
    const cached = dailyCache.get(key);
    const now = Date.now();
    if (!force && cached && now - cached.ts < CACHE_TTL_MS) {
      setSummary(cached.summary);
      setDetails(cached.details);
      setWorkouts(cached.workouts);
      setOfflineNotice(null);
      return;
    }
    if (!hkAuthorized) {
      setSummary({ moveKcal: 0, exerciseMin: 0, standHours: 0 });
      setDetails({ steps: 0, distanceKm: 0, flights: 0, totalKcal: 0, avgHr: null, maxHr: null });
      setWorkouts([]);
      return;
    }
    try {
      const [s, det, wks] = await Promise.all([
        healthkit.readActivitySummary(d),
        healthkit.readDayDetails(d),
        healthkit.readDayWorkouts(d),
      ]);
      dailyCache.set(key, { ts: now, summary: s, details: det, workouts: wks });
      setSummary(s); setDetails(det); setWorkouts(wks);
      // Persist a "last good read" for offline display.
      try {
        await AsyncStorage.setItem('fluid_activity_last_good_' + key, JSON.stringify({ ts: now, summary: s, details: det, workouts: wks }));
      } catch (e) {}
      setOfflineNotice(null);
    } catch (e) {
      try {
        const raw = await AsyncStorage.getItem('fluid_activity_last_good_' + key);
        if (raw) {
          const parsed = JSON.parse(raw);
          setSummary(parsed.summary); setDetails(parsed.details); setWorkouts(parsed.workouts);
          setOfflineNotice(shortTime(parsed.ts));
        }
      } catch (e2) {}
    }
  }

  async function loadHistory(force) {
    const now = Date.now();
    if (!force && historyCache.data && now - historyCache.ts < CACHE_TTL_MS) {
      setHistory(historyCache.data);
      return;
    }
    if (!hkAuthorized) {
      setHistory([]);
      return;
    }
    try {
      const data = await healthkit.readActivityHistory(30);
      // Normalise key names for consumer code.
      const norm = data.map(function (d) {
        return {
          date: d.date,
          moveKcal: d.moveKcal,
          exerciseMin: d.exerciseMin,
          standHours: d.standHours,
        };
      });
      historyCache.ts = now;
      historyCache.data = norm;
      setHistory(norm);
    } catch (e) {}
  }

  useEffect(function () {
    if (!hkChecked) return;
    loadForDate(selectedDate, false);
    loadHistory(false);
  }, [hkChecked, hkAuthorized, dateKey]);

  // ── Streak: when *today's* summary closes the rings for the first time. ──
  useEffect(function () {
    if (!isToday) return;
    const moveClosed = summary.moveKcal >= goals.move;
    const exClosed = summary.exerciseMin >= goals.exercise;
    const standClosed = summary.standHours >= goals.stand;
    if (!(moveClosed && exClosed && standClosed)) return;
    if (celebratedDate === dateKey) return;
    const today = todayKey();
    if (streakLastDate === today) return; // already counted
    const yesterday = (function () { const d = new Date(); d.setDate(d.getDate() - 1); return dayKeyFromDate(d); })();
    const nextCount = streakLastDate === yesterday ? streakCount + 1 : 1;
    setStreakCount(nextCount);
    setStreakLastDate(today);
    setCelebratedDate(dateKey);
    setShowCelebration(true);
    syncProfilePatch({
      rings_streak_count: nextCount,
      rings_streak_last_date: today,
    }, { userId: supaUser?.id }).catch(function () {});
  }, [summary.moveKcal, summary.exerciseMin, summary.standHours, goals, isToday, streakLastDate, dateKey, supaUser]);

  // ── Pull-to-refresh ──
  async function onRefresh() {
    setRefreshing(true);
    dailyCache.delete(dateKey);
    historyCache.ts = 0;
    await Promise.all([loadForDate(selectedDate, true), loadHistory(true)]);
    setRefreshing(false);
  }

  // ── Day navigation ──
  function changeDay(deltaDays) {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + deltaDays);
    // Don't navigate to future dates.
    const today = new Date();
    if (next > today) return;
    setSelectedDate(next);
  }

  function saveGoals(next) {
    setGoals(next);
    setShowGoalEditor(false);
    syncProfilePatch({
      ring_goal_move_kcal: next.move,
      ring_goal_exercise_min: next.exercise,
      ring_goal_stand_hours: next.stand,
    }, { userId: supaUser?.id }).catch(function () {});
  }

  // Today's fluidbody sessions (read from `done` flat count + cached calendar).
  const fluidbodyTodaySessions = useMemo(function () {
    if (!isToday) return 0;
    try {
      // We don't have per-day session log without HK workouts, so we count
      // matching Pilates HK workouts authored today — that's the closest
      // proxy that's also accurate when the user did multiple sessions.
      return workouts.filter(function (w) {
        const a = (w.activity || '').toString().toLowerCase();
        return a.includes('pilates') || a.includes('mindand') || a.includes('functionalstrength');
      }).length;
    } catch (e) { return 0; }
  }, [workouts, isToday]);

  const last7History = history.slice(-7);
  const trends30 = useMemo(function () {
    return {
      move: history.map(function (h) { return h.moveKcal; }),
      exercise: history.map(function (h) { return h.exerciseMin; }),
      stand: history.map(function (h) { return h.standHours; }),
    };
  }, [history]);

  const dateLabel = formatDateLabel(selectedDate, tr, isToday, isYesterday);

  // ── Render ──
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={colors.bgGradient} locations={colors.bgGradientStops} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map(function (b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 56 + insets.top, paddingBottom: 140 }}
        refreshControl={<RefreshControl tintColor={colors.text} refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header: title + date stepper + streak */}
        <View style={{ paddingHorizontal: 22, marginBottom: 18 }}>
          <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
            {tr.activity_title || 'Activity'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Pressable onPress={function () { changeDay(-1); }} hitSlop={10} style={{ marginRight: 6, opacity: 0.8 }}>
              <ChevronLeft color={colors.textSecondary} />
            </Pressable>
            <Animated.Text style={{ fontSize: 14, fontWeight: '500', color: colors.textSecondary, opacity: headerO, transform: [{ translateY: headerY }] }}>
              {dateLabel}
            </Animated.Text>
            <Pressable onPress={function () { changeDay(1); }} hitSlop={10} disabled={isToday} style={{ marginLeft: 6, opacity: isToday ? 0.3 : 0.8 }}>
              <ChevronRight color={colors.textSecondary} />
            </Pressable>
            <View style={{ flex: 1 }} />
            {streakCount > 0 ? (
              <GlassView intensity={50} borderRadius={GLASS_RADII.pill} contentStyle={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accentText, letterSpacing: 0.3 }}>
                  {(tr.activity_streak_days || function (n) { return 'Streak · ' + n; })(streakCount)}
                </Text>
              </GlassView>
            ) : null}
          </View>
          {offlineNotice ? (
            <Text style={{ marginTop: 8, fontSize: 11, color: colors.textTertiary, fontStyle: 'italic' }}>
              {(tr.activity_offline || 'Offline · updated at') + ' ' + offlineNotice}
            </Text>
          ) : null}
        </View>

        {/* HK not authorised — empty state with CTA */}
        {hkChecked && !hkAuthorized ? (
          <View style={{ paddingHorizontal: 22, marginBottom: 24 }}>
            <GlassCard padding={20}>
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <MeduseCornerIcon size={64} tint={colors.accentText} breathCycleMs={3000} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 }}>
                {tr.activity_no_hk || 'Connect Apple Health'}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 16 }}>
                {tr.activity_no_hk_sub || 'Allow FluidBody to read your activity to see your rings.'}
              </Text>
              <GlassButton
                variant="accent"
                onPress={function () {
                  healthkit.ensureHealthKitInit().then(function (res) {
                    setHkAuthorized(!!(res && res.ok));
                  });
                }}
              >
                {tr.activity_connect_hk || 'Connect Apple Health'}
              </GlassButton>
            </GlassCard>
          </View>
        ) : null}

        {/* Hero — three rings */}
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <ActivityRings
            size={Math.min(300, SW - 60)}
            strokeWidth={22}
            values={{ move: summary.moveKcal, exercise: summary.exerciseMin, stand: summary.standHours }}
            goals={goals}
            onRingPress={function (name) { setShowRingDetail(name); }}
          />
        </View>

        {/* Numbers under the rings */}
        <View style={{ paddingHorizontal: 22, marginBottom: 22 }}>
          {[
            { key: 'move', label: tr.activity_ring_move || 'Move', unit: tr.activity_unit_kcal || 'kcal', value: summary.moveKcal, goal: goals.move, color: RING_COLORS.move.glow },
            { key: 'exercise', label: tr.activity_ring_exercise || 'Exercise', unit: tr.activity_unit_min || 'min', value: summary.exerciseMin, goal: goals.exercise, color: RING_COLORS.exercise.glow },
            { key: 'stand', label: tr.activity_ring_stand || 'Stand', unit: tr.activity_unit_hrs || 'hrs', value: summary.standHours, goal: goals.stand, color: RING_COLORS.stand.glow },
          ].map(function (row) {
            return (
              <View key={row.key} style={{ flexDirection: 'row', alignItems: 'baseline', paddingVertical: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: row.color, marginRight: 10 }} />
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text }}>{row.label}</Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: row.color, letterSpacing: -0.2 }}>
                  {row.value} <Text style={{ fontWeight: '500', color: colors.textSecondary }}>/ {row.goal} {row.unit}</Text>
                </Text>
              </View>
            );
          })}
        </View>

        {/* Détails du jour */}
        <View style={{ paddingHorizontal: 22, marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            {tr.activity_card_details || 'Today\'s details'}
          </Text>
          <GlassCard padding={6}>
            <View style={{ paddingHorizontal: 10 }}>
              <MetricRow icon="steps" label={tr.activity_steps || 'Steps'} value={details.steps.toLocaleString()} color={colors.text} />
              <View style={{ height: 1, backgroundColor: colors.hairline }} />
              <MetricRow icon="distance" label={tr.activity_distance || 'Distance'} value={details.distanceKm.toFixed(2) + ' km'} color={colors.text} />
              <View style={{ height: 1, backgroundColor: colors.hairline }} />
              <MetricRow icon="flights" label={tr.activity_flights || 'Flights'} value={String(details.flights)} color={colors.text} />
              <View style={{ height: 1, backgroundColor: colors.hairline }} />
              <MetricRow icon="flame" label={tr.activity_total_kcal || 'Total calories'} value={details.totalKcal + ' kcal'} color={colors.text} />
              <View style={{ height: 1, backgroundColor: colors.hairline }} />
              <MetricRow icon="heart" label={(tr.activity_avg_hr || 'Avg HR') + ' / ' + (tr.activity_max_hr || 'Max HR')} value={(details.avgHr || '–') + ' / ' + (details.maxHr || '–')} sub="bpm" color={colors.text} />
            </View>
          </GlassCard>
        </View>

        {/* Séances FluidBody */}
        <View style={{ paddingHorizontal: 22, marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            {tr.activity_seances_today || 'FluidBody sessions'}
          </Text>
          <GlassCard padding={14}>
            {workouts.length === 0 ? (
              <Text style={{ fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', textAlign: 'center', paddingVertical: 18 }}>
                {tr.activity_no_seance || 'No session today'}
              </Text>
            ) : (
              workouts.slice(0, 4).map(function (w, i) {
                return (
                  <View key={w.id || i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < Math.min(workouts.length, 4) - 1 ? 1 : 0, borderBottomColor: colors.hairline }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: theme.glass.substrateAccent, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <SmallIcon kind="flame" color={colors.accentText} size={16} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                        {(w.activity || 'Pilates').replace(/([A-Z])/g, ' $1').trim()}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        {shortTime(w.startDate)} · {w.durationMin || '–'} min{w.energyKcal != null ? ' · ' + w.energyKcal + ' kcal' : ''}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </GlassCard>
        </View>

        {/* Semaine — 7 jours en mini-rings */}
        <View style={{ paddingHorizontal: 22, marginBottom: 16 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            {tr.activity_week || 'This week'}
          </Text>
          <GlassCard padding={14}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {(tr.activity_dow_short || ['M','T','W','T','F','S','S']).map(function (dow, i) {
                const day = last7History[i] || { moveKcal: 0, exerciseMin: 0, standHours: 0 };
                const isCurrent = day.date === dateKey;
                return (
                  <Pressable
                    key={i}
                    onPress={function () {
                      if (!day.date) return;
                      const parts = day.date.split('-');
                      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                      setSelectedDate(d);
                    }}
                    style={{ alignItems: 'center', flex: 1 }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 6 }}>{dow}</Text>
                    <View style={{ borderWidth: isCurrent ? 1.5 : 0, borderColor: colors.accent, borderRadius: 999, padding: isCurrent ? 2 : 3.5 }}>
                      <MiniActivityRings size={26} strokeWidth={3.2} values={{ move: day.moveKcal, exercise: day.exerciseMin, stand: day.standHours }} goals={goals} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        </View>

        {/* Tendances 30j */}
        <View style={{ paddingHorizontal: 22, marginBottom: 18 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            {tr.activity_trends || 'Trends · 30 days'}
          </Text>
          <GlassCard padding={14}>
            {[
              { label: tr.activity_ring_move || 'Move', data: trends30.move, color: RING_COLORS.move.glow, max: goals.move },
              { label: tr.activity_ring_exercise || 'Exercise', data: trends30.exercise, color: RING_COLORS.exercise.glow, max: goals.exercise },
              { label: tr.activity_ring_stand || 'Stand', data: trends30.stand, color: RING_COLORS.stand.glow, max: goals.stand },
            ].map(function (t, i) {
              return (
                <View key={i} style={{ paddingVertical: 8, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: colors.hairline }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: t.color }}>{t.label}</Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      {Math.round(t.data.reduce(function (s, v) { return s + v; }, 0) / Math.max(1, t.data.length))} {t.label === (tr.activity_ring_move || 'Move') ? (tr.activity_unit_kcal || 'kcal') : t.label === (tr.activity_ring_exercise || 'Exercise') ? (tr.activity_unit_min || 'min') : (tr.activity_unit_hrs || 'hrs')}
                    </Text>
                  </View>
                  <Sparkline data={t.data} color={t.color} max={t.max} />
                </View>
              );
            })}
          </GlassCard>
        </View>

        {/* Footer — Modifier mes objectifs */}
        <View style={{ paddingHorizontal: 22, marginBottom: 10 }}>
          <GlassButton variant="subtle" onPress={function () { setShowGoalEditor(true); }} leftIcon={<SmallIcon kind="edit" color={colors.textSecondary} size={16} />}>
            {tr.activity_goals_btn || 'Edit my goals'}
          </GlassButton>
        </View>
      </ScrollView>

      <RingDetailSheet
        visible={!!showRingDetail}
        ringName={showRingDetail}
        values={{ move: summary.moveKcal, exercise: summary.exerciseMin, stand: summary.standHours }}
        goals={goals}
        history={history}
        onClose={function () { setShowRingDetail(null); }}
        tr={tr}
        colors={colors}
      />

      <GoalEditorSheet
        visible={showGoalEditor}
        goals={goals}
        onClose={function () { setShowGoalEditor(false); }}
        onSave={saveGoals}
        tr={tr}
        colors={colors}
      />

      {showCelebration ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,8,18,0.86)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
            <Confetti />
            <View style={{ alignItems: 'center' }}>
              <MeduseCornerIcon size={120} tint="#AEEF4D" breathCycleMs={2200} />
              <Text style={{ fontSize: 30, fontWeight: '900', color: '#ffffff', textAlign: 'center', marginTop: 16, letterSpacing: -0.5 }}>
                {tr.activity_rings_closed || 'Rings closed!'}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 10, marginBottom: 24, lineHeight: 21 }}>
                {tr.activity_rings_closed_sub || 'All three goals reached. Beautiful.'}
              </Text>
              {(streakCount === 7 || streakCount === 30 || streakCount === 100) ? (
                <Text style={{ fontSize: 13, color: '#AEEF4D', textAlign: 'center', marginBottom: 24 }}>
                  {tr['activity_milestone_' + streakCount] || ''}
                </Text>
              ) : null}
              <GlassButton variant="accent" fullWidth={false} onPress={function () { setShowCelebration(false); }} style={{ paddingHorizontal: 40 }}>
                {tr.activity_close_btn || 'Close'}
              </GlassButton>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
