// DownloadButton — petit bouton de téléchargement pour une card séance
// iPhone (PilierPanel). 3 états :
//   idle        : icône ⤓ blanche dans un cercle frosted, tap → lance le DL
//   downloading : spinner d'anneau de progression, tap → no-op
//   done        : icône ⤓ avec point vert lime, tap → confirme la suppression
//
// La couleur du conteneur reste sobre (frost dark + bordure blanche) pour
// ne pas voler la vedette au badge top-left ni aux chips bas. Position
// recommandée : bottom-right de la card via `style={{ position: 'absolute', ... }}`.
//
// iPhone-only — la TV passe directement au stream signé (pas de download).

import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Animated, Easing, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  getDownloadEntry,
  subscribeDownloads,
  startDownload,
  removeDownload,
} from '../utils/downloadsCache';

// Lecture/sub abonnement à un id donné. Force un re-render quand le state
// global change. Renvoie { status, progress }.
function useDownloadState(pilierKey, idx) {
  const [tick, setTick] = useState(0);
  useEffect(function () {
    const unsub = subscribeDownloads(function () { setTick(function (t) { return t + 1; }); });
    return unsub;
  }, []);
  // eslint-disable-next-line no-unused-vars
  const _force = tick;
  return getDownloadEntry(pilierKey, idx) || null;
}

export default function DownloadButton({ pilierKey, idx, lang, disabled, size = 30, style }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const state = useDownloadState(pilierKey, idx);
  const status = state && state.status;
  const progress = state && typeof state.progress === 'number' ? state.progress : 0;

  // Rotation infinie du spinner pendant le download.
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(function () {
    if (status !== 'downloading') { spin.setValue(0); return undefined; }
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return function () { try { loop.stop(); } catch (e) {} };
  }, [status]);

  function press() {
    if (disabled) return;
    if (status === 'downloading') return; // no-op pendant DL
    if (status === 'done') {
      Alert.alert(
        isFr ? 'Supprimer ce téléchargement ?' : 'Delete this download?',
        isFr ? 'La séance ne sera plus disponible hors-ligne.' : 'The session will no longer be available offline.',
        [
          { text: isFr ? 'Annuler' : 'Cancel', style: 'cancel' },
          { text: isFr ? 'Supprimer' : 'Delete', style: 'destructive', onPress: function () { removeDownload(pilierKey, idx); } },
        ]
      );
      return;
    }
    // idle / error → relance un download.
    startDownload(pilierKey, idx);
  }

  const accent = '#AEEF4D';
  const ringStroke = status === 'done' ? accent : 'rgba(255,255,255,0.85)';
  const arrowColor = status === 'done' ? accent : '#ffffff';

  return (
    <TouchableOpacity
      onPress={press}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={
        status === 'done' ? (isFr ? 'Téléchargée — appuyer pour supprimer' : 'Downloaded — tap to delete')
        : status === 'downloading' ? (isFr ? 'Téléchargement en cours' : 'Downloading')
        : (isFr ? 'Télécharger la séance' : 'Download session')
      }
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: status === 'done' ? 'rgba(174,239,77,0.55)' : 'rgba(255,255,255,0.35)',
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.42)' }]} pointerEvents="none" />

      {status === 'downloading' ? (
        // Anneau de progression : background + arc lime proportionnel à `progress`.
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            <Svg width={size - 4} height={size - 4} viewBox="0 0 24 24">
              <Circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.18)" strokeWidth={2.2} fill="none" />
              <Circle
                cx="12" cy="12" r="9"
                stroke={accent}
                strokeWidth={2.4}
                fill="none"
                strokeDasharray={`${Math.max(2, progress * 56.55)} 56.55`}
                strokeLinecap="round"
                transform="rotate(-90 12 12)"
              />
            </Svg>
          </Animated.View>
        </View>
      ) : (
        <Svg width={size - 8} height={size - 8} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={ringStroke} strokeWidth={1.2} opacity={status === 'done' ? 1 : 0.65} />
          <Path d="M12 6 L12 14 M8 10 L12 14 L16 10" stroke={arrowColor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {status === 'done' ? (
            <Circle cx="18" cy="6" r="3" fill={accent} />
          ) : null}
        </Svg>
      )}
    </TouchableOpacity>
  );
}

// Petit composant compagnon — pill compacte "30%" qui peut être affichée
// à côté du bouton (optionnel). On n'utilise pas dans la PilierPanel
// pour ne pas surcharger ; conservé exporté pour la section Hors-ligne.
export function DownloadProgressLabel({ pilierKey, idx, lang }) {
  const state = useDownloadState(pilierKey, idx);
  if (!state || state.status !== 'downloading') return null;
  const pct = Math.max(0, Math.min(100, Math.round((state.progress || 0) * 100)));
  return (
    <Text style={{ fontSize: 11, fontWeight: '600', color: '#AEEF4D', letterSpacing: 0.3 }}>
      {pct + '%'}
    </Text>
  );
}
