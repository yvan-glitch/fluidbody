import { View, Text, TouchableOpacity, ImageBackground, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T, PILIER_IMAGES } from '../constants/data';

let HapticsMod = null;
try { HapticsMod = require('expo-haptics'); } catch(e) {}

function hapticLight() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  try { void HapticsMod.impactAsync(HapticsMod.ImpactFeedbackStyle.Light); } catch (e) {}
}

const { width: SW } = Dimensions.get('window');
const CARD_W = Math.floor((SW - 48) / 2);
const CARD_H = Math.floor(CARD_W * 0.75);

export default function PilierCard({ pilier, doneCount, onPress, recommended, lang, imageKey }) {
  var tr = T[lang] || T["fr"];
  var imgSrc = PILIER_IMAGES[imageKey || pilier.key];
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      accessibilityLabel={pilier.label}
      accessibilityRole="button"
      onPress={function() { hapticLight(); onPress(pilier); }}
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: 20,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 10,
      }}
    >
      <LinearGradient
        colors={["#000e18", pilier.bg, pilier.color]}
        locations={[0.0, 0.55, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ flex: 1 }}
      >
        <ImageBackground
          source={imgSrc}
          resizeMode="cover"
          style={{ flex: 1, overflow: 'hidden' }}
          imageStyle={pilier.key === 'p8' ? { opacity: 0.70, top: -100, height: CARD_H + 100 } : { opacity: 0.70 }}
        >
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.65)"]}
            locations={[0.3, 1]}
            style={{ flex: 1, padding: 14, justifyContent: "flex-end" }}
          >
            {recommended && (
              <View style={{ position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(0,215,255,0.22)", borderWidth: 1, borderColor: "rgba(0,215,255,0.6)" }}>
                <Text style={{ fontSize: 8, color: "rgba(0,225,255,0.95)", fontWeight: "700", letterSpacing: 0.5 }}>{"\u2605"} {tr.recommande_pour_toi}</Text>
              </View>
            )}
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>{pilier.label}</Text>
          </LinearGradient>
        </ImageBackground>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export { CARD_W, CARD_H };
