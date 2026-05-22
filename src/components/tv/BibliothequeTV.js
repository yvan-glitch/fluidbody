// BibliothequeTV — onglet "Bibliothèque" version Apple TV.
//
// L'écran iPhone (Bibliotheque.js ~1251 l., listes + filtres tactiles) est
// inutilisable sur grand écran. Version TV : grille 3 colonnes de tous les
// piliers (cards 16:9 focusables) avec la progression (N/M faites) en
// sous-titre — l'angle "bibliothèque" = ta collection de séances par pilier.
// Sélectionner ouvre PilierPanelTV. TV-only — zéro impact iPhone.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import TVCard16x9 from './TVCard16x9';
import { pickSessionImage } from './tvImagePool';
import { T, PILIER_IMAGES } from '../../constants/data';
import { getCachedFavorites, subscribeFavorites } from '../../utils/favorites';

const { width: SW } = Dimensions.get('window');
const SIDE = 80;
const GAP = 22;
const COLS = 3;

function countDone(arr) {
  if (!Array.isArray(arr)) return 0;
  let n = 0;
  for (let i = 0; i < arr.length; i++) { if (arr[i] === true || arr[i] === 'true') n++; }
  return n;
}

export default function BibliothequeTV({ piliers, seancesByKey, done, onOpenPilier, onOpenSeance, lang }) {
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const cardW = Math.floor((SW - SIDE * 2 - GAP * (COLS - 1)) / COLS);

  const [favIds, setFavIds] = useState(function () { return getCachedFavorites(); });
  useEffect(function () {
    setFavIds(getCachedFavorites());
    return subscribeFavorites(function () { setFavIds(getCachedFavorites()); });
  }, []);

  // Résout les favoris (id "pilierKey_idx") → cards séance.
  const favCards = [];
  (favIds || []).forEach(function (id) {
    const us = id.lastIndexOf('_');
    if (us < 1) return;
    const pk = id.slice(0, us);
    const idx = parseInt(id.slice(us + 1), 10);
    if (Number.isNaN(idx)) return;
    const pil = (piliers || []).find(function (p) { return p.key === pk; });
    const seance = pil && seancesByKey && seancesByKey[pk] && seancesByKey[pk][idx];
    if (pil && seance) favCards.push({ id: id, pilier: pil, idx: idx, title: seance[0], subtitle: pil.label + ' · ' + seance[1], image: pickSessionImage(pk, idx) });
  });

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 140, paddingBottom: 90 }}>
        {favCards.length > 0 ? (
          <View style={{ marginBottom: 36 }}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, paddingLeft: SIDE, marginBottom: 18, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } }}>
              {isFr ? 'Mes favoris' : 'My favorites'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: SIDE }}>
              {favCards.map(function (f, i) {
                return (
                  <TVCard16x9
                    key={f.id}
                    width={cardW}
                    title={f.title}
                    subtitle={f.subtitle}
                    image={f.image}
                    focusPreferred={i === 0}
                    onPress={function () { if (onOpenSeance) onOpenSeance(f.pilier, f.idx); else onOpenPilier(f.pilier); }}
                  />
                );
              })}
            </View>
          </View>
        ) : null}
        <Text style={{ fontSize: 44, fontWeight: '800', color: '#ffffff', letterSpacing: -1, paddingLeft: SIDE, marginBottom: 8 }}>
          {(tr.tabs && tr.tabs[2]) || (isFr ? 'Bibliothèque' : 'Library')}
        </Text>
        <Text style={{ fontSize: 20, fontWeight: '400', color: 'rgba(255,255,255,0.5)', paddingLeft: SIDE, marginBottom: 28 }}>
          {isFr ? 'Toutes tes séances, classées par pilier' : 'All your sessions, by pillar'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: SIDE }}>
          {piliers.map(function (p, i) {
            const total = ((seancesByKey && seancesByKey[p.key]) || []).length;
            const dc = countDone(done && done[p.key]);
            return (
              <TVCard16x9
                key={p.key}
                width={cardW}
                title={p.label}
                subtitle={dc + '/' + total + ' ' + (isFr ? 'faites' : 'done')}
                image={PILIER_IMAGES[p.key]}
                focusPreferred={i === 0 && favCards.length === 0}
                onPress={function () { onOpenPilier(p); }}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
