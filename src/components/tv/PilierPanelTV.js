// PilierPanelTV — version Apple TV (style Fitness+) du PilierPanel.
//
// Le PilierPanel iPhone (src/screens/MonCorps.js) reste inchangé ; celui-ci
// est rendu UNIQUEMENT sur tvOS (cf. MonCorps : openPilier && IS_TV).
//
// Layout :
//   - Hero ~42% : image du pilier full-bleed + gradient + bouton retour
//     (haut-gauche) + titre 76px + "N séances · ~M min" + bouton "Démarrer"
//     (vert Fitness+, hasTVPreferredFocus).
//   - Grille 3 colonnes des séances pratiques (16:9 focusables) : image,
//     titre, durée, badge d'étape, état (✓ fait / 🔒 verrouillé). Focus =
//     scale 1.08 + ring blanc + glow.
//
// La lecture vidéo réutilise EXACTEMENT la machinerie du PilierPanel : même
// VideoPlayer, mêmes signed URLs (prefetch), même complétion → SeanceCompleteTV,
// même reprise (resume) et contrôle d'accès (canAccessSeanceIndex).

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, View, Text, ScrollView, StyleSheet, Platform, Dimensions, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { tvFocusProps } from '../../utils/platformTV';
import { T, PILIER_IMAGES } from '../../constants/data';
import { getSeances, canAccessSeanceIndex, getResumeIndicesForPilier, isComingSoon, hapticLight } from '../../utils';
import { prefetchSignedVideoUrl, buildSessionId } from '../../utils/videoUrl';
import VideoPlayer from '../VideoPlayer';
import PostSessionReflection from '../PostSessionReflection';
import SeanceCompleteTV from './SeanceCompleteTV';
import AquaticBackground from './AquaticBackground';
import { pickSessionImage } from './tvImagePool';
import { isFavoriteCached, subscribeFavorites, toggleFavoriteLocal } from '../../utils/favorites';
import { isSeanceVisible, hasVideo, useCatalogVersion } from '../../utils/catalogVisibility';
import { Icon } from '../Icons';

const { width: SW, height: SH } = Dimensions.get('window');
const FITNESS_GREEN = '#AEEF4D'; // lime marque — couleur d'action unique TV (ex-#00DB7D)
const SIDE = 80;
const GAP = 24;
const COLS = 3;

const ETAPE_TINT = {
  Comprendre: '#9B8CFF',
  Ressentir: '#00BDD0',
  Préparer: '#00BDD0',
  Exécuter: '#AEEF4D',
  Évoluer: '#FF9B5A',
};

function parseMin(d) {
  var m = String(d || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

// ── Bouton hero (Démarrer / retour) ──────────────────────────────────────
function HeroPillButton({ label, variant, onPress, focusPreferred }) {
  const primary = variant === 'primary';
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const ringO = useRef(new Animated.Value(0)).current;
  useEffect(function () {
    Animated.parallel([
      Animated.timing(scale, { toValue: focused ? 1.08 : 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ringO, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [focused]);
  return (
    <Animated.View style={[{ alignSelf: 'flex-start', borderRadius: 32, transform: [{ scale: scale }] }, focused ? { shadowColor: primary ? FITNESS_GREEN : '#FFFFFF', shadowOpacity: primary ? 0.72 : 0.7, shadowRadius: primary ? 30 : 36, shadowOffset: { width: 0, height: 4 } } : null]}>
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onFocus={function () { setFocused(true); }}
        onBlur={function () { setFocused(false); }}
        style={{ borderRadius: 32, overflow: 'hidden' }}
      >
        {primary ? (
          <View style={{ paddingVertical: 16, paddingHorizontal: 40, position: 'relative', overflow: 'hidden' }}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={35} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
            ) : null}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: focused ? 'rgba(196,247,110,0.95)' : 'rgba(174,239,77,0.9)' }]} pointerEvents="none" />
            <View style={[StyleSheet.absoluteFill, { borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.42)' }]} pointerEvents="none" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="play" size={18} color="#001B10" />
              <Text style={{ fontSize: 22, fontWeight: '700', color: '#001B10', letterSpacing: 0.2 }}>{label}</Text>
            </View>
          </View>
        ) : (
          <View style={{ paddingVertical: 14, paddingHorizontal: 28, position: 'relative', overflow: 'hidden' }}>
            {Platform.OS === 'ios' ? <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: focused ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.06)' }]} pointerEvents="none" />
            <View style={[StyleSheet.absoluteFill, { borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]} pointerEvents="none" />
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', letterSpacing: 0.2 }}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 35, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', opacity: ringO }} />
    </Animated.View>
  );
}

// ── Carte séance focusable (16:9) ────────────────────────────────────────
function SeanceCardTV({ width, title, duree, etape, etapeLabel, done, locked, comingSoon, focusPreferred, image, sessionId, onPress, onFocus }) {
  const cardH = Math.round((width * 9) / 16);
  const [focused, setFocused] = useState(false);
  const [fav, setFav] = useState(function () { return isFavoriteCached(sessionId); });
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(function () {
    Animated.parallel([
      Animated.timing(scale, { toValue: focused ? 1.08 : 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(ring, { toValue: focused ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [focused]);
  useEffect(function () {
    setFav(isFavoriteCached(sessionId));
    return subscribeFavorites(function () { setFav(isFavoriteCached(sessionId)); });
  }, [sessionId]);
  const tint = ETAPE_TINT[etape] || '#00BDD0';
  return (
    <Animated.View style={[{ width: width, height: cardH, borderRadius: 20, transform: [{ scale: scale }] }, focused ? { shadowColor: '#FFFFFF', shadowOpacity: 0.78, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } } : null]}>
      <TouchableOpacity
        {...tvFocusProps(focusPreferred)}
        activeOpacity={0.9}
        onPress={onPress}
        onLongPress={sessionId ? function () { toggleFavoriteLocal(sessionId); } : undefined}
        delayLongPress={1000}
        onFocus={function () { setFocused(true); if (onFocus) onFocus(); }}
        onBlur={function () { setFocused(false); }}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#10131C', opacity: locked ? 0.55 : 1 }}>
          {image ? <Image source={image} contentFit="cover" transition={200} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} /> : null}
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} locations={[0.42, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          {/* Bandeau bas glassy — frost léger pour fondre titre + metas. */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%', borderBottomLeftRadius: 20, borderBottomRightRadius: 20, overflow: 'hidden' }} pointerEvents="none">
            {Platform.OS === 'ios' ? (
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
            ) : null}
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.32)']} locations={[0, 1]} style={StyleSheet.absoluteFill} />
          </View>
          {/* coin haut-droit : état */}
          <View style={{ position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? 'rgba(174,239,77,0.22)' : 'rgba(0,0,0,0.45)', borderWidth: done ? 1.5 : 0, borderColor: 'rgba(174,239,77,0.6)' }}>
            <Icon name={locked ? 'lock' : (done ? 'check' : 'play')} size={18} color={done ? '#AEEF4D' : '#ffffff'} strokeWidth={2} />
          </View>
          {/* coin haut-gauche : cœur favori (maintenir OK 1 s pour toggler) */}
          {sessionId ? (
            <View style={{ position: 'absolute', top: 12, left: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <Icon name={fav ? 'heart_filled' : 'heart_outline'} size={17} color={fav ? '#FF4D6D' : 'rgba(255,255,255,0.92)'} strokeWidth={1.8} />
            </View>
          ) : null}
          {/* Voile blanc subtile au focus pour sortir la card du fond. */}
          {focused ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20 }]} />
          ) : null}
          <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: tint }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: tint, letterSpacing: 0.3 }}>{etapeLabel}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.82)' }}>{duree}</Text>
              {comingSoon ? <Text style={{ fontSize: 11, fontWeight: '700', color: '#E1A8C8', textTransform: 'uppercase' }}>· Bientôt</Text> : null}
            </View>
            <Text numberOfLines={2} style={{ fontSize: 19, fontWeight: '700', color: '#ffffff', letterSpacing: -0.2, lineHeight: 24 }}>{title}</Text>
          </View>
        </View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 23, borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', opacity: ring }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PilierPanelTV({ pilier, done, onToggle, onClose, lang, isRecommended, isSubscriber, onActivateSubscription, sdjIndex, saveHealthKitWorkout, initialSeanceIdx }) {
  const tr = T[lang] || T['fr'];
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const seances = getSeances(lang)[pilier.key] || [];
  const [activeVideo, setActiveVideo] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebratedSeance, setCelebratedSeance] = useState(null);
  const [celebratedIdx, setCelebratedIdx] = useState(null);
  const [showReflection, setShowReflection] = useState(false);
  const [showDemoLimit, setShowDemoLimit] = useState(false);
  const [resumeIndices, setResumeIndices] = useState(function () { return new Set(); });

  // Séances pratiques (la théorie Comprendre/Ressentir vit dans la Biblio).
  useCatalogVersion(); // re-render quand la liste des vidéos remote arrive
  const practical = [];
  seances.forEach(function (s, i) {
    if (s[2] === 'Comprendre' || s[2] === 'Ressentir') return;
    if (!isSeanceVisible(pilier.key, i)) return;
    practical.push({ seance: s, idx: i });
  });
  const doneCount = practical.filter(function (p) { return done[p.idx] === true || done[p.idx] === 'true'; }).length;
  const totalMin = practical.reduce(function (a, p) { return a + parseMin(p.seance[1]); }, 0);
  // Première séance jouable pour le bouton "Démarrer" (sinon 1re pratique).
  let firstPlayableIdx = practical.length ? practical[0].idx : 0;
  for (let k = 0; k < practical.length; k++) {
    if (hasVideo(pilier.key, practical[k].idx)) { firstPlayableIdx = practical[k].idx; break; }
  }

  useEffect(function () {
    let cancelled = false;
    (async function () {
      const next = await getResumeIndicesForPilier(pilier.key);
      if (!cancelled) setResumeIndices(next);
    })();
    return function () { cancelled = true; };
  }, [pilier.key, activeVideo]);

  useEffect(function () {
    if (initialSeanceIdx != null && activeVideo == null) {
      if (canAccessSeanceIndex(initialSeanceIdx, isSubscriber, pilier.key)) {
        setActiveVideo(initialSeanceIdx);
      }
    }
  }, []);

  function tryOpenSeance(i) {
    if (!canAccessSeanceIndex(i, isSubscriber, pilier.key)) {
      onActivateSubscription && onActivateSubscription();
      return;
    }
    hapticLight();
    const sessionId = buildSessionId(pilier.key, i);
    if (sessionId) prefetchSignedVideoUrl(sessionId, 'mp4');
    setActiveVideo(i);
  }

  if (activeVideo !== null) {
    return (
      <Modal
        visible
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
        onRequestClose={function () { setActiveVideo(null); }}
      >
        <VideoPlayer
          key={pilier.key + '-' + activeVideo}
          seance={seances[activeVideo]}
          pilier={pilier}
          lang={lang}
          seanceIndex={activeVideo}
          isDemo={activeVideo === sdjIndex && !isSubscriber}
          onClose={function () { setShowDemoLimit(false); setActiveVideo(null); }}
          onComplete={function () { setCelebratedSeance(seances[activeVideo]); setCelebratedIdx(activeVideo); onToggle(activeVideo); setActiveVideo(null); setShowCelebration(true); }}
          onDemoLimit={function () { setShowDemoLimit(true); }}
          saveHealthKitWorkout={saveHealthKitWorkout}
        />
        {showDemoLimit && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50, overflow: 'hidden', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)' }}>
            <BlurView intensity={Platform.OS === 'ios' ? 90 : 0} tint="dark" style={{ paddingVertical: 24, paddingHorizontal: 28, alignItems: 'center', backgroundColor: 'rgba(10,20,35,0.6)' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', textAlign: 'center', marginBottom: 12 }}>{tr.demo_limit}</Text>
              <HeroPillButton label={tr.paywall_start || "S'abonner"} variant="primary" focusPreferred onPress={function () { setShowDemoLimit(false); setActiveVideo(null); if (onActivateSubscription) onActivateSubscription(); }} />
            </BlurView>
          </View>
        )}
      </Modal>
    );
  }

  const heroH = Math.round(SH * 0.42);
  const cardW = Math.floor((SW - SIDE * 2 - GAP * (COLS - 1)) / COLS);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      {/* Backdrop "monde" aquatique (même fond splash que le reste de la TV). */}
      <AquaticBackground density="rich" contentOpacity={0.85} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* Hero */}
        <View style={{ height: heroH, overflow: 'hidden' }}>
          <Image source={PILIER_IMAGES[pilier.key]} contentFit="cover" transition={250} cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', '#000000']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          {/* retour haut-gauche */}
          <View style={{ position: 'absolute', top: 44, left: SIDE }}>
            <HeroPillButton label={tr.retour || (isFr ? 'Retour' : 'Back')} variant="secondary" onPress={onClose} />
          </View>
          <View style={{ position: 'absolute', left: SIDE, right: SIDE, bottom: 48 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <Text numberOfLines={1} style={{ fontSize: 72, fontWeight: '800', color: '#ffffff', letterSpacing: -1.5 }}>{pilier.label}</Text>
              {isRecommended ? (
                <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(0,215,255,0.2)', borderWidth: 1, borderColor: 'rgba(0,215,255,0.7)', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="star" size={14} color="rgba(0,220,255,0.95)" strokeWidth={2} />
                  <Text style={{ fontSize: 14, color: 'rgba(0,220,255,0.95)', letterSpacing: 1 }}>{tr.recommande_pour_toi || 'Pour toi'}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 26, fontWeight: '500', color: 'rgba(255,255,255,0.82)', marginBottom: 22 }}>
              {practical.length + ' séances · ~' + totalMin + ' min · ' + doneCount + '/' + practical.length + ' ' + (isFr ? 'faites' : 'done')}
            </Text>
            <HeroPillButton
              label={doneCount > 0 ? (isFr ? 'Continuer' : 'Continue') : (isFr ? "Commencer l'exercice" : 'Start')}
              variant="primary"
              focusPreferred
              onPress={function () { tryOpenSeance(firstPlayableIdx); }}
            />
          </View>
        </View>

        {/* Grille des séances */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: SIDE, paddingTop: 36 }}>
          {practical.map(function (p, n) {
            const s = p.seance;
            const i = p.idx;
            const isDone = done[i] === true || done[i] === 'true';
            const noVideo = !s[3] && !hasVideo(pilier.key, i);
            const locked = !noVideo && !canAccessSeanceIndex(i, isSubscriber, pilier.key);
            return (
              <SeanceCardTV
                key={pilier.key + '_' + i}
                width={cardW}
                title={s[0]}
                duree={s[1]}
                etape={s[2]}
                etapeLabel={(tr.etapes && tr.etapes[s[2]]) || s[2]}
                done={isDone}
                locked={locked}
                comingSoon={isComingSoon(pilier.key, i)}
                image={pickSessionImage(pilier.key, i)}
                sessionId={pilier.key + '_' + i}
                focusPreferred={false}
                onPress={function () { tryOpenSeance(i); }}
              />
            );
          })}
        </View>
      </ScrollView>

      {showCelebration && (
        <View pointerEvents="auto" style={[StyleSheet.absoluteFillObject, { zIndex: 200 }]}>
          <SeanceCompleteTV
            isFr={isFr}
            durationLabel={celebratedSeance ? celebratedSeance[1] : null}
            seanceTitle={celebratedSeance ? celebratedSeance[0] : null}
            pilierLabel={pilier.label}
            onContinue={function () { setShowCelebration(false); setShowReflection(true); }}
            onClose={function () { setShowCelebration(false); setShowReflection(true); onClose && onClose(); }}
          />
        </View>
      )}
      <PostSessionReflection
        visible={showReflection}
        sessionId={celebratedIdx != null ? pilier.key + '_' + celebratedIdx : null}
        lang={lang}
        onClose={function () { setShowReflection(false); }}
      />
    </View>
  );
}
