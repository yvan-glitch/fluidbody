import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Animated, Easing, Dimensions, ImageBackground, Platform, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { T, ZONE_TO_PILIER, PILIER_IMAGES } from '../constants/data';
import { Bulle, FloatingMedusas, BULLES, LivingMedusa, MEDUSA_STATES, MEDUSA_STATE_NAMES, getMeduseState } from '../components/Meduse';
import { getPiliers, getSeances } from '../utils';

// HealthKit — optional native module
let AppleHealthKit = null;
let hkInitialized = false;
try { AppleHealthKit = require('react-native-health').default; } catch(e) {}

const HK_PERMISSIONS = AppleHealthKit ? {
  permissions: {
    read: [
      AppleHealthKit.Constants?.Permissions?.ActiveEnergyBurned,
      AppleHealthKit.Constants?.Permissions?.AppleExerciseTime,
      AppleHealthKit.Constants?.Permissions?.AppleStandTime,
    ].filter(Boolean),
  },
} : null;

function initHealthKit() {
  if (!AppleHealthKit || hkInitialized || Platform.OS !== 'ios') return;
  AppleHealthKit.initHealthKit(HK_PERMISSIONS, function(err) {
    if (err) { if (__DEV__) console.log('HealthKit init error:', err); return; }
    hkInitialized = true;
  });
}

// Try to init on load
initHealthKit();

function getHealthKitSummary(cb) {
  if (!AppleHealthKit || !hkInitialized || Platform.OS !== 'ios') { cb({ cal: 0, exMin: 0, standHr: 0 }); return; }
  var now = new Date();
  var startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  var opts = { startDate: startOfDay, endDate: now.toISOString() };
  var result = { cal: 0, exMin: 0, standHr: 0 };
  var remaining = 3;
  function done() { remaining--; if (remaining <= 0) cb(result); }
  try {
    AppleHealthKit.getActiveEnergyBurned(opts, function(err, res) { if (!err && res && res.length) { result.cal = Math.round(res.reduce(function(s, r) { return s + (r.value || 0); }, 0)); } done(); });
  } catch(e) { done(); }
  try {
    AppleHealthKit.getAppleExerciseTime(opts, function(err, res) { if (!err && res && res.length) { result.exMin = Math.round(res.reduce(function(s, r) { return s + (r.value || 0); }, 0)); } done(); });
  } catch(e) { done(); }
  try {
    AppleHealthKit.getAppleStandTime(opts, function(err, res) { if (!err && res && res.length) { result.standHr = Math.round(res.reduce(function(s, r) { return s + (r.value || 0); }, 0) / 60); } done(); });
  } catch(e) { done(); }
}

const { width: SW } = Dimensions.get('window');

var AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ══════════════════════════════════
// ACTIVITY RING
// ══════════════════════════════════
function ActivityRing({ radius, strokeWidth, progress, color, bgColor }) {
  var circ = 2 * Math.PI * radius;
  var anim = useRef(new Animated.Value(0)).current;
  useEffect(function() { Animated.timing(anim, { toValue: Math.min(progress, 1), duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [progress]);
  var dashOffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });
  var size = (radius + strokeWidth) * 2;
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Circle cx={radius + strokeWidth} cy={radius + strokeWidth} r={radius} stroke={bgColor || 'rgba(255,255,255,0.08)'} strokeWidth={strokeWidth} fill="none" />
      <AnimatedCircle cx={radius + strokeWidth} cy={radius + strokeWidth} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dashOffset} transform={'rotate(-90 ' + (radius + strokeWidth) + ' ' + (radius + strokeWidth) + ')'} />
    </Svg>
  );
}

// ══════════════════════════════════
// CALENDRIER HEATMAP + RECOMMANDATION
// ══════════════════════════════════
function ActivityCalendar({ lang }) {
  var [history, setHistory] = useState({});
  useEffect(function() {
    AsyncStorage.getItem('fluid_activity_calendar').then(function(raw) {
      if (raw) try { setHistory(JSON.parse(raw)); } catch(e) {}
    });
  }, []);
  var today = new Date();
  var days = [];
  for (var i = 27; i >= 0; i--) {
    var d = new Date(today); d.setDate(d.getDate() - i);
    var key = d.toISOString().slice(0, 10);
    days.push({ key: key, day: d.getDate(), dow: d.getDay(), count: history[key] || 0 });
  }
  var dayLabels = { fr: ['L','M','M','J','V','S','D'], en: ['M','T','W','T','F','S','S'] };
  var labels = dayLabels[lang] || dayLabels.fr;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        {labels.map(function(l, i) { return <Text key={i} style={{ fontSize: 8, color: 'rgba(174,239,77,0.4)', width: Math.floor((SW - 80) / 7), textAlign: 'center' }}>{l}</Text>; })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
        {days.map(function(d) {
          var intensity = d.count === 0 ? 0 : d.count === 1 ? 0.3 : d.count === 2 ? 0.6 : 1;
          return (
            <View key={d.key} style={{ width: Math.floor((SW - 80 - 18) / 7), height: Math.floor((SW - 80 - 18) / 7), borderRadius: 4, backgroundColor: d.count > 0 ? ('rgba(174,239,77,' + intensity + ')') : 'rgba(174,239,77,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 7, color: d.count > 0 ? '#000000' : 'rgba(255,255,255,0.2)', fontWeight: d.count > 0 ? '700' : '400' }}>{d.day}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ══════════════════════════════════
// BILAN CORPOREL VISUEL
// ══════════════════════════════════
var BODY_ZONES = [
  { key: 'p1', label: 'Épaules', path: 'M38 28L32 34L30 42L34 42L38 36L42 36L46 42L50 42L48 34L42 28Z', cx: 40, cy: 35 },
  { key: 'p2', label: 'Dos', path: 'M36 42L34 60L38 60L40 48L42 48L44 60L48 60L46 42Z', cx: 40, cy: 50 },
  { key: 'p3', label: 'Mobilité', path: 'M34 60L30 78L36 78L38 68L42 68L44 78L50 78L46 60Z', cx: 40, cy: 70 },
  { key: 'p4', label: 'Posture', path: 'M38 42L36 48L38 48L40 45L42 48L44 48L42 42Z', cx: 40, cy: 45 },
  { key: 'p8', label: 'Office', path: 'M36 48L34 56L38 56L40 52L42 56L46 56L44 48Z', cx: 40, cy: 52 },
];

function BodyMapVisual({ done, lang }) {
  var piliers = getPiliers(lang);
  function zoneColor(key) {
    var count = (done[key] || []).filter(Boolean).length;
    var p = count / 20;
    if (p === 0) return 'rgba(255,70,70,0.3)';
    if (p < 0.25) return 'rgba(255,140,60,0.45)';
    if (p < 0.5) return 'rgba(255,210,60,0.5)';
    if (p < 0.75) return 'rgba(174,239,77,0.55)';
    return 'rgba(174,239,77,0.8)';
  }
  function zonePct(key) { return ((done[key] || []).filter(Boolean).length / 20 * 100).toFixed(0); }
  var tr = T[lang] || T['fr'];
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 0 }}>
        {/* Labels gauche */}
        <View style={{ width: 65, paddingTop: 30, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p1') }} />
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p1'})||{}).label} {zonePct('p1')}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p2') }} />
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p2'})||{}).label} {zonePct('p2')}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p4') }} />
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p4'})||{}).label} {zonePct('p4')}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p8') }} />
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p8'})||{}).label} {zonePct('p8')}%</Text>
          </View>
        </View>
        {/* Mannequin image + zones colorées */}
        <View style={{ width: 110, height: 250, position: 'relative' }}>
          <ImageBackground source={require('../../assets/mannequin.png')} resizeMode="contain" style={{ width: 110, height: 250, opacity: 0.6 }} imageStyle={{ tintColor: '#AEEF4D' }} />
          {/* Zones colorées superposées */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Svg width={110} height={250} viewBox="0 0 100 280">
          {/* Zones colorées sur le mannequin */}
          {/* Épaules p1 */}
          <Ellipse cx="34" cy="46" rx="10" ry="6" fill={zoneColor('p1')} opacity={0.6} />
          <Ellipse cx="66" cy="46" rx="10" ry="6" fill={zoneColor('p1')} opacity={0.6} />
          {/* Torse p2 */}
          <Ellipse cx="50" cy="68" rx="14" ry="16" fill={zoneColor('p2')} opacity={0.5} />
          {/* Core p4 */}
          <Ellipse cx="50" cy="95" rx="10" ry="14" fill={zoneColor('p4')} opacity={0.45} />
          {/* Obliques p5 */}
          <Ellipse cx="36" cy="82" rx="5" ry="12" fill={zoneColor('p5')} opacity={0.35} />
          <Ellipse cx="64" cy="82" rx="5" ry="12" fill={zoneColor('p5')} opacity={0.35} />
          {/* Bras p7 */}
          <Ellipse cx="24" cy="80" rx="5" ry="18" fill={zoneColor('p7')} opacity={0.45} />
          <Ellipse cx="76" cy="80" rx="5" ry="18" fill={zoneColor('p7')} opacity={0.45} />
          {/* Avant-bras p8 */}
          <Ellipse cx="22" cy="115" rx="4" ry="14" fill={zoneColor('p8')} opacity={0.35} />
          <Ellipse cx="78" cy="115" rx="4" ry="14" fill={zoneColor('p8')} opacity={0.35} />
          {/* Hanches p3 */}
          <Ellipse cx="50" cy="118" rx="16" ry="10" fill={zoneColor('p3')} opacity={0.5} />
          {/* Cuisses p3 */}
          <Ellipse cx="40" cy="160" rx="7" ry="24" fill={zoneColor('p3')} opacity={0.4} />
          <Ellipse cx="60" cy="160" rx="7" ry="24" fill={zoneColor('p3')} opacity={0.4} />
          {/* Mollets p6 */}
          <Ellipse cx="38" cy="215" rx="5" ry="18" fill={zoneColor('p6')} opacity={0.4} />
          <Ellipse cx="62" cy="215" rx="5" ry="18" fill={zoneColor('p6')} opacity={0.4} />
        </Svg>
          </View>
        </View>
        {/* Labels droite */}
        <View style={{ width: 65, paddingTop: 30, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p3')}% {(piliers.find(function(x){return x.key==='p3'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p3') }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p5')}% {(piliers.find(function(x){return x.key==='p5'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p5') }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p6')}% {(piliers.find(function(x){return x.key==='p6'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p6') }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p7')}% {(piliers.find(function(x){return x.key==='p7'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p7') }} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,70,70,0.4)' }} />
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{tr.body_neglected || 'À travailler'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,210,60,0.6)' }} />
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{tr.body_progress || 'En progrès'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#AEEF4D' }} />
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Maîtrisé</Text>
        </View>
      </View>
    </View>
  );
}

// ══════════════════════════════════
// STREAK PROTECTOR
// ══════════════════════════════════
function getStreakStatus(streak, lastStreakDate) {
  if (!lastStreakDate) return 'none';
  var today = new Date().toDateString();
  var yesterday = new Date(Date.now() - 86400000).toDateString();
  if (lastStreakDate === today) return 'safe';
  if (lastStreakDate === yesterday) return 'at_risk';
  return 'lost';
}

function getSmartRecommendation(done, tensionIdxs, lang) {
  var piliers = getPiliers(lang);
  var seances = getSeances(lang);
  var best = null; var bestScore = -1;
  piliers.forEach(function(p) {
    var d = done[p.key] || [];
    var nextIdx = d.findIndex(function(v) { return !v; });
    if (nextIdx === -1) return;
    var isRecommended = (tensionIdxs || []).some(function(ti) { return ZONE_TO_PILIER[ti] === p.key; });
    var doneCount = d.filter(Boolean).length;
    var score = (isRecommended ? 50 : 0) + (20 - doneCount) + (nextIdx < 5 ? 10 : 0);
    if (score > bestScore) { bestScore = score; best = { pilier: p, idx: nextIdx, seance: (seances[p.key] || [])[nextIdx] }; }
  });
  return best;
}

function ResumeScreen({ done, lang, streak, prenom, tensionIdxs, supaUser, onCreateAccount }) {
  var tr = T[lang] || T['fr'];
  var piliers = getPiliers(lang);
  var [meduseName, setMeduseName] = useState('');
  var [showNameInput, setShowNameInput] = useState(false);
  var [nameInput, setNameInput] = useState('');
  useEffect(function() {
    AsyncStorage.getItem('fluid_meduse_name').then(function(n) { if (n) setMeduseName(n); });
  }, []);
  function saveMeduseName() {
    var name = nameInput.trim();
    if (!name) return;
    setMeduseName(name);
    setShowNameInput(false);
    AsyncStorage.setItem('fluid_meduse_name', name);
  }
  var totalDone = Object.values(done).flat().filter(Boolean).length;
  var pct = Math.round(totalDone / 160 * 100);
  var recommendedPiliers = (tensionIdxs || []).map(function(i) { return ZONE_TO_PILIER[i]; });
  var [hkData, setHkData] = useState({ cal: 0, exMin: 0, standHr: 0 });
  var [localExMin, setLocalExMin] = useState(0);

  useEffect(function() {
    function refresh() {
      getHealthKitSummary(function(data) { setHkData(data); });
      var key = 'fluid_exercise_' + new Date().toISOString().slice(0, 10);
      AsyncStorage.getItem(key).then(function(raw) { if (raw) setLocalExMin(parseInt(raw) || 0); });
    }
    refresh();
    var interval = setInterval(refresh, 60000);
    return function() { clearInterval(interval); };
  }, []);

  var now = new Date();
  var dayNames = { fr: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'], en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], es: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'], it: ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'] };
  var monthNames = { fr: ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'], en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], es: ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sep.','oct.','nov.','dic.'], it: ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'] };
  var dn = (dayNames[lang] || dayNames.fr)[now.getDay()];
  var mn = (monthNames[lang] || monthNames.fr)[now.getMonth()];
  var dateStr = dn + ' ' + now.getDate() + ' ' + mn;

  var calGoal = 400; var exGoal = 30; var standGoal = 12;
  var effectiveExMin = Math.max(hkData.exMin, localExMin);
  var effectiveCal = Math.max(hkData.cal, localExMin * 5);
  var calPct = effectiveCal / calGoal; var exPct = effectiveExMin / exGoal; var standPct = hkData.standHr / standGoal;

  var recentSeances = [];
  piliers.forEach(function(p) {
    var d = done[p.key];
    if (d) d.forEach(function(v, i) { if (v === true || v === 'true') recentSeances.push({ pilier: p, idx: i }); });
  });
  recentSeances = recentSeances.slice(-5).reverse();

  var sortedPiliers = [].concat(piliers).sort(function(a, b) { return (recommendedPiliers.includes(a.key) ? 0 : 1) - (recommendedPiliers.includes(b.key) ? 0 : 1); });

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} scrollEventThrottle={16} showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 62, paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 34 }}>+</Text></Text>
              <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{dateStr}</Text>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#000000' }}>{prenom ? prenom.slice(0, 2).toUpperCase() : 'YT'}</Text>
            </View>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 18 }}>{tr.resume_activite || 'Activité'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityRing radius={60} strokeWidth={8} progress={calPct} color="#FF3B30" bgColor="rgba(255,59,48,0.2)" />
              <ActivityRing radius={48} strokeWidth={8} progress={exPct} color="#30D158" bgColor="rgba(48,209,88,0.2)" />
              <ActivityRing radius={36} strokeWidth={8} progress={standPct} color="#0A84FF" bgColor="rgba(10,132,255,0.2)" />
            </View>
            <View style={{ flex: 1, marginLeft: 20, gap: 14 }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' }} />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{tr.resume_bouger || 'Bouger'}</Text>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#FF3B30', marginTop: 2 }}>{effectiveCal}<Text style={{ fontSize: 13, fontWeight: '400' }}>/{calGoal} cal</Text></Text>
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#30D158' }} />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{tr.resume_exercice || 'Exercice'}</Text>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#30D158', marginTop: 2 }}>{effectiveExMin}<Text style={{ fontSize: 13, fontWeight: '400' }}>/{exGoal} min</Text></Text>
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0A84FF' }} />
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{tr.resume_debout || 'Debout'}</Text>
                </View>
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#0A84FF', marginTop: 2 }}>{hkData.standHr}<Text style={{ fontSize: 13, fontWeight: '400' }}>/{standGoal} h</Text></Text>
              </View>
            </View>
          </View>
        </View>

        {(function() {
          var stIdx = getMeduseState(pct, streak);
          var ms = MEDUSA_STATES[stIdx];
          var names = MEDUSA_STATE_NAMES[lang] || MEDUSA_STATE_NAMES.fr;
          var score = Math.min(100, pct * 0.7 + Math.min(streak || 0, 14) * 2);
          var nextState = stIdx < MEDUSA_STATES.length - 1 ? MEDUSA_STATES[stIdx + 1] : null;
          var progressToNext = nextState ? Math.min(1, (score - ms.min) / (nextState.min - ms.min)) : 1;
          var motivTexts = {
            fr: ['Fais 3 séances pour l\'éveiller !', 'Continue pour la rendre active !', 'Elle brille de plus en plus !', 'Presque rayonnante, encore un effort !', 'Maîtrise totale atteinte !'],
            en: ['Do 3 sessions to awaken her!', 'Keep going to make her active!', 'She shines more and more!', 'Almost radiant, one more push!', 'Total mastery achieved!'],
            de: ['Mache 3 Sitzungen, um sie zu wecken!', 'Weiter so, um sie aktiv zu machen!', 'Sie strahlt immer mehr!', 'Fast strahlend, noch eine Anstrengung!', 'Totale Meisterschaft erreicht!'],
            pt: ['Faça 3 sessões para despertá-la!', 'Continue para torná-la ativa!', 'Ela brilha cada vez mais!', 'Quase radiante, mais um esforço!', 'Domínio total alcançado!'],
            zh: ['做3节课来唤醒她！', '继续让她变得活跃！', '她越来越闪耀！', '快要闪耀了，再加油！', '完全掌握！'],
            ja: ['3セッションで目覚めさせよう！', '続けてアクティブに！', 'どんどん輝いている！', 'もう少しで輝く！', '完全制覇！'],
            ko: ['3세션으로 깨우세요!', '계속하면 활동적이 됩니다!', '점점 빛나고 있어요!', '거의 빛나요, 조금만 더!', '완전 정복!'],
            es: ['¡Haz 3 sesiones para despertarla!', '¡Sigue para activarla!', '¡Brilla cada vez más!', '¡Casi radiante, un esfuerzo más!', '¡Dominio total!'],
            it: ['Fai 3 sessioni per svegliarla!', 'Continua per renderla attiva!', 'Brilla sempre di più!', 'Quasi radiante, ancora uno sforzo!', 'Padronanza totale!'],
          };
          var motiv = (motivTexts[lang] || motivTexts.fr)[stIdx];
          return (
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, alignSelf: 'flex-start' }}>{meduseName || (tr.meduse_card_title || 'Ta méduse')}</Text>
              <LivingMedusa pct={pct} streak={streak} lang={lang} showLabel={false} />
              {meduseName ? (
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff', marginTop: 14 }}>{meduseName}</Text>
              ) : null}
              <Text style={{ fontSize: 14, fontWeight: '600', color: ms.color.replace('1)', '0.9)'), marginTop: meduseName ? 4 : 14 }}>{names[stIdx]}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, alignSelf: 'stretch' }}>
                <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(174,239,77,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ height: 4, width: (progressToNext * 100) + '%', backgroundColor: ms.color, borderRadius: 2 }} />
                </View>
                {nextState && <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{names[stIdx + 1]}</Text>}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '300', color: 'rgba(255,255,255,0.5)', marginTop: 10, textAlign: 'center', fontStyle: 'italic' }}>{motiv}</Text>
              {!meduseName && !showNameInput && (
                <TouchableOpacity onPress={function() { setShowNameInput(true); }} activeOpacity={0.85} style={{ marginTop: 14, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#AEEF4D' }}>{tr.meduse_name_btn || 'Donne-lui un nom'}</Text>
                </TouchableOpacity>
              )}
              {showNameInput && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, alignSelf: 'stretch' }}>
                  <TextInput value={nameInput} onChangeText={setNameInput} placeholder={tr.meduse_name_ph || 'Nom de ta méduse'} placeholderTextColor="rgba(174,239,77,0.3)" autoFocus style={{ flex: 1, height: 40, backgroundColor: 'rgba(0,18,32,0.6)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, color: '#ffffff', fontSize: 14, paddingHorizontal: 12 }} />
                  <TouchableOpacity onPress={saveMeduseName} style={{ height: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#000000' }}>OK</Text>
                  </TouchableOpacity>
                </View>
              )}
              {meduseName && (
                <TouchableOpacity onPress={function() { setShowNameInput(true); setNameInput(meduseName); }} activeOpacity={0.7} style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{tr.meduse_rename || 'Renommer'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 }}>
          <View style={[localStyles.statCard, { flex: 1 }]}>
            <Text style={{ fontSize: 28, fontWeight: '200', color: '#AEEF4D' }}>{totalDone}</Text>
            <Text style={[localStyles.statLbl, { color: 'rgba(174,239,77,0.6)' }]}>{tr.m_seances}</Text>
          </View>
          <View style={[localStyles.statCard, { flex: 1 }]}>
            <Text style={{ fontSize: 28, fontWeight: '200', color: '#AEEF4D' }}>{'🔥'} {streak > 0 ? streak : 0}</Text>
            <Text style={[localStyles.statLbl, { color: 'rgba(174,239,77,0.6)' }]}>{tr.resume_streak || 'Streak'}</Text>
          </View>
          <View style={[localStyles.statCard, { flex: 1 }]}>
            <Text style={{ fontSize: 28, fontWeight: '200', color: '#AEEF4D' }}>{pct}%</Text>
            <Text style={[localStyles.statLbl, { color: 'rgba(174,239,77,0.6)' }]}>{tr.resume_global || 'Global'}</Text>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, alignSelf: 'flex-start' }}>{tr.body_map_title || 'Bilan corporel'}</Text>
          <BodyMapVisual done={done} lang={lang} />
        </View>

        {(function() {
          var streakStatus = 'safe';
          if (streak > 0) {
            var allDoneToday = Object.values(done).flat().filter(Boolean).length;
          }
          var atRisk = streak > 0 && totalDone > 0;
          return atRisk && streak >= 2 ? (
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(255,150,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,180,60,0.4)', borderRadius: 12, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 24 }}>🔥</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFB43C' }}>{tr.streak_protect_title || 'Protège ton streak !'}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,180,60,0.6)', marginTop: 2 }}>{tr.streak_protect_sub || 'Fais une micro-séance de 2 min pour ne pas perdre tes ' + streak + ' jours'}</Text>
              </View>
            </View>
          ) : null;
        })()}

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.calendar_title || 'Activité récente'}</Text>
          <ActivityCalendar lang={lang} />
        </View>

        {(function() {
          var rec = getSmartRecommendation(done, tensionIdxs, lang);
          if (!rec || !rec.seance) return null;
          return (
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
                <View style={{ width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 14 }}>
                  <ImageBackground source={PILIER_IMAGES[rec.pilier.key]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>{tr.recommended_next || 'Recommandée pour toi'}</Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{rec.seance[0]}</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{rec.pilier.label} · {rec.seance[1]}</Text>
                </View>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#000000' }}>▶</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {(function() {
          var weekGoal = 3;
          var now = new Date();
          var startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() + 1);
          var weekDone = 0;
          for (var d = 0; d < 7; d++) {
            var day = new Date(startOfWeek); day.setDate(startOfWeek.getDate() + d);
            var key = day.toISOString().slice(0, 10);
          }
          var allDone = Object.values(done).flat();
          weekDone = Math.min(totalDone, weekGoal);
          var weekPct = Math.min(1, weekDone / weekGoal);
          return (
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={50} height={50} viewBox="0 0 50 50">
                  <Circle cx="25" cy="25" r="20" stroke="rgba(174,239,77,0.12)" strokeWidth={4} fill="none" />
                  <Circle cx="25" cy="25" r="20" stroke="#AEEF4D" strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={2 * Math.PI * 20} strokeDashoffset={2 * Math.PI * 20 * (1 - weekPct)} transform="rotate(-90 25 25)" />
                </Svg>
                <Text style={{ position: 'absolute', fontSize: 14, fontWeight: '800', color: '#AEEF4D' }}>{weekDone}/{weekGoal}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>{tr.weekly_goal || 'Objectif semaine'}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.5)', marginTop: 2 }}>{weekDone >= weekGoal ? (tr.weekly_done || 'Objectif atteint ! 🎉') : (tr.weekly_remaining || (weekGoal - weekDone) + ' séance(s) restante(s)')}</Text>
              </View>
            </View>
          );
        })()}

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.resume_seances || 'Séances FluidBody'}</Text>
          {recentSeances.length === 0 && (
            <Text style={{ fontSize: 14, color: 'rgba(174,239,77,0.4)', fontStyle: 'italic' }}>{tr.resume_no_seance || 'Aucune séance complétée'}</Text>
          )}
          {recentSeances.map(function(s, i) {
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < recentSeances.length - 1 ? 0.5 : 0, borderBottomColor: 'rgba(174,239,77,0.12)' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginRight: 12, borderWidth: 1.5, borderColor: '#AEEF4D' }}>
                  <ImageBackground source={PILIER_IMAGES[s.pilier.key]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#ffffff' }}>{s.pilier.label}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.4)' }}>{'Séance ' + (s.idx + 1)}</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#AEEF4D' }}>✓</Text>
              </View>
            );
          })}
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.par_pilier}</Text>
          {sortedPiliers.map(function(p, idx) {
            var count = done[p.key].filter(function(v) { return v === true || v === 'true'; }).length;
            var pct2 = Math.round(count / 20 * 100);
            var isRec = recommendedPiliers.includes(p.key);
            return (
              <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: idx < sortedPiliers.length - 1 ? 0.5 : 0, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginRight: 12, borderWidth: 1.5, borderColor: '#AEEF4D' }}>
                  <ImageBackground source={PILIER_IMAGES[p.key]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#ffffff' }}>{p.label}{isRec ? ' ★' : ''}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                    <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(174,239,77,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: 4, width: pct2 + '%', backgroundColor: '#AEEF4D', borderRadius: 2 }} />
                    </View>
                    <Text style={{ fontSize: 11, color: '#AEEF4D', width: 38 }}>{count}/20</Text>
                  </View>
                </View>
                <Text style={{ fontSize: pct2 === 0 ? 13 : 16, fontWeight: '600', color: pct2 === 0 ? '#00BDD0' : '#AEEF4D', marginLeft: 8 }}>{pct2 === 0 ? (tr.cest_parti || "C'est parti ! 🌊") : pct2 + '%'}</Text>
              </View>
            );
          })}
        </View>

        {!supaUser && totalDone >= 3 && (
          <TouchableOpacity onPress={function() { if (onCreateAccount) onCreateAccount(); }} activeOpacity={0.85} style={{ marginHorizontal: 20, marginTop: 14, backgroundColor: 'rgba(174,239,77,0.08)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <Path d="M6 18.5c-2.2 0-4-1.6-4-3.5 0-1.6 1.1-3 2.7-3.4C5.1 8.5 7.8 6 11 6c2.7 0 5 1.7 5.8 4.1C19.1 10.3 21 12 21 14.2c0 2.4-2 4.3-4.5 4.3H6z" stroke="#AEEF4D" strokeWidth={1.6} strokeLinejoin="round" />
                <Path d="M12 13v5M10 16l2 2 2-2" stroke="#AEEF4D" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.save_progress_title || 'Sauvegarde ta progression'}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.5)', marginTop: 2 }}>{tr.save_progress_sub || 'Crée un compte gratuit pour ne rien perdre'}</Text>
            </View>
            <Text style={{ fontSize: 16, color: 'rgba(174,239,77,0.4)' }}>›</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

var localStyles = StyleSheet.create({
  statCard: { flex: 1, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 14, alignItems: 'center' },
  statLbl: { fontSize: 9, fontWeight: '200', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(174,239,77,0.6)' },
});

export default ResumeScreen;
