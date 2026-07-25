import { useState, useEffect, useMemo, useRef } from 'react';
import { createChromeScrollHandler } from '../utils/chromeScroll';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Dimensions, StyleSheet, Animated, Easing,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Ellipse, Defs, LinearGradient as SvgLinearGradient, Stop, RadialGradient, G } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

import { T, ZONE_TO_PILIER, PILIER_IMAGES } from '../constants/data';
import { Bulle, BULLES, LivingMedusa, MEDUSA_STATES, MEDUSA_STATE_NAMES, getMeduseState } from '../components/Meduse';
import AnimatedPlus from '../components/AnimatedPlus';
import LivingBackground from '../components/LivingBackground';
import { getPiliers, getSeances } from '../utils';
import { Icon } from '../components/Icons';

// Activité HK (anneaux Move/Exercise/Stand, détails journaliers,
// tendances, streak rings-closed) → écran "Activité" dédié. Le présent
// écran "Résumé" reste centré sur la progression FluidBody : méduse,
// carte corporelle par pilier, séances complétées, streak séances.

const { width: SW } = Dimensions.get('window');

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
  var todayKey = today.toISOString().slice(0, 10);
  var days = [];
  for (var i = 27; i >= 0; i--) {
    var d = new Date(today); d.setDate(d.getDate() - i);
    var key = d.toISOString().slice(0, 10);
    days.push({ key: key, day: d.getDate(), dow: d.getDay(), count: history[key] || 0, isToday: key === todayKey });
  }
  var dayLabels = { fr: ['L','M','M','J','V','S','D'], en: ['M','T','W','T','F','S','S'] };
  var labels = dayLabels[lang] || dayLabels.fr;
  var gap = 6;
  var cellSize = Math.floor((SW - 80 - gap * 6) / 7);
  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 8, gap: gap }}>
        {labels.map(function(l, i) { return <Text key={i} style={{ fontSize: 9, fontWeight: '700', color: 'rgba(174,239,77,0.55)', width: cellSize, textAlign: 'center', letterSpacing: 0.5 }}>{l}</Text>; })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: gap }}>
        {days.map(function(d) {
          var bg, borderColor, borderWidth, textColor, dotColor, glow;
          if (d.count === 0) {
            bg = 'rgba(255,255,255,0.04)';
            borderColor = d.isToday ? '#AEEF4D' : 'rgba(255,255,255,0.10)';
            borderWidth = d.isToday ? 1.5 : 1;
            textColor = d.isToday ? '#AEEF4D' : 'rgba(255,255,255,0.35)';
            dotColor = null;
            glow = null;
          } else {
            var intensity = d.count >= 3 ? 1 : d.count === 2 ? 0.75 : 0.5;
            bg = 'rgba(174,239,77,' + intensity + ')';
            borderColor = 'rgba(255,255,255,0.45)';
            borderWidth = 1.5;
            textColor = '#001226';
            dotColor = d.count >= 2 ? '#001226' : null;
            glow = { shadowColor: '#AEEF4D', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } };
          }
          return (
            <View
              key={d.key}
              style={[{
                width: cellSize,
                height: cellSize,
                borderRadius: cellSize / 2,
                backgroundColor: bg,
                borderWidth: borderWidth,
                borderColor: borderColor,
                alignItems: 'center',
                justifyContent: 'center',
              }, glow]}
            >
              <Text style={{ fontSize: 11, color: textColor, fontWeight: d.count > 0 ? '800' : '500' }}>{d.day}</Text>
              {dotColor ? (
                <View style={{ position: 'absolute', bottom: 4, flexDirection: 'row', gap: 2 }}>
                  {Array.from({ length: Math.min(d.count, 3) }).map(function(_, k) { return <View key={k} style={{ width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: dotColor }} />; })}
                </View>
              ) : null}
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

// Hourglass feminine silhouette with clear anatomy: round head, defined neck,
// shoulders, narrow waist, fuller hips, and TWO distinct legs separated at
// the crotch. viewBox 100x280 — aligned with existing zone ellipse coordinates.
const SILHOUETTE_PATH = [
  // Head: top center, curves outward and down to neck
  'M 50 4',
  'C 65 4, 69 16, 68 25',
  'C 67 31, 62 35, 58 37',
  // Right neck taper into shoulder
  'L 58 40',
  'C 64 41, 71 44, 76 49',
  // Outer right shoulder line down to torso
  'L 78 60',
  'L 75 80',
  // Right torso narrowing into waist
  'L 68 112',
  // Hip flare (wider than waist for hourglass)
  'L 72 132',
  'L 78 144',
  // Right thigh outer
  'L 74 180',
  // Right knee → calf → ankle
  'L 68 232',
  'L 62 278',
  // Cross right foot bottom
  'L 54 278',
  // Up inner right leg (ankle → knee → thigh inner)
  'L 54 240',
  'L 53 168',
  // Crotch peak (right side of V)
  'L 50 150',
  // Crotch peak (left side of V)
  'L 49 150',
  // Down inner left thigh → knee → ankle
  'L 46 168',
  'L 45 240',
  'L 45 278',
  // Cross left foot bottom (outer side)
  'L 37 278',
  // Up left leg outer (calf → knee → thigh)
  'L 31 232',
  'L 25 180',
  // Left hip outer
  'L 21 144',
  'L 27 132',
  // Left waist narrowing
  'L 31 112',
  // Left torso up to armpit
  'L 24 80',
  'L 21 60',
  // Outer left shoulder curve up to neck
  'C 22 49, 29 44, 35 41',
  'L 41 40',
  // Left neck taper into head
  'L 41 37',
  'C 37 35, 32 31, 31 25',
  'C 30 16, 34 4, 50 4',
  'Z',
].join(' ');

// Anchor points — body landmarks for measurement / "active zone" indicators.
// Mapped onto the existing pilier zone keys so the pulse follows the same
// "this zone has activity" semantic the rest of the screen uses.
var BODY_ANCHORS = [
  { cx: 50, cy: 28,  r: 2.6, zone: 'p1' }, // cou
  { cx: 30, cy: 50,  r: 3.0, zone: 'p1' }, // épaule gauche
  { cx: 70, cy: 50,  r: 3.0, zone: 'p1' }, // épaule droite
  { cx: 20, cy: 95,  r: 2.2, zone: 'p1' }, // biceps gauche
  { cx: 80, cy: 95,  r: 2.2, zone: 'p1' }, // biceps droit
  { cx: 20, cy: 128, r: 2.2, zone: 'p1' }, // avant-bras gauche
  { cx: 80, cy: 128, r: 2.2, zone: 'p1' }, // avant-bras droit
  { cx: 50, cy: 76,  r: 2.6, zone: 'p2' }, // poitrine / torse
  { cx: 50, cy: 102, r: 2.6, zone: 'p4' }, // taille (core)
  { cx: 50, cy: 124, r: 2.6, zone: 'p3' }, // hanches
  { cx: 41, cy: 168, r: 2.4, zone: 'p3' }, // cuisse gauche
  { cx: 59, cy: 168, r: 2.4, zone: 'p3' }, // cuisse droite
  { cx: 39, cy: 222, r: 2.4, zone: 'p6' }, // mollet gauche
  { cx: 61, cy: 222, r: 2.4, zone: 'p6' }, // mollet droit
];

function BodyMapVisual({ done, lang }) {
  var piliers = getPiliers(lang);
  function zoneColor(key) {
    var count = Math.min((done[key] || []).filter(Boolean).length, 5);
    var p = count / 5;
    if (p === 0) return 'rgba(255,70,70,0.3)';
    if (p < 0.4) return 'rgba(255,140,60,0.45)';
    if (p < 0.8) return 'rgba(255,210,60,0.5)';
    if (p < 1) return 'rgba(174,239,77,0.55)';
    return 'rgba(174,239,77,0.8)';
  }
  function zonePct(key) { return (Math.min((done[key] || []).filter(Boolean).length, 5) / 5 * 100).toFixed(0); }
  var tr = T[lang] || T['fr'];

  // Shared pulse value (0→1→0) drives the glow halo on active anchor points.
  // Single Animated.Value + native driver keeps the per-anchor cost flat.
  var pulse = useRef(new Animated.Value(0)).current;
  useEffect(function() {
    var loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return function() { try { loop.stop(); pulse.removeAllListeners(); } catch (e) {} };
  }, []);
  var pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] });

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
        {/* Labels gauche */}
        <View style={{ width: 90, paddingTop: 30, paddingRight: 4, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p1') }} />
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p1'})||{}).label} {zonePct('p1')}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p2') }} />
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p2'})||{}).label} {zonePct('p2')}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p4') }} />
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p4'})||{}).label} {zonePct('p4')}%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p8') }} />
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{(piliers.find(function(x){return x.key==='p8'})||{}).label} {zonePct('p8')}%</Text>
          </View>
        </View>
        {/* Jellyfish-inspired SVG silhouette */}
        <View style={{ width: 110, height: 250, position: 'relative' }}>
          <Svg width={110} height={250} viewBox="0 0 100 280">
            <Defs>
              {/* Body gradient — turquoise to deep teal, with a hint of bioluminescent green near the head */}
              <SvgLinearGradient id="bodyFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#0a2540" stopOpacity="0.30" />
                <Stop offset="0.5" stopColor="#06203a" stopOpacity="0.42" />
                <Stop offset="1" stopColor="#031430" stopOpacity="0.52" />
              </SvgLinearGradient>
              {/* Outline stroke gradient — light cyan top to teal bottom */}
              <SvgLinearGradient id="bodyStroke" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="rgba(220,255,238,0.90)" />
                <Stop offset="0.5" stopColor="rgba(0,220,240,0.75)" />
                <Stop offset="1" stopColor="rgba(0,150,170,0.55)" />
              </SvgLinearGradient>
              {/* Glow halo behind the silhouette */}
              <RadialGradient id="bodyHalo" cx="0.5" cy="0.5" rx="0.55" ry="0.55">
                <Stop offset="0" stopColor="rgba(0,220,240,0.12)" />
                <Stop offset="1" stopColor="rgba(0,220,240,0)" />
              </RadialGradient>
            </Defs>

            {/* Body silhouette (filled + soft outline) */}
            <Path
              d={SILHOUETTE_PATH}
              fill="url(#bodyFill)"
              stroke="url(#bodyStroke)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />

            {/* Right arm — hangs naturally at body side, biceps to wrist */}
            <Path
              d="M 78 60 Q 82 70 83 90 Q 84 120 82 140 L 78 142 Q 76 130 75 100 Q 74 75 76 62 Z"
              fill="url(#bodyFill)"
              stroke="url(#bodyStroke)"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />

            {/* Left arm — mirror of right arm across center axis x=50 */}
            <Path
              d="M 22 60 Q 18 70 17 90 Q 16 120 18 140 L 22 142 Q 24 130 25 100 Q 26 75 24 62 Z"
              fill="url(#bodyFill)"
              stroke="url(#bodyStroke)"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />

            {/* Zone highlights — only piliers that map to a real anatomical zone.
                p5 (Respiration) and p7 (Mat Pilates) are abstract — no body overlay. */}
            <Ellipse cx="30" cy="50" rx="9" ry="5" fill={zoneColor('p1')} opacity={0.55} />
            <Ellipse cx="70" cy="50" rx="9" ry="5" fill={zoneColor('p1')} opacity={0.55} />
            <Ellipse cx="50" cy="72" rx="12" ry="14" fill={zoneColor('p2')} opacity={0.45} />
            <Ellipse cx="50" cy="100" rx="8" ry="12" fill={zoneColor('p4')} opacity={0.40} />
            <Ellipse cx="50" cy="124" rx="14" ry="9" fill={zoneColor('p3')} opacity={0.50} />
            <Ellipse cx="41" cy="168" rx="6" ry="22" fill={zoneColor('p3')} opacity={0.35} />
            <Ellipse cx="59" cy="168" rx="6" ry="22" fill={zoneColor('p3')} opacity={0.35} />
            <Ellipse cx="39" cy="222" rx="4" ry="16" fill={zoneColor('p6')} opacity={0.40} />
            <Ellipse cx="61" cy="222" rx="4" ry="16" fill={zoneColor('p6')} opacity={0.40} />

            {/* Anchor points — small luminous dots at body landmarks.
                Active zones (any done count > 0) get a soft pulsing halo. */}
            {BODY_ANCHORS.map(function(a, i) {
              var isActive = ((done[a.zone] || []).filter(Boolean).length) > 0;
              return (
                <G key={'anc-' + i}>
                  {isActive ? (
                    <AnimatedCircle
                      cx={a.cx}
                      cy={a.cy}
                      r={a.r + 2.8}
                      fill="rgba(174,239,77,0.35)"
                      opacity={pulseOpacity}
                    />
                  ) : null}
                  <Circle
                    cx={a.cx}
                    cy={a.cy}
                    r={a.r}
                    fill={isActive ? '#AEEF4D' : 'rgba(220,240,255,0.55)'}
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth="0.4"
                  />
                </G>
              );
            })}
          </Svg>
        </View>
        {/* Labels droite */}
        <View style={{ width: 90, paddingTop: 30, paddingLeft: 4, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p3')}% {(piliers.find(function(x){return x.key==='p3'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p3') }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p5')}% {(piliers.find(function(x){return x.key==='p5'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p5') }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 18, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p6')}% {(piliers.find(function(x){return x.key==='p6'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p6') }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{zonePct('p7')}% {(piliers.find(function(x){return x.key==='p7'})||{}).label}</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: zoneColor('p7') }} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,70,70,0.4)' }} />
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{tr.body_neglected || 'À travailler'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,210,60,0.6)' }} />
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{tr.body_progress || 'En progrès'}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#AEEF4D' }} />
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Maîtrisé</Text>
        </View>
      </View>
    </View>
  );
}

// ══════════════════════════════════
// STREAK PROTECTOR
// ══════════════════════════════════


// ══════════════════════════════════
// WEEKLY SUMMARY CARD
// ══════════════════════════════════
// Streak is shown in the all-time stats card below — keep this block
// strictly week-scoped (sessions + minutes over the last 7 days) so the
// two cards answer different questions.
function WeeklySummary({ lang }) {
  var [weekSessions, setWeekSessions] = useState(0);
  var [weekMinutes, setWeekMinutes] = useState(0);
  var tr = T[lang] || T['fr'];

  useEffect(function() {
    async function load() {
      var today = new Date();
      var sessions = 0;
      var minutes = 0;
      try {
        var cal = await AsyncStorage.getItem('fluid_activity_calendar');
        var parsed = cal ? JSON.parse(cal) : {};
        for (var i = 0; i < 7; i++) {
          var d = new Date(today);
          d.setDate(d.getDate() - i);
          var key = d.toISOString().split('T')[0];
          if (parsed[key]) sessions += parsed[key];
          var mins = await AsyncStorage.getItem('fluid_exercise_' + key);
          if (mins) minutes += parseInt(mins) || 0;
        }
      } catch(e) {}
      setWeekSessions(sessions);
      setWeekMinutes(minutes);
    }
    load();
  }, []);

  return (
    <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.4)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(174,239,77,0.15)' }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.weekly_summary || 'Cette semaine'}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff' }}>{weekSessions}</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{tr.weekly_sessions_label || 'Séances'}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff' }}>{weekMinutes}'</Text>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{tr.weekly_minutes_label || 'Minutes'}</Text>
        </View>
      </View>
    </View>
  );
}

function ResumeScreen({ done, lang, streak, prenom, tensionIdxs, supaUser, onCreateAccount, onOpenStatistics }) {
  var tr = T[lang] || T['fr'];
  // chromeScroll : masque la barre d'onglets au scroll vers le bas.
  var onChromeScroll = useRef(createChromeScrollHandler()).current;
  var piliers = getPiliers(lang);
  var [meduseName, setMeduseName] = useState('');
  var [showNameInput, setShowNameInput] = useState(false);
  var [nameInput, setNameInput] = useState('');
  useEffect(function() {
    AsyncStorage.getItem('fluid_meduse_name').then(function(n) { setMeduseName(n || ''); setNameInput(''); setShowNameInput(false); });
  }, [done]);
  function saveMeduseName() {
    var name = nameInput.trim();
    if (!name) return;
    setMeduseName(name);
    setShowNameInput(false);
    AsyncStorage.setItem('fluid_meduse_name', name);
  }
  // PERF (2026-07-23) : totalDone / recentSeances / sortedPiliers étaient
  // recalculés à chaque render — mémoïsés sur leurs vraies dépendances.
  var totalDone = useMemo(function() { return Object.values(done).flat().filter(Boolean).length; }, [done]);
  var totalDoneCapped = Math.min(totalDone, 40);
  var pct = Math.round(totalDoneCapped / 40 * 100);
  var recommendedPiliers = useMemo(function() { return (tensionIdxs || []).map(function(i) { return ZONE_TO_PILIER[i]; }); }, [tensionIdxs]);

  var now = new Date();
  var dayNames = { fr: ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'], en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], es: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'], it: ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'] };
  var monthNames = { fr: ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'], en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], es: ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sep.','oct.','nov.','dic.'], it: ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'] };
  var dn = (dayNames[lang] || dayNames.fr)[now.getDay()];
  var mn = (monthNames[lang] || monthNames.fr)[now.getMonth()];
  var dateStr = dn + ' ' + now.getDate() + ' ' + mn;

  var recentSeances = useMemo(function() {
    var rs = [];
    piliers.forEach(function(p) {
      var d = done[p.key];
      if (d) d.forEach(function(v, i) { if (v === true || v === 'true') rs.push({ pilier: p, idx: i }); });
    });
    return rs.slice(-5).reverse();
  }, [done, lang]);

  var sortedPiliers = useMemo(function() {
    return [].concat(piliers).sort(function(a, b) { return (recommendedPiliers.includes(a.key) ? 0 : 1) - (recommendedPiliers.includes(b.key) ? 0 : 1); });
  }, [lang, recommendedPiliers]);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }} scrollEventThrottle={16} showsVerticalScrollIndicator={false} onScroll={onChromeScroll}>
        <View style={{ paddingTop: 62, paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: 34 }}>+</AnimatedPlus></Text>
              <Text style={{ fontSize: 10, color: 'rgba(174,239,77,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{dateStr}</Text>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#000000' }}>{prenom ? prenom.slice(0, 2).toUpperCase() : 'YT'}</Text>
            </View>
          </View>
        </View>

        <WeeklySummary lang={lang} />

        {onOpenStatistics ? (
          <TouchableOpacity
            onPress={onOpenStatistics}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={tr.stats_a11y_open || 'Ouvrir les statistiques avancées'}
            style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.25)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(174,239,77,0.14)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M4 20V12" stroke="#AEEF4D" strokeWidth={1.8} strokeLinecap="round" />
                <Path d="M10 20V8" stroke="#AEEF4D" strokeWidth={1.8} strokeLinecap="round" />
                <Path d="M16 20V4" stroke="#AEEF4D" strokeWidth={1.8} strokeLinecap="round" />
                <Path d="M3 20h17" stroke="#AEEF4D" strokeWidth={1.5} strokeLinecap="round" />
              </Svg>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>{tr.stats_open_btn || 'Voir mes statistiques avancées'}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{tr.stats_subtitle || 'Ta progression dans le temps'}</Text>
            </View>
            <Text style={{ fontSize: 18, color: 'rgba(174,239,77,0.7)', fontWeight: '300' }}>{'›'}</Text>
          </TouchableOpacity>
        ) : null}

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
                <View style={{ alignItems: 'center', marginTop: 14 }}>
                  <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 10, lineHeight: 18 }}>{tr.meduse_name_hint || 'Ta m\u00E9duse \u00E9volue avec toi.\nDonne-lui un nom pour la personnaliser !'}</Text>
                  <TouchableOpacity onPress={function() { setShowNameInput(true); }} activeOpacity={0.85} style={{ paddingVertical: 8, paddingHorizontal: 20, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#AEEF4D' }}>{tr.meduse_name_btn || 'Donne-lui un nom'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {showNameInput && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, alignSelf: 'stretch' }}>
                  <TextInput value={nameInput} onChangeText={setNameInput} accessibilityLabel={tr.a11y_jellyfish_name_input || 'Nom de ta méduse'} placeholder={tr.meduse_name_ph || 'Nom de ta méduse'} placeholderTextColor="rgba(174,239,77,0.3)" autoFocus style={{ flex: 1, height: 40, backgroundColor: 'rgba(0,18,32,0.6)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, color: '#ffffff', fontSize: 14, paddingHorizontal: 12 }} />
                  <TouchableOpacity onPress={saveMeduseName} style={{ height: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#000000' }}>OK</Text>
                  </TouchableOpacity>
                </View>
              )}
              {meduseName && (
                <TouchableOpacity onPress={function() { setShowNameInput(true); setNameInput(meduseName); }} activeOpacity={0.7} style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{tr.meduse_rename || 'Renommer'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.resume_total || 'Au total'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 }}>
          <View style={[localStyles.statCard, { flex: 1 }]}>
            <Text style={{ fontSize: 28, fontWeight: '200', color: '#AEEF4D' }}>{totalDone}</Text>
            <Text style={[localStyles.statLbl, { color: 'rgba(174,239,77,0.6)' }]}>{tr.m_seances}</Text>
          </View>
          <View style={[localStyles.statCard, { flex: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="flame" size={22} color="#AEEF4D" />
              <Text style={{ fontSize: 28, fontWeight: '200', color: '#AEEF4D' }}>{streak > 0 ? streak : 0}</Text>
            </View>
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
              <Icon name="flame" size={24} color="#FFB43C" />
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
                <Text style={{ fontSize: 11, color: 'rgba(174,239,77,0.5)', marginTop: 2 }}>{weekDone >= weekGoal ? (tr.weekly_done || 'Objectif atteint !') : (tr.weekly_remaining || (weekGoal - weekDone) + ' séance(s) restante(s)')}</Text>
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
                  <ExpoImage source={PILIER_IMAGES[s.pilier.key]} contentFit="cover" cachePolicy="memory-disk" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#ffffff' }}>{s.pilier.label}</Text>
                  <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.4)' }}>{'Séance ' + (s.idx + 1)}</Text>
                </View>
                <Icon name="check" size={14} color="#AEEF4D" strokeWidth={2.2} />
              </View>
            );
          })}
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 12, padding: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.par_pilier}</Text>
          {sortedPiliers.map(function(p, idx) {
            var count = Math.min((done[p.key] || []).filter(function(v) { return v === true || v === 'true'; }).length, 5);
            var pct2 = Math.round(count / 5 * 100);
            var isRec = recommendedPiliers.includes(p.key);
            return (
              <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: idx < sortedPiliers.length - 1 ? 0.5 : 0, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', marginRight: 12, borderWidth: 1.5, borderColor: '#AEEF4D' }}>
                  <ExpoImage source={PILIER_IMAGES[p.key]} contentFit="cover" cachePolicy="memory-disk" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#ffffff' }}>{p.label}{isRec ? ' \u2605' : ''}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                    <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(174,239,77,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                      <View style={{ height: 4, width: pct2 + '%', backgroundColor: '#AEEF4D', borderRadius: 2 }} />
                    </View>
                    <Text style={{ fontSize: 11, color: '#AEEF4D', width: 38 }}>{count}/5</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#AEEF4D', marginLeft: 8 }}>{pct2 + '%'}</Text>
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
