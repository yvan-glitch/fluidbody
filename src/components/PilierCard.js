import { View, Text, Dimensions, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { T, PILIER_IMAGES } from '../constants/data';
import { GlassView, GlassPressable, GLASS_RADII } from './ui';

const { width: SW } = Dimensions.get('window');
const CARD_W = Math.floor((SW - 48) / 2);
const CARD_H = Math.floor(CARD_W * 0.75);

// PilierCard — a 2-column home tile. The image sits behind a translucent
// gradient that absorbs into a glass strip at the bottom carrying the title.
// Press feedback comes from GlassPressable (spring scale 0.97), and the
// optional "Recommandé pour toi" badge is itself a glass pill.

export default function PilierCard({ pilier, doneCount, onPress, recommended, lang, imageKey }) {
  var tr = T[lang] || T["fr"];
  var imgSrc = PILIER_IMAGES[imageKey || pilier.key];
  return (
    <GlassPressable
      onPress={function() { onPress(pilier); }}
      accessibilityRole="button"
      accessibilityLabel={pilier.label}
      accessibilityHint={recommended ? tr.recommande_pour_toi : undefined}
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: GLASS_RADII.card,
        overflow: 'hidden',
        // Substantial drop shadow — these cards sit on the dark background
        // and need to feel lifted.
        shadowColor: '#000',
        shadowOpacity: 0.30,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 10,
      }}
    >
      <View style={{ flex: 1, borderRadius: GLASS_RADII.card, overflow: 'hidden' }}>
        <LinearGradient
          colors={["#000e18", pilier.bg, pilier.color]}
          locations={[0.0, 0.55, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{ flex: 1 }}
        >
          <Image
            source={imgSrc}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={'pilier-' + (imageKey || pilier.key)}
            style={[
              StyleSheet.absoluteFill,
              pilier.key === 'p8' ? { opacity: 0.70, top: -100, height: CARD_H + 100 } : { opacity: 0.70 },
            ]}
          />
          {/* Bottom absorber so the glass strip reads against any image. */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.55)"]}
            locations={[0.35, 1]}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            {recommended && (
              <View style={{ position: 'absolute', top: 10, left: 10 }}>
                <GlassView
                  intensity={60}
                  tint="dark"
                  borderRadius={GLASS_RADII.pill}
                  substrateColor="rgba(0,215,255,0.22)"
                  contentStyle={{
                    paddingHorizontal: 9,
                    paddingVertical: 3,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 9, color: 'rgba(0,225,255,0.95)', fontWeight: '700', letterSpacing: 0.5 }}>
                    {"★"} {tr.recommande_pour_toi}
                  </Text>
                </GlassView>
              </View>
            )}
            {/* Title strip — light glass band sitting at the bottom of the card.
                We keep the radius square here so it tucks into the card's own
                rounded corners cleanly. */}
            <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
              <GlassView
                intensity={40}
                tint="dark"
                borderRadius={12}
                elevated={false}
                contentStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.2 }}>{pilier.label}</Text>
              </GlassView>
            </View>
          </LinearGradient>
        </LinearGradient>
      </View>
    </GlassPressable>
  );
}

export { CARD_W, CARD_H };
