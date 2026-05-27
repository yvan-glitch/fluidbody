// DailyIntentionPrompt — modal "Comment veux-tu te sentir aujourd'hui ?"
// reformulé en cards plein écran (image Sabrina en background, gradient
// sombre du haut vers le bas, icône SVG simple, label en grand). Refait
// d'après feedback : "les emojis bruts ne sont pas à la hauteur".
//
// iPhone : 5 cards verticales empilées (scrollable si écran court).
// Apple TV : 5 cards horizontales focusables côte-à-côte.
//
// Sélection → animation fade-out (~600 ms) puis onPicked(key).

import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Animated, Easing, TouchableOpacity, Platform, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import LiquidGlass from './LiquidGlass';
import Svg, { Path, Circle } from 'react-native-svg';

import { INTENTIONS, setTodayIntention } from '../utils/dailyIntention';
import { SABRINA_IMAGES } from './tv/tvImagePool';
import { IS_TV } from '../utils/platformTV';

const { width: SW, height: SH } = Dimensions.get('window');
const IS_IPAD = SW >= 768;

// Mapping intention → photo Sabrina + tint + icône SVG simple.
// Les indices sont choisis pour évoquer l'état (calme/énergique/ancré/…)
// sans dépendre de la sémantique exacte de chaque photo (que je n'ai pas
// vue à l'œil) — la rotation hashStr-stable du tvImagePool a déjà rendu
// ces images familières dans le reste de la TV.
const INTENT_VISUAL = {
  calme:     { img: SABRINA_IMAGES[2], tint: 'rgba(60,180,210,1)' },   // bleu calme
  energique: { img: SABRINA_IMAGES[8], tint: 'rgba(255,120,40,1)' },   // orange feu
  ancre:     { img: SABRINA_IMAGES[5], tint: 'rgba(160,200,90,1)' },   // vert ancré
  souple:    { img: SABRINA_IMAGES[12], tint: 'rgba(120,200,230,1)' }, // turquoise fluide
  leger:     { img: SABRINA_IMAGES[15], tint: 'rgba(240,220,255,1)' }, // mauve clair
};

// Icônes SVG simples — pas de bibliothèque externe.
function Icon({ kind, size, color }) {
  const s = size;
  if (kind === 'calme') {
    return (
      <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
        <Circle cx="24" cy="24" r="18" stroke={color} strokeWidth={2.2} opacity={0.45} />
        <Circle cx="24" cy="24" r="11" stroke={color} strokeWidth={2.2} opacity={0.75} />
        <Circle cx="24" cy="24" r="5"  stroke={color} strokeWidth={2.2} />
      </Svg>
    );
  }
  if (kind === 'energique') {
    return (
      <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
        <Path d="M26 4 L10 28 H22 L18 44 L36 18 H24 L26 4 Z" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      </Svg>
    );
  }
  if (kind === 'ancre') {
    // Trois pics de montagne stylisée
    return (
      <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
        <Path d="M4 40 L16 20 L22 28 L30 14 L44 40 Z" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
        <Path d="M4 40 H44" stroke={color} strokeWidth={1.6} opacity={0.55} />
      </Svg>
    );
  }
  if (kind === 'souple') {
    // Vague sinusoïdale fluide
    return (
      <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
        <Path d="M4 18 C 12 8, 20 28, 28 18 S 44 8, 44 18" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        <Path d="M4 30 C 12 20, 20 40, 28 30 S 44 20, 44 30" stroke={color} strokeWidth={2.4} strokeLinecap="round" opacity={0.6} />
      </Svg>
    );
  }
  if (kind === 'leger') {
    // Plume schématique
    return (
      <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
        <Path d="M36 8 C 22 12, 12 22, 12 36 L 8 40 M16 32 L 28 32 M20 24 L 30 24 M24 18 L 32 18" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Une card. Focus tvOS : scale 1.10, glow blanc fort, ring blanc.
// ─────────────────────────────────────────────────────────────
function IntentionCard({ intent, lang, width, height, focusPreferred, onPress, picked }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  useEffect(function () {
    Animated.parallel([
      Animated.timing(scale, { toValue: focused ? 1.10 : (picked ? 0.96 : 1), duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [focused, picked]);
  const v = INTENT_VISUAL[intent.key] || INTENT_VISUAL.calme;
  const titleSize = IS_TV ? 56 : (IS_IPAD ? 44 : 34);
  const iconSize = IS_TV ? 64 : 48;
  return (
    <Animated.View style={[
      { width: width, height: height, borderRadius: 28, transform: [{ scale: scale }] },
      focused ? (Platform.OS === 'ios'
        ? { shadowColor: '#FFFFFF', shadowOpacity: 0.75, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } }
        : { elevation: 30 }) : null,
    ]}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        hasTVPreferredFocus={focusPreferred}
        accessibilityRole="button"
        accessibilityLabel={isFr ? intent.labelFr : intent.labelEn}
        style={{ flex: 1, borderRadius: 28, overflow: 'hidden', borderWidth: focused ? 3 : 1.2, borderColor: focused ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)' }}
      >
        <Image source={v.img} contentFit="cover" transition={300} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
        {/* Gradient sombre haut→bas pour la lisibilité du label */}
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.78)']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Voile teinté très subtil par intention (tint=cf. INTENT_VISUAL) */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: v.tint, opacity: 0.10 }]} pointerEvents="none" />
        {/* Overlay focusé : sortir la card du fond */}
        {focused ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.05)' }]} pointerEvents="none" />
        ) : null}
        {/* Contenu */}
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: IS_TV ? 28 : 22 }}>
          <View style={{ marginBottom: 14 }}>
            <Icon kind={intent.key} size={iconSize} color={focused ? '#AEEF4D' : '#ffffff'} />
          </View>
          <Text style={{ fontSize: titleSize, fontWeight: '800', color: '#ffffff', letterSpacing: -0.8, lineHeight: titleSize * 1.05 }}>
            {isFr ? intent.labelFr : intent.labelEn}
          </Text>
        </View>
      </TouchableOpacity>
      {/* Ring blanc focus (au-dessus du clip de la TouchableOpacity, donc visible) */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 31, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', opacity: ringOpacity }}
      />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────
export default function DailyIntentionPrompt({ visible, lang, onPicked, onClose }) {
  const [pickedKey, setPickedKey] = useState(null);
  const fade = useRef(new Animated.Value(0)).current;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  useEffect(function () {
    if (!visible) { fade.setValue(0); setPickedKey(null); return undefined; }
    Animated.timing(fade, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible]);
  if (!visible) return null;
  function choose(intent) {
    if (pickedKey) return;
    setPickedKey(intent.key);
    setTodayIntention(intent.key);
    Animated.timing(fade, { toValue: 0, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(function () {
      if (onPicked) onPicked(intent.key);
      setPickedKey(null);
    });
  }
  // Dimensions des cards
  let cardW, cardH, gap;
  if (IS_TV) {
    gap = 22;
    const sidePad = 80;
    const inner = SW - sidePad * 2 - gap * 4;
    cardW = Math.floor(inner / 5);
    cardH = Math.min(Math.round(SH * 0.58), 560);
  } else if (IS_IPAD) {
    gap = 18;
    cardW = Math.min(560, SW - 80);
    cardH = 160;
  } else {
    gap = 14;
    cardW = SW - 40;
    cardH = 130;
  }
  return (
    <Modal visible animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {/* Fond très brouillé pour effacer toute l'app derrière */}
        {Platform.OS === 'ios' ? (
          <LiquidGlass intensity={Platform.OS === 'ios' ? 95 : 0} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2,12,24,0.78)' }]} pointerEvents="none" />

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: IS_TV ? 60 : 50 }}>
          <Text style={{ fontSize: IS_TV ? 16 : 12, color: '#AEEF4D', letterSpacing: IS_TV ? 4 : 2.5, textTransform: 'uppercase', fontWeight: '800', marginBottom: IS_TV ? 16 : 10 }}>
            {isFr ? 'Intention du jour' : 'Daily intention'}
          </Text>
          <Text style={{ fontSize: IS_TV ? 44 : (IS_IPAD ? 36 : 28), fontWeight: '700', color: '#ffffff', textAlign: 'center', letterSpacing: -0.5, paddingHorizontal: 28, marginBottom: IS_TV ? 38 : 24, maxWidth: 900 }}>
            {isFr ? 'Comment veux-tu te sentir aujourd’hui ?' : 'How do you want to feel today?'}
          </Text>

          {IS_TV ? (
            <View style={{ flexDirection: 'row', gap: gap, paddingHorizontal: 80 }}>
              {INTENTIONS.map(function (o, i) {
                return (
                  <IntentionCard
                    key={o.key}
                    intent={o}
                    lang={lang}
                    width={cardW}
                    height={cardH}
                    focusPreferred={i === 0}
                    picked={pickedKey != null && pickedKey !== o.key}
                    onPress={function () { choose(o); }}
                  />
                );
              })}
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: gap }} style={{ alignSelf: 'stretch' }}>
              {INTENTIONS.map(function (o) {
                return (
                  <View key={o.key} style={{ marginBottom: gap, alignItems: 'center' }}>
                    <IntentionCard
                      intent={o}
                      lang={lang}
                      width={cardW}
                      height={cardH}
                      picked={pickedKey != null && pickedKey !== o.key}
                      onPress={function () { choose(o); }}
                    />
                  </View>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={isFr ? 'Passer' : 'Skip'} style={{ paddingVertical: 14, paddingHorizontal: 22, marginTop: IS_TV ? 24 : 14 }}>
            <Text style={{ fontSize: IS_TV ? 18 : 14, color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
              {isFr ? 'Plus tard' : 'Later'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}
