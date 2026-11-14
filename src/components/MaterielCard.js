// MaterielCard — vidéo « Le matériel » mise en évidence (14.11.2026).
//
// Vidéo d'information hors catalogue : elle explique le matériel nécessaire
// pour suivre les séances. Elle n'appartient à aucun pilier et ne compte pas
// comme une séance (VideoPlayer en mode `isInfo`).
//
// Id de session : `materiel_0`. Le GUID Bunny vit uniquement dans la table
// Supabase `video_assets` (migration 20261114000000_video_materiel.sql).
// L'index 0 la rend gratuite pour tout compte connecté côté serveur
// (règle « index 0 gratuit » de sign-video-url) : aucune modif de l'edge
// function, ne pas changer cet id.
//
// Affichage : en tête de « Pour toi » tant que la vidéo n'a pas été ouverte
// (`hideWhenSeen`), en permanence en tête d'« Explorer ».

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VideoPlayer from './VideoPlayer';
import { T } from '../constants/data';
import { hapticLight } from '../utils';
import { buildSessionId, prefetchSignedVideoUrl } from '../utils/videoUrl';
import { getSeanceThumbnailUri, useSeanceThumbnailsVersion } from '../utils/seanceThumbnail';

export const MATERIEL_KEY = 'materiel';
export const MATERIEL_INDEX = 0;
const SEEN_KEY = 'fluid_materiel_seen_v1';

// Vu/pas vu partagé entre les instances (Pour toi + Explorer).
let seenCache = null; // null = pas encore lu
const seenListeners = new Set();
function setSeen(v) {
  seenCache = v;
  seenListeners.forEach(function (fn) { try { fn(v); } catch (e) {} });
}

export function useMaterielSeen() {
  const [seen, setLocal] = useState(seenCache);
  useEffect(function () {
    seenListeners.add(setLocal);
    if (seenCache === null) {
      AsyncStorage.getItem(SEEN_KEY)
        .then(function (v) { if (seenCache === null) setSeen(v === '1'); })
        .catch(function () { if (seenCache === null) setSeen(false); });
    }
    return function () { seenListeners.delete(setLocal); };
  }, []);
  return seen;
}

export default function MaterielCard({ lang, hideWhenSeen, height }) {
  const tr = T[lang] || T['fr'];
  const seen = useMaterielSeen();
  const [open, setOpen] = useState(false);
  useSeanceThumbnailsVersion();
  const thumb = getSeanceThumbnailUri(MATERIEL_KEY, MATERIEL_INDEX);

  // Tant que l'état n'est pas lu, on n'affiche rien dans « Pour toi » pour
  // éviter une carte qui apparaît puis disparaît. Le lecteur ouvert garde
  // la carte montée jusqu'à sa fermeture.
  if (hideWhenSeen && seen !== false && !open) return null;

  const title = tr.materiel_title || 'Le matériel dont tu as besoin';
  const seance = [title, '', 'Comprendre', true];
  const pilier = { key: MATERIEL_KEY, label: tr.materiel_tag || '' };

  function openVideo() {
    hapticLight();
    prefetchSignedVideoUrl(buildSessionId(MATERIEL_KEY, MATERIEL_INDEX), 'mp4');
    setOpen(true);
  }
  function close() {
    setOpen(false);
    if (!seenCache) {
      setSeen(true);
      AsyncStorage.setItem(SEEN_KEY, '1').catch(function () {});
    }
  }

  return (
    <>
      <TouchableOpacity
        onPress={openVideo}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={(tr.materiel_tag || '') + ', ' + title + ', ' + (tr.materiel_sub || '')}
        style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#AEEF4D', backgroundColor: 'rgba(0,26,46,0.9)' }}
      >
        <View style={{ height: height || 120 }}>
          {thumb ? (
            <Image source={{ uri: thumb }} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
          ) : null}
          <LinearGradient
            colors={thumb ? ['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)'] : ['rgba(174,239,77,0.16)', 'rgba(0,0,0,0.35)']}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Text style={{ fontSize: 20, color: '#000000' }}>{'▶'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#AEEF4D', letterSpacing: 1, marginBottom: 3 }}>
                {(tr.materiel_tag || '').toUpperCase()}
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#ffffff' }}>{title}</Text>
              <Text numberOfLines={2} style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{tr.materiel_sub || ''}</Text>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
      {open ? (
        <Modal
          visible
          animationType="fade"
          presentationStyle="fullScreen"
          statusBarTranslucent
          supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
          onRequestClose={close}
        >
          <VideoPlayer
            key="materiel-0"
            isInfo
            seance={seance}
            pilier={pilier}
            lang={lang}
            seanceIndex={MATERIEL_INDEX}
            onClose={close}
            onComplete={close}
          />
        </Modal>
      ) : null}
    </>
  );
}
