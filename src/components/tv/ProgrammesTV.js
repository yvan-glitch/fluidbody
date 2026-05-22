// ProgrammesTV — onglet "Programmes" version Apple TV, calqué sur la "magie"
// de l'écran iPhone (captures Yvan) :
//   1. Hero "programme en cours" (si actif) : grande image + titre + Jour N/M
//      + CTA glass "Aperçu du programme / Continuer".
//   2. "Séances courtes" : carrousel horizontal (esprit méditations Fitness+).
//   3. "Vos programmes sur mesure" : card large étirée (image full-bleed +
//      gradient + titre + durée + CTA "Aperçu du programme").
//   4. "Créez votre propre programme" : card gradient mauve vibrant.
//   5. "Programmes thématiques" : carrousel cinématique des 5 parcours.
//
// Images variées via pickSessionImage (anti-répétition). TV-only — zéro
// impact iPhone.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import HorizontalCarousel from './HorizontalCarousel';
import { tvFocusProps } from '../../utils/platformTV';
import { T, PILIER_IMAGES } from '../../constants/data';
import { getProgramStats } from '../../utils/programs';
import { pickSessionImage } from './tvImagePool';

const { width: SW, height: SH } = Dimensions.get('window');
const SIDE = 80;
const FITNESS_GREEN = '#00DB7D';
const TEXT_SHADOW = { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } };
const SABRINA_ABOUT = require('../../../assets/coach/sabrina_beach.jpg');

function parseMin(d) {
  var m = String(d || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

const THEMES = [
  { key: 'reveil', img: require('../../../assets/programs/reveil-matinal.jpg'), pilier: 'p4', titleKey: 'prog_reveil', fallback: 'Réveil Matinal', duration: '7 JOURS · 10 MIN/JOUR' },
  { key: 'dos', img: require('../../../assets/programs/mal-de-dos.jpg'), pilier: 'p2', titleKey: 'prog_dos', fallback: 'Mal de dos', duration: '21 JOURS · 15 MIN/JOUR' },
  { key: 'posttravail', img: require('../../../assets/programs/post-travail.jpg'), pilier: 'p1', titleKey: 'prog_posttravail', fallback: 'Post-travail', duration: '5 JOURS · 15 MIN/JOUR' },
  { key: 'core', img: require('../../../assets/programs/core-plancher.jpg'), pilier: 'p7', titleKey: 'prog_core', fallback: 'Core & Plancher', duration: '14 JOURS · 12 MIN/JOUR' },
  { key: 'souplesse', img: require('../../../assets/programs/souplesse.jpg'), pilier: 'p3', titleKey: 'prog_souplesse', fallback: 'Souplesse totale', duration: '14 JOURS · 20 MIN/JOUR' },
];

// Card large focusable réutilisable (scale + glow au focus).
function FocusableSurface({ children, onPress, focusPreferred, height, glowColor, radius = 24 }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(function () {
    Animated.timing(scale, { toValue: focused ? 1.03 : 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [focused]);
  const glow = Platform.OS === 'ios'
    ? { shadowColor: glowColor || '#FFFFFF', shadowOpacity: 0.5, shadowRadius: 26, shadowOffset: { width: 0, height: 0 } }
    : { elevation: 20 };
  return (
    <Animated.View style={[{ borderRadius: radius, transform: [{ scale: scale }] }, focused ? glow : null]}>
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{ height: height, borderRadius: radius, overflow: 'hidden' }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function VisualPill({ label, green }) {
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 30, overflow: 'hidden', marginTop: 16, borderWidth: green ? 0 : 1, borderColor: 'rgba(255,255,255,0.3)' }}>
      {green ? (
        <View style={{ backgroundColor: FITNESS_GREEN, paddingVertical: 12, paddingHorizontal: 28 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#001B10' }}>{label}</Text>
        </View>
      ) : (
        <View style={{ paddingVertical: 12, paddingHorizontal: 28, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          {Platform.OS === 'ios' ? <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>{label}</Text>
        </View>
      )}
    </View>
  );
}

export default function ProgrammesTV({ piliers, lang, activeProgram, onOpenPilier, onOpenSeance, seancesByKey }) {
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;

  function pilierByKey(k) { return (piliers || []).find(function (p) { return p.key === k; }); }

  // Rangée "Séances courtes".
  const shortItems = [];
  (piliers || []).forEach(function (p) {
    ((seancesByKey && seancesByKey[p.key]) || []).forEach(function (s, i) {
      if (s[2] === 'Comprendre' || s[2] === 'Ressentir') return;
      if (!s[3]) return;
      shortItems.push({ key: 'short_' + p.key + '_' + i, title: s[0], subtitle: s[1] + ' · ' + p.label, image: pickSessionImage(p.key, i), pilier: p, idx: i, _min: parseMin(s[1]) });
    });
  });
  shortItems.sort(function (a, b) { return a._min - b._min; });
  const shortRow = shortItems.slice(0, 8);

  // Hero programme actif.
  let activeHero = null;
  try {
    if (activeProgram) {
      const stats = getProgramStats(activeProgram);
      const next = stats && stats.nextSession;
      const nextPil = next && pilierByKey(next.pilier_key);
      if (nextPil) activeHero = { program: activeProgram, stats: stats, pilier: nextPil };
    }
  } catch (e) { activeHero = null; }

  const heroH = Math.round(SH * 0.52);
  const themeItems = THEMES.map(function (t) {
    return { key: 't_' + t.key, title: tr[t.titleKey] || t.fallback, subtitle: t.duration, image: t.img, pilier: pilierByKey(t.pilier) };
  });

  // Priorité du focus initial : hero → séances courtes → 1re card sur-mesure.
  const heroFocus = !!activeHero;
  const shortFocus = !activeHero && shortRow.length > 0;
  const wideFocus = !activeHero && shortRow.length === 0;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90, paddingTop: activeHero ? 0 : 140 }}>
        {/* 1 — Hero programme actif */}
        {activeHero ? (
          <View style={{ height: heroH, overflow: 'hidden', marginBottom: 40 }}>
            <Image source={PILIER_IMAGES[activeHero.pilier.key]} contentFit="cover" transition={250} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.55)', '#000000']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={{ position: 'absolute', left: SIDE, right: SIDE, bottom: 48 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: FITNESS_GREEN, letterSpacing: 1.2, marginBottom: 8 }}>
                {(tr.program_active_tag || 'PROGRAMME ACTIF') + ' · ' + (tr.program_week_label || 'Semaine') + ' ' + activeHero.stats.currentWeek + '/' + activeHero.program.duration_weeks}
              </Text>
              <Text numberOfLines={1} style={[{ fontSize: 66, fontWeight: '800', color: '#ffffff', letterSpacing: -1.2, marginBottom: 10 }, TEXT_SHADOW]}>
                {activeHero.program.name || (tr.program_default_name || 'Programme')}
              </Text>
              <Text style={[{ fontSize: 24, fontWeight: '500', color: 'rgba(255,255,255,0.82)' }, TEXT_SHADOW]}>
                {activeHero.stats.percent + '% · ' + (tr.program_next_label || 'Prochaine séance') + ' : ' + activeHero.pilier.label}
              </Text>
              <FocusableSurface focusPreferred={heroFocus} height={56} glowColor={FITNESS_GREEN} radius={30} onPress={function () { onOpenPilier(activeHero.pilier); }}>
                <View style={{ backgroundColor: FITNESS_GREEN, flex: 1, paddingHorizontal: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: '#001B10' }}>{'▶  ' + (isFr ? 'Continuer' : 'Continue')}</Text>
                </View>
              </FocusableSurface>
            </View>
          </View>
        ) : null}

        {/* 2 — Séances courtes */}
        {shortRow.length > 0 ? (
          <HorizontalCarousel
            title={isFr ? 'Séances courtes' : 'Quick sessions'}
            items={shortRow}
            firstFocus={shortFocus}
            onItemPress={function (it) { if (onOpenSeance) onOpenSeance(it.pilier, it.idx); else onOpenPilier(it.pilier); }}
          />
        ) : null}

        {/* 3 — Vos programmes sur mesure (card large étirée) */}
        <Text style={[{ fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, paddingLeft: SIDE, marginBottom: 18 }, TEXT_SHADOW]}>
          {tr.prog_section_title || 'Vos programmes sur mesure'}
        </Text>
        <View style={{ paddingHorizontal: SIDE, marginBottom: 44 }}>
          <FocusableSurface focusPreferred={wideFocus} height={220} onPress={function () { var p = pilierByKey('p1'); if (p) onOpenPilier(p); }}>
            <Image source={PILIER_IMAGES.p1} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 44 }}>
              <Text style={[{ fontSize: 40, fontWeight: '800', color: '#ffffff', letterSpacing: -0.8, marginBottom: 6 }, TEXT_SHADOW]}>{tr.prog_debuter || 'Débuter'}</Text>
              <Text style={[{ fontSize: 20, fontWeight: '500', color: 'rgba(255,255,255,0.85)', marginBottom: 4 }, TEXT_SHADOW]}>{tr.prog_debuter_sub || 'Épaules, Dos et Mobilité'}</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: FITNESS_GREEN, letterSpacing: 1.5 }}>{tr.prog_debuter_duree || '3 JOURS · 10 MIN/JOUR'}</Text>
              <VisualPill label={tr.prog_apercu || 'Aperçu du programme'} />
            </View>
          </FocusableSurface>
        </View>

        {/* 4 — Créez votre propre programme (mauve) */}
        <Text style={[{ fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, paddingLeft: SIDE, marginBottom: 18 }, TEXT_SHADOW]}>
          {tr.prog_custom_title || 'Créez votre propre programme'}
        </Text>
        <View style={{ paddingHorizontal: SIDE, marginBottom: 44 }}>
          <FocusableSurface focusPreferred={false} height={200} glowColor="#B16CFF" onPress={function () { var p = pilierByKey('p7'); if (p) onOpenPilier(p); }}>
            <LinearGradient colors={['#7A5CFF', '#B16CFF']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 44 }}>
              <Text style={[{ fontSize: 38, fontWeight: '800', color: '#ffffff', letterSpacing: -0.6, marginBottom: 8 }, TEXT_SHADOW]}>{tr.prog_custom_card || 'Programme personnalisé'}</Text>
              <Text style={[{ fontSize: 19, fontWeight: '500', color: 'rgba(255,255,255,0.9)', maxWidth: 720 }, TEXT_SHADOW]}>{tr.prog_custom_card_sub || 'Vos activités, la durée de vos exercices, vos jours et votre rythme.'}</Text>
              <VisualPill label={tr.prog_custom_btn || 'Créer un programme'} />
            </View>
          </FocusableSurface>
        </View>

        {/* 4b — À propos de Sabrina */}
        <View style={{ paddingHorizontal: SIDE, marginBottom: 44 }}>
          <FocusableSurface focusPreferred={false} height={220} onPress={function () { var p = pilierByKey('p7'); if (p) onOpenPilier(p); }}>
            <Image source={SABRINA_ABOUT} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)']} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 44, maxWidth: '70%' }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: FITNESS_GREEN, letterSpacing: 1.5, marginBottom: 8 }}>{(tr.coach_avec || 'Avec Sabrina').toUpperCase()}</Text>
              <Text style={[{ fontSize: 38, fontWeight: '800', color: '#ffffff', letterSpacing: -0.6, marginBottom: 8 }, TEXT_SHADOW]}>{tr.coach_name || 'Sabrina'}</Text>
              <Text numberOfLines={2} style={[{ fontSize: 19, fontWeight: '500', color: 'rgba(255,255,255,0.88)', lineHeight: 26 }, TEXT_SHADOW]}>
                {isFr
                  ? 'Coach Pilates depuis 1995, fondatrice d’Espace Pilates Suisse. Elle te guide à chaque séance.'
                  : 'Pilates coach since 1995, founder of Espace Pilates Suisse. She guides you through every session.'}
              </Text>
            </View>
          </FocusableSurface>
        </View>

        {/* 5 — Programmes thématiques (carrousel cinématique) */}
        <HorizontalCarousel
          title={tr.prog_thematiques_title || 'Programmes thématiques'}
          items={themeItems}
          cardWidth={420}
          onItemPress={function (it) { if (it.pilier) onOpenPilier(it.pilier); }}
        />
      </ScrollView>
    </View>
  );
}
