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
// Palette poussée vers le turquoise "Maldives" en haut → bleu profond en bas
// (feedback Yvan : "+ turquoise, plus aquatique").
const GRADIENT_COLORS = ['#1FBED6', '#159FC4', '#0C7FB0', '#085C94', '#06396E', '#041E45'];
const GRADIENT_LOCATIONS = [0, 0.22, 0.44, 0.64, 0.82, 1];

// Bulles : positions déterministes pour rester stables au remount (et
// éviter qu'une bulle clignote au mauvais endroit après navigation).
// Plus de bulles, plus petites (feedback Yvan) — l'écran TV est grand, on
// remplit l'espace avec des bulles fines plutôt que grosses.
const BULLES_TV = [
  { x: SW * 0.05, size: 14, delay: 0, duration: 14000 },
  { x: SW * 0.12, size: 9, delay: 2400, duration: 12000 },
  { x: SW * 0.19, size: 18, delay: 4800, duration: 16000 },
  { x: SW * 0.26, size: 11, delay: 1200, duration: 13000 },
  { x: SW * 0.33, size: 15, delay: 3600, duration: 15000 },
  { x: SW * 0.40, size: 8, delay: 6000, duration: 11000 },
  { x: SW * 0.47, size: 16, delay: 800, duration: 14500 },
  { x: SW * 0.54, size: 12, delay: 5200, duration: 13500 },
  { x: SW * 0.61, size: 10, delay: 2000, duration: 12500 },
  { x: SW * 0.68, size: 17, delay: 7000, duration: 10500 },
  { x: SW * 0.75, size: 9, delay: 1600, duration: 15500 },
  { x: SW * 0.82, size: 14, delay: 4200, duration: 12800 },
  { x: SW * 0.89, size: 11, delay: 6400, duration: 13800 },
  { x: SW * 0.95, size: 8, delay: 3000, duration: 11500 },
  { x: SW * 0.30, size: 13, delay: 8000, duration: 16500 },
  { x: SW * 0.65, size: 10, delay: 9000, duration: 14200 },
];

// 5 méduses dérivantes — points de départ répartis (haut, bas, gauche,
// droite, centre). Tailles 80–140 px : grandes mais pas envahissantes.
// Plus de méduses, plus petites (feedback Yvan) — 7 réparties sur l'écran.
const MEDUSES_TV = [
  { baseX: SW * 0.08, baseY: SH * 0.16, size: 84,  breath: 3600, tint: 'rgba(174,239,77,1)' },
  { baseX: SW * 0.80, baseY: SH * 0.10, size: 96,  breath: 4200, tint: 'rgba(0,220,255,1)' },
  { baseX: SW * 0.18, baseY: SH * 0.70, size: 68,  breath: 3400, tint: 'rgba(0,189,208,1)' },
  { baseX: SW * 0.72, baseY: SH * 0.64, size: 100, breath: 4600, tint: 'rgba(174,239,77,1)' },
  { baseX: SW * 0.44, baseY: SH * 0.36, size: 60,  breath: 3800, tint: 'rgba(200,240,255,1)' },
  { baseX: SW * 0.58, baseY: SH * 0.82, size: 76,  breath: 4000, tint: 'rgba(0,220,255,1)' },
  { baseX: SW * 0.34, baseY: SH * 0.50, size: 64,  breath: 4400, tint: 'rgba(174,239,77,1)' },
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
      const dur = 11000 + Math.random() * 7000;
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

export default function AquaticBackground({
  // Densité — on peut atténuer si l'écran TV contient déjà beaucoup de
  // contenu (paywall, séance complétée), pour ne pas saturer.
  density = 'normal', // 'normal' | 'low'
  // `paused` : couper les animations quand un Modal couvre l'écran.
  paused = false,
  // Opacity globale du calque méduses+bulles. Au-dessus de gros titres
  // ou d'un QR code, on peut descendre à 0.6 pour ne pas concurrencer.
  contentOpacity = 1,
  style,
}) {
  if (!IS_TV) return null;

  // Si density === 'low', on enlève la moitié des méduses + bulles. Utile
  // pour le TVLoginScreen (QR code doit dominer) ou le PaywallModal.
  const meduses = useMemo(function() {
    if (density === 'low') return MEDUSES_TV.slice(0, 3);
    return MEDUSES_TV;
  }, [density]);
  const bulles = useMemo(function() {
    if (density === 'low') return BULLES_TV.filter(function(_, i) { return i % 2 === 0; });
    return BULLES_TV;
  }, [density]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }, style]}>
      <LinearGradient
        colors={GRADIENT_COLORS}
        locations={GRADIENT_LOCATIONS}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Rayons lumineux qui pulsent — donnent la profondeur "sous-marine" */}
      <Rayon left={SW * 0.10} width={SW * 0.05} delay={0}    duration={9000} opacity={0.16} />
      <Rayon left={SW * 0.42} width={SW * 0.045} delay={3500} duration={9500} opacity={0.12} />
      <Rayon left={SW * 0.78} width={SW * 0.04} delay={6500} duration={8500} opacity={0.14} />

      <View style={[StyleSheet.absoluteFillObject, { opacity: contentOpacity }]} pointerEvents="none">
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
    </View>
  );
}
