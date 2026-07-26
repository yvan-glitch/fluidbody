// RechercheTV — onglet "Recherche" version Apple TV.
//
// TextInput plein écran (le clavier système tvOS s'ouvre au focus) + grille
// 3 colonnes de résultats (TVCard16x9). Matching insensible casse + accents.
// Cherche dans les noms de piliers ET les titres de séances. Vide → affiche
// les 9 piliers ; aucun résultat → message.
//
// TV-only — zéro impact iPhone.

import { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Dimensions } from 'react-native';

import TVCard16x9 from './TVCard16x9';
import { pickSessionImage } from './tvImagePool';
import { PILIER_IMAGES } from '../../constants/data';
import { isSeanceVisible, pilierHasContent } from '../../utils/catalogVisibility';

const { width: SW } = Dimensions.get('window');
const SIDE = 80;
const GAP = 22;
const COLS = 3;

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export default function RechercheTV({ piliers, seancesByKey, lang, onOpenPilier, onOpenSeance }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const [query, setQuery] = useState('');
  const cardW = Math.floor((SW - SIDE * 2 - GAP * (COLS - 1)) / COLS);
  const q = norm(query.trim());

  const items = useMemo(function () {
    // Index de base : piliers + séances pratiques (hors théorie).
    const pilierItems = (piliers || []).filter(function (p) {
      return pilierHasContent(p.key, seancesByKey);
    }).map(function (p) {
      return { key: 'r-pil-' + p.key, title: p.label, subtitle: isFr ? 'Pilier' : 'Pillar', image: PILIER_IMAGES[p.key], type: 'pilier', pilier: p, _hay: norm(p.label) };
    });
    if (!q) return pilierItems; // état vide → les 9 piliers

    const out = [];
    pilierItems.forEach(function (it) { if (it._hay.indexOf(q) !== -1) out.push(it); });
    (piliers || []).forEach(function (p) {
      ((seancesByKey && seancesByKey[p.key]) || []).forEach(function (s, i) {
        if (s[2] === 'Comprendre' || s[2] === 'Ressentir') return;
        if (!isSeanceVisible(p.key, i)) return;
        if (norm(s[0]).indexOf(q) === -1) return;
        out.push({ key: 'r-se-' + p.key + '-' + i, title: s[0], subtitle: p.label + ' · ' + s[1], image: pickSessionImage(p.key, i), type: 'seance', pilier: p, idx: i });
      });
    });
    return out;
  }, [q, piliers, seancesByKey, isFr]);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 184, paddingBottom: 90 }}>
        <View style={{ paddingHorizontal: SIDE, marginBottom: 28 }}>
          <Text style={{ fontSize: 40, fontWeight: '800', color: '#ffffff', letterSpacing: -0.8, marginBottom: 18, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } }}>
            {isFr ? 'Recherche' : 'Search'}
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={isFr ? 'Rechercher une séance, un pilier…' : 'Search a session, a pillar…'}
            placeholderTextColor="rgba(255,255,255,0.45)"
            autoCorrect={false}
            style={{
              height: 64,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.10)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              color: '#ffffff',
              fontSize: 22,
              paddingHorizontal: 24,
            }}
          />
        </View>

        {items.length === 0 ? (
          <View style={{ paddingHorizontal: SIDE, paddingTop: 40 }}>
            <Text style={{ fontSize: 24, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>
              {isFr ? 'Aucun résultat' : 'No results'}
            </Text>
            <Text style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }}>
              {isFr ? 'Essaie « dos », « mobilité », « souffle »…' : 'Try “back”, “mobility”, “breath”…'}
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: SIDE }}>
            {items.map(function (it, i) {
              return (
                <TVCard16x9
                  key={it.key}
                  width={cardW}
                  title={it.title}
                  subtitle={it.subtitle}
                  image={it.image}
                  focusPreferred={i === 0}
                  onPress={function () {
                    if (it.type === 'seance' && onOpenSeance) onOpenSeance(it.pilier, it.idx);
                    else onOpenPilier(it.pilier);
                  }}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
