// ExplorerTV — onglet "Explorer" version Apple TV (style Fitness+).
//
// Layout 2 colonnes inspiré de Fitness+ :
//   - Gauche (~42%) : grand titre + description + 2 CTAs empilés (primaire
//     vert "Commencer" → ouvre le pilier recommandé ; secondaire "Découvrir
//     l'abonnement annuel" → paywall).
//   - Droite (~58%) : mosaïque 3×3 des visuels de piliers (décoratif).
// En bas : carrousel horizontal "Types d'activités" = les 9 piliers en cards
//   focusables → ouvre PilierPanelTV.
//
// Rendu en overlay plein écran sous la TVTopBar. TV-only — zéro impact iPhone.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Text, ScrollView, StyleSheet, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import HorizontalCarousel from './HorizontalCarousel';
import { tvFocusProps } from '../../utils/platformTV';
import { PILIER_IMAGES } from '../../constants/data';

const { width: SW, height: SH } = Dimensions.get('window');
const SIDE = 80;
const FITNESS_GREEN = '#00DB7D';

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

export default function ExplorerTV({ piliers, seancesByKey, onOpenPilier, onActivateSubscription, lang }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;

  // Colonne droite : mosaïque 3×3 décorative.
  const innerW = SW - SIDE * 2;
  const rightW = Math.round(innerW * 0.56);
  const leftW = innerW - rightW - 40;
  const mosaicGap = 10;
  const cellW = Math.floor((rightW - mosaicGap * 2) / 3);
  const cellH = Math.round(cellW * 0.66);

  const carouselItems = (piliers || []).map(function (p) {
    return {
      key: 'exp_' + p.key,
      title: p.label,
      subtitle: (((seancesByKey && seancesByKey[p.key]) || []).length) + ' ' + (isFr ? 'séances' : 'sessions'),
      image: PILIER_IMAGES[p.key],
      pilier: p,
    };
  });
  const firstPilier = piliers && piliers[0];

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: '#000000' }}>
      <LinearGradient colors={['#000000', '#0F1014']} locations={[0, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 150, paddingBottom: 90 }}>
        {/* Bloc 2 colonnes */}
        <View style={{ flexDirection: 'row', paddingHorizontal: SIDE, marginBottom: 56 }}>
          <View style={{ width: leftW, paddingRight: 24, justifyContent: 'center' }}>
            <Text style={{ fontSize: 52, fontWeight: '800', color: '#ffffff', letterSpacing: -1, lineHeight: 58, marginBottom: 18 }}>
              {isFr ? 'Des exercices pour tout le monde' : 'Workouts for everyone'}
            </Text>
            <Text style={{ fontSize: 21, fontWeight: '400', color: 'rgba(255,255,255,0.66)', lineHeight: 29, marginBottom: 30 }}>
              {isFr
                ? 'Pilates conscient guidé par Sabrina, à ton rythme. Choisis un pilier et commence quand tu veux.'
                : 'Conscious Pilates guided by Sabrina, at your pace. Pick a pillar and start anytime.'}
            </Text>
            <CTA
              label={isFr ? 'Commencer' : 'Start'}
              variant="primary"
              focusPreferred
              onPress={function () { if (firstPilier) onOpenPilier(firstPilier); }}
            />
            <CTA
              label={isFr ? "Découvrir l'abonnement annuel" : 'Discover annual plan'}
              variant="secondary"
              onPress={function () { if (onActivateSubscription) onActivateSubscription(); }}
            />
          </View>
          <View style={{ width: rightW, flexDirection: 'row', flexWrap: 'wrap', gap: mosaicGap }} pointerEvents="none">
            {(piliers || []).slice(0, 9).map(function (p) {
              return (
                <View key={'mo_' + p.key} style={{ width: cellW, height: cellH, borderRadius: 14, overflow: 'hidden', backgroundColor: '#10131C' }}>
                  <Image source={PILIER_IMAGES[p.key]} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
                  <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
                </View>
              );
            })}
          </View>
        </View>

        {/* Carrousel types d'activités */}
        <HorizontalCarousel
          title={isFr ? "Types d'activités" : 'Activity types'}
          items={carouselItems}
          onItemPress={function (it) { onOpenPilier(it.pilier); }}
        />
      </ScrollView>
    </View>
  );
}
