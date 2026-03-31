import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
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

    return (
      <View style={{ flex: 1, backgroundColor: '#000e18', paddingTop: 70, paddingHorizontal: 18 }}>
        <Text style={{ color: 'rgba(215,248,255,0.95)', fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
          Oups — une erreur est survenue
        </Text>
        <Text style={{ color: 'rgba(0,210,250,0.7)', fontSize: 12, marginBottom: 14 }}>
          Relance l’app ou recharge JavaScript.
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
            Réessayer
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
}

