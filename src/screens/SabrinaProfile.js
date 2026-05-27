// SabrinaProfile — écran dédié à Sabrina, accessible depuis :
//   • iPhone : Profil > carte "Votre Coach" > bouton "En savoir plus"
//   • Apple TV : ProfilTV > avatar header (focusable)
//
// Hero plein écran (sabrina_hero.jpg), nom + sous-titre, bio enrichie
// puisée de tr.coach_full_bio, citation tournante (SABRINA_QUOTES),
// crédits Espace Pilates.
//
// S'adapte iPhone / TV via IS_TV. Aucun nouveau dep, juste expo-image
// + LinearGradient + BlurView déjà présents partout dans l'app.

import { useMemo } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import LiquidGlass from '../components/LiquidGlass';

import { T, SABRINA_QUOTES } from '../constants/data';
import { IS_TV, tvFocusProps } from '../utils/platformTV';

const HERO = require('../../assets/coach/sabrina_hero.jpg');
const PORTRAIT = require('../../assets/coach/sabrina_avatar.jpg');

function getQuoteOfDay(lang) {
  try {
    const arr = SABRINA_QUOTES[lang] || SABRINA_QUOTES.fr || [];
    if (!arr.length) return '';
    const d = new Date();
    const idx = (d.getDate() + d.getMonth() * 31) % arr.length;
    return arr[idx];
  } catch (e) { return ''; }
}

export default function SabrinaProfile({ lang, onClose }) {
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const quote = useMemo(function () { return getQuoteOfDay(lang); }, [lang]);
  const { width: SW, height: SH } = Dimensions.get('window');

  const HERO_H = IS_TV ? Math.round(SH * 0.55) : Math.round(SH * 0.42);
  const PAD_H = IS_TV ? 80 : 22;

  const bioParas = (tr.coach_full_bio || '').split('\n\n').filter(Boolean);

  const subtitleLine = isFr
    ? 'Coach Pilates · 30 ans de pratique · Espace Pilates Vaud (Suisse)'
    : 'Pilates Coach · 30 years of practice · Espace Pilates Vaud (Switzerland)';

  return (
    <View style={{ flex: 1, backgroundColor: '#000e18' }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: IS_TV ? 80 : 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={{ width: '100%', height: HERO_H, backgroundColor: '#000e18' }}>
          <ExpoImage
            source={HERO}
            contentFit="cover"
            cachePolicy="memory-disk"
            style={{ width: '100%', height: '100%' }}
          />
          <LinearGradient
            colors={['rgba(0,14,24,0)', 'rgba(0,14,24,0.4)', 'rgba(0,14,24,0.95)']}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Header overlay : retour */}
          {onClose ? (
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.85}
              {...tvFocusProps()}
              style={{
                position: 'absolute',
                top: IS_TV ? 60 : 56,
                left: IS_TV ? 60 : 18,
                paddingHorizontal: IS_TV ? 22 : 14,
                paddingVertical: IS_TV ? 12 : 8,
                borderRadius: IS_TV ? 14 : 10,
                backgroundColor: 'rgba(8,24,40,0.6)',
                borderWidth: 1,
                borderColor: 'rgba(174,239,77,0.4)',
              }}
            >
              <Text style={{ color: '#AEEF4D', fontWeight: '700', fontSize: IS_TV ? 18 : 14 }}>
                {tr.retour || (isFr ? 'Retour' : 'Back')}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Title block flottant en bas du hero */}
          <View style={{ position: 'absolute', left: PAD_H, right: PAD_H, bottom: IS_TV ? 36 : 22 }}>
            <Text
              style={{
                color: '#AEEF4D',
                fontSize: IS_TV ? 14 : 11,
                fontWeight: '800',
                letterSpacing: 3,
                textTransform: 'uppercase',
                marginBottom: IS_TV ? 10 : 6,
              }}
            >
              {isFr ? 'Votre coach' : 'Your coach'}
            </Text>
            <Text
              style={{
                color: '#ffffff',
                fontSize: IS_TV ? 72 : 42,
                fontWeight: '200',
                letterSpacing: -0.5,
                lineHeight: IS_TV ? 80 : 46,
              }}
            >
              Sabrina Tissot
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.78)',
                fontSize: IS_TV ? 20 : 13,
                marginTop: IS_TV ? 14 : 8,
                lineHeight: IS_TV ? 28 : 18,
              }}
            >
              {subtitleLine}
            </Text>
          </View>
        </View>

        {/* Bloc citation principale */}
        {quote ? (
          <View style={{ marginTop: IS_TV ? 50 : 28, marginHorizontal: PAD_H }}>
            <View
              style={{
                borderRadius: IS_TV ? 22 : 16,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(174,239,77,0.22)',
              }}
            >
              <LiquidGlass
                intensity={Platform.OS === 'ios' ? 60 : 0}
                tint="dark"
                style={{ backgroundColor: 'rgba(10,20,35,0.55)', padding: IS_TV ? 36 : 22 }}
              >
                <Text
                  style={{
                    color: '#AEEF4D',
                    fontSize: IS_TV ? 16 : 11,
                    fontWeight: '700',
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    marginBottom: IS_TV ? 14 : 10,
                  }}
                >
                  {isFr ? 'Phrase du jour' : 'Quote of the day'}
                </Text>
                <Text
                  style={{
                    color: 'rgba(255,255,255,0.92)',
                    fontSize: IS_TV ? 28 : 18,
                    fontWeight: '300',
                    fontStyle: 'italic',
                    lineHeight: IS_TV ? 38 : 26,
                  }}
                >
                  {'« ' + quote + ' »'}
                </Text>
              </LiquidGlass>
            </View>
          </View>
        ) : null}

        {/* Bio */}
        <View style={{ marginTop: IS_TV ? 50 : 28, marginHorizontal: PAD_H }}>
          <Text
            style={{
              color: '#AEEF4D',
              fontSize: IS_TV ? 16 : 11,
              fontWeight: '700',
              letterSpacing: 3,
              textTransform: 'uppercase',
              marginBottom: IS_TV ? 18 : 12,
            }}
          >
            {isFr ? 'Parcours' : 'Background'}
          </Text>
          {bioParas.map(function (para, i) {
            return (
              <Text
                key={i}
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: IS_TV ? 22 : 15,
                  fontWeight: '300',
                  lineHeight: IS_TV ? 34 : 24,
                  marginBottom: IS_TV ? 22 : 16,
                }}
              >
                {para}
              </Text>
            );
          })}
        </View>

        {/* Crédits Espace Pilates */}
        <View
          style={{
            marginTop: IS_TV ? 40 : 24,
            marginHorizontal: PAD_H,
            flexDirection: IS_TV ? 'row' : 'column',
            alignItems: 'center',
            gap: IS_TV ? 28 : 14,
            padding: IS_TV ? 28 : 18,
            borderRadius: IS_TV ? 22 : 16,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)',
            backgroundColor: 'rgba(0,18,38,0.35)',
          }}
        >
          <View
            style={{
              width: IS_TV ? 110 : 64,
              height: IS_TV ? 110 : 64,
              borderRadius: IS_TV ? 55 : 32,
              overflow: 'hidden',
              borderWidth: 2,
              borderColor: '#AEEF4D',
            }}
          >
            <ExpoImage source={PORTRAIT} contentFit="cover" style={{ flex: 1 }} cachePolicy="memory-disk" />
          </View>
          <View style={{ flex: 1, alignItems: IS_TV ? 'flex-start' : 'center' }}>
            <Text
              style={{
                color: '#ffffff',
                fontSize: IS_TV ? 22 : 15,
                fontWeight: '700',
                marginBottom: IS_TV ? 6 : 4,
                textAlign: IS_TV ? 'left' : 'center',
              }}
            >
              Espace Pilates
            </Text>
            <Text
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: IS_TV ? 17 : 12,
                lineHeight: IS_TV ? 24 : 18,
                textAlign: IS_TV ? 'left' : 'center',
              }}
            >
              {isFr
                ? 'La Tour-de-Peilz · Vaud · Suisse — studio fondé par Sabrina, où le Pilates conscient se vit chaque jour.'
                : 'La Tour-de-Peilz · Vaud · Switzerland — Sabrina\'s studio, where conscious Pilates is lived every day.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Helper Modal qui wrap SabrinaProfile pour usage iPhone (Modal slide bottom).
export function SabrinaProfileModal({ visible, lang, onClose }) {
  return (
    <Modal
      visible={!!visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SabrinaProfile lang={lang} onClose={onClose} />
    </Modal>
  );
}
