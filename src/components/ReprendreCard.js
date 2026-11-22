// ReprendreCard — « Reprendre » en tête de Pour toi (22.11.2026).
// Affiche la dernière vidéo interrompue (position mémorisée par VideoPlayer,
// clés fluid_video_resume_v1_*) avec le temps restant. Rien à reprendre :
// la carte ne s'affiche pas. `refreshKey` change quand on ferme un pilier.

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticLight } from '../utils';
import { hasVideo, isSeanceVisible } from '../utils/catalogVisibility';
import { getSeanceVisual } from '../utils/seanceThumbnail';
import { pickResume } from '../utils/resumePick';

// Même préfixe que VIDEO_RESUME_PREFIX (VideoPlayer.js).
const PREFIX = 'fluid_video_resume_v1_';
const LIME = '#AEEF4D';

export default function ReprendreCard({ piliers, seancesByKey, lang, refreshKey, onOpen }) {
  const [item, setItem] = useState(null);
  useEffect(function () {
    let cancelled = false;
    AsyncStorage.getAllKeys().then(function (keys) {
      const mine = (keys || []).filter(function (k) { return k.indexOf(PREFIX) === 0; });
      if (!mine.length) return [];
      return AsyncStorage.multiGet(mine);
    }).then(function (pairs) {
      if (!cancelled) setItem(pickResume(pairs, PREFIX, Date.now()));
    }).catch(function () {});
    return function () { cancelled = true; };
  }, [refreshKey]);

  if (!item) return null;
  const pilier = (piliers || []).find(function (p) { return p.key === item.pilierKey; });
  const seance = ((seancesByKey && seancesByKey[item.pilierKey]) || [])[item.idx];
  if (!pilier || !seance || !hasVideo(item.pilierKey, item.idx) || !isSeanceVisible(item.pilierKey, item.idx)) return null;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const left = isFr ? ('Encore ' + item.minutesLeft + ' min') : (item.minutesLeft + ' min left');

  return (
    <TouchableOpacity
      onPress={function () { hapticLight(); onOpen && onOpen(pilier, item.idx); }}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={(isFr ? 'Reprendre ' : 'Resume ') + seance[0] + ', ' + left}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(0,14,24,0.55)' }}
    >
      <View style={{ width: 96, height: 54, borderRadius: 10, overflow: 'hidden' }}>
        <Image source={getSeanceVisual(item.pilierKey, item.idx)} contentFit="cover" cachePolicy="memory-disk" style={{ flex: 1 }} accessibilityIgnoresInvertColors />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.25)' }}>
          <View style={{ width: Math.round(Math.min(1, Math.max(0, item.progress)) * 100) + '%', height: 3, backgroundColor: LIME }} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={1.6} style={{ fontSize: 11, fontWeight: '800', color: LIME, letterSpacing: 1.2, textTransform: 'uppercase' }}>{isFr ? 'Reprendre' : 'Resume'}</Text>
        <Text maxFontSizeMultiplier={1.6} numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginTop: 2 }}>{seance[0]}</Text>
        <Text maxFontSizeMultiplier={1.6} style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{pilier.label + ' · ' + left}</Text>
      </View>
      <Text style={{ fontSize: 18, color: LIME, marginRight: 6 }}>{'▶'}</Text>
    </TouchableOpacity>
  );
}
