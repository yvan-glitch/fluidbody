import { useEffect, useRef, useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform, Alert, Animated, Easing, Dimensions, StyleSheet, Linking as RNLinking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { T } from '../constants/data';
import { Bulle, Meduse, MeduseCornerIcon, BULLES_ONBOARDING } from '../components/Meduse';
import AnimatedPlus from '../components/AnimatedPlus';
import GlassButton from '../components/GlassButton';
import LivingBackground from '../components/LivingBackground';

let AppleAuth = null;
try { AppleAuth = require('expo-apple-authentication'); } catch(e) {}

const { width: SW, height: SH } = Dimensions.get('window');

export default function SignInScreen({ lang, supabase, prefillEmail, onSuccess, onSwitchToSignUp, onSkip }) {
  const tr = T[lang] || T.fr;
  const [email, setEmail] = useState(prefillEmail || '');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validPass = password.length >= 6;
  const canSubmit = validEmail && validPass && !loading;
  const appleAvailable = !!AppleAuth && Platform.OS === 'ios';
  const isFr = (lang || 'fr').toLowerCase().indexOf('fr') === 0;

  const floatingMedusas = useRef([
    { x: new Animated.Value(SW - 80), y: new Animated.Value(SH * 0.12), size: 72, breath: 3200 },
    { x: new Animated.Value(30), y: new Animated.Value(SH * 0.4), size: 58, breath: 3600 },
    { x: new Animated.Value(SW * 0.5), y: new Animated.Value(SH * 0.65), size: 50, breath: 4000 },
    { x: new Animated.Value(SW * 0.75), y: new Animated.Value(SH * 0.8), size: 44, breath: 3800 },
  ]).current;

  useEffect(() => {
    floatingMedusas.forEach(function(m) {
      function drift() {
        var toX = 10 + Math.random() * (SW - m.size - 20);
        var toY = 60 + Math.random() * (SH - m.size - 160);
        var dur = 12000 + Math.random() * 8000;
        Animated.parallel([
          Animated.timing(m.x, { toValue: toX, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
          Animated.timing(m.y, { toValue: toY, duration: dur, easing: Easing.bezier(0.25, 0.1, 0.25, 1), useNativeDriver: false }),
        ]).start(function() { drift(); });
      }
      drift();
    });
  }, []);

  async function handleSignIn() {
    if (!supabase) { Alert.alert('FluidBody+', 'Supabase indisponible.'); return; }
    const em = email.trim().toLowerCase();
    if (!validEmail) { setError(tr.ob_auth_err_email || 'Email invalide.'); return; }
    if (!validPass) { setError(tr.ob_auth_err_short || 'Mot de passe trop court.'); return; }
    setLoading(true); setError('');
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: em, password });
      if (err) { setError(err.message); setLoading(false); return; }
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
    setLoading(true); setError('');
    try {
      const credential = await AppleAuth.signInAsync({
        requestedScopes: [AppleAuth.AppleAuthenticationScope.FULL_NAME, AppleAuth.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) {
        const msg = 'Apple identity token manquant.';
        setError(msg); Alert.alert('Apple Sign In', msg);
        setLoading(false); return;
      }
      const { error: err } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
      if (err) {
        setError(err.message); Alert.alert('Apple Sign In — Supabase', err.message || 'Erreur Supabase');
        setLoading(false); return;
      }
      setLoading(false);
      onSuccess && onSuccess();
    } catch (e) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        const msg = e?.message || tr.ob_auth_err_net || 'Erreur.';
        setError(msg);
        Alert.alert('Apple Sign In — erreur', `${msg}\n\nCode: ${e?.code || 'n/a'}`);
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
                color: '#E5FF00',
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
                  color: '#E5FF00',
                  textShadowColor: 'rgba(0, 0, 0, 0.4)',
                  textShadowOffset: { width: 0, height: 3 },
                  textShadowRadius: 14,
                  ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
                }}
              >+</AnimatedPlus>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'nowrap', marginTop: -2, width: '100%', paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 28, fontWeight: '400', color: '#E5FF00', letterSpacing: 16, textTransform: 'uppercase', textShadowColor: 'rgba(0, 12, 28, 0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10, ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}) }}>PILATES</Text>
            <Text style={{ marginLeft: 14, fontSize: 28, fontWeight: '300', color: '#E5FF00', letterSpacing: 2, textShadowColor: 'rgba(0, 12, 28, 0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6, ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}) }}>{'& More'}</Text>
          </View>
          <Text style={{ marginTop: 22, fontSize: 22, fontWeight: '700', color: '#ffffff', textAlign: 'center', letterSpacing: -0.2 }}>{isFr ? 'Bon retour' : 'Welcome back'}</Text>
        </View>
      </View>
      {floatingMedusas.map(function(m, i) {
        return (
          <Animated.View key={'si-fm-' + i} pointerEvents="none" style={{ position: 'absolute', zIndex: 0, opacity: 0.7, left: m.x, top: m.y }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(229,255,0,0.25)' }} />
            <Text style={{ fontSize: 11, color: '#E5FF00', marginHorizontal: 14, letterSpacing: 1, textTransform: 'uppercase' }}>{tr.auth_or || 'ou'}</Text>
            <View style={{ flex: 1, height: 0.5, backgroundColor: 'rgba(229,255,0,0.25)' }} />
          </View>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            placeholder={tr.ob_email_ph}
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            style={{ width: '100%', height: 48, backgroundColor: emailFocused ? 'rgba(229,255,0,0.06)' : 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: emailFocused ? '#E5FF00' : 'rgba(255,255,255,0.25)', borderRadius: 25, color: '#ffffff', fontSize: 15, paddingHorizontal: 18, marginBottom: 10 }}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            placeholder={tr.ob_pass_ph}
            placeholderTextColor="rgba(255,255,255,0.4)"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
            style={{ width: '100%', height: 48, backgroundColor: passwordFocused ? 'rgba(229,255,0,0.06)' : 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: passwordFocused ? '#E5FF00' : 'rgba(255,255,255,0.25)', borderRadius: 25, color: '#ffffff', fontSize: 15, paddingHorizontal: 18, marginBottom: 10 }}
          />
          {error ? <Text style={{ color: 'rgba(255,140,140,0.95)', fontSize: 12, marginBottom: 8, textAlign: 'center' }}>{error}</Text> : null}

          <TouchableOpacity
            onPress={handleSignIn}
            disabled={!canSubmit}
            activeOpacity={0.85}
            style={{
              width: '100%', height: 50, borderRadius: 25,
              backgroundColor: canSubmit ? 'rgba(229,255,0,0.18)' : 'rgba(229,255,0,0.06)',
              borderWidth: 1.5, borderColor: '#E5FF00',
              alignItems: 'center', justifyContent: 'center',
              opacity: canSubmit ? 1 : 0.5,
              shadowColor: '#E5FF00', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#E5FF00', letterSpacing: 0.3 }}>{loading ? '…' : (tr.ob_auth_submit_in || 'Se connecter')}</Text>
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
