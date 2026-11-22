// PlanTournage — carte + liste « Plan de tournage » pour les comptes admin
// (22.11.2026). Montre quoi filmer en priorité : le défi 7 jours d'abord,
// puis les piliers déjà commencés. Jamais visible pour une cliente.

import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { hasVideo } from '../utils/catalogVisibility';
import { CHALLENGE_7J } from '../constants/challenge';
import { buildShootingPlan } from '../utils/shootingPlan';

const LIME = '#AEEF4D';
const AMBER = '#FFB43C';

function Row({ item, prefix }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
      <Text style={{ width: 62, fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>{prefix || (item.pilierKey + '_' + item.idx)}</Text>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>{item.title}</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{item.duree + ' · ' + item.etape + (prefix ? ' · ' + item.pilierKey + '_' + item.idx : '')}</Text>
      </View>
    </View>
  );
}

export default function PlanTournage({ piliers, seancesByKey }) {
  const [open, setOpen] = useState(false);
  const plan = buildShootingPlan(piliers, seancesByKey, hasVideo, CHALLENGE_7J.days);
  if (plan.totalMissing === 0) return null;
  return (
    <View>
      <TouchableOpacity
        onPress={function () { setOpen(true); }}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={'Plan de tournage, ' + plan.totalMissing + ' séances à filmer'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14, marginBottom: 14, backgroundColor: 'rgba(255,180,60,0.10)', borderWidth: 1, borderColor: 'rgba(255,180,60,0.5)' }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: AMBER, letterSpacing: 1.5, textTransform: 'uppercase' }}>Admin</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginTop: 2 }}>Plan de tournage</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            {plan.totalMissing + ' séances à filmer' + (plan.challenge.length ? ' · défi 7 jours : ' + plan.challenge.length + ' manquantes' : '')}
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: AMBER }}>{'›'}</Text>
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={function () { setOpen(false); }}>
        <View style={{ flex: 1, backgroundColor: '#001226', paddingTop: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 6 }}>
            <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF' }}>Plan de tournage</Text>
            <TouchableOpacity onPress={function () { setOpen(false); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Fermer">
              <Text style={{ fontSize: 16, fontWeight: '700', color: LIME }}>Fermer</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}>
            {plan.challenge.length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: AMBER, letterSpacing: 1, textTransform: 'uppercase' }}>{'Défi 7 jours « Libère ton dos » · ' + plan.challenge.length + ' à filmer'}</Text>
                <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, marginBottom: 4 }}>Le défi s'allume tout seul dans l'app quand ses 7 vidéos sont en ligne.</Text>
                {plan.challenge.map(function (it) { return <Row key={'c' + it.pilierKey + it.idx} item={it} prefix={'Jour ' + it.day} />; })}
              </View>
            ) : null}
            {plan.groups.map(function (g) {
              return (
                <View key={g.key} style={{ marginTop: 22 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: LIME, letterSpacing: 1, textTransform: 'uppercase' }}>{g.label + ' · ' + g.filmed + ' filmées sur ' + g.total}</Text>
                  {g.missing.map(function (it) { return <Row key={it.pilierKey + it.idx} item={it} />; })}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
