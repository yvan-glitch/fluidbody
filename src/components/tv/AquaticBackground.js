// AquaticBackground — fond plein écran réservé aux écrans Apple TV.
//
// Reprend l'esprit du LivingBackground iPhone + le halo aquatique du
// PilierPanel (gradient profond + Rayons + bulles + méduses dérivantes)
// mais tuné pour la viewing distance TV :
//   - gradient 6 stops (anti-banding sur les TVs 1080p/4K)
//   - moins d'éléments mais plus gros (lisibles à 2-3 m)
//   - méduses XL avec breathing 4 s (rythme contemplatif)
//   - bulles plus grandes, opacity un peu plus discrète pour ne pas voler
//     l'attention du contenu focusé
//
// Perf : Apple TV HD (A8) — on plafonne à 6 méduses + 10 bulles, toutes
// les Animated.timing utilisent useNativeDriver, et on accepte une prop
// `paused` pour stopper les loops quand l'écran est hors focus (par ex.
// modal au-dessus). Le composant rend `null` si IS_TV = false par
// sécurité, même si on ne devrait jamais l'importer côté iPhone.

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Bulle, MeduseCornerIcon, Rayon } from '../Meduse';
import { IS_TV } from '../../utils/platformTV';

const { width: SW, height: SH } = Dimensions.get('window');

// Palette aquatique TV-scale — 6 stops pour éviter le banding visible à
// 1080p+ (les TVs amplifient les transitions linéaires). Reprend la
// palette PilierPanel iPhone, élargie en bas.
// Couleurs samplées pixel-près du splash iPhone (Yvan) : navy quasi-noir en
// HAUT → teal/turquoise lumineux en BAS.
const GRADIENT_COLORS = ['#021222', '#071C31', '#12324B', '#2B657D', '#479EB1', '#55BBC9'];
const GRADIENT_LOCATIONS = [0, 0.15, 0.30, 0.55, 0.75, 1];

// Bulles : positions déterministes pour rester stables au remount (et
// éviter qu'une bulle clignote au mauvais endroit après navigation).
// 6 bulles fines (perf — réduit de 10), montée lente 14–17 s.
const BULLES_TV = [
  { x: SW * 0.12, size: 12, delay: 0,    duration: 16000 },
  { x: SW * 0.30, size: 9,  delay: 3000, duration: 14000 },
  { x: SW * 0.46, size: 14, delay: 6000, duration: 17000 },
  { x: SW * 0.62, size: 10, delay: 1500, duration: 15000 },
  { x: SW * 0.78, size: 13, delay: 4500, duration: 16500 },
  { x: SW * 0.90, size: 9,  delay: 7500, duration: 14500 },
];

// Set "high" (~18 bulles) pour BreathingCheckIn : on veut le sentiment d'un
// vrai banc de bulles qui monte (effet méditation). Ralenti (durations
// 18-22 s) pour cohérence avec le rythme respiration.
const BULLES_TV_HIGH = [
  { x: SW * 0.05, size: 10, delay: 0,    duration: 20000 },
  { x: SW * 0.12, size: 13, delay: 1800, duration: 18500 },
  { x: SW * 0.19, size: 9,  delay: 4200, duration: 21000 },
  { x: SW * 0.27, size: 12, delay: 6500, duration: 19000 },
  { x: SW * 0.34, size: 8,  delay: 800,  duration: 22000 },
  { x: SW * 0.42, size: 14, delay: 3000, duration: 18000 },
  { x: SW * 0.49, size: 10, delay: 5400, duration: 20500 },
  { x: SW * 0.56, size: 11, delay: 7600, duration: 19500 },
  { x: SW * 0.62, size: 9,  delay: 1200, duration: 21500 },
  { x: SW * 0.69, size: 13, delay: 4000, duration: 18800 },
  { x: SW * 0.76, size: 8,  delay: 6100, duration: 20200 },
  { x: SW * 0.83, size: 12, delay: 8400, duration: 19200 },
  { x: SW * 0.88, size: 10, delay: 2400, duration: 22000 },
  { x: SW * 0.93, size: 11, delay: 5000, duration: 21000 },
  { x: SW * 0.97, size: 9,  delay: 7200, duration: 18700 },
];

// 5 méduses dérivantes — points de départ répartis (haut, bas, gauche,
// droite, centre). Tailles 80–140 px : grandes mais pas envahissantes.
// Arrière-plan : 6 méduses ~1.4× (perf — Yvan a trouvé 12 en foreground trop
// lourd ; on garde une taille généreuse mais moins d'éléments).
// 3 méduses (perf — réduit de 6), taille 1.4× conservée, bien dispersées.
const MEDUSES_TV = [
  { baseX: SW * 0.10, baseY: SH * 0.16, size: 140, breath: 3600, tint: 'rgba(174,239,77,1)' },
  { baseX: SW * 0.74, baseY: SH * 0.30, size: 132, breath: 4400, tint: 'rgba(0,220,255,1)' },
  { baseX: SW * 0.40, baseY: SH * 0.74, size: 112, breath: 4000, tint: 'rgba(0,189,208,1)' },
];

// Set "high" (~9 méduses) pour BreathingCheckIn — réparties sur 4 colonnes
// et 3 rangées hors centre (le BreathRing vit au milieu, on évite de
// l'envahir). Cycles de respiration ralentis pour le rituel méditatif.
const MEDUSES_TV_HIGH = [
  { baseX: SW * 0.06, baseY: SH * 0.10, size: 90,  breath: 5200, tint: 'rgba(174,239,77,0.95)' },
  { baseX: SW * 0.86, baseY: SH * 0.08, size: 110, breath: 5600, tint: 'rgba(0,220,255,0.95)' },
  { baseX: SW * 0.32, baseY: SH * 0.18, size: 78,  breath: 5000, tint: 'rgba(170,210,255,0.9)' },
  { baseX: SW * 0.66, baseY: SH * 0.22, size: 96,  breath: 5400, tint: 'rgba(0,189,208,0.92)' },
  { baseX: SW * 0.08, baseY: SH * 0.62, size: 104, breath: 5800, tint: 'rgba(0,220,255,0.92)' },
  { baseX: SW * 0.90, baseY: SH * 0.58, size: 88,  breath: 5200, tint: 'rgba(174,239,77,0.88)' },
  { baseX: SW * 0.26, baseY: SH * 0.82, size: 82,  breath: 5400, tint: 'rgba(170,210,255,0.88)' },
  { baseX: SW * 0.72, baseY: SH * 0.84, size: 100, breath: 5600, tint: 'rgba(0,189,208,0.92)' },
  { baseX: SW * 0.48, baseY: SH * 0.90, size: 76,  breath: 5800, tint: 'rgba(174,239,77,0.85)' },
];

function DriftingMeduse({ baseX, baseY, size, breath, tint, paused }) {
  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;

  useEffect(function() {
    if (paused) return;
    let mounted = true;
    let current = null;
    function drift() {
      if (!mounted) return;
      // Dérive aléatoire dans un rayon ~200–300 px autour du point initial.
      const tx = (Math.random() * 280) - 140;
      const ty = (Math.random() * 200) - 100;
      // Sweet spot 14–18 s : ni frénétique (11 s) ni trop lent (22 s+).
      const dur = 14000 + Math.random() * 4000;
      const p = Animated.parallel([
        Animated.timing(dx, { toValue: tx, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
        Animated.timing(dy, { toValue: ty, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
      ]);
      current = p;
      p.start(function() { if (mounted) drift(); });
    }
    const id = setTimeout(drift, Math.random() * 1500);
    return function() {
      mounted = false;
      clearTimeout(id);
      try { current && current.stop && current.stop(); } catch (e) {}
    };
  }, [paused]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: baseX,
        top: baseY,
        opacity: 0.82,
        transform: [{ translateX: dx }, { translateY: dy }],
      }}
    >
      <MeduseCornerIcon size={size} breathCycleMs={breath} breathMaxScale={1.18} tint={tint} />
    </Animated.View>
  );
}

// ── Couche FOND : dégradé turquoise + rayons (z bas, derrière le contenu) ──
export function AquaticGradient({ style }) {
  if (!IS_TV) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }, style]}>
      <LinearGradient
        colors={GRADIENT_COLORS}
        locations={GRADIENT_LOCATIONS}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Rayons lumineux qui pulsent — profondeur "sous-marine" */}
      <Rayon left={SW * 0.10} width={SW * 0.05} delay={0}    duration={9000} opacity={0.16} />
      <Rayon left={SW * 0.42} width={SW * 0.045} delay={3500} duration={9500} opacity={0.12} />
      <Rayon left={SW * 0.78} width={SW * 0.04} delay={6500} duration={8500} opacity={0.14} />
    </View>
  );
}

// ── Couche AQUATIQUE : méduses + bulles. Utilisable en FOREGROUND (z haut,
// par-dessus le contenu). pointerEvents="none" CRITIQUE → ne mange jamais le
// focus de la Siri Remote. ──
export function AquaticDrifters({
  density = 'normal', // 'normal' | 'low' | 'high'
  paused = false,
  contentOpacity = 1,
  style,
}) {
  const meduses = useMemo(function() {
    if (density === 'high') return MEDUSES_TV_HIGH;
    if (density === 'low') return MEDUSES_TV.slice(0, 3);
    return MEDUSES_TV;
  }, [density]);
  const bulles = useMemo(function() {
    if (density === 'high') return BULLES_TV_HIGH;
    if (density === 'low') return BULLES_TV.filter(function(_, i) { return i % 2 === 0; });
    return BULLES_TV;
  }, [density]);
  // FIX rules-of-hooks (2026-07-23) : hooks avant tout early-return.
  if (!IS_TV) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: 'hidden', opacity: contentOpacity }, style]}>
      {bulles.map(function(b, i) { return <Bulle key={'tv-b-' + i} {...b} colorIndex={i} />; })}
      {meduses.map(function(m, i) {
        return (
          <DriftingMeduse
            key={'tv-m-' + i}
            baseX={m.baseX}
            baseY={m.baseY}
            size={m.size}
            breath={m.breath}
            tint={m.tint}
            paused={paused}
          />
        );
      })}
    </View>
  );
}

// Combiné (fond + drifters) — gardé pour TVLoginScreen / ProfilTV / Paywall
// qui l'utilisent comme arrière-plan plein écran.
export default function AquaticBackground({ density = 'normal', paused = false, contentOpacity = 1, style }) {
  if (!IS_TV) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }, style]}>
      <AquaticGradient />
      <AquaticDrifters density={density} paused={paused} contentOpacity={contentOpacity} />
    </View>
  );
}
