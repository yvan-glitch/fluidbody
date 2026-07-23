// ── ChallengeModal — Défi 7 jours « Libère ton dos » ──
// Parcours guidé J1→J7 sur des séances existantes. Déblocage séquentiel
// (le jour N s'ouvre quand N-1 est fait), progression dérivée de la map
// `done` globale (aucun état dupliqué), gating abonnement inchangé (le tap
// route vers le PilierPanel qui applique canAccessSeanceIndex → paywall).
// À J7 : célébration, demande d'avis App Store, et CTA abonnement pour les
// non-abonnés — le meilleur moment de conversion de l'app.
import { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T } from '../constants/data';
import { CHALLENGE_7J, challengeDoneCount, challengeNextDay } from '../constants/challenge';
import { getSeances, getPiliers, hapticLight, hapticSuccess } from '../utils';
import { maybeAskForReview } from '../utils/reviewPrompt';
import { MeduseCornerIcon } from './Meduse';
import GlassButton from './GlassButton';

const ACCENT = '#AEEF4D';

export default function ChallengeModal({ visible, onClose, lang, done, isSubscriber, onOpenSeance, onActivateSubscription }) {
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const seancesData = getSeances(lang);
  const piliers = getPiliers(lang);
  const doneCount = challengeDoneCount(done);
  const nextDay = challengeNextDay(done);
  const completed = nextDay === -1;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    Animated.timing(progressAnim, {
      toValue: doneCount / CHALLENGE_7J.days.length,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // largeur de barre — pas de driver natif possible
    }).start();
    // Défi complété → petit moment : haptique + demande d'avis (une seule
    // fois par ouverture ; maybeAskForReview a ses propres garde-fous).
    if (completed && !celebratedRef.current) {
      celebratedRef.current = true;
      hapticSuccess();
      setTimeout(() => { maybeAskForReview({ totalDone: 7, streak: 7 }).catch(() => {}); }, 1800);
    }
  }, [visible, doneCount, completed]);

  function pilierLabel(key) {
    const p = piliers.find(function (x) { return x.key === key; });
    return (p && p.label) || key;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#00131f' }}>
        <LinearGradient pointerEvents="none" colors={['#001a2e', '#00304a', '#00131f']} locations={[0, 0.45, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={{ alignItems: 'center', paddingTop: 28, paddingHorizontal: 24 }}>
            <MeduseCornerIcon size={72} breathCycleMs={2600} tint="rgba(174,239,77,1)" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: ACCENT, letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 14 }}>
              {tr.challenge_kicker || (isFr ? 'Défi 7 jours' : '7-day challenge')}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginTop: 6, letterSpacing: -0.4 }}>
              {tr.challenge_title || (isFr ? 'Libère ton dos' : 'Free your back')}
            </Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.62)', textAlign: 'center', lineHeight: 21, marginTop: 8 }}>
              {tr.challenge_sub || (isFr
                ? 'Une semaine guidée pour comprendre, sentir et renforcer ton dos. Un jour à la fois.'
                : 'One guided week to understand, feel and strengthen your back. One day at a time.')}
            </Text>
            {/* Barre de progression */}
            <View style={{ alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)', marginTop: 20, overflow: 'hidden' }}>
              <Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: ACCENT, width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
            </View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
              {isFr ? `${doneCount} / 7 jours` : `${doneCount} / 7 days`}
            </Text>
          </View>

          {/* Les 7 jours */}
          <View style={{ paddingHorizontal: 20, marginTop: 24, gap: 10 }}>
            {CHALLENGE_7J.days.map(function (d, i) {
              const s = (seancesData[d.pilier] || [])[d.idx] || [];
              const titre = s[0] || '—';
              const duree = s[1] || '';
              const isDone = (function () { const arr = done && done[d.pilier]; const v = arr && arr[d.idx]; return v === true || v === 'true'; })();
              const isCurrent = i === nextDay;
              const isLockedSeq = !isDone && !isCurrent; // déblocage séquentiel
              return (
                <TouchableOpacity
                  key={'cd-' + i}
                  disabled={isLockedSeq}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={(isFr ? 'Jour ' : 'Day ') + (i + 1) + ' — ' + titre}
                  onPress={function () { hapticLight(); onOpenSeance && onOpenSeance(d.pilier, d.idx); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    borderRadius: 16, padding: 14,
                    backgroundColor: isCurrent ? 'rgba(174,239,77,0.10)' : 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: isDone ? 'rgba(174,239,77,0.45)' : (isCurrent ? 'rgba(174,239,77,0.6)' : 'rgba(255,255,255,0.08)'),
                    opacity: isLockedSeq ? 0.45 : 1,
                  }}
                >
                  <View style={{
                    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isDone ? 'rgba(174,239,77,0.18)' : 'rgba(255,255,255,0.08)',
                  }}>
                    <Text style={{ fontSize: isDone ? 18 : 14, fontWeight: '800', color: isDone ? ACCENT : (isCurrent ? '#ffffff' : 'rgba(255,255,255,0.5)') }}>
                      {isDone ? '✓' : 'J' + (i + 1)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: '#ffffff' }}>{titre}</Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{pilierLabel(d.pilier)} · {duree}</Text>
                  </View>
                  {isCurrent ? (
                    <View style={{ backgroundColor: ACCENT, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#001226' }}>{isFr ? 'Commencer' : 'Start'}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Bloc completion — visible uniquement à 7/7 */}
          {completed ? (
            <View style={{ marginHorizontal: 20, marginTop: 26, borderRadius: 20, padding: 22, alignItems: 'center', backgroundColor: 'rgba(174,239,77,0.10)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.45)' }}>
              <Text style={{ fontSize: 34 }}>{'🏆'}</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginTop: 8 }}>
                {tr.challenge_done_title || (isFr ? 'Défi accompli !' : 'Challenge complete!')}
              </Text>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 21, marginTop: 8 }}>
                {tr.challenge_done_sub || (isFr
                  ? 'Sept jours pour ton dos — il te remercie déjà.'
                  : 'Seven days for your back — it already thanks you.')}
              </Text>
              {!isSubscriber ? (
                <GlassButton
                  onPress={function () { onClose && onClose(); onActivateSubscription && onActivateSubscription(); }}
                  size="md"
                  textColor={ACCENT}
                  style={{ alignSelf: 'stretch', marginTop: 16 }}
                >
                  {tr.challenge_cta_sub || (isFr ? 'Tu as tenu 7 jours. Imagine 3 mois.' : 'You held 7 days. Imagine 3 months.')}
                </GlassButton>
              ) : null}
            </View>
          ) : null}

          {/* Fermer */}
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={tr.fermer || 'Fermer'} style={{ alignSelf: 'center', paddingVertical: 16, paddingHorizontal: 24, marginTop: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.55)' }}>{tr.fermer || (isFr ? 'Fermer' : 'Close')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
