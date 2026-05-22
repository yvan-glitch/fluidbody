// ProgrammesTV — onglet "Programmes" version Apple TV (style Fitness+).
//
//   - Hero du programme actif (si présent) : image du prochain pilier, nom du
//     programme, progression (semaine + %), bouton "Continuer".
//   - Grille 3 colonnes des programmes thématiques (Réveil Matinal, Mal de
//     dos, Post-travail, Core & Plancher, Souplesse totale) en cards 16:9
//     focusables. Sélectionner → ouvre le pilier correspondant (PilierPanelTV).
//
// Rendu en overlay plein écran sous la TVTopBar. TV-only — zéro impact iPhone.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import TVCard16x9 from './TVCard16x9';
import HorizontalCarousel from './HorizontalCarousel';
import { tvFocusProps } from '../../utils/platformTV';
import { T, PILIER_IMAGES } from '../../constants/data';
import { getProgramStats } from '../../utils/programs';

function parseMin(d) {
  var m = String(d || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

const { width: SW, height: SH } = Dimensions.get('window');
const SIDE = 80;
const GAP = 22;
const COLS = 3;
const FITNESS_GREEN = '#00DB7D';

const THEMES = [
  { key: 'reveil', img: require('../../../assets/programs/reveil-matinal.jpg'), pilier: 'p4', titleKey: 'prog_reveil', fallback: 'Réveil Matinal', duration: '7 JOURS · 10 MIN/JOUR' },
  { key: 'dos', img: require('../../../assets/programs/mal-de-dos.jpg'), pilier: 'p2', titleKey: 'prog_dos', fallback: 'Mal de dos', duration: '21 JOURS · 15 MIN/JOUR' },
  { key: 'posttravail', img: require('../../../assets/programs/post-travail.jpg'), pilier: 'p1', titleKey: 'prog_posttravail', fallback: 'Post-travail', duration: '5 JOURS · 15 MIN/JOUR' },
  { key: 'core', img: require('../../../assets/programs/core-plancher.jpg'), pilier: 'p7', titleKey: 'prog_core', fallback: 'Core & Plancher', duration: '14 JOURS · 12 MIN/JOUR' },
  { key: 'souplesse', img: require('../../../assets/programs/souplesse.jpg'), pilier: 'p3', titleKey: 'prog_souplesse', fallback: 'Souplesse totale', duration: '14 JOURS · 20 MIN/JOUR' },
];

function ContinueButton({ label, onPress, focusPreferred }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(function () {
    Animated.timing(scale, { toValue: focused ? 1.05 : 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [focused]);
  return (
    <Animated.View style={[{ alignSelf: 'flex-start', borderRadius: 30, transform: [{ scale: scale }] }, focused ? { shadowColor: FITNESS_GREEN, shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } } : null]}>
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{ borderRadius: 30, overflow: 'hidden' }}
      >
        <View style={{ backgroundColor: focused ? '#00F08A' : FITNESS_GREEN, paddingVertical: 16, paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#001B10', letterSpacing: 0.2 }}>{'▶  ' + label}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ProgrammesTV({ piliers, lang, activeProgram, onOpenPilier, onOpenSeance, seancesByKey }) {
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const cardW = Math.floor((SW - SIDE * 2 - GAP * (COLS - 1)) / COLS);

  function pilierByKey(k) { return (piliers || []).find(function (p) { return p.key === k; }); }

  // Rangée "Séances courtes" — les séances pratiques avec vidéo les plus
  // courtes, tous piliers confondus (esprit "méditations" de Fitness+).
  const shortItems = [];
  (piliers || []).forEach(function (p) {
    ((seancesByKey && seancesByKey[p.key]) || []).forEach(function (s, i) {
      if (s[2] === 'Comprendre' || s[2] === 'Ressentir') return;
      if (!s[3]) return; // a une vidéo produite
      shortItems.push({ key: 'short_' + p.key + '_' + i, title: s[0], subtitle: s[1] + ' · ' + p.label, image: PILIER_IMAGES[p.key], pilier: p, idx: i, _min: parseMin(s[1]) });
    });
  });
  shortItems.sort(function (a, b) { return a._min - b._min; });
  const shortRow = shortItems.slice(0, 8);

  // Hero programme actif (défensif : ne casse jamais l'écran si stats échoue).
  let activeHero = null;
  try {
    if (activeProgram) {
      const stats = getProgramStats(activeProgram);
      const next = stats && stats.nextSession;
      const nextPil = next && pilierByKey(next.pilier_key);
      if (nextPil) {
        activeHero = { program: activeProgram, stats: stats, pilier: nextPil };
      }
    }
  } catch (e) { activeHero = null; }

  const heroH = Math.round(SH * 0.5);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90, paddingTop: activeHero ? 0 : 140 }}>
        {activeHero ? (
          <View style={{ height: heroH, overflow: 'hidden', marginBottom: 36 }}>
            <Image source={PILIER_IMAGES[activeHero.pilier.key]} contentFit="cover" transition={250} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.55)', '#000000']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={{ position: 'absolute', left: SIDE, right: SIDE, bottom: 48 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: FITNESS_GREEN, letterSpacing: 1.2, marginBottom: 8 }}>
                {(tr.program_active_tag || 'PROGRAMME ACTIF') + ' · ' + (tr.program_week_label || 'Semaine') + ' ' + activeHero.stats.currentWeek + '/' + activeHero.program.duration_weeks}
              </Text>
              <Text numberOfLines={1} style={{ fontSize: 64, fontWeight: '800', color: '#ffffff', letterSpacing: -1.2, marginBottom: 10 }}>
                {activeHero.program.name || (tr.program_default_name || 'Programme')}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: '500', color: 'rgba(255,255,255,0.82)', marginBottom: 22 }}>
                {activeHero.stats.percent + '% · ' + (tr.program_next_label || 'Prochaine séance') + ' : ' + activeHero.pilier.label}
              </Text>
              <ContinueButton
                label={isFr ? 'Continuer' : 'Continue'}
                focusPreferred
                onPress={function () { onOpenPilier(activeHero.pilier); }}
              />
            </View>
          </View>
        ) : null}

        {shortRow.length > 0 ? (
          <View style={{ marginBottom: 12 }}>
            <HorizontalCarousel
              title={isFr ? 'Séances courtes' : 'Quick sessions'}
              items={shortRow}
              firstFocus={!activeHero}
              onItemPress={function (it) {
                if (onOpenSeance) onOpenSeance(it.pilier, it.idx);
                else onOpenPilier(it.pilier);
              }}
            />
          </View>
        ) : null}

        <Text style={{ fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, paddingLeft: SIDE, marginBottom: 24 }}>
          {tr.prog_thematiques_title || 'Programmes thématiques'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: SIDE }}>
          {THEMES.map(function (t, i) {
            return (
              <TVCard16x9
                key={t.key}
                width={cardW}
                title={tr[t.titleKey] || t.fallback}
                subtitle={t.duration}
                image={t.img}
                focusPreferred={!activeHero && shortRow.length === 0 && i === 0}
                onPress={function () { var p = pilierByKey(t.pilier); if (p) onOpenPilier(p); }}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
