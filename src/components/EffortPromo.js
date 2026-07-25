// EffortPromo — « pub » façon Apple Fitness pour la nouvelle évaluation
// d'effort post-séance (demande Yvan 25/07, captures Apple fournies).
//
// Deux morceaux :
//   • EffortPromoBanner — carte dismissible en haut de l'écran Activité
//     (icône + titre + texte + CTA lime « Découvrir », croix pour fermer),
//     décalque du banner « Suivez votre charge d'entraînement » d'Apple.
//   • EffortPromoWalkthrough — modal 3 écrans (charge d'entraînement →
//     évalue ton effort → stats personnalisées), bouton Suivant/OK.
//
// Persistance : AsyncStorage 'fluid_effort_promo_done_v1' ('1' = vue ou
// fermée — on ne la remontre jamais). iOS uniquement (le wording parle de
// la charge d'entraînement Apple Santé).

import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Platform, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Polyline, Circle } from 'react-native-svg';

import { T } from '../constants/data';
import { GlassView, GlassButton } from './ui';
import { Icon } from './Icons';
import { hapticLight } from '../utils';

const PROMO_KEY = 'fluid_effort_promo_done_v1';
const LIME = '#AEEF4D';

// La bannière vit sur DEUX écrans (Activité + accueil Pour vous) et les tabs
// restent montés — un simple state local ne suffirait pas (fermer sur l'un
// la laisserait visible sur l'autre jusqu'au restart). Pub-sub module-level :
// dismiss() notifie toutes les instances du hook.
let promoDismissed = false;
const promoListeners = new Set();

export function useEffortPromo() {
  const [visible, setVisible] = useState(false);
  useEffect(function () {
    if (Platform.OS !== 'ios') return undefined;
    if (!promoDismissed) {
      AsyncStorage.getItem(PROMO_KEY).then(function (v) {
        if (v === '1') { promoDismissed = true; promoListeners.forEach(function (fn) { fn(); }); }
        else if (!promoDismissed) setVisible(true);
      }).catch(function () {});
    }
    const onDismiss = function () { setVisible(false); };
    promoListeners.add(onDismiss);
    return function () { promoListeners.delete(onDismiss); };
  }, []);
  function dismiss() {
    promoDismissed = true;
    promoListeners.forEach(function (fn) { fn(); });
    AsyncStorage.setItem(PROMO_KEY, '1').catch(function () {});
  }
  return { visible: visible, dismiss: dismiss };
}

// Petite courbe « charge » — clin d'œil à l'illustration Apple, en lime.
function LoadCurve({ width, height }) {
  const w = width || 120;
  const h = height || 44;
  const pts = [0, 0.55, 0.35, 0.7, 0.45, 0.85, 0.6, 1].map(function (v, i, arr) {
    const x = (i / (arr.length - 1)) * (w - 10) + 5;
    const y = h - 6 - v * (h - 14);
    return x + ',' + y;
  });
  const last = pts[pts.length - 1].split(',');
  return (
    <Svg width={w} height={h} viewBox={'0 0 ' + w + ' ' + h}>
      <Polyline points={pts.join(' ')} fill="none" stroke={LIME} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={4.5} fill={LIME} />
    </Svg>
  );
}

// Les 4 barres d'effort (décalque de l'écran « Évaluez votre effort »
// d'Apple, avec nos couleurs de niveaux).
function EffortBars({ highlight }) {
  const colors = ['#64D2FF', '#30D158', '#FF9F0A', '#FF453A'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      {colors.map(function (c, i) {
        const lit = highlight == null || i === highlight;
        return (
          <View
            key={i}
            style={{
              width: 34,
              height: 26 + i * 14,
              borderRadius: 8,
              backgroundColor: lit ? c : 'rgba(255,255,255,0.16)',
              opacity: lit ? 1 : 0.7,
            }}
          />
        );
      })}
    </View>
  );
}

export function EffortPromoBanner({ lang, onOpen, onDismiss, pad }) {
  const tr = T[lang] || T.fr;
  return (
    <View style={{ paddingHorizontal: pad != null ? pad : 22, marginBottom: 18 }}>
      <GlassView intensity={0} borderRadius={18} contentStyle={{ padding: 16 }}>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)' }}
        >
          <Icon name="close" size={13} color="rgba(255,255,255,0.7)" strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, paddingRight: 30 }}>
          <LoadCurve width={54} height={30} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2 }}>
            {tr.effort_promo_title || 'Suis ta charge d\'entraînement'}
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 19, marginBottom: 14 }}>
          {tr.effort_promo_sub || 'Tes séances FluidBody comptent désormais dans ta charge d\'entraînement Apple Santé. Découvre comment.'}
        </Text>
        <GlassButton variant="accent" forceDark size="lg" onPress={onOpen}>
          {tr.effort_promo_cta || 'Découvrir'}
        </GlassButton>
      </GlassView>
    </View>
  );
}

export function EffortPromoWalkthrough({ visible, lang, onDone }) {
  const tr = T[lang] || T.fr;
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(function () {
    if (visible) setStep(0);
  }, [visible]);

  const steps = [
    {
      illo: <LoadCurve width={170} height={70} />,
      title: tr.effort_w1_title || 'Consulte ta charge d\'entraînement',
      sub: tr.effort_w1_sub || 'Bouger fait du bien — à condition de doser. La charge d\'entraînement d\'Apple Santé compare ton effort des 7 derniers jours à celui des 28 derniers, pour t\'aider à progresser sans te brusquer.',
    },
    {
      illo: <EffortBars highlight={2} />,
      title: tr.effort_w2_title || 'Évalue ton effort',
      sub: tr.effort_w2_sub || 'À la fin de chaque séance, dis-nous comment c\'était : tout en douceur, modéré, soutenu ou intense. Ton ressenti est la mesure qui compte — c\'est lui qui nourrit ta charge.',
    },
    {
      illo: <EffortBars />,
      title: tr.effort_w3_title || 'Des stats qui te ressemblent',
      sub: tr.effort_w3_sub || 'Retrouve ta charge dans l\'app Fitness d\'Apple, et bientôt tes ressentis dans tes statistiques FluidBody — pour des programmes ajustés à ton énergie réelle.',
    },
  ];

  function next() {
    hapticLight();
    if (step >= steps.length - 1) {
      onDone();
      return;
    }
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
    setTimeout(function () { setStep(function (s) { return Math.min(s + 1, steps.length - 1); }); }, 110);
  }

  const s = steps[step];
  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onDone} presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: '#000a1a' }}>
        <TouchableOpacity
          onPress={onDone}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          style={{ position: 'absolute', top: 18, left: 18, zIndex: 2, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)' }}
        >
          <Icon name="close" size={15} color="rgba(255,255,255,0.75)" strokeWidth={2} />
        </TouchableOpacity>

        <Animated.View style={{ flex: 1, opacity: fade, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>{s.illo}</View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', textAlign: 'center', letterSpacing: -0.4, marginBottom: 14 }}>
            {s.title}
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', textAlign: 'center', lineHeight: 21, maxWidth: 320 }}>
            {s.sub}
          </Text>
        </Animated.View>

        {/* Points d'étape + CTA */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 34 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 18 }}>
            {steps.map(function (_, i) {
              return <View key={i} style={{ width: i === step ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === step ? LIME : 'rgba(255,255,255,0.25)' }} />;
            })}
          </View>
          <GlassButton variant="accent" forceDark size="lg" onPress={next}>
            {step >= steps.length - 1 ? (tr.effort_w_ok || 'OK') : (tr.effort_w_next || 'Suivant')}
          </GlassButton>
        </View>
      </View>
    </Modal>
  );
}
