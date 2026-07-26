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
import { View, Text, TouchableOpacity, Alert, Animated, Easing, Platform, ActionSheetIOS } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  getDownloadEntry,
  subscribeDownloads,
  startDownload,
  removeDownload,
} from '../utils/downloadsCache';
import { getCachedPref } from '../utils/userPreferences';

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

// Estimation taille MP4 par minute (heuristique, indicative). Servira au
// menu de qualité quand on n'a pas de download précédent à observer.
// - Eco (480p) : ~3 MB/min
// - Standard (720p) : ~6 MB/min
// - HD (1080p) : ~12 MB/min
function estimateSizeMB(quality, minutes) {
  const perMin = quality === 'eco' ? 3 : quality === 'hd' ? 12 : 6;
  return Math.round(perMin * (minutes || 12));
}

function showQualityPicker(opts) {
  // opts : { isFr, durationMin, onPick(quality: 'eco'|'standard'|'hd') }
  // Les labels guident l'utilisateur selon l'appareil de lecture cible —
  // iPhone (Eco suffit), iPad (Standard), Apple TV (HD pour grand écran).
  const isFr = !!opts.isFr;
  const dur = opts.durationMin || 12;
  const optionEco = (isFr ? 'Économique' : 'Economical') + ' • iPhone (~' + estimateSizeMB('eco', dur) + ' MB)';
  const optionStd = 'Standard • iPad (~' + estimateSizeMB('standard', dur) + ' MB)';
  const optionHd  = 'HD • Apple TV (~' + estimateSizeMB('hd', dur) + ' MB)';
  const optionCancel = isFr ? 'Annuler' : 'Cancel';
  const title = isFr ? 'Qualité du téléchargement' : 'Download quality';
  const message = isFr
    ? 'Choisis selon ton appareil de lecture.'
    : 'Choose based on your playback device.';

  if (Platform.OS === 'ios' && ActionSheetIOS && ActionSheetIOS.showActionSheetWithOptions) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: title,
        message: message,
        options: [optionEco, optionStd, optionHd, optionCancel],
        cancelButtonIndex: 3,
        userInterfaceStyle: 'dark',
      },
      function (i) {
        if (i === 0) opts.onPick('eco');
        else if (i === 1) opts.onPick('standard');
        else if (i === 2) opts.onPick('hd');
      }
    );
    return;
  }
  // Fallback Android / web — Alert.alert.
  Alert.alert(title, message, [
    { text: optionEco, onPress: function () { opts.onPick('eco'); } },
    { text: optionStd, onPress: function () { opts.onPick('standard'); } },
    { text: optionHd,  onPress: function () { opts.onPick('hd'); } },
    { text: optionCancel, style: 'cancel' },
  ]);
}

// `durationMin` (optionnel) : minutes de la séance, utilisé pour
// l'estimation de taille affichée dans l'ActionSheet de qualité.
export default function DownloadButton({ pilierKey, idx, lang, disabled, size = 30, style, durationMin }) {
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
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.log('[DownloadButton] press', { pilierKey: pilierKey, idx: idx, status: status, disabled: disabled });
    }
    if (disabled) {
      // Le bouton est grisé pour les séances paywallées — on remontre un
      // message clair plutôt que de fail silencieusement.
      Alert.alert(
        isFr ? 'Téléchargement réservé aux abonnés' : 'Downloads for subscribers',
        isFr ? 'Abonne-toi à FluidBody+ pour télécharger les séances et les jouer hors-ligne.' : 'Subscribe to FluidBody+ to download sessions and play them offline.',
        [{ text: 'OK' }]
      );
      return;
    }
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
    // Préf "HD systématique" → skip le picker, lance direct en HD.
    if (getCachedPref('hdDownloadsAlways')) {
      startDownload(pilierKey, idx, 'hd');
      return;
    }
    // idle / error → ActionSheet de qualité, puis startDownload avec le
    // choix. L'utilisateur peut annuler (rien ne se passe).
    showQualityPicker({
      isFr: isFr,
      durationMin: durationMin,
      onPick: function (quality) { startDownload(pilierKey, idx, quality); },
    });
  }

  const accent = '#AEEF4D';
  // Solid lime semi-transparent + lime border : meilleure visibilité que
  // BlurView dark sur n'importe quel fond (gradient turquoise, image…).
  const isDone = status === 'done';
  const bg = isDone ? 'rgba(174,239,77,0.32)' : 'rgba(174,239,77,0.18)';
  const borderColor = isDone ? '#AEEF4D' : 'rgba(174,239,77,0.65)';
  const arrowColor = isDone ? accent : '#ffffff';

  return (
    <TouchableOpacity
      onPress={press}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={
        isDone ? (isFr ? 'Téléchargée, appuyer pour supprimer' : 'Downloaded, tap to delete')
        : status === 'downloading' ? (isFr ? 'Téléchargement en cours' : 'Downloading')
        : (isFr ? 'Télécharger la séance' : 'Download session')
      }
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={[
        {
          width: size, height: size, borderRadius: size / 2,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: bg,
          borderWidth: 1.2,
          borderColor: borderColor,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {status === 'downloading' ? (
        <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
          <Svg width={size - 6} height={size - 6} viewBox="0 0 24 24">
            <Circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.22)" strokeWidth={2.2} fill="none" />
            <Circle
              cx="12" cy="12" r="9"
              stroke={accent}
              strokeWidth={2.6}
              fill="none"
              strokeDasharray={`${Math.max(3, progress * 56.55)} 56.55`}
              strokeLinecap="round"
              transform="rotate(-90 12 12)"
            />
          </Svg>
        </Animated.View>
      ) : (
        <Svg width={size - 10} height={size - 10} viewBox="0 0 24 24" fill="none">
          <Path d="M12 4 L12 16 M7 11 L12 16 L17 11" stroke={arrowColor} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M5 20 L19 20" stroke={arrowColor} strokeWidth={2.2} strokeLinecap="round" fill="none" />
          {isDone ? (
            <Circle cx="19" cy="5" r="3.5" fill={accent} />
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
