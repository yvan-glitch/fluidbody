import { useEffect, useRef, useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, Pressable, KeyboardAvoidingView, Platform, Alert, Animated, Easing, Dimensions, StyleSheet, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../constants/data';
import { LEGAL, getTermsUrl, TERMS_ACCEPTED_STORAGE_KEY } from '../constants/legal';
import { Bulle, Meduse, MeduseCornerIcon, BULLES_ONBOARDING } from '../components/Meduse';
import AnimatedPlus from '../components/AnimatedPlus';
import GlassButton from '../components/GlassButton';
import LivingBackground from '../components/LivingBackground';
import { withTimeout } from '../utils/withTimeout';
import { reportError } from '../utils/reportError';

let AppleAuth = null;
try { AppleAuth = require('expo-apple-authentication'); } catch(e) {}

// Connexion Google native (@react-native-google-signin). Chargé en require
// protégé : si le module natif n'est pas présent (ex. build TV), l'app ne crashe pas.
let GoogleSignin = null, GoogleStatusCodes = null;
try {
  const g = require('@react-native-google-signin/google-signin');
  GoogleSignin = g.GoogleSignin;
  GoogleStatusCodes = g.statusCodes;
} catch(e) {}
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

const { width: SW, height: SH } = Dimensions.get('window');

export default function SignInScreen({ lang, supabase, prefillEmail, onSuccess, onSwitchToSignUp, onSkip }) {
  const tr = T[lang] || T.fr;
  const [email, setEmail] = useState(prefillEmail || '');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // FIX CGU (2026-07-23) : Apple/Google via signInWithIdToken CRÉENT un compte
  // au premier passage — ce flux n'exigeait aucune acceptation des CGU
  // (divergence avec AuthScreen, risque légal). Même mécanique qu'AuthScreen :
  // case bloquante, pré-cochée si déjà acceptée sur cet appareil.
  const [termsAccepted, setTermsAccepted] = useState(false);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(TERMS_ACCEPTED_STORAGE_KEY)
      .then(v => { if (!cancelled && v) setTermsAccepted(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  function persistTermsAccepted() {
    AsyncStorage.setItem(TERMS_ACCEPTED_STORAGE_KEY, String(LEGAL.termsVersion || '1.0')).catch(() => {});
  }
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPass = password.length >= 6;
  const canSubmit = validEmail && validPass && !loading;
  const appleAvailable = !!AppleAuth && Platform.OS === 'ios';
  // Google dispo dès que le module natif est là ET qu'un webClientId est configuré.
  // Visible iOS + Android (sur Android, c'est le bouton social principal).
  const googleAvailable = !!GoogleSignin && !!GOOGLE_WEB_CLIENT_ID;
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;

  const floatingMedusas = useRef([
    { baseX: SW - 80, baseY: SH * 0.12, size: 72, breath: 3200, dx: new Animated.Value(0), dy: new Animated.Value(0) },
    { baseX: 30, baseY: SH * 0.4, size: 58, breath: 3600, dx: new Animated.Value(0), dy: new Animated.Value(0) },
    { baseX: SW * 0.5, baseY: SH * 0.65, size: 50, breath: 4000, dx: new Animated.Value(0), dy: new Animated.Value(0) },
    { baseX: SW * 0.75, baseY: SH * 0.8, size: 44, breath: 3800, dx: new Animated.Value(0), dy: new Animated.Value(0) },
  ]).current;

  useEffect(() => {
    if (!googleAvailable) return;
    try {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
        offlineAccess: false,
      });
    } catch (e) { if (__DEV__) console.warn('GoogleSignin.configure', e?.message); }
  }, []);

  useEffect(() => {
    let mounted = true;
    const currentDrifts = [];
    floatingMedusas.forEach(function(m, idx) {
      function drift() {
        if (!mounted) return;
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 60 + Math.random() * (SH - m.size - 160);
        var dur = 12000 + Math.random() * 8000;
        var p = Animated.parallel([
          Animated.timing(m.dx, { toValue: toX - m.baseX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
          Animated.timing(m.dy, { toValue: toY - m.baseY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: true }),
        ]);
        currentDrifts[idx] = p;
        p.start(function() { if (mounted) drift(); });
      }
      drift();
    });
    return function() {
      mounted = false;
      currentDrifts.forEach(function(d) { try { d && d.stop && d.stop(); } catch (e) {} });
    };
  }, []);

  async function handleSignIn() {
    if (!supabase) { Alert.alert('FluidBody+', 'Supabase indisponible.'); return; }
    const em = email.trim().toLowerCase();
    if (!validEmail) { setError(tr.ob_auth_err_email || 'Email invalide.'); return; }
    if (!validPass) { setError(tr.ob_auth_err_short || 'Mot de passe trop court.'); return; }
    if (!termsAccepted) { setError(tr.ob_auth_terms_required || 'Tu dois accepter les CGU pour continuer.'); return; }
    setLoading(true); setError('');
    try {
      const { error: err } = await withTimeout(supabase.auth.signInWithPassword({ email: em, password }), 15000, 'signIn');
      if (err) { setError(err.message); setLoading(false); return; }
      persistTermsAccepted();
      setLoading(false);
      onSuccess && onSuccess();
    } catch (e) {
      setError(tr.ob_auth_err_net || 'Erreur réseau.');
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    if (!supabase) { Alert.alert('FluidBody+', 'Supabase indisponible.'); return; }
    if (!AppleAuth) { Alert.alert('Apple Sign In', 'Module expo-apple-authentication non chargé. Vérifie le plugin dans app.json.'); return; }
    if (!appleAvailable) { Alert.alert('FluidBody+', 'Sign in with Apple disponible sur iOS uniquement.'); return; }
    if (!termsAccepted) { setError(tr.ob_auth_terms_required || 'Tu dois accepter les CGU pour continuer.'); return; }
    setLoading(true); setError('');
    try {
      const credential = await withTimeout(AppleAuth.signInAsync({
        requestedScopes: [AppleAuth.AppleAuthenticationScope.FULL_NAME, AppleAuth.AppleAuthenticationScope.EMAIL],
      }), 45000, 'appleSheet');
      if (!credential.identityToken) {
        const msg = 'Apple identity token manquant.';
        setError(msg); Alert.alert('Apple Sign In', msg);
        setLoading(false); return;
      }
      const { error: err } = await withTimeout(supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken }), 15000, 'appleSignIn');
      if (err) {
        setError(err.message); Alert.alert('Apple Sign In : Supabase', err.message || 'Erreur Supabase');
        setLoading(false); return;
      }
      const applePrenom = credential.fullName?.givenName || '';
      if (applePrenom) {
        try { await supabase.auth.updateUser({ data: { prenom: applePrenom } }); } catch(_) {}
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase.from('profiles').upsert({ id: session.user.id, prenom: applePrenom, updated_at: new Date().toISOString() });
          }
        } catch(e) { reportError('profiles.upsert.signInApple', e); }
      }
      persistTermsAccepted();
      setLoading(false);
      onSuccess && onSuccess();
    } catch (e) {
      if (e?.message && e.message.indexOf('timeout') !== -1) {
        setError(tr.ob_auth_err_apple_timeout || "L'identification Apple a pris trop de temps. Vérifie ta connexion.");
      } else if (e?.code !== 'ERR_REQUEST_CANCELED') {
        const msg = e?.message || tr.ob_auth_err_net || 'Erreur.';
        setError(msg);
        Alert.alert('Apple Sign In : erreur', `${msg}\n\nCode: ${e?.code || 'n/a'}`);
      }
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    if (!supabase) { Alert.alert('FluidBody+', 'Supabase indisponible.'); return; }
    if (!GoogleSignin) { Alert.alert('Google Sign In', 'Module @react-native-google-signin non chargé. Rebuild requis.'); return; }
    if (!GOOGLE_WEB_CLIENT_ID) { Alert.alert('Google Sign In', "Connexion Google pas encore configurée (webClientId manquant)."); return; }
    if (!termsAccepted) { setError(tr.ob_auth_terms_required || 'Tu dois accepter les CGU pour continuer.'); return; }
    setLoading(true); setError('');
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res = await withTimeout(GoogleSignin.signIn(), 60000, 'googleSheet');
      // v13+ renvoie { type, data:{ idToken, user } } ; versions plus anciennes { idToken, user }
      if (res?.type === 'cancelled') { setLoading(false); return; }
      const idToken = res?.data?.idToken || res?.idToken || null;
      if (!idToken) {
        const msg = 'Google : identity token manquant.';
        setError(msg); Alert.alert('Google Sign In', msg);
        setLoading(false); return;
      }
      const { error: err } = await withTimeout(supabase.auth.signInWithIdToken({ provider: 'google', token: idToken }), 15000, 'googleSignIn');
      if (err) {
        setError(err.message); Alert.alert('Google Sign In : Supabase', err.message || 'Erreur Supabase');
        setLoading(false); return;
      }
      const gName = res?.data?.user?.givenName || res?.user?.givenName || '';
      if (gName) {
        try { await supabase.auth.updateUser({ data: { prenom: gName } }); } catch(_) {}
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase.from('profiles').upsert({ id: session.user.id, prenom: gName, updated_at: new Date().toISOString() });
          }
        } catch(e) { reportError('profiles.upsert.signInGoogle', e); }
      }
      persistTermsAccepted();
      setLoading(false);
      onSuccess && onSuccess();
    } catch (e) {
      const code = e?.code;
      if (GoogleStatusCodes && (code === GoogleStatusCodes.SIGN_IN_CANCELLED)) { setLoading(false); return; }
      if (e?.message && e.message.indexOf('timeout') !== -1) {
        setError(tr.ob_auth_err_net || "La connexion Google a pris trop de temps. Vérifie ta connexion.");
      } else {
        const msg = e?.message || tr.ob_auth_err_net || 'Erreur.';
        setError(msg);
        Alert.alert('Google Sign In : erreur', `${msg}\n\nCode: ${code || 'n/a'}`);
      }
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#000a1a', '#001a2e', '#003a55', '#006d85', '#00a5b8', '#00c8d4']} locations={[0, 0.18, 0.4, 0.6, 0.82, 1]} style={StyleSheet.absoluteFill} />
      <LivingBackground />
      {BULLES_ONBOARDING.map((b, i) => <Bulle key={`si-${i}`} {...b} />)}
      <View style={{ position: 'absolute', top: 298, left: 0, right: 0, alignItems: 'center', opacity: 0.9, zIndex: 0 }} pointerEvents="none">
        <Meduse />
      </View>
      <View style={{ position: 'absolute', top: 128, left: 0, right: 0, zIndex: 20, alignItems: 'center', paddingHorizontal: 8, pointerEvents: 'none' }}>
        <View style={{ width: '100%', maxWidth: SW - 16, alignItems: 'center' }}>
          <View style={{ width: '100%', paddingHorizontal: 2 }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={{
                fontSize: 56,
                fontWeight: '900',
                textAlign: 'center',
                letterSpacing: 4,
                color: '#AEEF4D',
                textShadowColor: 'rgba(0, 0, 0, 0.4)',
                textShadowOffset: { width: 0, height: 3 },
                textShadowRadius: 14,
                ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
              }}
            >
              FLUIDBODY
              <AnimatedPlus
                style={{
                  fontSize: 56,
                  fontWeight: '900',
                  letterSpacing: 1,
                  marginLeft: 40,
                  color: '#AEEF4D',
                  textShadowColor: 'rgba(0, 0, 0, 0.4)',
                  textShadowOffset: { width: 0, height: 3 },
                  textShadowRadius: 14,
                  ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
                }}
              >+</AnimatedPlus>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'nowrap', marginTop: -2, width: '100%', paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 28, fontWeight: '400', color: '#AEEF4D', letterSpacing: 16, textTransform: 'uppercase', textShadowColor: 'rgba(0, 12, 28, 0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10, ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}) }}>PILATES</Text>
            <Text style={{ marginLeft: 14, fontSize: 28, fontWeight: '300', color: '#AEEF4D', letterSpacing: 2, textShadowColor: 'rgba(0, 12, 28, 0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6, ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}) }}>{'& More'}</Text>
          </View>
          <Text style={{ marginTop: 22, fontSize: 22, fontWeight: '700', color: '#ffffff', textAlign: 'center', letterSpacing: -0.2 }}>{isFr ? 'Bon retour' : 'Welcome back'}</Text>
        </View>
      </View>
      {floatingMedusas.map(function(m, i) {
        return (
          <Animated.View key={'si-fm-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 0, opacity: 0.7, left: m.baseX, top: m.baseY, transform: [{ translateX: m.dx }, { translateY: m.dy }] }}>
            <MeduseCornerIcon size={m.size} breathCycleMs={m.breath} breathMaxScale={1.35} tint="rgba(174,239,77,1)" />
          </Animated.View>
        );
      })}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 30 }}>
        <View style={{ paddingHorizontal: 28, paddingBottom: 32, paddingTop: 16, backgroundColor: 'rgba(0,14,24,0.55)' }}>
          {appleAvailable ? (
            <GlassButton
              onPress={handleAppleSignIn}
              loading={loading}
              size="md"
              style={{ marginBottom: 16 }}
              leftIcon={
                <Svg width={18} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C3.79 16.17 4.36 9.04 8.72 8.78c1.34.07 2.27.74 3.06.8.93-.19 1.82-.73 2.82-.66 1.19.1 2.09.58 2.68 1.49-2.45 1.47-1.87 4.71.36 5.62-.45 1.17-.66 1.7-1.23 2.73-.82 1.46-1.97 2.92-3.36 2.95zM12.13 8.65c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="#ffffff" />
                </Svg>
              }
            >
              {tr.auth_apple || 'Continuer avec Apple'}
            </GlassButton>
          ) : null}
          {googleAvailable ? (
            <GlassButton
              onPress={handleGoogleSignIn}
              loading={loading}
              size="md"
              style={{ marginBottom: 16 }}
              leftIcon={
                <Svg width={18} height={18} viewBox="0 0 48 48">
                  <Path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107" />
                  <Path d="M3.2 14.7l7 5.1C12 16 17.5 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 15.4 2 7.9 6.9 3.2 14.7z" fill="#FF3D00" />
                  <Path d="M24 46c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 36.5 26.9 37 24 37c-6.1 0-10.7-3.1-12.5-8.4l-7 5.4C7.7 41.1 15.2 46 24 46z" fill="#4CAF50" />
                  <Path d="M44.5 20H24v8.5h11.8c-.8 2.3-2.3 4.3-4.1 5.8l6.6 5.6C42.2 36.6 45 31 45 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2" />
                </Svg>
              }
            >
              {tr.auth_google || 'Continuer avec Google'}
            </GlassButton>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(174,239,77,0.25)' }} />
            <Text style={{ fontSize: 11, color: '#AEEF4D', marginHorizontal: 14, letterSpacing: 1, textTransform: 'uppercase' }}>{tr.auth_or || 'ou'}</Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(174,239,77,0.25)' }} />
          </View>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            accessibilityLabel={tr.a11y_email_input || 'Adresse e-mail'}
            placeholder={tr.ob_email_ph}
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            style={{ width: '100%', height: 48, backgroundColor: emailFocused ? 'rgba(174,239,77,0.06)' : 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: emailFocused ? '#AEEF4D' : 'rgba(255,255,255,0.25)', borderRadius: 25, color: '#ffffff', fontSize: 15, paddingHorizontal: 18, marginBottom: 10 }}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            accessibilityLabel={tr.a11y_password_input || 'Mot de passe'}
            placeholder={tr.ob_pass_ph}
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            style={{ width: '100%', height: 48, backgroundColor: passwordFocused ? 'rgba(174,239,77,0.06)' : 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: passwordFocused ? '#AEEF4D' : 'rgba(255,255,255,0.25)', borderRadius: 25, color: '#ffffff', fontSize: 15, paddingHorizontal: 18, marginBottom: 10 }}
          />
          {error ? <Text style={{ color: 'rgba(255,140,140,0.95)', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{error}</Text> : null}

          <Pressable
            onPress={() => setTermsAccepted(v => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: termsAccepted }}
            accessibilityLabel={(tr.ob_auth_terms_prefix || '') + (tr.ob_auth_terms_link || '')}
            style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, paddingHorizontal: 4 }}
          >
            <View style={{
              width: 20, height: 20, borderRadius: 6,
              borderWidth: 1.5,
              borderColor: termsAccepted ? '#AEEF4D' : 'rgba(255,255,255,0.35)',
              backgroundColor: termsAccepted ? 'rgba(174,239,77,0.18)' : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 10, marginTop: 1,
            }}>
              {termsAccepted ? <Text style={{ color: '#AEEF4D', fontSize: 13, fontWeight: '800' }}>{'✓'}</Text> : null}
            </View>
            <Text style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 17 }}>
              {tr.ob_auth_terms_prefix || "En continuant, j'accepte les "}
              <Text
                style={{ color: '#AEEF4D', textDecorationLine: 'underline', fontWeight: '600' }}
                onPress={() => Linking.openURL(getTermsUrl(lang) || LEGAL.termsUrl)}
              >
                {tr.ob_auth_terms_link || "Conditions d'utilisation"}
              </Text>
              {tr.ob_auth_terms_and || ' et la '}
              <Text
                style={{ color: '#AEEF4D', textDecorationLine: 'underline', fontWeight: '600' }}
                onPress={() => Linking.openURL(LEGAL.privacyUrl)}
              >
                {tr.ob_auth_privacy_link || 'Politique de confidentialité'}
              </Text>
              .
            </Text>
          </Pressable>

          <TouchableOpacity
            onPress={handleSignIn}
            disabled={!canSubmit}
            activeOpacity={0.85}
            style={{
              width: '100%', height: 50, borderRadius: 25,
              backgroundColor: canSubmit ? 'rgba(174,239,77,0.18)' : 'rgba(174,239,77,0.06)',
              borderWidth: 1.5, borderColor: '#AEEF4D',
              alignItems: 'center', justifyContent: 'center',
              opacity: canSubmit ? 1 : 0.5,
              shadowColor: '#AEEF4D', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#AEEF4D', letterSpacing: 0.3 }}>{loading ? '…' : (tr.ob_auth_submit_in || 'Se connecter')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSwitchToSignUp} disabled={loading} activeOpacity={0.7} style={{ alignItems: 'center', paddingVertical: 12, marginTop: 6 }}>
            <Text style={{ fontSize: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.55)' }}>{isFr ? 'Pas encore de compte ?  ' : "No account yet?  "}</Text>
              <Text style={{ color: '#AEEF4D', textDecorationLine: 'underline' }}>{isFr ? "S'inscrire ›" : 'Sign up ›'}</Text>
            </Text>
          </TouchableOpacity>

          {onSkip ? (
            <GlassButton
              onPress={onSkip}
              loading={loading}
              size="sm"
              textColor="rgba(255,255,255,0.7)"
              style={{ marginTop: 4 }}
              textStyle={{ fontSize: 13, fontWeight: '500' }}
            >
              {tr.first_seance_later || 'Plus tard'}
            </GlassButton>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
