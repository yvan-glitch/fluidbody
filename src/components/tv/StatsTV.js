// StatsTV — écrans "Résumé" et "Activité" version Apple TV.
//
// Les écrans iPhone (Resume.js ~735 l., Activity.js ~794 l., graphiques +
// HealthKit + Supabase) sont inutilisables tels quels sur grand écran. On
// affiche ici un dashboard TV épuré : grandes tuiles de chiffres + barres
// de progression par pilier — calculé depuis `done` (et `streak`), déjà en
// scope dans MonCorps. Pas de HealthKit (limite documentée).
//
//   mode="resume"   → tuiles (total séances, jours de suite, piliers actifs)
//   mode="activity" → mêmes tuiles + répartition par pilier (barres)
//
// Écran informatif : aucun élément focusable (la navigation se fait via la
// TVTopBar qui reste affichée). TV-only — zéro impact iPhone.

import { View, Text, ScrollView, StyleSheet, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

import { T } from '../../constants/data';

const TEXT_SHADOW = { textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } };

const { width: SW } = Dimensions.get('window');
const SIDE = 80;

function countDone(arr) {
  if (!Array.isArray(arr)) return 0;
  let n = 0;
  for (let i = 0; i < arr.length; i++) { if (arr[i] === true || arr[i] === 'true') n++; }
  return n;
}

function StatTile({ value, label, accent }) {
  return (
    <View style={{ flex: 1, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
      {Platform.OS === 'ios' ? <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.06)' }]} pointerEvents="none" />
      <View style={{ paddingVertical: 32, paddingHorizontal: 28 }}>
        <Text style={[{ fontSize: 76, fontWeight: '800', color: accent || '#ffffff', letterSpacing: -2, marginBottom: 6 }, TEXT_SHADOW]}>{value}</Text>
        <Text style={[{ fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.72)', letterSpacing: 0.3 }, TEXT_SHADOW]}>{label}</Text>
      </View>
    </View>
  );
}

export default function StatsTV({ mode, done, streak, piliers, lang }) {
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;

  const perPilier = (piliers || []).map(function (p) {
    return { key: p.key, label: p.label, color: p.color || '#00DCEC', count: countDone(done && done[p.key]) };
  });
  const totalDone = perPilier.reduce(function (a, p) { return a + p.count; }, 0);
  const activePiliers = perPilier.filter(function (p) { return p.count > 0; }).length;
  const maxCount = Math.max(1, ...perPilier.map(function (p) { return p.count; }));

  const title = mode === 'activity'
    ? (tr.activity_tab || (isFr ? 'Activité' : 'Activity'))
    : (tr.tabs && tr.tabs[1]) || (isFr ? 'Résumé' : 'Summary');

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 140, paddingBottom: 90, paddingHorizontal: SIDE }}>
        <Text style={{ fontSize: 44, fontWeight: '800', color: '#ffffff', letterSpacing: -1, marginBottom: 32 }}>{title}</Text>

        {totalDone === 0 ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingVertical: 44, paddingHorizontal: 40, marginBottom: 44 }}>
            <Text style={{ fontSize: 30, fontWeight: '700', color: '#ffffff', letterSpacing: -0.4, marginBottom: 10 }}>
              {isFr ? 'Ta pratique commence ici' : 'Your practice starts here'}
            </Text>
            <Text style={{ fontSize: 19, fontWeight: '400', color: 'rgba(255,255,255,0.6)', lineHeight: 27, maxWidth: 760 }}>
              {isFr
                ? 'Termine ta première séance pour voir tes statistiques apparaître. Ouvre un pilier depuis Explorer.'
                : 'Finish your first session to see your stats here. Open a pillar from Explore.'}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 24, marginBottom: 44 }}>
          <StatTile value={String(totalDone)} label={isFr ? 'Séances faites' : 'Sessions done'} accent="#AEEF4D" />
          <StatTile value={String(streak || 0)} label={isFr ? 'Jours de suite' : 'Day streak'} accent="#00DCEC" />
          <StatTile value={activePiliers + '/' + perPilier.length} label={isFr ? 'Piliers actifs' : 'Active pillars'} />
        </View>

        {mode === 'activity' ? (
          <View>
            <Text style={{ fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3, marginBottom: 22 }}>
              {isFr ? 'Répartition par pilier' : 'By pillar'}
            </Text>
            {perPilier.map(function (p) {
              return (
                <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                  <Text numberOfLines={1} style={{ width: 280, fontSize: 20, fontWeight: '500', color: 'rgba(255,255,255,0.85)' }}>{p.label}</Text>
                  <View style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginHorizontal: 20 }}>
                    <View style={{ width: Math.round((p.count / maxCount) * 100) + '%', height: 14, borderRadius: 7, backgroundColor: p.color }} />
                  </View>
                  <Text style={{ width: 48, textAlign: 'right', fontSize: 20, fontWeight: '700', color: '#ffffff', fontVariant: ['tabular-nums'] }}>{p.count}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={{ fontSize: 20, fontWeight: '400', color: 'rgba(255,255,255,0.55)', lineHeight: 28, maxWidth: 820 }}>
            {isFr
              ? 'Continue ta pratique pour faire grandir ta série. Ouvre un pilier depuis Explorer pour enchaîner une séance.'
              : 'Keep practicing to grow your streak. Open a pillar from Explore to start a session.'}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
