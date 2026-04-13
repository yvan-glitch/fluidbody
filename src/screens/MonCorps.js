import { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, Easing, View, TouchableOpacity, ScrollView, Dimensions, Modal, Platform, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { U_JELLY, U_WAVE, ZONE_TO_PILIER, T, PILIER_IMAGES } from '../constants/data';
import { Bulle, Rayon, MeduseCornerIcon, BULLES, BULLES_MONCORPS } from '../components/Meduse';
import VideoPlayer from '../components/VideoPlayer';
import PilierCard from '../components/PilierCard';
import { getPiliers, getSeances, getSeanceDuJour, canAccessSeanceIndex, isComingSoon, getResumeIndicesForPilier, hapticLight } from '../utils';

let Notifications = null;
try { Notifications = require('expo-notifications'); } catch(e) {}

const { width: SW, height: SH } = Dimensions.get('window');
const IS_IPAD = SW >= 768;

const U_STAR = '\u2B50';
const U_DROP = '\uD83D\uDCA7';

const ETAPE_COLORS = {
  'Comprendre': 'rgba(0,220,170,0.9)',
  'Ressentir': 'rgba(100,190,255,0.9)',
  'Préparer': 'rgba(255,200,80,0.9)',
  'Exécuter': 'rgba(255,145,100,0.9)',
  'Évoluer': 'rgba(185,135,255,0.9)',
};

var JOUR_LABELS = { fr: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], de: ['Mo','Di','Mi','Do','Fr','Sa','So'], pt: ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'], zh: ['一','二','三','四','五','六','日'], ja: ['月','火','水','木','金','土','日'], ko: ['월','화','수','목','금','토','일'], es: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'], it: ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'] };

function tabBarIconTint(color) {
  return color != null && color !== '' ? color : 'rgba(0,220,255,0.9)';
}

function TabIconTimer({ color, size }) {
  var c = tabBarIconTint(color);
  var s = size ?? 22;
  return (
    <View style={{ width: s, height: s, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="13" r="8" stroke={c} strokeWidth={1.6} />
        <Path d="M12 5V7" stroke={c} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M9.5 3h5" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M12 13V9.5" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
        <Path d="M12 13L14.5 15" stroke={c} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function CelebrationOverlay({ visible, onDone, pilier, lang }) {
  const tr = T[lang] || T['fr'];
  const scaleAnim  = useRef(new Animated.Value(0)).current;
  const opacAnim   = useRef(new Animated.Value(0)).current;
  const medalAnim  = useRef(new Animated.Value(0)).current;
  const particles  = useRef(Array.from({ length: 18 }, () => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    o: new Animated.Value(1),
    s: new Animated.Value(0),
    dx: (Math.random() - 0.5) * 320,
    dy: -(80 + Math.random() * 280),
  }))).current;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(opacAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(medalAnim, { toValue: 1,  duration: 400, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.timing(medalAnim, { toValue: 0.9,duration: 200, easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
      Animated.timing(medalAnim, { toValue: 1,  duration: 200, easing: Easing.inOut(Easing.sin),  useNativeDriver: true }),
    ]).start();
    particles.forEach((p, i) => {
      setTimeout(() => {
        p.s.setValue(0.4 + Math.random() * 0.6);
        Animated.parallel([
          Animated.timing(p.x, { toValue: p.dx, duration: 900 + Math.random()*400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(p.y, { toValue: p.dy, duration: 900 + Math.random()*400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(p.o, { toValue: 0,    duration: 1100 + Math.random()*300, useNativeDriver: true }),
        ]).start();
      }, i * 40);
    });
    setTimeout(onDone, 3200);
  }, [visible]);

  if (!visible) return null;
  const EMOJIS = ['\u2728', U_WAVE, U_DROP, U_STAR, '\uD83E\uDEA7', '\uD83D\uDCAB', '\uD83C\uDF38'];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,5,15,0.82)', opacity: opacAnim }} />
      {particles.map((p, i) => (
        <Animated.Text key={i} style={{ position: 'absolute', fontSize: 18, transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.s }], opacity: p.o }}>
          {EMOJIS[i % EMOJIS.length]}
        </Animated.Text>
      ))}
      <Animated.View style={{
        transform: [{ scale: scaleAnim }],
        opacity: opacAnim,
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderRadius: 32,
        padding: 36,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.48)',
        alignItems: 'center',
        width: 300,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 12 },
        elevation: 16,
      }}>
        <Animated.View style={{ transform: [{ scale: medalAnim }], marginBottom: 16 }}>
          <Text style={{ fontSize: 64 }}>{U_JELLY}</Text>
        </Animated.View>
        <Text style={{ fontSize: 11, color: pilier?.color || 'rgba(0,215,255,0.95)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10 }}>{tr.seance_done}</Text>
        <Text style={{ fontSize: 22, fontWeight: '200', color: 'rgba(255,255,255,0.96)', textAlign: 'center', lineHeight: 32 }}>{pilier?.label}</Text>
        <View style={{ width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.28)', marginVertical: 16 }} />
        <Text style={{ fontSize: 14, color: 'rgba(230,248,255,0.78)', textAlign: 'center', lineHeight: 22 }}>{tr.celebration.split('\n')[0]}{'\n'}{tr.celebration.split('\n')[1]}</Text>
      </Animated.View>
    </View>
  );
}

function PilierPanel({ pilier, done, onToggle, onClose, lang, isRecommended, isSubscriber, onActivateSubscription, sdjIndex, saveHealthKitWorkout }) {
  const tr = T[lang] || T['fr'];
  const seances = getSeances(lang)[pilier.key] || [];
  const doneCount = (done || []).filter(Boolean).length;
  const [activeVideo, setActiveVideo] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showDemoLimit, setShowDemoLimit] = useState(false);
  const [resumeIndices, setResumeIndices] = useState(() => new Set());

  var ppMedusas = useRef([
    { x: new Animated.Value(SW - 80), y: new Animated.Value(40), size: 70 },
    { x: new Animated.Value(20), y: new Animated.Value(SH * 0.06), size: 54 },
    { x: new Animated.Value(SW * 0.4), y: new Animated.Value(SH * 0.1), size: 42 },
  ]).current;

  useEffect(function() {
    ppMedusas.forEach(function(m) {
      function drift() {
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 40 + Math.random() * (SH - m.size - 140);
        var dur = 10000 + Math.random() * 6000;
        Animated.parallel([
          Animated.timing(m.x, { toValue: toX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
          Animated.timing(m.y, { toValue: toY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
        ]).start(function() { drift(); });
      }
      setTimeout(function() { drift(); }, Math.random() * 2000);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await getResumeIndicesForPilier(pilier.key);
      if (!cancelled) setResumeIndices(next);
    })();
    return () => { cancelled = true; };
  }, [pilier.key, activeVideo]);

  function tryOpenSeance(i) {
    if (isComingSoon(i)) return;
    if (!canAccessSeanceIndex(i, isSubscriber)) {
      onActivateSubscription?.();
      return;
    }
    hapticLight();
    setActiveVideo(i);
  }

  if (activeVideo !== null) {
    return (
      <Modal
        visible
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setActiveVideo(null)}
      >
        <VideoPlayer
          key={`${pilier.key}-${activeVideo}`}
          seance={seances[activeVideo]}
          pilier={pilier}
          lang={lang}
          seanceIndex={activeVideo}
          isDemo={activeVideo === sdjIndex && !isSubscriber}
          onClose={() => { setShowDemoLimit(false); setActiveVideo(null); }}
          onComplete={() => { onToggle(activeVideo); setActiveVideo(null); setShowCelebration(true); }}
          onDemoLimit={() => setShowDemoLimit(true)}
          saveHealthKitWorkout={saveHealthKitWorkout}
        />
        {showDemoLimit && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.85)', paddingVertical: 24, paddingHorizontal: 28, alignItems: 'center', zIndex: 50 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', textAlign: 'center', marginBottom: 12 }}>{tr.demo_limit}</Text>
            <TouchableOpacity onPress={() => { setShowDemoLimit(false); setActiveVideo(null); if (onActivateSubscription) onActivateSubscription(); }} style={{ backgroundColor: '#E5FF00', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 25 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#000000' }}>{tr.paywall_start}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    );
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.18} />
      <Rayon left={280} width={40} delay={4000} duration={8000} opacity={0.12} />
      {BULLES.map((b, i) => <Bulle key={i} {...b} />)}{IS_IPAD && BULLES.map((b, i) => <Bulle key={'r'+i} delay={b.delay + 2000} x={b.x + SW * 0.35} size={b.size} duration={b.duration} />)}{IS_IPAD && BULLES.map((b, i) => <Bulle key={'r2'+i} delay={b.delay + 5000} x={b.x + SW * 0.65} size={b.size} duration={b.duration} />)}
      {ppMedusas.map(function(m, i) {
        return (
          <Animated.View key={'ppm-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 2, opacity: 0.9, left: m.x, top: m.y }}>
            <MeduseCornerIcon size={m.size} breathCycleMs={3000 + i * 600} breathMaxScale={1.35} tint="rgba(174,239,77,1)" />
          </Animated.View>
        );
      })}
      <View style={{ paddingTop: 54, paddingHorizontal: 22, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 10 }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 28 }}>+</Text></Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>{tr.retour}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: IS_IPAD ? 38 : 34, fontWeight: '200', color: '#ffffff', letterSpacing: -0.3 }}>{pilier.label}</Text>
          {isRecommended && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(0,215,255,0.2)', borderWidth: 1, borderColor: 'rgba(0,215,255,0.7)' }}>
              <Text style={{ fontSize: 9, color: 'rgba(0,220,255,0.9)', letterSpacing: 1 }}>{'\u2605'} {tr.recommande_pour_toi}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 10, color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.seances_available || '5 S\u00C9ANCES \u00B7 PLUS \u00C0 VENIR'}</Text>
        <View style={{ height: 3, backgroundColor: 'rgba(0,200,240,0.1)', borderRadius: 2, marginTop: 10, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ height: 3, flex: doneCount / 5, backgroundColor: pilier.color, borderRadius: 2 }} />
        </View>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        {seances.map(([titre, duree, etape], i) => {
          const isDone = done[i] === true || done[i] === 'true';
          const coming = isComingSoon(i);
          const locked = !coming && !canAccessSeanceIndex(i, isSubscriber);
          if (coming) {
            return (
              <View key={i} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12, height: 110 }}>
                <ImageBackground source={PILIER_IMAGES[pilier.key]} resizeMode="cover" style={{ flex: 1 }}>
                  <LinearGradient colors={['rgba(0,14,24,0.55)', 'rgba(0,14,24,0.8)']} style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.25)', alignSelf: 'flex-end', marginBottom: 6 }}>FLUIDBODY<Text style={{ color: 'rgba(174,239,77,0.3)' }}>+</Text></Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                        <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.15)' }}>{'\u25B6'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }} numberOfLines={1}>{titre}</Text>
                        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Text style={{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,189,208,0.08)', color: 'rgba(0,189,208,0.3)', letterSpacing: 0.5 }}>{tr.etapes[etape] || etape}</Text>
                          <Text style={{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)' }}>{duree}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 13, color: 'rgba(174,239,77,0.2)', fontWeight: '300' }}>{String(i + 1).padStart(2, '0')}</Text>
                    </View>
                  </LinearGradient>
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D' }}>{tr.coming_soon || 'Bient\u00F4t disponible'}</Text>
                  </View>
                </ImageBackground>
              </View>
            );
          }
          return (
            <TouchableOpacity key={i} onPress={() => tryOpenSeance(i)} activeOpacity={0.88} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12, height: 110, opacity: locked ? 0.4 : 1 }}>
              <ImageBackground source={PILIER_IMAGES[pilier.key]} resizeMode="cover" style={{ flex: 1 }}>
                <LinearGradient colors={isDone ? ['rgba(0,30,22,0.75)', 'rgba(0,30,22,0.85)'] : locked ? ['rgba(0,14,24,0.75)', 'rgba(0,14,24,0.9)'] : ['rgba(0,14,24,0.55)', 'rgba(0,14,24,0.8)']} style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: '#ffffff', alignSelf: 'flex-end', marginBottom: 6 }}>FLUIDBODY<Text style={{ color: '#AEEF4D' }}>+</Text></Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Text style={{ fontSize: 18, color: isDone ? '#AEEF4D' : '#ffffff' }}>{isDone ? '\u2713' : '\u25B6'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 6 }} numberOfLines={1}>{titre}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,189,208,0.15)', color: '#00BDD0', letterSpacing: 0.5 }}>{tr.etapes[etape] || etape}</Text>
                        <Text style={{ fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', color: '#ffffff' }}>{duree}</Text>
                        {i === 0 && !isSubscriber ? (
                          <Text style={{ fontSize: 9, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,189,208,0.2)', color: '#00BDD0', fontWeight: '700', letterSpacing: 0.5 }}>{tr.gratuit_badge || 'GRATUIT'}</Text>
                        ) : null}
                        {resumeIndices.has(i) && !locked ? (
                          <Text style={{ fontSize: 9, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(174,239,77,0.15)', color: '#AEEF4D', fontWeight: '600' }}>{tr.reprise_badge}</Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={{ fontSize: 13, color: '#AEEF4D', fontWeight: '300' }}>{String(i + 1).padStart(2, '0')}</Text>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>
      <CelebrationOverlay visible={showCelebration} onDone={() => setShowCelebration(false)} pilier={pilier} lang={lang} />
    </View>
  );
}

/** Tuiles SEANCES / STREAK / PROGRESSION — verre (BlurView) comme les controles video. */
function MetricTile({ children }) {
  if (Platform.OS === 'web') {
    return (
      <View style={[localStyles.metricShell, localStyles.metricWebFallback]}>
        <View style={localStyles.metricBlurInner}>{children}</View>
      </View>
    );
  }
  return (
    <View style={localStyles.metricShell}>
      <BlurView intensity={Platform.OS === 'ios' ? 34 : 26} tint="dark" style={localStyles.metricBlurInner}>
        {children}
      </BlurView>
    </View>
  );
}

async function scheduleProgNotifications(prog, idx, lang) {
  if (!Notifications) return [];
  try {
    var status = await Notifications.requestPermissionsAsync();
    if (status.status !== 'granted') return [];
  } catch(e) { return []; }
  var tr = T[lang] || T['fr'];
  var pilierNames = getPiliers(lang).filter(function(p) { return prog.piliers.includes(p.key); }).map(function(p) { return p.label; });
  var pilierStr = pilierNames.join(', ');
  var hour = prog.notifHour || 8;
  var ids = [];
  var selectedDays = prog.selectedDays || [1, 2, 3, 4, 5];
  for (var d = 0; d < selectedDays.length; d++) {
    try {
      var weekday = selectedDays[d] + 1;
      if (weekday > 7) weekday = 1;
      var id = await Notifications.scheduleNotificationAsync({
        content: { title: 'FluidBody+ \uD83D\uDCAA', body: (tr.prog_notif_body || "C'est l'heure de ta s\u00E9ance") + ' ' + pilierStr + ' \u00B7 ' + prog.duree, sound: true },
        trigger: { weekday: weekday, hour: hour, minute: 0, repeats: true },
      });
      ids.push(id);
    } catch(e) {}
  }
  return ids;
}

async function cancelProgNotifications(notifIds) {
  if (!Notifications || !notifIds) return;
  for (var i = 0; i < notifIds.length; i++) {
    try { await Notifications.cancelScheduledNotificationAsync(notifIds[i]); } catch(e) {}
  }
}

function CreateProgramScreen({ visible, onClose, lang, onSaved }) {
  if (!visible) return null;
  var tr = T[lang] || T["fr"];
  var piliers = getPiliers(lang);
  var [selected, setSelected] = useState([]);
  var [duree, setDuree] = useState(1);
  var [jours, setJours] = useState(3);
  var [saved, setSaved] = useState(false);
  var [notifHour, setNotifHour] = useState(8);
  var [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5]);
  var dureeOptions = ['10 min', '15 min', '20 min', '30 min', '45 min'];
  var joursOptions = [2, 3, 4, 5, 6, 7];
  var jourLabels = JOUR_LABELS[lang] || JOUR_LABELS.fr;

  function togglePilier(key) {
    setSelected(function(prev) { return prev.includes(key) ? prev.filter(function(k) { return k !== key; }) : [...prev, key]; });
  }

  function toggleDay(d) {
    setSelectedDays(function(prev) { return prev.includes(d) ? prev.filter(function(x) { return x !== d; }) : [].concat(prev, [d]).sort(); });
  }

  async function saveProg() {
    var prog = { piliers: selected, duree: dureeOptions[duree], jours: joursOptions[jours - 2 < 0 ? 0 : jours - 2], date: new Date().toISOString(), notifHour: notifHour, selectedDays: selectedDays };
    var notifIds = await scheduleProgNotifications(prog, 0, lang);
    prog.notifIds = notifIds;
    try {
      var raw = await AsyncStorage.getItem('fluid_custom_programs');
      var list = raw ? JSON.parse(raw) : [];
      list.push(prog);
      await AsyncStorage.setItem('fluid_custom_programs', JSON.stringify(list));
    } catch(e) {}
    setSaved(true);
    setTimeout(function() { if (onSaved) onSaved(); onClose(); setSaved(false); }, 1500);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000e18" }}>
        <LinearGradient colors={['#000e18', '#002d48', '#005878']} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 24, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <TouchableOpacity onPress={onClose} style={{ paddingVertical: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#E5FF00', letterSpacing: 1.5, textTransform: 'uppercase' }}>{tr.retour}</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 24 }}>{tr.prog_create_title}</Text>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#E5FF00', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_select_piliers}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 }}>
            {piliers.map(function(p) {
              var active = selected.includes(p.key);
              return (
                <TouchableOpacity key={p.key} onPress={function() { togglePilier(p.key); }} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1.5, borderColor: active ? '#E5FF00' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(229,255,0,0.12)' : 'rgba(0,18,32,0.6)' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden' }}>
                    <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: active ? '#E5FF00' : 'rgba(255,255,255,0.6)' }}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#E5FF00', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_duree_label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 28 }} contentContainerStyle={{ gap: 10 }}>
            {dureeOptions.map(function(d, i) {
              var active = duree === i;
              return (
                <TouchableOpacity key={i} onPress={function() { setDuree(i); }} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: active ? '#E5FF00' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(229,255,0,0.12)' : 'rgba(0,18,32,0.6)' }}>
                  <Text style={{ fontSize: 14, color: active ? '#E5FF00' : 'rgba(255,255,255,0.6)' }}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#E5FF00', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_jours_label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 36 }} contentContainerStyle={{ gap: 10 }}>
            {joursOptions.map(function(j) {
              var active = jours === j;
              return (
                <TouchableOpacity key={j} onPress={function() { setJours(j); }} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: active ? '#E5FF00' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(229,255,0,0.12)' : 'rgba(0,18,32,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: active ? '#E5FF00' : 'rgba(255,255,255,0.6)' }}>{j}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#E5FF00', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_notif_days || 'Jours de rappel'}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 0].map(function(d, i) {
              var active = selectedDays.includes(d);
              return (
                <TouchableOpacity key={d} onPress={function() { toggleDay(d); }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: active ? '#E5FF00' : 'rgba(255,255,255,0.15)', backgroundColor: active ? 'rgba(229,255,0,0.12)' : 'rgba(0,18,32,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#E5FF00' : 'rgba(255,255,255,0.6)' }}>{jourLabels[i]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: 14, fontWeight: '600', color: '#E5FF00', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_notif_hour || 'Heure de rappel'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 36 }}>
            <TouchableOpacity onPress={function() { setNotifHour(Math.max(5, notifHour - 1)); }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>{'\u2212'}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff', minWidth: 80, textAlign: 'center' }}>{String(notifHour).padStart(2, '0') + ':00'}</Text>
            <TouchableOpacity onPress={function() { setNotifHour(Math.min(22, notifHour + 1)); }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={saveProg} disabled={selected.length === 0} activeOpacity={0.85} style={{ height: 56, borderRadius: 28, backgroundColor: selected.length > 0 ? '#E5FF00' : 'rgba(229,255,0,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#000000' }}>{saved ? tr.prog_saved : tr.prog_save}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function MonCorps({ prenom, done, toggleDone, lang, tensionIdxs, streak, isSubscriber, onActivateSubscription, onTryFreeSession, onOpenTimer, saveHealthKitWorkout }) {
  var tr = T[lang] || T["fr"];
  var [openPilier, setOpenPilier] = useState(null);
  var [mcTab, setMcTab] = useState('pour_vous');
  var [showCreateProg, setShowCreateProg] = useState(false);
  var [savedPrograms, setSavedPrograms] = useState([]);

  useEffect(function() { loadSavedPrograms(); }, []);
  function loadSavedPrograms() {
    AsyncStorage.getItem('fluid_custom_programs').then(function(raw) {
      if (raw) { try { setSavedPrograms(JSON.parse(raw)); } catch(e) {} }
      else {
        AsyncStorage.getItem('fluid_custom_program').then(function(old) {
          if (old) { try { var p = JSON.parse(old); setSavedPrograms([p]); AsyncStorage.setItem('fluid_custom_programs', JSON.stringify([p])); } catch(e) {} }
        });
      }
    });
  }
  function deleteSavedProgram(idx) {
    var prog = savedPrograms[idx];
    if (prog && prog.notifIds) cancelProgNotifications(prog.notifIds);
    var updated = savedPrograms.filter(function(_, i) { return i !== idx; });
    setSavedPrograms(updated);
    AsyncStorage.setItem('fluid_custom_programs', JSON.stringify(updated));
  }
  var MC_TABS = ['pour_vous', 'explorer', 'programmes', 'recherche'];
  var mcTabLabels = { pour_vous: tr.tab_pour_vous, explorer: tr.tab_explorer, programmes: tr.tab_programmes, recherche: tr.tab_recherche };
  var piliers = getPiliers(lang);
  var recommendedPiliers = tensionIdxs.map(function(i) { return ZONE_TO_PILIER[i]; });
  var effectiveRecommended = recommendedPiliers.length > 0 ? recommendedPiliers : [];
  var sdj = getSeanceDuJour(done, tensionIdxs, lang);

  var mcMedusas = useRef([
    { x: new Animated.Value(20), y: new Animated.Value(SH * 0.05), size: 72, speed: 0.8, cx: 20, cy: SH * 0.05 },
    { x: new Animated.Value(SW * 0.7), y: new Animated.Value(SH * 0.1), size: 58, speed: 0.9, cx: SW * 0.7, cy: SH * 0.1 },
    { x: new Animated.Value(SW * 0.4), y: new Animated.Value(SH * 0.15), size: 64, speed: 0.85, cx: SW * 0.4, cy: SH * 0.15 },
    { x: new Animated.Value(SW * 0.85), y: new Animated.Value(SH * 0.08), size: 50, speed: 0.75, cx: SW * 0.85, cy: SH * 0.08 },
  ]).current;

  useEffect(function() {
    mcMedusas.forEach(function(m) {
      function drift() {
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 40 + Math.random() * (SH - m.size - 140);
        var dur = 12000 + Math.random() * 8000;
        Animated.parallel([
          Animated.timing(m.x, { toValue: toX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
          Animated.timing(m.y, { toValue: toY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
        ]).start(function() { drift(); });
      }
      setTimeout(function() { drift(); }, Math.random() * 3000);
    });
  }, []);

  var sortedPiliers = [...piliers].sort(function(a, b) {
    var aRec = effectiveRecommended.includes(a.key) ? 0 : 1;
    var bRec = effectiveRecommended.includes(b.key) ? 0 : 1;
    return aRec - bRec;
  });

  return (
    <View style={localStyles.screen}>
      <LinearGradient colors={["#000e18", "#001828", "#002d48", "#005878", "#00bdd0"]} locations={[0, 0.2, 0.45, 0.70, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: "none" }}>
        <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.18} />
        <Rayon left={140} width={55} delay={2000} duration={11000} opacity={0.15} />
        <Rayon left={280} width={40} delay={4000} duration={8000} opacity={0.12} />
      </View>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: "none", overflow: "visible" }}>
        {BULLES_MONCORPS.map(function(b, i) { return <Bulle key={"mc-" + i} {...b} />; })}
        {IS_IPAD && BULLES_MONCORPS.map(function(b, i) { return <Bulle key={"mc-ipad1-" + i} delay={b.delay + 2000} x={Math.max(0, Math.min(SW - 8, b.x + SW * 0.35))} size={b.size} duration={b.duration} />; })}
        {IS_IPAD && BULLES_MONCORPS.map(function(b, i) { return <Bulle key={"mc-ipad2-" + i} delay={b.delay + 5000} x={Math.max(0, Math.min(SW - 8, b.x + SW * 0.65))} size={b.size} duration={b.duration} />; })}
      </View>
      {mcTab !== 'programmes' && mcMedusas.map(function(m, i) {
        return (
          <Animated.View key={'mcm-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 4, opacity: 1, left: m.x, top: m.y }}>
            <MeduseCornerIcon size={m.size} breathCycleMs={2800 + i * 500} breathMaxScale={1.35} tint="rgba(174,239,77,1)" />
          </Animated.View>
        );
      })}
      <View style={[localStyles.logoRow, { justifyContent: "space-between", paddingLeft: 20, paddingRight: 20, paddingTop: 10, marginBottom: 20, flexDirection: 'row', alignItems: 'center' }]} pointerEvents="box-none">
        <Text style={localStyles.logoWordmark} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          FLUIDBODY<Text style={{ fontWeight: "900", color: "#AEEF4D", fontSize: 34 }}>+</Text>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {prenom ? <Text style={{ fontSize: 14, fontWeight: '300', color: 'rgba(174,239,77,0.6)' }}>{tr.bonjour(prenom)}</Text> : null}
          <TouchableOpacity onPress={onOpenTimer} activeOpacity={0.7} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center' }}>
            <TabIconTimer color="#AEEF4D" size={18} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ position: "absolute", top: 105, left: 0, right: 0, zIndex: 5, marginTop: 20 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {MC_TABS.map(function(t) {
            var active = mcTab === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={function() { setMcTab(t); }}
                activeOpacity={0.8}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: active ? "#ffffff" : "rgba(255,255,255,0.12)",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: active ? "#000000" : "#ffffff" }}>
                  {mcTabLabels[t]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView
        key={mcTab}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 3 }}
        contentContainerStyle={{ paddingTop: 170, paddingBottom: 120, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {mcTab === 'explorer' && sdj && (
          <TouchableOpacity onPress={function() { if (onTryFreeSession) onTryFreeSession(); }} activeOpacity={0.9} style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#AEEF4D' }}>
            <ImageBackground source={PILIER_IMAGES[sdj.pilier.key]} resizeMode="cover" style={{ height: 110 }}>
              <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.85)']} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Text style={{ fontSize: 20, color: '#000000' }}>{'\u25B6'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <View style={{ backgroundColor: '#FF3B30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff', letterSpacing: 1 }}>NOUVEAU</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#ffffff' }}>{sdj.seance[0]}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{sdj.pilier.label} {'\u00B7'} {sdj.seance[1]}</Text>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        )}
        {mcTab === 'pour_vous' && (function() {
          var gridGap = 6;
          var fullW = SW - 32;
          var halfW = Math.floor((fullW - gridGap) / 2);
          var thirdW = Math.floor((fullW - gridGap * 2) / 3);
          var rowH1 = Math.floor(halfW * 0.72);
          var rowH2 = Math.floor(thirdW * 0.82);
          var mosaicImages = [
            PILIER_IMAGES.p1, PILIER_IMAGES.p2,
            PILIER_IMAGES.p3, PILIER_IMAGES.p4, PILIER_IMAGES.p5,
            PILIER_IMAGES.p6, PILIER_IMAGES.p7,
          ];
          return (
            <View key="pour-vous">
              <View style={{ flexDirection: "row", gap: gridGap, marginBottom: gridGap }}>
                <View style={{ width: halfW, height: rowH1, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[0]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ width: halfW, height: rowH1, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[1]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: gridGap, marginBottom: gridGap }}>
                <View style={{ width: thirdW, height: rowH2, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[2]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ width: thirdW, height: rowH2, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[3]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ width: thirdW, height: rowH2, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[4]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: gridGap, marginBottom: 0 }}>
                <View style={{ width: halfW, height: rowH1, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[5]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ width: halfW, height: rowH1, borderRadius: 12, overflow: "hidden" }}>
                  <ImageBackground source={mosaicImages[6]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
              </View>
              <LinearGradient colors={["rgba(28,28,30,0.3)", "rgba(28,28,30,0.85)", "rgba(28,28,30,0.95)"]} locations={[0, 0.3, 1]} style={{ borderRadius: 16, marginTop: -60, paddingTop: 90, paddingBottom: 80, paddingHorizontal: 20, alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", textAlign: "center", marginBottom: 6 }}>{tr.paywall_title}</Text>
                <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 17, marginBottom: 14 }}>{tr.paywall_sub}</Text>
                <TouchableOpacity
                  onPress={function() { onActivateSubscription && onActivateSubscription(); }}
                  activeOpacity={0.85}
                  style={{ alignSelf: "stretch", height: 46, borderRadius: 23, backgroundColor: "#E5FF00", alignItems: "center", justifyContent: "center", marginBottom: 8 }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#000000", letterSpacing: 0.3 }}>{tr.paywall_start}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>{tr.paywall_per_month ? "CHF 9.90" + tr.paywall_per_month : ""}</Text>
                <TouchableOpacity onPress={function() { onActivateSubscription && onActivateSubscription(); }} activeOpacity={0.8}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#ffffff" }}>{tr.paywall_yearly_link}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          );
        })()}
        {mcTab === 'programmes' && (
          <View key="programmes">
            <TouchableOpacity onPress={function() { var p = piliers.find(function(x) { return x.key === 'p8'; }); if (p) setOpenPilier(p); }} activeOpacity={0.9} style={{ marginBottom: 20, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,206,209,0.5)' }}>
              <LinearGradient colors={['rgba(0,206,209,0.2)', 'rgba(0,18,38,0.8)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,206,209,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M4 18h16M6 18V10c0-1 1-2 2-2h8c1 0 2 1 2 2v8" stroke="#00CED1" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx="12" cy="5" r="3" stroke="#00CED1" strokeWidth={1.5} />
                    <Path d="M9 14h6" stroke="#00CED1" strokeWidth={1.4} strokeLinecap="round" />
                  </Svg>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: '#00CED1', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>{tr.pause_bureau_tag || 'Pause active'}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{tr.pause_bureau_title || '5 min au bureau'}</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{tr.pause_bureau_sub || '\u00C9tire-toi sans quitter ta chaise'}</Text>
                </View>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#00CED1', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#000' }}>{'\u25B6'}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#ffffff", marginBottom: 6 }}>{tr.prog_section_title}</Text>
            <Text style={{ fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.45)", lineHeight: 18, marginBottom: 14 }}>{tr.prog_section_sub}</Text>
            <View style={{ borderRadius: 16, overflow: "hidden", marginBottom: 20, height: 230, borderWidth: 1, borderColor: '#AEEF4D' }}>
              <LinearGradient colors={["#0a1628", "#0d3b66", "#1a8fa8"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ flex: 1, padding: 16, justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_debuter}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>{tr.prog_debuter_sub}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#ffffff", letterSpacing: 1 }}>{tr.prog_debuter_duree}</Text>
                </View>
                <TouchableOpacity
                  onPress={function() { var p = piliers.find(function(x) { return x.key === 'p1'; }); if (p) setOpenPilier(p); }}
                  activeOpacity={0.8}
                  style={{ alignSelf: "stretch", height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>{tr.prog_apercu}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#ffffff", marginBottom: 6 }}>{tr.prog_custom_title}</Text>
            <Text style={{ fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.45)", lineHeight: 18, marginBottom: 14 }}>{tr.prog_custom_sub}</Text>
            <View style={{ borderRadius: 16, overflow: "hidden", height: 230, borderWidth: 1, borderColor: '#AEEF4D' }}>
              <LinearGradient colors={["#1a0a2e", "#4a1a6b", "#8b3fa0"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ flex: 1, padding: 16, justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{tr.prog_custom_card}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.7)", lineHeight: 18 }}>{tr.prog_custom_card_sub}</Text>
                </View>
                <TouchableOpacity
                  onPress={function() { setShowCreateProg(true); }}
                  activeOpacity={0.8}
                  style={{ alignSelf: "stretch", height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#ffffff" }}>{tr.prog_custom_btn}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {savedPrograms.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 14 }}>{tr.prog_mes_programmes || 'Mes programmes'}</Text>
                {savedPrograms.map(function(prog, idx) {
                  var progPiliers = getPiliers(lang).filter(function(p) { return prog.piliers.includes(p.key); });
                  return (
                    <View key={idx} style={{ backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>{(tr.prog_custom_card || 'Programme') + ' ' + (idx + 1)}</Text>
                        <TouchableOpacity onPress={function() { deleteSavedProgram(idx); }} activeOpacity={0.7} style={{ padding: 4 }}>
                          <Text style={{ fontSize: 12, color: 'rgba(255,100,100,0.7)' }}>{'\u2715'}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {progPiliers.map(function(p) {
                          return (
                            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.1)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)' }}>
                              <View style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden' }}>
                                <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} />
                              </View>
                              <Text style={{ fontSize: 12, color: '#AEEF4D' }}>{p.label}</Text>
                            </View>
                          );
                        })}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 16 }}>
                        <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.6)' }}>{prog.duree} / {tr.resume_seances ? 's\u00E9ance' : 'session'}</Text>
                        <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.6)' }}>{prog.jours}x / {tr.prog_jours_label ? tr.prog_jours_label.toLowerCase() : 'semaine'}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
        {mcTab === 'explorer' && (function() {
          var seancesData = getSeances(lang);
          var cardH = Math.floor(SW * 0.45);
          return (
            <View key="explorer-sections">
              {piliers.map(function(p) {
                var ps = seancesData[p.key] || [];
                var doneCount = done[p.key] ? done[p.key].filter(Boolean).length : 0;
                return (
                  <TouchableOpacity
                    key={"exp-" + p.key}
                    activeOpacity={0.88}
                    onPress={function() { setOpenPilier(p); }}
                    style={{ marginBottom: 16, borderRadius: 16, overflow: "hidden", height: cardH }}
                  >
                    <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} imageStyle={p.key === 'p8' ? { top: -20 } : undefined}>
                      <LinearGradient colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.7)"]} style={{ flex: 1, justifyContent: "flex-end", padding: 16 }}>
                        <Text style={{ fontSize: 24, fontWeight: "800", color: "#ffffff", marginBottom: 4 }}>{p.label}</Text>
                        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>5 {tr.m_seances} {'\u00B7'} {tr.coming_soon_more || 'Plus \u00E0 venir'}</Text>
                      </LinearGradient>
                    </ImageBackground>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })()}
        {mcTab === 'recherche' && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
          {sortedPiliers.map(function(p) {
            return <PilierCard key={p.key} pilier={p} doneCount={done[p.key] ? done[p.key].filter(Boolean).length : 0} onPress={setOpenPilier} recommended={effectiveRecommended.includes(p.key)} lang={lang} />;
          })}
        </View>
        )}
      </ScrollView>
      {openPilier && (
        <PilierPanel pilier={openPilier} done={done[openPilier.key] || Array(20).fill(false)} onToggle={function(idx) { toggleDone(openPilier.key, idx); }} onClose={function() { setOpenPilier(null); }} lang={lang} isRecommended={effectiveRecommended.includes(openPilier.key)} isSubscriber={isSubscriber} onActivateSubscription={onActivateSubscription} sdjIndex={sdj && sdj.pilier && sdj.pilier.key === openPilier.key ? sdj.idx : null} saveHealthKitWorkout={saveHealthKitWorkout} />
      )}
      <CreateProgramScreen visible={showCreateProg} onClose={function() { setShowCreateProg(false); }} lang={lang} onSaved={loadSavedPrograms} />
    </View>
  );
}

const localStyles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoRow: { position: 'absolute', top: 58, left: 0, right: 0, zIndex: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 8, gap: 10 },
  logoWordmark: { fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 },
  metricShell: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  metricBlurInner: { padding: 10, alignItems: 'center', justifyContent: 'center', minHeight: 64 },
  metricWebFallback: { backgroundColor: 'rgba(255,255,255,0.14)' },
});

export default MonCorps;
export { MetricTile };
