// WatchConnectSheet — explication + connexion Santé/Apple Watch, ouverte
// depuis la pastille « Connecter ta montre » du lecteur (Phase 1, 07.10.2026).
// Phase 3 : quand l'app watchOS existera, cette feuille expliquera aussi
// comment lancer FLUIDBODY+ sur la montre.

import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import { T } from '../constants/data';
import { ensureHealthKitInit } from '../utils/healthkit';

const LIME = '#AEEF4D';

export default function WatchConnectSheet({ visible, lang, onClose, onNeverAgain }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const tr = isFr ? T.fr : T.en;
  const [state, setState] = useState('idle'); // idle | asking | done | unavailable

  async function connect() {
    setState('asking');
    try {
      const r = await ensureHealthKitInit();
      setState(r && r.ok ? 'done' : 'unavailable');
    } catch (e) {
      setState('unavailable');
    }
  }

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
    >
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: 'rgba(0,6,14,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ maxHeight: '88%', borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: '#0B1A26', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }} bounces={false}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ alignItems: 'center', marginBottom: 16 }}>
              <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
                <Rect x="6" y="5" width="12" height="14" rx="3.5" stroke={LIME} strokeWidth={1.6} />
                <Path d="M9 5 L9.6 2 H14.4 L15 5 M9 19 L9.6 22 H14.4 L15 19" stroke={LIME} strokeWidth={1.6} strokeLinejoin="round" />
                <Path d="M12 15s-2.6-1.7-3.4-3.3c-.6-1.2.1-2.5 1.3-2.5.7 0 1.2.4 1.5.9.3-.5.8-.9 1.5-.9 1.2 0 1.9 1.3 1.3 2.5C14.6 13.3 12 15 12 15Z" fill="#FF3B4F" />
              </Svg>
            </View>
            <Text accessibilityRole="header" maxFontSizeMultiplier={2} style={{ fontSize: 22, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 12 }}>
              {tr.watch_sheet_title}
            </Text>
            <Text maxFontSizeMultiplier={2.2} style={{ fontSize: 16, lineHeight: 23, color: '#FFFFFF', marginBottom: 12 }}>
              {tr.watch_sheet_body}
            </Text>
            <Text maxFontSizeMultiplier={2.2} style={{ fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.8)', marginBottom: 24 }}>
              {state === 'done' ? tr.watch_sheet_done : (state === 'unavailable' ? tr.watch_sheet_unavailable : tr.watch_sheet_step)}
            </Text>
            {state !== 'done' && state !== 'unavailable' ? (
              <TouchableOpacity
                onPress={connect}
                disabled={state === 'asking'}
                accessibilityRole="button"
                accessibilityState={{ busy: state === 'asking', disabled: state === 'asking' }}
                activeOpacity={0.85}
                style={{ minHeight: 52, borderRadius: 26, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12, opacity: state === 'asking' ? 0.6 : 1 }}
              >
                <Text maxFontSizeMultiplier={2} style={{ fontSize: 17, fontWeight: '700', color: '#000000', textAlign: 'center' }}>{tr.watch_sheet_cta}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              activeOpacity={0.7}
              style={{ minHeight: 48, marginTop: 10, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 10 }}
            >
              <Text maxFontSizeMultiplier={2} style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' }}>{tr.watch_sheet_close}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onNeverAgain}
              accessibilityRole="button"
              activeOpacity={0.7}
              style={{ minHeight: 44, marginTop: 6, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text maxFontSizeMultiplier={2} style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', textDecorationLine: 'underline', textAlign: 'center' }}>{tr.watch_sheet_never}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
