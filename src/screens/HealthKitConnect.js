import { useEffect, useRef, useState } from 'react';
import { Text, View, Image, TouchableOpacity, Animated, Easing, Dimensions, StyleSheet, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Defs, LinearGradient as SvgLG, Stop } from 'react-native-svg';
import { T } from '../constants/data';
import { Bulle, BULLES_ONBOARDING } from '../components/Meduse';
import AnimatedPlus from '../components/AnimatedPlus';
import LivingBackground from '../components/LivingBackground';

const { width: SW, height: SH } = Dimensions.get('window');

// Hero image — drop your file at assets/images/apple-watch-hero.jpg
let APPLE_WATCH_HERO = null;
try { APPLE_WATCH_HERO = require('../../assets/images/apple-watch-hero.jpg'); } catch (e) {}

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

  const watchScale = useRef(new Animated.Value(0.94)).current;
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
        {/* Apple Watch hero card */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <Animated.View style={{
            width: '88%',
            aspectRatio: 1,
            alignSelf: 'center',
            borderRadius: 24,
            overflow: 'hidden',
            opacity: watchOpacity,
            transform: [{ scale: watchScale }],
            shadowColor: '#AEEF4D',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.18,
            shadowRadius: 24,
          }}>
            {APPLE_WATCH_HERO ? (
              <Image source={APPLE_WATCH_HERO} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ width: '100%', height: '100%', backgroundColor: 'rgba(8,26,38,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, paddingHorizontal: 18, textAlign: 'center' }}>
                  assets/images/apple-watch-hero.jpg
                </Text>
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'transparent', 'rgba(8,26,38,0.4)']}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0 }}
              pointerEvents="none"
            />
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
