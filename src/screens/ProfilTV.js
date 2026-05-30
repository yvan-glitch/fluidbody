// ProfilTV — version simplifiée du profil pour Apple TV.
//
// Pas d'édition de poids/taille/objectifs/etc : la TV est en
// consommation, l'édition se fait sur iPhone. On affiche 4 cards
// focusables : statut abonnement, infos compte, support, déconnexion.
//
// Le compte est forcément loggué quand on arrive ici (le root nav
// d'App.js fait `IS_TV && !supaUser` → TVLoginScreen). Donc on n'a
// pas besoin de gérer le cas anonyme.

import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { T } from '../constants/data';
import AnimatedPlus from '../components/AnimatedPlus';
import { AquaticBackground, GlassCardTV } from '../components/tv';

function Card({ label, value, focusPreferred, onPress, accent, danger }) {
  const ringAccent = danger ? 'green' : (accent ? 'green' : 'cyan');
  const variant = onPress ? 'elevated' : 'standard';
  return (
    <GlassCardTV
      onPress={onPress}
      focusPreferred={focusPreferred}
      accent={ringAccent}
      variant={variant}
      shape="card"
      padding={0}
      tiltOnFocus={false}
      enhanced
      style={styles.card}
      contentStyle={styles.cardContent}
      accessibilityLabel={label + ' ' + value}
    >
      <Text
        style={[
          styles.cardLabel,
          { color: danger ? 'rgba(255,170,170,0.85)' : (accent ? '#AEEF4D' : 'rgba(255,255,255,0.6)') },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[styles.cardValue, danger ? { color: '#FF9090' } : null]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </GlassCardTV>
  );
}

export default function ProfilTV({
  lang,
  supaUser,
  isSubscriber,
  isAdmin,
  onLogout,
  onClose,
  onOpenSabrina,
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
      <AquaticBackground density="normal" contentOpacity={0.7} />

      <View style={styles.header}>
        <Text style={styles.brand}>FLUIDBODY<AnimatedPlus style={styles.brandPlus}>+</AnimatedPlus></Text>
        <Text style={styles.title}>{isFr ? 'Mon compte' : 'My account'}</Text>
        {onClose ? (
          <TouchableOpacity
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
        {onOpenSabrina ? (
          <Card
            label={isFr ? 'Votre coach' : 'Your coach'}
            value={isFr ? 'Découvrir Sabrina' : 'Discover Sabrina'}
            accent
            onPress={onOpenSabrina}
          />
        ) : null}
        <Card
          label={isFr ? 'Support' : 'Support'}
          value="yvan@espace-pilates.ch"
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
  root: { flex: 1, backgroundColor: '#000e18', paddingHorizontal: 100, paddingTop: 90, paddingBottom: 70 },
  header: { marginBottom: 64, flexDirection: 'row', alignItems: 'baseline' },
  brand: { fontSize: 30, fontWeight: '900', color: '#ffffff', letterSpacing: 3 },
  brandPlus: { color: '#AEEF4D', fontWeight: '900', fontSize: 34, marginLeft: 8 },
  title: { fontSize: 64, fontWeight: '200', color: '#ffffff', letterSpacing: -1, marginLeft: 40, flex: 1, lineHeight: 72 },
  backBtn: {
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(8,24,40,0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(174,239,77,0.4)',
  },
  backBtnText: { fontSize: 19, color: '#AEEF4D', fontWeight: '700', letterSpacing: 0.5 },

  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 28,
    marginBottom: 40,
  },
  card: {
    width: '47%',
  },
  cardContent: {
    paddingVertical: 36,
    paddingHorizontal: 32,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  cardValue: {
    fontSize: 26,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.3,
    lineHeight: 32,
  },

  footnote: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 'auto',
    paddingHorizontal: 80,
    lineHeight: 26,
  },
});
