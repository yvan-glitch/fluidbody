// TVMenuDropdown — menu vertical flottant ouvert depuis le hamburger de la
// TVTopBar (style Apple Fitness+). Fond translucide + blur, coins arrondis,
// items hauteur ~64px. Navigation verticale au focus, sélection → onSelect.
//
// TV-only — zéro impact iPhone.

import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

import { tvFocusProps } from '../../utils/platformTV';

function MenuItem({ label, active, focusPreferred, onPress }) {
  const [focused, setFocused] = useState(false);
  return (
    <TouchableOpacity
      {...tvFocusProps(focusPreferred)}
      activeOpacity={0.85}
      onPress={onPress}
      onFocus={function () { setFocused(true); }}
      onBlur={function () { setFocused(false); }}
      style={{
        height: 64,
        justifyContent: 'center',
        paddingHorizontal: 26,
        borderRadius: 14,
        backgroundColor: focused ? 'rgba(255,255,255,0.22)' : 'transparent',
        borderWidth: focused ? 2 : 0,
        borderColor: focused ? 'rgba(255,255,255,0.85)' : 'transparent',
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: (focused || active) ? '700' : '500', color: focused ? '#ffffff' : (active ? '#00DB7D' : 'rgba(255,255,255,0.85)') }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function TVMenuDropdown({ items, activeKey, onSelect }) {
  // Focus initial sur l'item sélectionné (et pas systématiquement le premier)
  // — feedback "focus initial sur l'item sélectionné".
  const activeIdx = Math.max(0, (items || []).findIndex(function (it) { return it.key === activeKey; }));
  return (
    <View style={{ width: 320, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
      {Platform.OS === 'ios' ? <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
      <View style={{ backgroundColor: 'rgba(2,12,24,0.5)', padding: 10 }}>
        {items.map(function (it, i) {
          return (
            <MenuItem
              key={it.key}
              label={it.label}
              active={it.key === activeKey}
              focusPreferred={i === activeIdx}
              onPress={function () { onSelect(it.key); }}
            />
          );
        })}
      </View>
    </View>
  );
}
