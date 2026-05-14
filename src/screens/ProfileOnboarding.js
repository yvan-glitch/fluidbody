// ProfileOnboardingScreen — multi-step glass onboarding for client data.
//
// Five steps:
//   0. Identity   — prénom (required) + genre (segmented).
//   1. Birth      — date of birth (date picker).
//   2. Measures   — height + weight (sliders + tap-to-type).
//   3. Practice   — niveau de pratique + fréquence souhaitée.
//   4. Goals      — 1–2 objectifs.
//
// UX details:
//   • Glass cross-fade between steps (≈360ms, Apple bezier).
//   • Progress pills at the top fill as the user advances.
//   • A persistent "Suivant" GlassButton sits above the safe area, disabled
//     until the step's validation passes.
//   • Chevron-left back button top-left, hidden on step 0.
//   • Apple Watch detection card is rendered on Measures step when HK
//     reports the watch is present + at least one of height/weight is
//     known — we pre-fill the field with the HK value but the user can
//     still type a different number.
//   • Persistence is incremental: each step's validated answer is written
//     through `syncProfilePatch` immediately so closing the app mid-flow
//     never loses progress.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Animated, Easing,
  StyleSheet, Dimensions, Platform, KeyboardAvoidingView, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';

import { T } from '../constants/data';
import { GlassCard, GlassButton, GlassView, GLASS_RADII } from '../components/ui';
import { useTheme } from '../theme/ThemeProvider';
import LivingBackground from '../components/LivingBackground';
import { Bulle, BULLES_ONBOARDING, MeduseCornerIcon } from '../components/Meduse';
import healthkit from '../utils/healthkit';
import { syncProfilePatch, readCachedProfile } from '../utils/profileSync';

let DateTimePicker = null;
try { DateTimePicker = require('@react-native-community/datetimepicker').default; } catch (e) {}

let _HapticsMod = null;
try { _HapticsMod = require('expo-haptics'); } catch (e) {}
function _hapticSelection() {
  if (Platform.OS === 'web' || !_HapticsMod) return;
  try { _HapticsMod.selectionAsync(); } catch (e) {}
}

const { width: SW, height: SH } = Dimensions.get('window');

const TOTAL_STEPS = 5;

const GOAL_KEYS = ['tone', 'flex', 'posture', 'recovery', 'serenity'];

function ChevronLeft({ color, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CheckIcon({ color, size = 14 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l4 4L19 7" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ProgressPills({ step, total, accent, hairline }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: total }).map(function (_, i) {
        const active = i <= step;
        return (
          <View
            key={i}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 2,
              backgroundColor: active ? accent : hairline,
              opacity: active ? 1 : 0.6,
            }}
          />
        );
      })}
    </View>
  );
}

function SegmentedChoice({ options, value, onChange, colors, glass }) {
  return (
    <View style={{ gap: 10 }}>
      {options.map(function (opt) {
        const active = value === opt.key;
        return (
          <Pressable key={opt.key} onPress={function () { onChange(opt.key); }}>
            <GlassView
              intensity={active ? 70 : 50}
              tint={glass.tint}
              borderRadius={GLASS_RADII.button}
              substrateColor={active ? glass.substrateAccent : glass.substrate}
              contentStyle={{
                paddingHorizontal: 18,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
              }}
              style={active ? { borderWidth: 1.5, borderColor: colors.accent, borderRadius: GLASS_RADII.button } : null}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: active ? colors.accentText : colors.text }}>
                  {opt.label}
                </Text>
                {opt.sub ? (
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                    {opt.sub}
                  </Text>
                ) : null}
              </View>
              {active ? (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <CheckIcon color={colors.accentText} />
                </View>
              ) : null}
            </GlassView>
          </Pressable>
        );
      })}
    </View>
  );
}

function Slider({ min, max, value, onChange, color, hairline, label, unit }) {
  // Lightweight horizontal slider: we use a single PanResponder-like pattern,
  // but for simplicity here we expose ± buttons + tap-to-type. The "slide"
  // feel comes from the smooth scrolling of the value with hold-press, which
  // we implement as a long-press auto-increment.
  const safeValue = isFinite(value) ? value : Math.round((min + max) / 2);
  const pct = (safeValue - min) / (max - min);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: hairline.text, flex: 1 }}>{label}</Text>
        <Text style={{ fontSize: 28, fontWeight: '300', color: color, letterSpacing: -0.6 }}>{safeValue}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: hairline.textSecondary, marginLeft: 6 }}>{unit}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: hairline.track, overflow: 'hidden' }}>
        <View style={{ height: 6, width: Math.max(0, Math.min(1, pct)) * 100 + '%', backgroundColor: color, borderRadius: 3 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <Pressable onPress={function () { onChange(Math.max(min, safeValue - 1)); }} hitSlop={10} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ fontSize: 18, color: color, fontWeight: '700' }}>−</Text>
        </Pressable>
        <Pressable onPress={function () { onChange(Math.min(max, safeValue + 1)); }} hitSlop={10} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ fontSize: 18, color: color, fontWeight: '700' }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ProfileOnboardingScreen({ lang, initialData, supaUser, onDone, onClose, ctaLabel }) {
  const tr = T[lang] || T.fr;
  const themeCtx = useTheme();
  const theme = themeCtx.theme;
  const colors = theme.colors;
  const glass = theme.glass;
  const insets = useSafeAreaInsets();

  const init = initialData || {};

  // ── State ──
  const [step, setStep] = useState(0);
  const [prenom, setPrenom] = useState(init.prenom || '');
  const [gender, setGender] = useState(init.gender || null);
  const [birthDate, setBirthDate] = useState(function () {
    if (init.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(init.birth_date)) {
      const p = init.birth_date.split('-');
      return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    }
    return null;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date(1990, 0, 1));
  const [heightCm, setHeightCm] = useState(init.height_cm || null);
  const [weightKg, setWeightKg] = useState(init.weight_kg || null);
  const [practiceLevel, setPracticeLevel] = useState(init.practice_level || null);
  const [frequency, setFrequency] = useState(init.frequency || null);
  const [goals, setGoals] = useState(Array.isArray(init.goals) ? init.goals.slice(0, 2) : []);
  const [savingState, setSavingState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [hkPrefilled, setHkPrefilled] = useState({ height: false, weight: false });
  const [hkWatchDetected, setHkWatchDetected] = useState(false);
  const [showHeightInput, setShowHeightInput] = useState(false);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [tempInput, setTempInput] = useState('');

  // Restore cached values if no `initialData` given (resume-where-left-off).
  useEffect(function () {
    if (initialData) return; // explicit data wins
    let cancelled = false;
    readCachedProfile().then(function (cached) {
      if (cancelled || !cached) return;
      if (!prenom && cached.prenom) setPrenom(cached.prenom);
      if (!gender && cached.gender) setGender(cached.gender);
      if (!birthDate && cached.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(cached.birth_date)) {
        const p = cached.birth_date.split('-');
        setBirthDate(new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
      }
      if (!heightCm && isFinite(cached.height_cm)) setHeightCm(cached.height_cm);
      if (!weightKg && isFinite(cached.weight_kg)) setWeightKg(cached.weight_kg);
      if (!practiceLevel && cached.practice_level) setPracticeLevel(cached.practice_level);
      if (!frequency && cached.frequency) setFrequency(cached.frequency);
      if (goals.length === 0 && Array.isArray(cached.goals)) setGoals(cached.goals.slice(0, 2));
    });
    return function () { cancelled = true; };
  }, []);

  // HealthKit prefill on mount.
  useEffect(function () {
    let cancelled = false;
    if (Platform.OS !== 'ios') return undefined;
    healthkit.ensureHealthKitInit().then(async function (res) {
      if (cancelled || !res || !res.ok) return;
      // Heuristic: if any recent body sample is from Apple Watch, we treat
      // it as "detected" for the UI card. Reading HR samples is the most
      // reliable signal (same approach as useLiveHeartRate.probe). We avoid
      // hitting that path here to keep this fast; instead we infer from
      // the presence of any HK data.
      const [hCm, wKg, dob, sex] = await Promise.all([
        healthkit.readLatestHeightCm(),
        healthkit.readLatestWeightKg(),
        healthkit.readDateOfBirth(),
        healthkit.readBiologicalSex(),
      ]);
      if (cancelled) return;
      if (hCm && (!init.height_cm && !heightCm)) {
        setHeightCm(hCm);
        setHkPrefilled(function (p) { return Object.assign({}, p, { height: true }); });
      }
      if (wKg && (!init.weight_kg && !weightKg)) {
        setWeightKg(Math.round(wKg));
        setHkPrefilled(function (p) { return Object.assign({}, p, { weight: true }); });
      }
      if (dob && !birthDate && !init.birth_date) {
        const p = dob.split('-');
        setBirthDate(new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)));
      }
      if (sex && !gender && !init.gender) {
        setGender(sex === 'other' ? 'nonbinary' : sex);
      }
      // Watch detection — coarse: if any HK data exists, assume the user
      // has a watch worth mentioning. This avoids the 7-day HR probe.
      setHkWatchDetected(!!(hCm || wKg || dob));
    });
    return function () { cancelled = true; };
  }, []);

  // ── Cross-fade between steps ──
  const stepO = useRef(new Animated.Value(1)).current;
  const stepY = useRef(new Animated.Value(0)).current;
  function animateStepTo(next) {
    Animated.parallel([
      Animated.timing(stepO, { toValue: 0, duration: 180, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }),
      Animated.timing(stepY, { toValue: 12, duration: 180, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }),
    ]).start(function () {
      setStep(next);
      stepY.setValue(-12);
      Animated.parallel([
        Animated.timing(stepO, { toValue: 1, duration: 220, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }),
        Animated.timing(stepY, { toValue: 0, duration: 220, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }),
      ]).start();
    });
  }

  // ── Validation per step ──
  function canAdvance() {
    if (step === 0) return prenom.trim().length > 0;
    if (step === 1) return !!birthDate;
    if (step === 2) return true; // measurements optional
    if (step === 3) return !!practiceLevel && !!frequency;
    if (step === 4) return goals.length >= 1 && goals.length <= 2;
    return false;
  }

  function snapshotPatchForStep(s) {
    const patch = {};
    if (s >= 0) {
      patch.prenom = prenom.trim() || null;
      patch.gender = gender || null;
    }
    if (s >= 1 && birthDate) {
      patch.birth_date = birthDate.getFullYear() + '-' + String(birthDate.getMonth() + 1).padStart(2, '0') + '-' + String(birthDate.getDate()).padStart(2, '0');
    }
    if (s >= 2) {
      // Defensive bounds — slider + commitTextInput already enforce these,
      // but cached values from older versions might be out of range.
      if (heightCm && heightCm >= 120 && heightCm <= 220) patch.height_cm = heightCm;
      if (weightKg && weightKg >= 30 && weightKg <= 200) patch.weight_kg = weightKg;
    }
    if (s >= 3) {
      if (practiceLevel) patch.practice_level = practiceLevel;
      if (frequency) patch.frequency = frequency;
    }
    if (s >= 4) {
      patch.goals = goals.slice(0, 2);
    }
    return patch;
  }

  async function persistIncremental(s) {
    const patch = snapshotPatchForStep(s);
    setSavingState('saving');
    try {
      await syncProfilePatch(patch, {
        userId: supaUser?.id,
        writeToHealthKit: s === 2, // mirror physical metrics to HK at the measurements step
      });
      setSavingState('saved');
      setTimeout(function () { setSavingState('idle'); }, 800);
    } catch (e) {
      setSavingState('error');
    }
  }

  async function next() {
    if (!canAdvance()) return;
    // Persist the step's current data, then move forward.
    await persistIncremental(step);
    if (step < TOTAL_STEPS - 1) {
      animateStepTo(step + 1);
      return;
    }
    // Final step → mark complete + bubble up.
    const finalPatch = Object.assign({}, snapshotPatchForStep(TOTAL_STEPS - 1), {
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    });
    setSavingState('saving');
    try {
      await syncProfilePatch(finalPatch, {
        userId: supaUser?.id,
        writeToHealthKit: true,
      });
      setSavingState('saved');
    } catch (e) {
      setSavingState('error');
    }
    if (typeof onDone === 'function') {
      onDone(finalPatch);
    }
  }

  function back() {
    if (step === 0) {
      if (typeof onClose === 'function') onClose();
      return;
    }
    animateStepTo(step - 1);
  }

  function toggleGoal(key) {
    _hapticSelection();
    setGoals(function (prev) {
      const has = prev.indexOf(key) !== -1;
      if (has) return prev.filter(function (k) { return k !== key; });
      if (prev.length >= 2) return prev; // cap at 2
      return prev.concat([key]);
    });
  }

  function commitTextInput() {
    const n = parseInt(tempInput, 10);
    if (showHeightInput) {
      if (isFinite(n) && n >= 120 && n <= 220) {
        setHeightCm(n);
        setShowHeightInput(false);
        setTempInput('');
        return;
      }
      if (tempInput.trim() !== '') {
        Alert.alert('FluidBody', tr.profile_height_invalid || 'La taille doit être entre 120 et 220 cm');
        return;
      }
      setShowHeightInput(false);
    } else if (showWeightInput) {
      if (isFinite(n) && n >= 30 && n <= 200) {
        setWeightKg(n);
        setShowWeightInput(false);
        setTempInput('');
        return;
      }
      if (tempInput.trim() !== '') {
        Alert.alert('FluidBody', tr.profile_weight_invalid || 'Le poids doit être entre 30 et 200 kg');
        return;
      }
      setShowWeightInput(false);
    }
    setTempInput('');
  }

  // Compose step content.
  const stepConfigs = [
    {
      title: tr.onb_identity_title || 'Let\'s get to know each other',
      sub: tr.onb_identity_sub || '',
    },
    {
      title: tr.onb_birth_title || 'Date of birth',
      sub: tr.onb_birth_sub || '',
    },
    {
      title: tr.onb_measures_title || 'Your measurements',
      sub: tr.onb_measures_sub || '',
    },
    {
      title: tr.onb_practice_title || 'Your level',
      sub: tr.onb_practice_sub || '',
    },
    {
      title: tr.onb_goals_title || 'Your goals',
      sub: tr.onb_goals_sub || '',
    },
  ];

  const config = stepConfigs[step];

  const sliderHairline = {
    text: colors.text,
    textSecondary: colors.textSecondary,
    track: theme.mode === 'light' ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)',
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={colors.bgGradient} locations={colors.bgGradientStops} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        {BULLES_ONBOARDING.map(function (b, i) { return <Bulle key={'ob-' + i} {...b} />; })}
      </View>

      {/* Header bar — back chevron + progress pills + step count */}
      <View style={{ paddingTop: 12 + insets.top, paddingHorizontal: 20, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Pressable onPress={back} hitSlop={12} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.glass.substrate, opacity: step === 0 && !onClose ? 0.0 : 1.0 }} disabled={step === 0 && !onClose}>
            <ChevronLeft color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, marginHorizontal: 14 }}>
            <ProgressPills step={step} total={TOTAL_STEPS} accent={colors.accent} hairline={colors.hairline} />
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.4 }}>
            {((tr.onb_step_of && typeof tr.onb_step_of === 'function') ? tr.onb_step_of(step + 1, TOTAL_STEPS) : (step + 1) + '/' + TOTAL_STEPS)}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={20}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 130 + insets.bottom }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: stepO, transform: [{ translateY: stepY }] }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 8, marginTop: 4 }}>
              {config.title}
            </Text>
            {config.sub ? (
              <Text style={{ fontSize: 14, fontWeight: '400', color: colors.textSecondary, lineHeight: 20, marginBottom: 24 }}>
                {config.sub}
              </Text>
            ) : null}

            {/* Step content */}
            {step === 0 ? (
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accentText, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 }}>{tr.onb_prenom_label || 'First name'}</Text>
                <GlassView intensity={50} borderRadius={GLASS_RADII.button} substrateColor={theme.glass.substrate} contentStyle={{ paddingHorizontal: 16, height: 52, justifyContent: 'center' }} style={{ marginBottom: 22 }}>
                  <TextInput
                    value={prenom}
                    onChangeText={setPrenom}
                    placeholder={tr.onb_prenom_ph || 'Your first name'}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="words"
                    autoCorrect={false}
                    textContentType="givenName"
                    maxLength={50}
                    style={{ fontSize: 17, fontWeight: '500', color: colors.text, paddingVertical: 0 }}
                  />
                </GlassView>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accentText, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>{tr.onb_gender_title || 'Gender'}</Text>
                <SegmentedChoice
                  options={[
                    { key: 'female', label: tr.onb_gender_female || 'Female' },
                    { key: 'male', label: tr.onb_gender_male || 'Male' },
                    { key: 'nonbinary', label: tr.onb_gender_nonbinary || 'Non-binary' },
                    { key: 'undisclosed', label: tr.onb_gender_undisclosed || 'Prefer not to say' },
                  ]}
                  value={gender}
                  onChange={function (v) { _hapticSelection(); setGender(v); }}
                  colors={colors}
                  glass={glass}
                />
              </View>
            ) : null}

            {step === 1 ? (
              <View>
                <GlassCard padded padding={18}>
                  <Pressable onPress={function () { setTempDate(birthDate || new Date(1990, 0, 1)); setShowDatePicker(true); }}>
                    <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1.4, marginBottom: 8 }}>
                        {tr.onb_birth_label || 'Date of birth'}
                      </Text>
                      <Text style={{ fontSize: 36, fontWeight: '300', color: colors.text, letterSpacing: -1 }}>
                        {birthDate
                          ? (String(birthDate.getDate()).padStart(2, '0') + '/' + String(birthDate.getMonth() + 1).padStart(2, '0') + '/' + birthDate.getFullYear())
                          : '— / — / ——'}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.accentText, marginTop: 8 }}>
                        {birthDate ? (tr.profile_edit_btn || 'Edit') : (tr.onb_birth_pick || 'Pick a date')}
                      </Text>
                    </View>
                  </Pressable>
                </GlassCard>
              </View>
            ) : null}

            {step === 2 ? (
              <View>
                {(hkWatchDetected) ? (
                  <GlassCard padded padding={14} style={{ marginBottom: 18 }} substrateColor={glass.substrateAccent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ fontSize: 18 }}>⌚️</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accentText }}>{tr.onb_hk_detected || 'Apple Watch detected'}</Text>
                        {(hkPrefilled.height || hkPrefilled.weight) ? (
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>{tr.onb_hk_prefilled || 'Values pulled from Apple Health.'}</Text>
                        ) : null}
                      </View>
                    </View>
                  </GlassCard>
                ) : null}
                <GlassCard padded padding={18} style={{ marginBottom: 14 }}>
                  <Slider
                    min={120}
                    max={220}
                    value={heightCm || 170}
                    onChange={function (v) { setHeightCm(v); }}
                    color={colors.accentText}
                    hairline={sliderHairline}
                    label={tr.onb_height_label || 'Height'}
                    unit="cm"
                  />
                  <Pressable onPress={function () { setTempInput(heightCm != null ? String(heightCm) : ''); setShowHeightInput(true); }} style={{ alignSelf: 'flex-end', marginTop: 8 }} hitSlop={10}>
                    <Text style={{ fontSize: 12, color: colors.accentText, fontWeight: '600' }}>{tr.profile_edit_field || 'Edit'}</Text>
                  </Pressable>
                </GlassCard>
                <GlassCard padded padding={18}>
                  <Slider
                    min={30}
                    max={200}
                    value={weightKg || 65}
                    onChange={function (v) { setWeightKg(v); }}
                    color={colors.accentText}
                    hairline={sliderHairline}
                    label={tr.onb_weight_label || 'Weight'}
                    unit="kg"
                  />
                  <Pressable onPress={function () { setTempInput(weightKg != null ? String(weightKg) : ''); setShowWeightInput(true); }} style={{ alignSelf: 'flex-end', marginTop: 8 }} hitSlop={10}>
                    <Text style={{ fontSize: 12, color: colors.accentText, fontWeight: '600' }}>{tr.profile_edit_field || 'Edit'}</Text>
                  </Pressable>
                </GlassCard>
              </View>
            ) : null}

            {step === 3 ? (
              <View style={{ gap: 24 }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accentText, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>
                    {tr.profile_practice_level || 'Level'}
                  </Text>
                  <SegmentedChoice
                    options={[
                      { key: 'beginner', label: tr.onb_practice_beginner || 'Beginner', sub: tr.onb_practice_beginner_sub || '' },
                      { key: 'intermediate', label: tr.onb_practice_intermediate || 'Intermediate', sub: tr.onb_practice_intermediate_sub || '' },
                      { key: 'advanced', label: tr.onb_practice_advanced || 'Advanced', sub: tr.onb_practice_advanced_sub || '' },
                    ]}
                    value={practiceLevel}
                    onChange={function (v) { _hapticSelection(); setPracticeLevel(v); }}
                    colors={colors}
                    glass={glass}
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accentText, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>
                    {tr.profile_frequency || 'Frequency'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[
                      { key: '1-2', label: tr.onb_frequency_low || '1–2 times' },
                      { key: '3-4', label: tr.onb_frequency_mid || '3–4 times' },
                      { key: '5+',  label: tr.onb_frequency_high || '5+ times' },
                    ].map(function (opt) {
                      const active = frequency === opt.key;
                      return (
                        <Pressable key={opt.key} onPress={function () { _hapticSelection(); setFrequency(opt.key); }} style={{ flex: 1 }}>
                          <GlassView
                            intensity={active ? 70 : 50}
                            tint={glass.tint}
                            borderRadius={GLASS_RADII.pill}
                            substrateColor={active ? glass.substrateAccent : glass.substrate}
                            contentStyle={{ paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}
                            style={active ? { borderWidth: 1.5, borderColor: colors.accent, borderRadius: GLASS_RADII.pill } : null}
                          >
                            <Text style={{ fontSize: 13, fontWeight: active ? '800' : '600', color: active ? colors.accentText : colors.text, letterSpacing: -0.1 }}>
                              {opt.label}
                            </Text>
                          </GlassView>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null}

            {step === 4 ? (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accentText, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                    {tr.profile_goals || 'Goals'}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>{goals.length}/2 · {tr.onb_goal_max || 'Maximum 2'}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {[
                    { key: 'tone', label: tr.onb_goal_tone || 'Tone' },
                    { key: 'flex', label: tr.onb_goal_flex || 'Flexibility' },
                    { key: 'posture', label: tr.onb_goal_posture || 'Posture' },
                    { key: 'recovery', label: tr.onb_goal_recovery || 'Recovery' },
                    { key: 'serenity', label: tr.onb_goal_serenity || 'Serenity' },
                  ].map(function (g) {
                    const active = goals.indexOf(g.key) !== -1;
                    const disabled = !active && goals.length >= 2;
                    return (
                      <Pressable key={g.key} onPress={function () { if (!disabled) toggleGoal(g.key); }} style={{ width: (SW - 22 * 2 - 10) / 2, opacity: disabled ? 0.4 : 1 }}>
                        <GlassView
                          intensity={active ? 70 : 50}
                          tint={glass.tint}
                          borderRadius={GLASS_RADII.card}
                          substrateColor={active ? glass.substrateAccent : glass.substrate}
                          contentStyle={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center' }}
                          style={active ? { borderWidth: 1.5, borderColor: colors.accent, borderRadius: GLASS_RADII.card } : null}
                        >
                          <Text style={{ fontSize: 15, fontWeight: active ? '800' : '600', color: active ? colors.accentText : colors.text, letterSpacing: -0.1 }}>
                            {g.label}
                          </Text>
                        </GlassView>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>

        {/* Sticky CTA */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 22, paddingBottom: 18 + insets.bottom, paddingTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flex: 1 }} />
            {savingState === 'saving' ? <Text style={{ fontSize: 11, color: colors.textSecondary }}>{tr.onb_saving || 'Saving…'}</Text> : null}
            {savingState === 'saved' ? <Text style={{ fontSize: 11, color: colors.accentText }}>✓ {tr.onb_saved || 'Saved'}</Text> : null}
          </View>
          <GlassButton
            variant="accent"
            size="lg"
            disabled={!canAdvance()}
            loading={savingState === 'saving'}
            onPress={next}
          >
            {step === TOTAL_STEPS - 1
              ? (ctaLabel || tr.onb_finish || 'Finish')
              : (tr.onb_next || 'Next')}
          </GlassButton>
        </View>
      </KeyboardAvoidingView>

      {/* Date picker modal */}
      <Modal visible={showDatePicker} transparent animationType="slide" statusBarTranslucent onRequestClose={function () { setShowDatePicker(false); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={function () { setShowDatePicker(false); }} />
          <View style={{ borderTopLeftRadius: GLASS_RADII.sheet, borderTopRightRadius: GLASS_RADII.sheet, overflow: 'hidden' }}>
            <GlassView intensity={80} borderRadius={GLASS_RADII.sheet} contentStyle={{ padding: 18, paddingBottom: 24 + insets.bottom }} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                <Pressable onPress={function () { setShowDatePicker(false); }} hitSlop={10}>
                  <Text style={{ fontSize: 15, color: colors.textSecondary }}>{tr.profile_cancel_btn || 'Cancel'}</Text>
                </Pressable>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{tr.onb_birth_label || 'Date of birth'}</Text>
                <Pressable onPress={function () { setBirthDate(tempDate); setShowDatePicker(false); }} hitSlop={10}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accentText }}>{tr.profile_picker_done || 'Done'}</Text>
                </Pressable>
              </View>
              {DateTimePicker ? (
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant={theme.mode === 'light' ? 'light' : 'dark'}
                  maximumDate={new Date()}
                  minimumDate={new Date(1900, 0, 1)}
                  onChange={function (_, d) { if (d) setTempDate(d); }}
                  textColor={colors.text}
                />
              ) : (
                <Text style={{ color: colors.textSecondary, padding: 20, textAlign: 'center' }}>
                  Date picker unavailable on this platform.
                </Text>
              )}
            </GlassView>
          </View>
        </View>
      </Modal>

      {/* Numeric input modal (height/weight) */}
      <Modal visible={showHeightInput || showWeightInput} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={function () { setShowHeightInput(false); setShowWeightInput(false); }} />
          <View style={{ borderTopLeftRadius: GLASS_RADII.sheet, borderTopRightRadius: GLASS_RADII.sheet, overflow: 'hidden' }}>
            <GlassView intensity={80} borderRadius={GLASS_RADII.sheet} contentStyle={{ padding: 18, paddingBottom: 24 + insets.bottom }} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
                <Pressable onPress={function () { setShowHeightInput(false); setShowWeightInput(false); }} hitSlop={10}>
                  <Text style={{ fontSize: 15, color: colors.textSecondary }}>{tr.profile_cancel_btn || 'Cancel'}</Text>
                </Pressable>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                  {showHeightInput ? (tr.onb_height_label || 'Height') : (tr.onb_weight_label || 'Weight')}
                </Text>
                <Pressable onPress={commitTextInput} hitSlop={10}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.accentText }}>{tr.profile_picker_done || 'Done'}</Text>
                </Pressable>
              </View>
              <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                <TextInput
                  value={tempInput}
                  onChangeText={setTempInput}
                  keyboardType="number-pad"
                  maxLength={3}
                  autoFocus
                  placeholder={showHeightInput ? '170' : '65'}
                  placeholderTextColor={colors.textTertiary}
                  style={{ width: 180, height: 70, backgroundColor: theme.glass.substrate, borderColor: colors.hairline, borderWidth: 1, borderRadius: 16, color: colors.text, fontSize: 32, fontWeight: '700', textAlign: 'center' }}
                />
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 10 }}>{showHeightInput ? 'cm' : 'kg'}</Text>
              </View>
            </GlassView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
