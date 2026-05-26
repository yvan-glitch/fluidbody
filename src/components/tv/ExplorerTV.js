// ExplorerTV — onglet "Explorer" version Apple TV.
//
// Depuis que "Pour vous" a pris le layout 2 colonnes (TwoColLandingTV),
// Explorer se distingue par une grille 3 colonnes "full" de tous les piliers
// (cards 16:9 focusables) — vue catalogue. Sélectionner ouvre PilierPanelTV.
//
// Rendu en overlay plein écran sous la TVTopBar, sur le backdrop "monde".
// TV-only — zéro impact iPhone.

import { View, Text, ScrollView, Dimensions } from 'react-native';

import TVCard16x9 from './TVCard16x9';
import { PILIER_IMAGES } from '../../constants/data';

const { width: SW } = Dimensions.get('window');
const SIDE = 80;
const GAP = 22;
const COLS = 3;

export default function ExplorerTV({ piliers, seancesByKey, onOpenPilier, lang }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const cardW = Math.floor((SW - SIDE * 2 - GAP * (COLS - 1)) / COLS);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 184, paddingBottom: 90 }}>
        <Text style={{ fontSize: 44, fontWeight: '800', color: '#ffffff', letterSpacing: -1, paddingLeft: SIDE, marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } }}>
          {isFr ? 'Explorer' : 'Explore'}
        </Text>
        <Text style={{ fontSize: 20, fontWeight: '400', color: 'rgba(255,255,255,0.55)', paddingLeft: SIDE, marginBottom: 28 }}>
          {isFr ? 'Tous les piliers du Pilates conscient' : 'Every conscious-Pilates pillar'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: SIDE }}>
          {(piliers || []).map(function (p, i) {
            const count = ((seancesByKey && seancesByKey[p.key]) || []).length;
            return (
              <TVCard16x9
                key={p.key}
                width={cardW}
                title={p.label}
                subtitle={count + ' ' + (isFr ? 'séances' : 'sessions')}
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
