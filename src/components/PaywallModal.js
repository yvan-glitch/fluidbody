import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Modal, Alert, Dimensions, Linking, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
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
import { IS_TV, tvFocusProps, TV_FOCUS_RING } from '../utils/platformTV';
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

// Animated count-up — feels alive, low cost. Lerps over 1.6s with an
// out-easing so the last digits slow gracefully.
function AnimatedCount({ to, style }) {
  const animRef = useRef(new Animated.Value(0)).current;
  const [val, setVal] = useState(0);
  useEffect(() => {
    animRef.setValue(0);
    const listenerId = animRef.addListener(({ value }) => {
      setVal(Math.round(value * to));
    });
    Animated.timing(animRef, {
      toValue: 1,
      duration: 1600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => animRef.removeListener(listenerId);
  }, [to]);
  return <Text style={style}>{val.toLocaleString('fr-FR')}</Text>;
}

// Live-ish active members counter. We don't have a backend signal yet so we
// pick a stable, plausible number derived from the current half-hour so two
// users at the same time see the same display.
function liveMembersGuess() {
  const now = new Date();
  const halfHour = Math.floor(now.getHours() * 2 + now.getMinutes() / 30);
  // Range 120 → 360 across the day, peaks around lunch + evening.
  const base = 120;
  const peakLunch = Math.max(0, 90 - Math.abs(halfHour - 26) * 6); // ~13h
  const peakEvening = Math.max(0, 130 - Math.abs(halfHour - 39) * 7); // ~19h30
  return Math.round(base + peakLunch + peakEvening + (halfHour % 7) * 4);
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
    }, 4200);
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
              — {t.name}{t.age ? `, ${t.age}` : ''}
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
                ? <Text style={{ color: '#AEEF4D', fontWeight: '800' }}>✓</Text>
                : <Text style={{ color: theme.colors.textTertiary, fontWeight: '700' }}>—</Text>}
            </View>
            <View style={{ width: 80, alignItems: 'center' }}>
              {f.studio
                ? <Text style={{ color: theme.colors.accent, fontWeight: '800' }}>✓</Text>
                : <Text style={{ color: theme.colors.textTertiary, fontWeight: '700' }}>—</Text>}
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
function TVPaywallView({
  onClose,
  lang,
  packagesByProductId,
  loadingPrices,
  disabled,
  onBuyMonthly,
  onBuyYearly,
  onRestore,
  freeMonthsAvailable,
}) {
  var tr = T[lang] || T['fr'];
  var isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  var monthlyPkg = packagesByProductId && packagesByProductId[PRODUCT_IDS.monthly];
  var yearlyPkg = packagesByProductId && packagesByProductId[PRODUCT_IDS.yearly];
  var monthlyPriceRaw = getRcPriceString(monthlyPkg) || 'CHF 12.90';
  var yearlyPriceRaw = getRcPriceString(yearlyPkg) || 'CHF 99.00';

  const [selected, setSelected] = useState('yearly');
  const [focusedKey, setFocusedKey] = useState(null);

  const testimonials = Array.isArray(tr.paywall_testimonials) ? tr.paywall_testimonials : [];
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  useEffect(() => {
    if (testimonials.length < 2) return;
    const itv = setInterval(() => {
      setTestimonialIdx(function(i) { return (i + 1) % testimonials.length; });
    }, 8000);
    return () => clearInterval(itv);
  }, [testimonials.length]);

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

  const annualLabel = isFr ? 'Annuel' : 'Annual';
  const annualSub = isFr ? '12 mois pour le prix de 8' : '12 months for the price of 8';
  const monthlyLabel = isFr ? 'Mensuel' : 'Monthly';
  const ctaLabel = isFr ? "S'abonner" : 'Subscribe';
  const pairLabel = isFr ? "J'ai déjà un abonnement" : 'I already have a subscription';
  const heroTitle = isFr ? 'Le Pilates conscient,\nau quotidien' : 'Conscious Pilates,\nevery day';

  function onCta() {
    if (loadingPrices) return;
    if (selected === 'yearly' && yearlyPkg) { onBuyYearly && onBuyYearly(yearlyPkg); return; }
    if (selected === 'monthly' && monthlyPkg) { onBuyMonthly && onBuyMonthly(monthlyPkg); return; }
    Alert.alert('FluidBody+', isFr ? 'Abonnement disponible bientôt sur Apple TV.' : 'Subscription coming soon on Apple TV.');
  }

  function planCard(key, label, sub, priceText, fullPeriod) {
    const active = selected === key;
    return (
      <GlassCardTV
        key={key}
        onPress={function() { setSelected(key); }}
        focusPreferred={key === 'yearly'}
        accent={active ? 'green' : 'cyan'}
        variant={active ? 'elevated' : 'standard'}
        shape="card"
        padding={0}
        tiltOnFocus={false}
        style={{ marginBottom: 20 }}
        contentStyle={{ paddingVertical: 24, paddingHorizontal: 26 }}
        accessibilityLabel={label + ' ' + priceText}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 26, height: 26, borderRadius: 13,
            borderWidth: 2.5, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.45)',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 18,
          }}>
            {active ? <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: '#AEEF4D' }} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '600', color: '#ffffff', letterSpacing: -0.3 }}>{label}</Text>
            {sub ? <Text style={{ fontSize: 15, color: '#AEEF4D', marginTop: 5, fontWeight: '500' }}>{sub}</Text> : null}
          </View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 }}>{priceText}</Text>
        </View>
      </GlassCardTV>
    );
  }

  const ctaFocused = focusedKey === 'cta';
  const pairFocused = focusedKey === 'pair';
  const restoreFocused = focusedKey === 'restore';
  const closeFocused = focusedKey === 'close';

  return (
    <View style={{ flex: 1, backgroundColor: '#000a1a' }}>
      <AquaticBackground density="low" contentOpacity={0.5} />

      {/* Close button : top-right, focusable mais discret. Sur Apple
          TV le bouton Menu de la Siri Remote ferme aussi, mais on
          garde un fallback visuel. */}
      <TouchableOpacity
        {...tvFocusProps(false)}
        onPress={onClose}
        onFocus={function() { setFocusedKey('close'); }}
        onBlur={function() { setFocusedKey(null); }}
        style={{
          position: 'absolute', top: 40, right: 40, zIndex: 10,
          paddingHorizontal: 22, paddingVertical: 12,
          backgroundColor: 'rgba(8,24,40,0.6)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.25)',
          borderRadius: 14,
          ...(closeFocused ? TV_FOCUS_RING : {}),
        }}
      >
        <Text style={{ fontSize: 18, color: '#ffffff', fontWeight: '600' }}>{isFr ? 'Fermer' : 'Close'}</Text>
      </TouchableOpacity>

      <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 100, paddingTop: 100, paddingBottom: 60 }}>

        {/* Colonne gauche : hero + bénéfices + témoignage */}
        <View style={{ flex: 1, paddingRight: 70, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 28 }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#AEEF4D', letterSpacing: 5 }}>FLUIDBODY</Text>
            <AnimatedPlus style={{ fontSize: 24, fontWeight: '900', color: '#AEEF4D', marginLeft: 8 }}>+</AnimatedPlus>
          </View>
          <Text style={{ fontSize: 64, fontWeight: '200', color: '#ffffff', lineHeight: 74, letterSpacing: -1.2, marginBottom: 40 }}>{heroTitle}</Text>

          {Number.isFinite(freeMonthsAvailable) && freeMonthsAvailable > 0 ? (
            <View style={{
              marginBottom: 30, paddingVertical: 16, paddingHorizontal: 20,
              borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.14)',
              borderWidth: 1, borderColor: 'rgba(174,239,77,0.45)',
              flexDirection: 'row', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 28, marginRight: 14 }}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#AEEF4D', marginBottom: 4 }}>
                  {tr.paywall_referral_bonus_title || (isFr ? 'Tu as un bonus en attente' : 'You have a bonus waiting')}
                </Text>
                <Text style={{ fontSize: 15, fontWeight: '500', color: '#ffffff' }}>
                  {typeof tr.paywall_referral_bonus_sub === 'function'
                    ? tr.paywall_referral_bonus_sub(freeMonthsAvailable)
                    : (freeMonthsAvailable + ' ' + (isFr ? 'mois gratuit(s) t\'attendent.' : 'free month(s) waiting for you.'))}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Bénéfices */}
          <View style={{ marginBottom: 36 }}>
            {benefits.map(function(b, i) {
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 16,
                    backgroundColor: 'rgba(174,239,77,0.18)',
                    borderWidth: 1, borderColor: 'rgba(174,239,77,0.45)',
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: 16,
                  }}>
                    <Text style={{ color: '#AEEF4D', fontWeight: '800', fontSize: 16 }}>✓</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 18, color: '#ffffff', fontWeight: '500', letterSpacing: -0.1 }}>{b}</Text>
                </View>
              );
            })}
          </View>

          {/* Témoignage statique (swap toutes les 8 s, pas de carousel
              auto qu'on doit pouvoir pauser) */}
          {testimonials[testimonialIdx] ? (
            <View style={{
              paddingVertical: 18, paddingHorizontal: 22,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
            }}>
              <Text style={{ fontSize: 16, fontStyle: 'italic', color: '#ffffff', lineHeight: 24, marginBottom: 8 }}>
                « {testimonials[testimonialIdx].text} »
              </Text>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.3 }}>
                — {testimonials[testimonialIdx].name}{testimonials[testimonialIdx].age ? ', ' + testimonials[testimonialIdx].age : ''}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Colonne droite : plans + CTA + pair + restore */}
        <View style={{ flex: 1, paddingLeft: 60, justifyContent: 'center' }}>
          {planCard('yearly', annualLabel, annualSub, yearlyPriceRaw, isFr ? '/an' : '/yr')}
          {planCard('monthly', monthlyLabel, null, monthlyPriceRaw, isFr ? '/mois' : '/mo')}

          {/* CTA principal — bouton vert plein avec ring focus accent. */}
          <TouchableOpacity
            {...tvFocusProps(false)}
            onPress={onCta}
            disabled={disabled || loadingPrices}
            onFocus={function() { setFocusedKey('cta'); }}
            onBlur={function() { setFocusedKey(null); }}
            activeOpacity={0.88}
            style={[
              {
                marginTop: 22,
                paddingVertical: 26,
                borderRadius: 22,
                backgroundColor: '#AEEF4D',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (disabled || loadingPrices) ? 0.5 : 1,
                shadowColor: '#AEEF4D',
                shadowOpacity: ctaFocused ? 0.6 : 0.3,
                shadowRadius: ctaFocused ? 24 : 16,
                shadowOffset: { width: 0, height: 10 },
              },
              ctaFocused ? { transform: [{ scale: 1.05 }] } : null,
            ]}
          >
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#001a2e', letterSpacing: 0.6 }}>{ctaLabel}</Text>
          </TouchableOpacity>

          {/* Pair existing iPhone subscription — glass card subtle */}
          <GlassCardTV
            onPress={onClose}
            accent="cyan"
            variant="subtle"
            shape="card"
            padding={0}
            tiltOnFocus={false}
            style={{ marginTop: 18 }}
            contentStyle={{ paddingVertical: 18, alignItems: 'center' }}
            accessibilityLabel={pairLabel}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#ffffff', letterSpacing: 0.2 }}>{pairLabel}</Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.62)', marginTop: 5 }}>
              {isFr ? 'Pair ta TV depuis l\'app iPhone' : 'Pair your TV from the iPhone app'}
            </Text>
          </GlassCardTV>

          {/* Restore */}
          <TouchableOpacity
            {...tvFocusProps(false)}
            onPress={onRestore}
            disabled={disabled}
            onFocus={function() { setFocusedKey('restore'); }}
            onBlur={function() { setFocusedKey(null); }}
            activeOpacity={0.7}
            style={[
              { marginTop: 22, paddingVertical: 14, alignItems: 'center', borderRadius: 14 },
              restoreFocused ? TV_FOCUS_RING : null,
            ]}
          >
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', fontWeight: '500', letterSpacing: 0.4 }}>{tr.paywall_restore || (isFr ? 'Restaurer mes achats' : 'Restore purchases')}</Text>
          </TouchableOpacity>

          {/* Légales — petite footer */}
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 26, lineHeight: 17 }}>
            {tr.paywall_legal || (isFr
              ? "L'abonnement se renouvelle automatiquement sauf annulation au moins 24h avant la fin de la période."
              : 'Subscription auto-renews unless cancelled at least 24h before the end of the period.')}
          </Text>
        </View>

      </View>
    </View>
  );
}

export default function PaywallModal({ visible, onClose, lang, packagesByProductId, loadingPrices, disabled, onBuyMonthly, onBuyYearly, onRestore, freeMonthsAvailable }) {
  // Apple TV : on bascule sur un render dédié, layout horizontal,
  // focus engine et CTA accent. Le reste du fichier (iPhone/iPad) reste
  // strictement identique.
  if (IS_TV) {
    return (
      <Modal visible={!!visible} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
        <TVPaywallView
          onClose={onClose}
          lang={lang}
          packagesByProductId={packagesByProductId}
          loadingPrices={loadingPrices}
          disabled={disabled}
          onBuyMonthly={onBuyMonthly}
          onBuyYearly={onBuyYearly}
          onRestore={onRestore}
          freeMonthsAvailable={freeMonthsAvailable}
        />
      </Modal>
    );
  }

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
  const liveMembers = useMemo(liveMembersGuess, []);
  const testimonials = Array.isArray(tr.paywall_testimonials) ? tr.paywall_testimonials : null;
  const compareFeatures = Array.isArray(tr.paywall_compare_features) ? tr.paywall_compare_features : null;

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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#AEEF4D' }} />
                <AnimatedCount to={liveMembers} style={{ fontSize: 14, fontWeight: '800', color: '#ffffff' }} />
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', fontWeight: '500' }}>
                  {tr.paywall_members_label || 'membres pratiquent en ce moment'}
                </Text>
              </View>
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
              {/* Bandeau bonus parrainage — uniquement si l'utilisateur a
                  des mois gratuits en attente (filleule qui a un parrain,
                  ou parrain dont une amie vient de s'abonner). Visuel
                  délibérément voyant (accent vert) pour pousser le CTA.
                  TODO post-MVP : déduire X mois sur la facture via une
                  promotional offer RC, plutôt que de juste l'afficher. */}
              {Number.isFinite(freeMonthsAvailable) && freeMonthsAvailable > 0 ? (
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
                  <Text style={{ fontSize: 22, marginRight: 10 }}>🎁</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.accentText, letterSpacing: -0.1, marginBottom: 2 }}>
                      {tr.paywall_referral_bonus_title || 'Tu as un bonus en attente'}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: theme.colors.text, lineHeight: 17 }}>
                      {typeof tr.paywall_referral_bonus_sub === 'function'
                        ? tr.paywall_referral_bonus_sub(freeMonthsAvailable)
                        : `${freeMonthsAvailable} ${isFr ? 'mois gratuit(s) t\'attendent.' : 'free month(s) waiting for you.'}`}
                    </Text>
                  </View>
                </View>
              ) : null}
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
              {/* Guarantee pill — discreet, sits under the CTA so the user
                  sees the safety net just before tapping. */}
              <View style={{
                marginTop: 14,
                alignSelf: 'center',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 14,
                backgroundColor: 'rgba(174,239,77,0.14)',
                borderWidth: 1,
                borderColor: 'rgba(174,239,77,0.4)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}>
                <Text style={{ fontSize: 12, color: '#AEEF4D' }}>🛡</Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.accentText, letterSpacing: 0.2 }}>
                  {tr.paywall_guarantee_pill || 'Annule sans frais dans les 7 premiers jours'}
                </Text>
              </View>
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
