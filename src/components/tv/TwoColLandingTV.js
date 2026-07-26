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
import { getDailyQuote } from '../../constants/sabrinaQuotes';
import { getTodayIntention, getPilierKeyForIntention, findIntention } from '../../utils/dailyIntention';
import { getCachedFavorites, primeFavoritesCache, subscribeFavorites } from '../../utils/favorites';
import { pickBadge } from '../../utils/sessionBadges';
import { getThisWeekSchedule } from '../../utils/weeklySchedule';
import { isSeanceVisible } from '../../utils/catalogVisibility';

const { width: SW } = Dimensions.get('window');
const SIDE = 80;
const FITNESS_GREEN = '#AEEF4D'; // lime marque — couleur d'action unique TV (ex-#00DB7D)
const TEXT_SHADOW = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } };
const GLOW = Platform.OS === 'ios'
  ? { shadowColor: '#FFFFFF', shadowOpacity: 0.78, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } }
  : { elevation: 30 };

function CTA({ label, variant, onPress, focusPreferred }) {
  const primary = variant === 'primary';
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const ringO = useRef(new Animated.Value(0)).current;
  useEffect(function () {
    Animated.parallel([
      Animated.timing(scale, { toValue: focused ? 1.08 : 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringO, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [focused]);
  return (
    <Animated.View style={[{ alignSelf: 'flex-start', marginBottom: 14, borderRadius: 32, transform: [{ scale: scale }] }, focused && primary ? { shadowColor: FITNESS_GREEN, shadowOpacity: 0.7, shadowRadius: 28, shadowOffset: { width: 0, height: 4 } } : (focused ? GLOW : null)]}>
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{ borderRadius: 32, overflow: 'hidden' }}
      >
        {primary ? (
          // Pill verte frostée — frost BlurView en dessous pour aplatir
          // le vert pur et donner l'effet aquatique demandé.
          <View style={{ paddingVertical: 16, paddingHorizontal: 40, position: 'relative', overflow: 'hidden' }}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={35} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
            ) : null}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: focused ? 'rgba(196,247,110,0.95)' : 'rgba(174,239,77,0.9)' }]} pointerEvents="none" />
            <View style={[StyleSheet.absoluteFill, { borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)' }]} pointerEvents="none" />
            <Text style={{ fontSize: 21, fontWeight: '700', color: '#001B10', letterSpacing: 0.2 }}>{label}</Text>
          </View>
        ) : (
          // Pill secondaire — frost dark.
          <View style={{ paddingVertical: 16, paddingHorizontal: 40, position: 'relative', overflow: 'hidden' }}>
            {Platform.OS === 'ios' ? <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: focused ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)' }]} pointerEvents="none" />
            <View style={[StyleSheet.absoluteFill, { borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]} pointerEvents="none" />
            <Text style={{ fontSize: 21, fontWeight: '600', color: '#ffffff', letterSpacing: 0.2 }}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 35, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', opacity: ringO }} />
    </Animated.View>
  );
}

// Cellule mosaïque focusable (image seule, scale + glow + ring blanc 3 px).
function MosaicCell({ image, size, onPress, focusPreferred }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const ringO = useRef(new Animated.Value(0)).current;
  useEffect(function () {
    Animated.parallel([
      Animated.timing(scale, { toValue: focused ? 1.08 : 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringO, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [focused]);
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: 18, transform: [{ scale: scale }] }, focused ? GLOW : null]}>
      <TouchableOpacity
        {...tvFocusProps(!!focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{ flex: 1, borderRadius: 18, overflow: 'hidden' }}
      >
        <Image source={image} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
        {focused ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
        ) : null}
      </TouchableOpacity>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 21, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', opacity: ringO }} />
    </Animated.View>
  );
}

// Carte "Reprendre votre dernière séance" — pleine largeur, focusable.
function ResumeCard({ image, title, pilierLabel, positionMillis, durationMillis, label, onPress, focusPreferred }) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const ringO = useRef(new Animated.Value(0)).current;
  useEffect(function () {
    Animated.parallel([
      Animated.timing(scale, { toValue: focused ? 1.06 : 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringO, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [focused]);
  const ratio = durationMillis ? Math.max(0, Math.min(1, positionMillis / durationMillis)) : 0;
  const posMin = Math.round(positionMillis / 60000);
  const durMin = Math.round(durationMillis / 60000);
  // Glow blanc fort (cohérent avec le pass focus) + halo vert subtil de
  // signalisation "Reprendre".
  const glow = Platform.OS === 'ios' ? { shadowColor: '#FFFFFF', shadowOpacity: 0.72, shadowRadius: 38, shadowOffset: { width: 0, height: 0 } } : { elevation: 28 };
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
        {focused ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
        ) : null}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 44 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: FITNESS_GREEN, letterSpacing: 1.5, marginBottom: 8 }}>{label.toUpperCase()}</Text>
          <Text numberOfLines={1} style={[{ fontSize: 38, fontWeight: '800', color: '#ffffff', letterSpacing: -0.6, marginBottom: 4 }, TEXT_SHADOW]}>{title}</Text>
          <Text style={[{ fontSize: 18, fontWeight: '500', color: 'rgba(255,255,255,0.82)', marginBottom: 12 }, TEXT_SHADOW]}>{pilierLabel + ' · ' + posMin + ' / ' + durMin + ' min'}</Text>
          <View style={{ width: 360, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            <View style={{ width: Math.round(ratio * 360), height: 6, borderRadius: 3, backgroundColor: FITNESS_GREEN }} />
          </View>
        </View>
      </TouchableOpacity>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 27, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', opacity: ringO }} />
    </Animated.View>
  );
}

export default function TwoColLandingTV({ piliers, lang, title, description, primaryLabel, onPrimary, onOpenPilier, onOpenSeance, seancesByKey, onResume }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const [resume, setResume] = useState(null);
  const [intent, setIntent] = useState(null);
  const [intentPilier, setIntentPilier] = useState(null);
  const [favVersion, setFavVersion] = useState(0);
  useEffect(function () {
    let cancelled = false;
    getResumableSession().then(function (r) {
      if (cancelled || !r) return;
      const pil = (piliers || []).find(function (p) { return p.key === r.pilierKey; });
      const seance = pil && seancesByKey && seancesByKey[r.pilierKey] && seancesByKey[r.pilierKey][r.idx];
      if (pil && seance) setResume({ pilier: pil, idx: r.idx, seance: seance, positionMillis: r.positionMillis, durationMillis: r.durationMillis });
    }).catch(function () {});
    getTodayIntention().then(function (k) {
      if (cancelled || !k) return;
      const found = findIntention(k);
      const pilKey = getPilierKeyForIntention(k);
      const pil = pilKey && (piliers || []).find(function (p) { return p.key === pilKey; });
      if (found) setIntent(found);
      if (pil) setIntentPilier(pil);
    }).catch(function () {});
    // Précharge le cache favoris + abonne aux changements pour rerender la
    // rangée "Mes favoris" en live quand l'utilisateur toggle un cœur ailleurs.
    primeFavoritesCache();
    const unsub = subscribeFavorites(function () { setFavVersion(function (v) { return v + 1; }); });
    return function () { cancelled = true; if (unsub) unsub(); };
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

  // Métadonnées enrichies sous le titre : nombre total de séances du
  // catalogue + minutes totales + "Avec Sabrina". Hors mode HIDE_UNFILMED,
  // on compte TOUT (pas de filtre vidéo — sinon on affichait "0 séances"
  // tant que peu de vidéos étaient tournées). En mode App Store, on ne
  // compte que le visible. Parser de durée gère "12 min" et "1'59''" :
  // X'YY'' → X + YY/60 minutes.
  const heroMeta = (function () {
    let count = 0;
    let totalMinDecimal = 0;
    (piliers || []).forEach(function (p) {
      const arr = (seancesByKey && seancesByKey[p.key]) || [];
      arr.forEach(function (s, i) {
        if (!s) return;
        if (!isSeanceVisible(p.key, i)) return;
        count += 1;
        const raw = String(s[1] || '');
        const ap = raw.match(/(\d+)\s*'\s*(\d+)/);
        if (ap) { totalMinDecimal += parseInt(ap[1], 10) + parseInt(ap[2], 10) / 60; return; }
        const m = raw.match(/(\d+)/);
        if (m) totalMinDecimal += parseInt(m[1], 10);
      });
    });
    const totalMin = Math.round(totalMinDecimal);
    const hours = Math.round(totalMin / 60);
    const minLabel = hours >= 2
      ? (hours + (isFr ? ' h de pratique' : ' h of practice'))
      : (totalMin + (isFr ? ' min de pratique' : ' min of practice'));
    const left = count + (isFr ? ' séances guidées' : ' guided sessions');
    return left + ' · ' + minLabel + ' · ' + (isFr ? 'Avec Sabrina' : 'With Sabrina');
  })();

  // Rangée "Mes favoris" — depuis le cache synchrone (alimenté par
  // primeFavoritesCache + maintenu par subscribeFavorites). On ne rend
  // rien si l'utilisateur n'a aucun favori. favVersion dans les deps
  // garantit un rebuild quand un cœur change ailleurs dans l'app.
  // eslint-disable-next-line no-unused-vars
  const _favTrigger = favVersion; // force recompute when favorites flip
  const favItems = [];
  const favIds = getCachedFavorites() || [];
  for (let i = 0; i < favIds.length; i++) {
    const id = favIds[i];
    const us = id.lastIndexOf('_');
    if (us < 1) continue;
    const pk = id.slice(0, us);
    const idx = parseInt(id.slice(us + 1), 10);
    if (Number.isNaN(idx)) continue;
    const pil = (piliers || []).find(function (p) { return p.key === pk; });
    const seance = pil && seancesByKey && seancesByKey[pk] && seancesByKey[pk][idx];
    if (!pil || !seance) continue;
    favItems.push({
      key: 'fav_' + id,
      title: seance[0],
      subtitle: seance[1] + ' · ' + pil.label,
      image: pickSessionImage(pk, idx),
      badge: pickBadge({ pilierKey: pk, idx: idx, lang: lang, isFavorite: true }),
      pilier: pil,
      idx: idx,
    });
    if (favItems.length >= 8) break;
  }

  // Rangée "Cette semaine" — 7 séances réparties sur les 7 prochains jours.
  // L'intention du jour biaise la séance J0 vers le pilier matchant.
  // Badge "LUN", "MAR", … dérivé du jour. Stable au sein d'une même date
  // (seed dayOfYear), bouge automatiquement à 00:00.
  const weekSchedule = getThisWeekSchedule(piliers, seancesByKey, {
    intentionKey: intent && intent.key,
    lang: lang,
  });
  const weekItems = weekSchedule.map(function (e) {
    return {
      key: 'wk_' + e.dayIdx + '_' + e.pilier.key + '_' + e.idx,
      title: e.seance[0],
      subtitle: e.seance[1] + ' · ' + e.pilier.label,
      image: pickSessionImage(e.pilier.key, e.idx),
      badge: { label: e.dayLabel, tone: 'white' },
      pilier: e.pilier,
      idx: e.idx,
    };
  });

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 184, paddingBottom: 90 }}>
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
            {intent && intentPilier ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={function () { onOpenPilier(intentPilier); }}
                accessibilityRole="button"
                accessibilityLabel={(isFr ? 'Intention du jour' : 'Daily intention') + ' : ' + (isFr ? intent.labelFr : intent.labelEn) + ' → ' + intentPilier.label}
                style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(174,239,77,0.14)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.5)', marginBottom: 14 }}
              >
                <Text style={{ fontSize: 22 }}>{intent.emoji}</Text>
                <Text style={{ fontSize: 12, color: '#AEEF4D', fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>{isFr ? 'Intention' : 'Intention'}</Text>
                <Text style={{ fontSize: 16, color: '#ffffff', fontWeight: '700' }}>{isFr ? intent.labelFr : intent.labelEn}</Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>{'·'}</Text>
                <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.78)', fontWeight: '500' }}>{intentPilier.label}</Text>
                <Text style={{ fontSize: 18, color: '#AEEF4D', fontWeight: '300', marginLeft: 4 }}>{'›'}</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={[{ fontSize: 16, fontWeight: '500', fontStyle: 'italic', color: 'rgba(255,255,255,0.62)', letterSpacing: 0.2, marginBottom: 12 }, TEXT_SHADOW]}>« {getDailyQuote()} »</Text>
            <Text style={[{ fontSize: 56, fontWeight: '800', color: '#ffffff', letterSpacing: -1, lineHeight: 62, marginBottom: 10 }, TEXT_SHADOW]}>{t}</Text>
            {/* Métadata enrichie : X séances · Y min · Avec Sabrina. */}
            <Text style={[{ fontSize: 17, fontWeight: '500', color: 'rgba(255,255,255,0.78)', letterSpacing: 0.3, marginBottom: 16 }, TEXT_SHADOW]}>{heroMeta}</Text>
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

        {/* Rangée "Mes favoris" — masquée si l'utilisateur n'a aucun cœur.
            Au tap d'une card, on ouvre directement la séance (onOpenSeance)
            ou à défaut le pilier (fallback existant onOpenPilier). */}
        {favItems.length > 0 ? (
          <HorizontalCarousel
            title={isFr ? 'Mes favoris' : 'My favorites'}
            items={favItems}
            onItemPress={function (it) {
              if (onOpenSeance) { onOpenSeance(it.pilier, it.idx); return; }
              if (onOpenPilier) onOpenPilier(it.pilier);
            }}
          />
        ) : null}

        {/* Rangée "Cette semaine" — 7 séances/7 jours, biaisée par
            l'intention du jour si présente. Badge en haut-left avec le
            jour (LUN, MAR, ...). */}
        {weekItems.length > 0 ? (
          <HorizontalCarousel
            title={isFr ? 'Cette semaine' : 'This week'}
            items={weekItems}
            onItemPress={function (it) {
              if (onOpenSeance) { onOpenSeance(it.pilier, it.idx); return; }
              if (onOpenPilier) onOpenPilier(it.pilier);
            }}
          />
        ) : null}

        <HorizontalCarousel
          title={isFr ? "Types d'activités" : 'Activity types'}
          items={carouselItems}
          onItemPress={function (it) { onOpenPilier(it.pilier); }}
        />
      </ScrollView>
    </View>
  );
}
