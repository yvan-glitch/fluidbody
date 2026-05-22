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
import { tvFocusProps } from '../../utils/platformTV';
import { PILIER_IMAGES } from '../../constants/data';

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

export default function TwoColLandingTV({ piliers, lang, title, description, price, primaryLabel, onPrimary, secondaryLabel, onSecondary, onOpenPilier }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const t = title || (isFr ? 'Le Pilates conscient' : 'Conscious Pilates');
  const desc = description || (isFr ? 'Guidé par Sabrina, à ton rythme. Choisis un pilier et commence quand tu veux.' : 'Guided by Sabrina, at your pace. Pick a pillar and start anytime.');
  const primLabel = primaryLabel || (isFr ? "Commencez l'exercice" : 'Start exercising');
  const secLabel = secondaryLabel || (isFr ? 'Économisez avec le forfait annuel' : 'Save with the annual plan');
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
        <View style={{ flexDirection: 'row', paddingHorizontal: SIDE, marginBottom: 56 }}>
          {/* Colonne gauche */}
          <View style={{ width: leftW, paddingRight: 28, justifyContent: 'center' }}>
            <Text style={[{ fontSize: 56, fontWeight: '800', color: '#ffffff', letterSpacing: -1, lineHeight: 62, marginBottom: 18 }, TEXT_SHADOW]}>{t}</Text>
            <Text style={[{ fontSize: 21, fontWeight: '400', color: 'rgba(255,255,255,0.7)', lineHeight: 29, marginBottom: 14 }, TEXT_SHADOW]}>{desc}</Text>
            {price ? <Text style={[{ fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginBottom: 24 }, TEXT_SHADOW]}>{price}</Text> : null}
            <CTA label={primLabel} variant="primary" focusPreferred onPress={onPrimary} />
            <CTA label={secLabel} variant="secondary" onPress={onSecondary} />
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
