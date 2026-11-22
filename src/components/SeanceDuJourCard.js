// SeanceDuJourCard — carte « Ta séance du jour » + ajustement du jour
// (Phase 2, 07.10.2026).
//
// Séance prévue = prochaine séance du programme actif, sinon séance du jour
// calculée (getSeanceDuJour). Sous « Démarrer » : deux chips discrètes
// « Fatiguée » / « Une gêne ». Aucune chip = comportement inchangé. Tap =
// la carte se met à jour tout de suite (selectSeanceDuJour, fonction pure) ;
// re-tap = retour à la séance prévue. Le choix tient pour la journée.

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T, ZONE_TO_PILIER } from '../constants/data';
import { canAccessSeanceIndex, isComingSoon, hapticLight } from '../utils';
import { hasVideo, isSeanceVisible } from '../utils/catalogVisibility';
import { getSeanceVisual } from '../utils/seanceThumbnail';
import { getRealDurationLabel } from '../utils/videoDurations';
import { selectSeanceDuJour, minutesOf, TEMPS } from '../utils/seanceDuJour';

const LIME = '#AEEF4D';
const CHOIX_KEY = 'fluid_ajustement_jour';
const CHOIX_VALIDES = ['fatiguee', 'gene', 'min5', 'min10', 'min20'];

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

export function buildCatalogue(piliers, seancesByKey, done, tensionIdxs, isSubscriber) {
  const byPilier = {};
  (piliers || []).forEach(function (p) {
    const list = (seancesByKey && seancesByKey[p.key]) || [];
    byPilier[p.key] = list.map(function (t, i) {
      const doneArr = done && done[p.key];
      return {
        pilierKey: p.key,
        idx: i,
        etape: t && t[2],
        duree: t && t[1],
        available: !!t && (t[3] === true || hasVideo(p.key, i)) && isSeanceVisible(p.key, i)
          && !isComingSoon(p.key, i) && canAccessSeanceIndex(i, isSubscriber, p.key),
        done: !!(doneArr && (doneArr[i] === true || doneArr[i] === 'true')),
      };
    });
  });
  const tensionPiliers = [];
  (Array.isArray(tensionIdxs) ? tensionIdxs : []).forEach(function (z) {
    const pk = ZONE_TO_PILIER[z];
    if (pk && tensionPiliers.indexOf(pk) < 0) tensionPiliers.push(pk);
  });
  return { byPilier: byPilier, tensionPiliers: tensionPiliers };
}

export default function SeanceDuJourCard({ planned, label, piliers, seancesByKey, done, tensionIdxs, isSubscriber, lang, onStart }) {
  const tr = T[lang] || T.fr;
  const [choix, setChoix] = useState(null);

  // Le choix tient pour la journée (retour sur l'onglet = même carte).
  useEffect(function () {
    let cancelled = false;
    AsyncStorage.getItem(CHOIX_KEY).then(function (raw) {
      if (cancelled || !raw) return;
      try {
        const o = JSON.parse(raw);
        if (o && o.day === todayKey() && CHOIX_VALIDES.indexOf(o.choix) !== -1) setChoix(o.choix);
      } catch (e) {}
    }).catch(function () {});
    return function () { cancelled = true; };
  }, []);

  if (!planned || !planned.pilierKey || planned.idx == null) return null;

  function toggle(c) {
    hapticLight();
    const next = choix === c ? null : c;
    setChoix(next);
    AsyncStorage.setItem(CHOIX_KEY, JSON.stringify({ day: todayKey(), choix: next })).catch(function () {});
  }

  const catalogue = buildCatalogue(piliers, seancesByKey, done, tensionIdxs, isSubscriber);
  const sel = selectSeanceDuJour({ pilierKey: planned.pilierKey, idx: planned.idx }, choix, catalogue);
  const pilier = (piliers || []).find(function (p) { return p.key === sel.pilierKey; });
  const seance = ((seancesByKey && seancesByKey[sel.pilierKey]) || [])[sel.idx];
  if (!pilier || !seance) return null;

  const dureeLabel = getRealDurationLabel(sel.pilierKey, sel.idx, seance[1]);
  const etapeLabel = (tr.etapes && tr.etapes[seance[2]]) || seance[2];

  let message = null;
  if (choix === 'fatiguee') message = sel.adapted ? tr.sdj_msg_fatigue : tr.sdj_msg_fatigue_same;
  if (choix === 'gene') {
    if (sel.adapted) {
      const zi = (Array.isArray(tensionIdxs) ? tensionIdxs : []).find(function (z) { return ZONE_TO_PILIER[z] === sel.pilierKey; });
      message = tr.sdj_msg_gene(zi != null && tr.ob_zones ? tr.ob_zones[zi] : null);
    } else {
      message = catalogue.tensionPiliers.length ? tr.sdj_msg_gene_same : tr.sdj_msg_gene_nozone;
    }
  }

  // Temps disponible (22.11.2026) : un seul geste, pas de questionnaire.
  if (choix === 'min5' || choix === 'min10' || choix === 'min20') {
    const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
    if (sel.adapted) message = isFr ? 'Voilà une séance qui tient dans ton temps.' : 'Here is a session that fits your time.';
    else if (minutesOf(seance[1]) >= TEMPS[choix][0] && minutesOf(seance[1]) < TEMPS[choix][1]) message = isFr ? 'Ta séance du jour tient déjà dans ce temps.' : "Today's session already fits.";
    else message = isFr ? "Pas encore de séance de cette durée : voici celle du jour." : "No session of that length yet: here is today's.";
  }

  const chips = [
    { key: 'min5', label: '5 min' },
    { key: 'min10', label: '10 min' },
    { key: 'min20', label: '20 min' },
    { key: 'fatiguee', label: tr.sdj_chip_fatigue },
    { key: 'gene', label: tr.sdj_chip_gene },
  ];

  return (
    <View style={{ marginBottom: 16, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(174,239,77,0.45)', backgroundColor: 'rgba(0,14,24,0.55)' }}>
      <View style={{ height: 150 }}>
        <Image
          source={getSeanceVisual(sel.pilierKey, sel.idx)}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
          recyclingKey={'sdjcard-' + sel.pilierKey + '-' + sel.idx}
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
        <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,10,20,0.85)']} style={{ flex: 1, justifyContent: 'flex-end', padding: 14 }}>
          <Text maxFontSizeMultiplier={1.6} style={{ fontSize: 11, fontWeight: '800', color: LIME, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            {label || tr.sdj_card_label}
          </Text>
          <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} numberOfLines={2} style={{ fontSize: 19, fontWeight: '700', color: '#FFFFFF', marginTop: 3 }}>
            {seance[0]}
          </Text>
          <Text maxFontSizeMultiplier={1.6} style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
            {pilier.label + ' · ' + dureeLabel + (etapeLabel ? ' · ' + etapeLabel : '')}
          </Text>
        </LinearGradient>
      </View>
      <View style={{ padding: 14 }}>
        {message ? (
          <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.8} style={{ fontSize: 14, fontStyle: 'italic', color: '#FFFFFF', marginBottom: 12, lineHeight: 20 }}>
            {message}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={function () { hapticLight(); onStart && onStart(sel.pilierKey, sel.idx, { adapted: sel.adapted, reason: sel.reason }); }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={tr.sdj_start + ', ' + seance[0] + ', ' + dureeLabel}
          style={{ minHeight: 50, borderRadius: 25, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 18 }}
        >
          <Text style={{ fontSize: 15, color: '#000000' }}>{'▶'}</Text>
          <Text maxFontSizeMultiplier={1.8} style={{ fontSize: 16, fontWeight: '800', color: '#000000' }}>{tr.sdj_start}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {chips.map(function (c) {
            const on = choix === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                onPress={function () { toggle(c.key); }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityHint={tr.sdj_chip_a11y_hint}
                hitSlop={{ top: 6, bottom: 6 }}
                style={{
                  minHeight: 36,
                  justifyContent: 'center',
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: on ? LIME : 'rgba(255,255,255,0.28)',
                  backgroundColor: on ? 'rgba(174,239,77,0.18)' : 'transparent',
                }}
              >
                <Text maxFontSizeMultiplier={1.8} style={{ fontSize: 13, fontWeight: on ? '700' : '500', color: on ? LIME : 'rgba(255,255,255,0.85)' }}>
                  {(on ? '✓ ' : '') + c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}
