// MeduseTV — méduse hero XL, pensée pour le TVLoginScreen et tout
// écran TV qui a besoin d'un point focal émotionnel sans contenu.
//
// Composition (du fond vers l'avant) :
//   1. Halo bioluminescent — gradient radial en background, breathing
//      désynchronisé de la cloche pour donner l'effet d'aura vivante.
//   2. MeduseCornerIcon — la méduse SVG vue partout dans l'app, scalée
//      ici à 200–300 px, breathing 2.5 s pour un rythme contemplatif.
//
// Pas de halo via shadow* : la teinte verte/cyan rendue par shadowRadius
// devient sale sur tvOS (shadow color shifts vers le noir). On utilise
// donc plusieurs Views radiales superposées avec backgroundColor + blur
// d'opacity, c'est plus propre et 60 fps stable sur Apple TV HD.

import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { MeduseCornerIcon } from '../Meduse';
import { IS_TV } from '../../utils/platformTV';

export default function MeduseTV({
  size = 240,
  // tint: couleur RGBA de la méduse. On accepte 'rgba(r,g,b,1)' — le SVG
  // remplacera le '1' final par l'alpha approprié pour chaque calque.
  tint = 'rgba(0,220,255,1)',
  // haloTint: si null, on dérive du tint méduse. Utile pour avoir une
  // méduse verte sur un halo cyan (look bioluminescent profond).
  haloTint = null,
  // haloScale : multiplicateur de la taille du halo par rapport à la
  // méduse. 1.6 = halo qui déborde généreusement. 1.2 = halo serré.
  haloScale = 1.7,
  breathCycleMs = 2500,
  // glow: animation supplémentaire d'opacity du halo (0.55 ↔ 0.95).
  glow = true,
  style,
}) {
  if (!IS_TV) return null;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(function() {
    if (!glow) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: breathCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: breathCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return function() { try { loop.stop(); } catch (e) {} };
  }, [glow, breathCycleMs]);

  const haloSize = Math.round(size * haloScale);
  const haloColor = haloTint || tint;
  const haloOpacity = glow
    ? glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] })
    : 0.75;
  // On compose le halo avec 3 cercles concentriques d'opacités décroissantes
  // pour simuler un radial gradient sans dépendance SVG (plus rapide à
  // composer sur le GPU TV).
  return (
    <View style={[{ width: haloSize, height: haloSize, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: haloSize,
          height: haloSize,
          borderRadius: haloSize / 2,
          backgroundColor: alpha(haloColor, 0.10),
          opacity: haloOpacity,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: Math.round(haloSize * 0.75),
          height: Math.round(haloSize * 0.75),
          borderRadius: Math.round(haloSize * 0.75) / 2,
          backgroundColor: alpha(haloColor, 0.18),
          opacity: haloOpacity,
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: Math.round(haloSize * 0.5),
          height: Math.round(haloSize * 0.5),
          borderRadius: Math.round(haloSize * 0.5) / 2,
          backgroundColor: alpha(haloColor, 0.28),
          opacity: haloOpacity,
        }}
      />
      <MeduseCornerIcon size={size} breathCycleMs={breathCycleMs} breathMaxScale={1.16} tint={tint} />
    </View>
  );
}

// Helper local — remplace l'alpha d'une chaîne `rgba(r,g,b,X)` par la
// valeur passée. Tolère aussi `rgb(...)`.
function alpha(rgba, a) {
  if (typeof rgba !== 'string') return 'rgba(0,220,255,' + a + ')';
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return 'rgba(0,220,255,' + a + ')';
  const parts = m[1].split(',').map(function(p) { return p.trim(); });
  return 'rgba(' + parts[0] + ',' + parts[1] + ',' + parts[2] + ',' + a + ')';
}
