// SeanceCarouselRow — rangée horizontale de petites cards séance pour
// iPhone (Pour vous "Mes favoris" et "Cette semaine"). Cards 16:9 ~180×101,
// image full-bleed + gradient bas + titre/sous-titre + badge top-left.
//
// `items` : array de { key, title, subtitle, image, badge: { label, tone } | null,
//                      onPress, pilier, idx }.
// Sur tap → `onPress` de l'item (le caller pré-bind le handler).
//
// iPhone-only — TV utilise HorizontalCarousel + TVCard16x9.

import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import SessionBadge from './tv/SessionBadge';

const CARD_W = 180;
const CARD_H = Math.round((CARD_W * 9) / 16); // 101 px

const TEXT_SHADOW = { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } };

// `renderItemAction(item)` (optionnel) : overlay rendu en top-right de
// chaque card. Utilisé p.ex. par la section "Hors-ligne" pour afficher
// un DownloadButton (état "done") permettant la suppression rapide.
export default function SeanceCarouselRow({ title, headerRight, items, onItemPress, renderItemAction }) {
  if (!items || items.length === 0) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2 }}>
          {title}
        </Text>
        {headerRight || null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4, paddingVertical: 4, gap: 12 }}
      >
        {items.map(function (it) {
          return (
            <View key={it.key} style={{ width: CARD_W, height: CARD_H }}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={function () { if (onItemPress) onItemPress(it); }}
                style={{ width: CARD_W, height: CARD_H, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }}
              >
                {it.image ? (
                  <Image source={it.image} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
                ) : null}
                <LinearGradient
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)']}
                  locations={[0.45, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                {it.badge && it.badge.label ? (
                  <View style={{ position: 'absolute', top: 7, left: 7 }}>
                    <SessionBadge label={it.badge.label} tone={it.badge.tone} />
                  </View>
                ) : null}
                <View style={{ position: 'absolute', left: 10, right: 10, bottom: 8 }}>
                  <Text numberOfLines={1} style={[{ fontSize: 13, fontWeight: '700', color: '#ffffff', letterSpacing: -0.1 }, TEXT_SHADOW]}>{it.title}</Text>
                  {it.subtitle ? (
                    <Text numberOfLines={1} style={[{ fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.78)', marginTop: 2 }, TEXT_SHADOW]}>{it.subtitle}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              {/* Overlay action top-right (hors TouchableOpacity carte pour
                  ne pas déclencher onPress sur tap de l'action). */}
              {renderItemAction ? (
                <View style={{ position: 'absolute', top: 6, right: 6, zIndex: 4 }}>
                  {renderItemAction(it)}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
