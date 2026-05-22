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
// Palette du splash iPhone : navy quasi-noir en haut → teal moyen en bas.
// Calme et profond (Yvan veut ce fond sur toutes les pages TV).
const GRADIENT_COLORS = ['#0A1830', '#142F44', '#225463', '#3A7E8E'];
const GRADIENT_LOCATIONS = [0, 0.42, 0.74, 1];

// Bulles : positions déterministes pour rester stables au remount (et
// éviter qu'une bulle clignote au mauvais endroit après navigation).
// 4 minuscules bulles, lentes (style splash : juste quelques taches en bas).
const BULLES_TV = [
  { x: SW * 0.30, size: 6, delay: 0,    duration: 22000 },
  { x: SW * 0.46, size: 5, delay: 6000, duration: 26000 },
  { x: SW * 0.58, size: 7, delay: 3000, duration: 24000 },
  { x: SW * 0.70, size: 5, delay: 9000, duration: 28000 },
];

// Style splash : 1 méduse "héroïne" centrée haut + 1 plus petite en retrait,
// teinte douce blanc-teal. Halo glow dessiné derrière chacune (cf. DriftingMeduse).
const MEDUSES_TV = [
  { baseX: SW * 0.5 - 100, baseY: SH * 0.24, size: 200, breath: 5200, tint: 'rgba(196,228,236,1)' },
  { baseX: SW * 0.66,      baseY: SH * 0.44, size: 110, breath: 6200, tint: 'rgba(150,205,220,1)' },
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
      // Léger sway lent (~±40 px), cycle 22–30 s : calme, méditatif.
      const tx = (Math.random() * 80) - 40;
      const ty = (Math.random() * 60) - 30;
      const dur = 22000 + Math.random() * 8000;
      const p = Animated.parallel([
        Animated.timing(dx, { toValue: tx, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(dy, { toValue: ty, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
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

  const halo = Math.round(size * 2.4);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: baseX,
        top: baseY,
        opacity: 0.7,
        transform: [{ translateX: dx }, { translateY: dy }],
      }}
    >
      {/* Halo glow doux derrière la méduse (aura splash). */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: (size - halo) / 2,
          top: (size - halo) / 2,
          width: halo,
          height: halo,
          borderRadius: halo / 2,
          backgroundColor: 'rgba(180,220,230,0.08)',
        }}
      />
      <MeduseCornerIcon size={size} breathCycleMs={breath} breathMaxScale={1.10} tint={tint} />
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
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity: 0.4 }]}>
        {bulles.map(function(b, i) { return <Bulle key={'tv-b-' + i} {...b} colorIndex={i} />; })}
      </View>
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
