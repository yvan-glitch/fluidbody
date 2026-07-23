// ElementQuiz — "Quel élément es-tu ?" · 5 questions, 1 minute.
// Petit jeu qui relie la pratique aux Magic Days (séjours Pilates
// "les 4 éléments" d'Espace Pilates). Chaque réponse vote pour un
// élément ; le résultat affiche l'élément dominant avec sa destination
// et un CTA vers la page Magic Days du site (ancre de la carte).
//
// Autonome : aucune dépendance nouvelle (LinearGradient, Icons, haptics
// et le thème existants). Livrable en OTA.

import { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Linking, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from './Icons';
import { hapticLight, hapticSuccess } from '../utils';

const ELEMENTS = {
  air:    { icon: 'mountain', colors: ['#6fa8c9', '#2c5473'], anchor: 'rt-air' },
  terre:  { icon: 'leaf',     colors: ['#c99b5f', '#7a5226'], anchor: 'rt-terre' },
  ocean:  { icon: 'wave',     colors: ['#4fa8a0', '#17534f'], anchor: 'rt-ocean' },
  desert: { icon: 'sunrise',  colors: ['#ddb079', '#8f5a2a'], anchor: 'rt-desert' },
};

const STRINGS = {
  fr: {
    title: 'Quel élément es-tu ?',
    subtitle: '5 questions · 1 minute',
    cta_result: 'Découvrir ce Magic Day',
    retry: 'Refaire le test',
    close: 'Fermer',
    result_intro: 'Ton élément est',
    questions: [
      { q: 'Ton paysage de rêve ?', a: [
        ['air', 'Sommets et glaciers'], ['terre', 'Collines d’oliviers'],
        ['ocean', 'Vagues de l’Atlantique'], ['desert', 'Dunes à perte de vue'] ] },
      { q: 'Ta pratique idéale ?', a: [
        ['air', 'Respirer face aux montagnes'], ['terre', 'Ancrée, pieds nus au sol'],
        ['ocean', 'Fluide comme la houle'], ['desert', 'Intense au lever du soleil'] ] },
      { q: 'Ce que tu cherches en ce moment ?', a: [
        ['air', 'De la légèreté'], ['terre', 'De la stabilité'],
        ['ocean', 'Du lâcher-prise'], ['desert', 'De l’énergie'] ] },
      { q: 'Ta météo préférée ?', a: [
        ['air', 'Le vent frais'], ['terre', 'La terre chaude après la pluie'],
        ['ocean', 'La brume marine'], ['desert', 'Le plein soleil'] ] },
      { q: 'Après la séance, tu veux...', a: [
        ['air', 'Un thé face aux sommets'], ['terre', 'Un repas du terroir'],
        ['ocean', 'Plonger dans l’eau'], ['desert', 'Un coucher de soleil'] ] },
    ],
    results: {
      air:    { name: 'L’Air',   dest: 'Val Ferret · Suisse', text: 'La légèreté te va bien. Respiration, altitude et grand air : ton Magic Day t’attend face aux glaciers du Val Ferret.' },
      terre:  { name: 'La Terre',  dest: 'Espagne',             text: 'Tu es l’ancrage même. Oliviers, pierre chaude et gestes lents : ton Magic Day t’attend sur les terres ocre d’Espagne.' },
      ocean:  { name: 'L’Océan', dest: 'Portugal',            text: 'La fluidité coule en toi. Vagues, mobilité et lâcher-prise : ton Magic Day t’attend face à l’Atlantique.' },
      desert: { name: 'Le Désert', dest: 'Maroc',               text: 'Ton feu intérieur est doux et puissant. Lumière dorée et ciel étoilé : ton Magic Day t’attend au Maroc.' },
    },
  },
  en: {
    title: 'Which element are you?',
    subtitle: '5 questions · 1 minute',
    cta_result: 'Discover this Magic Day',
    retry: 'Try again',
    close: 'Close',
    result_intro: 'Your element is',
    questions: [
      { q: 'Your dream landscape?', a: [
        ['air', 'Peaks and glaciers'], ['terre', 'Olive grove hills'],
        ['ocean', 'Atlantic waves'], ['desert', 'Endless dunes'] ] },
      { q: 'Your ideal practice?', a: [
        ['air', 'Breathing facing the mountains'], ['terre', 'Grounded, barefoot'],
        ['ocean', 'Flowing like the swell'], ['desert', 'Intense at sunrise'] ] },
      { q: 'What are you looking for right now?', a: [
        ['air', 'Lightness'], ['terre', 'Stability'],
        ['ocean', 'Letting go'], ['desert', 'Energy'] ] },
      { q: 'Your favourite weather?', a: [
        ['air', 'A fresh breeze'], ['terre', 'Warm earth after rain'],
        ['ocean', 'Sea mist'], ['desert', 'Full sun'] ] },
      { q: 'After the session, you want...', a: [
        ['air', 'Tea facing the peaks'], ['terre', 'A local feast'],
        ['ocean', 'A dip in the water'], ['desert', 'A sunset'] ] },
    ],
    results: {
      air:    { name: 'Air',    dest: 'Val Ferret · Switzerland', text: 'Lightness suits you. Breath, altitude and pure air: your Magic Day awaits facing the Val Ferret glaciers.' },
      terre:  { name: 'Earth',  dest: 'Spain',                    text: 'You are grounding itself. Olive trees, warm stone and slow movement: your Magic Day awaits on the ochre lands of Spain.' },
      ocean:  { name: 'Ocean',  dest: 'Portugal',                 text: 'Fluidity flows through you. Waves, mobility and release: your Magic Day awaits facing the Atlantic.' },
      desert: { name: 'Desert', dest: 'Morocco',                  text: 'Your inner fire is soft and strong. Golden light and starry skies: your Magic Day awaits in Morocco.' },
    },
  },
};

export default function ElementQuiz({ visible, lang, onClose }) {
  const L = (lang || 'fr').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en';
  const S = STRINGS[L];
  const [step, setStep] = useState(0);
  const [votes, setVotes] = useState({ air: 0, terre: 0, ocean: 0, desert: 0 });

  function reset() { setStep(0); setVotes({ air: 0, terre: 0, ocean: 0, desert: 0 }); }
  function close() { reset(); if (onClose) onClose(); }

  function answer(el) {
    hapticLight();
    const next = { ...votes };
    next[el] += 1;
    setVotes(next);
    if (step + 1 >= S.questions.length) hapticSuccess();
    setStep(step + 1);
  }

  function winner() {
    let best = 'ocean', max = -1;
    Object.keys(votes).forEach(function (k) { if (votes[k] > max) { max = votes[k]; best = k; } });
    return best;
  }

  const finished = step >= S.questions.length;
  const el = finished ? winner() : null;
  const conf = el ? ELEMENTS[el] : null;
  const res = el ? S.results[el] : null;

  function openMagicDay() {
    const base = L === 'fr' ? 'https://espace-pilates.ch/magicdays' : 'https://espace-pilates.ch/en/magicdays';
    Linking.openURL(base + '#' + conf.anchor).catch(function () {});
  }

  return (
    <Modal visible={!!visible} animationType="slide" transparent statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,14,24,0.72)', justifyContent: 'center' }}>
        <View style={{ marginHorizontal: 20, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
          <LinearGradient
            colors={finished ? conf.colors : ['#0C3A4C', '#11788A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ padding: 24 }}
          >
            {!finished ? (
              <View>
                <Text style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', marginBottom: 6 }}>{S.subtitle}</Text>
                <Text style={{ fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 }}>{S.title}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginVertical: 14 }}>
                  {S.questions.map(function (_, i) {
                    return <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= step ? '#AEEF4D' : 'rgba(255,255,255,0.25)' }} />;
                  })}
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 }}>{S.questions[step].q}</Text>
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  {S.questions[step].a.map(function (pair, i) {
                    return (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.85}
                        onPress={function () { answer(pair[0]); }}
                        style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', marginBottom: 10 }}
                      >
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>{pair[1]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity onPress={close} style={{ alignSelf: 'center', marginTop: 10, padding: 8 }}>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{S.close}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Icon name={conf.icon} size={36} color="#fff" />
                </View>
                <Text style={{ fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>{S.result_intro}</Text>
                <Text style={{ fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 4 }}>{res.name}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#AEEF4D', marginTop: 4, letterSpacing: 1 }}>{res.dest}</Text>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.92)', lineHeight: 21, textAlign: 'center', marginTop: 14 }}>{res.text}</Text>
                <TouchableOpacity
                  onPress={openMagicDay}
                  activeOpacity={0.9}
                  style={{ marginTop: 20, paddingVertical: 14, paddingHorizontal: 26, borderRadius: 999, backgroundColor: '#AEEF4D' }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0A2540' }}>{S.cta_result}</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 22, marginTop: 14 }}>
                  <TouchableOpacity onPress={reset} style={{ padding: 6 }}>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{S.retry}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={close} style={{ padding: 6 }}>
                    <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{S.close}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}
