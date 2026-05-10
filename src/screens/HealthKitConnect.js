import { useEffect, useRef, useState } from 'react';
import { Text, View, TouchableOpacity, Animated, Easing, Dimensions, StyleSheet, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgLG, Stop, G, Ellipse } from 'react-native-svg';
import { T } from '../constants/data';
import { Bulle, MeduseCornerIcon, BULLES_ONBOARDING } from '../components/Meduse';
import AnimatedPlus from '../components/AnimatedPlus';
import LivingBackground from '../components/LivingBackground';

const { width: SW, height: SH } = Dimensions.get('window');

function HealthHeartIcon({ size = 64 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <SvgLG id="hk-heart" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF5466" />
          <Stop offset="1" stopColor="#FF1B3F" />
        </SvgLG>
        <SvgLG id="hk-heart2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF7B8A" />
          <Stop offset="1" stopColor="#FF3050" />
        </SvgLG>
      </Defs>
      {/* Outer rounded square white background */}
      <Rect x="2" y="2" width="60" height="60" rx="14" fill="#FFFFFF" />
      {/* Heart layer 1 (back) */}
      <Path
        d="M32 51 C13 39 7 28 14 20 C20 14 27 17 32 23 C37 17 44 14 50 20 C57 28 51 39 32 51 Z"
        fill="url(#hk-heart)"
      />
      {/* Heart layer 2 (front, slightly smaller) */}
      <Path
        d="M32 46 C18 37 14 29 19 22 C24 17 29 19 32 23 C35 19 40 17 45 22 C50 29 46 37 32 46 Z"
        fill="url(#hk-heart2)"
        opacity={0.85}
      />
    </Svg>
  );
}

function AppleWatchIllustration({ size = 260 }) {
  // Watch face dimensions
  const W = 200;
  const H = 250;
  const scale = size / 260;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={W * scale} height={H * scale} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <SvgLG id="strap-top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1f1f23" />
            <Stop offset="1" stopColor="#3a3a40" />
          </SvgLG>
          <SvgLG id="strap-bot" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#3a3a40" />
            <Stop offset="1" stopColor="#1f1f23" />
          </SvgLG>
          <SvgLG id="watch-body" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0f0f12" />
            <Stop offset="1" stopColor="#000000" />
          </SvgLG>
          <SvgLG id="screen-bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#070708" />
            <Stop offset="1" stopColor="#000000" />
          </SvgLG>
        </Defs>

        {/* Strap top */}
        <Path d={`M${W/2 - 38} 0 L${W/2 + 38} 0 L${W/2 + 32} 50 L${W/2 - 32} 50 Z`} fill="url(#strap-top)" />
        {/* Strap bottom */}
        <Path d={`M${W/2 - 32} 200 L${W/2 + 32} 200 L${W/2 + 38} 250 L${W/2 - 38} 250 Z`} fill="url(#strap-bot)" />

        {/* Crown (digital crown right side) */}
        <Rect x={W/2 + 65} y={92} width={6} height={18} rx={1.5} fill="#5a5a5e" />
        <Rect x={W/2 + 65} y={120} width={5} height={12} rx={1.2} fill="#3a3a40" />

        {/* Watch body */}
        <Rect x={W/2 - 65} y={45} width={130} height={160} rx={28} fill="url(#watch-body)" />

        {/* Subtle inner bezel */}
        <Rect x={W/2 - 60} y={50} width={120} height={150} rx={24} stroke="rgba(255,255,255,0.08)" strokeWidth={0.8} fill="none" />

        {/* Screen */}
        <Rect x={W/2 - 56} y={54} width={112} height={142} rx={20} fill="url(#screen-bg)" />

        {/* Time */}
        <Text /> {/* will be replaced by RN Text overlay */}

        {/* Activity ring — Move (red, jellyfish-tinted) */}
        <Circle cx={W/2 - 30} cy={140} r={14} stroke="rgba(255,59,48,0.25)" strokeWidth={3} fill="none" />
        <Path d={`M${W/2 - 30} 126 A 14 14 0 0 1 ${W/2 - 16} 140`} stroke="#FF3B30" strokeWidth={3} strokeLinecap="round" fill="none" />

        {/* Activity ring — Exercise (green) */}
        <Circle cx={W/2} cy={140} r={14} stroke="rgba(48,209,88,0.25)" strokeWidth={3} fill="none" />
        <Path d={`M${W/2} 126 A 14 14 0 0 1 ${W/2 + 14} 140 A 14 14 0 0 1 ${W/2} 154`} stroke="#30D158" strokeWidth={3} strokeLinecap="round" fill="none" />

        {/* Activity ring — Stand (blue) */}
        <Circle cx={W/2 + 30} cy={140} r={14} stroke="rgba(10,132,255,0.25)" strokeWidth={3} fill="none" />
        <Path d={`M${W/2 + 30} 126 A 14 14 0 1 1 ${W/2 + 16} 140`} stroke="#0A84FF" strokeWidth={3} strokeLinecap="round" fill="none" />

        {/* Heartbeat line */}
        <Path d={`M${W/2 - 40} 175 L${W/2 - 20} 175 L${W/2 - 12} 165 L${W/2 - 4} 185 L${W/2 + 4} 170 L${W/2 + 12} 178 L${W/2 + 40} 178`} stroke="#FF3B30" strokeWidth={1.5} strokeLinecap="round" fill="none" />
      </Svg>
      {/* Overlay text on watch face */}
      <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', top: size * 0.27, width: size }}>
        <Text style={{ color: '#AEEF4D', fontSize: Math.round(size * 0.10), fontWeight: '300', letterSpacing: 1, fontVariant: ['tabular-nums'] }}>20:45</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
          <Text style={{ color: '#FF8A6E', fontSize: Math.round(size * 0.043), fontWeight: '700', letterSpacing: 1 }}>324 CAL</Text>
          <Text style={{ color: '#FF3B30', fontSize: Math.round(size * 0.043), fontWeight: '700', letterSpacing: 1 }}>170 BPM</Text>
        </View>
      </View>
    </View>
  );
}

let AppleHealthKit = null;
try { AppleHealthKit = require('react-native-health').default; } catch(e) {}

const HK_REQ_PERMISSIONS = AppleHealthKit ? {
  permissions: {
    read: [
      AppleHealthKit.Constants?.Permissions?.ActiveEnergyBurned,
      AppleHealthKit.Constants?.Permissions?.AppleExerciseTime,
      AppleHealthKit.Constants?.Permissions?.AppleStandTime,
      AppleHealthKit.Constants?.Permissions?.HeartRate,
      AppleHealthKit.Constants?.Permissions?.Workout,
    ].filter(Boolean),
    write: [
      AppleHealthKit.Constants?.Permissions?.ActiveEnergyBurned,
      AppleHealthKit.Constants?.Permissions?.Workout,
    ].filter(Boolean),
  },
} : null;

export default function HealthKitConnectScreen({ lang, onDone }) {
  const tr = T[lang] || T.fr;
  const [requesting, setRequesting] = useState(false);

  const watchScale = useRef(new Animated.Value(0.92)).current;
  const watchOpacity = useRef(new Animated.Value(0)).current;
  const heartPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(watchOpacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(watchScale, { toValue: 1, damping: 14, stiffness: 80, mass: 1, useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(heartPulse, { toValue: 1.08, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(heartPulse, { toValue: 1.0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  function showLaterToast() {
    if (typeof onDone === 'function') {
      // Best-effort toast: an alert without buttons doesn't exist on RN, use an Alert quick popup
      Alert.alert('FluidBody+', tr.hk_later_toast || 'Tu pourras autoriser HealthKit plus tard dans Réglages.');
    }
  }

  function handleConnect() {
    if (requesting) return;
    if (!AppleHealthKit || Platform.OS !== 'ios' || !HK_REQ_PERMISSIONS) {
      onDone && onDone({ granted: false });
      return;
    }
    setRequesting(true);
    AppleHealthKit.initHealthKit(HK_REQ_PERMISSIONS, function(err) {
      setRequesting(false);
      if (err) {
        showLaterToast();
        onDone && onDone({ granted: false, error: err });
      } else {
        onDone && onDone({ granted: true });
      }
    });
  }

  function handleSkip() {
    if (typeof onDone === 'function') onDone({ skipped: true });
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000a1a' }}>
      <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        {BULLES_ONBOARDING.map((b, i) => <Bulle key={`hk-${i}`} {...b} />)}
      </View>

      {/* Top: Passer */}
      <View style={{ paddingTop: 56, paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 5 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: 24 }}>+</AnimatedPlus></Text>
        <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
          <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>{tr.hk_skip || 'Passer'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 36, paddingTop: 20, zIndex: 5 }}>
        {/* Apple Watch illustration */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <Animated.View style={{
            opacity: watchOpacity,
            transform: [{ scale: watchScale }],
            shadowColor: '#AEEF4D',
            shadowOpacity: 0.25,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 0 },
          }}>
            <AppleWatchIllustration size={260} />
          </Animated.View>
        </View>

        {/* Texts */}
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', lineHeight: 34 }}>{tr.hk_title || 'Connecte ton Apple Watch'}</Text>
          <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 12, paddingHorizontal: 12, lineHeight: 22 }}>{tr.hk_sub || "Autoriser l'accès à HealthKit pour synchroniser tes séances, ta fréquence cardiaque et tes mouvements."}</Text>
        </View>

        {/* HealthKit logo */}
        <View style={{ alignItems: 'center', marginBottom: 26 }}>
          <View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(174,239,77,0.10)' }} />
          <Animated.View style={{ transform: [{ scale: heartPulse }], shadowColor: '#FF1B3F', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
            <HealthHeartIcon size={64} />
          </Animated.View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={handleConnect}
          disabled={requesting}
          activeOpacity={0.85}
          style={{
            alignSelf: 'stretch',
            height: 56,
            borderRadius: 28,
            backgroundColor: '#AEEF4D',
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: 0,
            opacity: requesting ? 0.7 : 1,
            shadowColor: '#AEEF4D',
            shadowOpacity: 0.45,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#000000', letterSpacing: 1 }}>
            {requesting ? '…' : (tr.hk_connect || 'CONNECTER')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
