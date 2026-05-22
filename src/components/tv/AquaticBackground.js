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
// Palette du splash iPhone : navy quasi-noir en haut → teal moyen en bas
// ("tu plonges dans l'eau"). Seul le dégradé change ; méduses + bulles restent.
const GRADIENT_COLORS = ['#0A1830', '#142F44', '#225463', '#3A7E8E'];
const GRADIENT_LOCATIONS = [0, 0.42, 0.74, 1];

// Bulles : positions déterministes pour rester stables au remount (et
// éviter qu'une bulle clignote au mauvais endroit après navigation).
// 10 bulles fines (perf — réduit de 16).
const BULLES_TV = [
  { x: SW * 0.08, size: 14, delay: 0, duration: 14000 },
  { x: SW * 0.18, size: 10, delay: 2400, duration: 12000 },
  { x: SW * 0.28, size: 16, delay: 4800, duration: 16000 },
  { x: SW * 0.40, size: 11, delay: 1200, duration: 13000 },
  { x: SW * 0.52, size: 15, delay: 3600, duration: 15000 },
  { x: SW * 0.62, size: 9, delay: 6000, duration: 11000 },
  { x: SW * 0.72, size: 16, delay: 800, duration: 14500 },
  { x: SW * 0.82, size: 12, delay: 5200, duration: 13500 },
  { x: SW * 0.92, size: 10, delay: 2000, duration: 12500 },
  { x: SW * 0.34, size: 13, delay: 7000, duration: 10500 },
];

// 5 méduses dérivantes — points de départ répartis (haut, bas, gauche,
// droite, centre). Tailles 80–140 px : grandes mais pas envahissantes.
// Arrière-plan : 6 méduses ~1.4× (perf — Yvan a trouvé 12 en foreground trop
// lourd ; on garde une taille généreuse mais moins d'éléments).
const MEDUSES_TV = [
  { baseX: SW * 0.08, baseY: SH * 0.14, size: 140, breath: 3600, tint: 'rgba(174,239,77,1)' },
  { baseX: SW * 0.80, baseY: SH * 0.10, size: 132, breath: 4200, tint: 'rgba(0,220,255,1)' },
  { baseX: SW * 0.20, baseY: SH * 0.68, size: 96,  breath: 3400, tint: 'rgba(0,189,208,1)' },
  { baseX: SW * 0.72, baseY: SH * 0.62, size: 140, breath: 4600, tint: 'rgba(174,239,77,1)' },
  { baseX: SW * 0.46, baseY: SH * 0.40, size: 88,  breath: 3800, tint: 'rgba(200,240,255,1)' },
  { baseX: SW * 0.34, baseY: SH * 0.80, size: 112, breath: 4000, tint: 'rgba(0,220,255,1)' },
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
  density = 'normal', // 'normal' | 'low'
  paused = false,
  contentOpacity = 1,
  style,
}) {
  if (!IS_TV) return null;
  const meduses = useMemo(function() {
    if (density === 'low') return MEDUSES_TV.slice(0, 3);
    return MEDUSES_TV;
  }, [density]);
  const bulles = useMemo(function() {
    if (density === 'low') return BULLES_TV.filter(function(_, i) { return i % 2 === 0; });
    return BULLES_TV;
  }, [density]);
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
