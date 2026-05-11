import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Alert, Dimensions, Linking, Platform, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AnimatedPlus from './AnimatedPlus';
import GlassButton from './GlassButton';
import LivingBackground from './LivingBackground';
import { Bulle, FloatingMedusas, BULLES_ONBOARDING } from './Meduse';
import { T, PILIER_IMAGES } from '../constants/data';

const { width: SW, height: SH } = Dimensions.get('window');

const PRODUCT_IDS = {
  monthly: 'com.fluidbody.app.premium.monthly',
  yearly: 'com.fluidbody.app.premium.yearly',
};

function getRcPriceString(pkg) {
  const p = pkg?.product;
  if (!p) return '';
  if (typeof p.priceString === 'string' && p.priceString.trim()) return p.priceString.trim();
  if (typeof p.localizedPriceString === 'string' && p.localizedPriceString.trim()) return p.localizedPriceString.trim();
  if (typeof p.localizedPrice === 'string' && p.localizedPrice.trim()) return p.localizedPrice.trim();
  if (p.price != null && p.currencyCode) return `${p.price} ${p.currencyCode}`;
  if (p.price != null) return String(p.price);
  return '';
}

function withPeriod(s, suffix) {
  if (!s) return '';
  if (s.includes('/')) return s;
  return `${s}${suffix}`;
}

export default function PaywallModal({ visible, onClose, lang, packagesByProductId, loadingPrices, disabled, onBuyMonthly, onBuyYearly, onRestore }) {
  var tr = T[lang] || T['fr'];
  var isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  var monthlyPkg = packagesByProductId && packagesByProductId[PRODUCT_IDS.monthly];
  var yearlyPkg = packagesByProductId && packagesByProductId[PRODUCT_IDS.yearly];
  var monthlyPriceRaw = getRcPriceString(monthlyPkg) || 'CHF 12.90';
  var yearlyPriceRaw = getRcPriceString(yearlyPkg) || 'CHF 99.00';
  var monthlyDisplay = withPeriod(monthlyPriceRaw, isFr ? '/mois' : '/mo');
  var yearlyDisplay = withPeriod(yearlyPriceRaw, isFr ? '/an' : '/yr');

  const [selected, setSelected] = useState('yearly');
  const selectedPrice = selected === 'yearly' ? yearlyDisplay : monthlyDisplay;

  const heroTitle = isFr ? 'Le Pilates conscient, au quotidien' : 'Conscious Pilates, every day';
  const annualLabel = isFr ? 'Annuel' : 'Annual';
  const annualSub = isFr ? '12 mois pour le prix de 8' : '12 months for the price of 8';
  const monthlyLabel = isFr ? 'Mensuel' : 'Monthly';
  const ctaLabel = isFr ? 'Commencer' : 'Start';

  function onCta() {
    if (loadingPrices) return;
    if (selected === 'yearly') {
      if (yearlyPkg) { onBuyYearly && onBuyYearly(yearlyPkg); return; }
    } else {
      if (monthlyPkg) { onBuyMonthly && onBuyMonthly(monthlyPkg); return; }
    }
    Alert.alert('FluidBody+', isFr ? 'Abonnement disponible dans la version App Store.' : 'Subscription available in the App Store version.');
  }

  function planCard(key, label, sub, priceText) {
    var active = selected === key;
    return (
      <TouchableOpacity
        key={key}
        activeOpacity={0.85}
        onPress={function() { setSelected(key); }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 18,
          paddingVertical: 16,
          borderRadius: 16,
          marginBottom: 10,
          borderWidth: active ? 2 : 1,
          borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.14)',
          backgroundColor: active ? 'rgba(174,239,77,0.07)' : 'rgba(255,255,255,0.04)',
        }}
      >
        <View style={{
          width: 22, height: 22, borderRadius: 11, marginRight: 14,
          borderWidth: 2,
          borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.3)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#AEEF4D' }} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>{label}</Text>
          {sub ? <Text style={{ fontSize: 12, fontWeight: '500', color: '#AEEF4D', marginTop: 2 }}>{sub}</Text> : null}
        </View>
        <Text style={{ fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.92)' }}>{priceText}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000a1a' }}>
        <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
        <LivingBackground />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
          {BULLES_ONBOARDING.map((b, i) => <Bulle key={`pw-${i}`} {...b} />)}
        </View>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} pointerEvents="none">
          <FloatingMedusas />
        </View>
        <ScrollView style={{ zIndex: 2 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          <View style={{ width: SW, height: Math.round(SH * 0.45), justifyContent: 'flex-end' }}>
            <ExpoImage source={PILIER_IMAGES.p7} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.55)', '#000000']}
              locations={[0, 0.55, 1]}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ position: 'absolute', top: 56, right: 20, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(30,30,40,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, color: '#ffffff', fontWeight: '600' }}>{'✕'}</Text>
            </TouchableOpacity>
            <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#AEEF4D', letterSpacing: 3 }}>FLUIDBODY</Text>
                <AnimatedPlus style={{ fontSize: 18, fontWeight: '900', color: '#AEEF4D', marginLeft: 8 }}>+</AnimatedPlus>
              </View>
              <Text style={{ fontSize: 34, fontWeight: '800', color: '#ffffff', lineHeight: 38, letterSpacing: -0.5 }}>{heroTitle}</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
            {planCard('yearly', annualLabel, annualSub, yearlyDisplay)}
            {planCard('monthly', monthlyLabel, null, monthlyDisplay)}
          </View>

          {disabled && (
            <View style={{ marginHorizontal: 20, marginTop: 8, backgroundColor: 'rgba(255,200,80,0.10)', borderWidth: 1, borderColor: 'rgba(255,200,80,0.25)', borderRadius: 14, padding: 12 }}>
              <Text style={{ color: 'rgba(255,220,140,0.9)', fontSize: 12, lineHeight: 18, textAlign: 'center' }}>{tr.paywall_not_available}</Text>
            </View>
          )}

          <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
            <GlassButton
              onPress={onCta}
              disabled={disabled || loadingPrices}
              size="lg"
              textColor="#AEEF4D"
              textStyle={{ fontSize: 16, fontWeight: '800' }}
            >
              {ctaLabel}
            </GlassButton>
            <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 12 }}>{selectedPrice}</Text>
          </View>

          <View style={{ paddingHorizontal: 60, marginTop: 18 }}>
            <GlassButton
              onPress={onRestore}
              disabled={disabled}
              size="sm"
              textColor="rgba(255,255,255,0.7)"
              textStyle={{ fontSize: 13, fontWeight: '500' }}
            >
              {tr.paywall_restore}
            </GlassButton>
          </View>

          <View style={{ marginTop: 22, marginHorizontal: 16, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(0,18,32,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 17 }}>
              {tr.paywall_legal || "L'abonnement se renouvelle automatiquement sauf annulation au moins 24h avant la fin de la période. Le paiement est débité via votre compte Apple. Gérez ou annulez dans Réglages > Apple ID > Abonnements."}
            </Text>
            <TouchableOpacity onPress={function() { Linking.openURL('https://yvan-glitch.github.io/fluidbody-privacy/'); }} activeOpacity={0.7} style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 12, color: '#AEEF4D', textAlign: 'center', textDecorationLine: 'underline', fontWeight: '600' }}>{tr.paywall_privacy_link || 'Politique de confidentialité'}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

export { PRODUCT_IDS, getRcPriceString };
