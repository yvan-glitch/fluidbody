// ══════════════════════════════════
// ══════════════════════════════════
// STRETCH TIMER
// ══════════════════════════════════
import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Animated, Easing, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LiquidGlass from './LiquidGlass';
import Svg, { Circle } from 'react-native-svg';
import AnimatedPlus from './AnimatedPlus';
import { Audio } from 'expo-av';
import { T } from '../constants/data';
import { Bulle, FloatingMedusas, BULLES } from './Meduse';
import { Icon } from './Icons';

// ── Optional native modules ──
var HapticsMod = null;
try { HapticsMod = require('expo-haptics'); } catch(e) {}

function hapticSuccess() {
  if (Platform.OS === 'web' || !HapticsMod) return;
  try { void HapticsMod.notificationAsync(HapticsMod.NotificationFeedbackType.Success); } catch (e) {}
}

var AnimatedCircle = Animated.createAnimatedComponent(Circle);

var TIMER_BEEP = null;
try { TIMER_BEEP = require('../../assets/timer-beep.mp3'); } catch(e) {}

function StretchTimerModal({ visible, onClose, lang }) {
  var tr = T[lang] || T['fr'];
  var [duration, setDuration] = useState(30);
  var [reps, setReps] = useState(1);
  var [phase, setPhase] = useState('idle');
  var [remaining, setRemaining] = useState(0);
  var [currentRep, setCurrentRep] = useState(1);
  var [paused, setPaused] = useState(false);
  var intervalRef = useRef(null);
  var startRef = useRef(0);
  var elapsedBeforePause = useRef(0);
  var progressAnim = useRef(new Animated.Value(1)).current;
  var soundRef = useRef(null);

  var durations = [15, 30, 45, 60, 90, 120, 180, 300];
  var durLabels = { 15: '15s', 30: '30s', 45: '45s', 60: '1 min', 90: '1m30', 120: '2 min', 180: '3 min', 300: '5 min' };

  async function playBeep() {
    try {
      if (soundRef.current) { await soundRef.current.unloadAsync().catch(function() {}); }
      if (TIMER_BEEP) {
        var result = await Audio.Sound.createAsync(TIMER_BEEP);
        soundRef.current = result.sound;
        await result.sound.setVolumeAsync(1.0);
        await result.sound.playAsync();
      }
    } catch(e) {}
    hapticSuccess();
    hapticSuccess();
  }

  function runCycle(dur, rep) {
    setRemaining(dur);
    setCurrentRep(rep);
    setPhase('running');
    setPaused(false);
    elapsedBeforePause.current = 0;
    startRef.current = Date.now();
    progressAnim.setValue(1);
    Animated.timing(progressAnim, { toValue: 0, duration: dur * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(function() {
      var elapsed = elapsedBeforePause.current + Math.floor((Date.now() - startRef.current) / 1000);
      var rem = dur - elapsed;
      if (rem <= 0) {
        clearInterval(intervalRef.current);
        setRemaining(0);
        playBeep();
        if (rep < reps) {
          setPhase('rest');
          var restCount = 6;
          setRemaining(restCount);
          var restInterval = setInterval(function() {
            restCount--;
            setRemaining(restCount);
            if (restCount <= 0) { clearInterval(restInterval); runCycle(dur, rep + 1); }
          }, 1000);
          intervalRef.current = restInterval;
        } else {
          setPhase('done');
        }
      } else {
        setRemaining(rem);
      }
    }, 250);
  }

  function startTimer() { runCycle(duration, 1); }

  function pauseTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    elapsedBeforePause.current += Math.floor((Date.now() - startRef.current) / 1000);
    progressAnim.stopAnimation();
    setPaused(true);
  }

  function resumeTimer() {
    setPaused(false);
    startRef.current = Date.now();
    var rem = remaining;
    Animated.timing(progressAnim, { toValue: 0, duration: rem * 1000, easing: Easing.linear, useNativeDriver: false }).start();
    intervalRef.current = setInterval(function() {
      var elapsed = elapsedBeforePause.current + Math.floor((Date.now() - startRef.current) / 1000);
      var r = duration - elapsed;
      if (r <= 0) {
        clearInterval(intervalRef.current);
        setRemaining(0);
        playBeep();
        if (currentRep < reps) {
          setPhase('rest');
          var rc = 6; setRemaining(rc);
          var ri = setInterval(function() { rc--; setRemaining(rc); if (rc <= 0) { clearInterval(ri); runCycle(duration, currentRep + 1); } }, 1000);
          intervalRef.current = ri;
        } else { setPhase('done'); }
      } else { setRemaining(r); }
    }, 250);
  }

  function resetTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setPhase('idle');
    setRemaining(0);
    setCurrentRep(1);
    setPaused(false);
    elapsedBeforePause.current = 0;
    progressAnim.setValue(1);
  }

  useEffect(function() { return function() { if (intervalRef.current) clearInterval(intervalRef.current); if (soundRef.current) soundRef.current.unloadAsync().catch(function() {}); }; }, []);

  var circR = 100;
  var circC = 2 * Math.PI * circR;
  var dashOffset = progressAnim.interpolate({ inputRange: [0, 1], outputRange: [circC, 0] });
  var remMin = Math.floor(remaining / 60);
  var remSec = remaining % 60;
  var isActive = phase === 'running' || phase === 'rest';

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={function() { resetTimer(); onClose(); }}>
      <View style={{ flex: 1 }}>
        <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
        <LiquidGlass intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,20,35,0.6)' }} pointerEvents="none" />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible', opacity: 0.3 }} pointerEvents="none">
          {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
        </View>

        <FloatingMedusas />

        <View style={{ paddingTop: 58, paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: 30 }}>+</AnimatedPlus></Text>
          <TouchableOpacity onPress={function() { resetTimer(); onClose(); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={18} color="rgba(255,255,255,0.7)" strokeWidth={2} /></TouchableOpacity>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 30, zIndex: 2, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>{tr.timer_title || 'Minuteur Stretching & Eldoa'}</Text>
          <Text style={{ fontSize: 12, fontWeight: '300', color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 18, marginBottom: 16, paddingHorizontal: 20 }}>{tr.timer_desc || 'Maintenez chaque étirement pendant la durée choisie. Respirez profondément et relâchez à chaque bip.'}</Text>
          <View style={{ backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: '#AEEF4D', borderRadius: 24, padding: 28, alignItems: 'center', width: '100%' }}>

            <View style={{ width: (circR + 12) * 2, height: (circR + 12) * 2, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Svg width={(circR + 12) * 2} height={(circR + 12) * 2}>
                <Circle cx={circR + 12} cy={circR + 12} r={circR} stroke="rgba(174,239,77,0.12)" strokeWidth={6} fill="none" />
                <AnimatedCircle cx={circR + 12} cy={circR + 12} r={circR} stroke={phase === 'rest' ? '#00BDD0' : '#AEEF4D'} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={circC} strokeDashoffset={isActive ? dashOffset : 0} transform={'rotate(-90 ' + (circR + 12) + ' ' + (circR + 12) + ')'} />
              </Svg>
              <View style={{ position: 'absolute', alignItems: 'center' }}>
                {phase === 'rest' ? (
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#00BDD0', marginBottom: 4 }}>{tr.timer_rest || 'Repos'}</Text>
                ) : null}
                <Text style={{ fontSize: 48, fontWeight: '200', color: '#ffffff', fontVariant: ['tabular-nums'] }}>
                  {isActive || phase === 'done' ? <>{String(remMin).padStart(2, '0')}:<Text style={{ color: '#FF3B30' }}>{String(remSec).padStart(2, '0')}</Text></> : durLabels[duration] || duration + 's'}
                </Text>
                {isActive && reps > 1 && <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', marginTop: 4 }}>{currentRep} / {reps}</Text>}
                {phase === 'done' && <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', marginTop: 4 }}>{tr.timer_done || 'Terminé !'}</Text>}
              </View>
            </View>

            {phase === 'idle' && (
              <>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>{tr.timer_duree || 'Durée'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20, maxHeight: 40 }} contentContainerStyle={{ gap: 8 }}>
                  {durations.map(function(d) {
                    var active = duration === d;
                    return (
                      <TouchableOpacity key={d} onPress={function() { setDuration(d); }} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.12)', backgroundColor: active ? 'rgba(174,239,77,0.15)' : 'transparent' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#AEEF4D' : 'rgba(255,255,255,0.4)' }}>{durLabels[d]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={{ fontSize: 11, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>{tr.timer_reps || 'Répétitions'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 24 }}>
                  <TouchableOpacity onPress={function() { setReps(Math.max(1, reps - 1)); }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '300', color: 'rgba(255,255,255,0.5)' }}>−</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: '#ffffff', width: 50, textAlign: 'center' }}>{reps}x</Text>
                  <TouchableOpacity onPress={function() { setReps(Math.min(10, reps + 1)); }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '300', color: 'rgba(255,255,255,0.5)' }}>+</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            {phase === 'idle' && (
              <TouchableOpacity onPress={startTimer} activeOpacity={0.85} style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#000000', letterSpacing: 0.5 }}>START</Text>
              </TouchableOpacity>
            )}
            {phase === 'running' && !paused && (
              <TouchableOpacity onPress={pauseTimer} activeOpacity={0.85} style={{ flex: 1, height: 48, borderRadius: 24, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>PAUSE</Text>
              </TouchableOpacity>
            )}
            {phase === 'running' && paused && (
              <>
                <TouchableOpacity onPress={resumeTimer} activeOpacity={0.85} style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#000000', letterSpacing: 0.5 }}>REPRENDRE</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={resetTimer} activeOpacity={0.85} style={{ height: 56, width: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="rotate" size={20} color="rgba(255,255,255,0.6)" strokeWidth={1.8} />
                </TouchableOpacity>
              </>
            )}
            {(phase === 'done' || phase === 'rest') && (
              <TouchableOpacity onPress={resetTimer} activeOpacity={0.85} style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 }}>RESET</Text>
              </TouchableOpacity>
            )}
          </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}


export default StretchTimerModal;
