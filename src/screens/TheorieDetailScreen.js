import { Text, View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { T, PILIER_IMAGES } from '../constants/data';
import { isComingSoon } from '../utils';
import { Bulle, BULLES } from '../components/Meduse';
import AnimatedPlus from '../components/AnimatedPlus';
import LivingBackground from '../components/LivingBackground';
import DownloadButton from '../components/DownloadButton';
import { IS_TV } from '../utils/platformTV';

function LockIcon({ size = 14, color = 'rgba(255,255,255,0.5)' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={11} width={14} height={9} rx={2} stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M8 11 V8 a4 4 0 0 1 8 0 V11" stroke={color} strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

export default function TheorieDetailScreen({ pilier, items, lang, isSubscriber, onClose, onPlay, onActivateSubscription }) {
  const tr = T[lang] || T['fr'];
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const subtitle = isFr ? `${items.length} vidéos · Comprendre & ressentir` : `${items.length} videos · Understand & feel`;
  const freeBadge = isFr ? 'Gratuit' : 'Free';
  const premiumBadge = isFr ? 'Premium' : 'Premium';
  const back = tr.retour_biblio || (isFr ? '← Retour' : '← Back');

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible', opacity: 0.3 }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>

      <ScrollView style={{ zIndex: 2 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Hero image */}
        <View style={{ height: 220, overflow: 'hidden' }}>
          <ExpoImage source={PILIER_IMAGES[pilier.key]} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(0,10,26,0.2)', 'rgba(0,10,26,0.55)', '#000a1a']}
            locations={[0, 0.55, 1]}
            style={{ flex: 1 }}
          />
        </View>

        <View style={{ paddingHorizontal: 22, marginTop: -56 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={{ paddingVertical: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 1 }}>{back}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff', letterSpacing: -0.2 }}>FLUIDBODY<AnimatedPlus style={{ marginLeft: 8, fontWeight: '900', color: '#AEEF4D', fontSize: 26 }}>+</AnimatedPlus></Text>
          </View>

          <Text style={{ fontSize: 11, color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 6 }}>{isFr ? 'Théorie' : 'Theory'}</Text>
          <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, lineHeight: 38, marginBottom: 6 }}>{pilier.label}</Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 24 }}>{subtitle}</Text>

          {items.map(({ seance, idx }, listIdx) => {
            const [titre, duree, etape, url] = seance;
            const noVideo = !url;
            const etapeLabel = (tr.etapes && tr.etapes[etape]) || etape;
            const isFree = listIdx === 0;
            const locked = !isFree && !isSubscriber;
            const handlePress = () => {
              if (noVideo) return;
              if (locked) {
                if (typeof onActivateSubscription === 'function') onActivateSubscription();
                return;
              }
              onPlay(seance, idx);
            };
            return (
              <TouchableOpacity
                key={pilier.key + '-' + idx}
                onPress={handlePress}
                disabled={noVideo}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1,
                  borderColor: locked ? 'rgba(255,255,255,0.08)' : (isFree ? 'rgba(174,239,77,0.35)' : 'rgba(255,255,255,0.08)'),
                  marginBottom: 8,
                  opacity: noVideo ? 0.45 : (locked ? 0.55 : 1),
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(174,239,77,0.10)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  {locked ? <LockIcon size={14} color="#AEEF4D" /> : <Text style={{ fontSize: 14, color: '#AEEF4D' }}>{noVideo ? '·' : '▶'}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }} numberOfLines={1}>{titre}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: '#AEEF4D', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '700' }}>{etapeLabel}</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{duree}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {isComingSoon(pilier.key, idx) ? (
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(210,140,190,0.18)', borderWidth: 1, borderColor: 'rgba(210,140,190,0.5)' }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#E1A8C8', letterSpacing: 0.6, textTransform: 'uppercase' }}>{tr.coming_soon_badge || 'Bientôt'}</Text>
                    </View>
                  ) : isFree ? (
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: '#AEEF4D' }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#AEEF4D', letterSpacing: 0.6, textTransform: 'uppercase' }}>{freeBadge}</Text>
                    </View>
                  ) : locked ? (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <LockIcon size={11} color="rgba(255,255,255,0.65)" />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 0.4, textTransform: 'uppercase' }}>{premiumBadge}</Text>
                    </View>
                  ) : null}
                  {/* Bouton download (iPhone) — visible si la séance a une vidéo.
                      Désactivé pour les séances verrouillées (paywall) ; activé
                      pour les séances gratuites + abonnés. */}
                  {!IS_TV && !noVideo ? (
                    <DownloadButton pilierKey={pilier.key} idx={idx} lang={lang} size={32} disabled={locked} />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
