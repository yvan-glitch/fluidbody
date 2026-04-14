import { useRef, useState, useEffect } from 'react';
import { Text, StyleSheet, View, TouchableOpacity, ScrollView, ImageBackground, Share, Alert, Modal, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import { T, PILIER_IMAGES } from '../constants/data';
import { Bulle, FloatingMedusas, BULLES } from '../components/Meduse';
import { getPiliers } from '../utils';

const COACH_IMAGE = require('../../assets/coach.jpg');
const DEV_IMAGE = require('../../assets/yvan.webp');

// ══════════════════════════════════
// PROFIL — Abonnement + Compte
// ══════════════════════════════════
function ProfilScreen({ prenom, done, lang, streak, supabase, supaUser, onLogout, isSubscriber, onRestorePurchases, onReset }) {
  var tr = T[lang] || T['fr'];
  var shareRef = useRef(null);
  var [showCoachBio, setShowCoachBio] = useState(false);
  var [showDevBio, setShowDevBio] = useState(false);
  var [notifHour, setNotifHour] = useState(9);
  var [pauseEnabled, setPauseEnabled] = useState(true);
  var [storageUsed, setStorageUsed] = useState('0 B');

  useEffect(function() {
    AsyncStorage.getItem('fluid_notif_hour').then(function(v) { if (v) setNotifHour(parseInt(v) || 9); });
    AsyncStorage.getItem('fluid_notif_pause_enabled').then(function(v) { setPauseEnabled(v !== 'false'); });
    try {
      var { getStorageUsed, formatBytes } = require('../components/DownloadManager');
      getStorageUsed().then(function(s) { setStorageUsed(formatBytes(s)); });
    } catch(e) {}
  }, []);
  var totalDoneVal = done ? Object.values(done).flat().filter(Boolean).length : 0;
  var pctVal = Math.round(totalDoneVal / 160 * 100);
  var piliers = getPiliers(lang);
  var bestPilier = piliers.reduce(function(best, p) { var c = (done[p.key] || []).filter(Boolean).length; return c > best.count ? { p: p, count: c } : best; }, { p: piliers[0], count: 0 });

  async function shareWithCard() {
    if (shareRef.current) {
      try {
        var uri = await shareRef.current.capture({ format: 'png', quality: 1 });
        Share.share({ url: uri, message: 'FluidBody+ Pilates\nhttps://apps.apple.com/app/fluidbody/id6746387875' }).catch(function() {});
        return;
      } catch(e) {}
    }
    Share.share({ message: (tr.partage_share_msg || 'FluidBody+ Pilates') + '\n' + pctVal + '% · ' + totalDoneVal + ' ' + (tr.m_seances || 'séances') + ' · 🔥' + (streak || 0) + '\nhttps://apps.apple.com/app/fluidbody/id6746387875' }).catch(function() {});
  }
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient pointerEvents="none" colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, overflow: 'visible' }} pointerEvents="none">
        {BULLES.map(function(b, i) { return <Bulle key={i} {...b} />; })}
      </View>
      <FloatingMedusas />
      <ScrollView contentContainerStyle={{ paddingTop: 62, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#000000' }}>{prenom ? prenom.slice(0, 2).toUpperCase() : 'YT'}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#ffffff' }}>{prenom || 'Profil'}</Text>
              <Text style={{ fontSize: 13, color: 'rgba(174,239,77,0.6)' }}>FluidBody · Pilates</Text>
            </View>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>{tr.partage_title || 'Partage'}</Text>

          <ViewShot ref={shareRef} options={{ format: 'png', quality: 1 }}>
            <LinearGradient colors={['#00bdd0', '#005878', '#002d48', '#000e18']} style={{ borderRadius: 16, padding: 22, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff' }}>FLUIDBODY<Text style={{ fontWeight: '900', color: '#AEEF4D', fontSize: 26 }}>+</Text></Text>
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D' }}>
                  <ImageBackground source={COACH_IMAGE} resizeMode="cover" style={{ flex: 1 }} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff' }}>{pctVal}%</Text>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{tr.resume_global || 'Global'}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff' }}>{'🔥'}{streak || 0}</Text>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>Streak</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff' }}>{totalDoneVal}</Text>
                  <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{tr.m_seances || 'Séances'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: '#AEEF4D', marginRight: 10 }}>
                  <ImageBackground source={PILIER_IMAGES[bestPilier.p.key]} resizeMode="cover" style={{ flex: 1 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>{bestPilier.p.label}</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{bestPilier.count}/20</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#AEEF4D' }}>{Math.round(bestPilier.count / 20 * 100)}%</Text>
              </View>
              <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 12 }}>fluidbody.app · Pilates & More</Text>
            </LinearGradient>
          </ViewShot>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity onPress={shareWithCard} activeOpacity={0.85} style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: '#AEEF4D', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none"><Path d="M12 2l3 3h-2v8h-2V5H9l3-3z" fill="#000" /><Path d="M4 14v6h16v-6" stroke="#000" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#000000' }}>{tr.partage_btn || 'Partager'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={function() {
              Share.share({ message: (tr.partage_invite_msg || 'Rejoins-moi sur FluidBody+ Pilates !') + '\nhttps://apps.apple.com/app/fluidbody/id6746387875' }).catch(function() {});
            }} activeOpacity={0.85} style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.partage_inviter || 'Inviter'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#AEEF4D' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.coach_title || 'Votre Coach'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 70, height: 70, borderRadius: 35, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D', marginRight: 14 }}>
              <ImageBackground source={COACH_IMAGE} resizeMode="cover" style={{ flex: 1 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff' }}>{tr.coach_name || 'Sabrina'}</Text>
              <Text style={{ fontSize: 12, color: '#AEEF4D', marginTop: 2 }}>{tr.coach_subtitle || 'Experte Pilates · 30 ans d\'expérience'}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, fontWeight: '300', color: 'rgba(255,255,255,0.7)', lineHeight: 20, fontStyle: 'italic', marginBottom: 14 }}>{tr.coach_bio || 'Passionnée par le mouvement conscient, je vous guide vers un corps plus libre et plus fort.'}</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={function() { setShowCoachBio(true); }} style={{ paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.coach_more || 'En savoir plus'}</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showCoachBio} animationType="slide" transparent statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,14,24,0.95)', justifyContent: 'center' }}>
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,28,50,0.95)', borderRadius: 20, padding: 24, maxHeight: Dimensions.get('window').height * 0.8, borderWidth: 1, borderColor: 'rgba(174,239,77,0.25)' }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 90, height: 90, borderRadius: 45, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D', marginBottom: 12 }}>
                    <ImageBackground source={COACH_IMAGE} resizeMode="cover" style={{ flex: 1 }} />
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff' }}>{tr.coach_name || 'Sabrina'}</Text>
                  <Text style={{ fontSize: 13, color: '#AEEF4D', marginTop: 4 }}>{tr.coach_subtitle || 'Experte Pilates · 30 ans d\'expérience'}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '300', color: 'rgba(255,255,255,0.8)', lineHeight: 22 }}>{tr.coach_full_bio || ''}</Text>
              </ScrollView>
              <TouchableOpacity onPress={function() { setShowCoachBio(false); }} style={{ marginTop: 18, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.15)', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.notif_section || 'Rappels'}</Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{tr.notif_hour_label || 'Heure du rappel'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={function() {
                var h = Math.max(5, notifHour - 1);
                setNotifHour(h);
                AsyncStorage.setItem('fluid_notif_hour', String(h));
              }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, color: '#AEEF4D', fontWeight: '700' }}>{'\u2212'}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', minWidth: 50, textAlign: 'center' }}>{notifHour}h00</Text>
              <TouchableOpacity onPress={function() {
                var h = Math.min(22, notifHour + 1);
                setNotifHour(h);
                AsyncStorage.setItem('fluid_notif_hour', String(h));
              }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(174,239,77,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, color: '#AEEF4D', fontWeight: '700' }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{tr.notif_pause_label || 'Pauses actives au bureau'}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{tr.notif_pause_sub || '9h-17h en semaine'}</Text>
            </View>
            <TouchableOpacity onPress={function() {
              var next = !pauseEnabled;
              setPauseEnabled(next);
              AsyncStorage.setItem('fluid_notif_pause_enabled', String(next));
            }} style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: pauseEnabled ? '#AEEF4D' : 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 2 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#ffffff', alignSelf: pauseEnabled ? 'flex-end' : 'flex-start' }} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.dl_title || 'Téléchargements'}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{tr.dl_storage || 'Espace utilisé'}</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>{storageUsed}</Text>
          </View>
          <TouchableOpacity onPress={function() {
            Alert.alert(tr.dl_confirm_delete_all || 'Supprimer tous les téléchargements ?', '', [
              { text: tr.reset_cancel || 'Annuler', style: 'cancel' },
              { text: tr.dl_delete_all || 'Tout supprimer', style: 'destructive', onPress: async function() {
                try {
                  var { deleteAllDownloads } = require('../components/DownloadManager');
                  await deleteAllDownloads();
                  setStorageUsed('0 B');
                } catch(e) {}
              }},
            ]);
          }} style={{ paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,50,50,0.1)', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,90,90,0.9)' }}>{tr.dl_delete_all || 'Tout supprimer'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 12 }}>{tr.subscription_status_label}</Text>
          <Text style={{ fontSize: 15, fontWeight: '400', color: '#AEEF4D', marginBottom: 16 }}>{isSubscriber ? tr.subscription_status_active : tr.subscription_status_free}</Text>
          <TouchableOpacity onPress={onRestorePurchases} style={{ paddingVertical: 13, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.10)', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>{tr.subscription_reset}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 14 }}>{tr.mon_compte}</Text>
          {supaUser && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Email</Text>
              <Text style={{ fontSize: 14, color: '#AEEF4D' }} numberOfLines={1}>{supaUser.email}</Text>
            </View>
          )}
          {tr.compte_info.map(function(item, i) {
            return (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: i < tr.compte_info.length - 1 ? 0.5 : 0, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>{item[0]}</Text>
                <Text style={{ fontSize: 14, color: '#AEEF4D' }}>{item[1]}</Text>
              </View>
            );
          })}
        </View>

        {supaUser && onLogout && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            <TouchableOpacity onPress={onLogout} style={{ paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,50,50,0.08)', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,100,100,0.85)' }}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(174,239,77,0.25)' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.dev_title || 'Développeur'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ width: 70, height: 70, borderRadius: 35, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D', marginRight: 14 }}>
              <ImageBackground source={DEV_IMAGE} resizeMode="cover" style={{ flex: 1 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#ffffff' }}>{tr.dev_name || 'Yvan'}</Text>
              <Text style={{ fontSize: 12, color: '#AEEF4D', marginTop: 2 }}>{tr.dev_subtitle || 'Fondateur · Ingénieur & Spécialiste Pilates'}</Text>
            </View>
          </View>
          <TouchableOpacity activeOpacity={0.85} onPress={function() { setShowDevBio(true); }} style={{ paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.12)', borderWidth: 1, borderColor: 'rgba(174,239,77,0.3)', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#AEEF4D' }}>{tr.dev_more || 'En savoir plus'}</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showDevBio} animationType="slide" transparent statusBarTranslucent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,14,24,0.95)', justifyContent: 'center' }}>
            <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,28,50,0.95)', borderRadius: 20, padding: 24, maxHeight: Dimensions.get('window').height * 0.8, borderWidth: 1, borderColor: 'rgba(174,239,77,0.25)' }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ width: 90, height: 90, borderRadius: 45, overflow: 'hidden', borderWidth: 2, borderColor: '#AEEF4D', marginBottom: 12 }}>
                    <ImageBackground source={DEV_IMAGE} resizeMode="cover" style={{ flex: 1 }} />
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff' }}>{tr.dev_name || 'Yvan'}</Text>
                  <Text style={{ fontSize: 13, color: '#AEEF4D', marginTop: 4 }}>{tr.dev_subtitle || 'Fondateur · Ingénieur & Spécialiste Pilates'}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '300', color: 'rgba(255,255,255,0.8)', lineHeight: 22 }}>{tr.dev_full_bio || ''}</Text>
              </ScrollView>
              <TouchableOpacity onPress={function() { setShowDevBio(false); }} style={{ marginTop: 18, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(174,239,77,0.15)', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D' }}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {!supaUser && (
          <View style={{ marginHorizontal: 20, marginBottom: 16 }}>
            <TouchableOpacity onPress={function() {
              Alert.alert(
                tr.reset_title || 'R\u00E9initialiser',
                tr.reset_confirm || 'Toutes tes donn\u00E9es seront effac\u00E9es : progression, nom de m\u00E9duse, pr\u00E9nom. Cette action est irr\u00E9versible.',
                [
                  { text: tr.reset_cancel || 'Annuler', style: 'cancel' },
                  { text: tr.reset_ok || 'R\u00E9initialiser', style: 'destructive', onPress: function() { if (onReset) onReset(); } },
                ]
              );
            }} style={{ paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,50,50,0.15)', borderWidth: 1, borderColor: 'rgba(255,80,80,0.35)', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,90,90,1)' }}>{tr.reset_btn || 'R\u00E9initialiser toutes les donn\u00E9es'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.35)', borderRadius: 16, padding: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 12 }}>{tr.profil_donnees_title || 'Confidentialité'}</Text>
          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20, marginBottom: 14 }}>{tr.profil_donnees_desc || 'Vos données restent sur votre appareil. Aucune donnée personnelle n\'est envoyée à des serveurs tiers. Les séances, la progression et les préférences sont stockées localement via AsyncStorage. Si vous vous connectez, seul votre email est synchronisé via Supabase pour sauvegarder votre profil.'}</Text>
          <View style={{ borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14 }}>🔒</Text>
              <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.7)', flex: 1 }}>{tr.profil_donnees_local || 'Données stockées localement sur votre appareil'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14 }}>🚫</Text>
              <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.7)', flex: 1 }}>{tr.profil_donnees_no_tracking || 'Aucun tracking publicitaire'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 14 }}>🍎</Text>
              <Text style={{ fontSize: 12, color: 'rgba(174,239,77,0.7)', flex: 1 }}>{tr.profil_donnees_healthkit || 'HealthKit : données lues uniquement, jamais partagées'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default ProfilScreen;
