import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ImageBackground, Linking, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '../constants/data';
import { Bulle, FloatingMedusas, BULLES } from '../components/Meduse';

const COACH_IMAGE = require('../../assets/coach.jpg');

// Static live class schedule (will be dynamic later)
const LIVE_SCHEDULE = [
  { id: 1, title: 'Mat Pilates', coach: 'Sabrina', day: 1, time: '18:00', duration: '45 min', type: 'mat' },
  { id: 2, title: 'Stretching Dos', coach: 'Sabrina', day: 3, time: '12:00', duration: '30 min', type: 'dos' },
  { id: 3, title: 'Core & Plancher', coach: 'Sabrina', day: 5, time: '18:00', duration: '45 min', type: 'core' },
];

const DAY_NAMES_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_FULL_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function LiveClassesScreen({ lang }) {
  var tr = T[lang] || T['fr'];
  var dayFull = lang === 'en' ? DAY_FULL_EN : DAY_FULL_FR;
  var today = new Date().getDay(); // 0=Sunday

  // Sort: today's classes first, then upcoming days
  var sorted = [...LIVE_SCHEDULE].sort(function(a, b) {
    var da = (a.day - today + 7) % 7;
    var db = (b.day - today + 7) % 7;
    return da - db;
  });

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />
      <ScrollView contentContainerStyle={{ paddingTop: 62, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {/* Pulsating red dot */}
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff3b30' }} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 3, textTransform: 'uppercase' }}>
              {tr.live_title || 'Cours en direct'}
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            {tr.live_subtitle || 'Rejoins Sabrina en live chaque semaine'}
          </Text>
        </View>

        {/* Live class cards */}
        {sorted.map(function(cls) {
          var isToday = cls.day === today;
          return (
            <View key={cls.id} style={{ marginHorizontal: 20, marginBottom: 14, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: isToday ? '#AEEF4D' : 'rgba(174,239,77,0.15)' }}>
              <ImageBackground source={COACH_IMAGE} resizeMode="cover" style={{ height: 160 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,14,24,0.7)', padding: 16, justifyContent: 'space-between' }}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {isToday && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,59,48,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff3b30' }} />
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#ff3b30', textTransform: 'uppercase' }}>{tr.live_today || "Aujourd'hui"}</Text>
                        </View>
                      )}
                      <View style={{ backgroundColor: 'rgba(174,239,77,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#AEEF4D' }}>{cls.duration}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 4 }}>{cls.title}</Text>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                      {dayFull[cls.day]} · {cls.time} · {tr.live_with || 'avec'} {cls.coach}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={function() { /* Will open Zoom/YouTube link later */ }}
                      style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#001226' }}>{tr.live_join || 'Rejoindre'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ height: 40, width: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 16 }}>🔔</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ImageBackground>
            </View>
          );
        })}

        {/* Info card */}
        <View style={{ marginHorizontal: 20, marginTop: 10, backgroundColor: 'rgba(0,18,38,0.4)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(174,239,77,0.1)' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff', marginBottom: 8 }}>{tr.live_info_title || 'Comment ça marche ?'}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 20 }}>
            {tr.live_info_body || "Connecte-toi à l'heure du cours et clique sur \"Rejoindre\". Sabrina te guide en temps réel. Active les rappels pour ne rien manquer !"}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

export default LiveClassesScreen;
