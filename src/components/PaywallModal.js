import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Modal, Alert, Dimensions, Linking, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedPlus from './AnimatedPlus';
import LivingBackground from './LivingBackground';
import { Bulle, FloatingMedusas, BULLES_ONBOARDING } from './Meduse';
import { T, PILIER_IMAGES } from '../constants/data';
import { LEGAL, getTermsUrl } from '../constants/legal';
import {
  FOUNDER_INTRO_SAVINGS_CHF,
} from '../constants/iap';
import {
  GlassView,
  GlassButton,
  GlassCard,
  GlassPressable,
  GLASS_RADII,
} from './ui';
import { Icon } from './Icons';
import { useTheme } from '../theme/ThemeProvider';
import { IS_TV, tvFocusProps, TV_FOCUS_RING } from '../utils/platformTV';
import { breadcrumb } from '../utils/breadcrumb';
import { AquaticBackground, GlassCardTV } from './tv';

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

function TestimonialsCard({ testimonials, theme, sectionTitle }) {
  const [idx, setIdx] = useState(0);
  const opac = useRef(new Animated.Value(1)).current;
  const pendingSwap = useRef(null);
  useEffect(() => {
    if (!Array.isArray(testimonials) || testimonials.length < 2) return;
    const itv = setInterval(() => {
      Animated.sequence([
        Animated.timing(opac, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(opac, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
      // Track the swap timer so we can cancel it on unmount — otherwise a
      // rapid close of the paywall would still flip the testimonial after
      // the component is gone.
      if (pendingSwap.current) clearTimeout(pendingSwap.current);
      pendingSwap.current = setTimeout(() => {
        pendingSwap.current = null;
        setIdx((i) => (i + 1) % testimonials.length);
      }, 280);
    }, 7000);
    return () => {
      clearInterval(itv);
      if (pendingSwap.current) {
        clearTimeout(pendingSwap.current);
        pendingSwap.current = null;
      }
    };
  }, [testimonials]);

  if (!Array.isArray(testimonials) || testimonials.length === 0) return null;
  const t = testimonials[idx];
  const initial = (t.name || '?').slice(0, 1).toUpperCase();
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>
        {sectionTitle}
      </Text>
      <GlassCard intensity={55} borderRadius={GLASS_RADII.card} padding={16}>
        <Animated.View style={{ opacity: opac, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: 'rgba(174,239,77,0.18)',
            borderWidth: 1, borderColor: 'rgba(174,239,77,0.45)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#AEEF4D' }}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontStyle: 'italic', color: theme.colors.text, lineHeight: 19 }}>
              {t.text}
            </Text>
            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 5, letterSpacing: 0.3 }}>
              {t.name}{t.age ? `, ${t.age}` : ''}
            </Text>
          </View>
        </Animated.View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          {testimonials.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === idx ? 18 : 6,
                height: 4,
                borderRadius: 2,
                backgroundColor: i === idx ? '#AEEF4D' : theme.colors.hairline,
              }}
            />
          ))}
        </View>
      </GlassCard>
    </View>
  );
}

function CompareTable({ features, theme, title, appLabel, studioLabel }) {
  if (!Array.isArray(features) || features.length === 0) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>
        {title}
      </Text>
      <GlassCard intensity={55} borderRadius={GLASS_RADII.card} padding={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.hairline }}>
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.accentText, letterSpacing: 0.6, width: 64, textAlign: 'center' }}>{appLabel}</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, letterSpacing: 0.6, width: 80, textAlign: 'center' }}>{studioLabel}</Text>
        </View>
        {features.map((f, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: i === features.length - 1 ? 0 : 1, borderBottomColor: theme.colors.hairline }}>
            <Text style={{ flex: 1, fontSize: 12, fontWeight: '500', color: theme.colors.text, paddingRight: 6 }} numberOfLines={2}>
              {f.feature}
            </Text>
            <View style={{ width: 64, alignItems: 'center' }}>
              {f.app
                ? <Icon name="check" size={16} color="#AEEF4D" strokeWidth={2.4} />
                : <Text style={{ color: theme.colors.textTertiary, fontWeight: '700' }}>-</Text>}
            </View>
            <View style={{ width: 80, alignItems: 'center' }}>
              {f.studio
                ? <Icon name="check" size={16} color={theme.colors.accent} strokeWidth={2.4} />
                : <Text style={{ color: theme.colors.textTertiary, fontWeight: '700' }}>-</Text>}
            </View>
          </View>
        ))}
      </GlassCard>
    </View>
  );
}

// TVPaywallView — render alternative pour Apple TV.
//
// Layout horizontal 50/50 : hero + bénéfices à gauche, plans + CTA à
// droite. Focusable, lisible à 3 m. Pas de testimonials carousel
// auto-pause-incompatible — au lieu de ça, on affiche un témoignage à
// la fois, swap toutes les 8 s. Bouton "J'ai déjà un abonnement"
// renvoie au flow de pairing iPhone (onClose puis l'utilisateur va
// dans son iPhone → Profil → Pairer Apple TV).

// Apple TV : safety net. Si le paywall s'ouvre sur tvOS et que l'utilisateur
// n'est PAS abonné, on n'affiche jamais le TVPaywallView (achat tvOS pas
// supporté pour FluidBody+). À la place on rend un overlay simple qui dit
// d'aller souscrire sur l'iPhone, avec un bouton Refresh qui relance la
// lecture de `profiles.is_subscriber` côté MainApp. Règle métier :
// « jamais de paywall TV ». Le rendu TVPaywallView en dessous est gardé
// (non supprimé) au cas où la règle évoluerait.
function TVPaywallFallback({ onClose, onRefresh, lang }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const [focusedKey, setFocusedKey] = useState(null);
  const understandLabel = isFr ? 'Comprendre' : 'Got it';
  const refreshLabel = isFr ? 'Actualiser' : 'Refresh';
  const title = isFr ? 'Activer FluidBody+ sur Apple TV' : 'Activate FluidBody+ on Apple TV';
  const body = isFr
    ? "Pour activer FluidBody+ sur Apple TV, abonne-toi depuis l'app iPhone.\nLa TV se synchronisera automatiquement."
    : 'To activate FluidBody+ on Apple TV, subscribe from the iPhone app.\nYour TV will sync automatically.';

  return (
    <View style={{ flex: 1, backgroundColor: '#000a1a', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <AquaticBackground density="low" contentOpacity={0.4} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 28 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: '#AEEF4D', letterSpacing: 5 }}>FLUIDBODY</Text>
        <AnimatedPlus style={{ fontSize: 22, fontWeight: '900', color: '#AEEF4D', marginLeft: 8 }}>+</AnimatedPlus>
      </View>
      <Text style={{ fontSize: 44, fontWeight: '300', color: '#ffffff', textAlign: 'center', letterSpacing: -0.8, marginBottom: 26, maxWidth: 900 }}>{title}</Text>
      <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.78)', textAlign: 'center', lineHeight: 30, marginBottom: 56, maxWidth: 820 }}>{body}</Text>

      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity
          {...tvFocusProps(true)}
          onPress={onClose}
          onFocus={function() { setFocusedKey('understand'); }}
          onBlur={function() { setFocusedKey(null); }}
          activeOpacity={0.88}
          style={[
            {
              paddingHorizontal: 44,
              paddingVertical: 22,
              borderRadius: 18,
              backgroundColor: '#AEEF4D',
              marginRight: 18,
              shadowColor: '#AEEF4D',
              shadowOpacity: focusedKey === 'understand' ? 0.6 : 0.3,
              shadowRadius: focusedKey === 'understand' ? 22 : 14,
              shadowOffset: { width: 0, height: 8 },
            },
            focusedKey === 'understand' ? { transform: [{ scale: 1.05 }] } : null,
          ]}
        >
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#001a2e', letterSpacing: 0.4 }}>{understandLabel} →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          {...tvFocusProps(false)}
          onPress={function() { if (onRefresh) onRefresh(); }}
          onFocus={function() { setFocusedKey('refresh'); }}
          onBlur={function() { setFocusedKey(null); }}
          activeOpacity={0.7}
          style={[
            {
              paddingHorizontal: 36,
              paddingVertical: 22,
              borderRadius: 18,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.3)',
              backgroundColor: 'rgba(8,24,40,0.6)',
            },
            focusedKey === 'refresh' ? TV_FOCUS_RING : null,
          ]}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', letterSpacing: 0.3 }}>{refreshLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PaywallModal({ visible, onClose, lang, packagesByProductId, loadingPrices, disabled, onBuyMonthly, onBuyYearly, onRestore, freeDaysAvailable, isSubscriber, onTvRefreshSubscriber }) {
  // FIX rules-of-hooks (2026-07-23) : hooks avant tout early-return.
  var theme = useTheme().theme;
  const [selected, setSelected] = useState('yearly');

  // Apple TV : court-circuit safety. Règle « jamais de paywall TV » —
  // un user payé sur iPhone qui paire sa TV doit voir l'app, pas le
  // paywall. Si jamais le paywall s'ouvre (CTA mal câblé, race condition
  // sur le fetch is_subscriber, etc.), on tombe sur TVPaywallFallback au
  // lieu du TVPaywallView qui propose un achat impossible sur tvOS.
  // Le TVPaywallView est conservé dans ce fichier pour usage futur.
  if (IS_TV) {
    return (
      <Modal visible={!!visible} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
        <TVPaywallFallback onClose={onClose} onRefresh={onTvRefreshSubscriber} lang={lang} />
      </Modal>
    );
  }

  var tr = T[lang] || T['fr'];
  var isLight = theme.mode === 'light';
  var isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;

  // Texte légal d'abonnement adapté à la plateforme : sur Android l'abonnement
  // se gère dans Google Play (et non dans les Réglages Apple). On force ces
  // libellés selon Platform.OS (les chaînes de data.js sont rédigées « Apple »).
  var isAndroidStore = Platform.OS === 'android';
  var paywallCancelPill = isFr
    ? (isAndroidStore ? 'Annulable depuis Google Play' : 'Annulable depuis Réglages Apple')
    : (isAndroidStore ? 'Cancel anytime in Google Play' : 'Cancel anytime in Apple Settings');
  var paywallFounderLegal = isFr
    ? (isAndroidStore ? 'Aucun engagement, annulable à tout moment dans Google Play' : 'Aucun engagement, annulable à tout moment depuis tes Réglages Apple')
    : (isAndroidStore ? 'No commitment, cancel anytime in Google Play' : 'No commitment, cancel anytime from your Apple Settings');
  var paywallFullLegal = isFr
    ? (isAndroidStore
        ? "L'abonnement se renouvelle automatiquement sauf annulation au moins 24h avant la fin de la période. Le paiement est débité via votre compte Google Play. Gérez ou annulez dans Google Play > Abonnements."
        : "L'abonnement se renouvelle automatiquement sauf annulation au moins 24h avant la fin de la période. Le paiement est débité via votre compte Apple. Gérez ou annulez dans Réglages > Apple ID > Abonnements.")
    : (isAndroidStore
        ? 'The subscription renews automatically unless cancelled at least 24h before the end of the period. Payment is charged to your Google Play account. Manage or cancel in Google Play > Subscriptions.'
        : 'The subscription renews automatically unless cancelled at least 24h before the end of the period. Payment is charged to your Apple account. Manage or cancel in Settings > Apple ID > Subscriptions.');
  var monthlyPkg = packagesByProductId && packagesByProductId[PRODUCT_IDS.monthly];
  var yearlyPkg = packagesByProductId && packagesByProductId[PRODUCT_IDS.yearly];
  // (2026-07-23) Prix ENTIÈREMENT localisés via RevenueCat/StoreKit :
  // - grand prix de la carte = prix d'INTRO App Store si défini (12.90/99 en
  //   Suisse), sinon prix standard ;
  // - « Puis X » = prix standard localisé (avant : « Puis 24.90 CHF » codé en
  //   dur → incohérent pour tout client hors storefront suisse).
  // Fallbacks CHF conservés pour l'affichage hors-ligne / packages absents.
  var monthlyIntroStr = (monthlyPkg && monthlyPkg.product && monthlyPkg.product.introPrice && monthlyPkg.product.introPrice.priceString) || null;
  var yearlyIntroStr = (yearlyPkg && yearlyPkg.product && yearlyPkg.product.introPrice && yearlyPkg.product.introPrice.priceString) || null;
  var monthlyStdStr = getRcPriceString(monthlyPkg) || null;
  var yearlyStdStr = getRcPriceString(yearlyPkg) || null;
  // (2026-07-24) Si le produit live n'a PAS d'offre d'introduction dans App
  // Store Connect, StoreKit renvoie introPrice = null → on masquait le
  // problème en retombant sur le prix standard, ce qui affichait
  // « X les 3 premiers mois, puis X » (même prix deux fois = copy mensongère,
  // risque de rejet Apple). Règle : toute la copy d'intro (« les 3 premiers
  // mois », « puis X », pill éco) n'apparaît QUE si l'intro existe côté store.
  // Package absent (offline / Expo Go) → on garde la copy founder par défaut
  // (marché CHF connu, config cible avec intro).
  var monthlyHasIntro = monthlyPkg ? !!monthlyIntroStr : true;
  var yearlyHasIntro = yearlyPkg ? !!yearlyIntroStr : true;
  var monthlyPriceRaw = monthlyIntroStr || monthlyStdStr || 'CHF 12.90';
  var yearlyPriceRaw = yearlyIntroStr || yearlyStdStr || 'CHF 99.00';
  var monthlyDisplay = withPeriod(monthlyPriceRaw, isFr ? '/mois' : '/mo');
  var yearlyDisplay = withPeriod(yearlyPriceRaw, isFr ? '/an' : '/yr');
  // Small print « Puis X/mois » — uniquement si une intro existe réellement.
  var thenMonthlyText = !monthlyHasIntro ? null : (monthlyStdStr
    ? ((isFr ? 'Puis ' : 'Then ') + monthlyStdStr + (isFr ? '/mois' : '/month'))
    : (tr.paywall_founder_then_monthly || (isFr ? 'Puis 24.90 CHF/mois' : 'Then 24.90 CHF/month')));
  var thenYearlyText = !yearlyHasIntro ? null : (yearlyStdStr
    ? ((isFr ? 'Puis ' : 'Then ') + yearlyStdStr + (isFr ? '/an' : '/yr'))
    : (tr.paywall_founder_then_yearly || (isFr ? 'Puis 199 CHF/an' : 'Then 199 CHF/year')));

  const selectedPrice = selected === 'yearly' ? yearlyDisplay : monthlyDisplay;
  const testimonials = Array.isArray(tr.paywall_testimonials) ? tr.paywall_testimonials : null;
  const compareFeatures = Array.isArray(tr.paywall_compare_features) ? tr.paywall_compare_features : null;

  // Founder copy — offre d'introduction (3 mois mensuel, 1re année annuel).
  // Aucun emoji, ton posé, pas de comparaison concurrence.
  const heroTitle = tr.paywall_founder_hero_title || (isFr ? 'Rejoins les fondateurs FluidBody+' : 'Join the FluidBody+ founders');
  const heroSub = tr.paywall_founder_hero_sub || (isFr
    ? 'Le Pilates conscient de Sabrina, sur tous tes écrans. Tarif fondateur pour les premiers membres.'
    : "Sabrina's conscious Pilates, on every screen. Founder pricing for the first members.");
  const annualLabel = isFr ? 'Annuel' : 'Annual';
  const monthlyLabel = isFr ? 'Mensuel' : 'Monthly';
  const ctaLabel = tr.paywall_founder_cta || (isFr ? 'S\'abonner' : 'Subscribe');

  const founderBulletsBase = Array.isArray(tr.paywall_founder_bullets) && tr.paywall_founder_bullets.length > 0
    ? tr.paywall_founder_bullets
    : (isFr ? [
        '9 piliers de Pilates conscient',
        'iPhone et Apple TV inclus',
        'Guidé par Sabrina, 30 ans de pratique',
        'Disponible en quatre langues',
      ] : [
        '9 pillars of conscious Pilates',
        'iPhone and Apple TV included',
        'Guided by Sabrina, 30 years of practice',
        'Available in four languages',
      ]);

  // Sur Android, l'app n'est ni sur iPhone ni sur Apple TV → on neutralise
  // l'avantage qui les mentionne pour ne pas afficher d'appareils inexistants.
  const founderBullets = founderBulletsBase.map(function(b) {
    if (isAndroidStore && /Apple TV|iPhone/i.test(b)) {
      return isFr ? 'Tout FluidBody+ dans un seul abonnement' : 'All of FluidBody+ in a single subscription';
    }
    return b;
  });

  // (Le tarif standard ne s'affiche plus barré sur les cards : on a
  // remplacé par "Puis 24.90 / Puis 199" en small print sous le prix
  // d'introduction. Cf. planPill ci-dessus.)

  function onCta() {
    if (loadingPrices) return;
    breadcrumb('Subscribe tapped', { plan: selected }, { category: 'purchase' });
    if (selected === 'yearly') {
      if (yearlyPkg) { onBuyYearly && onBuyYearly(yearlyPkg); return; }
    } else {
      if (monthlyPkg) { onBuyMonthly && onBuyMonthly(monthlyPkg); return; }
    }
    Alert.alert('FluidBody+', isFr ? 'Abonnement disponible dans la version App Store.' : 'Subscription available in the App Store version.');
  }

  // Plan card founder — grand prix d'introduction au centre, sous-titre
  // "Tarif fondateur · 3 premiers mois" / "1re année", small print "Puis
  // 24.90 CHF/mois" / "Puis 199 CHF/an" en bas. Pill éco "Économise 100
  // CHF la 1re année" uniquement sur l'annuel.
  //
  // Signature : (key, label, introSub, priceText, thenText, savingsLabel).
  function planPill(key, label, introSub, priceText, thenText, savingsLabel) {
    var active = selected === key;
    return (
      <GlassPressable
        key={key}
        onPress={function() { setSelected(key); }}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${label} ${priceText} ${thenText || ''}`}
        accessibilityHint={introSub || undefined}
        style={{ flex: 1 }}
      >
        <GlassView
          intensity={28}
          tint="dark"
          forceDark
          borderRadius={GLASS_RADII.card}
          substrateColor={active ? 'rgba(174,239,77,0.10)' : 'rgba(0,0,0,0.35)'}
          contentStyle={{
            paddingVertical: 18,
            paddingHorizontal: 18,
            alignItems: 'flex-start',
            justifyContent: 'center',
            minHeight: 134,
            borderWidth: active ? 1.5 : 1,
            borderColor: active ? 'rgba(174,239,77,0.65)' : 'rgba(255,255,255,0.15)',
            borderRadius: GLASS_RADII.card,
          }}
        >
          {/* Ligne 1 — label de plan + radio à droite */}
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 8 }}>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.78)', letterSpacing: 0.2, textTransform: 'uppercase' }}>{label}</Text>
            <View style={{
              width: 18, height: 18, borderRadius: 9,
              borderWidth: 1.5,
              borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.4)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {active && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#AEEF4D' }} />}
            </View>
          </View>
          {/* Ligne 2 — grand prix d'introduction (Apple SF Pro feel) */}
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: -0.7 }}>{priceText}</Text>
          {/* Ligne 3 — sous-titre "Tarif fondateur · 3 premiers mois / 1re année" */}
          {introSub ? (
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#AEEF4D', letterSpacing: 0.2, marginTop: 4 }}>{introSub}</Text>
          ) : null}
          {/* Ligne 4 — small print "Puis 24.90 CHF/mois" / "Puis 199 CHF/an" */}
          {thenText ? (
            <Text style={{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.5)', marginTop: 8, letterSpacing: 0.1 }}>{thenText}</Text>
          ) : null}
          {/* Pill éco — uniquement annuel, outline lime sobre */}
          {savingsLabel ? (
            <View style={{
              alignSelf: 'flex-start',
              marginTop: 10,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderWidth: 1,
              borderColor: 'rgba(174,239,77,0.55)',
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#AEEF4D', letterSpacing: 0.4 }}>
                {savingsLabel}
              </Text>
            </View>
          ) : null}
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
                <Icon name="close" size={18} color="#ffffff" strokeWidth={2} />
              </GlassView>
            </GlassPressable>
            <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#AEEF4D', letterSpacing: 3 }}>FLUIDBODY</Text>
                <AnimatedPlus style={{ fontSize: 18, fontWeight: '900', color: '#AEEF4D', marginLeft: 8 }}>+</AnimatedPlus>
              </View>
              <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff', lineHeight: 38, letterSpacing: -0.6 }}>{heroTitle}</Text>
              <Text style={{ fontSize: 15, fontWeight: '400', color: 'rgba(255,255,255,0.78)', lineHeight: 22, letterSpacing: -0.1, marginTop: 12 }}>{heroSub}</Text>
            </View>
          </View>

          {/* Carte centrale — Apple Music style : surface frostée sobre,
              généreusement aérée. Le contenu respire entre les blocs. */}
          <View style={{ paddingHorizontal: 16, paddingTop: 28 }}>
            <GlassCard
              intensity={75}
              borderRadius={GLASS_RADII.cardLg}
              padding={24}
              elevated
              enhanced
            >
              {/* Bandeau "OFFRE FONDATEUR" — frosted (BlurView via GlassView),
                  sobre, sans emoji. Le texte explique la structure
                  (3 mois / 1re année) sans promesse "à vie". Bordure
                  lime fine pour signaler l'accent sans crier. */}
              <GlassView
                intensity={30}
                tint="dark"
                forceDark
                borderRadius={16}
                substrateColor="rgba(255,255,255,0.05)"
                contentStyle={{ paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1.5, borderColor: 'rgba(174,239,77,0.55)', borderRadius: 16 }}
                style={{ marginBottom: 18 }}
              >
                <Text style={{ fontSize: 11, fontWeight: '900', color: '#AEEF4D', letterSpacing: 1.8, marginBottom: 8 }}>
                  {tr.paywall_founder_tag || (isFr ? 'OFFRE FONDATEUR' : 'FOUNDER OFFER')}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '500', color: '#ffffff', lineHeight: 20, letterSpacing: -0.1 }}>
                  {isFr
                    ? (('Mensuel : ' + monthlyPriceRaw + '/mois' + (monthlyHasIntro ? (' les 3 premiers mois, puis ' + (monthlyStdStr || '24.90 CHF')) : '') + '.')
                       + '\n' + ('Annuel : ' + yearlyPriceRaw + (yearlyHasIntro ? (' la première année, puis ' + (yearlyStdStr || '199 CHF')) : ' par an') + '.'))
                    : (('Monthly: ' + monthlyPriceRaw + '/mo' + (monthlyHasIntro ? (' for the first 3 months, then ' + (monthlyStdStr || '24.90 CHF')) : '') + '.')
                       + '\n' + ('Yearly: ' + yearlyPriceRaw + (yearlyHasIntro ? (' the first year, then ' + (yearlyStdStr || '199 CHF')) : ' per year') + '.'))}
                </Text>
              </GlassView>
              {/* Bandeau bonus parrainage — uniquement si l'utilisateur a
                  des mois gratuits en attente (filleule qui a un parrain,
                  ou parrain dont une amie vient de s'abonner). Visuel
                  délibérément voyant (accent vert) pour pousser le CTA.
                  TODO post-MVP : déduire X mois sur la facture via une
                  promotional offer RC, plutôt que de juste l'afficher. */}
              {Number.isFinite(freeDaysAvailable) && freeDaysAvailable > 0 ? (
                <View style={{
                  marginBottom: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  backgroundColor: 'rgba(174,239,77,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(174,239,77,0.45)',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.accentText, letterSpacing: -0.1, marginBottom: 2 }}>
                      {tr.paywall_referral_bonus_title || 'Tu as un bonus en attente'}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: theme.colors.text, lineHeight: 17 }}>
                      {typeof tr.paywall_referral_bonus_sub === 'function'
                        ? tr.paywall_referral_bonus_sub(freeDaysAvailable)
                        : `${freeDaysAvailable} ${isFr ? 'jour(s) gratuit(s) t\'attendent.' : 'free day(s) waiting for you.'}`}
                    </Text>
                  </View>
                </View>
              ) : null}
              {/* Bénéfices founder — pas d'emoji, pas de check coloré.
                  Bullet `•` sobre + texte aéré. Le ton reste calme. */}
              <View style={{ marginBottom: 24, marginTop: 4 }}>
                {founderBullets.map(function (b, i) {
                  const text = typeof b === 'string' ? b : (b && b.text) || '';
                  return (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: i === founderBullets.length - 1 ? 0 : 12 }}>
                      <View style={{ width: 14, alignItems: 'center', marginRight: 10, marginTop: 2 }}>
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.textTertiary }} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, color: theme.colors.text, fontWeight: '400', letterSpacing: -0.1, lineHeight: 20 }}>{text}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Toggle Mensuel / Annuel — structure d'intro :
                  - Mensuel : 12.90 CHF/mois pendant 3 mois, puis 24.90.
                  - Annuel : 99 CHF la 1re année, puis 199. Pill éco "Économise
                    100 CHF la 1re année" sur l'annuel uniquement. */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                {planPill(
                  'yearly',
                  annualLabel,
                  yearlyHasIntro
                    ? (tr.paywall_founder_intro_yearly_sub || (isFr ? 'Tarif fondateur · 1re année' : 'Founder pricing · first year'))
                    : (isFr ? 'Tarif fondateur' : 'Founder pricing'),
                  yearlyDisplay,
                  thenYearlyText,
                  yearlyHasIntro
                    ? (tr.paywall_founder_save_intro_yearly || (isFr
                        ? ('Économise ' + FOUNDER_INTRO_SAVINGS_CHF + ' CHF la 1re année')
                        : ('Save ' + FOUNDER_INTRO_SAVINGS_CHF + ' CHF on year one')))
                    : null
                )}
                {planPill(
                  'monthly',
                  monthlyLabel,
                  monthlyHasIntro
                    ? (tr.paywall_founder_intro_monthly_sub || (isFr ? 'Tarif fondateur · 3 premiers mois' : 'Founder pricing · first 3 months'))
                    : (isFr ? 'Tarif fondateur' : 'Founder pricing'),
                  monthlyDisplay,
                  thenMonthlyText,
                  null
                )}
              </View>

              {/* CTA principal — capsule frostée Apple Music style. Lime
                  semi-transparent dessous + voile blanc, texte blanc.
                  GlassButton 'accent' gère déjà le press scale + haptique. */}
              <GlassButton
                variant="accent"
                size="lg"
                enhanced
                onPress={onCta}
                disabled={disabled || loadingPrices}
                loading={loadingPrices}
                textStyle={{ fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }}
                accessibilityLabel={`${ctaLabel} ${selectedPrice}`}
              >
                {ctaLabel}
              </GlassButton>
              <Text style={{ fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary, textAlign: 'center', marginTop: 14, letterSpacing: 0.1 }}>{selectedPrice}</Text>
              {/* Urgency soft + guarantee — outline lime sobre. Tout est
                  centré et aéré, on évite l'effet "wall of pills". */}
              <View style={{
                marginTop: 18,
                alignSelf: 'center',
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
                borderWidth: 1,
                borderColor: 'rgba(174,239,77,0.5)',
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.accentText, letterSpacing: 0.3 }}>
                  {paywallCancelPill}
                </Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '500', color: theme.colors.textTertiary, textAlign: 'center', marginTop: 14, letterSpacing: 0.2 }}>
                {tr.paywall_founder_urgency || (isFr
                  ? 'Offre fondateur : pour les premiers membres'
                  : 'Founder offer: for early members')}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '400', color: theme.colors.textTertiary, textAlign: 'center', marginTop: 6, lineHeight: 16, letterSpacing: 0.1 }}>
                {paywallFounderLegal}
              </Text>
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

            <TestimonialsCard
              testimonials={testimonials}
              theme={theme}
              sectionTitle={tr.paywall_what_clients_say || 'Ce que disent nos pratiquantes'}
            />

            <CompareTable
              features={compareFeatures}
              theme={theme}
              title={tr.paywall_compare_title || 'En complément de ton studio'}
              appLabel={tr.paywall_compare_app || 'App'}
              studioLabel={tr.paywall_compare_studio || 'Studio'}
            />
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
                {paywallFullLegal}
              </Text>
              <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <GlassPressable
                  onPress={function() { Linking.openURL(getTermsUrl(lang) || LEGAL.termsUrl); }}
                  accessibilityRole="link"
                  accessibilityLabel={tr.paywall_terms_link || (isFr ? "Conditions d'utilisation" : 'Terms of Service')}
                >
                  <Text style={{ fontSize: 12, color: theme.colors.accentText, textAlign: 'center', textDecorationLine: 'underline', fontWeight: '600' }}>
                    {tr.paywall_terms_link || (isFr ? "Conditions d'utilisation" : 'Terms of Service')}
                  </Text>
                </GlassPressable>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>·</Text>
                <GlassPressable
                  onPress={function() { Linking.openURL(LEGAL.privacyUrl); }}
                  accessibilityRole="link"
                  accessibilityLabel={tr.paywall_privacy_link || (isFr ? 'Politique de confidentialité' : 'Privacy Policy')}
                >
                  <Text style={{ fontSize: 12, color: theme.colors.accentText, textAlign: 'center', textDecorationLine: 'underline', fontWeight: '600' }}>
                    {tr.paywall_privacy_link || (isFr ? 'Politique de confidentialité' : 'Privacy Policy')}
                  </Text>
                </GlassPressable>
              </View>
            </GlassCard>
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

export { PRODUCT_IDS, getRcPriceString };
