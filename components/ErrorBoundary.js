import React, { Component } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Évite un écran blanc si une erreur JS remonte hors d’un try/catch.
 */
export class ErrorBoundary extends Component {
  state = { err: null };

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    if (__DEV__) console.warn('[FluidBody] ErrorBoundary', err, info?.componentStack);
  }

  render() {
    if (this.state.err) {
      return (
        <View style={styles.wrap}>
          <LinearGradient colors={['#000e18', '#002d48', '#001828']} style={StyleSheet.absoluteFill} />
          <Text style={styles.title}>Un souci est survenu</Text>
          <Text style={styles.sub}>Tu peux relancer l’app. Si ça revient, mets à jour FluidBody.</Text>
          <Pressable
            onPress={() => this.setState({ err: null })}
            style={styles.btn}
            accessibilityRole="button"
            accessibilityLabel="Réessayer"
          >
            <Text style={styles.btnTxt}>Réessayer</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#000e18' },
  title: { fontSize: 20, fontWeight: '600', color: 'rgba(230,248,255,0.96)', textAlign: 'center', marginBottom: 12 },
  sub: { fontSize: 14, fontWeight: '300', color: 'rgba(0,195,230,0.65)', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  btn: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,235,255,0.5)', backgroundColor: 'rgba(0,120,160,0.25)' },
  btnTxt: { fontSize: 15, fontWeight: '600', color: 'rgba(230,250,255,0.95)', letterSpacing: 1 },
});
