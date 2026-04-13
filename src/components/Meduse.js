import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Dimensions, View, Text } from 'react-native';
import Svg, { Path, Circle, Ellipse, G, Defs, RadialGradient, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');
const IS_IPAD = SW >= 768;

// ── tentaclePath ──
function tentaclePath(bx, by, angle, length, t, phase, amp) {
  const N = 12;
  const cos = Math.cos(angle); const sin = Math.sin(angle);
  const px = -sin; const py = cos;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const dist = s * length;
    const wave = Math.sin(s * Math.PI * 4 - t * 2.5 + phase) * amp * Math.pow(s, 0.5);
    pts.push([bx + cos * dist + px * wave, by + sin * dist + py * wave]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = i > 1 ? pts[i - 2] : pts[0];
    const p1 = pts[i - 1]; const p2 = pts[i];
    const p3 = i < pts.length - 1 ? pts[i + 1] : p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) * 0.25; const cp1y = p1[1] + (p2[1] - p0[1]) * 0.25;
    const cp2x = p2[0] - (p3[0] - p1[0]) * 0.25; const cp2y = p2[1] - (p3[1] - p1[1]) * 0.25;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// ── TENTS2 ──
const TENTS2 = [
  { sx:42,  sy:122, angle:Math.PI*0.560, len:300, phase:0.0, amp:16, color:'rgba(220,228,255,0.55)', w:0.9 },
  { sx:68,  sy:135, angle:Math.PI*0.535, len:350, phase:1.4, amp:20, color:'rgba(215,225,255,0.50)', w:0.75},
  { sx:95,  sy:143, angle:Math.PI*0.518, len:320, phase:2.7, amp:18, color:'rgba(225,232,255,0.50)', w:0.80},
  { sx:118, sy:148, angle:Math.PI*0.508, len:400, phase:0.8, amp:26, color:'rgba(218,226,255,0.42)', w:0.62},
  { sx:140, sy:151, angle:Math.PI*0.500, len:440, phase:2.1, amp:30, color:'rgba(220,228,255,0.38)', w:0.55},
  { sx:162, sy:148, angle:Math.PI*0.492, len:400, phase:1.2, amp:26, color:'rgba(218,226,255,0.42)', w:0.62},
  { sx:185, sy:143, angle:Math.PI*0.482, len:320, phase:0.4, amp:18, color:'rgba(225,232,255,0.50)', w:0.80},
  { sx:212, sy:135, angle:Math.PI*0.465, len:350, phase:3.1, amp:20, color:'rgba(215,225,255,0.50)', w:0.75},
  { sx:238, sy:122, angle:Math.PI*0.440, len:300, phase:1.9, amp:16, color:'rgba(220,228,255,0.55)', w:0.9 },
  { sx:82,  sy:140, angle:Math.PI*0.525, len:470, phase:1.0, amp:36, color:'rgba(210,220,255,0.28)', w:0.48},
  { sx:198, sy:140, angle:Math.PI*0.475, len:450, phase:2.5, amp:32, color:'rgba(210,220,255,0.28)', w:0.48},
  { sx:55,  sy:128, angle:Math.PI*0.548, len:260, phase:3.5, amp:14, color:'rgba(222,230,255,0.45)', w:0.70},
  { sx:225, sy:128, angle:Math.PI*0.452, len:260, phase:0.7, amp:14, color:'rgba(222,230,255,0.45)', w:0.70},
];

// ── BULLE_DEPART_SOUS_BORD ──
/** Bulles ancrées en bas ; translateY positif = sous le bord, puis montée jusqu'en hors écran. */
const BULLE_DEPART_SOUS_BORD = 72;

// ── Bulle ──
function Bulle({ delay, x, size, duration, colorIndex }) {
  const a = useRef(new Animated.Value(0)).current;
  const isWhite = (colorIndex != null ? colorIndex : Math.round(x)) % 2 === 1;
  useEffect(() => { setTimeout(() => { Animated.loop(Animated.timing(a, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })).start(); }, delay); }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: x,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.2,
        borderColor: isWhite ? 'rgba(255,255,255,0.5)' : 'rgba(0,189,208,0.5)',
        backgroundColor: isWhite ? 'rgba(255,255,255,0.3)' : 'rgba(0,189,208,0.3)',
        opacity: a.interpolate({ inputRange: [0, 0.04, 0.12, 0.86, 1], outputRange: [0.45, 1, 1, 0.55, 0] }),
        transform: [{
          translateY: a.interpolate({
            inputRange: [0, 1],
            outputRange: [BULLE_DEPART_SOUS_BORD, -(SH + 120)],
          }),
        }],
      }}
    />
  );
}

// ── Rayon ──
function Rayon({ left, width, delay, duration, opacity }) {
  const a = useRef(new Animated.Value(opacity * 0.5)).current;
  useEffect(() => { setTimeout(() => { Animated.loop(Animated.sequence([Animated.timing(a, { toValue: opacity, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(a, { toValue: opacity * 0.2, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true })])).start(); }, delay); }, []);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left, width, bottom: 0, backgroundColor: 'rgba(0,255,255,0.12)', opacity: a, transform: [{ skewX: '-5deg' }] }} />;
}

// ── Meduse ──
function Meduse() {
  const anim  = useRef(new Animated.Value(0)).current;
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
    const id = setInterval(() => { tickRef.current += 0.026; setTick(tickRef.current); }, 36);
    return () => clearInterval(id);
  }, []);

  const N = 20;
  const pts = Array.from({ length: N + 1 }, (_, i) => i / N);
  const bellScale = anim.interpolate({
    inputRange:  pts,
    outputRange: pts.map(t => 1.0 + (IS_IPAD ? 0.22 : 0.11) * Math.sin(Math.PI * t)),
  });
  const floatY = anim.interpolate({
    inputRange:  pts,
    outputRange: pts.map(t => -18 * Math.sin(Math.PI * t)),
  });

  const tentPaths = TENTS2.map(t => tentaclePath(t.sx, t.sy, t.angle, t.len, tick, t.phase, t.amp));

  return (
    <Animated.View style={{ transform: [{ translateY: floatY }], alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ scale: bellScale }] }}>
        <Svg width={260} height={460} viewBox="0 0 280 520" overflow="visible">
          {tentPaths.map((d, i) => (
            <Path key={i} d={d} stroke={TENTS2[i].color} strokeWidth={TENTS2[i].w} fill="none" strokeLinecap="round" />
          ))}
          <Defs>
            <RadialGradient id="bellGrad" cx="50%" cy="28%" rx="55%" ry="60%" fx="48%" fy="22%">
              <Stop offset="0%"   stopColor="#ffffff" stopOpacity="0.75" />
              <Stop offset="20%"  stopColor="#f8faff" stopOpacity="0.58" />
              <Stop offset="45%"  stopColor="#f0f4ff" stopOpacity="0.40" />
              <Stop offset="70%"  stopColor="#e4ecff" stopOpacity="0.22" />
              <Stop offset="88%"  stopColor="#d8e4ff" stopOpacity="0.10" />
              <Stop offset="100%" stopColor="#c8d8f8" stopOpacity="0.04" />
            </RadialGradient>
            <RadialGradient id="topGlow" cx="40%" cy="20%" rx="42%" ry="35%">
              <Stop offset="0%"   stopColor="#ffffff" stopOpacity="0.45" />
              <Stop offset="50%"  stopColor="#f8f8ff" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.00" />
            </RadialGradient>
          </Defs>
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(220,230,255,0.15)" strokeWidth="18" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(230,235,255,0.20)" strokeWidth="10" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(240,242,255,0.30)" strokeWidth="5" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(255,255,255,0.90)" strokeWidth="1.5" />
          <Path d="M 55 62 C 75 28 115 10 160 14 C 190 17 215 32 232 55" fill="none" stroke="rgba(255,255,255,0.70)" strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M 62 58 C 82 26 118 9 158 13" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="rgba(240,245,255,0.28)" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#bellGrad)" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#topGlow)" />
          <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2" />
          <Path d="M 140 105 Q 108 88 78  98"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 115 78 100 52"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 132 68 130 38"  stroke="rgba(205,218,255,0.22)" strokeWidth="1.2" fill="none"/>
          <Path d="M 140 105 Q 140 66 140 36"  stroke="rgba(210,220,255,0.26)" strokeWidth="1.4" fill="none"/>
          <Path d="M 140 105 Q 148 68 150 38"  stroke="rgba(205,218,255,0.22)" strokeWidth="1.2" fill="none"/>
          <Path d="M 140 105 Q 165 78 180 52"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 172 88 202 98"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 95  95  68 108"  stroke="rgba(200,212,255,0.20)" strokeWidth="1.1" fill="none"/>
          <Path d="M 140 105 Q 185 95 212 108"  stroke="rgba(200,212,255,0.20)" strokeWidth="1.1" fill="none"/>
          <Path d="M 46 122 Q 62 136 80 132 Q 96 142 112 138 Q 126 144 140 144 Q 154 144 168 138 Q 184 142 200 132 Q 218 136 234 122" stroke="rgba(220,228,255,0.50)" strokeWidth="1.8" fill="none" />
          <Path d="M 58 126 Q 68 134 78 130 Q 88 138 100 134 Q 112 142 124 138 Q 132 144 140 143 Q 148 144 156 138 Q 168 142 180 134 Q 192 138 202 130 Q 212 134 222 126" stroke="rgba(228,235,255,0.35)" strokeWidth="1.2" fill="none" />
          <Path d="M 140 148 C 134 160 126 172 122 186 C 118 198 124 208 130 218 C 124 228 118 240 122 254 C 118 264 112 274 115 288" stroke="rgba(200,210,255,0.65)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          <Path d="M 140 148 C 146 160 154 172 158 186 C 162 198 156 208 150 218 C 156 228 162 240 158 254 C 162 264 168 274 165 288" stroke="rgba(200,210,255,0.65)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          <Path d="M 140 148 C 140 164 138 178 136 192 C 134 204 138 215 140 225 C 142 215 146 204 144 192 C 142 178 140 164 140 148" stroke="rgba(210,218,255,0.58)" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
          <Circle cx="96"  cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
          <Circle cx="184" cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
          <Circle cx="68"  cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
          <Circle cx="212" cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
          <Circle cx="140" cy="28" r="2.8" fill="rgba(240,250,255,0.95)" />
          <Circle cx="120" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
          <Circle cx="160" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

// ── MEDUSE_CORNER_BLUE & blueMeduse ──
/** Même SVG animé que `Meduse`, teinte #00B4D8 — option `breathCycleMs` : respiration 1 → 1,08 → 1. */
const MEDUSE_CORNER_BLUE = '#00B4D8';
function blueMeduse(a) {
  return `rgba(0,180,216,${a})`;
}

// ── MeduseCornerIcon ──
function MeduseCornerIcon({ size = 50, breathCycleMs = null, breathMaxScale = 1.08, tint = null }) {
  const anim = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(1)).current;
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  const { bellScale, floatY } = useMemo(() => {
    const N = 20;
    const pts = Array.from({ length: N + 1 }, (_, i) => i / N);
    const amp = IS_IPAD ? 0.14 : 0.12;
    const floatAmp = IS_IPAD ? 12 : 10;
    return {
      bellScale: anim.interpolate({
        inputRange: pts,
        outputRange: pts.map((t) => 1.0 + amp * Math.sin(Math.PI * t)),
      }),
      floatY: anim.interpolate({
        inputRange: pts,
        outputRange: pts.map((t) => -floatAmp * Math.sin(Math.PI * t)),
      }),
    };
  }, [anim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    const id = setInterval(() => {
      tickRef.current += 0.026;
      setTick(tickRef.current);
    }, 36);
    return () => {
      loop.stop();
      clearInterval(id);
    };
  }, [anim]);

  useEffect(() => {
    if (!breathCycleMs) return;
    breath.setValue(1);
    const half = breathCycleMs / 2;
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: breathMaxScale, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 1.0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    breathLoop.start();
    return () => breathLoop.stop();
  }, [breathCycleMs, breath, breathMaxScale]);

  const tentPaths = TENTS2.map(t => tentaclePath(t.sx, t.sy, t.angle, t.len, tick, t.phase, t.amp));
  var mc = tint ? function(a) { return tint.replace('1)', a + ')').replace('rgb(', 'rgba('); } : blueMeduse;
  var mcSolid = tint || MEDUSE_CORNER_BLUE;

  return (
    <Animated.View style={{ width: size, height: size, overflow: 'visible', transform: [{ translateY: floatY }], alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ scale: breathCycleMs ? breath : bellScale }] }}>
        <Svg width={size} height={size} viewBox="0 0 280 520" preserveAspectRatio="xMidYMid meet" overflow="visible">
          {/* Tentacules fines et ondulantes */}
          {tentPaths.map((d, i) => (
            <Path key={i} d={d} stroke={mc(0.18 + (i % 5) * 0.04)} strokeWidth={TENTS2[i].w * 0.7} fill="none" strokeLinecap="round" />
          ))}
          {/* Tentacules centraux organiques */}
          <Path d="M 140 155 C 136 175 130 200 126 230 C 122 260 128 280 132 310 C 128 330 122 360 125 390" stroke={mc(0.25)} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <Path d="M 140 155 C 144 175 150 200 154 230 C 158 260 152 280 148 310 C 152 330 158 360 155 390" stroke={mc(0.25)} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <Path d="M 140 155 C 140 180 138 210 136 245 C 134 275 140 300 140 330 C 140 355 138 380 140 410" stroke={mc(0.2)} strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <Path d="M 120 150 C 115 180 108 215 102 250 C 96 285 100 310 105 345" stroke={mc(0.15)} strokeWidth="1.0" fill="none" strokeLinecap="round" />
          <Path d="M 160 150 C 165 180 172 215 178 250 C 184 285 180 310 175 345" stroke={mc(0.15)} strokeWidth="1.0" fill="none" strokeLinecap="round" />
          <Path d="M 100 145 C 92 175 82 210 78 250 C 74 280 80 305 85 330" stroke={mc(0.12)} strokeWidth="0.8" fill="none" strokeLinecap="round" />
          <Path d="M 180 145 C 188 175 198 210 202 250 C 206 280 200 305 195 330" stroke={mc(0.12)} strokeWidth="0.8" fill="none" strokeLinecap="round" />
          <Defs>
            {/* Dégradé principal de la cloche — plus translucide */}
            <RadialGradient id="cBellMain" cx="50%" cy="30%" rx="55%" ry="58%" fx="45%" fy="25%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
              <Stop offset="15%" stopColor="#f0f8ff" stopOpacity="0.6" />
              <Stop offset="35%" stopColor={mcSolid} stopOpacity="0.35" />
              <Stop offset="60%" stopColor={mcSolid} stopOpacity="0.18" />
              <Stop offset="85%" stopColor={mcSolid} stopOpacity="0.08" />
              <Stop offset="100%" stopColor={mcSolid} stopOpacity="0.02" />
            </RadialGradient>
            {/* Reflet lumineux en haut */}
            <RadialGradient id="cTopGlow" cx="38%" cy="18%" rx="30%" ry="25%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
              <Stop offset="50%" stopColor="#ffffff" stopOpacity="0.2" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </RadialGradient>
            {/* Organes internes */}
            <RadialGradient id="cOrgan" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={mcSolid} stopOpacity="0.5" />
              <Stop offset="70%" stopColor={mcSolid} stopOpacity="0.2" />
              <Stop offset="100%" stopColor={mcSolid} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {/* Halo externe doux */}
          <Ellipse cx="140" cy="90" rx="120" ry="80" fill={mc(0.04)} />
          {/* Cloche — contour externe flou */}
          <Path d="M 38 120 C 26 68 58 15 140 10 C 222 15 254 68 242 120 C 234 142 208 154 186 150 C 170 157 155 160 140 160 C 125 160 110 157 94 150 C 72 154 46 142 38 120 Z" fill="none" stroke={mc(0.12)} strokeWidth="16" />
          {/* Cloche — contour moyen */}
          <Path d="M 38 120 C 26 68 58 15 140 10 C 222 15 254 68 242 120 C 234 142 208 154 186 150 C 170 157 155 160 140 160 C 125 160 110 157 94 150 C 72 154 46 142 38 120 Z" fill="none" stroke={mc(0.22)} strokeWidth="6" />
          {/* Cloche — remplissage translucide */}
          <Path d="M 38 120 C 26 68 58 15 140 10 C 222 15 254 68 242 120 C 234 142 208 154 186 150 C 170 157 155 160 140 160 C 125 160 110 157 94 150 C 72 154 46 142 38 120 Z" fill="url(#cBellMain)" />
          {/* Reflet lumineux */}
          <Path d="M 38 120 C 26 68 58 15 140 10 C 222 15 254 68 242 120 C 234 142 208 154 186 150 C 170 157 155 160 140 160 C 125 160 110 157 94 150 C 72 154 46 142 38 120 Z" fill="url(#cTopGlow)" />
          {/* Contour fin */}
          <Path d="M 38 120 C 26 68 58 15 140 10 C 222 15 254 68 242 120 C 234 142 208 154 186 150 C 170 157 155 160 140 160 C 125 160 110 157 94 150 C 72 154 46 142 38 120 Z" fill="none" stroke={mc(0.45)} strokeWidth="1.2" />
          {/* Reflet arc en haut */}
          <Path d="M 60 60 C 80 28 115 12 155 14 C 185 16 210 30 228 52" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M 68 56 C 85 30 115 15 148 16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" strokeLinecap="round" />
          {/* Organes internes — canaux radiaux */}
          <Path d="M 140 108 Q 110 90 82 100" stroke={mc(0.2)} strokeWidth="1.2" fill="none" />
          <Path d="M 140 108 Q 118 80 105 55" stroke={mc(0.18)} strokeWidth="1.0" fill="none" />
          <Path d="M 140 108 Q 135 70 132 40" stroke={mc(0.15)} strokeWidth="0.9" fill="none" />
          <Path d="M 140 108 Q 140 68 140 38" stroke={mc(0.2)} strokeWidth="1.2" fill="none" />
          <Path d="M 140 108 Q 145 70 148 40" stroke={mc(0.15)} strokeWidth="0.9" fill="none" />
          <Path d="M 140 108 Q 162 80 175 55" stroke={mc(0.18)} strokeWidth="1.0" fill="none" />
          <Path d="M 140 108 Q 170 90 198 100" stroke={mc(0.2)} strokeWidth="1.2" fill="none" />
          {/* Organe central (estomac) */}
          <Ellipse cx="140" cy="100" rx="18" ry="14" fill="url(#cOrgan)" />
          <Ellipse cx="140" cy="100" rx="10" ry="8" fill={mc(0.2)} />
          {/* Bord festonné — plus organique */}
          <Path d="M 48 124 Q 60 138 78 133 Q 92 143 108 139 Q 122 146 140 146 Q 158 146 172 139 Q 188 143 202 133 Q 220 138 232 124" stroke={mc(0.35)} strokeWidth="1.6" fill="none" />
          <Path d="M 55 128 Q 65 136 76 132 Q 86 140 98 136 Q 110 144 122 140 Q 132 146 140 145 Q 148 146 158 140 Q 170 144 182 136 Q 194 140 204 132 Q 215 136 225 128" stroke={mc(0.25)} strokeWidth="1.0" fill="none" />
          {/* Points lumineux — gonades */}
          <Circle cx="100" cy="62" r="2.5" fill={mc(0.7)} />
          <Circle cx="180" cy="62" r="2.5" fill={mc(0.7)} />
          <Circle cx="74" cy="96" r="2.0" fill={mc(0.5)} />
          <Circle cx="206" cy="96" r="2.0" fill={mc(0.5)} />
          {/* Reflet sommet */}
          <Circle cx="140" cy="26" r="3.5" fill="rgba(255,255,255,0.8)" />
          <Circle cx="122" cy="24" r="1.8" fill="rgba(255,255,255,0.5)" />
          <Circle cx="158" cy="24" r="1.8" fill="rgba(255,255,255,0.5)" />
          {/* Petits points bioluminescents */}
          <Circle cx="110" cy="42" r="1.2" fill="rgba(255,255,255,0.4)" />
          <Circle cx="170" cy="42" r="1.2" fill="rgba(255,255,255,0.4)" />
          <Circle cx="90" cy="78" r="1.0" fill="rgba(255,255,255,0.3)" />
          <Circle cx="190" cy="78" r="1.0" fill="rgba(255,255,255,0.3)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

// ── VideoPlaceholderMeduse ──
/** Placeholder séance sans vidéo Bunny : méduse SVG + flottement vertical (Animated). */
function VideoPlaceholderMeduse({ size }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [float]);
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [8, -16] });
  const tick = 0;
  const tentPaths = TENTS2.map(t => tentaclePath(t.sx, t.sy, t.angle, t.len, tick, t.phase, t.amp));
  const w = size;
  const h = size * (460 / 260);
  return (
    <Animated.View style={{ transform: [{ translateY: floatY }], alignItems: 'center' }}>
      <Svg width={w} height={h} viewBox="0 0 280 520" overflow="visible">
        {tentPaths.map((d, i) => (
          <Path key={i} d={d} stroke={TENTS2[i].color} strokeWidth={TENTS2[i].w} fill="none" strokeLinecap="round" />
        ))}
        <Defs>
          <RadialGradient id="ph_bellGrad" cx="50%" cy="28%" rx="55%" ry="60%" fx="48%" fy="22%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
            <Stop offset="20%" stopColor="#f8faff" stopOpacity="0.58" />
            <Stop offset="45%" stopColor="#f0f4ff" stopOpacity="0.40" />
            <Stop offset="70%" stopColor="#e4ecff" stopOpacity="0.22" />
            <Stop offset="88%" stopColor="#d8e4ff" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#c8d8f8" stopOpacity="0.04" />
          </RadialGradient>
          <RadialGradient id="ph_topGlow" cx="40%" cy="20%" rx="42%" ry="35%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <Stop offset="50%" stopColor="#f8f8ff" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(220,230,255,0.15)" strokeWidth="18" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(230,235,255,0.20)" strokeWidth="10" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(240,242,255,0.30)" strokeWidth="5" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(255,255,255,0.90)" strokeWidth="1.5" />
        <Path d="M 55 62 C 75 28 115 10 160 14 C 190 17 215 32 232 55" fill="none" stroke="rgba(255,255,255,0.70)" strokeWidth="2.5" strokeLinecap="round" />
        <Path d="M 62 58 C 82 26 118 9 158 13" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="rgba(240,245,255,0.28)" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#ph_bellGrad)" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="url(#ph_topGlow)" />
        <Path d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.2" />
        <Path d="M 140 105 Q 108 88 78  98" stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none" />
        <Path d="M 140 105 Q 115 78 100 52" stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none" />
        <Path d="M 140 105 Q 132 68 130 38" stroke="rgba(205,218,255,0.22)" strokeWidth="1.2" fill="none" />
        <Path d="M 140 105 Q 140 66 140 36" stroke="rgba(210,220,255,0.26)" strokeWidth="1.4" fill="none" />
        <Path d="M 140 105 Q 148 68 150 38" stroke="rgba(205,218,255,0.22)" strokeWidth="1.2" fill="none" />
        <Path d="M 140 105 Q 165 78 180 52" stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none" />
        <Path d="M 140 105 Q 172 88 202 98" stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none" />
        <Path d="M 140 105 Q 95  95  68 108" stroke="rgba(200,212,255,0.20)" strokeWidth="1.1" fill="none" />
        <Path d="M 140 105 Q 185 95 212 108" stroke="rgba(200,212,255,0.20)" strokeWidth="1.1" fill="none" />
        <Path d="M 46 122 Q 62 136 80 132 Q 96 142 112 138 Q 126 144 140 144 Q 154 144 168 138 Q 184 142 200 132 Q 218 136 234 122" stroke="rgba(220,228,255,0.50)" strokeWidth="1.8" fill="none" />
        <Path d="M 58 126 Q 68 134 78 130 Q 88 138 100 134 Q 112 142 124 138 Q 132 144 140 143 Q 148 144 156 138 Q 168 142 180 134 Q 192 138 202 130 Q 212 134 222 126" stroke="rgba(228,235,255,0.35)" strokeWidth="1.2" fill="none" />
        <Path d="M 140 148 C 134 160 126 172 122 186 C 118 198 124 208 130 218 C 124 228 118 240 122 254 C 118 264 112 274 115 288" stroke="rgba(200,210,255,0.65)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <Path d="M 140 148 C 146 160 154 172 158 186 C 162 198 156 208 150 218 C 156 228 162 240 158 254 C 162 264 168 274 165 288" stroke="rgba(200,210,255,0.65)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <Path d="M 140 148 C 140 164 138 178 136 192 C 134 204 138 215 140 225 C 142 215 146 204 144 192 C 142 178 140 164 140 148" stroke="rgba(210,218,255,0.58)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <Circle cx="96" cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
        <Circle cx="184" cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
        <Circle cx="68" cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
        <Circle cx="212" cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
        <Circle cx="140" cy="28" r="2.8" fill="rgba(240,250,255,0.95)" />
        <Circle cx="120" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
        <Circle cx="160" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
      </Svg>
    </Animated.View>
  );
}

// ── BULLES ──
const BULLES = [
  { x: 337, size: 2, delay: 409,   duration: 11506 },
  { x: 135, size: 3, delay: 2286,  duration: 8679  },
  { x: 356, size: 5, delay: 1424,  duration: 13912 },
  { x: 26,  size: 2, delay: 1535,  duration: 10582 },
  { x: 129, size: 5, delay: 9863,  duration: 7434  },
  { x: 297, size: 3, delay: 11731, duration: 15928 },
  { x: 224, size: 3, delay: 7359,  duration: 11557 },
  { x: 13,  size: 3, delay: 11438, duration: 13924 },
  { x: 184, size: 3, delay: 2547,  duration: 10527 },
  { x: 182, size: 2, delay: 1519,  duration: 13224 },
  { x: 59,  size: 4, delay: 5635,  duration: 11333 },
  { x: 32,  size: 5, delay: 8785,  duration: 9045  },
  { x: 203, size: 2, delay: 9044,  duration: 11803 },
  { x: 331, size: 6, delay: 5925,  duration: 10150 },
  { x: 370, size: 2, delay: 750,   duration: 10733 },
  { x: 158, size: 2, delay: 3814,  duration: 8654  },
  { x: 204, size: 3, delay: 7428,  duration: 12977 },
  { x: 93,  size: 4, delay: 5820,  duration: 10432 },
  { x: 353, size: 3, delay: 11498, duration: 8169  },
  { x: 321, size: 7, delay: 2803,  duration: 15751 },
  { x: 135, size: 3, delay: 7573,  duration: 13216 },
  { x: 148, size: 7, delay: 11274, duration: 10598 },
  { x: 360, size: 4, delay: 916,   duration: 10752 },
  { x: 26,  size: 4, delay: 6572,  duration: 11386 },
  { x: 43,  size: 3, delay: 9292,  duration: 12155 },
  { x: 118, size: 7, delay: 8179,  duration: 13482 },
  { x: 339, size: 5, delay: 2340,  duration: 11339 },
  { x: 81,  size: 3, delay: 9197,  duration: 15830 },
  { x: 144, size: 6, delay: 7019,  duration: 13543 },
  { x: 195, size: 3, delay: 2266,  duration: 15348 },
  { x: 262, size: 2, delay: 771,   duration: 8796  },
];

// ── BULLES_MONCORPS ──
/** Moins dense qu'avant : 24 bulles x 3 décalages (les autres écrans gardent `BULLES` complet). */
const BULLES_MONCORPS_BASE = BULLES.slice(0, 10);
const BULLES_MONCORPS = [
  ...BULLES_MONCORPS_BASE,
];

// ── BULLES_ONBOARDING ──
/** Onboarding : quelques vagues décalées + bulles en plus (moins dense que la version max). */
const BULLES_ONBOARDING = BULLES.slice(0, 12);

// ══════════════════════════════════
// MÉDUSE VIVANTE — évolue avec la progression
// ══════════════════════════════════
var MEDUSA_STATES = [
  { name: 'dormante', nameEn: 'dormant', min: 0, color: 'rgba(200,210,230,1)', opacity: 0.35, size: 60, breath: 8000, glowR: 0, particles: 0 },
  { name: 'éveillée', nameEn: 'awakened', min: 11, color: 'rgba(0,189,208,1)', opacity: 0.6, size: 75, breath: 5000, glowR: 0, particles: 0 },
  { name: 'active', nameEn: 'active', min: 31, color: 'rgba(0,220,240,1)', opacity: 0.8, size: 90, breath: 3000, glowR: 30, particles: 3 },
  { name: 'rayonnante', nameEn: 'radiant', min: 61, color: 'rgba(174,239,77,1)', opacity: 0.9, size: 105, breath: 2000, glowR: 50, particles: 5 },
  { name: 'légendaire', nameEn: 'legendary', min: 91, color: 'rgba(255,215,0,1)', opacity: 1, size: 120, breath: 1500, glowR: 70, particles: 8 },
];

var MEDUSA_STATE_NAMES = {
  fr: ['Dormante', 'Éveillée', 'Active', 'Rayonnante', 'Légendaire'],
  en: ['Dormant', 'Awakened', 'Active', 'Radiant', 'Legendary'],
  de: ['Schlafend', 'Erwacht', 'Aktiv', 'Strahlend', 'Legendär'],
  pt: ['Adormecida', 'Desperta', 'Ativa', 'Radiante', 'Lendária'],
  zh: ['沉睡', '觉醒', '活跃', '闪耀', '传奇'],
  ja: ['眠り', '覚醒', '活動', '輝き', '伝説'],
  ko: ['잠든', '깨어난', '활동적', '빛나는', '전설적'],
  es: ['Dormida', 'Despierta', 'Activa', 'Radiante', 'Legendaria'],
  it: ['Dormiente', 'Risvegliata', 'Attiva', 'Radiante', 'Leggendaria'],
};

function getMeduseState(pct, streak) {
  var score = Math.min(100, pct * 0.7 + Math.min(streak, 14) * 2);
  for (var i = MEDUSA_STATES.length - 1; i >= 0; i--) {
    if (score >= MEDUSA_STATES[i].min) return i;
  }
  return 0;
}

// ── LivingMedusa ──
function LivingMedusa({ pct, streak, lang, showLabel }) {
  var stateIdx = getMeduseState(pct, streak || 0);
  var ms = MEDUSA_STATES[stateIdx];
  var names = MEDUSA_STATE_NAMES[lang] || MEDUSA_STATE_NAMES.fr;
  var floatAnim = useRef(new Animated.Value(0)).current;
  var glowAnim = useRef(new Animated.Value(0)).current;
  var [particles, setParticles] = useState([]);

  useEffect(function() {
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: ms.breath, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(floatAnim, { toValue: 0, duration: ms.breath, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ])).start();
    if (ms.glowR > 0) {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: ms.breath * 0.8, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: ms.breath * 0.8, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])).start();
    }
    if (ms.particles > 0) {
      var pts = [];
      for (var i = 0; i < ms.particles; i++) {
        pts.push({ angle: (i / ms.particles) * Math.PI * 2, dist: ms.size * 0.5 + 10 + Math.random() * 20, speed: 2000 + Math.random() * 3000, anim: new Animated.Value(0) });
      }
      pts.forEach(function(p) {
        Animated.loop(Animated.sequence([
          Animated.timing(p.anim, { toValue: 1, duration: p.speed, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(p.anim, { toValue: 0, duration: p.speed, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])).start();
      });
      setParticles(pts);
    }
  }, [stateIdx]);

  var translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] });
  var scale = floatAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.95, 1.05, 0.95] });
  var glowOpacity = ms.glowR > 0 ? glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.4] }) : 0;
  var rainbowHue = stateIdx === 4 ? floatAnim.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: ['rgba(255,100,100,1)', 'rgba(255,215,0,1)', 'rgba(100,255,100,1)', 'rgba(100,200,255,1)', 'rgba(255,100,255,1)'] }) : null;

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ translateY: translateY }, { scale: scale }], alignItems: 'center' }}>
        {ms.glowR > 0 && (
          <Animated.View style={{ position: 'absolute', width: ms.size + ms.glowR * 2, height: ms.size + ms.glowR * 2, borderRadius: (ms.size + ms.glowR * 2) / 2, backgroundColor: ms.color.replace('1)', '0.08)'), opacity: glowOpacity, top: -ms.glowR, left: -ms.glowR }} />
        )}
        {particles.map(function(p, i) {
          var px = p.anim.interpolate({ inputRange: [0, 1], outputRange: [Math.cos(p.angle) * p.dist - 2, Math.cos(p.angle) * (p.dist + 8) - 2] });
          var py = p.anim.interpolate({ inputRange: [0, 1], outputRange: [Math.sin(p.angle) * p.dist - 2, Math.sin(p.angle) * (p.dist + 8) - 2] });
          var po = p.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 0.8, 0.2] });
          return (
            <Animated.View key={i} style={{ position: 'absolute', width: stateIdx >= 4 ? 5 : 4, height: stateIdx >= 4 ? 5 : 4, borderRadius: 3, backgroundColor: stateIdx >= 4 ? '#FFD700' : '#AEEF4D', opacity: po, left: Animated.add(ms.size / 2, px), top: Animated.add(ms.size / 2, py) }} />
          );
        })}
        <MeduseCornerIcon size={ms.size} breathCycleMs={ms.breath} breathMaxScale={stateIdx >= 3 ? 1.3 : 1.15} tint={stateIdx < 4 ? ms.color : 'rgba(255,215,0,1)'} />
      </Animated.View>
      {showLabel && (
        <View style={{ marginTop: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: ms.color.replace('1)', '0.9)'), letterSpacing: 1 }}>{names[stateIdx]}</Text>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{pct}% · {'\uD83D\uDD25'}{streak || 0}</Text>
        </View>
      )}
    </View>
  );
}

// ── FloatingMedusas ──
function FloatingMedusas() {
  var meds = useRef([
    { x: new Animated.Value(20), y: new Animated.Value(SH * 0.08), size: 80, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.65), y: new Animated.Value(SH * 0.15), size: 68, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.3), y: new Animated.Value(SH * 0.35), size: 74, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.8), y: new Animated.Value(SH * 0.5), size: 60, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.15), y: new Animated.Value(SH * 0.65), size: 76, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.5), y: new Animated.Value(SH * 0.78), size: 64, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
    { x: new Animated.Value(SW * 0.75), y: new Animated.Value(SH * 0.3), size: 56, bob: new Animated.Value(0), sway: new Animated.Value(0), rot: new Animated.Value(0), pulse: new Animated.Value(0) },
  ]).current;
  useEffect(function() {
    meds.forEach(function(m, i) {
      // Drift lent à travers l'écran
      var delay = 300 + i * 500;
      function drift() {
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 40 + Math.random() * (SH - m.size - 140);
        var dur = 12000 + Math.random() * 10000;
        Animated.parallel([
          Animated.timing(m.x, { toValue: toX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
          Animated.timing(m.y, { toValue: toY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
        ]).start(function() { drift(); });
      }
      setTimeout(drift, delay);
      // Bob (haut/bas sinusoïdal)
      var bobDur = 2400 + i * 380;
      Animated.loop(Animated.sequence([
        Animated.timing(m.bob, { toValue: 1, duration: bobDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(m.bob, { toValue: 0, duration: bobDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])).start();
      // Sway (gauche/droite)
      var swayDur = 3200 + i * 450;
      setTimeout(function() {
        Animated.loop(Animated.sequence([
          Animated.timing(m.sway, { toValue: 1, duration: swayDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
          Animated.timing(m.sway, { toValue: 0, duration: swayDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        ])).start();
      }, i * 300);
      // Rotation douce
      var rotDur = 4000 + i * 600;
      Animated.loop(Animated.sequence([
        Animated.timing(m.rot, { toValue: 1, duration: rotDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(m.rot, { toValue: 0, duration: rotDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])).start();
      // Pulse (scale)
      var pulseDur = 2800 + i * 350;
      Animated.loop(Animated.sequence([
        Animated.timing(m.pulse, { toValue: 1, duration: pulseDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(m.pulse, { toValue: 0, duration: pulseDur, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])).start();
    });
  }, []);
  return meds.map(function(m, i) {
    var bobAmp = 8 + i * 2;
    var swayAmp = 5 + i * 1.5;
    var translateY = m.bob.interpolate({ inputRange: [0, 1], outputRange: [-bobAmp, bobAmp] });
    var translateX = m.sway.interpolate({ inputRange: [0, 1], outputRange: [-swayAmp, swayAmp] });
    var rotate = m.rot.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] });
    var scale = m.pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
    return (
      <Animated.View key={'bg-m-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 0, opacity: 0.6, left: m.x, top: m.y, transform: [{ translateY: translateY }, { translateX: translateX }, { rotate: rotate }, { scale: scale }] }}>
        <MeduseCornerIcon size={m.size} breathCycleMs={2200 + i * 300} breathMaxScale={1.25} tint="rgba(174,239,77,1)" />
      </Animated.View>
    );
  });
}

// ── Exports ──
export {
  tentaclePath,
  TENTS2,
  BULLE_DEPART_SOUS_BORD,
  Bulle,
  Rayon,
  Meduse,
  MEDUSE_CORNER_BLUE,
  blueMeduse,
  MeduseCornerIcon,
  VideoPlaceholderMeduse,
  BULLES,
  BULLES_MONCORPS_BASE,
  BULLES_MONCORPS,
  BULLES_ONBOARDING,
  MEDUSA_STATES,
  MEDUSA_STATE_NAMES,
  getMeduseState,
  LivingMedusa,
  FloatingMedusas,
};
