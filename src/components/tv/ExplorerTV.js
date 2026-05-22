// ExplorerTV — onglet "Explorer" version Apple TV (style Fitness+).
//
// Affiche tous les piliers en grille uniforme 3 colonnes (cards 16:9
// focusables). Sélectionner un pilier ouvre PilierPanelTV (via onOpenPilier
// → setOpenPilier côté MonCorps). Remplace le rendu iPhone projeté.
//
// Rendu en overlay plein écran sous la TVTopBar (paddingTop pour la dégager).
// TV-only — zéro impact iPhone.

import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: '#000000' }}>
      <LinearGradient colors={['#000000', '#0F1014']} locations={[0, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 140, paddingBottom: 90 }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, paddingLeft: SIDE, marginBottom: 24 }}>
          {isFr ? 'Tous les piliers' : 'All pillars'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: SIDE }}>
          {piliers.map(function (p, i) {
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
