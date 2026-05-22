// TVTopBar — barre supérieure Apple TV style Fitness+ :
//   - gauche : un SEUL bouton hamburger (icône menu + label de l'onglet
//     courant). Au press → ouvre le TVMenuDropdown flottant.
//   - droite : avatar compact (icône user + prénom). Au press → onOpenProfile
//     (ouvre ProfilTV, géré par le parent TVMainView).
//
// Marge latérale 80px alignée avec le hero et les carrousels. zIndex élevé
// pour rester au-dessus du contenu qui scrolle dessous.
//
// TV-only — zéro impact iPhone.

import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

import TVMenuDropdown from './TVMenuDropdown';
import { tvFocusProps } from '../../utils/platformTV';

const SIDE = 80;

export default function TVTopBar({ tabs, activeKey, onSelectTab, prenom, onOpenProfile }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [burgerFocused, setBurgerFocused] = useState(false);
  const [avatarFocused, setAvatarFocused] = useState(false);
  const activeLabel = (tabs.find(function (t) { return t.key === activeKey; }) || {}).label || '';

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 44, paddingHorizontal: SIDE, zIndex: 70 }} pointerEvents="box-none">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* Hamburger + dropdown */}
        <View>
          <TouchableOpacity
            {...tvFocusProps(false)}
            activeOpacity={0.85}
            onPress={function () { setMenuOpen(function (v) { return !v; }); }}
            onFocus={function () { setBurgerFocused(true); }}
            onBlur={function () { setBurgerFocused(false); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14,
              backgroundColor: burgerFocused ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
              borderWidth: 1, borderColor: burgerFocused ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.14)',
            }}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d="M3 6h18M3 12h18M3 18h18" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <Text style={{ fontSize: 20, fontWeight: '600', color: '#ffffff' }}>{activeLabel}</Text>
          </TouchableOpacity>
          {menuOpen ? (
            <View style={{ marginTop: 10 }}>
              <TVMenuDropdown
                items={tabs}
                activeKey={activeKey}
                onSelect={function (k) { setMenuOpen(false); if (onSelectTab) onSelectTab(k); }}
              />
            </View>
          ) : null}
        </View>

        {/* Avatar */}
        <TouchableOpacity
          {...tvFocusProps(false)}
          activeOpacity={0.85}
          onPress={onOpenProfile}
          onFocus={function () { setAvatarFocused(true); }}
          onBlur={function () { setAvatarFocused(false); }}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
            backgroundColor: avatarFocused ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
            borderWidth: 1, borderColor: avatarFocused ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.14)',
          }}
        >
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,219,125,0.22)', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Circle cx="12" cy="8" r="4" stroke="#ffffff" strokeWidth={1.8} />
              <Path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="#ffffff" strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
          </View>
          {prenom ? <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff' }}>{prenom}</Text> : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}
