// PreSeanceModal — avertissement « Avant cette séance » (Phase 1, 07.10.2026).
// Remplace l'Alert native (non stylable) : texte à fort contraste, bouton
// principal vert de la charte, bouton secondaire discret. Affiché une seule
// fois (cf. src/utils/preSeance.js).

import { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, AccessibilityInfo, findNodeHandle } from 'react-native';
import { T } from '../constants/data';

const LIME = '#AEEF4D';

export default function PreSeanceModal({ visible, lang, onAccept, onCancel }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const tr = isFr ? T.fr : T.en;
  const titleRef = useRef(null);

  // Focus VoiceOver sur le titre à l'ouverture.
  useEffect(function () {
    if (!visible) return undefined;
    const t = setTimeout(function () {
      try {
        const node = titleRef.current ? findNodeHandle(titleRef.current) : null;
        if (node) AccessibilityInfo.setAccessibilityFocus(node);
      } catch (e) {}
    }, 350);
    return function () { clearTimeout(t); };
  }, [visible]);

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}
      onRequestClose={onCancel}
    >
      <View
        accessibilityViewIsModal
        style={{ flex: 1, backgroundColor: 'rgba(0,6,14,0.82)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        <View style={{ width: '100%', maxWidth: 420, maxHeight: '90%', borderRadius: 22, backgroundColor: '#0B1A26', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
          <ScrollView contentContainerStyle={{ padding: 24 }} bounces={false}>
            <Text
              ref={titleRef}
              accessibilityRole="header"
              maxFontSizeMultiplier={2}
              style={{ fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 }}
            >
              {tr.preseance_title}
            </Text>
            <Text
              maxFontSizeMultiplier={2.2}
              style={{ fontSize: 17, lineHeight: 25, color: '#FFFFFF', marginBottom: 26 }}
            >
              {tr.preseance_body}
            </Text>
            <TouchableOpacity
              onPress={onAccept}
              accessibilityRole="button"
              accessibilityLabel={tr.preseance_ok}
              activeOpacity={0.85}
              style={{ minHeight: 52, borderRadius: 26, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12 }}
            >
              <Text maxFontSizeMultiplier={2} style={{ fontSize: 17, fontWeight: '700', color: '#000000', textAlign: 'center' }}>{tr.preseance_ok}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={tr.preseance_cancel}
              activeOpacity={0.7}
              style={{ minHeight: 48, marginTop: 10, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 10 }}
            >
              <Text maxFontSizeMultiplier={2} style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' }}>{tr.preseance_cancel}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
