// Achievements — écran plein-écran "Mes accomplissements".
//
// Accessible depuis Profil > Mon activité. Grille 2 colonnes des 15 badges
// (catalogue dans utils/achievements.js). Chaque tuile :
//   - débloqué : icône emoji + nom + sous-titre date "Débloqué le DD MMM"
//   - verrouillé : 🔒 + nom + sous-titre objectif (descFr/descEn)
//
// Souscrit au pub/sub achievements pour rerender live si un badge se
// débloque pendant que l'écran est ouvert (rare, mais cohérent avec
// Activity.js).
//
// iPhone-only — pas de version TV.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { T } from '../constants/data';
import {
  ACHIEVEMENTS,
  getUnlockedSync,
  getUnlockDatesSync,
  subscribe as subscribeAchievements,
} from '../utils/achievements';

const MONTHS_FR = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatUnlockDate(iso, isFr) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const months = isFr ? MONTHS_FR : MONTHS_EN;
  return d.getDate() + ' ' + months[d.getMonth()];
}

export default function AchievementsScreen({ visible, lang, onClose }) {
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const [unlockedIds, setUnlockedIds] = useState(function () { return getUnlockedSync(); });
  const [dates, setDates] = useState(function () { return getUnlockDatesSync(); });

  useEffect(function () {
    if (!visible) return undefined;
    setUnlockedIds(getUnlockedSync());
    setDates(getUnlockDatesSync());
    const unsub = subscribeAchievements(function (ids) {
      setUnlockedIds(ids || []);
      setDates(getUnlockDatesSync());
    });
    return unsub;
  }, [visible]);

  if (!visible) return null;

  const unlockedSet = new Set(unlockedIds);
  const total = ACHIEVEMENTS.length;
  const count = unlockedIds.length;

  // Tile width: (screenW - paddingH*2 - gap) / 2.
  const screenW = Dimensions.get('window').width;
  const PADDING_H = 20;
  const GAP = 12;
  const tileW = Math.floor((screenW - PADDING_H * 2 - GAP) / 2);

  const subtitle = typeof tr.achievements_unlocked_count === 'function'
    ? tr.achievements_unlocked_count(count, total)
    : count + ' / ' + total + (isFr ? ' débloqués' : ' unlocked');

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: '#000a1a' }}>
      <LinearGradient
        colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']}
        locations={[0, 0.18, 0.4, 0.6, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Header — retour + titre + sous-titre */}
        <View style={{ paddingHorizontal: PADDING_H, marginBottom: 24 }}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={{ paddingVertical: 6, marginBottom: 18 }} accessibilityRole="button" accessibilityLabel={isFr ? 'Retour' : 'Back'}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 0.5 }}>{tr.achievements_back || (isFr ? '← Retour' : '← Back')}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, marginBottom: 6 }}>
            {tr.achievements_screen_title || (isFr ? 'Mes accomplissements' : 'My achievements')}
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.2 }}>{subtitle}</Text>
        </View>

        {/* Grille 2 colonnes */}
        <View style={{ paddingHorizontal: PADDING_H, flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {ACHIEVEMENTS.map(function (a) {
            const unlocked = unlockedSet.has(a.id);
            const title = isFr ? a.titleFr : a.titleEn;
            const desc = isFr ? a.descFr : a.descEn;
            let sub = '';
            if (unlocked) {
              const dateLabel = formatUnlockDate(dates[a.id], isFr);
              if (dateLabel) {
                sub = typeof tr.achievements_unlocked_on === 'function'
                  ? tr.achievements_unlocked_on(dateLabel)
                  : (isFr ? 'Débloqué le ' : 'Unlocked on ') + dateLabel;
              } else {
                sub = tr.achievements_unlocked_label || (isFr ? 'Débloqué' : 'Unlocked');
              }
            } else {
              sub = desc || (tr.achievements_locked_label || (isFr ? 'À débloquer' : 'Locked'));
            }
            return (
              <View
                key={a.id}
                accessibilityLabel={title + ' · ' + sub}
                style={{
                  width: tileW,
                  paddingVertical: 18,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  backgroundColor: unlocked ? 'rgba(174,239,77,0.12)' : 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: unlocked ? 'rgba(174,239,77,0.40)' : 'rgba(255,255,255,0.10)',
                  alignItems: 'center',
                  opacity: unlocked ? 1 : 0.65,
                }}
              >
                <Text style={{ fontSize: 40, marginBottom: 10, opacity: unlocked ? 1 : 0.5 }}>{unlocked ? a.icon : '🔒'}</Text>
                <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '700', color: '#ffffff', textAlign: 'center', lineHeight: 17, letterSpacing: -0.1 }}>
                  {title}
                </Text>
                <Text numberOfLines={2} style={{ marginTop: 6, fontSize: 11, color: unlocked ? '#AEEF4D' : 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 15, fontWeight: unlocked ? '600' : '400' }}>
                  {sub}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
