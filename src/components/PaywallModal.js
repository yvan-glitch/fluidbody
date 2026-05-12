import { useState } from 'react';
import { View, Text, ScrollView, Modal, Alert, Dimensions, Linking, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedPlus from './AnimatedPlus';
import LivingBackground from './LivingBackground';
import { Bulle, FloatingMedusas, BULLES_ONBOARDING } from './Meduse';
import { T, PILIER_IMAGES } from '../constants/data';
import {
  GlassView,
  GlassButton,
  GlassCard,
  GlassPressable,
  GLASS_RADII,
} from './ui';
import { useTheme } from '../theme/ThemeProvider';

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

// Bénéfices listés sur le paywall. Petites icônes inline pour éviter
// d'ajouter une dep d'icônes ici — on reste cohérents avec le reste du repo.
function BulletCheck() {
  return (
    <View style={{
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: 'rgba(174,239,77,0.18)',
      borderWidth: 1, borderColor: 'rgba(174,239,77,0.45)',
      alignItems: 'center', justifyContent: 'center',
      marginRight: 12,
    }}>
      <Text style={{ color: '#AEEF4D', fontWeight: '800', fontSize: 12, marginTop: -1 }}>✓</Text>
    </View>
  );
}

export default function PaywallModal({ visible, onClose, lang, packagesByProductId, loadingPrices, disabled, onBuyMonthly, onBuyYearly, onRestore }) {
  var tr = T[lang] || T['fr'];
  var theme = useTheme().theme;
  var isLight = theme.mode === 'light';
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

  const benefits = isFr ? [
    'Toutes les séances vidéo en HD',
    'Téléchargements hors-ligne',
    'Programmes personnalisés selon ton corps',
    'Sans engagement, résiliable à tout moment',
  ] : [
    'All video sessions in HD',
    'Offline downloads',
    'Personalised programs for your body',
    'Cancel anytime, no commitment',
  ];

  function onCta() {
    if (loadingPrices) return;
    if (selected === 'yearly') {
      if (yearlyPkg) { onBuyYearly && onBuyYearly(yearlyPkg); return; }
    } else {
      if (monthlyPkg) { onBuyMonthly && onBuyMonthly(monthlyPkg); return; }
    }
    Alert.alert('FluidBody+', isFr ? 'Abonnement disponible dans la version App Store.' : 'Subscription available in the App Store version.');
  }

  // Pilule segmentée Mensuel / Annuel (toggle Liquid Glass).
  function planPill(key, label, sub, priceText) {
    var active = selected === key;
    return (
      <GlassPressable
        key={key}
        onPress={function() { setSelected(key); }}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${label} ${priceText}`}
        accessibilityHint={sub || undefined}
        style={{ flex: 1 }}
      >
        <GlassView
          intensity={60}
          borderRadius={GLASS_RADII.card}
          substrateColor={active ? theme.glass.substrateAccent : theme.glass.substrate}
          contentStyle={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            alignItems: 'flex-start',
            justifyContent: 'center',
            minHeight: 78,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: active ? theme.colors.accentText : theme.colors.text, letterSpacing: -0.2 }}>{label}</Text>
              {sub ? <Text style={{ fontSize: 11, fontWeight: '500', color: theme.colors.accentText, opacity: 0.85, marginTop: 4 }}>{sub}</Text> : null}
            </View>
            <View style={{
              width: 18, height: 18, borderRadius: 9,
              borderWidth: 2,
              borderColor: active ? theme.colors.accent : theme.colors.textTertiary,
              alignItems: 'center', justifyContent: 'center',
            }}>
              {active && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent }} />}
            </View>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text, marginTop: 6 }}>{priceText}</Text>
        </GlassView>
      </GlassPressable>
    );
  }

  // Hero absorber: in dark mode we dip to pitch black so the hero image
  // bleeds into the page; in light mode we land on the page bg colour to
  // keep the surrounding glass card legible above it.
  var heroAbsorber = isLight
    ? ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.10)', theme.colors.bg]
    : ['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.55)', '#000000'];

  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <LinearGradient colors={theme.colors.bgGradient} locations={theme.colors.bgGradientStops} style={StyleSheet.absoluteFill} />
        <LivingBackground />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, opacity: isLight ? 0.45 : 1 }} pointerEvents="none">
          {BULLES_ONBOARDING.map((b, i) => <Bulle key={`pw-${i}`} {...b} />)}
        </View>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, opacity: isLight ? 0.6 : 1 }} pointerEvents="none">
          <FloatingMedusas />
        </View>

        <ScrollView style={{ zIndex: 2 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Hero — image plein écran avec dégradé d'absorption sur le bas */}
          <View style={{ width: SW, height: Math.round(SH * 0.42), justifyContent: 'flex-end' }}>
            <ExpoImage source={PILIER_IMAGES.p7} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={heroAbsorber}
              locations={[0, 0.55, 1]}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
            <GlassPressable
              onPress={onClose}
              accessibilityLabel="Fermer le paywall"
              accessibilityRole="button"
              style={{ position: 'absolute', top: 56, right: 20 }}
            >
              <GlassView
                intensity={70}
                tint="dark"
                forceDark
                borderRadius={17}
                contentStyle={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 16, color: '#ffffff', fontWeight: '600' }}>✕</Text>
              </GlassView>
            </GlassPressable>
            <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#AEEF4D', letterSpacing: 3 }}>FLUIDBODY</Text>
                <AnimatedPlus style={{ fontSize: 18, fontWeight: '900', color: '#AEEF4D', marginLeft: 8 }}>+</AnimatedPlus>
              </View>
              <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff', lineHeight: 36, letterSpacing: -0.4 }}>{heroTitle}</Text>
            </View>
          </View>

          {/* Carte centrale — c'est l'élément qui doit "respirer" Liquid Glass */}
          <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
            <GlassCard
              intensity={75}
              borderRadius={GLASS_RADII.cardLg}
              padding={20}
              elevated
            >
              {/* Bénéfices */}
              <View style={{ marginBottom: 18 }}>
                {benefits.map((b, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i === benefits.length - 1 ? 0 : 10 }}>
                    <BulletCheck />
                    <Text style={{ flex: 1, fontSize: 14, color: theme.colors.text, fontWeight: '500', letterSpacing: -0.1 }}>{b}</Text>
                  </View>
                ))}
              </View>

              {/* Toggle Mensuel / Annuel : 2 pilules glass côte-à-côte */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {planPill('yearly', annualLabel, annualSub, yearlyDisplay)}
                {planPill('monthly', monthlyLabel, null, monthlyDisplay)}
              </View>

              {/* CTA principal */}
              <GlassButton
                variant="accent"
                size="lg"
                onPress={onCta}
                disabled={disabled || loadingPrices}
                loading={loadingPrices}
                textStyle={{ fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}
                accessibilityLabel={`${ctaLabel} ${selectedPrice}`}
              >
                {ctaLabel}
              </GlassButton>
              <Text style={{ fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary, textAlign: 'center', marginTop: 10 }}>{selectedPrice}</Text>
            </GlassCard>

            {disabled && (
              <View style={{ marginTop: 12 }}>
                <GlassCard
                  intensity={50}
                  borderRadius={14}
                  padding={12}
                  substrateColor="rgba(255,200,80,0.18)"
                >
                  <Text style={{ color: isLight ? '#8A6500' : 'rgba(255,220,140,0.92)', fontSize: 12, lineHeight: 18, textAlign: 'center' }}>{tr.paywall_not_available}</Text>
                </GlassCard>
              </View>
            )}
          </View>

          {/* "Restaurer mes achats" — lien discret en bas */}
          <View style={{ paddingHorizontal: 60, marginTop: 22 }}>
            <GlassButton
              onPress={onRestore}
              disabled={disabled}
              variant="subtle"
              size="sm"
              haptic="none"
              accessibilityLabel={tr.paywall_restore}
              textStyle={{ fontSize: 13, fontWeight: '500' }}
            >
              {tr.paywall_restore}
            </GlassButton>
          </View>

          {/* Légales — petite carte glass quasi-transparente, sans bevel pour rester discrète */}
          <View style={{ marginTop: 18, paddingHorizontal: 16 }}>
            <GlassCard
              intensity={40}
              borderRadius={14}
              padding={14}
              elevated={false}
            >
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 17 }}>
                {tr.paywall_legal || "L'abonnement se renouvelle automatiquement sauf annulation au moins 24h avant la fin de la période. Le paiement est débité via votre compte Apple. Gérez ou annulez dans Réglages > Apple ID > Abonnements."}
              </Text>
              <GlassPressable
                onPress={function() { Linking.openURL('https://yvan-glitch.github.io/fluidbody-privacy/'); }}
                accessibilityRole="link"
                accessibilityLabel={tr.paywall_privacy_link || 'Politique de confidentialité'}
                style={{ marginTop: 10, alignSelf: 'center' }}
              >
                <Text style={{ fontSize: 12, color: theme.colors.accentText, textAlign: 'center', textDecorationLine: 'underline', fontWeight: '600' }}>{tr.paywall_privacy_link || 'Politique de confidentialité'}</Text>
              </GlassPressable>
            </GlassCard>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

export { PRODUCT_IDS, getRcPriceString };
