// AnniversaryOverlay — dédicace cachée pour le 14 mai.
//
// Yvan + Sabrina Tissot : mariés le 14 mai 1994. L'overlay se déclenche tout
// seul chaque 14 mai (flag `fluid_anniv_seen_YYYY` dans AsyncStorage), avec
// un message personnel sur fond océan profond et une méduse bioluminescente
// turquoise. Calcul du nombre d'années dynamique : 2026 = 32, 2027 = 33, etc.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Animated, Easing, Dimensions, Pressable, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MeduseCornerIcon } from './Meduse';

const { width: SW, height: SH } = Dimensions.get('window');
const WEDDING_YEAR = 1994;
const TINT = 'rgba(0,220,236,1)'; // #00DCEC

let HapticsMod = null;
try { HapticsMod = require('expo-haptics'); } catch (e) {}
function hapticSoft() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  try { HapticsMod.impactAsync(HapticsMod.ImpactFeedbackStyle.Soft); } catch (e) {}
}

// ── Particule ascendante ──
// Une seule petite lueur turquoise/blanche qui monte lentement depuis le bas.
function Particle({ x, size, duration, delay, isWhite }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let loop = null;
    const t = setTimeout(() => {
      loop = Animated.loop(Animated.timing(a, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }));
      loop.start();
    }, delay);
    return () => { clearTimeout(t); try { loop && loop.stop(); } catch (e) {} };
  }, []);
  const translateY = a.interpolate({ inputRange: [0, 1], outputRange: [40, -(SH + 80)] });
  const opacity = a.interpolate({
    inputRange: [0, 0.08, 0.85, 1],
    outputRange: [0, 0.7, 0.4, 0],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: x,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isWhite ? 'rgba(255,255,255,0.85)' : 'rgba(0,220,236,0.75)',
        shadowColor: isWhite ? '#ffffff' : TINT,
        shadowOpacity: 0.9,
        shadowRadius: size * 1.4,
        shadowOffset: { width: 0, height: 0 },
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

// 12 particules — paramètres déterministes pour un rendu reproductible.
const PARTICLES = Array.from({ length: 12 }, function(_, i) {
  const x = ((i * 73) % 90) / 100 * SW + (SW * 0.04);
  const size = 2 + ((i * 17) % 4);
  const duration = 9000 + ((i * 1097) % 7000);
  const delay = (i * 530) % 8000;
  const isWhite = i % 3 === 0;
  return { x, size, duration, delay, isWhite };
});

export function AnniversaryOverlay({ onClose }) {
  const today = useMemo(function() { return new Date(); }, []);
  const yearsCount = today.getFullYear() - WEDDING_YEAR;
  const currentYear = today.getFullYear();

  const opacAnim = useRef(new Animated.Value(0)).current;
  const meduseScale = useRef(new Animated.Value(0.85)).current;
  const closeOpac = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    hapticSoft();
    // Animation d'entrée — fade in overlay + scale up méduse, Apple easing.
    Animated.parallel([
      Animated.timing(opacAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.timing(meduseScale, {
        toValue: 1,
        duration: 800,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
    ]).start();

    // Bouton "Fermer" — fade in après 3 sec pour laisser le temps de lire.
    const closeTimer = setTimeout(function() {
      Animated.timing(closeOpac, {
        toValue: 0.6,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 3000);

    // Pulse glow lent — loop 2.5s, scale 1 → 1.08 → 1.
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1250, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    pulseLoop.start();

    return function() {
      clearTimeout(closeTimer);
      try { pulseLoop.stop(); } catch (e) {}
    };
  }, []);

  function handleDismiss() {
    if (dismissing) return;
    setDismissing(true);
    hapticSoft();
    Animated.timing(opacAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(function() { if (onClose) onClose(); });
  }

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <Animated.View
      pointerEvents={dismissing ? 'none' : 'auto'}
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 99999,
        opacity: opacAnim,
      }}
    >
      <Pressable onPress={handleDismiss} style={{ flex: 1 }}>
        {/* Fond océan profond + blur */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,5,12,0.92)' }} />
        {Platform.OS === 'ios' && (
          <BlurView intensity={40} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        )}

        {/* Particules ascendantes */}
        {PARTICLES.map(function(p, i) { return <Particle key={'p-' + i} {...p} />; })}

        {/* Contenu centré */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          {/* Date + tagline au-dessus de la méduse */}
          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: 'rgba(255,255,255,0.85)',
              letterSpacing: 1.5,
              textAlign: 'center',
            }}>
              14 mai {WEDDING_YEAR} → 14 mai {currentYear}
            </Text>
            <Text style={{
              fontSize: 24,
              fontStyle: 'italic',
              fontWeight: '300',
              color: '#ffffff',
              marginTop: 8,
              letterSpacing: 0.5,
              textAlign: 'center',
            }}>
              {yearsCount} ans ensemble
            </Text>
          </View>

          {/* Méduse turquoise avec halo pulsant */}
          <Animated.View style={{ transform: [{ scale: meduseScale }], alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 280,
                height: 280,
                borderRadius: 140,
                backgroundColor: 'rgba(0,220,236,0.18)',
                shadowColor: TINT,
                shadowOpacity: 1,
                shadowRadius: 60,
                shadowOffset: { width: 0, height: 0 },
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              }}
            />
            <MeduseCornerIcon size={200} breathCycleMs={2500} breathMaxScale={1.08} tint={TINT} />
          </Animated.View>

          {/* Message — 5 lignes */}
          <View style={{ alignItems: 'center', marginTop: 18, paddingHorizontal: 8 }}>
            <Text style={{
              fontSize: 24,
              fontWeight: '500',
              color: '#ffffff',
              marginTop: 24,
              letterSpacing: 0.3,
              textAlign: 'center',
            }}>
              Sabrina,
            </Text>
            <Text style={{
              fontSize: 18,
              fontWeight: '400',
              color: '#ffffff',
              marginTop: 12,
              lineHeight: 26,
              textAlign: 'center',
            }}>
              {yearsCount} ans aujourd'hui qu'on s'est dit oui.
            </Text>
            <Text style={{
              fontSize: 18,
              fontWeight: '400',
              color: '#ffffff',
              marginTop: 4,
              lineHeight: 26,
              textAlign: 'center',
            }}>
              Tu es chaque mouvement de cette app.
            </Text>
            <Text style={{
              fontSize: 18,
              fontWeight: '400',
              color: '#ffffff',
              marginTop: 4,
              lineHeight: 26,
              textAlign: 'center',
            }}>
              Sans toi, Fluidbody n'existerait pas.
            </Text>
            <Text style={{
              fontSize: 20,
              fontStyle: 'italic',
              fontWeight: '500',
              color: '#00DCEC',
              marginTop: 16,
              letterSpacing: 0.4,
              textAlign: 'center',
            }}>
              Je t'aime. Yvan
            </Text>
          </View>
        </View>

        {/* Bouton Fermer — fade in après 3s */}
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0, right: 0,
            bottom: 48,
            alignItems: 'center',
            opacity: closeOpac,
          }}
        >
          <Pressable onPress={handleDismiss} hitSlop={16}>
            <Text style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: 2,
              textTransform: 'uppercase',
              fontWeight: '500',
            }}>
              Fermer
            </Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default AnniversaryOverlay;
