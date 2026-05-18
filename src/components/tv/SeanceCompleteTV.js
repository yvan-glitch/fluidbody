// SeanceCompleteTV — overlay plein écran TV affiché à la fin d'une séance.
//
// Composition :
//   1. AquaticBackground en fond (density low, paused: false) — ambiance
//      contemplative, pas de saturation visuelle au moment célébration.
//   2. 24 méduses confetti qui dérivent depuis le bas vers le haut, en
//      tailles + vitesses + tints variées. Animated.timing + native driver
//      pour rester à 60 fps. Apparition staggered (delay 0–2400 ms).
//   3. Titre central "Séance terminée" + sub + durée + CTAs focusables.
//
// Lifecycle : auto-dismiss possible via `onContinue` après un délai si
// l'utilisateur ne fait rien (TODO côté caller). Pour l'instant on attend
// l'action utilisateur.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Text, View, StyleSheet } from 'react-native';

import AquaticBackground from './AquaticBackground';
import GlassCardTV from './GlassCardTV';
import { MeduseCornerIcon } from '../Meduse';
import { IS_TV } from '../../utils/platformTV';

const { width: SW, height: SH } = Dimensions.get('window');

// 24 confetti méduses — paramètres déterministes (seed sur l'index) pour
// éviter le jitter visuel d'un mount à l'autre, et faciliter le tuning.
function buildConfetti() {
  const out = [];
  const tints = [
    'rgba(174,239,77,1)',   // vert Fluidbody
    'rgba(0,220,255,1)',    // cyan
    'rgba(0,189,208,1)',    // turquoise foncé
    'rgba(200,240,255,1)',  // blanc bleuté
    'rgba(255,255,255,1)',  // blanc pur
  ];
  for (let i = 0; i < 24; i++) {
    const seed = (i * 12.9898) % 1;
    const r = function(off) {
      const v = Math.sin((i + off) * 7.13) * 43758.5453;
      return v - Math.floor(v);
    };
    out.push({
      startX: r(0.1) * SW,
      size: 36 + Math.floor(r(0.3) * 40),    // 36–76 px
      duration: 4200 + Math.floor(r(0.6) * 1600), // 4.2–5.8 s
      delay: Math.floor(r(0.9) * 2400),       // 0–2.4 s
      drift: (r(0.4) - 0.5) * 220,           // -110 ↔ +110 px de drift horizontal
      tint: tints[Math.floor(r(0.7) * tints.length)],
      breath: 2400 + Math.floor(r(0.5) * 1200),
    });
  }
  return out;
}

function ConfettiMeduse({ startX, size, duration, delay, drift, tint, breath }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(function() {
    const anim = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: duration,
        easing: Easing.bezier(0.32, 0, 0.68, 1),
        useNativeDriver: true,
        delay: delay,
      })
    );
    anim.start();
    return function() { try { anim.stop(); } catch (e) {} };
  }, []);

  // Trajectoire : du bas (SH + 80) vers le haut (-120), avec un drift
  // horizontal sinusoidal léger.
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SH + 80, -120],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, drift, 0],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.08, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: startX - size / 2,
        top: 0,
        opacity: opacity,
        transform: [{ translateY: translateY }, { translateX: translateX }],
      }}
    >
      <MeduseCornerIcon size={size} breathCycleMs={breath} breathMaxScale={1.22} tint={tint} />
    </Animated.View>
  );
}

export default function SeanceCompleteTV({
  // Texte FR — la TV est francophone par défaut, on passe `isFr` pour
  // mémoire mais on accepte des overrides via les props label*.
  isFr = true,
  durationLabel,    // ex: "12'30''"
  seanceTitle,      // ex: "Le dos expliqué"
  pilierLabel,      // ex: "Reprise"
  onContinue,       // CTA primary : "Une autre séance"
  onClose,          // CTA secondary : "Retour à l'accueil"
}) {
  if (!IS_TV) return null;
  const confetti = useMemo(buildConfetti, []);
  const [titleAnim] = useState(function() { return new Animated.Value(0); });

  useEffect(function() {
    Animated.timing(titleAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      delay: 200,
    }).start();
  }, []);

  const titleTranslate = titleAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const titleOpacity = titleAnim;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <AquaticBackground density="low" paused={false} contentOpacity={0.85} />

      {/* Calque confetti */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        {confetti.map(function(c, i) { return <ConfettiMeduse key={'cf-' + i} {...c} />; })}
      </View>

      {/* Contenu central */}
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={{
            alignItems: 'center',
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslate }],
          }}
        >
          <Text style={styles.eyebrow}>
            {pilierLabel ? pilierLabel.toUpperCase() : (isFr ? 'BIEN JOUÉ' : 'WELL DONE')}
          </Text>
          <Text style={styles.title}>
            {isFr ? 'Séance terminée' : 'Session complete'}
          </Text>
          {seanceTitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>{seanceTitle}</Text>
          ) : null}
          {durationLabel ? (
            <Text style={styles.duration}>{durationLabel}</Text>
          ) : null}
        </Animated.View>

        <View style={styles.ctaRow}>
          {onContinue ? (
            <GlassCardTV
              onPress={onContinue}
              focusPreferred
              accent="green"
              variant="elevated"
              shape="pill"
              padding={0}
              style={{ minWidth: 280 }}
              contentStyle={{ paddingHorizontal: 40, paddingVertical: 20, alignItems: 'center' }}
              accessibilityLabel={isFr ? 'Une autre séance' : 'Another session'}
            >
              <Text style={styles.ctaPrimaryText}>{isFr ? 'Une autre séance' : 'Another session'}</Text>
            </GlassCardTV>
          ) : null}
          {onClose ? (
            <GlassCardTV
              onPress={onClose}
              accent="cyan"
              variant="subtle"
              shape="pill"
              padding={0}
              style={{ minWidth: 240 }}
              contentStyle={{ paddingHorizontal: 40, paddingVertical: 20, alignItems: 'center' }}
              accessibilityLabel={isFr ? "Retour à l'accueil" : 'Back to home'}
            >
              <Text style={styles.ctaSecondaryText}>{isFr ? "Retour à l'accueil" : 'Back to home'}</Text>
            </GlassCardTV>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 120,
  },
  eyebrow: {
    fontSize: 18,
    color: '#AEEF4D',
    fontWeight: '800',
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginBottom: 22,
  },
  title: {
    fontSize: 96,
    fontWeight: '200',
    color: '#FFFFFF',
    letterSpacing: -2,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 32,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    letterSpacing: -0.3,
    maxWidth: 920,
    marginBottom: 24,
  },
  duration: {
    fontSize: 22,
    color: 'rgba(174,239,77,0.85)',
    fontWeight: '600',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 60,
  },
  ctaPrimaryText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  ctaSecondaryText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.4,
  },
});
