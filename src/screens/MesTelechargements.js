// MesTelechargements — écran "Mes téléchargements" accessible depuis Profil.
//
// Liste verticale des séances téléchargées en local (status 'done' dans le
// cache downloads). Chaque ligne : image pilier + titre + étape · durée +
// taille fichier + qualité + bouton supprimer.
// Header : titre + bouton retour. Footer : "Tout supprimer" (si ≥ 1 dl).
// Empty state : invitation à télécharger depuis la Bibliothèque.
//
// Tap d'un item → callback parent qui ouvre le PilierPanel sur la bonne
// séance (le VideoPlayer auto-prefer le fichier local — câblé étape 4).
//
// iPhone-only (la TV n'a pas de downloads).

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { T, PILIER_IMAGES } from '../constants/data';
import { getPiliers, getSeances } from '../utils';
import { pickSessionImage } from '../components/tv/tvImagePool';
import {
  getCachedDownloads,
  getCachedStorageBytes,
  subscribeDownloads,
  removeDownload,
  removeAllDownloads,
  formatBytes,
} from '../utils/downloadsCache';
import { Icon } from '../components/Icons';

function ArrowDownIcon({ size, color }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.7, color: color, fontWeight: '300' }}>↓</Text>
    </View>
  );
}

function TrashIcon({ size, color }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="close" size={Math.round(size * 0.7)} color={color} strokeWidth={2} />
    </View>
  );
}

export default function MesTelechargements({ visible, lang, onClose, onOpenSeance }) {
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const [, setTick] = useState(0);

  useEffect(function () {
    if (!visible) return undefined;
    const unsub = subscribeDownloads(function () { setTick(function (t) { return t + 1; }); });
    return unsub;
  }, [visible]);

  if (!visible) return null;

  const piliers = getPiliers(lang);
  const seancesByKey = getSeances(lang);
  const dlCache = getCachedDownloads() || {};

  const items = [];
  Object.keys(dlCache).forEach(function (dlId) {
    const entry = dlCache[dlId];
    if (!entry || entry.status !== 'done') return;
    const us = dlId.lastIndexOf('_');
    if (us < 1) return;
    const pk = dlId.slice(0, us);
    const idx = parseInt(dlId.slice(us + 1), 10);
    if (Number.isNaN(idx)) return;
    const pil = piliers.find(function (p) { return p.key === pk; });
    const seance = pil && seancesByKey[pk] && seancesByKey[pk][idx];
    if (!pil || !seance) return;
    items.push({
      key: dlId,
      pilier: pil,
      idx: idx,
      title: seance[0],
      duree: seance[1],
      etape: seance[2],
      image: pickSessionImage(pk, idx),
      size: entry.size || 0,
      quality: entry.quality || null,
      date: entry.date,
    });
  });
  // Tri par date desc (plus récent en haut).
  items.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

  const totalBytes = getCachedStorageBytes();
  const count = items.length;
  const subtitle = count > 0
    ? (formatBytes(totalBytes) + ' · ' + count + (isFr ? (count > 1 ? ' séances' : ' séance') : (count > 1 ? ' sessions' : ' session')))
    : (isFr ? 'Aucun téléchargement' : 'No downloads');

  function deleteOne(it) {
    Alert.alert(
      isFr ? 'Supprimer ce téléchargement ?' : 'Delete this download?',
      isFr ? 'La séance ne sera plus disponible hors-ligne.' : 'The session will no longer be available offline.',
      [
        { text: isFr ? 'Annuler' : 'Cancel', style: 'cancel' },
        { text: isFr ? 'Supprimer' : 'Delete', style: 'destructive', onPress: function () { removeDownload(it.pilier.key, it.idx); } },
      ]
    );
  }

  function deleteAll() {
    Alert.alert(
      isFr ? 'Supprimer tous les téléchargements ?' : 'Delete all downloads?',
      isFr ? 'Tu auras besoin d\'une connexion pour rejouer ces séances.' : 'You will need an internet connection to play these sessions again.',
      [
        { text: isFr ? 'Annuler' : 'Cancel', style: 'cancel' },
        { text: isFr ? 'Tout supprimer' : 'Delete all', style: 'destructive', onPress: function () { removeAllDownloads(); } },
      ]
    );
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: '#000a1a' }}>
      <LinearGradient
        colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']}
        locations={[0, 0.18, 0.4, 0.6, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Header — retour + titre + sous-titre */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={{ paddingVertical: 6, marginBottom: 18 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 0.5 }}>{isFr ? '← Retour' : '← Back'}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, marginBottom: 6 }}>
            {isFr ? 'Mes téléchargements' : 'My downloads'}
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.2 }}>{subtitle}</Text>
        </View>

        {/* Empty state */}
        {count === 0 ? (
          <View style={{ marginHorizontal: 20, paddingVertical: 40, paddingHorizontal: 24, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center' }}>
            <ArrowDownIcon size={42} color="rgba(174,239,77,0.5)" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff', marginTop: 14, textAlign: 'center' }}>
              {isFr ? 'Aucun téléchargement' : 'No downloads yet'}
            </Text>
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 19, marginTop: 8, maxWidth: 280 }}>
              {isFr
                ? 'Va dans la Bibliothèque pour télécharger des séances et les lire hors-ligne.'
                : 'Go to the Library to download sessions and play them offline.'}
            </Text>
          </View>
        ) : null}

        {/* Liste des téléchargements */}
        {items.map(function (it) {
          const etapeLabel = (tr.etapes && tr.etapes[it.etape]) || it.etape;
          return (
            <View key={it.key} style={{ marginHorizontal: 20, marginBottom: 10 }}>
              <View style={{ position: 'relative' }}>
                <TouchableOpacity
                  onPress={function () { if (onOpenSeance) onOpenSeance(it.pilier, it.idx); }}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    paddingRight: 52,
                    borderRadius: 14,
                    backgroundColor: 'rgba(0,18,38,0.35)',
                    borderWidth: 1,
                    borderColor: 'rgba(174,239,77,0.20)',
                  }}
                >
                  <View style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', marginRight: 12 }}>
                    {it.image ? (
                      <Image source={it.image} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: '#ffffff', marginBottom: 4 }}>{it.title}</Text>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', letterSpacing: 0.3 }}>
                      {(etapeLabel || '').toUpperCase()} · {it.duree}{it.size ? ' · ' + formatBytes(it.size) : ''}{it.quality ? ' · ' + it.quality.toUpperCase() : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
                {/* Bouton supprimer — sibling du touchable carte pour ne pas
                    interférer avec son onPress. */}
                <TouchableOpacity
                  onPress={function () { deleteOne(it); }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  activeOpacity={0.7}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: 0,
                    bottom: 0,
                    justifyContent: 'center',
                    width: 36,
                    alignItems: 'center',
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={isFr ? 'Supprimer ' + it.title : 'Delete ' + it.title}
                >
                  <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,138,92,0.16)', borderWidth: 1, borderColor: 'rgba(255,138,92,0.5)' }}>
                    <TrashIcon size={16} color="#FF8A5C" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Footer — Tout supprimer */}
        {count > 0 ? (
          <View style={{ marginHorizontal: 20, marginTop: 14 }}>
            <TouchableOpacity
              onPress={deleteAll}
              activeOpacity={0.85}
              style={{
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: 'rgba(255,138,92,0.10)',
                borderWidth: 1,
                borderColor: 'rgba(255,138,92,0.45)',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#FF8A5C', letterSpacing: 0.4 }}>
                {isFr ? 'Tout supprimer' : 'Delete all'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
