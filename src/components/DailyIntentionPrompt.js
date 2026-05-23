// DailyIntentionPrompt — modal de démarrage à froid : "Comment veux-tu te
// sentir aujourd'hui ?". 5 cartes (Calme / Énergique / Ancré / Souple /
// Léger) → enregistre dans AsyncStorage et ferme. Cliquer "Plus tard"
// ferme sans sauver (et ré-affichera demain selon la logique du parent).
// Fonctionne iPhone + iPad + Apple TV (TouchableOpacity focusable tvOS).

import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

import { INTENTIONS, setTodayIntention } from '../utils/dailyIntention';

export default function DailyIntentionPrompt({ visible, lang, onPicked, onClose }) {
  const [picked, setPicked] = useState(null);
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  if (!visible) return null;
  function choose(intent) {
    if (picked) return;
    setPicked(intent.key);
    setTodayIntention(intent.key);
    setTimeout(function () {
      if (onPicked) onPicked(intent.key);
      setPicked(null);
    }, 600);
  }
  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} pointerEvents="none" />
        <Text style={{ fontSize: 14, color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, fontWeight: '700' }}>
          {isFr ? 'Intention du jour' : 'Daily intention'}
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#ffffff', marginBottom: 28, textAlign: 'center', letterSpacing: -0.3, maxWidth: 600 }}>
          {isFr ? 'Comment veux-tu te sentir aujourd’hui ?' : 'How do you want to feel today?'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginBottom: 30, maxWidth: 720 }}>
          {INTENTIONS.map(function (o) {
            const active = picked === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                onPress={function () { choose(o); }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={isFr ? o.labelFr : o.labelEn}
                style={{
                  alignItems: 'center',
                  paddingVertical: 18,
                  paddingHorizontal: 14,
                  borderRadius: 22,
                  backgroundColor: active ? 'rgba(174,239,77,0.22)' : 'rgba(255,255,255,0.08)',
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.18)',
                  minWidth: 120,
                  transform: [{ scale: active ? 1.06 : 1 }],
                }}
              >
                <Text style={{ fontSize: 48, marginBottom: 6 }}>{o.emoji}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: active ? '#AEEF4D' : 'rgba(255,255,255,0.86)', letterSpacing: 0.4 }}>
                  {isFr ? o.labelFr : o.labelEn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={isFr ? 'Passer' : 'Skip'} style={{ paddingVertical: 10, paddingHorizontal: 18 }}>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>
            {isFr ? 'Plus tard' : 'Later'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
