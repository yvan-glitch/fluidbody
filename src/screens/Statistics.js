// Statistics — advanced stats dashboard.
//
// Sections, top to bottom:
//   A. Header KPIs (count-up totals + "member since" / total hours line)
//   B. Pillar progression bars (tap → drawer with that pilier's detail)
//   C. Activity rings — last 7 days strip + 4-week donuts
//   D. Heart-rate trends (HealthKit, last 14 days)
//   E. Milestone badges grid
//
// Data comes from `src/utils/statistics.js` which caches for 60 s, so
// re-mounting the screen mid-session is cheap. While the first load is
// running we render a low-data skeleton (all zeros) so the layout doesn't
// jump when real numbers arrive.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, StyleSheet,
  Animated, Easing, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { T } from '../constants/data';
import { GlassCard, GLASS_RADII } from '../components/ui';
import { useTheme } from '../theme/ThemeProvider';
import LivingBackground from '../components/LivingBackground';
import { Bulle, BULLES, FloatingMedusas } from '../components/Meduse';
import {
  HorizontalBarChart,
  LineChart,
  MiniRingsRow,
  BadgeGrid,
  CountUpNumber,
} from '../components/charts';
import { getCachedStatistics, colorForPct } from '../utils/statistics';
import { GLASS_EASING } from '../components/ui/glassTokens';

let HapticsMod = null;
try { HapticsMod = require('expo-haptics'); } catch (e) {}

function hapticTap() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  try { HapticsMod.selectionAsync(); } catch (e) {}
}

function BackArrow({ color }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function formatMemberSince(iso, lang) {
  if (!iso || typeof iso !== 'string') return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const months = {
    fr: ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    es: ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'],
    it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
  };
  const m = (months[lang] || months.fr)[d.getMonth()];
  return m + ' ' + d.getFullYear();
}

function StaggeredFadeIn({ delay, children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(12)).current;
  useEffect(function () {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, delay: delay, easing: GLASS_EASING, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 380, delay: delay, easing: GLASS_EASING, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: opacity, transform: [{ translateY: ty }] }}>
      {children}
    </Animated.View>
  );
}

function HeaderKpiCard({ label, value, accent, formatter, delay }) {
  const { theme } = useTheme();
  return (
    <GlassCard intensity={55} padding={14} borderRadius={GLASS_RADII.card} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center' }}>
        <CountUpNumber
          value={value}
          delay={delay}
          duration={1100}
          formatter={formatter}
          style={{ fontSize: 30, fontWeight: '800', color: accent || theme.colors.accentText, letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}
        />
        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 4, textAlign: 'center' }}>
          {label}
        </Text>
      </View>
    </GlassCard>
  );
}

function SectionTitle({ children, sub }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.accentText, letterSpacing: 2, textTransform: 'uppercase' }}>
        {children}
      </Text>
      {sub ? (
        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 }}>{sub}</Text>
      ) : null}
    </View>
  );
}

export default function StatisticsScreen({ lang, done, streak, supaUser, onClose }) {
  const tr = T[lang] || T.fr;
  const { theme } = useTheme();
  const [snap, setSnap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null); // pilier row

  useEffect(function () {
    let cancelled = false;
    getCachedStatistics({ done: done, lang: lang, tr: tr, supaUser: supaUser })
      .then(function (s) {
        if (!cancelled) {
          setSnap(s);
          setLoading(false);
        }
      })
      .catch(function () {
        if (!cancelled) setLoading(false);
      });
    return function () { cancelled = true; };
  }, [done, lang, supaUser]);

  // Skeleton numbers while loading — keeps the layout stable.
  const header = (snap && snap.header) || {
    totalSessions: 0,
    streakCurrent: streak || 0,
    activeMonths: 0,
    totalMinutes: 0,
    memberSince: null,
  };
  const piliers = (snap && snap.piliers) || [];
  const rings = (snap && snap.rings) || { week: [], monthly: [], goals: { move: 350, exercise: 30, stand: 12 } };
  const hr = (snap && snap.hr) || { available: false, daily30: [], restingAvg: null, activeAvg: null, maxOverall: null };
  const badges = (snap && snap.badges) || { list: [], unlockedCount: 0 };

  const memberStr = useMemo(function () { return formatMemberSince(header.memberSince, lang); }, [header.memberSince, lang]);
  const totalHours = Math.floor(header.totalMinutes / 60);
  const totalMinsRem = header.totalMinutes - totalHours * 60;
  const totalLine = totalHours > 0
    ? (typeof tr.stats_total_hours === 'function' ? tr.stats_total_hours(totalHours, totalMinsRem) : (totalHours + 'h ' + totalMinsRem + 'min'))
    : (typeof tr.stats_total_minutes === 'function' ? tr.stats_total_minutes(header.totalMinutes) : (header.totalMinutes + ' min'));

  // Heart-rate chart data: map daily30 → {date, y=avgHr}.
  const hrChart = useMemo(function () {
    return (hr.daily30 || []).map(function (d) { return { date: d.date, y: d.avgHr }; });
  }, [hr]);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        pointerEvents="none"
        colors={theme.colors.bgGradient}
        locations={theme.colors.bgGradientStops}
        style={StyleSheet.absoluteFill}
      />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map(function (b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />

      {/* Back / header bar */}
      <View style={{ paddingTop: 62, paddingHorizontal: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Pressable
          onPress={function () { hapticTap(); if (onClose) onClose(); }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={tr.stats_a11y_close || 'Close'}
          style={function (s) { return { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.glass.substrate, borderWidth: 1, borderColor: theme.colors.hairline, alignItems: 'center', justifyContent: 'center', opacity: s.pressed ? 0.6 : 1 }; }}
        >
          <BackArrow color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 }}>{tr.stats_title || 'Statistiques'}</Text>
          <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>{tr.stats_subtitle || ''}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── A. Header KPIs ── */}
        <StaggeredFadeIn delay={0}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <HeaderKpiCard
              label={tr.stats_total_sessions || 'Séances totales'}
              value={header.totalSessions}
              delay={120}
            />
            <HeaderKpiCard
              label={tr.stats_streak || 'Streak'}
              value={header.streakCurrent}
              formatter={function (n) { return '🔥 ' + n; }}
              delay={200}
            />
            <HeaderKpiCard
              label={tr.stats_active_months || 'Mois actifs'}
              value={header.activeMonths}
              delay={280}
            />
          </View>
          <View style={{ alignItems: 'center', marginTop: 12, gap: 4 }}>
            {memberStr ? (
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                {typeof tr.stats_member_since === 'function' ? tr.stats_member_since(memberStr) : ('Membre depuis ' + memberStr)}
              </Text>
            ) : null}
            <Text style={{ fontSize: 12, color: theme.colors.accentText, fontWeight: '600' }}>
              {totalLine}
            </Text>
          </View>
        </StaggeredFadeIn>

        {/* ── B. Pillar progression ── */}
        <StaggeredFadeIn delay={100}>
          <GlassCard intensity={55} padding={18} borderRadius={GLASS_RADII.card}>
            <SectionTitle>{tr.stats_pillar_progress || 'Progression par pilier'}</SectionTitle>
            <HorizontalBarChart
              data={piliers}
              colorForPct={colorForPct}
              onRowPress={function (row) { hapticTap(); setDrawer(row); }}
            />
          </GlassCard>
        </StaggeredFadeIn>

        {/* ── C. Activity rings ── */}
        <StaggeredFadeIn delay={200}>
          <GlassCard intensity={55} padding={18} borderRadius={GLASS_RADII.card}>
            <SectionTitle>{tr.stats_rings_section || 'Anneaux Activité'}</SectionTitle>
            {rings.week.length === 0 && rings.monthly.length === 0 ? (
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                {tr.stats_hk_unavailable || 'Connecte Apple Santé pour suivre tes anneaux ici.'}
              </Text>
            ) : (
              <>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                  {tr.stats_weekly_rings || 'Semaine'}
                </Text>
                <MiniRingsRow mode="week" week={rings.week} goals={rings.goals} lang={lang} />
                <View style={{ height: 16 }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                  {tr.stats_monthly_rings || '4 dernières semaines'}
                </Text>
                <MiniRingsRow mode="month" monthly={rings.monthly} lang={lang} />
              </>
            )}
          </GlassCard>
        </StaggeredFadeIn>

        {/* ── D. Heart-rate trends ── */}
        <StaggeredFadeIn delay={300}>
          <GlassCard intensity={55} padding={18} borderRadius={GLASS_RADII.card}>
            <SectionTitle sub={tr.stats_hr_subtitle || ''}>
              {tr.stats_hr_trends || 'Fréquence cardiaque'}
            </SectionTitle>
            {hr.available ? (
              <>
                <View style={{ marginHorizontal: -4 }}>
                  <LineChart
                    data={hrChart}
                    width={300}
                    height={120}
                    color={theme.colors.accentDeep}
                    yLabelFormat={function (n) { return n + ' bpm'; }}
                  />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 14 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text, fontVariant: ['tabular-nums'] }}>{hr.restingAvg != null ? hr.restingAvg : '—'}</Text>
                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 }}>{tr.stats_resting_hr || 'FC repos'}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text, fontVariant: ['tabular-nums'] }}>{hr.activeAvg != null ? hr.activeAvg : '—'}</Text>
                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 }}>{tr.stats_active_hr || 'FC effort'}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text, fontVariant: ['tabular-nums'] }}>{hr.maxOverall != null ? hr.maxOverall : '—'}</Text>
                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 2 }}>{tr.stats_max_hr || 'FC max'}</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                {tr.stats_hr_empty || 'Pas de données disponibles. Lance une séance avec ton Apple Watch.'}
              </Text>
            )}
          </GlassCard>
        </StaggeredFadeIn>

        {/* ── E. Badges ── */}
        <StaggeredFadeIn delay={400}>
          <GlassCard intensity={55} padding={18} borderRadius={GLASS_RADII.card}>
            <SectionTitle
              sub={typeof tr.stats_badges_unlocked === 'function' ? tr.stats_badges_unlocked(badges.unlockedCount, badges.list.length) : (badges.unlockedCount + ' / ' + badges.list.length)}
            >
              {tr.stats_badges_section || 'Récompenses'}
            </SectionTitle>
            <BadgeGrid badges={badges.list} columns={4} />
          </GlassCard>
        </StaggeredFadeIn>
      </ScrollView>

      {/* ── Pilier detail drawer ── */}
      <Modal
        visible={!!drawer}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={function () { setDrawer(null); }}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} onPress={function () { setDrawer(null); }} />
        {drawer ? (
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 40 }}>
            <GlassCard intensity={70} padding={20} borderRadius={GLASS_RADII.cardLg}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colorForPct(drawer.pct) }} />
                <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: theme.colors.text }}>{drawer.label}</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colorForPct(drawer.pct), fontVariant: ['tabular-nums'] }}>{drawer.pct}%</Text>
              </View>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 8 }}>
                {tr.stats_pillar_drawer_pct || 'Progression du pilier'}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: theme.colors.text, fontVariant: ['tabular-nums'] }}>
                {typeof tr.stats_pillar_drawer_done === 'function' ? tr.stats_pillar_drawer_done(drawer.done, drawer.total) : (drawer.done + ' / ' + drawer.total)}
              </Text>
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {tr.stats_pillar_drawer_last || 'Dernière activité'}
                </Text>
                <Text style={{ fontSize: 14, color: theme.colors.text, marginTop: 4 }}>
                  {drawer.lastDate || (tr.stats_pillar_drawer_never || 'Aucune séance récente')}
                </Text>
              </View>
              <Pressable
                onPress={function () { hapticTap(); setDrawer(null); }}
                style={function (s) {
                  return {
                    marginTop: 16,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: theme.glass.substrateAccent,
                    borderWidth: 1,
                    borderColor: theme.colors.accent + '55',
                    alignItems: 'center',
                    opacity: s.pressed ? 0.7 : 1,
                  };
                }}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.accentText }}>
                  {tr.stats_pillar_drawer_close || 'Fermer'}
                </Text>
              </Pressable>
            </GlassCard>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}
