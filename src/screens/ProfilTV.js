// ProfilTV — version simplifiée du profil pour Apple TV.
//
// Pas d'édition de poids/taille/objectifs/etc : la TV est en
// consommation, l'édition se fait sur iPhone. On affiche 4 cards
// focusables : statut abonnement, infos compte, support, déconnexion.
//
// Le compte est forcément loggué quand on arrive ici (le root nav
// d'App.js fait `IS_TV && !supaUser` → TVLoginScreen). Donc on n'a
// pas besoin de gérer le cas anonyme.

import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { T } from '../constants/data';
import AnimatedPlus from '../components/AnimatedPlus';
import { tvFocusProps, TV_FOCUS_RING } from '../utils/platformTV';

function Card({ label, value, focusPreferred, onPress, accent, danger }) {
  const [focused, setFocused] = useState(false);
  const focusStyle = focused ? { transform: [{ scale: 1.04 }], ...TV_FOCUS_RING } : null;
  const border = danger
    ? 'rgba(255,90,90,0.4)'
    : (accent ? '#AEEF4D' : 'rgba(255,255,255,0.18)');
  const bg = danger
    ? 'rgba(255,50,50,0.10)'
    : (accent ? 'rgba(174,239,77,0.10)' : 'rgba(255,255,255,0.06)');
  return (
    <TouchableOpacity
      {...tvFocusProps(focusPreferred)}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      activeOpacity={0.85}
      disabled={!onPress}
      style={[styles.card, { borderColor: border, backgroundColor: bg }, focusStyle]}
    >
      <Text style={[styles.cardLabel, { color: accent ? '#AEEF4D' : 'rgba(255,255,255,0.6)' }]}>{label}</Text>
      <Text style={[styles.cardValue, danger ? { color: '#FF7A7A' } : null]} numberOfLines={2}>{value}</Text>
    </TouchableOpacity>
  );
}

export default function ProfilTV({
  lang,
  supaUser,
  isSubscriber,
  isAdmin,
  onLogout,
  onClose,
}) {
  const tr = T[lang] || T['fr'];
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;

  const subStatus = isAdmin
    ? (isFr ? 'Admin · accès complet' : 'Admin · full access')
    : (isSubscriber
      ? (tr.subscription_status_active || (isFr ? 'Actif' : 'Active'))
      : (tr.subscription_status_free || (isFr ? 'Découverte' : 'Free')));

  function confirmLogout() {
    Alert.alert(
      'FluidBody+',
      isFr
        ? 'Te déconnecter de cette Apple TV ? Tu pourras te reconnecter via le QR code.'
        : 'Sign out of this Apple TV? You can sign back in via the QR code.',
      [
        { text: isFr ? 'Annuler' : 'Cancel', style: 'cancel' },
        { text: isFr ? 'Déconnexion' : 'Sign out', style: 'destructive', onPress: function() { onLogout && onLogout(); } },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#000a1a', '#001a2e', '#003a55']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Text style={styles.brand}>FLUIDBODY<AnimatedPlus style={styles.brandPlus}>+</AnimatedPlus></Text>
        <Text style={styles.title}>{isFr ? 'Mon compte' : 'My account'}</Text>
        {onClose ? (
          <TouchableOpacity
            {...tvFocusProps(false)}
            onPress={onClose}
            style={styles.backBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.backBtnText}>{tr.retour || (isFr ? 'Retour' : 'Back')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.cardsRow}>
        <Card
          label={tr.subscription_status_label || (isFr ? 'Abonnement' : 'Subscription')}
          value={subStatus}
          accent={isSubscriber || isAdmin}
          focusPreferred
        />
        <Card
          label="Email"
          value={supaUser?.email || ''}
        />
        <Card
          label={isFr ? 'Support' : 'Support'}
          value={isFr ? 'yvan@espace-pilates.ch' : 'yvan@espace-pilates.ch'}
        />
        <Card
          label={isFr ? 'Déconnexion' : 'Sign out'}
          value={isFr ? 'Se déconnecter de cette TV' : 'Sign out of this TV'}
          danger
          onPress={confirmLogout}
        />
      </View>

      <Text style={styles.footnote}>
        {isFr
          ? 'Pour modifier ton profil (poids, taille, objectifs…), utilise l\'app iPhone Fluidbody.'
          : 'To edit your profile (weight, height, goals…), use the Fluidbody iPhone app.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000e18', paddingHorizontal: 80, paddingTop: 80, paddingBottom: 60 },
  header: { marginBottom: 60, flexDirection: 'row', alignItems: 'baseline' },
  brand: { fontSize: 28, fontWeight: '900', color: '#ffffff', letterSpacing: 2 },
  brandPlus: { color: '#AEEF4D', fontWeight: '900', fontSize: 32, marginLeft: 8 },
  title: { fontSize: 56, fontWeight: '300', color: '#ffffff', letterSpacing: -0.5, marginLeft: 36, flex: 1 },
  backBtn: {
    paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backBtnText: { fontSize: 18, color: '#AEEF4D', fontWeight: '600' },

  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
    marginBottom: 40,
  },
  card: {
    width: '47%',
    paddingVertical: 32,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.2,
  },

  footnote: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 'auto',
    paddingHorizontal: 80,
    lineHeight: 24,
  },
});
