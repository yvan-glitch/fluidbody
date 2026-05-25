// PilierEducation — long-form "Comprendre" screen for a single pilier.
//
// Renders the editorial content stored in src/constants/pilierContent.js
// over the Liquid Glass system. Sections fade in stagger (100ms each) on
// mount; the hero illustration breathes with a slow loop so the screen
// feels alive without being noisy.
//
// Mounted as a full-screen Modal from MonCorps (see `openEducationPilier`)
// — no router changes were required. Closing the modal hands control back
// to MonCorps; tapping a linked séance closes the education modal and
// opens the séance panel via the `onOpenSeance(pilierKey, seanceIdx)`
// callback the parent provides.
//
// Notes on content sourcing & accuracy:
// - Anatomy facts are kept at high-level functional anatomy. No fake
//   studies are cited. Phrasing stays in "many practitioners report…"
//   or "Pilates helps…" territory.
// - Sabrina quotes are placeholders, to be replaced with her real
//   dictated copy (see PR description for the full list).

import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import { PILIER_IMAGES } from '../constants/data';
import { getPilierContent } from '../constants/pilierContent';
import { GLASS_RADII } from '../components/ui';
import GlassView from '../components/ui/GlassView';
import GlassButton from '../components/GlassButton';
import LivingBackground from '../components/LivingBackground';
import DownloadButton from '../components/DownloadButton';
import { useTheme } from '../theme/ThemeProvider';
import { IS_TV } from '../utils/platformTV';

const { width: SW } = Dimensions.get('window');
const IS_IPAD = SW >= 768;

// ────────────────────────────────────────────────────────────────────────
// Outline SVG icons used in the "Why it matters" section.
// Kept stylised (Liquid Glass aesthetic), not anatomically literal.
// ────────────────────────────────────────────────────────────────────────
function WhyIcon({ name, color, size }) {
  const s = size || 28;
  const c = color;
  const sw = 1.6;
  switch (name) {
    case 'lift':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="5" r="2" stroke={c} strokeWidth={sw} />
          <Path d="M9 11h6l-1 9H10z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M9 11 L4 14 M15 11 L20 14" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'office':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect x="4" y="6" width="16" height="10" rx="1.5" stroke={c} strokeWidth={sw} />
          <Path d="M8 16 L8 19 M16 16 L16 19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'sleep':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M20 14a8 8 0 1 1-10-10 6 6 0 0 0 10 10z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'sport':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="8" stroke={c} strokeWidth={sw} />
          <Path d="M5 9 L19 15 M9 5 L15 19" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'walk':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="13" cy="4.5" r="1.8" stroke={c} strokeWidth={sw} />
          <Path d="M13 7 L11 12 L9 13 M13 7 L15 13 L13 21 M11 12 L13 17 L11 21" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'aging':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} />
          <Path d="M12 6 L12 12 L16 14" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'sit':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M6 4 L6 13 L18 13 L18 18 M6 13 L6 20 M18 18 L18 20" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx="12" cy="5.5" r="1.8" stroke={c} strokeWidth={sw} />
        </Svg>
      );
    case 'screen':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="5" width="18" height="12" rx="1.5" stroke={c} strokeWidth={sw} />
          <Path d="M9 21 L15 21 M12 17 L12 21" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'home':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M3 11 L12 4 L21 11 L21 20 L3 20 Z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M10 20 L10 14 L14 14 L14 20" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'energy':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M13 3 L5 13 L11 13 L9 21 L19 11 L13 11 Z" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'tension':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M4 8 Q8 12 4 16 M20 8 Q16 12 20 16" stroke={c} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M9 12 L15 12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'phone':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect x="7" y="3" width="10" height="18" rx="2" stroke={c} strokeWidth={sw} />
          <Path d="M10 18 L14 18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'breath':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="3.5" stroke={c} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="7" stroke={c} strokeWidth={sw} opacity={0.55} />
        </Svg>
      );
    default:
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="8" stroke={c} strokeWidth={sw} />
        </Svg>
      );
  }
}

// Decorative "vertebra" mini-schematic. Stylised — six discs along a curve,
// pulsing softly. Used as the section accent for the Anatomy block.
function VertebraeMark({ color }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const op = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 12, opacity: 0.85 }}>
      <Svg width={120} height={36} viewBox="0 0 120 36">
        <Path d="M5 18 Q30 6 60 18 T115 18" stroke={color} strokeWidth={1.4} fill="none" opacity={0.45} />
        {[10, 28, 46, 64, 82, 100].map(function(cx, i) {
          return (
            <Circle key={i} cx={cx} cy={18 + (i % 2 === 0 ? -3 : 3)} r={3.6} fill={color} opacity={0.65} />
          );
        })}
      </Svg>
      <Animated.View style={{ marginTop: 6, opacity: op }}>
        <View style={{ width: 24, height: 1.5, backgroundColor: color, borderRadius: 1, opacity: 0.6 }} />
      </Animated.View>
    </View>
  );
}

// Hero illustration — the pilier image cropped circular with a slow breath
// scale animation. Adds a soft colored glow ring derived from pilier color.
function HeroIllustration({ pilierKey, color }) {
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 4400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 4400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const glow = breath.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.75] });
  const size = IS_IPAD ? 260 : 200;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 24 }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size + 36,
          height: size + 36,
          borderRadius: (size + 36) / 2,
          backgroundColor: color,
          opacity: glow,
          shadowColor: color,
          shadowOpacity: 0.6,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      <Animated.View style={{ transform: [{ scale }], width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' }}>
        <Image
          source={PILIER_IMAGES[pilierKey]}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
          recyclingKey={'pe-hero-' + pilierKey}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.18)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// Staggered fade-in. We mount a parent Animated.Value (`progress`) and slice
// individual children off it so we only run one animation driver, even with
// 5+ sections on screen.
function useStaggeredFade(count) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 100 * count + 400,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start();
  }, [progress, count]);
  // Map slice idx → opacity/translateY interpolator.
  return useMemo(() => {
    const stops = [];
    for (let i = 0; i < count; i++) {
      const startStop = (i * 100) / (100 * count + 400);
      const endStop = Math.min(1, startStop + 0.35);
      stops.push({
        opacity: progress.interpolate({ inputRange: [0, startStop, endStop, 1], outputRange: [0, 0, 1, 1] }),
        translateY: progress.interpolate({ inputRange: [0, startStop, endStop, 1], outputRange: [12, 12, 0, 0] }),
      });
    }
    return stops;
  }, [count, progress]);
}

// Section wrapper — keeps headers consistent across the screen.
function Section({ title, accent, children, fadeStyle }) {
  return (
    <Animated.View style={[{ marginBottom: 28 }, fadeStyle]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <View style={{ width: 6, height: 18, borderRadius: 3, backgroundColor: accent }} />
        <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: accent }}>
          {title}
        </Text>
      </View>
      {children}
    </Animated.View>
  );
}

export default function PilierEducation({ visible, pilier, lang, onClose, onOpenSeance }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const tr = useMemo(() => {
    // Tiny inline tr — we only need the few pilier_education_* strings.
    const T = require('../constants/data').T;
    return T[lang] || T.fr;
  }, [lang]);
  const content = useMemo(() => (pilier ? getPilierContent(lang, pilier.key) : null), [lang, pilier]);
  const sectionFades = useStaggeredFade(6); // hero + 5 sections

  if (!pilier || !content) return null;
  const accent = pilier.color || c.accent;
  const isLight = theme.mode === 'light';
  const sectionTextColor = c.text;
  const bodyColor = c.textSecondary;
  // For sub-cards over glass, we want a slightly stronger contrast on the
  // accent so the eye finds the headings — derive a deeper shade by
  // forcing alpha 1 when the pilier color is rgba-based.
  const accentSolid = (typeof accent === 'string' && accent.match(/rgba\(([^)]+)\)/))
    ? 'rgb(' + accent.match(/rgba\(([^)]+)\)/)[1].split(',').slice(0, 3).join(',') + ')'
    : accent;

  function handleMovementPress(movement) {
    if (!movement.linked_session_id || !onOpenSeance) return;
    const m = String(movement.linked_session_id).match(/^([a-z]\d+)_(\d+)$/i);
    if (!m) return;
    const pilierKey = m[1];
    const idx = parseInt(m[2], 10);
    if (Number.isNaN(idx)) return;
    if (onClose) onClose();
    // Defer to give the close animation a frame before the panel mounts.
    setTimeout(() => onOpenSeance(pilierKey, idx), 220);
  }

  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <LinearGradient
          colors={c.bgGradient}
          locations={c.bgGradientStops}
          style={StyleSheet.absoluteFill}
        />
        <LivingBackground />
        <BlurView
          intensity={Platform.OS === 'ios' ? 60 : 0}
          tint={isLight ? 'light' : 'dark'}
          style={[StyleSheet.absoluteFill, { backgroundColor: isLight ? 'rgba(255,255,255,0.18)' : 'rgba(10,20,35,0.35)' }]}
          pointerEvents="none"
        />

        <ScrollView
          contentContainerStyle={{ paddingTop: 60, paddingHorizontal: IS_IPAD ? 48 : 22, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Close button row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={tr.pilier_education_close || 'Close'}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ paddingVertical: 8, paddingHorizontal: 4 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: accentSolid, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                {'← ' + (tr.pilier_education_close || 'Close')}
              </Text>
            </TouchableOpacity>
            <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.textSecondary, letterSpacing: 1.6, textTransform: 'uppercase' }}>
                {tr.pilier_education_title || 'Understand'}
              </Text>
            </View>
          </View>

          {/* Hero — title + breath-animated illustration */}
          <Animated.View style={[{ marginBottom: 12 }, { opacity: sectionFades[0].opacity, transform: [{ translateY: sectionFades[0].translateY }] }]}>
            <Text style={{ fontSize: IS_IPAD ? 72 : 56, fontWeight: '200', color: c.text, letterSpacing: -1.2, lineHeight: IS_IPAD ? 78 : 62 }}>
              {pilier.label}
            </Text>
            <Text style={{ fontSize: IS_IPAD ? 18 : 16, fontWeight: '400', color: bodyColor, marginTop: 10, lineHeight: 22, fontStyle: 'italic' }}>
              {content.hero_subtitle}
            </Text>
            <HeroIllustration pilierKey={pilier.key} color={accentSolid} />
          </Animated.View>

          {/* Per-pilier medical disclaimer — currently only set for p9
              (Ménopause) where the content can intersect with active
              medical follow-up. Rendered prominently right under the
              hero so it can't be missed. */}
          {content.medical_disclaimer ? (
            <View style={{
              marginBottom: 18,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: isLight ? 'rgba(255,180,60,0.12)' : 'rgba(255,200,80,0.14)',
              borderWidth: 1,
              borderColor: isLight ? 'rgba(255,180,60,0.45)' : 'rgba(255,200,80,0.4)',
            }}>
              <Text
                accessibilityRole="alert"
                style={{ fontSize: 13, lineHeight: 19, color: isLight ? '#8A5A00' : 'rgba(255,220,140,0.95)', fontWeight: '500' }}
              >
                {content.medical_disclaimer}
              </Text>
            </View>
          ) : null}

          {/* Section 1 — Anatomie */}
          <Section title={tr.pilier_education_section_anatomy || 'Anatomy'} accent={accentSolid} fadeStyle={{ opacity: sectionFades[1].opacity, transform: [{ translateY: sectionFades[1].translateY }] }}>
            <GlassView intensity={70} borderRadius={GLASS_RADII.cardLg} contentStyle={{ padding: 20 }}>
              {content.anatomy.map(function(para, i) {
                return (
                  <Text key={i} style={{ fontSize: 15, lineHeight: 24, color: sectionTextColor, marginBottom: i === content.anatomy.length - 1 ? 0 : 14 }}>
                    {para}
                  </Text>
                );
              })}
              <VertebraeMark color={accentSolid} />
            </GlassView>
          </Section>

          {/* Section 2 — Pourquoi c'est important */}
          <Section title={tr.pilier_education_section_why || 'Why it matters'} accent={accentSolid} fadeStyle={{ opacity: sectionFades[2].opacity, transform: [{ translateY: sectionFades[2].translateY }] }}>
            {content.why_matters.map(function(item, i) {
              return (
                <View key={i} style={{ marginBottom: 10 }}>
                  <GlassView intensity={55} borderRadius={GLASS_RADII.card} contentStyle={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
                      <WhyIcon name={item.icon} color={accentSolid} size={24} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: sectionTextColor }}>
                      {item.text}
                    </Text>
                  </GlassView>
                </View>
              );
            })}
          </Section>

          {/* Section 3 — L'approche Sabrina */}
          <Section title={tr.pilier_education_section_approach || "Sabrina's approach"} accent={accentSolid} fadeStyle={{ opacity: sectionFades[3].opacity, transform: [{ translateY: sectionFades[3].translateY }] }}>
            <GlassView intensity={70} borderRadius={GLASS_RADII.cardLg} contentStyle={{ padding: 20 }}>
              {content.pilates_approach.map(function(para, i) {
                return (
                  <Text key={i} style={{ fontSize: 15, lineHeight: 24, color: sectionTextColor, marginBottom: 14 }}>
                    {para}
                  </Text>
                );
              })}
              {/* Sabrina quote inset */}
              <View style={{ marginTop: 4, paddingTop: 18, borderTopWidth: 1, borderTopColor: isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase', color: accentSolid, marginBottom: 8 }}>
                  {tr.pilier_education_sabrina_label || 'Sabrina'}
                </Text>
                <Text style={{ fontSize: 17, lineHeight: 26, fontWeight: '300', fontStyle: 'italic', color: sectionTextColor }}>
                  {'« ' + content.sabrina_quote + ' »'}
                </Text>
              </View>
            </GlassView>
          </Section>

          {/* Section 4 — Mes 5 mouvements clés */}
          <Section title={tr.pilier_education_section_movements || 'Key movements'} accent={accentSolid} fadeStyle={{ opacity: sectionFades[4].opacity, transform: [{ translateY: sectionFades[4].translateY }] }}>
            {content.key_movements.map(function(mv, i) {
              const hasSeance = !!mv.linked_session_id;
              // Parse "<pilierKey>_<idx>" pour DownloadButton (iPhone uniquement).
              let dlPilierKey = null;
              let dlIdx = null;
              if (hasSeance && !IS_TV) {
                const m = String(mv.linked_session_id).match(/^([a-z]\d+)_(\d+)$/i);
                if (m) {
                  dlPilierKey = m[1];
                  const parsed = parseInt(m[2], 10);
                  if (!Number.isNaN(parsed)) dlIdx = parsed;
                }
              }
              const canDownload = dlPilierKey != null && dlIdx != null;
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={hasSeance ? 0.82 : 1}
                  onPress={hasSeance ? function() { handleMovementPress(mv); } : null}
                  style={{ marginBottom: 10 }}
                  accessibilityRole={hasSeance ? 'button' : 'text'}
                  accessibilityLabel={mv.name + (hasSeance ? ' — ' + (tr.pilier_education_movement_open || 'Open') : ' — ' + (tr.pilier_education_movement_soon || 'Soon'))}
                >
                  <GlassView intensity={55} borderRadius={GLASS_RADII.card} contentStyle={{ padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: accentSolid }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: isLight ? '#ffffff' : '#001a2e' }}>{i + 1}</Text>
                      </View>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: sectionTextColor }}>
                        {mv.name}
                      </Text>
                      {/* Download button inline à droite du titre (iPhone) —
                          position fixe, fond lime semi-transparent + bordure
                          lime, donc visible sur tous les thèmes. Tap interne
                          ne déclenche pas le press de la card (RN nested
                          touchables → l'inner gagne). */}
                      {canDownload ? (
                        <DownloadButton pilierKey={dlPilierKey} idx={dlIdx} lang={lang} size={32} />
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 14, lineHeight: 20, color: bodyColor, marginBottom: 10 }}>
                      {mv.description}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: bodyColor, letterSpacing: 0.4 }}>
                          {mv.duration}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: hasSeance ? accentSolid : c.textTertiary, letterSpacing: 0.4 }}>
                        {hasSeance
                          ? (tr.pilier_education_movement_open || 'Open session →')
                          : (tr.pilier_education_movement_soon || 'Video coming soon')}
                      </Text>
                    </View>
                  </GlassView>
                </TouchableOpacity>
              );
            })}
          </Section>

          {/* Section 5 — Programmes recommandés */}
          <Section title={tr.pilier_education_section_programs || 'Recommended programs'} accent={accentSolid} fadeStyle={{ opacity: sectionFades[5].opacity, transform: [{ translateY: sectionFades[5].translateY }] }}>
            {content.recommended_programs.map(function(prog, i) {
              return (
                <View key={i} style={{ marginBottom: 10 }}>
                  <GlassView intensity={55} borderRadius={GLASS_RADII.card} contentStyle={{ padding: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: sectionTextColor }}>{prog.label}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: accentSolid, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                          {prog.goal}
                        </Text>
                      </View>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: bodyColor, letterSpacing: 0.4 }}>
                          {typeof tr.pilier_education_program_weeks === 'function'
                            ? tr.pilier_education_program_weeks(prog.duration_weeks)
                            : prog.duration_weeks + ' weeks'}
                        </Text>
                      </View>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: bodyColor, letterSpacing: 0.4 }}>
                          {typeof tr.pilier_education_program_freq === 'function'
                            ? tr.pilier_education_program_freq(prog.frequency)
                            : prog.frequency + '×/wk'}
                        </Text>
                      </View>
                    </View>
                  </GlassView>
                </View>
              );
            })}
            {/* CTA — opens the séance panel for the pilier so the user can
                start practising immediately. The thematic programs editor
                lives elsewhere; we just hand off to MonCorps with the
                pilier preselected. */}
            <View style={{ marginTop: 8 }}>
              <GlassButton
                onPress={function() {
                  if (!onOpenSeance) { onClose && onClose(); return; }
                  if (onClose) onClose();
                  setTimeout(() => onOpenSeance(pilier.key, null), 220);
                }}
                variant="accent"
                size="lg"
                fullWidth
                accessibilityLabel={(tr.pilier_education_program_cta_prefix || 'Start') + ' ' + pilier.label}
              >
                {(tr.pilier_education_program_cta_prefix || 'Start a program') + ' ' + pilier.label}
              </GlassButton>
            </View>
          </Section>

          {/* Generic educational footer — kept short on every pilier so
              users understand the content is informational, not medical. */}
          <View style={{ marginTop: 20, paddingHorizontal: 4 }}>
            <Text
              style={{ fontSize: 11, lineHeight: 16, color: c.textTertiary, textAlign: 'center', fontStyle: 'italic' }}
            >
              {tr.pilier_education_medical_footer || 'Ces informations sont éducatives et ne remplacent pas un avis médical.'}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
