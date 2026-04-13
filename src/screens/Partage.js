import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, Easing, View, TouchableOpacity, ScrollView, ImageBackground, Dimensions, Share, Linking as RNLinking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ViewShot from 'react-native-view-shot';
import { T, PILIER_IMAGES } from '../constants/data';
import { Bulle, MeduseCornerIcon, FloatingMedusas, BULLES } from '../components/Meduse';
import { getPiliers } from '../utils';

const { width: SW, height: SH } = Dimensions.get('window');
const COACH_IMAGE = require('../../assets/coach.jpg');

// ══════════════════════════════════
// PARTAGE — Social & Défis
// ══════════════════════════════════
var AVATARS = [
  { skin: '#8D5524', hair: '#2C1810', hairStyle: 'afro', bg: 'rgba(174,239,77,0.25)' },
  { skin: '#F1C27D', hair: '#D4A24C', hairStyle: 'long', bg: 'rgba(255,150,200,0.25)' },
  { skin: '#FFDBB4', hair: '#C94C16', hairStyle: 'short', bg: 'rgba(100,200,255,0.25)' },
  { skin: '#E0AC69', hair: '#1C1C1C', hairStyle: 'curly', bg: 'rgba(255,200,80,0.25)' },
  { skin: '#F7D5AA', hair: '#5C3317', hairStyle: 'bun', bg: 'rgba(180,130,255,0.25)' },
];

function AvatarFace({ size = 60, avatarIdx = 0 }) {
  var a = AVATARS[avatarIdx % AVATARS.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#AEEF4D' }}>
      <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 60 60">
        <Circle cx="30" cy="32" r="18" fill={a.skin} />
        {a.hairStyle === 'afro' && <Path d="M12 28c0-14 10-22 18-22s18 8 18 22c0 2-1 3-2 3h-4c0-8-4-14-12-14s-12 6-12 14h-4c-1 0-2-1-2-3z" fill={a.hair} />}
        {a.hairStyle === 'long' && <Path d="M14 30c0-12 7-20 16-20s16 8 16 20c0 1-0.5 2-1 2h-2c1-4 1-8 0-12-2-6-6-8-13-8s-11 2-13 8c-1 4-1 8 0 12h-2c-0.5 0-1-1-1-2z" fill={a.hair} />}
        {a.hairStyle === 'short' && <Path d="M15 28c0-10 7-18 15-18s15 8 15 18c0 1-0.5 1.5-1 1.5h-1c0-6-3-12-13-12s-13 6-13 12h-1c-0.5 0-1-0.5-1-1.5z" fill={a.hair} />}
        {a.hairStyle === 'curly' && <><Path d="M13 30c-1-14 8-22 17-22s18 8 17 22" fill={a.hair} /><Circle cx="14" cy="26" r="4" fill={a.hair} /><Circle cx="46" cy="26" r="4" fill={a.hair} /><Circle cx="22" cy="10" r="4" fill={a.hair} /><Circle cx="38" cy="10" r="4" fill={a.hair} /><Circle cx="30" cy="8" r="4" fill={a.hair} /></>}
        {a.hairStyle === 'bun' && <><Path d="M16 28c0-10 6-17 14-17s14 7 14 17c0 1-0.5 1.5-1 1.5h-1c0-5-3-11-12-11s-12 6-12 11h-1c-0.5 0-1-0.5-1-1.5z" fill={a.hair} /><Circle cx="30" cy="8" r="7" fill={a.hair} /></>}
        <Circle cx="24" cy="33" r="2.2" fill="#1C1C1C" />
        <Circle cx="36" cy="33" r="2.2" fill="#1C1C1C" />
        <Circle cx="25" cy="32" r="0.8" fill="#ffffff" />
        <Circle cx="37" cy="32" r="0.8" fill="#ffffff" />
        <Path d="M26 40Q30 44 34 40" stroke="#1C1C1C" strokeWidth={1.5} strokeLinecap="round" fill="none" />
        <Circle cx="20" cy="37" r="3" fill="rgba(255,130,130,0.3)" />
        <Circle cx="40" cy="37" r="3" fill="rgba(255,130,130,0.3)" />
      </Svg>
    </View>
  );
}

function AvatarConstellation({ prenom }) {
  var floatY = useRef(new Animated.Value(0)).current;
  var floatX = useRef(new Animated.Value(0)).current;
  var scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(function() {
    Animated.loop(Animated.sequence([
      Animated.timing(floatY, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatY, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(floatX, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatX, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.08, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);
  var translateY = floatY.interpolate({ inputRange: [0, 1], outputRange: [8, -12] });
  var translateX = floatX.interpolate({ inputRange: [0, 1], outputRange: [-6, 6] });
  return (
    <View style={{ height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
      <Animated.View style={{ transform: [{ translateY: translateY }, { translateX: translateX }, { scale: scaleAnim }] }}>
        <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: 'transparent', borderWidth: 3, borderColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
          <AvatarFace size={94} avatarIdx={0} />
        </View>
      </Animated.View>
    </View>
  );
}

function FloatingAvatars() {
  var faces = useRef([
    { x: new Animated.Value(20), y: new Animated.Value(SH * 0.1), size: 70 },
    { x: new Animated.Value(SW * 0.65), y: new Animated.Value(SH * 0.18), size: 58 },
    { x: new Animated.Value(SW * 0.3), y: new Animated.Value(SH * 0.4), size: 64 },
    { x: new Animated.Value(SW * 0.8), y: new Animated.Value(SH * 0.55), size: 52 },
    { x: new Animated.Value(SW * 0.15), y: new Animated.Value(SH * 0.7), size: 66 },
  ]).current;
  useEffect(function() {
    faces.forEach(function(f, i) {
      setTimeout(function() {
        (function drift() {
          var toX = 10 + Math.random() * (SW - f.size - 20);
          var toY = 60 + Math.random() * (SH - f.size - 160);
          var dur = 10000 + Math.random() * 6000;
          Animated.parallel([
            Animated.timing(f.x, { toValue: toX, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
            Animated.timing(f.y, { toValue: toY, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          ]).start(function() { drift(); });
        })();
      }, 300 + i * 600);
    });
  }, []);
  return faces.map(function(f, i) {
    return (
      <Animated.View key={'fa-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 0, opacity: 0.55, left: f.x, top: f.y }}>
        <AvatarFace size={f.size} avatarIdx={i} />
      </Animated.View>
    );
  });
}

function PartageScreen({ done, lang, streak, prenom }) {
  var tr = T[lang] || T['fr'];
  var piliers = getPiliers(lang);
  var totalDone = Object.values(done).flat().filter(Boolean).length;
  var pct = Math.round(totalDone / 160 * 100);
  var [defis, setDefis] = useState([]);
  var [invites, setInvites] = useState([]);
  var [showCreateDefi, setShowCreateDefi] = useState(false);
  var [defiPilier, setDefiPilier] = useState(null);
  var [defiDuree, setDefiDuree] = useState('7 jours');

  useEffect(function() {
    AsyncStorage.getItem('fluid_defis').then(function(raw) { if (raw) try { setDefis(JSON.parse(raw)); } catch(e) {} });
    AsyncStorage.getItem('fluid_invites').then(function(raw) { if (raw) try { setInvites(JSON.parse(raw)); } catch(e) {} });
  }, []);

  var shareCardRef = useRef(null);
  var [capturing, setCapturing] = useState(false);

  async function captureCard() {
    if (!shareCardRef.current) return null;
    try {
      var uri = await shareCardRef.current.capture({ format: 'png', quality: 1 });
      return uri;
    } catch(e) { return null; }
  }

  async function shareProgression() {
    setCapturing(true);
    setTimeout(async function() {
      var uri = await captureCard();
      setCapturing(false);
      if (uri) {
        Share.share({ url: uri, message: 'FluidBody+ Pilates\nhttps://apps.apple.com/app/fluidbody/id6746387875' }).catch(function() {});
      } else {
        var msg = (tr.partage_share_msg || 'FluidBody+ Pilates') + '\n' + pct + '% · ' + totalDone + ' ' + (tr.m_seances || 'séances') + ' · 🔥' + (streak || 0) + '\nhttps://apps.apple.com/app/fluidbody/id6746387875';
        Share.share({ message: msg }).catch(function() {});
      }
    }, 300);
  }

  async function shareInstagram() {
    setCapturing(true);
    setTimeout(async function() {
      var uri = await captureCard();
      setCapturing(false);
      if (uri) {
        Share.share({ url: uri }).catch(function() {});
      }
    }, 300);
  }

  async function shareWhatsApp() {
    var msg = (tr.partage_share_msg || 'FluidBody+ Pilates') + '\n' + pct + '% · ' + totalDone + ' ' + (tr.m_seances || 'séances') + ' · 🔥' + (streak || 0) + '\nhttps://apps.apple.com/app/fluidbody/id6746387875';
    try {
      var canOpen = await RNLinking.canOpenURL('whatsapp://send');
      if (canOpen) { await RNLinking.openURL('whatsapp://send?text=' + encodeURIComponent(msg)); }
      else { Share.share({ message: msg }).catch(function() {}); }
    } catch(e) { Share.share({ message: msg }).catch(function() {}); }
  }

  function inviteAmis() {
    var msg = (tr.partage_invite_msg || 'Rejoins-moi sur FluidBody+ Pilates !') + '\nhttps://apps.apple.com/app/fluidbody/id6746387875';
    Share.share({ message: msg }).then(function(result) {
      if (result.action === Share.sharedAction) {
        var updated = [].concat(invites, [{ date: new Date().toISOString(), status: 'pending' }]);
        setInvites(updated);
        AsyncStorage.setItem('fluid_invites', JSON.stringify(updated));
      }
    }).catch(function() {});
  }

  function createDefi() {
    if (!defiPilier) return;
    var defi = { pilier: defiPilier, duree: defiDuree, date: new Date().toISOString(), progress: 0 };
    var updated = [].concat(defis, [defi]);
    setDefis(updated);
    AsyncStorage.setItem('fluid_defis', JSON.stringify(updated));
    setShowCreateDefi(false);
    setDefiPilier(null);
  }

  function deleteDefi(idx) {
    var updated = defis.filter(function(_, i) { return i !== idx; });
    setDefis(updated);
    AsyncStorage.setItem('fluid_defis', JSON.stringify(updated));
  }

  var dureeOptions = ['3 jours', '7 jours', '14 jours', '30 jours'];

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 62, paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 34 }}>+</Text></Text>
            <MeduseCornerIcon size={40} breathCycleMs={3000} tint="rgba(174,239,77,1)" />
          </View>
          <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.partage_title || 'Partage'}</Text>
        </View>


        <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{tr.partage_progression || 'Partager ma progression'}</Text>

          <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }}>
            <LinearGradient colors={['#00bdd0', '#005878', '#002d48', '#000e18']} style={{ borderRadius: 16, padding: 24, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 28 }}>+</Text></Text>
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D' }}>
                  <ImageBackground source={COACH_IMAGE} resizeMode="cover" style={{ flex: 1 }} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, fontWeight: '800', color: '#ffffff' }}>{pct}%</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{tr.resume_global || 'Global'}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, fontWeight: '800', color: '#ffffff' }}>{'🔥'}{streak || 0}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>Streak</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, fontWeight: '800', color: '#ffffff' }}>{totalDone}</Text>
                  <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{tr.m_seances || 'Séances'}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                {(function() {
                  var bestP = piliers.reduce(function(best, p) { var c = (done[p.key] || []).filter(Boolean).length; return c > best.count ? { p: p, count: c } : best; }, { p: piliers[0], count: 0 });
                  return (
                    <>
                      <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 12 }}>
                        <ImageBackground source={PILIER_IMAGES[bestP.p.key]} resizeMode="cover" style={{ flex: 1 }} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>{bestP.p.label}</Text>
                        <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{bestP.count}/20 {tr.m_seances || 'séances'}</Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#AEEF4D' }}>{Math.round(bestP.count / 20 * 100)}%</Text>
                    </>
                  );
                })()}
              </View>

              <Text style={{ fontSize: 14, fontWeight: '300', color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontStyle: 'italic', lineHeight: 20 }}>{tr.coach_quote || '"Je vous accompagne pas à pas vers un corps plus libre."'}</Text>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 8 }}>fluidbody.app · Pilates & More</Text>
            </LinearGradient>
          </ViewShot>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity onPress={shareProgression} activeOpacity={0.85} style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#000000' }}>{tr.partage_btn || 'Partager'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={shareInstagram} activeOpacity={0.85} style={{ height: 48, borderRadius: 24, backgroundColor: 'rgba(225,48,108,0.9)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 6 }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Rect x="2" y="2" width="20" height="20" rx="5" stroke="#fff" strokeWidth={1.8} />
                <Circle cx="12" cy="12" r="5" stroke="#fff" strokeWidth={1.8} />
                <Circle cx="17.5" cy="6.5" r="1.5" fill="#fff" />
              </Svg>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>Story</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={shareWhatsApp} activeOpacity={0.85} style={{ height: 48, borderRadius: 24, backgroundColor: 'rgba(37,211,102,0.9)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 6 }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path d="M12 2C6.48 2 2 6.48 2 12c0 1.77.46 3.43 1.27 4.88L2 22l5.23-1.23A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" stroke="#fff" strokeWidth={1.6} />
                <Path d="M8.5 10.5c.4 1.2 1.3 2.4 2.5 3.2l1.5-.5c.3-.1.6 0 .8.2l1.2 1.5c.2.3.1.6-.2.8l-1 .6c-.5.3-1.1.2-1.5-.1-2-1.3-3.5-3.2-4.2-5.2-.1-.4 0-.9.3-1.2l.7-.9c.2-.3.6-.3.8-.1l1.3 1.3c.2.2.2.5.1.7l-.6 1" fill="#fff" opacity={0.9} />
              </Svg>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>{tr.partage_inviter || 'Inviter des amis'}</Text>
          <TouchableOpacity onPress={inviteAmis} activeOpacity={0.85} style={{ height: 48, borderRadius: 24, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>{tr.partage_invite_btn || 'Inviter par SMS / Email'}</Text>
          </TouchableOpacity>
          {invites.length > 0 && (
            <View>
              <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>{tr.partage_en_attente || 'En attente'} ({invites.length})</Text>
              {invites.slice(-5).reverse().map(function(inv, i) {
                var d = new Date(inv.date);
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i < Math.min(invites.length, 5) - 1 ? 0.5 : 0, borderBottomColor: 'rgba(174,239,77,0.12)' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Text style={{ fontSize: 14, color: '#AEEF4D' }}>✉</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: 'rgba(174,239,77,0.6)' }}>{tr.partage_invitation || 'Invitation'} {invites.length - i}</Text>
                    <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.4)' }}>{d.getDate() + '/' + (d.getMonth() + 1)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>{tr.partage_defis || 'Défis'}</Text>

          {!showCreateDefi ? (
            <TouchableOpacity onPress={function() { setShowCreateDefi(true); }} activeOpacity={0.85} style={{ height: 48, borderRadius: 24, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginBottom: defis.length > 0 ? 16 : 0 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>{tr.partage_creer_defi || 'Créer un défi'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, color: '#AEEF4D', marginBottom: 10 }}>{tr.partage_choisir_pilier || 'Choisis un pilier'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
                {piliers.map(function(p) {
                  var active = defiPilier === p.key;
                  return (
                    <TouchableOpacity key={p.key} onPress={function() { setDefiPilier(p.key); }} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(174,239,77,0.15)' : 'rgba(0,18,32,0.6)' }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden' }}>
                        <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} />
                      </View>
                      <Text style={{ fontSize: 12, color: active ? '#AEEF4D' : 'rgba(255,255,255,0.5)' }}>{p.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={{ fontSize: 12, color: '#AEEF4D', marginBottom: 10 }}>{tr.partage_duree_defi || 'Durée'}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {dureeOptions.map(function(d) {
                  var active = defiDuree === d;
                  return (
                    <TouchableOpacity key={d} onPress={function() { setDefiDuree(d); }} style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(174,239,77,0.15)' : 'rgba(0,18,32,0.6)', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: active ? '#AEEF4D' : 'rgba(255,255,255,0.5)' }}>{d}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={function() { setShowCreateDefi(false); setDefiPilier(null); }} style={{ flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{tr.retour || 'Annuler'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={createDefi} disabled={!defiPilier} style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: defiPilier ? '#AEEF4D' : 'rgba(174,239,77,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#000000' }}>{tr.partage_lancer || 'Lancer'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {defis.map(function(defi, idx) {
            var p = piliers.find(function(x) { return x.key === defi.pilier; });
            var doneCount = done[defi.pilier] ? done[defi.pilier].filter(Boolean).length : 0;
            var defiPct = Math.round(doneCount / 20 * 100);
            return (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: idx === 0 && !showCreateDefi ? 0 : 0.5, borderTopColor: 'rgba(174,239,77,0.12)' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 12 }}>
                  <ImageBackground source={p ? PILIER_IMAGES[p.key] : null} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>{p ? p.label : defi.pilier}</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.5)', marginTop: 2 }}>{defi.duree}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                    <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(174,239,77,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: 4, width: defiPct + '%', backgroundColor: '#AEEF4D', borderRadius: 2 }} />
                    </View>
                    <Text style={{ fontSize: 11, color: '#AEEF4D' }}>{defiPct}%</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={function() { deleteDefi(idx); }} style={{ padding: 6 }}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,100,100,0.6)' }}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export default PartageScreen;
