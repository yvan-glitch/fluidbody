// BibliothequeTV — onglet "Bibliothèque" version Apple TV.
//
// L'écran iPhone (Bibliotheque.js ~1251 l., listes + filtres tactiles) est
// inutilisable sur grand écran. Version TV : grille 3 colonnes de tous les
// piliers (cards 16:9 focusables) avec la progression (N/M faites) en
// sous-titre — l'angle "bibliothèque" = ta collection de séances par pilier.
// Sélectionner ouvre PilierPanelTV. TV-only — zéro impact iPhone.

import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import TVCard16x9 from './TVCard16x9';
import { T, PILIER_IMAGES } from '../../constants/data';

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

export default function BibliothequeTV({ piliers, seancesByKey, done, onOpenPilier, lang }) {
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const cardW = Math.floor((SW - SIDE * 2 - GAP * (COLS - 1)) / COLS);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 140, paddingBottom: 90 }}>
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
                focusPreferred={i === 0}
                onPress={function () { onOpenPilier(p); }}
              />
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
