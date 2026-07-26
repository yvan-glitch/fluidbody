// MyPrograms — list view of the user's generated programs.
//
// Lives behind a "See my programs" entry in MonCorps (programmes tab).
// Mounted inline (no Modal wrapper) — parent decides visibility.
//
// Renders:
//   • Empty state with a CTA to open ProgramBuilder
//   • Card per program: name, duration/frequency badge, progress bar,
//     next session line, "delete" affordance.
//
// Reads via `listPrograms(supabase, userId)`. Refreshes when the screen
// becomes visible or after a program is created/deleted. No real-time
// subscription — programs change rarely.

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Dimensions, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { T, PILIER_IMAGES } from '../constants/data';
import { GlassCard, GlassButton } from '../components/ui';
import { useTheme } from '../theme/ThemeProvider';
import LivingBackground from '../components/LivingBackground';
import { Bulle, BULLES_ONBOARDING } from '../components/Meduse';
import { getPiliers, getSeances } from '../utils';
import { listPrograms, getProgramStats, deleteProgram, startProgram } from '../utils/programs';
import ProgramBuilder from './ProgramBuilder';

let _HapticsMod = null;
try { _HapticsMod = require('expo-haptics'); } catch (e) {}
function _hapticSelection() {
  if (Platform.OS === 'web' || !_HapticsMod) return;
  try { _HapticsMod.selectionAsync(); } catch (e) {}
}


function ChevronLeft({ color, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ProgressBar({ percent, color, hairline }) {
  const w = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: hairline, overflow: 'hidden' }}>
      <View style={{ width: w + '%', height: '100%', backgroundColor: color }} />
    </View>
  );
}

function ProgramCard({ program, lang, onOpen, onDelete, onStart }) {
  const tr = T[lang] || T['fr'];
  const theme = useTheme().theme;
  const colors = theme.colors;
  const glass = theme.glass;
  const piliers = getPiliers(lang);
  const seancesData = getSeances(lang);

  const stats = getProgramStats(program);
  const heroPilier = stats.nextSession ? stats.nextSession.pilier_key : (program.schedule && program.schedule[0] && program.schedule[0].pilier_key);
  const heroPilierObj = piliers.find(function (p) { return p.key === heroPilier; });
  const nextSeance = stats.nextSession ? (seancesData[stats.nextSession.pilier_key] || [])[stats.nextSession.session_index] : null;
  const isActive = !!program.started_at && !program.completed_at;
  const isCompleted = !!program.completed_at;

  return (
    <Pressable onPress={function () { onOpen && onOpen(program); }} style={{ marginBottom: 14 }}>
      <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: isActive ? colors.accent : colors.hairline }}>
        {heroPilier && PILIER_IMAGES[heroPilier] ? (
          <View style={{ height: 90 }}>
            <Image source={PILIER_IMAGES[heroPilier]} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.78)']} style={{ flex: 1, padding: 14, justifyContent: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {isActive ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.accent }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 0.8 }}>{tr.program_active_tag || 'ACTIF'}</Text>
                  </View>
                ) : isCompleted ? (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.8 }}>{tr.program_completed_tag || 'TERMINÉ'}</Text>
                  </View>
                ) : null}
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#fff', flex: 1 }} numberOfLines={1}>
                  {program.name || (tr.program_default_name || 'Programme')}
                </Text>
              </View>
            </LinearGradient>
          </View>
        ) : null}

        <View style={{ padding: 14, backgroundColor: glass.substrate }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.6 }}>
              {program.duration_weeks}{tr.program_weeks_short || 'sem'} · {program.sessions_per_week}{tr.program_per_week_short || '×/sem'} · {(program.difficulty && tr['onb_practice_' + program.difficulty]) || program.difficulty || ''}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: '800', color: colors.accentText }}>
              {stats.percent}%
            </Text>
          </View>
          <ProgressBar percent={stats.percent} color={colors.accent} hairline={colors.hairline} />

          {stats.nextSession ? (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5, marginBottom: 4 }}>
                {(tr.program_week_label || 'Week') + ' ' + stats.currentWeek + '/' + program.duration_weeks + ' · ' + (tr.program_next_label || 'Next session')}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                {nextSeance ? nextSeance[0] : ((heroPilierObj && heroPilierObj.label) || stats.nextSession.pilier_key)}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                {((heroPilierObj && heroPilierObj.label) || stats.nextSession.pilier_key) + ' · ' + ((tr.etapes && tr.etapes[stats.nextSession.etape]) || stats.nextSession.etape)}
              </Text>
            </View>
          ) : isCompleted ? (
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.accentText, marginTop: 10 }}>
              {tr.program_completed_msg || 'Bravo, programme terminé !'}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            {!isActive && !isCompleted ? (
              <GlassButton variant="accent" size="sm" onPress={function () { onStart && onStart(program); }} fullWidth={false} style={{ flex: 1 }}>
                {tr.program_start_btn || 'Start'}
              </GlassButton>
            ) : null}
            <GlassButton variant="subtle" size="sm" onPress={function () { onDelete && onDelete(program); }} fullWidth={false} style={{ flex: 1 }}>
              {tr.program_delete_btn || 'Delete'}
            </GlassButton>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function MyPrograms({ lang, supabase, supaUser, onClose, onOpenProgram }) {
  const tr = T[lang] || T['fr'];
  const insets = useSafeAreaInsets();
  const theme = useTheme().theme;
  const colors = theme.colors;
  const glass = theme.glass;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(function () {
    let cancelled = false;
    setLoading(true);
    listPrograms(supabase, supaUser && supaUser.id).then(function (rows) {
      if (cancelled) return;
      setItems(rows);
      setLoading(false);
    });
    return function () { cancelled = true; };
  }, [supabase, supaUser && supaUser.id, refreshTick]);

  function refresh() { setRefreshTick(function (n) { return n + 1; }); }

  function confirmDelete(program) {
    _hapticSelection();
    if (Platform.OS === 'web') {
      // RN-web fallback — skip native Alert.
      deleteProgram(supabase, program.id).then(refresh);
      return;
    }
    Alert.alert(
      tr.program_delete_confirm_title || 'Delete this program?',
      tr.program_delete_confirm_msg || 'This cannot be undone.',
      [
        { text: tr.profile_cancel_btn || 'Cancel', style: 'cancel' },
        {
          text: tr.program_delete_btn || 'Delete',
          style: 'destructive',
          onPress: function () { deleteProgram(supabase, program.id).then(refresh); },
        },
      ]
    );
  }

  function start(program) {
    startProgram(supabase, program.id).then(refresh);
  }

  if (showBuilder) {
    return (
      <ProgramBuilder
        lang={lang}
        supabase={supabase}
        supaUser={supaUser}
        onClose={function () { setShowBuilder(false); refresh(); }}
        onCreated={function () { refresh(); }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={colors.bgGradient} locations={colors.bgGradientStops} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        {BULLES_ONBOARDING.map(function (b, i) { return <Bulle key={'mp-' + i} {...b} />; })}
      </View>

      <View style={{ paddingTop: 12 + insets.top, paddingHorizontal: 20, marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Pressable onPress={onClose} hitSlop={12} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: glass.substrate }}>
            <ChevronLeft color={colors.text} />
          </Pressable>
          <Text style={{ flex: 1, marginLeft: 12, fontSize: 18, fontWeight: '800', color: colors.text }}>
            {tr.program_mine_title || 'My programs'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 130 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>{tr.program_loading || 'Loading…'}</Text>
        ) : items.length === 0 ? (
          <GlassCard padded padding={22}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 }}>
              {tr.program_empty_title || 'No program yet'}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 18 }}>
              {tr.program_empty_sub || 'Build your first personalised plan: pick your goals and we’ll lay out the sessions.'}
            </Text>
            <GlassButton variant="accent" size="md" onPress={function () { _hapticSelection(); setShowBuilder(true); }}>
              {tr.program_create_btn || 'Create a program'}
            </GlassButton>
          </GlassCard>
        ) : (
          <View>
            {items.map(function (p) {
              return (
                <ProgramCard
                  key={p.id}
                  program={p}
                  lang={lang}
                  onOpen={onOpenProgram}
                  onDelete={confirmDelete}
                  onStart={start}
                />
              );
            })}
            <View style={{ marginTop: 8 }}>
              <GlassButton variant="accent" size="md" onPress={function () { _hapticSelection(); setShowBuilder(true); }}>
                {tr.program_create_btn || 'Create a program'}
              </GlassButton>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
