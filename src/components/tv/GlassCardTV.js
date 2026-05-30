// GlassCardTV — variante TV-scale du GlassCard iPhone.
//
// Différences par rapport au GlassCard de base :
//   - BlurView intensity 78 (vs 60) — l'effet doit être lisible de 2-3 m
//   - bevel + highlight plus contrastés (gradient 0.22 → 0.04)
//   - drop shadow plus large (radius 30, opacity 0.32) pour faire "lever"
//     la card du fond aquatique
//   - radius 28 par défaut (vs 20) — proportions Apple TV
//   - Focus engine integration : on accepte onPress, et on anime un
//     scale 1 → 1.06 + un anneau bioluminescent qui fade-in en 200ms
//     (Animated.timing, useNativeDriver true) + un parallax tilt 3° quand
//     focusé pour donner du relief.
//
// Le `parallaxTilt` est animé en JS (rotateX/rotateY ne sont pas
// transformables par le native driver), donc il s'active uniquement
// sur le focus state (pas par drag du focus dans la card) : un coup de
// timing pour rentrer en tilt, un autre pour sortir. Pas de jank parce
// qu'on ne tilt qu'une seule card à la fois — le reste de l'écran reste
// stable sur le native driver.
//
// Usage typique :
//   <GlassCardTV onPress={...} focusPreferred ariaLabel="Profil">
//     <Text>...</Text>
//   </GlassCardTV>

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, TouchableOpacity, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { IS_TV, tvFocusProps } from '../../utils/platformTV';
import { GlassEnhanceOverlays } from '../LiquidGlassEnhanced';
import LiquidGlass, { HAS_LIQUID_GLASS } from '../LiquidGlass';

// Lime brand accent in the "r, g, b" form GlassEnhanceOverlays expects.
const LIME_RGB = '184, 230, 46';
const CYAN_RGB = '120, 220, 255';

// Couleur du ring focus — bioluminescent cyan, signature Fluidbody.
// Ring blanc par défaut pour cohérence avec le pass focus du polish round 2.
// Les caller peuvent demander l'accent vert via accent="green".
const FOCUS_RING_COLOR = 'rgba(255,255,255,0.85)';
const FOCUS_ACCENT_GREEN = '#AEEF4D';
const FOCUS_GLOW_WHITE = '#FFFFFF';

export default function GlassCardTV({
  children,
  onPress,
  disabled = false,
  focusPreferred = false,
  // Forme : 'card' par défaut, 'pill' pour les boutons, 'tile' pour les
  // tiles carrées.
  shape = 'card',
  // accent : 'cyan' (default) ou 'green' — change la couleur du ring focus
  // et le tint du highlight quand focusé.
  accent = 'cyan',
  // Niveau visuel : 'standard' (translucent dark) | 'elevated' (plus opaque,
  // pour les CTA) | 'subtle' (plus discret).
  variant = 'standard',
  // Padding intérieur — par défaut tuné pour TV. Passer `padding={0}` si
  // l'enfant gère son propre layout (ex: image background plein bord).
  padding,
  // tiltOnFocus : appliquer la parallax tilt 3° (défaut true). Désactivez
  // pour les tiles dans une scroll list horizontale, le tilt peut faire
  // confondre avec un dragging.
  tiltOnFocus = true,
  // enhanced : superpose les couches Liquid Glass v2 (breathing bloom +
  // specular sweep + lime ring) par-dessus le BlurView. Le focus tvOS
  // intensifie le bloom et le ring — câblé sur le state `focused` interne.
  enhanced = false,
  // Style supplémentaire sur le wrapper extérieur (utile pour width/height
  // explicites).
  style,
  // Style supplémentaire sur le content (pour aligner items, etc.).
  contentStyle,
  onFocus,
  onBlur,
  accessibilityLabel,
}) {
  if (!IS_TV) {
    // Sur iPhone, on ne devrait pas importer ce fichier mais par sécurité,
    // on renvoie un View transparent qui rend les enfants.
    return <View style={style}>{children}</View>;
  }

  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;

  const radius = shape === 'pill' ? 999 : shape === 'tile' ? 24 : 28;
  const padded = padding != null ? padding : (shape === 'pill' ? 14 : 22);
  const ringColor = accent === 'green' ? FOCUS_ACCENT_GREEN : FOCUS_RING_COLOR;

  // Substrate par variant — translucent dark pour standard ; plus dense
  // pour elevated (CTA) ; plus léger pour subtle.
  const substrate = (
    variant === 'elevated' ? 'rgba(8,24,40,0.62)'
    : variant === 'subtle' ? 'rgba(8,24,40,0.28)'
    : 'rgba(8,24,40,0.45)'
  );
  // Highlight gradient — 0.22 top-left → 0.04 bottom-right. Plus contrasté
  // que l'iPhone pour rester lisible à distance.
  const highlightColors = focused
    ? ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.08)']
    : ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)'];

  function handleFocus() {
    setFocused(true);
    if (onFocus) onFocus();
    Animated.parallel([
      Animated.timing(scale, { toValue: 1.10, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      tiltOnFocus
        ? Animated.timing(tilt, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false })
        : Animated.timing(tilt, { toValue: 0, duration: 0, useNativeDriver: false }),
    ]).start();
  }
  function handleBlur() {
    setFocused(false);
    if (onBlur) onBlur();
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tilt, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }

  useEffect(function() {
    return function() {
      try { scale.stopAnimation(); ringOpacity.stopAnimation(); tilt.stopAnimation(); } catch (e) {}
    };
  }, []);

  const rotX = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-2deg'] });
  const rotY = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '3deg'] });

  const interactive = !!onPress && !disabled;
  // Le scale + tilt vivent sur le wrapper extérieur ; la shadow aussi.
  // Le ring se pose absolu par-dessus la card, mais à l'intérieur du
  // wrapper extérieur (pour suivre le scale).
  const Wrapper = interactive ? TouchableOpacity : View;
  const wrapperProps = interactive
    ? Object.assign({}, tvFocusProps(focusPreferred), {
        onPress: onPress,
        onFocus: handleFocus,
        onBlur: handleBlur,
        activeOpacity: 0.92,
        disabled: disabled,
        accessibilityLabel: accessibilityLabel,
        // Désactive le parallax magnification natif tvOS pour ne pas
        // empiler les effets (on gère le scale manuellement).
      })
    : { pointerEvents: 'box-none' };

  return (
    <Animated.View
      style={[
        {
          borderRadius: radius,
          shadowColor: '#000',
          shadowOpacity: 0.32,
          shadowRadius: 30,
          shadowOffset: { width: 0, height: 14 },
          // Scale only — piloté par le native driver.
          transform: [{ scale: scale }],
        },
        style,
      ]}
    >
      {/* Tilt parallax sur un node séparé — rotateX/rotateY sont JS-driven
          et ne doivent pas cohabiter avec le scale natif sur le même node
          (tvOS crashe : "JS driven animation on node moved to native"). */}
      <Animated.View
        style={{
          borderRadius: radius,
          transform: [
            { perspective: 800 },
            { rotateX: rotX },
            { rotateY: rotY },
          ],
        }}
      >
      <Wrapper
        {...wrapperProps}
        style={{ borderRadius: radius }}
      >
        <View style={{ borderRadius: radius, overflow: 'hidden' }}>
          {/* Substrate blur. On tvOS 26 the native LiquidGlassTVView
              (real UIGlassEffect + focus-responsive sheen) replaces the JS
              BlurView; everywhere else (older tvOS, Android TV) we keep the
              BlurView as the last-resort fallback. borderStyle="off" because
              GlassCardTV draws its own bevel + focus ring on top. */}
          {HAS_LIQUID_GLASS ? (
            <LiquidGlass
              style={StyleSheet.absoluteFillObject}
              intensity={78}
              borderStyle="off"
              borderRadius={radius}
              focused={focused}
              accent={accent}
            />
          ) : (
            <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
          )}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: substrate }]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={highlightColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Bevel — light edge top/left, dark edge bottom/right. 1.5 px
              pour qu'il reste lisible à 2 m. */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                borderRadius: radius,
                borderTopWidth: 1.5,
                borderLeftWidth: 1.5,
                borderRightWidth: 1.5,
                borderBottomWidth: 1.5,
                borderTopColor: 'rgba(255,255,255,0.20)',
                borderLeftColor: 'rgba(255,255,255,0.20)',
                borderRightColor: 'rgba(0,0,0,0.25)',
                borderBottomColor: 'rgba(0,0,0,0.25)',
              },
            ]}
          />
          {/* Liquid Glass v2 — couches amplifiées au-dessus du blur+bevel,
              sous le contenu. Le focus tvOS booste le bloom + le ring. */}
          {enhanced ? (
            <GlassEnhanceOverlays
              borderRadius={radius}
              focused={focused}
              accent={accent === 'green' ? LIME_RGB : CYAN_RGB}
              intensity={75}
            />
          ) : null}
          <View style={[{ padding: padded }, contentStyle]}>
            {children}
          </View>
        </View>
        {/* Focus ring — anneau bioluminescent posé par-dessus, suit le
            scale du wrapper. */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -4,
            left: -4,
            right: -4,
            bottom: -4,
            borderRadius: radius + 4,
            borderWidth: 3,
            borderColor: ringColor,
            opacity: ringOpacity,
            shadowColor: accent === 'green' ? ringColor : FOCUS_GLOW_WHITE,
            shadowOpacity: 0.78,
            shadowRadius: 40,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      </Wrapper>
      </Animated.View>
    </Animated.View>
  );
}
