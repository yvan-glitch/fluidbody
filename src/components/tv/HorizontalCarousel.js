// HorizontalCarousel — rangée scrollable horizontale style Apple TV
// Fitness+ : un titre de section (gauche) + des dots de pagination (droite)
// reflétant la position du focus, puis une ScrollView horizontale de
// TVCard16x9. Quand une carte prend le focus, on auto-scrolle la rangée
// pour la ramener près du bord gauche (la Siri Remote ne scrolle pas la
// ScrollView de façon fiable sur tvOS).
//
// `items` : tableau d'objets { key, title, subtitle, image, pilierKey, idx }.
// `onItemPress(item)` : callback au press d'une carte.
// `firstFocus` : si true, la 1re carte reçoit hasTVPreferredFocus.
//
// TV-only — zéro impact iPhone.

import { useRef, useState } from 'react';
import { View, Text, ScrollView, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

import TVCard16x9 from './TVCard16x9';

const SIDE = 80;
const GAP = 22;
const MAX_DOTS = 7;

export default function HorizontalCarousel({
  title,
  items,
  onItemPress,
  firstFocus = false,
  cardWidth = 360,
}) {
  const scrollRef = useRef(null);
  const offsets = useRef([]).current;
  const [focusedIndex, setFocusedIndex] = useState(0);

  function handleCardFocus(index) {
    setFocusedIndex(index);
    const x = offsets[index];
    if (scrollRef.current && typeof x === 'number') {
      scrollRef.current.scrollTo({ x: Math.max(0, x - SIDE), animated: true });
    }
  }

  if (!items || items.length === 0) return null;

  const dotCount = Math.min(items.length, MAX_DOTS);
  const activeDot = items.length <= MAX_DOTS
    ? focusedIndex
    : Math.round((focusedIndex / (items.length - 1)) * (dotCount - 1));

  return (
    <View style={{ marginBottom: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: SIDE, paddingRight: SIDE, marginBottom: 16 }}>
        <View style={{ borderRadius: 14, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 6, position: 'relative' }}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          ) : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]} pointerEvents="none" />
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } }}>{title}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          {Array.from({ length: dotCount }).map(function (_, i) {
            var on = i === activeDot;
            return (
              <View
                key={i}
                style={{ width: on ? 9 : 7, height: on ? 9 : 7, borderRadius: 5, backgroundColor: on ? '#FFFFFF' : 'rgba(255,255,255,0.30)' }}
              />
            );
          })}
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SIDE, gap: GAP, paddingVertical: 8 }}
      >
        {items.map(function (it, i) {
          return (
            <View
              key={it.key || i}
              onLayout={function (e) { offsets[i] = e.nativeEvent.layout.x; }}
            >
              <TVCard16x9
                title={it.title}
                subtitle={it.subtitle}
                image={it.image}
                width={cardWidth}
                focusPreferred={firstFocus && i === 0}
                onPress={function () { if (onItemPress) onItemPress(it); }}
                onFocus={function () { handleCardFocus(i); }}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
