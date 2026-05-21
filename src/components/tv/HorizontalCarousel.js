// HorizontalCarousel — rangée scrollable horizontale style Apple TV
// Fitness+ : un titre de section + une ScrollView horizontale de
// TVCard16x9. Quand une carte prend le focus, on auto-scrolle la rangée
// pour la ramener près du bord gauche (la Siri Remote ne scrolle pas la
// ScrollView toute seule de façon fiable sur tvOS).
//
// `items` : tableau d'objets { key, title, subtitle, image, accent,
//            pilierKey, idx }. Le carrousel rend lui-même les TVCard16x9
//            (plutôt qu'un renderItem externe) pour pouvoir gérer le
//            auto-scroll au focus de façon centralisée.
// `onItemPress(item)` : callback au press d'une carte.
// `firstFocus` : si true, la 1re carte reçoit hasTVPreferredFocus.
//
// TV-only — zéro impact iPhone.

import { useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';

import TVCard16x9 from './TVCard16x9';

const SIDE = 80;
const GAP = 16;

export default function HorizontalCarousel({
  title,
  items,
  onItemPress,
  firstFocus = false,
  cardWidth = 360,
}) {
  const scrollRef = useRef(null);
  const offsets = useRef([]).current;

  function handleCardFocus(index) {
    const x = offsets[index];
    if (scrollRef.current && typeof x === 'number') {
      scrollRef.current.scrollTo({ x: Math.max(0, x - SIDE), animated: true });
    }
  }

  if (!items || items.length === 0) return null;

  return (
    <View style={{ marginBottom: 36 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff', letterSpacing: -0.3, paddingLeft: SIDE, marginBottom: 16 }}>
        {title}
      </Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SIDE, gap: GAP }}
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
                accent={it.accent}
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
