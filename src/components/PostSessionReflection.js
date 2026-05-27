// PostSessionReflection — petit prompt "Comment tu te sens ?" affiché après
// une séance terminée. Optionnel (X / "Plus tard" pour skip). Sauvegarde
// l'emoji choisi avec le sessionId dans AsyncStorage (cf. reflections.js).
// Fonctionne iPhone + Apple TV (boutons focusables sur tvOS).

import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import LiquidGlass from './LiquidGlass';

import { saveReflection } from '../utils/reflections';
import { Icon } from './Icons';

const OPTIONS = [
  { id: 'tired',     iconKey: 'sleep',    label: 'Fatigué',   labelEn: 'Tired' },
  { id: 'relaxed',   iconKey: 'smile',    label: 'Détendu',   labelEn: 'Relaxed' },
  { id: 'energized', iconKey: 'flame',    label: 'Énergique', labelEn: 'Energized' },
  { id: 'grounded',  iconKey: 'mountain', label: 'Ancré',     labelEn: 'Grounded' },
  { id: 'light',     iconKey: 'sparkle',  label: 'Léger',     labelEn: 'Light' },
];

export default function PostSessionReflection({ visible, sessionId, lang, onClose }) {
  const [picked, setPicked] = useState(null);
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  if (!visible) return null;
  function choose(opt) {
    if (picked) return;
    setPicked(opt.id);
    saveReflection(sessionId, opt.id);
    setTimeout(function () { if (onClose) onClose(); setPicked(null); }, 700);
  }
  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {Platform.OS === 'ios' ? (
          <LiquidGlass intensity={70} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} pointerEvents="none" />
        <Text style={{ fontSize: 26, fontWeight: '700', color: '#ffffff', marginBottom: 24, textAlign: 'center', letterSpacing: -0.3 }}>
          {isFr ? 'Comment tu te sens ?' : 'How do you feel?'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginBottom: 28, maxWidth: 600 }}>
          {OPTIONS.map(function (o) {
            const active = picked === o.id;
            return (
              <TouchableOpacity
                key={o.id}
                onPress={function () { choose(o); }}
                activeOpacity={0.85}
                accessibilityLabel={isFr ? o.label : o.labelEn}
                accessibilityRole="button"
                style={{
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  borderRadius: 18,
                  backgroundColor: active ? 'rgba(174,239,77,0.22)' : 'rgba(255,255,255,0.08)',
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? '#AEEF4D' : 'rgba(255,255,255,0.18)',
                  minWidth: 100,
                  transform: [{ scale: active ? 1.05 : 1 }],
                }}
              >
                <View style={{ width: 48, height: 48, marginBottom: 6, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={o.iconKey} size={40} color={active ? '#AEEF4D' : 'rgba(255,255,255,0.85)'} strokeWidth={1.6} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#AEEF4D' : 'rgba(255,255,255,0.78)', letterSpacing: 0.3 }}>
                  {isFr ? o.label : o.labelEn}
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
