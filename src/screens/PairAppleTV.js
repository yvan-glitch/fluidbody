// PairAppleTV — écran iPhone qui scanne le QR affiché par TVLoginScreen.
//
// Ouvert depuis Profil → « Pairer une Apple TV ». L'utilisateur doit
// être loggué (`supaUser != null`) — sinon on affiche un message qui
// renvoie vers le sign-in d'abord.
//
// Flux :
//   1) Au mount : demande permission caméra (`expo-camera`).
//   2) Scan QR → parse → si payload reconnu, on tape sur l'edge function
//      `tv-pair` action=redeem avec le JWT + refresh token courants.
//   3) Succès → screen "Connecté ✓" auto-dismiss après 1.5 s.
//   4) Échec / pas de caméra → mode saisie manuelle (l'utilisateur tape
//      le code 12 chars qu'on affiche sous le QR sur la TV).
//
// Note tvOS : ce fichier ne doit JAMAIS être importé sur tvOS — il
// référence `expo-camera` que `app.config.js` strippe du build TV. On
// le require dynamiquement dans App.js derrière `!IS_TV`.

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import supabase from '../lib/supabase';
import { parsePairingPayload, redeemPairing } from '../utils/tvPair';
import { Icon } from '../components/Icons';

const { width: SW } = Dimensions.get('window');

// expo-camera est importé en require() pour pouvoir gracefully tomber
// en mode "saisie manuelle" si le module n'est pas dispo (ex. Expo Go
// sans dev client). On ne risque rien sur tvOS car ce fichier n'y est
// jamais importé (cf. App.js gating).
let CameraView = null;
let useCameraPermissions = null;
try {
  const mod = require('expo-camera');
  CameraView = mod.CameraView || null;
  useCameraPermissions = mod.useCameraPermissions || null;
} catch (_) {
  CameraView = null;
  useCameraPermissions = null;
}

// FIX rules-of-hooks (2026-07-23) : hooks avant tout early-return.
// On fige au chargement du module un hook toujours appelable : soit le vrai
// useCameraPermissions, soit un fallback qui renvoie [null, null]. La
// disponibilité du module ne change jamais au runtime, l'ordre des hooks
// reste donc stable.
const useCameraPermissionsSafe = useCameraPermissions || function useCameraPermissionsFallback() { return [null, null]; };

export default function PairAppleTV({ onClose, lang, supaUser }) {
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;
  const [phase, setPhase] = useState('init'); // init | scanning | manual | submitting | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [manualCode, setManualCode] = useState('');
  const lastScannedRef = useRef('');
  const submittingRef = useRef(false);

  const cameraPerm = useCameraPermissionsSafe();
  const cameraStatus = cameraPerm[0];
  const requestCameraPerm = cameraPerm[1];

  useEffect(() => {
    if (!supaUser) {
      setPhase('error');
      setErrorMsg(isFr
        ? 'Connecte-toi à FluidBody+ avant de pairer une Apple TV.'
        : 'Sign in to FluidBody+ before pairing an Apple TV.');
      return;
    }
    if (!CameraView || !useCameraPermissions) {
      // Pas de caméra → on bascule directement en saisie manuelle.
      setPhase('manual');
      return;
    }
    // Demande de permission au mount.
    if (cameraStatus && !cameraStatus.granted) {
      requestCameraPerm && requestCameraPerm();
    }
    setPhase('scanning');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supaUser]);

  async function redeem(nonce) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase('submitting');
    setErrorMsg('');
    try {
      if (!supabase) throw new Error(isFr ? 'Supabase indisponible' : 'Supabase unavailable');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || !session?.refresh_token) {
        throw new Error(isFr ? 'Session expirée — reconnecte-toi' : 'Session expired — sign in again');
      }
      await redeemPairing({
        nonce,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      setPhase('done');
      // Auto-close après 1.5 s
      setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
    } catch (e) {
      const code = e?.message || 'unknown';
      let msg = isFr ? 'Échec du pairage' : 'Pairing failed';
      if (code === 'expired' || code === 'tv-pair-410') {
        msg = isFr ? 'Le code de la TV a expiré. Génère-en un nouveau.' : 'TV code expired. Generate a new one.';
      } else if (code === 'not-found' || code === 'tv-pair-404') {
        msg = isFr ? 'Code introuvable. Vérifie qu\'il vient bien de la TV.' : 'Code not found. Make sure it\'s the one shown on the TV.';
      } else if (code === 'already-redeemed' || code === 'tv-pair-409') {
        msg = isFr ? 'Ce code a déjà été utilisé.' : 'This code has already been used.';
      } else if (code === 'bad-nonce' || code === 'tv-pair-400') {
        msg = isFr ? 'Code invalide.' : 'Invalid code.';
      }
      setErrorMsg(msg);
      setPhase('error');
    } finally {
      submittingRef.current = false;
    }
  }

  function handleBarCodeScanned({ data }) {
    if (!data || data === lastScannedRef.current) return;
    lastScannedRef.current = data;
    const nonce = parsePairingPayload(data);
    if (!nonce) {
      // Pas un QR FluidBody — on ignore silencieusement, l'utilisateur
      // peut continuer à viser le bon code.
      return;
    }
    redeem(nonce);
  }

  function submitManual() {
    const nonce = parsePairingPayload(manualCode);
    if (!nonce) {
      Alert.alert(
        'FluidBody+',
        isFr ? 'Code non reconnu. Tape les 12 caractères affichés sur la TV.' : 'Code not recognised. Type the 12 characters shown on the TV.',
      );
      return;
    }
    redeem(nonce);
  }

  function retry() {
    submittingRef.current = false;
    lastScannedRef.current = '';
    setErrorMsg('');
    if (CameraView && cameraStatus?.granted) setPhase('scanning');
    else setPhase('manual');
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#000a1a', '#001a2e', '#003a55']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.closeBtn}>{isFr ? 'Fermer' : 'Close'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isFr ? 'Pairer une Apple TV' : 'Pair an Apple TV'}</Text>
        <View style={{ width: 56 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {phase === 'scanning' && CameraView && cameraStatus?.granted && (
          <View style={styles.scanArea}>
            <View style={styles.scanFrame}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarCodeScanned}
              />
              <View style={styles.scanOverlay} pointerEvents="none">
                <View style={styles.scanCornerTL} />
                <View style={styles.scanCornerTR} />
                <View style={styles.scanCornerBL} />
                <View style={styles.scanCornerBR} />
              </View>
            </View>
            <Text style={styles.hint}>
              {isFr ? 'Vise le QR code affiché sur ton Apple TV.' : 'Aim at the QR code shown on your Apple TV.'}
            </Text>
            <TouchableOpacity onPress={() => setPhase('manual')} style={styles.linkRow}>
              <Text style={styles.linkText}>
                {isFr ? 'Saisir le code manuellement' : 'Enter the code manually'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'scanning' && (!CameraView || !cameraStatus?.granted) && (
          <View style={styles.permArea}>
            <View style={{ marginBottom: 12 }}>
              <Icon name="camera" size={56} color="#AEEF4D" />
            </View>
            <Text style={styles.permTitle}>
              {isFr ? 'Caméra requise pour scanner' : 'Camera needed to scan'}
            </Text>
            <Text style={styles.permBody}>
              {isFr
                ? 'Autorise FluidBody+ à utiliser l\'appareil photo, ou saisis le code manuellement.'
                : 'Allow FluidBody+ to use the camera, or enter the code manually.'}
            </Text>
            {requestCameraPerm ? (
              <TouchableOpacity onPress={() => requestCameraPerm()} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>
                  {isFr ? 'Autoriser la caméra' : 'Allow camera'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => setPhase('manual')} style={styles.linkRow}>
              <Text style={styles.linkText}>
                {isFr ? 'Saisir le code manuellement' : 'Enter the code manually'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'manual' && (
          <View style={styles.manualArea}>
            <Text style={styles.manualLabel}>
              {isFr ? 'Code affiché sur la TV' : 'Code shown on the TV'}
            </Text>
            <TextInput
              value={manualCode}
              onChangeText={(t) => setManualCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              maxLength={20}
              placeholder="ABCD EFGH JKLM"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={styles.manualInput}
              accessibilityLabel={isFr ? 'Code à 12 caractères' : '12-character code'}
            />
            <TouchableOpacity onPress={submitManual} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>
                {isFr ? 'Pairer' : 'Pair'}
              </Text>
            </TouchableOpacity>
            {CameraView ? (
              <TouchableOpacity onPress={() => setPhase('scanning')} style={styles.linkRow}>
                <Text style={styles.linkText}>
                  {isFr ? 'Revenir au scanner' : 'Back to scanner'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {phase === 'submitting' && (
          <View style={styles.centerArea}>
            <ActivityIndicator size="large" color="#AEEF4D" />
            <Text style={styles.centerText}>
              {isFr ? 'Connexion à la TV…' : 'Connecting to the TV…'}
            </Text>
          </View>
        )}

        {phase === 'done' && (
          <View style={styles.centerArea}>
            <View style={{ marginBottom: 12 }}>
              <Icon name="check_circle" size={64} color="#AEEF4D" strokeWidth={2} />
            </View>
            <Text style={styles.centerTitle}>
              {isFr ? 'Apple TV connectée' : 'Apple TV signed in'}
            </Text>
            <Text style={styles.centerText}>
              {isFr ? 'Tu peux commencer ta séance.' : 'You can start your session.'}
            </Text>
          </View>
        )}

        {phase === 'error' && (
          <View style={styles.centerArea}>
            <View style={{ marginBottom: 12 }}>
              <Icon name="warning" size={48} color="#F5A623" strokeWidth={2} />
            </View>
            <Text style={styles.centerTitle}>
              {isFr ? 'Pairage impossible' : 'Pairing failed'}
            </Text>
            <Text style={styles.centerText}>{errorMsg}</Text>
            <TouchableOpacity onPress={retry} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>
                {isFr ? 'Réessayer' : 'Try again'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const SCAN_SIZE = Math.min(SW - 48, 320);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000e18' },
  header: {
    paddingTop: 56,
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  closeBtn: { color: '#AEEF4D', fontSize: 15, fontWeight: '600' },

  scanArea: { flex: 1, alignItems: 'center', paddingTop: 32 },
  scanFrame: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  scanOverlay: { ...StyleSheet.absoluteFillObject },
  scanCornerTL: { position: 'absolute', top: 0, left: 0, width: 36, height: 36, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#AEEF4D', borderTopLeftRadius: 12 },
  scanCornerTR: { position: 'absolute', top: 0, right: 0, width: 36, height: 36, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#AEEF4D', borderTopRightRadius: 12 },
  scanCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 36, height: 36, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#AEEF4D', borderBottomLeftRadius: 12 },
  scanCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#AEEF4D', borderBottomRightRadius: 12 },
  hint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 24,
    paddingHorizontal: 24,
    textAlign: 'center',
  },

  permArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  permIcon: { fontSize: 56, marginBottom: 12 },
  permTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  permBody: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 21 },

  manualArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 56, paddingHorizontal: 32 },
  manualLabel: { color: 'rgba(255,255,255,0.78)', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 },
  manualInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: 4,
    textAlign: 'center',
    width: '100%',
    fontWeight: '700',
    marginBottom: 24,
  },

  primaryBtn: {
    backgroundColor: '#AEEF4D',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 18,
  },
  primaryBtnText: { color: '#001a2e', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },

  linkRow: { paddingVertical: 14, paddingHorizontal: 16 },
  linkText: { color: '#AEEF4D', fontSize: 14, fontWeight: '600' },

  centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 6, marginBottom: 10 },
  centerText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 22 },
});
