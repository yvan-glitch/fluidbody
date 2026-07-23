// ── ProgressScreen ──
// Refonte IA (audit UX 2026-07-23) : l'app avait TROIS surfaces de progression
// concurrentes — l'onglet Activité (anneaux Santé + badges), l'onglet Résumé
// (dashboard méduse + calendrier) et la modale Statistics. Le streak était
// affiché sur 3 écrans. Cet écran les regroupe sous UN onglet « Progrès »
// avec un sélecteur Résumé | Activité ; Statistics reste le « voir plus »
// (déjà accessible depuis Résumé). Les deux écrans existants sont réutilisés
// tels quels — zéro régression fonctionnelle.
import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ResumeScreen from './Resume';
import ActivityScreen from './Activity';
import { T } from '../constants/data';

const ACCENT = '#AEEF4D';

export default function ProgressScreen({
  lang, done, streak, prenom, tensionIdxs, supabase, supaUser,
  onCreateAccount, onOpenStatistics,
}) {
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const [seg, setSeg] = useState('resume');

  const SEGMENTS = [
    { key: 'resume', label: tr.progress_seg_resume || (isFr ? 'Résumé' : 'Summary') },
    { key: 'activity', label: tr.activity_tab || (isFr ? 'Activité' : 'Activity') },
  ];

  return (
    <View style={{ flex: 1 }}>
      {seg === 'resume' ? (
        <ResumeScreen
          done={done}
          lang={lang}
          streak={streak}
          prenom={prenom}
          tensionIdxs={tensionIdxs}
          supaUser={supaUser}
          onCreateAccount={onCreateAccount}
          onOpenStatistics={onOpenStatistics}
        />
      ) : (
        <ActivityScreen lang={lang} supabase={supabase} supaUser={supaUser} done={done} />
      )}
      {/* Sélecteur flottant Résumé | Activité — pilule verre en haut, centrée. */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 58, left: 0, right: 0, alignItems: 'center', zIndex: 60 }}
      >
        <View style={{
          flexDirection: 'row',
          backgroundColor: 'rgba(0,20,36,0.78)',
          borderRadius: 999,
          padding: 4,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.14)',
        }}>
          {SEGMENTS.map(function (s) {
            const active = seg === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                onPress={function () { setSeg(s.key); }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={active ? { selected: true } : undefined}
                accessibilityLabel={s.label}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? 'rgba(174,239,77,0.18)' : 'transparent',
                  borderWidth: active ? 1 : 0,
                  borderColor: 'rgba(174,239,77,0.55)',
                  minWidth: 96,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontWeight: active ? '800' : '600',
                  color: active ? ACCENT : 'rgba(255,255,255,0.65)',
                  letterSpacing: 0.3,
                }}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}
