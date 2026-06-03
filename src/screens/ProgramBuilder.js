// ProgramBuilder — 4-step glass flow for generating an algorithmic program.
//
// Steps:
//   0. Goals     — pick 1-2 objectives (tone / flex / posture / recovery /
//                  serenity). Same keys as ProfileOnboarding so we can fall
//                  back to the user's profile.goals on first render.
//   1. Duration  — 2/4/6/8/12 semaines.
//   2. Frequency — 2/3/4/5 séances par semaine.
//   3. Preview   — calendar grid of the generated schedule. The user sees
//                  the same plan that gets persisted (the generator is
//                  deterministic).
//
// Persistence: on tap "Start", we call `createProgram(...)` from
// `utils/programs`. The new program is inserted with `started_at = now()`
// so MonCorps picks it up as the active program immediately.
//
// The component is rendered inline (no Modal wrapper); the parent (MyPrograms)
// decides how to mount/unmount it. Same pattern as TheorieDetailScreen.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Animated, Easing,
  StyleSheet, Dimensions, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { T } from '../constants/data';
import { GlassCard, GlassButton, GlassView, GLASS_RADII } from '../components/ui';
import { useTheme } from '../theme/ThemeProvider';
import LivingBackground from '../components/LivingBackground';
import { Bulle, BULLES_ONBOARDING } from '../components/Meduse';
import { getPiliers, getSeances } from '../utils';
import { generateProgram } from '../utils/programGenerator';
import { createProgram } from '../utils/programs';
import { readCachedProfile } from '../utils/profileSync';

let _HapticsMod = null;
try { _HapticsMod = require('expo-haptics'); } catch (e) {}
function _hapticSelection() {
  if (Platform.OS === 'web' || !_HapticsMod) return;
  try { _HapticsMod.selectionAsync(); } catch (e) {}
}

const { width: SW } = Dimensions.get('window');

const TOTAL_STEPS = 4;

const GOAL_OPTIONS = [
  { key: 'tone',     trKey: 'onb_goal_tone',     fallback: 'Tone' },
  { key: 'flex',     trKey: 'onb_goal_flex',     fallback: 'Flexibility' },
  { key: 'posture',  trKey: 'onb_goal_posture',  fallback: 'Posture' },
  { key: 'recovery', trKey: 'onb_goal_recovery', fallback: 'Recovery' },
  { key: 'serenity', trKey: 'onb_goal_serenity', fallback: 'Serenity' },
];

const DURATION_OPTIONS = [2, 4, 6, 8, 12];
const FREQUENCY_OPTIONS = [2, 3, 4, 5];

const ETAPE_COLORS = {
  'Comprendre': 'rgba(0,220,170,0.92)',
  'Ressentir': 'rgba(100,190,255,0.92)',
  'Préparer': 'rgba(255,200,80,0.92)',
  'Exécuter': 'rgba(255,145,100,0.92)',
  'Évoluer': 'rgba(185,135,255,0.92)',
};

function ChevronLeft({ color, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ProgressPills({ step, total, accent, hairline }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: total }).map(function (_, i) {
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= step ? accent : hairline,
            }}
          />
        );
      })}
    </View>
  );
}

export default function ProgramBuilder({ lang, supabase, supaUser, onClose, onCreated }) {
  const tr = T[lang] || T['fr'];
  const insets = useSafeAreaInsets();
  const theme = useTheme().theme;
  const colors = theme.colors;
  const glass = theme.glass;

  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({});
  const [goals, setGoals] = useState([]);
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const stepO = useRef(new Animated.Value(1)).current;
  const stepY = useRef(new Animated.Value(0)).current;

  // On mount, pre-fill from cached profile (so the user starts on their
  // declared goals, level, frequency without having to re-enter them).
  useEffect(function () {
    let cancelled = false;
    readCachedProfile().then(function (cached) {
      if (cancelled) return;
      setProfile(cached || {});
      if (Array.isArray(cached && cached.goals) && cached.goals.length > 0) {
        setGoals(cached.goals.slice(0, 2));
      }
      // Map "3-4 times" → 3, "5+ times" → 5, "1-2 times" → 2.
      const freq = cached && cached.frequency;
      if (freq === '1-2') setSessionsPerWeek(2);
      else if (freq === '3-4') setSessionsPerWeek(3);
      else if (freq === '5+') setSessionsPerWeek(5);
    });
    return function () { cancelled = true; };
  }, []);

  function animateStepIn() {
    stepO.setValue(0);
    stepY.setValue(12);
    Animated.parallel([
      Animated.timing(stepO, { toValue: 1, duration: 280, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }),
      Animated.timing(stepY, { toValue: 0, duration: 280, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }),
    ]).start();
  }

  function next() {
    _hapticSelection();
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
      animateStepIn();
    } else {
      submit();
    }
  }
  function back() {
    if (step <= 0) {
      if (onClose) onClose();
      return;
    }
    _hapticSelection();
    setStep(step - 1);
    animateStepIn();
  }

  function canAdvance() {
    if (step === 0) return goals.length >= 1;
    if (step === 1) return DURATION_OPTIONS.indexOf(durationWeeks) !== -1;
    if (step === 2) return FREQUENCY_OPTIONS.indexOf(sessionsPerWeek) !== -1;
    return true;
  }

  function toggleGoal(k) {
    _hapticSelection();
    setGoals(function (prev) {
      if (prev.indexOf(k) !== -1) return prev.filter(function (g) { return g !== k; });
      if (prev.length >= 2) return prev; // hard cap at 2
      return prev.concat([k]);
    });
  }

  // Preview is recomputed live as the user changes any input — the
  // generator is fast (pure JS, no I/O) so we don't bother memoising
  // across the whole flow.
  const previewSchedule = useMemo(function () {
    return generateProgram({
      profile,
      goals,
      durationWeeks,
      sessionsPerWeek,
    });
  }, [profile, goals, durationWeeks, sessionsPerWeek]);

  async function submit() {
    setSaving(true);
    setSaveError(null);
    const goalLabel = goals.length > 0 ? (tr['onb_goal_' + goals[0]] || goals[0]) : (tr.program_default_name || 'Programme');
    const res = await createProgram({
      supabase,
      userId: supaUser && supaUser.id,
      profile,
      goals,
      durationWeeks,
      sessionsPerWeek,
      difficulty: profile.practice_level || 'intermediate',
      name: goalLabel,
      start: true,
    });
    setSaving(false);
    if (res.ok) {
      if (onCreated) onCreated(res.program);
      if (onClose) onClose();
    } else {
      setSaveError(res.error || (tr.program_save_failed || 'Could not save program.'));
    }
  }

  const titles = {
    0: tr.program_step_goals_title || 'What are your goals?',
    1: tr.program_step_duration_title || 'How long do you want to commit?',
    2: tr.program_step_frequency_title || 'How many sessions per week?',
    3: tr.program_step_preview_title || 'Your program',
  };
  const subs = {
    0: tr.program_step_goals_sub || 'Pick up to two to shape the plan.',
    1: tr.program_step_duration_sub || 'You can adjust later.',
    2: tr.program_step_frequency_sub || 'A realistic rhythm beats a perfect one.',
    3: tr.program_step_preview_sub || 'Review the journey we generated for you.',
  };

  const piliers = getPiliers(lang);
  const seancesData = getSeances(lang);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={colors.bgGradient} locations={colors.bgGradientStops} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        {BULLES_ONBOARDING.map(function (b, i) { return <Bulle key={'pb-' + i} {...b} />; })}
      </View>

      <View style={{ paddingTop: 12 + insets.top, paddingHorizontal: 20, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Pressable onPress={back} hitSlop={12} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.glass.substrate }}>
            <ChevronLeft color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, marginHorizontal: 14 }}>
            <ProgressPills step={step} total={TOTAL_STEPS} accent={colors.accent} hairline={colors.hairline} />
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.4 }}>
            {(step + 1) + '/' + TOTAL_STEPS}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 130 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: stepO, transform: [{ translateY: stepY }] }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 8, marginTop: 4 }}>
            {titles[step]}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '400', color: colors.textSecondary, lineHeight: 20, marginBottom: 24 }}>
            {subs[step]}
          </Text>

          {step === 0 ? (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accentText, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                  {tr.profile_goals || 'Goals'}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>{goals.length}/2</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {GOAL_OPTIONS.map(function (g) {
                  const active = goals.indexOf(g.key) !== -1;
                  const disabled = !active && goals.length >= 2;
                  const label = tr[g.trKey] || g.fallback;
                  return (
                    <Pressable
                      key={g.key}
                      onPress={function () { if (!disabled) toggleGoal(g.key); }}
                      style={{ width: (SW - 22 * 2 - 10) / 2, opacity: disabled ? 0.4 : 1 }}
                    >
                      <GlassView
                        intensity={active ? 70 : 50}
                        tint={glass.tint}
                        borderRadius={GLASS_RADII.card}
                        substrateColor={active ? glass.substrateAccent : glass.substrate}
                        contentStyle={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}
                        style={active ? { borderWidth: 1.5, borderColor: colors.accent, borderRadius: GLASS_RADII.card } : null}
                      >
                        <Text style={{ fontSize: 15, fontWeight: active ? '800' : '600', color: active ? colors.accentText : colors.text, letterSpacing: -0.1 }}>
                          {label}
                        </Text>
                      </GlassView>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {step === 1 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {DURATION_OPTIONS.map(function (w) {
                const active = durationWeeks === w;
                return (
                  <Pressable
                    key={w}
                    onPress={function () { _hapticSelection(); setDurationWeeks(w); }}
                    style={{ width: (SW - 22 * 2 - 20) / 3 }}
                  >
                    <GlassView
                      intensity={active ? 70 : 50}
                      tint={glass.tint}
                      borderRadius={GLASS_RADII.card}
                      substrateColor={active ? glass.substrateAccent : glass.substrate}
                      contentStyle={{ paddingVertical: 24, alignItems: 'center' }}
                      style={active ? { borderWidth: 1.5, borderColor: colors.accent, borderRadius: GLASS_RADII.card } : null}
                    >
                      <Text style={{ fontSize: 28, fontWeight: '800', color: active ? colors.accentText : colors.text }}>{w}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: active ? colors.accentText : colors.textSecondary, marginTop: 2, letterSpacing: 0.4 }}>
                        {tr.program_weeks_label || 'weeks'}
                      </Text>
                    </GlassView>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {step === 2 ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {FREQUENCY_OPTIONS.map(function (n) {
                const active = sessionsPerWeek === n;
                return (
                  <Pressable
                    key={n}
                    onPress={function () { _hapticSelection(); setSessionsPerWeek(n); }}
                    style={{ flex: 1 }}
                  >
                    <GlassView
                      intensity={active ? 70 : 50}
                      tint={glass.tint}
                      borderRadius={GLASS_RADII.card}
                      substrateColor={active ? glass.substrateAccent : glass.substrate}
                      contentStyle={{ paddingVertical: 24, alignItems: 'center' }}
                      style={active ? { borderWidth: 1.5, borderColor: colors.accent, borderRadius: GLASS_RADII.card } : null}
                    >
                      <Text style={{ fontSize: 28, fontWeight: '800', color: active ? colors.accentText : colors.text }}>{n}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: active ? colors.accentText : colors.textSecondary, marginTop: 2, letterSpacing: 0.4 }}>
                        {tr.program_per_week_label || 'per week'}
                      </Text>
                    </GlassView>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {step === 3 ? (
            <View>
              <GlassCard padded padding={18} style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accentText, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 }}>
                  {tr.program_preview_summary || 'Summary'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {goals.map(function (g) {
                    return (
                      <View key={g} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: glass.substrateAccent, borderWidth: 1, borderColor: colors.accent }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accentText }}>{tr['onb_goal_' + g] || g}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 15, color: colors.text, fontWeight: '600', lineHeight: 22 }}>
                  {durationWeeks} {tr.program_weeks_label || 'weeks'} · {sessionsPerWeek} {tr.program_sessions_per_week_short || 'séances/sem'} · {previewSchedule.length} {tr.program_total_sessions || 'séances au total'}
                </Text>
              </GlassCard>

              {/* Weekly grid */}
              {(function () {
                const byWeek = {};
                previewSchedule.forEach(function (s) {
                  if (!byWeek[s.week]) byWeek[s.week] = [];
                  byWeek[s.week].push(s);
                });
                const weekKeys = Object.keys(byWeek).map(Number).sort(function (a, b) { return a - b; });
                return weekKeys.map(function (w) {
                  const items = byWeek[w];
                  return (
                    <View key={'wk-' + w} style={{ marginBottom: 14 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
                        {(tr.program_week_label || 'Week') + ' ' + w}
                      </Text>
                      <View style={{ gap: 8 }}>
                        {items.map(function (s) {
                          const pil = piliers.find(function (p) { return p.key === s.pilier_key; });
                          const seance = (seancesData[s.pilier_key] || [])[s.session_index];
                          const title = seance ? seance[0] : (pil ? pil.label : s.pilier_key);
                          const dur = seance ? seance[1] : '';
                          const dotColor = ETAPE_COLORS[s.etape] || colors.accent;
                          return (
                            <View key={'sl-' + s.week + '-' + s.day} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: glass.substrate, borderWidth: 1, borderColor: colors.hairline }}>
                              <View style={{ width: 28, alignItems: 'center' }}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textSecondary }}>D{s.day}</Text>
                              </View>
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
                              <View style={{ flex: 1 }}>
                                <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{title}</Text>
                                <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                                  {(pil ? pil.label : s.pilier_key)} · {(tr.etapes && tr.etapes[s.etape]) || s.etape}{dur ? ' · ' + dur : ''}{s.type === 'recovery' ? ' · ' + (tr.program_recovery_tag || 'Récup') : ''}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                });
              })()}

              {saveError ? (
                <Text style={{ fontSize: 13, color: 'rgba(255,120,120,0.95)', textAlign: 'center', marginTop: 12 }}>
                  {saveError}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 22, paddingBottom: 18 + insets.bottom, paddingTop: 10 }}>
        <GlassButton
          variant="accent"
          size="lg"
          disabled={!canAdvance() || saving}
          loading={saving}
          onPress={next}
        >
          {step === TOTAL_STEPS - 1
            ? (tr.program_start_btn || 'Start this program')
            : (tr.onb_next || 'Next')}
        </GlassButton>
      </View>
    </View>
  );
}
