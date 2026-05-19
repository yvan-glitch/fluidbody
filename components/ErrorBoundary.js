import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';

// ErrorBoundary is the outermost safety net; the React tree is broken when it
// renders, so we can't pull `lang` through context or hooks. We sniff the
// device locale once at construction time and pick FR or EN. Any non-FR
// locale falls back to English so an English-speaking reviewer never sees the
// French message.
let _getLocales = null;
try { _getLocales = require('expo-localization').getLocales; } catch (e) {}

function detectLang() {
  try {
    if (!_getLocales) return 'fr';
    const arr = _getLocales();
    const code = (arr && arr[0] && arr[0].languageCode) || 'fr';
    return code.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  } catch (e) { return 'fr'; }
}

const I18N = {
  fr: {
    title: 'Oups — une erreur est survenue',
    sub: 'Relance l’app ou recharge JavaScript.',
    retry: 'Réessayer',
  },
  en: {
    title: 'Oops — something went wrong',
    sub: 'Restart the app or reload JavaScript.',
    retry: 'Retry',
  },
};

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this._lang = detectLang();
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === 'function') {
      try { this.props.onError(error, info); } catch (e) {}
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const t = I18N[this._lang] || I18N.fr;

    return (
      <View style={{ flex: 1, backgroundColor: '#000e18', paddingTop: 70, paddingHorizontal: 18 }}>
        <Text style={{ color: 'rgba(215,248,255,0.95)', fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
          {t.title}
        </Text>
        <Text style={{ color: 'rgba(0,210,250,0.7)', fontSize: 12, marginBottom: 14 }}>
          {t.sub}
        </Text>
        {!!this.state.error?.message && (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 18 }}>
              {String(this.state.error.message)}
            </Text>
          </ScrollView>
        )}
        <TouchableOpacity
          onPress={() => this.setState({ hasError: false, error: null })}
          accessibilityRole="button"
          accessibilityLabel={t.retry}
          style={{
            height: 52,
            borderRadius: 26,
            backgroundColor: 'rgba(0,180,235,0.25)',
            borderWidth: 1,
            borderColor: 'rgba(0,220,255,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ color: 'rgba(230,250,255,0.95)', fontWeight: '700', letterSpacing: 1 }}>
            {t.retry}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
}

