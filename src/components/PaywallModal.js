import { View, Text, TouchableOpacity, ScrollView, Modal, Alert, Dimensions, ImageBackground } from 'react-native';
import { T, PILIER_IMAGES } from '../constants/data';

const { width: SW } = Dimensions.get('window');

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

export default function PaywallModal({ visible, onClose, lang, packagesByProductId, loadingPrices, disabled, onBuyMonthly, onBuyYearly, onRestore, onTryFree, coachImage }) {
  var tr = T[lang] || T["fr"];
  var monthlyPkg = packagesByProductId && packagesByProductId[PRODUCT_IDS.monthly];
  var yearlyPkg = packagesByProductId && packagesByProductId[PRODUCT_IDS.yearly];
  var monthlyPrice = getRcPriceString(monthlyPkg);
  var yearlyPrice = getRcPriceString(yearlyPkg);
  var showYearly = !!(yearlyPkg || loadingPrices);
  var paywallGridImages = [
    PILIER_IMAGES.p7, PILIER_IMAGES.p5, PILIER_IMAGES.p3,
    PILIER_IMAGES.p2, PILIER_IMAGES.p6, PILIER_IMAGES.p4,
  ];
  var gridItemW = Math.floor((SW - 56 - 16) / 3);

  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000000" }}>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ position: "absolute", top: 56, right: 20, zIndex: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>{"\u2715"}</Text>
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingVertical: 50, alignItems: "center" }}>

          <View style={{ backgroundColor: '#AEEF4D', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#000000', letterSpacing: 1 }}>{tr.paywall_badge || '7 JOURS GRATUITS'}</Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", paddingHorizontal: 28, marginBottom: 28 }}>
            {paywallGridImages.map(function(src, i) {
              return (
                <View key={"pw-img-" + i} style={{ width: gridItemW, height: gridItemW, borderRadius: 14, overflow: "hidden" }}>
                  <ImageBackground source={src} resizeMode="cover" style={{ flex: 1 }}>
                    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }} />
                  </ImageBackground>
                </View>
              );
            })}
          </View>

          <Text style={{ fontSize: 28, fontWeight: "800", color: "#ffffff", textAlign: "center", marginBottom: 10, paddingHorizontal: 28 }}>{tr.paywall_title}</Text>
          <Text style={{ fontSize: 14, fontWeight: "400", color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 21, marginBottom: 24, paddingHorizontal: 32 }}>{tr.paywall_sub}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 28, marginBottom: 28, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14 }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, overflow: 'hidden', borderWidth: 2.5, borderColor: '#AEEF4D' }}>
              <ImageBackground source={coachImage} resizeMode="cover" style={{ flex: 1 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '300', color: 'rgba(255,255,255,0.85)', lineHeight: 18, fontStyle: 'italic' }}>{tr.coach_quote || '"Je vous accompagne pas à pas vers un corps plus libre et plus fort."'}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#AEEF4D', marginTop: 6 }}>{tr.coach_avec || 'Avec Sabrina'} · {tr.coach_exp || '30 ans d\'expérience'}</Text>
            </View>
          </View>

          <View style={{ marginTop: 16, marginBottom: 8, marginHorizontal: 28 }}>
            {[tr.paywall_b1, tr.paywall_b2, tr.paywall_b3, tr.paywall_b4, tr.paywall_b5].map(function(b, i) {
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 14, color: '#AEEF4D', marginRight: 10 }}>✓</Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '400' }}>{b}</Text>
                </View>
              );
            })}
          </View>

          {disabled && (
            <View style={{ alignSelf: "stretch", marginHorizontal: 28, marginBottom: 16, backgroundColor: "rgba(255,200,80,0.10)", borderWidth: 1, borderColor: "rgba(255,200,80,0.25)", borderRadius: 16, padding: 14 }}>
              <Text style={{ color: "rgba(255,220,140,0.9)", fontSize: 12, lineHeight: 18, textAlign: "center" }}>{tr.paywall_not_available}</Text>
            </View>
          )}

          <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.50)", textAlign: "center", marginBottom: 14, paddingHorizontal: 40 }}>
            {tr.paywall_free_seance || '1 s\u00E9ance gratuite par pilier \u00B7 sans carte bleue'}
          </Text>

          <TouchableOpacity
            onPress={function() { if (monthlyPkg) { onBuyMonthly && onBuyMonthly(monthlyPkg); } else { Alert.alert('FluidBody+', 'Abonnement disponible dans la version App Store.'); } }}
            disabled={false}
            activeOpacity={0.85}
            style={{
              alignSelf: "stretch",
              marginHorizontal: 28,
              height: 56,
              borderRadius: 28,
              backgroundColor: "#AEEF4D",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
              opacity: (disabled || loadingPrices) ? 0.4 : 1,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#000000", letterSpacing: 0.3 }}>
              {tr.paywall_start}
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.40)", textAlign: "center", marginBottom: 16 }}>
            {tr.paywall_price_detail || 'Puis 12.90 CHF/mois · Annulez quand vous voulez'}
          </Text>

          <TouchableOpacity
            onPress={function() { if (yearlyPkg) { onBuyYearly && onBuyYearly(yearlyPkg); } else { Alert.alert('FluidBody+', 'Abonnement disponible dans la version App Store.'); } }}
            disabled={false}
            activeOpacity={0.85}
            style={{
              alignSelf: "stretch",
              marginHorizontal: 28,
              height: 50,
              borderRadius: 25,
              backgroundColor: "rgba(0,189,208,0.15)",
              borderWidth: 1,
              borderColor: "#00BDD0",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#00BDD0" }}>
              {tr.paywall_yearly_link}
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 11, fontWeight: "400", color: "rgba(255,255,255,0.30)", textAlign: "center", marginBottom: 20, paddingHorizontal: 40 }}>
            {tr.paywall_access || 'Accès immédiat à tous les piliers · Sans engagement'}
          </Text>

          <TouchableOpacity
            onPress={onRestore}
            disabled={disabled}
            activeOpacity={0.7}
            style={{ marginTop: 8 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.25)", textAlign: "center" }}>{tr.paywall_restore}</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.20)", textAlign: "center", marginTop: 20, paddingHorizontal: 28, lineHeight: 15 }}>
            {tr.paywall_legal || "L'abonnement se renouvelle automatiquement sauf annulation au moins 24h avant la fin de la p\u00E9riode. Le paiement est d\u00E9bit\u00E9 via votre compte Apple. G\u00E9rez ou annulez dans R\u00E9glages > Apple ID > Abonnements."}
          </Text>
          <TouchableOpacity onPress={function() { var RNLinking = require('react-native').Linking; RNLinking.openURL('https://fluidbody.app/privacy'); }} activeOpacity={0.7} style={{ marginTop: 8, marginBottom: 20 }}>
            <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "center", textDecorationLine: "underline" }}>{tr.paywall_privacy_link || "Politique de confidentialit\u00E9"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

export { PRODUCT_IDS, getRcPriceString };
