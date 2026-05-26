// TVLoginScreen — premier écran que l'utilisateur voit sur Apple TV.
//
// Affiche un QR code que l'utilisateur scanne depuis l'iPhone Fluidbody
// (déjà loggué). Tant que le QR n'est pas redeem, la TV poll toutes les
// 2 s l'edge function `tv-pair`. Quand des tokens reviennent, on les
// pousse dans `supabase.auth.setSession(...)` et le parent (App.js)
// bascule automatiquement sur MonCorps via l'auth state change.
//
// Fallback : si l'init échoue (offline, function down), on affiche un
// message clair avec un bouton "Réessayer" focusable. Pas de fallback
// magic-link e-mail dans le MVP — pas de clavier ergonomique sur la
// Siri Remote, le QR reste le chemin recommandé.

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { IS_TV, tvFocusProps, TV_FOCUS_RING } from '../utils/platformTV';
import { initPairing, pollPairing } from '../utils/tvPair';
import { AquaticBackground, MeduseTV } from '../components/tv';
import { Icon } from '../components/Icons';
import supabase from '../lib/supabase';

const { width: SW, height: SH } = Dimensions.get('window');
const POLL_INTERVAL_MS = 2000;
// Sécurité côté client : on arrête de poller après ce délai même si on
// n'a pas reçu d'événement "expired". Évite de boucler indéfiniment
// si l'edge function est cassée. La TV affiche alors le bouton retry.
const HARD_TIMEOUT_MS = 6 * 60 * 1000; // 6 min, > TTL serveur de 5 min

export default function TVLoginScreen({ lang, onSignedIn }) {
  // Note : on lit `lang` mais on reste sur des strings statiques pour
  // l'instant — la TV est en français par défaut puisqu'on cible le
  // marché francophone. Wrapper i18n viendra plus tard si besoin.
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;

  const [pairing, setPairing] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | active | error | expired
  const [errorMsg, setErrorMsg] = useState('');
  const [retryFocused, setRetryFocused] = useState(false);
  const pollTimer = useRef(null);
  const hardTimer = useRef(null);
  const mountedRef = useRef(true);

  function clearTimers() {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
    if (hardTimer.current) { clearTimeout(hardTimer.current); hardTimer.current = null; }
  }

  async function bootstrap() {
    setStatus('loading');
    setErrorMsg('');
    clearTimers();
    try {
      const p = await initPairing();
      if (!mountedRef.current) return;
      setPairing(p);
      setStatus('active');
      hardTimer.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setStatus('expired');
        clearTimers();
      }, HARD_TIMEOUT_MS);
      scheduleNextPoll(p);
    } catch (e) {
      if (!mountedRef.current) return;
      setStatus('error');
      setErrorMsg(e?.message || (isFr ? 'Erreur de connexion' : 'Connection error'));
    }
  }

  function scheduleNextPoll(p) {
    if (!mountedRef.current) return;
    pollTimer.current = setTimeout(() => { tick(p); }, POLL_INTERVAL_MS);
  }

  async function tick(p) {
    if (!mountedRef.current) return;
    try {
      const res = await pollPairing({ nonce: p.nonce, tv_secret: p.tv_secret });
      if (!mountedRef.current) return;
      if (res?.status === 'ready' && res.access_token && res.refresh_token) {
        clearTimers();
        try {
          if (supabase) {
            await supabase.auth.setSession({
              access_token: res.access_token,
              refresh_token: res.refresh_token,
            });
          }
          if (onSignedIn) onSignedIn();
        } catch (e) {
          setStatus('error');
          setErrorMsg(isFr ? 'Erreur de session' : 'Session error');
        }
        return;
      }
      // status 'pending' → re-poll
      scheduleNextPoll(p);
    } catch (e) {
      if (!mountedRef.current) return;
      // 410 expired → on bascule en expired
      if (e?.status === 410) {
        setStatus('expired');
        clearTimers();
        return;
      }
      // Erreur réseau transitoire : on retente quand même
      scheduleNextPoll(p);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    bootstrap();
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, []);

  // Format human-friendly du nonce, pour saisie manuelle de secours :
  // "ABCD EFGH JKLM" plutôt qu'une longue suite.
  function formatCode(nonce) {
    if (!nonce) return '';
    const clean = String(nonce).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return clean.replace(/(.{4})/g, '$1 ').trim();
  }

  // Taille du QR : on vise ~480 px sur 1080p, lisible à 3-4 m.
  const qrSize = IS_TV ? 480 : Math.min(280, SW * 0.7);

  return (
    <View style={styles.root}>
      {IS_TV ? (
        <AquaticBackground density="low" contentOpacity={0.7} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000e18' }]} />
      )}

      {/* Layout TV : split horizontal — hero méduse à gauche, contenu à droite.
          Sur iPhone : layout vertical historique conservé. */}
      <View style={IS_TV ? styles.tvLayout : null}>
        {IS_TV ? (
          <View style={styles.tvHero}>
            <MeduseTV size={260} tint="rgba(0,220,255,1)" haloTint="rgba(174,239,77,1)" haloScale={1.8} breathCycleMs={3200} />
            <Text style={styles.tvHeroTagline}>
              {isFr ? 'Le Pilates fluidité.' : 'Fluid Pilates.'}
            </Text>
          </View>
        ) : null}

        <View style={IS_TV ? styles.tvContent : { alignItems: 'center' }}>
          {/* Titre + branding */}
          <View style={styles.header}>
            <Text style={styles.brand}>
              FLUIDBODY<Text style={styles.brandPlus}>+</Text>
            </Text>
            <Text style={styles.title}>
              {isFr ? 'Connecte ton Apple TV' : 'Sign in to your Apple TV'}
            </Text>
            <Text style={styles.subtitle}>
              {isFr
                ? 'Ouvre l\'app FluidBody+ sur ton iPhone,\nva dans Profil → Pairer une Apple TV,\net scanne le QR ci-dessous.'
                : 'Open the FluidBody+ app on your iPhone,\ngo to Profile → Pair an Apple TV,\nthen scan the QR below.'}
            </Text>
          </View>

          {/* Carte QR */}
          <View style={[styles.qrCard, IS_TV ? { padding: 32 } : { padding: 20 }]}>
        {status === 'loading' && (
          <View style={{ width: qrSize, height: qrSize, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#AEEF4D" />
            <Text style={styles.qrPlaceholderText}>
              {isFr ? 'Préparation du code…' : 'Preparing the code…'}
            </Text>
          </View>
        )}

        {status === 'active' && pairing && (
          <>
            <View style={styles.qrFrame}>
              <QRCode
                value={pairing.qr_payload}
                size={qrSize}
                backgroundColor="#FFFFFF"
                color="#001a2e"
                ecl="M"
              />
            </View>
            <Text style={styles.codeLabel}>
              {isFr ? 'Ou tape ce code sur ton iPhone :' : 'Or enter this code on your iPhone:'}
            </Text>
            <Text style={styles.codeValue}>{formatCode(pairing.nonce)}</Text>
            <Text style={styles.codeHint}>
              {isFr ? 'Code valide 5 minutes' : 'Code valid for 5 minutes'}
            </Text>
          </>
        )}

        {(status === 'error' || status === 'expired') && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <View style={{ marginBottom: 12 }}>
              <Icon name={status === 'expired' ? 'rotate' : 'warning'} size={48} color="#F5A623" strokeWidth={2} />
            </View>
            <Text style={styles.errorTitle}>
              {status === 'expired'
                ? (isFr ? 'Code expiré' : 'Code expired')
                : (isFr ? 'Impossible de récupérer le code' : 'Cannot fetch code')}
            </Text>
            {errorMsg ? (
              <Text style={styles.errorDetail}>{errorMsg}</Text>
            ) : null}
            <TouchableOpacity
              {...tvFocusProps(true)}
              onPress={bootstrap}
              onFocus={() => setRetryFocused(true)}
              onBlur={() => setRetryFocused(false)}
              activeOpacity={0.8}
              style={[
                styles.retryBtn,
                retryFocused ? TV_FOCUS_RING : null,
                retryFocused ? { transform: [{ scale: 1.06 }] } : null,
              ]}
            >
              <Text style={styles.retryBtnText}>
                {isFr ? 'Réessayer' : 'Try again'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
          </View>
        </View>
      </View>

      {/* Pied de page : aide */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {isFr
            ? "Pas encore d'abonnement ? Crée un compte depuis l'iPhone d'abord, puis reviens ici."
            : 'No subscription yet? Create an account from the iPhone first, then come back here.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000e18',
    alignItems: IS_TV ? 'stretch' : 'center',
    justifyContent: IS_TV ? 'flex-start' : 'center',
    padding: IS_TV ? 0 : 24,
  },
  // Apple TV : split horizontal hero (méduse + tagline) | contenu (QR + texte)
  tvLayout: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 120,
    paddingVertical: 60,
  },
  tvHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tvHeroTagline: {
    marginTop: 28,
    fontSize: 26,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: -0.3,
    textAlign: 'center',
    maxWidth: 440,
    lineHeight: 34,
  },
  tvContent: {
    flex: 1.2,
    alignItems: 'center',
    paddingLeft: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: IS_TV ? 36 : 24,
  },
  brand: {
    fontSize: IS_TV ? 32 : 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
    marginBottom: IS_TV ? 14 : 10,
  },
  brandPlus: {
    color: '#AEEF4D',
    fontWeight: '900',
  },
  title: {
    fontSize: IS_TV ? 52 : 26,
    fontWeight: '200',
    color: '#FFFFFF',
    letterSpacing: -0.8,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: IS_TV ? 60 : undefined,
  },
  subtitle: {
    fontSize: IS_TV ? 20 : 15,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    lineHeight: IS_TV ? 30 : 22,
    maxWidth: IS_TV ? 640 : 480,
  },
  qrCard: {
    backgroundColor: IS_TV ? 'rgba(8,24,40,0.55)' : 'rgba(255,255,255,0.06)',
    borderRadius: IS_TV ? 32 : 20,
    borderWidth: IS_TV ? 1.5 : 1,
    borderColor: IS_TV ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: IS_TV ? 0.4 : 0.15,
    shadowRadius: IS_TV ? 30 : 12,
    shadowOffset: { width: 0, height: IS_TV ? 14 : 6 },
  },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    padding: IS_TV ? 22 : 12,
    borderRadius: IS_TV ? 20 : 12,
  },
  qrPlaceholderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: IS_TV ? 18 : 13,
    marginTop: 14,
  },
  codeLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: IS_TV ? 18 : 12,
    marginTop: IS_TV ? 28 : 18,
    letterSpacing: 1,
  },
  codeValue: {
    color: '#AEEF4D',
    fontSize: IS_TV ? 48 : 28,
    fontWeight: '800',
    letterSpacing: IS_TV ? 6 : 3,
    marginTop: IS_TV ? 12 : 8,
    fontVariant: ['tabular-nums'],
  },
  codeHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: IS_TV ? 16 : 11,
    marginTop: IS_TV ? 14 : 10,
    letterSpacing: 1,
  },
  errorIcon: {
    fontSize: IS_TV ? 64 : 40,
    marginBottom: IS_TV ? 16 : 8,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: IS_TV ? 28 : 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorDetail: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: IS_TV ? 16 : 12,
    marginBottom: 24,
    textAlign: 'center',
    maxWidth: 480,
  },
  retryBtn: {
    paddingHorizontal: IS_TV ? 48 : 28,
    paddingVertical: IS_TV ? 18 : 12,
    borderRadius: IS_TV ? 18 : 12,
    backgroundColor: '#AEEF4D',
  },
  retryBtnText: {
    color: '#001a2e',
    fontSize: IS_TV ? 22 : 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  footer: {
    position: 'absolute',
    bottom: IS_TV ? 60 : 28,
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: IS_TV ? 16 : 11,
    textAlign: 'center',
    maxWidth: 720,
  },
});
