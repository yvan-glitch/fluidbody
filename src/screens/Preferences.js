// Preferences — écran "Profil > Préférences" iPhone.
//
// Deux sections :
//   - Lecture : qualité streaming (picker ActionSheet), audio background (toggle)
//   - Téléchargements : HD systématique (toggle), Wi-Fi only (toggle)
//
// Lecture du cache mémoire (getCachedPrefs) + abonnement live aux changements
// via subscribePrefs. Chaque tap toggle écrit dans AsyncStorage et notifie
// les abonnés (VideoPlayer / DownloadButton / videoUrl récupèrent les
// nouvelles valeurs sans cold reload).

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Platform, ActionSheetIOS, Alert, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { T } from '../constants/data';
import { getCachedPrefs, setPref, subscribePrefs } from '../utils/userPreferences';

function qualityLabel(q, isFr) {
  if (q === 'auto') return isFr ? 'Auto' : 'Auto';
  if (q === 'eco') return isFr ? 'Économique' : 'Economical';
  if (q === 'hd') return 'HD';
  return 'Standard';
}

function PrefRow({ label, sub, right, onPress, last }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.82 : 1}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#ffffff', letterSpacing: -0.1 }}>{label}</Text>
        {sub ? (
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3, lineHeight: 16 }}>{sub}</Text>
        ) : null}
      </View>
      {right}
    </Wrapper>
  );
}

function Section({ title, children }) {
  return (
    <View style={{ marginHorizontal: 16, marginBottom: 22 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10, paddingHorizontal: 4 }}>{title}</Text>
      <View style={{ borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(0,18,38,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
        {children}
      </View>
    </View>
  );
}

export default function PreferencesScreen({ visible, lang, onClose }) {
  const tr = T[lang] || T.fr;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;

  const [prefs, setPrefsState] = useState(getCachedPrefs());

  useEffect(function () {
    if (!visible) return undefined;
    const unsub = subscribePrefs(function (next) { setPrefsState(Object.assign({}, next)); });
    return unsub;
  }, [visible]);

  if (!visible) return null;

  function openStreamQualityPicker() {
    const title = isFr ? 'Qualité de streaming' : 'Streaming quality';
    const message = isFr
      ? 'Auto laisse le serveur choisir selon ta connexion.'
      : 'Auto lets the server pick based on your connection.';
    const optAuto = isFr ? 'Auto (recommandé)' : 'Auto (recommended)';
    const optEco = isFr ? 'Économique' : 'Economical';
    const optStd = 'Standard';
    const optHd = 'HD';
    const optCancel = isFr ? 'Annuler' : 'Cancel';
    if (Platform.OS === 'ios' && ActionSheetIOS && ActionSheetIOS.showActionSheetWithOptions) {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: title,
          message: message,
          options: [optAuto, optEco, optStd, optHd, optCancel],
          cancelButtonIndex: 4,
          userInterfaceStyle: 'dark',
        },
        function (i) {
          if (i === 0) setPref('streamQuality', 'auto');
          else if (i === 1) setPref('streamQuality', 'eco');
          else if (i === 2) setPref('streamQuality', 'standard');
          else if (i === 3) setPref('streamQuality', 'hd');
        }
      );
      return;
    }
    Alert.alert(title, message, [
      { text: optAuto, onPress: function () { setPref('streamQuality', 'auto'); } },
      { text: optEco,  onPress: function () { setPref('streamQuality', 'eco'); } },
      { text: optStd,  onPress: function () { setPref('streamQuality', 'standard'); } },
      { text: optHd,   onPress: function () { setPref('streamQuality', 'hd'); } },
      { text: optCancel, style: 'cancel' },
    ]);
  }

  function toggle(key, next) {
    setPref(key, next);
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: '#000a1a' }}>
      <LinearGradient
        colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']}
        locations={[0, 0.18, 0.4, 0.6, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={{ paddingTop: 60, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={{ paddingVertical: 6, marginBottom: 18 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#AEEF4D', letterSpacing: 0.5 }}>{isFr ? '← Retour' : '← Back'}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, marginBottom: 6 }}>
            {tr.prefs_title || (isFr ? 'Préférences' : 'Preferences')}
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.2 }}>
            {tr.prefs_subtitle || (isFr ? 'Personnalise la lecture et les téléchargements.' : 'Customize playback and downloads.')}
          </Text>
        </View>

        {/* Section 1 — Lecture */}
        <Section title={tr.prefs_section_playback || (isFr ? 'Lecture' : 'Playback')}>
          <PrefRow
            label={tr.prefs_stream_quality || (isFr ? 'Qualité de streaming' : 'Streaming quality')}
            sub={qualityLabel(prefs.streamQuality, isFr)}
            onPress={openStreamQualityPicker}
            right={<Text style={{ fontSize: 22, color: 'rgba(174,239,77,0.7)', fontWeight: '300' }}>{'›'}</Text>}
          />
          <PrefRow
            label={tr.prefs_bg_audio || (isFr ? 'Lecture audio en arrière-plan' : 'Background audio playback')}
            sub={tr.prefs_bg_audio_sub || (isFr ? 'Continue le son si l\'app passe en arrière-plan.' : 'Keep audio playing when the app goes into background.')}
            last
            right={
              <Switch
                value={!!prefs.backgroundAudio}
                onValueChange={function (v) { toggle('backgroundAudio', v); }}
                trackColor={{ true: '#AEEF4D', false: 'rgba(255,255,255,0.18)' }}
                thumbColor="#ffffff"
              />
            }
          />
        </Section>

        {/* Section 2 — Téléchargements */}
        <Section title={tr.prefs_section_downloads || (isFr ? 'Téléchargements' : 'Downloads')}>
          <PrefRow
            label={tr.prefs_hd_always || (isFr ? 'Téléchargements HD systématiques' : 'Always download in HD')}
            sub={tr.prefs_hd_always_sub || (isFr ? 'Skip le menu de qualité et télécharge toujours en HD.' : 'Skip the quality picker and always download HD.')}
            right={
              <Switch
                value={!!prefs.hdDownloadsAlways}
                onValueChange={function (v) { toggle('hdDownloadsAlways', v); }}
                trackColor={{ true: '#AEEF4D', false: 'rgba(255,255,255,0.18)' }}
                thumbColor="#ffffff"
              />
            }
          />
          <PrefRow
            label={tr.prefs_wifi_only || (isFr ? 'Télécharger uniquement en Wi-Fi' : 'Wi-Fi only downloads')}
            sub={tr.prefs_wifi_only_sub || (isFr ? 'Évite d\'utiliser tes données mobiles.' : 'Avoid using your cellular data.')}
            last
            right={
              <Switch
                value={!!prefs.wifiOnlyDownload}
                onValueChange={function (v) { toggle('wifiOnlyDownload', v); }}
                trackColor={{ true: '#AEEF4D', false: 'rgba(255,255,255,0.18)' }}
                thumbColor="#ffffff"
              />
            }
          />
        </Section>
      </ScrollView>
    </View>
  );
}
