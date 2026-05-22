// TwoColLandingTV — landing 2 colonnes style Apple Fitness+ "Explorer",
// utilisé pour la page "Pour vous" sur Apple TV :
//   - Gauche (~40%) : titre H1 + description + prix + 2 CTAs pill empilés
//     (vert "Commencez l'exercice" + clair "Économisez avec le forfait").
//   - Droite (~58%) : mosaïque 3×3 FOCUSABLE des 9 piliers (scale 1.08 +
//     glow blanc + bordure ; ouvre PilierPanelTV au press). Pas de BlurView.
//   - Bas : carrousel horizontal "Types d'activités" (9 piliers) avec dots.
//
// TV-only — zéro impact iPhone.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, ScrollView, StyleSheet, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import HorizontalCarousel from './HorizontalCarousel';
import { pickSessionImage } from './tvImagePool';
import { tvFocusProps } from '../../utils/platformTV';
import { PILIER_IMAGES } from '../../constants/data';
import { getResumableSession } from '../../utils';

const { width: SW } = Dimensions.get('window');
const SIDE = 80;
const FITNESS_GREEN = '#00DB7D';
const TEXT_SHADOW = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } };
const GLOW = Platform.OS === 'ios'
  ? { shadowColor: '#FFFFFF', shadowOpacity: 0.55, shadowRadius: 26, shadowOffset: { width: 0, height: 0 } }
  : { elevation: 22 };

function CTA({ label, variant, onPress, focusPreferred }) {
  const primary = variant === 'primary';
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(function () {
    Animated.timing(scale, { toValue: focused ? 1.05 : 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [focused]);
  return (
    <Animated.View style={[{ alignSelf: 'flex-start', marginBottom: 14, borderRadius: 30, transform: [{ scale: scale }] }, focused && primary ? { shadowColor: FITNESS_GREEN, shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } } : null]}>
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{ borderRadius: 30, overflow: 'hidden', borderWidth: primary ? 0 : 1, borderColor: 'rgba(255,255,255,0.3)' }}
      >
        {primary ? (
          <View style={{ backgroundColor: focused ? '#00F08A' : FITNESS_GREEN, paddingVertical: 16, paddingHorizontal: 40 }}>
            <Text style={{ fontSize: 21, fontWeight: '700', color: '#001B10', letterSpacing: 0.2 }}>{label}</Text>
          </View>
        ) : (
          <View style={{ paddingVertical: 16, paddingHorizontal: 40, backgroundColor: focused ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.5)' }}>
            {Platform.OS === 'ios' ? <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
            <Text style={{ fontSize: 21, fontWeight: '600', color: '#ffffff', letterSpacing: 0.2 }}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// Cellule mosaïque focusable (image seule, scale + glow + bordure, sans blur).
function MosaicCell({ image, size, onPress }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(function () {
    Animated.timing(scale, { toValue: focused ? 1.08 : 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [focused]);
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: 18, transform: [{ scale: scale }] }, focused ? GLOW : null]}>
      <TouchableOpacity
        {...tvFocusProps(false)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{ flex: 1, borderRadius: 18, overflow: 'hidden', borderWidth: focused ? 2 : 0, borderColor: 'rgba(255,255,255,0.5)' }}
      >
        <Image source={image} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// Carte "Reprendre votre dernière séance" — pleine largeur, focusable.
function ResumeCard({ image, title, pilierLabel, positionMillis, durationMillis, label, onPress, focusPreferred }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(function () {
    Animated.timing(scale, { toValue: focused ? 1.03 : 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [focused]);
  const ratio = durationMillis ? Math.max(0, Math.min(1, positionMillis / durationMillis)) : 0;
  const posMin = Math.round(positionMillis / 60000);
  const durMin = Math.round(durationMillis / 60000);
  const glow = Platform.OS === 'ios' ? { shadowColor: FITNESS_GREEN, shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } } : { elevation: 20 };
  return (
    <Animated.View style={[{ marginHorizontal: SIDE, marginBottom: 36, borderRadius: 24, transform: [{ scale: scale }] }, focused ? glow : null]}>
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{ height: 200, borderRadius: 24, overflow: 'hidden' }}
      >
        {image ? <Image source={image} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} /> : null}
        <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 44 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: FITNESS_GREEN, letterSpacing: 1.5, marginBottom: 8 }}>{label.toUpperCase()}</Text>
          <Text numberOfLines={1} style={[{ fontSize: 38, fontWeight: '800', color: '#ffffff', letterSpacing: -0.6, marginBottom: 4 }, TEXT_SHADOW]}>{title}</Text>
          <Text style={[{ fontSize: 18, fontWeight: '500', color: 'rgba(255,255,255,0.82)', marginBottom: 12 }, TEXT_SHADOW]}>{pilierLabel + ' · ' + posMin + ' / ' + durMin + ' min'}</Text>
          <View style={{ width: 360, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            <View style={{ width: Math.round(ratio * 360), height: 6, borderRadius: 3, backgroundColor: FITNESS_GREEN }} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function TwoColLandingTV({ piliers, lang, title, description, primaryLabel, onPrimary, onOpenPilier, seancesByKey, onResume }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const [resume, setResume] = useState(null);
  useEffect(function () {
    let cancelled = false;
    getResumableSession().then(function (r) {
      if (cancelled || !r) return;
      const pil = (piliers || []).find(function (p) { return p.key === r.pilierKey; });
      const seance = pil && seancesByKey && seancesByKey[r.pilierKey] && seancesByKey[r.pilierKey][r.idx];
      if (pil && seance) setResume({ pilier: pil, idx: r.idx, seance: seance, positionMillis: r.positionMillis, durationMillis: r.durationMillis });
    }).catch(function () {});
    return function () { cancelled = true; };
  }, [piliers, seancesByKey]);
  const t = title || (isFr ? 'Le Pilates conscient' : 'Conscious Pilates');
  const desc = description || (isFr ? 'Guidé par Sabrina, à ton rythme. Choisis un pilier et commence quand tu veux.' : 'Guided by Sabrina, at your pace. Pick a pillar and start anytime.');
  // Pas de prix / paywall sur TV : l'Apple TV est associée à l'abonnement
  // iPhone (pairing QR). On ne propose que de démarrer une séance.
  const primLabel = primaryLabel || (isFr ? 'Commencer la séance' : 'Start the session');
  const innerW = SW - SIDE * 2;
  const rightW = Math.round(innerW * 0.56);
  const leftW = innerW - rightW - 40;
  const cellGap = 12;
  const cellSize = Math.floor((rightW - cellGap * 2) / 3);

  const grid = (piliers || []).slice(0, 9);
  const carouselItems = (piliers || []).map(function (p) {
    return { key: 'pv2_' + p.key, title: p.label, subtitle: '', image: PILIER_IMAGES[p.key], pilier: p };
  });

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 150, paddingBottom: 90 }}>
        {resume ? (
          <ResumeCard
            image={pickSessionImage(resume.pilier.key, resume.idx)}
            title={resume.seance[0]}
            pilierLabel={resume.pilier.label}
            positionMillis={resume.positionMillis}
            durationMillis={resume.durationMillis}
            label={isFr ? 'Reprendre votre dernière séance' : 'Resume your last session'}
            focusPreferred
            onPress={function () { if (onResume) onResume(resume.pilier, resume.idx); else onOpenPilier(resume.pilier); }}
          />
        ) : null}
        <View style={{ flexDirection: 'row', paddingHorizontal: SIDE, marginBottom: 56 }}>
          {/* Colonne gauche */}
          <View style={{ width: leftW, paddingRight: 28, justifyContent: 'center' }}>
            <Text style={[{ fontSize: 56, fontWeight: '800', color: '#ffffff', letterSpacing: -1, lineHeight: 62, marginBottom: 18 }, TEXT_SHADOW]}>{t}</Text>
            <Text style={[{ fontSize: 21, fontWeight: '400', color: 'rgba(255,255,255,0.7)', lineHeight: 29, marginBottom: 26 }, TEXT_SHADOW]}>{desc}</Text>
            <CTA label={primLabel} variant="primary" focusPreferred={!resume} onPress={onPrimary} />
          </View>
          {/* Colonne droite : mosaïque 3×3 focusable */}
          <View style={{ width: rightW, flexDirection: 'row', flexWrap: 'wrap', gap: cellGap }}>
            {grid.map(function (p) {
              return (
                <MosaicCell
                  key={'mo_' + p.key}
                  image={PILIER_IMAGES[p.key]}
                  size={cellSize}
                  onPress={function () { onOpenPilier(p); }}
                />
              );
            })}
          </View>
        </View>

        <HorizontalCarousel
          title={isFr ? "Types d'activités" : 'Activity types'}
          items={carouselItems}
          onItemPress={function (it) { onOpenPilier(it.pilier); }}
        />
      </ScrollView>
    </View>
  );
}
