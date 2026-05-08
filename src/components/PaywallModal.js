import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Alert, Dimensions, ImageBackground, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedPlus from './AnimatedPlus';
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

  const heroTitle = isFr ? 'Du Pilates pour tout le monde' : 'Pilates for everyone';
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
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          <ImageBackground source={PILIER_IMAGES.p7} resizeMode="cover" style={{ width: SW, height: Math.round(SH * 0.45), justifyContent: 'flex-end' }}>
            <LinearGradient
              colors={['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.55)', '#000000']}
              locations={[0, 0.55, 1]}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ position: 'absolute', top: 56, right: 20, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, color: '#ffffff', fontWeight: '600' }}>{'✕'}</Text>
            </TouchableOpacity>
            <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#AEEF4D', letterSpacing: 3 }}>FLUIDBODY</Text>
                <AnimatedPlus style={{ fontSize: 18, fontWeight: '900', color: '#AEEF4D', marginLeft: 8 }}>+</AnimatedPlus>
              </View>
              <Text style={{ fontSize: 34, fontWeight: '800', color: '#ffffff', lineHeight: 38, letterSpacing: -0.5 }}>{heroTitle}</Text>
            </View>
          </ImageBackground>

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
            <TouchableOpacity
              onPress={onCta}
              disabled={disabled || loadingPrices}
              activeOpacity={0.85}
              style={{
                height: 56, borderRadius: 28, backgroundColor: '#E5FF00',
                alignItems: 'center', justifyContent: 'center',
                opacity: (disabled || loadingPrices) ? 0.4 : 1,
                shadowColor: '#E5FF00', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 18,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#000000', letterSpacing: 0.2 }}>{ctaLabel}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 12 }}>{selectedPrice}</Text>
          </View>

          <TouchableOpacity onPress={onRestore} disabled={disabled} activeOpacity={0.7} style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{tr.paywall_restore}</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 22, paddingHorizontal: 28, lineHeight: 15 }}>
            {tr.paywall_legal || "L'abonnement se renouvelle automatiquement sauf annulation au moins 24h avant la fin de la période. Le paiement est débité via votre compte Apple. Gérez ou annulez dans Réglages > Apple ID > Abonnements."}
          </Text>
          <TouchableOpacity onPress={function() { Linking.openURL('https://fluidbody.app/privacy'); }} activeOpacity={0.7} style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign: 'center', textDecorationLine: 'underline' }}>{tr.paywall_privacy_link || 'Politique de confidentialité'}</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Modal>
  );
}

export { PRODUCT_IDS, getRcPriceString };
