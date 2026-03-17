import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet, Animated, Easing, View, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Dimensions, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import Svg, { Path, Circle, Ellipse, Line, Rect, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage';


const Tab = createBottomTabNavigator();
const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_KEY || "";
const { width: SW } = Dimensions.get('window');
const VIDEO_DEMO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';


// ══════════════════════════════════
// MAPPING TENSIONS → PILIERS
// Index des zones dans ob_zones : 0=Dos/Nuque, 1=Épaules, 2=Hanches, 3=Posture, 4=Respiration, 5=Stress
// ══════════════════════════════════
const ZONE_TO_PILIER = { 0: 'p2', 1: 'p1', 2: 'p3', 3: 'p4', 4: 'p5', 5: 'p6' };


// ══════════════════════════════════
// TRADUCTIONS
// ══════════════════════════════════
const T = {
  fr: {
    lang: 'fr', flag: '🇫🇷', nom: 'Français',
    tabs: ['Mon Corps', 'Progresser', 'Sabrina', 'Biblio', 'Parcours'],
    logoSub: '🪼  Sentir · Préparer · Transformer',
    bonjour: (p) => p ? `Bonjour ${p}` : '',
    ob_tag: 'Une nouvelle façon d\'habiter son corps',
    ob_l1: 'Les autres apps te montrent ',
    ob_l1b: 'quoi faire.',
    ob_l2: 'FluidBody te montre ',
    ob_l2b: 'comment te préparer.',
    ob_sub: 'Parce qu\'un corps qui se comprend peut vraiment changer.',
    ob_cta: 'Commencer →',
    ob_compte: 'J\'ai déjà un compte',
    ob_bilan: 'Bilan corporel',
    ob_tensions: 'Où ressens-tu\ndes tensions ?',
    ob_select: 'Sélectionne une ou plusieurs zones',
    ob_zones: ['Dos / Nuque', 'Épaules', 'Hanches', 'Posture', 'Respiration', 'Stress'],
    ob_continuer: 'Continuer →',
    ob_explorer: 'Je veux tout explorer',
    ob_rythme_tag: 'Ton rythme',
    ob_rythme: 'Combien de temps\nas-tu chaque jour ?',
    ob_temps: ['5–10 min', '15–20 min', '30 min', '45 min +'],
    ob_varie: 'Ça varie',
    ob_prenom_tag: 'Dernière étape',
    ob_prenom: 'Comment\nt\'appelles-tu ?',
    ob_prenom_sub: 'Sabrina, ton coach IA, va créer\nton programme personnalisé.',
    ob_placeholder: 'Ton prénom...',
    ob_demarrer: 'Démarrer avec Sabrina →',
    ob_anon: 'Entrer anonymement',
    piliers: ['Épaules', 'Dos', 'Mobilité', 'Posture', 'Respir.', 'Conscience', 'Mat Pilates'],
    etapes: { Comprendre: 'Comprendre', Ressentir: 'Ressentir', Préparer: 'Préparer', Exécuter: 'Exécuter', Évoluer: 'Évoluer' },
    retour: '← Mon Corps',
    seances_done: (n) => `${n} / 20 séances complétées`,
    m_seances: 'Séances', m_streak: 'Streak', m_progress: 'Progression',
    retour_video: '← Retour',
    seance_done: '✓  Séance terminée',
    sabrina_sub: 'Coach FluidBody · IA',
    sabrina_hello: (p) => `Bonjour ${p || 'toi'} 🪼\n\nJe suis Sabrina, ton coach FluidBody.\n\nDis-moi comment tu te sens dans ton corps aujourd'hui.`,
    sabrina_thinking: 'Sabrina réfléchit… 🪼',
    sabrina_placeholder: 'Parle à Sabrina...',
    sabrina_label: 'SABRINA · FLUIDBODY',
    sabrina_suggestions: ['Mon dos est tendu ce matin', 'Je veux travailler mes épaules', 'Comment respirer profondément ?', 'Propose-moi une séance du jour'],
    sabrina_system: `Tu es Sabrina, coach IA de FluidBody — une app de mouvement conscient fondée sur 23 ans d'expertise Pilates. Ta méthode : Comprendre → Ressentir → Préparer → Exécuter → Évoluer. Réponds en français, maximum 150 mots, de façon chaleureuse et incarnée.`,
    biblio_titre: 'Bibliothèque',
    biblio_sub: 'Comprendre pour mieux ressentir',
    tab_piliers: 'Les 6 piliers',
    tab_methode: 'La méthode',
    biblio_intro: 'La méthode FluidBody repose sur 5 étapes progressives. Chaque séance les traverse dans l\'ordre.',
    lire: ' de lecture',
    retour_biblio: '← Bibliothèque',
    points_cles: 'Points clés',
    mon_parcours: 'Mon Parcours',
    prog_globale: 'Progression globale',
    par_pilier: 'Par pilier',
    mon_compte: 'Mon compte',
    compte_info: [['Coach IA', 'Sabrina · FluidBody'], ['Version', 'FluidBody Beta 1.0'], ['Méthode', 'Pilates Conscient · 23 ans']],
    progresser_sub: (p) => `${p}% du parcours complété`,
    recommande_pour_toi: 'POUR TOI',
    free_messages_left: (n) => `${n} message${n > 1 ? 's' : ''} gratuit${n > 1 ? 's' : ''} restant`,
    free_limit_title: 'Continue avec Sabrina',
    free_limit_sub: 'Tu as utilisé tes 3 messages gratuits aujourd\'hui.',
    free_limit_cta: 'Débloquer Sabrina Premium',
    free_limit_price: '4,99€ / mois · Sans engagement',
    free_limit_restore: 'Restaurer un achat',
    free_limit_later: 'Plus tard',
    premium_badge: 'PREMIUM',
    premium_active: 'Sabrina illimitée ✓',
  },
  en: {
    lang: 'en', flag: '🇬🇧', nom: 'English',
    tabs: ['My Body', 'Progress', 'Sabrina', 'Library', 'Journey'],
    logoSub: '🪼  Feel · Prepare · Transform',
    bonjour: (p) => p ? `Hello ${p}` : '',
    ob_tag: 'A new way to inhabit your body',
    ob_l1: 'Other apps show you ',
    ob_l1b: 'what to do.',
    ob_l2: 'FluidBody shows you ',
    ob_l2b: 'how to prepare.',
    ob_sub: 'Because a body that understands itself can truly change.',
    ob_cta: 'Get Started →',
    ob_compte: 'I already have an account',
    ob_bilan: 'Body assessment',
    ob_tensions: 'Where do you feel\ntension?',
    ob_select: 'Select one or more areas',
    ob_zones: ['Back / Neck', 'Shoulders', 'Hips', 'Posture', 'Breathing', 'Stress'],
    ob_continuer: 'Continue →',
    ob_explorer: 'I want to explore everything',
    ob_rythme_tag: 'Your rhythm',
    ob_rythme: 'How much time do you\nhave each day?',
    ob_temps: ['5–10 min', '15–20 min', '30 min', '45 min +'],
    ob_varie: 'It varies',
    ob_prenom_tag: 'Last step',
    ob_prenom: 'What\'s\nyour name?',
    ob_prenom_sub: 'Sabrina, your AI coach, will create\nyour personalized program.',
    ob_placeholder: 'Your first name...',
    ob_demarrer: 'Start with Sabrina →',
    ob_anon: 'Enter anonymously',
    piliers: ['Shoulders', 'Back', 'Mobility', 'Posture', 'Breath.', 'Awareness', 'Mat Pilates'],
    etapes: { Comprendre: 'Understand', Ressentir: 'Feel', Préparer: 'Prepare', Exécuter: 'Execute', Évoluer: 'Evolve' },
    retour: '← My Body',
    seances_done: (n) => `${n} / 20 sessions completed`,
    m_seances: 'Sessions', m_streak: 'Streak', m_progress: 'Progress',
    retour_video: '← Back',
    seance_done: '✓  Session complete',
    sabrina_sub: 'FluidBody Coach · AI',
    sabrina_hello: (p) => `Hello ${p || 'there'} 🪼\n\nI'm Sabrina, your FluidBody coach.\n\nTell me how you feel in your body today.`,
    sabrina_thinking: 'Sabrina is thinking… 🪼',
    sabrina_placeholder: 'Talk to Sabrina...',
    sabrina_label: 'SABRINA · FLUIDBODY',
    sabrina_suggestions: ['My back is tense this morning', 'I want to work on my shoulders', 'How to breathe deeply?', 'Suggest a session for today'],
    sabrina_system: `You are Sabrina, AI coach of FluidBody — a conscious movement app founded on 23 years of Pilates expertise. Your method: Understand → Feel → Prepare → Execute → Evolve. Reply in English, maximum 150 words, warmly and authentically.`,
    biblio_titre: 'Library',
    biblio_sub: 'Understand to feel better',
    tab_piliers: 'The 6 pillars',
    tab_methode: 'The method',
    biblio_intro: 'The FluidBody method is built on 5 progressive steps. Each session follows them in order.',
    lire: ' read',
    retour_biblio: '← Library',
    points_cles: 'Key points',
    mon_parcours: 'My Journey',
    prog_globale: 'Overall progress',
    par_pilier: 'By pillar',
    mon_compte: 'My account',
    compte_info: [['AI Coach', 'Sabrina · FluidBody'], ['Version', 'FluidBody Beta 1.0'], ['Method', 'Conscious Pilates · 23 years']],
    progresser_sub: (p) => `${p}% of journey completed`,
    recommande_pour_toi: 'FOR YOU',
    free_messages_left: (n) => `${n} free message${n > 1 ? 's' : ''} left`,
    free_limit_title: 'Continue with Sabrina',
    free_limit_sub: 'You\'ve used your 3 free messages today.',
    free_limit_cta: 'Unlock Sabrina Premium',
    free_limit_price: '€4.99 / month · No commitment',
    free_limit_restore: 'Restore purchase',
    free_limit_later: 'Later',
    premium_badge: 'PREMIUM',
    premium_active: 'Unlimited Sabrina ✓',
  },
  es: {
    lang: 'es', flag: '🇪🇸', nom: 'Español',
    tabs: ['Mi Cuerpo', 'Progresar', 'Sabrina', 'Biblioteca', 'Recorrido'],
    logoSub: '🪼  Sentir · Preparar · Transformar',
    bonjour: (p) => p ? `Hola ${p}` : '',
    ob_tag: 'Una nueva forma de habitar tu cuerpo',
    ob_l1: 'Otras apps te muestran ',
    ob_l1b: 'qué hacer.',
    ob_l2: 'FluidBody te muestra ',
    ob_l2b: 'cómo prepararte.',
    ob_sub: 'Porque un cuerpo que se entiende puede realmente cambiar.',
    ob_cta: 'Comenzar →',
    ob_compte: 'Ya tengo una cuenta',
    ob_bilan: 'Evaluación corporal',
    ob_tensions: '¿Dónde sientes\ntensión?',
    ob_select: 'Selecciona una o varias zonas',
    ob_zones: ['Espalda / Cuello', 'Hombros', 'Caderas', 'Postura', 'Respiración', 'Estrés'],
    ob_continuer: 'Continuar →',
    ob_explorer: 'Quiero explorarlo todo',
    ob_rythme_tag: 'Tu ritmo',
    ob_rythme: '¿Cuánto tiempo tienes\ncada día?',
    ob_temps: ['5–10 min', '15–20 min', '30 min', '45 min +'],
    ob_varie: 'Varía',
    ob_prenom_tag: 'Último paso',
    ob_prenom: '¿Cómo\nte llamas?',
    ob_prenom_sub: 'Sabrina, tu coach IA, creará\ntu programa personalizado.',
    ob_placeholder: 'Tu nombre...',
    ob_demarrer: 'Comenzar con Sabrina →',
    ob_anon: 'Entrar anónimamente',
    piliers: ['Hombros', 'Espalda', 'Movilidad', 'Postura', 'Respir.', 'Conciencia', 'Mat Pilates'],
    etapes: { Comprendre: 'Comprender', Ressentir: 'Sentir', Préparer: 'Preparar', Exécuter: 'Ejecutar', Évoluer: 'Evolucionar' },
    retour: '← Mi Cuerpo',
    seances_done: (n) => `${n} / 20 sesiones completadas`,
    m_seances: 'Sesiones', m_streak: 'Racha', m_progress: 'Progreso',
    retour_video: '← Volver',
    seance_done: '✓  Sesión terminada',
    sabrina_sub: 'Coach FluidBody · IA',
    sabrina_hello: (p) => `Hola ${p || 'tú'} 🪼\n\nSoy Sabrina, tu coach FluidBody.\n\nCuéntame cómo te sientes en tu cuerpo hoy.`,
    sabrina_thinking: 'Sabrina está pensando… 🪼',
    sabrina_placeholder: 'Habla con Sabrina...',
    sabrina_label: 'SABRINA · FLUIDBODY',
    sabrina_suggestions: ['Mi espalda está tensa esta mañana', 'Quiero trabajar mis hombros', '¿Cómo respirar profundamente?', 'Sugiere una sesión para hoy'],
    sabrina_system: `Eres Sabrina, coach IA de FluidBody — una app de movimiento consciente basada en 23 años de experiencia en Pilates. Tu método: Comprender → Sentir → Preparar → Ejecutar → Evolucionar. Responde en español, máximo 150 palabras, de forma cálida y auténtica.`,
    biblio_titre: 'Biblioteca',
    biblio_sub: 'Comprender para sentir mejor',
    tab_piliers: 'Los 6 pilares',
    tab_methode: 'El método',
    biblio_intro: 'El método FluidBody se basa en 5 pasos progresivos. Cada sesión los recorre en orden.',
    lire: ' de lectura',
    retour_biblio: '← Biblioteca',
    points_cles: 'Puntos clave',
    mon_parcours: 'Mi Recorrido',
    prog_globale: 'Progreso global',
    par_pilier: 'Por pilar',
    mon_compte: 'Mi cuenta',
    compte_info: [['Coach IA', 'Sabrina · FluidBody'], ['Versión', 'FluidBody Beta 1.0'], ['Método', 'Pilates Consciente · 23 años']],
    progresser_sub: (p) => `${p}% del recorrido completado`,
    recommande_pour_toi: 'PARA TI',
    free_messages_left: (n) => `${n} mensaje${n > 1 ? 's' : ''} gratis restante${n > 1 ? 's' : ''}`,
    free_limit_title: 'Continúa con Sabrina',
    free_limit_sub: 'Has usado tus 3 mensajes gratuitos de hoy.',
    free_limit_cta: 'Desbloquear Sabrina Premium',
    free_limit_price: '4,99€ / mes · Sin compromiso',
    free_limit_restore: 'Restaurar compra',
    free_limit_later: 'Más tarde',
    premium_badge: 'PREMIUM',
    premium_active: 'Sabrina ilimitada ✓',
  },
  it: {
    lang: 'it', flag: '🇮🇹', nom: 'Italiano',
    tabs: ['Il Mio Corpo', 'Progredire', 'Sabrina', 'Biblioteca', 'Percorso'],
    logoSub: '🪼  Sentire · Preparare · Trasformare',
    bonjour: (p) => p ? `Ciao ${p}` : '',
    ob_tag: 'Un nuovo modo di abitare il tuo corpo',
    ob_l1: 'Le altre app ti mostrano ',
    ob_l1b: 'cosa fare.',
    ob_l2: 'FluidBody ti mostra ',
    ob_l2b: 'come prepararti.',
    ob_sub: 'Perché un corpo che si comprende può davvero cambiare.',
    ob_cta: 'Inizia →',
    ob_compte: 'Ho già un account',
    ob_bilan: 'Valutazione corporea',
    ob_tensions: 'Dove senti\ntensione?',
    ob_select: 'Seleziona una o più zone',
    ob_zones: ['Schiena / Collo', 'Spalle', 'Fianchi', 'Postura', 'Respirazione', 'Stress'],
    ob_continuer: 'Continua →',
    ob_explorer: 'Voglio esplorare tutto',
    ob_rythme_tag: 'Il tuo ritmo',
    ob_rythme: 'Quanto tempo hai\nogni giorno?',
    ob_temps: ['5–10 min', '15–20 min', '30 min', '45 min +'],
    ob_varie: 'Varia',
    ob_prenom_tag: 'Ultimo passo',
    ob_prenom: 'Come ti\nchiami?',
    ob_prenom_sub: 'Sabrina, la tua coach IA, creerà\nil tuo programma personalizzato.',
    ob_placeholder: 'Il tuo nome...',
    ob_demarrer: 'Inizia con Sabrina →',
    ob_anon: 'Entra anonimamente',
    piliers: ['Spalle', 'Schiena', 'Mobilità', 'Postura', 'Respir.', 'Coscienza', 'Mat Pilates'],
    etapes: { Comprendre: 'Capire', Ressentir: 'Sentire', Préparer: 'Preparare', Exécuter: 'Eseguire', Évoluer: 'Evolvere' },
    retour: '← Il Mio Corpo',
    seances_done: (n) => `${n} / 20 sessioni completate`,
    m_seances: 'Sessioni', m_streak: 'Serie', m_progress: 'Progresso',
    retour_video: '← Indietro',
    seance_done: '✓  Sessione completata',
    sabrina_sub: 'Coach FluidBody · IA',
    sabrina_hello: (p) => `Ciao ${p || 'tu'} 🪼\n\nSono Sabrina, la tua coach FluidBody.\n\nDimmi come ti senti nel tuo corpo oggi.`,
    sabrina_thinking: 'Sabrina sta pensando… 🪼',
    sabrina_placeholder: 'Parla con Sabrina...',
    sabrina_label: 'SABRINA · FLUIDBODY',
    sabrina_suggestions: ['La mia schiena è tesa stamattina', 'Voglio lavorare sulle spalle', 'Come respirare in profondità?', 'Suggerisci una sessione per oggi'],
    sabrina_system: `Sei Sabrina, coach IA di FluidBody — un'app di movimento consapevole fondata su 23 anni di esperienza nel Pilates. Il tuo metodo: Capire → Sentire → Preparare → Eseguire → Evolvere. Rispondi in italiano, massimo 150 parole, in modo caldo e autentico.`,
    biblio_titre: 'Biblioteca',
    biblio_sub: 'Capire per sentire meglio',
    tab_piliers: 'I 6 pilastri',
    tab_methode: 'Il metodo',
    biblio_intro: 'Il metodo FluidBody si basa su 5 passaggi progressivi. Ogni sessione li percorre in ordine.',
    lire: ' di lettura',
    retour_biblio: '← Biblioteca',
    points_cles: 'Punti chiave',
    mon_parcours: 'Il Mio Percorso',
    prog_globale: 'Progresso globale',
    par_pilier: 'Per pilastro',
    mon_compte: 'Il mio account',
    compte_info: [['Coach IA', 'Sabrina · FluidBody'], ['Versione', 'FluidBody Beta 1.0'], ['Metodo', 'Pilates Consapevole · 23 anni']],
    progresser_sub: (p) => `${p}% del percorso completato`,
    recommande_pour_toi: 'PER TE',
    free_messages_left: (n) => `${n} messaggio${n > 1 ? 'i' : ''} gratuito${n > 1 ? 'i' : ''} rimasto${n > 1 ? 'i' : ''}`,
    free_limit_title: 'Continua con Sabrina',
    free_limit_sub: 'Hai usato i tuoi 3 messaggi gratuiti di oggi.',
    free_limit_cta: 'Sblocca Sabrina Premium',
    free_limit_price: '4,99€ / mese · Senza impegno',
    free_limit_restore: 'Ripristina acquisto',
    free_limit_later: 'Più tardi',
    premium_badge: 'PREMIUM',
    premium_active: 'Sabrina illimitata ✓',
  },
};

const ARTICLES = {
  fr: [
    { key: 'p1', titre: 'L\'épaule — l\'articulaire la plus libre', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'L\'épaule est l\'articulation la plus mobile du corps humain. Cette liberté extraordinaire a un prix : la stabilité ne vient pas de l\'os, mais entièrement des muscles.', corps: `La coiffe des rotateurs — quatre muscles profonds — est le vrai chef d'orchestre de chaque mouvement. Quand elle est faible ou mal activée, les tensions s'installent insidieusement dans les trapèzes, le cou, parfois jusqu'aux lombaires.\n\nLe problème n'est jamais là où ça fait mal.\n\nAvant de renforcer, il faut comprendre. Sentir comment l'omoplate glisse sur la cage thoracique. Ressentir le poids du bras se déposer dans l'articulation. Laisser la tête de l'humérus s'ancrer dans la glène.\n\nC'est depuis cette conscience que naît le mouvement juste — fluide, sans effort apparent, sans douleur.`, citation: 'L\'épaule libre, c\'est une épaule qui a appris à se poser avant de s\'élever.' },
    { key: 'p2', titre: 'Le dos — pourquoi ça souffre vraiment', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Huit personnes sur dix souffriront du dos à un moment de leur vie. Pourtant, la douleur est rarement là où le problème se trouve.', corps: `La colonne vertébrale est une architecture de génie : 33 vertèbres, des dizaines de muscles, des ligaments, des disques amortisseurs. Tout est conçu pour le mouvement — pas pour l'immobilité.\n\nLe vrai ennemi du dos, c'est la sédentarité. Rester assis des heures raccourcit le psoas, déséquilibre le bassin, écrase les disques.\n\nMais le dos répond extraordinairement bien quand on lui redonne de la conscience. Sentir la respiration gonfler les côtes postérieures. Percevoir l'espace entre chaque vertèbre.\n\nLe dos ne guérit pas par le repos. Il guérit par le mouvement conscient.`, citation: 'Un dos qui souffre est un dos qui demande à être entendu.' },
    { key: 'p3', titre: 'La mobilité — la jeunesse du corps', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'On ne vieillit pas d\'abord dans la peau, mais dans les articulations. La mobilité est la mesure la plus fidèle de la jeunesse corporelle.', corps: `La hanche est le centre de gravité du corps. Quand elle se bloque, tout compense : les lombaires, les genoux, les épaules.\n\nLa mobilité ne se confond pas avec la souplesse. On peut être souple sans être mobile. La mobilité, c'est la capacité à contrôler activement une amplitude de mouvement.\n\nC'est une compétence. Elle s'acquiert, se travaille, s'entretient. Et chaque degré de liberté retrouvé dans une articulation est une invitation à habiter le corps différemment.\n\nMobiliser, c'est rajeunir.`, citation: 'La liberté de mouvement n\'est pas un luxe. C\'est une nécessité vitale.' },
    { key: 'p4', titre: 'La posture — l\'empreinte de notre histoire', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'La posture raconte qui nous sommes — nos habitudes, nos émotions, notre rapport au monde. Changer sa posture, c\'est transformer bien plus que son corps.', corps: `Il n'existe pas une "bonne posture" figée. La meilleure posture est celle que vous quittez.\n\nPourtant, certains schémas créent de la souffrance : tête en avant, épaules enroulées, bassin basculé. Ces déséquilibres s'installent silencieusement sur des années.\n\nLa rééducation posturale commence par la perception. Sentir où est le poids dans les pieds. Percevoir la hauteur relative des hanches.\n\nLa posture juste émerge de l'intérieur — elle ne se plaque pas de l'extérieur.`, citation: 'Se tenir droit ne signifie pas se raidir. Ça signifie s\'aligner.' },
    { key: 'p5', titre: 'La respiration — le chef d\'orchestre oublié', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'On respire 20 000 fois par jour sans y penser. Et c\'est précisément le problème.', corps: `Le diaphragme est le muscle respiratoire principal. Quand il fonctionne pleinement, il masse les organes internes, stabilise la colonne, régule le système nerveux.\n\nMais la plupart d'entre nous respirons trop haut, trop vite, trop superficiellement.\n\nUne seule minute de respiration abdominale consciente peut diminuer le cortisol, ralentir le rythme cardiaque, libérer les tensions du bas du dos.\n\nApprendre à respirer — vraiment — c'est l'un des actes les plus transformateurs qu'on puisse poser pour son corps.`, citation: 'Dans chaque souffle conscient, le corps retrouve son chemin vers le calme.' },
    { key: 'p6', titre: 'La conscience corporelle — sentir pour bouger juste', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'La proprioception est le sens le moins connu — et pourtant le plus fondamental. C\'est grâce à elle qu\'on sait où est notre corps dans l\'espace.', corps: `Des milliers de récepteurs sensoriels dans les muscles, les tendons et les articulations envoient en permanence des informations au cerveau.\n\nQuand cette carte intérieure est précise, le mouvement est fluide, économe, sans effort inutile. Quand elle est floue, le corps compense, surmène certains muscles, en ignore d'autres.\n\nLa conscience corporelle se cultive. Par le mouvement lent. Par l'attention portée aux sensations. Par le travail en fermeture des yeux.\n\nSentir juste, c'est la condition du mouvement juste.`, citation: 'Le corps sait. Il faut juste apprendre à l\'écouter.' },
    { key: 'p7', titre: 'Le Mat Pilates — le sol comme fondation', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'Le Mat Pilates est la forme la plus pure de la méthode. Sans machine, sans accessoire — juste le corps, le sol, et la conscience.', corps: `Joseph Pilates l'appelait "Contrology" — l'art de contrôler le corps avec l'esprit. Le travail au sol en est l'expression la plus directe.\n\nSans le support du Reformer, le corps apprend à s'auto-stabiliser. Les muscles profonds — transverse de l'abdomen, multifides, plancher pelvien — deviennent les véritables acteurs du mouvement.\n\nChaque exercice au sol est une invitation à revenir à l'essentiel. Sentir le contact du dos sur le tapis. Percevoir la neutralité de la colonne. Activer le centre avant d'initier tout mouvement.\n\nLe Mat Pilates n'est pas une pratique "facile". C'est une pratique profonde, qui exige une conscience totale à chaque instant.`, citation: 'Le sol ne ment pas. Il révèle exactement où tu en es.' },
  ],
  en: [
    { key: 'p1', titre: 'The shoulder — the most free joint', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'The shoulder is the most mobile joint in the human body. This extraordinary freedom comes at a price: stability comes not from bone, but entirely from muscles.', corps: `The rotator cuff — four deep muscles — is the true conductor of every movement. When it is weak or poorly activated, tension insidiously settles in the trapezius, neck, sometimes down to the lower back.\n\nThe problem is never where it hurts.\n\nBefore strengthening, you must understand. Feel how the shoulder blade glides on the rib cage. Sense the weight of the arm settling into the joint.\n\nFrom this awareness, the right movement is born — fluid, effortless, pain-free.`, citation: 'A free shoulder is one that has learned to settle before it rises.' },
    { key: 'p2', titre: 'The back — why it really hurts', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Eight out of ten people will suffer from back pain at some point in their lives. Yet the pain is rarely where the problem lies.', corps: `The spine is a work of genius: 33 vertebrae, dozens of muscles, ligaments, shock-absorbing discs. Everything is designed for movement — not immobility.\n\nThe true enemy of the back is sedentary life. Sitting for hours shortens the psoas, imbalances the pelvis, crushes the discs.\n\nBut the back responds extraordinarily well when you restore awareness to it. Feel the breath inflate the posterior ribs. Perceive the space between each vertebra.\n\nThe back does not heal through rest. It heals through conscious movement.`, citation: 'A back in pain is a back asking to be heard.' },
    { key: 'p3', titre: 'Mobility — the youth of the body', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'We don\'t age first in our skin, but in our joints. Mobility is the most faithful measure of physical youth.', corps: `The hip is the body's center of gravity. When it locks up, everything compensates: the lower back, the knees, the shoulders.\n\nMobility is not the same as flexibility. You can be flexible without being mobile. Mobility is the ability to actively control a range of movement.\n\nIt is a skill. It is acquired, practiced, maintained. And every degree of freedom regained in a joint is an invitation to inhabit the body differently.\n\nTo mobilize is to rejuvenate.`, citation: 'Freedom of movement is not a luxury. It is a vital necessity.' },
    { key: 'p4', titre: 'Posture — the imprint of our history', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'Posture tells the story of who we are — our habits, emotions, relationship with the world. Changing your posture transforms far more than your body.', corps: `There is no single "correct posture". The best posture is the one you leave.\n\nYet certain patterns create suffering: head forward, rounded shoulders, tilted pelvis. These imbalances settle silently over years.\n\nPostural re-education begins with perception. Feel where the weight is in your feet. Sense the relative height of your hips.\n\nThe right posture emerges from within — it cannot be imposed from outside.`, citation: 'Standing tall doesn\'t mean stiffening up. It means aligning.' },
    { key: 'p5', titre: 'Breathing — the forgotten conductor', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'We breathe 20,000 times a day without thinking about it. And that is precisely the problem.', corps: `The diaphragm is the primary breathing muscle. When it works fully, it massages the internal organs, stabilizes the spine, regulates the nervous system.\n\nBut most of us breathe too high, too fast, too shallow.\n\nJust one minute of conscious abdominal breathing can lower cortisol, slow the heart rate, release lower back tension.\n\nLearning to breathe — truly — is one of the most transformative acts you can do for your body.`, citation: 'In every conscious breath, the body finds its way back to calm.' },
    { key: 'p6', titre: 'Body awareness — feel to move right', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'Proprioception is the least known sense — and yet the most fundamental. It is thanks to it that we know where our body is in space.', corps: `Thousands of sensory receptors in muscles, tendons and joints constantly send information to the brain.\n\nWhen this inner map is precise, movement is fluid, economical, effortless. When it is blurry, the body compensates, overworks some muscles, ignores others.\n\nBody awareness is cultivated. Through slow movement. Through attention to sensations. Through working with eyes closed.\n\nFeeling right is the condition for moving right.`, citation: 'The body knows. You just need to learn to listen to it.' },
    { key: 'p7', titre: 'Mat Pilates — the floor as foundation', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'Mat Pilates is the purest form of the method. No machine, no accessory — just the body, the floor, and awareness.', corps: `Joseph Pilates called it "Contrology" — the art of controlling the body with the mind. Floorwork is its most direct expression.\n\nWithout the support of the Reformer, the body learns to self-stabilize. The deep muscles — transverse abdominis, multifidus, pelvic floor — become the true actors of movement.\n\nEach mat exercise is an invitation to return to the essential. Feel the contact of the back on the mat. Perceive the neutrality of the spine.\n\nMat Pilates is not an "easy" practice. It is a deep practice, demanding total awareness at every moment.`, citation: 'The floor doesn\'t lie. It reveals exactly where you are.' },
  ],
  es: [
    { key: 'p1', titre: 'El hombro — la articulación más libre', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'El hombro es la articulación más móvil del cuerpo humano. Esta libertad extraordinaria tiene un precio: la estabilidad no viene del hueso, sino completamente de los músculos.', corps: `El manguito rotador — cuatro músculos profundos — es el verdadero director de cada movimiento. Cuando está débil o mal activado, las tensiones se instalan insidiosamente en los trapecios, el cuello, a veces hasta los lumbares.\n\nEl problema nunca está donde duele.\n\nAntes de fortalecer, hay que comprender. Sentir cómo el omóplato se desliza sobre la caja torácica.\n\nDesde esta conciencia nace el movimiento correcto — fluido, sin esfuerzo aparente, sin dolor.`, citation: 'Un hombro libre es uno que ha aprendido a posarse antes de elevarse.' },
    { key: 'p2', titre: 'La espalda — por qué realmente duele', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Ocho de cada diez personas sufrirán de dolor de espalda en algún momento de su vida. Sin embargo, el dolor rara vez está donde está el problema.', corps: `La columna vertebral es una obra maestra: 33 vértebras, decenas de músculos, ligamentos, discos amortiguadores. Todo está diseñado para el movimiento — no para la inmovilidad.\n\nEl verdadero enemigo de la espalda es el sedentarismo. Estar sentado horas acorta el psoas, desequilibra la pelvis, aplasta los discos.\n\nLa espalda no sana con el reposo. Sana con el movimiento consciente.`, citation: 'Una espalda que duele es una espalda que pide ser escuchada.' },
    { key: 'p3', titre: 'La movilidad — la juventud del cuerpo', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'No envejecemos primero en la piel, sino en las articulaciones. La movilidad es la medida más fiel de la juventud corporal.', corps: `La cadera es el centro de gravedad del cuerpo. Cuando se bloquea, todo compensa: los lumbares, las rodillas, los hombros.\n\nLa movilidad no se confunde con la flexibilidad. Puedes ser flexible sin ser móvil. La movilidad es la capacidad de controlar activamente un rango de movimiento.\n\nMovilizar es rejuvenecer.`, citation: 'La libertad de movimiento no es un lujo. Es una necesidad vital.' },
    { key: 'p4', titre: 'La postura — la huella de nuestra historia', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'La postura cuenta quiénes somos — nuestros hábitos, emociones, relación con el mundo. Cambiar la postura es transformar mucho más que el cuerpo.', corps: `No existe una "buena postura" fija. La mejor postura es la que abandonas.\n\nSin embargo, ciertos esquemas crean sufrimiento: cabeza adelantada, hombros encorvados, pelvis inclinada.\n\nLa postura correcta emerge desde adentro — no se impone desde afuera.`, citation: 'Mantenerse erguido no significa ponerse rígido. Significa alinearse.' },
    { key: 'p5', titre: 'La respiración — el director olvidado', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'Respiramos 20.000 veces al día sin pensarlo. Y ese es precisamente el problema.', corps: `El diafragma es el músculo respiratorio principal. Cuando funciona plenamente, masajea los órganos internos, estabiliza la columna, regula el sistema nervioso.\n\nAprender a respirar — de verdad — es uno de los actos más transformadores que puedes hacer por tu cuerpo.`, citation: 'En cada respiración consciente, el cuerpo encuentra su camino hacia la calma.' },
    { key: 'p6', titre: 'La conciencia corporal — sentir para moverse bien', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'La propiocepción es el sentido menos conocido — y sin embargo el más fundamental.', corps: `Miles de receptores sensoriales en músculos, tendones y articulaciones envían constantemente información al cerebro.\n\nLa conciencia corporal se cultiva. A través del movimiento lento. A través de la atención a las sensaciones.\n\nSentir bien es la condición para moverse bien.`, citation: 'El cuerpo sabe. Solo hay que aprender a escucharlo.' },
    { key: 'p7', titre: 'Mat Pilates — el suelo como fundación', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'El Mat Pilates es la forma más pura del método. Sin máquina, sin accesorio — solo el cuerpo, el suelo y la conciencia.', corps: `Joseph Pilates lo llamaba "Contrología" — el arte de controlar el cuerpo con la mente. El trabajo en suelo es su expresión más directa.\n\nSin el soporte del Reformer, el cuerpo aprende a autoestabilizarse. Los músculos profundos se convierten en los verdaderos actores del movimiento.\n\nEl Mat Pilates no es una práctica "fácil". Es una práctica profunda que exige total conciencia en cada instante.`, citation: 'El suelo no miente. Revela exactamente dónde estás.' },
  ],
  it: [
    { key: 'p1', titre: 'La spalla — l\'articolazione più libera', color: 'rgba(0,215,168,0.9)', duree: '3 min', intro: 'La spalla è l\'articolazione più mobile del corpo umano.', corps: `La cuffia dei rotatori — quattro muscoli profondi — è il vero direttore d'orchestra di ogni movimento.\n\nIl problema non è mai dove fa male.\n\nDa questa consapevolezza nasce il movimento giusto — fluido, senza sforzo apparente, senza dolore.`, citation: 'Una spalla libera è una spalla che ha imparato a posarsi prima di elevarsi.' },
    { key: 'p2', titre: 'La schiena — perché fa davvero male', color: 'rgba(255,208,65,0.9)', duree: '4 min', intro: 'Otto persone su dieci soffriranno di mal di schiena a un certo punto della loro vita.', corps: `La schiena non guarisce con il riposo. Guarisce con il movimento consapevole.`, citation: 'Una schiena che soffre è una schiena che chiede di essere ascoltata.' },
    { key: 'p3', titre: 'La mobilità — la giovinezza del corpo', color: 'rgba(0,200,255,0.9)', duree: '3 min', intro: 'Non invecchiamo prima nella pelle, ma nelle articolazioni.', corps: `Mobilizzare è ringiovanire.`, citation: 'La libertà di movimento non è un lusso. È una necessità vitale.' },
    { key: 'p4', titre: 'La postura — l\'impronta della nostra storia', color: 'rgba(255,160,50,0.9)', duree: '4 min', intro: 'La postura racconta chi siamo.', corps: `La postura giusta emerge dall'interno — non si impone dall'esterno.`, citation: 'Stare dritti non significa irrigidirsi. Significa allinearsi.' },
    { key: 'p5', titre: 'La respirazione — il direttore dimenticato', color: 'rgba(155,205,255,0.9)', duree: '3 min', intro: 'Respiriamo 20.000 volte al giorno senza pensarci.', corps: `Imparare a respirare — davvero — è uno degli atti più trasformativi che si possano fare per il proprio corpo.`, citation: 'In ogni respiro consapevole, il corpo ritrova la sua strada verso la calma.' },
    { key: 'p6', titre: 'La consapevolezza corporea — sentire per muoversi bene', color: 'rgba(180,140,255,0.9)', duree: '4 min', intro: 'La propriocezione è il senso meno conosciuto — eppure il più fondamentale.', corps: `La consapevolezza corporea si coltiva. Attraverso il movimento lento.\n\nSentire bene è la condizione per muoversi bene.`, citation: 'Il corpo sa. Bisogna solo imparare ad ascoltarlo.' },
    { key: 'p7', titre: 'Mat Pilates — il pavimento come fondamento', color: 'rgba(255,100,180,0.9)', duree: '4 min', intro: 'Il Mat Pilates è la forma più pura del metodo. Senza macchine, senza accessori — solo il corpo, il pavimento e la consapevolezza.', corps: `Joseph Pilates lo chiamava "Contrologia" — l'arte di controllare il corpo con la mente. Il lavoro a terra ne è l'espressione più diretta.\n\nSenza il supporto del Reformer, il corpo impara ad auto-stabilizzarsi. I muscoli profondi diventano i veri protagonisti del movimento.\n\nIl Mat Pilates non è una pratica "facile". È una pratica profonda che richiede totale consapevolezza in ogni istante.`, citation: 'Il pavimento non mente. Rivela esattamente dove sei.' },
  ],
};

const FICHES = {
  fr: [
    { etape: 'Comprendre', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Savoir ce qu\'on fait et pourquoi', description: 'Avant de bouger, comprendre. Quelle articulation travaille ? Quel muscle s\'active ? La compréhension anatomique transforme un exercice mécanique en acte conscient.', points: ['Nommer ce qu\'on ressent', 'Comprendre la mécanique articulaire', 'Identifier les compensations habituelles', 'Visualiser le mouvement avant de le faire'] },
    { etape: 'Ressentir', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Développer la carte intérieure', description: 'Fermer les yeux. Écouter. Où est la tension ? Où est le relâchement ? Le ressenti précède toujours le mouvement juste.', points: ['Scanner le corps sans jugement', 'Distinguer tension utile et tension parasite', 'Sentir les asymétries gauche/droite', 'Habiter chaque partie du corps tour à tour'] },
    { etape: 'Préparer', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Activer avant de performer', description: 'Le corps ne passe pas de 0 à 100. La préparation éveille les stabilisateurs profonds, chauffe les articulations, active les connexions neuromusculaires.', points: ['Mobiliser les articulations concernées', 'Activer les muscles stabilisateurs', 'Établir le pattern respiratoire', 'Centrer l\'attention sur la zone de travail'] },
    { etape: 'Exécuter', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'Le geste juste, pas le geste fort', description: 'L\'exécution dans la méthode FluidBody n\'est jamais brutale. La qualité prime sur la quantité. Un mouvement lent, précis, respiré, a cent fois plus de valeur.', points: ['Maintenir la conscience pendant l\'effort', 'Respirer — ne jamais bloquer le souffle', 'Travailler en amplitude contrôlée', 'Sentir le muscle cible, pas les compensations'] },
    { etape: 'Évoluer', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progresser sans se perdre', description: 'L\'évolution n\'est pas une course. C\'est une spirale ascendante — on revient aux mêmes gestes, mais avec une conscience plus fine, une capacité plus grande.', points: ['Augmenter l\'amplitude avant la charge', 'Intégrer le mouvement au quotidien', 'Mesurer le progrès par la qualité', 'Revenir aux bases pour mieux avancer'] },
  ],
  en: [
    { etape: 'Understand', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Know what you\'re doing and why', description: 'Before moving, understand. Which joint is working? Which muscle is activating? Anatomical understanding transforms a mechanical exercise into a conscious act.', points: ['Name what you feel', 'Understand joint mechanics', 'Identify habitual compensations', 'Visualize the movement before doing it'] },
    { etape: 'Feel', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Develop your inner map', description: 'Close your eyes. Listen. Where is the tension? Where is the release? Feeling always precedes the right movement.', points: ['Scan the body without judgment', 'Distinguish useful tension from parasitic tension', 'Feel left/right asymmetries', 'Inhabit each part of the body in turn'] },
    { etape: 'Prepare', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Activate before performing', description: 'The body doesn\'t go from 0 to 100. Preparation awakens deep stabilizers, warms the joints, activates neuromuscular connections.', points: ['Mobilize the relevant joints', 'Activate stabilizer muscles', 'Establish breathing pattern', 'Center attention on the work area'] },
    { etape: 'Execute', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'The right gesture, not the strong one', description: 'Execution in the FluidBody method is never brutal. Quality trumps quantity. A slow, precise, breathing movement has a hundred times more value.', points: ['Maintain awareness during effort', 'Breathe — never hold your breath', 'Work in controlled range', 'Feel the target muscle, not compensations'] },
    { etape: 'Evolve', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progress without getting lost', description: 'Evolution is not a race. It is an upward spiral — we return to the same movements, but with finer awareness, greater capacity.', points: ['Increase range before load', 'Integrate movement into daily life', 'Measure progress by quality', 'Return to basics to move forward better'] },
  ],
  es: [
    { etape: 'Comprender', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Saber qué hacemos y por qué', description: 'Antes de moverse, comprender. ¿Qué articulación trabaja? ¿Qué músculo se activa?', points: ['Nombrar lo que se siente', 'Comprender la mecánica articular', 'Identificar las compensaciones habituales', 'Visualizar el movimiento antes de hacerlo'] },
    { etape: 'Sentir', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Desarrollar el mapa interior', description: 'Cerrar los ojos. Escuchar. ¿Dónde está la tensión?', points: ['Escanear el cuerpo sin juicio', 'Distinguir tensión útil de tensión parásita', 'Sentir las asimetrías izquierda/derecha', 'Habitar cada parte del cuerpo por turno'] },
    { etape: 'Preparar', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Activar antes de rendir', description: 'El cuerpo no pasa de 0 a 100. La preparación despierta los estabilizadores profundos.', points: ['Movilizar las articulaciones implicadas', 'Activar los músculos estabilizadores', 'Establecer el patrón respiratorio', 'Centrar la atención en la zona de trabajo'] },
    { etape: 'Ejecutar', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'El gesto correcto, no el forzado', description: 'La ejecución en el método FluidBody nunca es brusca. La calidad prima sobre la cantidad.', points: ['Mantener la conciencia durante el esfuerzo', 'Respirar — nunca bloquear el aliento', 'Trabajar en amplitud controlada', 'Sentir el músculo objetivo, no las compensaciones'] },
    { etape: 'Evolucionar', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progresar sin perderse', description: 'La evolución no es una carrera. Es una espiral ascendente.', points: ['Aumentar la amplitud antes de la carga', 'Integrar el movimiento en la vida diaria', 'Medir el progreso por la calidad', 'Volver a lo básico para avanzar mejor'] },
  ],
  it: [
    { etape: 'Capire', num: '01', color: 'rgba(0,220,170,0.9)', soustitre: 'Sapere cosa si fa e perché', description: 'Prima di muoversi, capire.', points: ['Nominare ciò che si sente', 'Capire la meccanica articolare', 'Identificare le compensazioni abituali', 'Visualizzare il movimento prima di farlo'] },
    { etape: 'Sentire', num: '02', color: 'rgba(100,190,255,0.9)', soustitre: 'Sviluppare la mappa interiore', description: 'Chiudere gli occhi. Ascoltare.', points: ['Scansionare il corpo senza giudizio', 'Distinguere tensione utile da tensione parassita', 'Sentire le asimmetrie sinistra/destra', 'Abitare ogni parte del corpo a turno'] },
    { etape: 'Preparare', num: '03', color: 'rgba(255,200,80,0.9)', soustitre: 'Attivare prima di performare', description: 'Il corpo non passa da 0 a 100.', points: ['Mobilizzare le articolazioni coinvolte', 'Attivare i muscoli stabilizzatori', 'Stabilire il pattern respiratorio', 'Centrare l\'attenzione sulla zona di lavoro'] },
    { etape: 'Eseguire', num: '04', color: 'rgba(255,145,100,0.9)', soustitre: 'Il gesto giusto, non quello forte', description: 'L\'esecuzione nel metodo FluidBody non è mai brusca.', points: ['Mantenere la consapevolezza durante lo sforzo', 'Respirare — non bloccare mai il respiro', 'Lavorare in ampiezza controllata', 'Sentire il muscolo bersaglio, non le compensazioni'] },
    { etape: 'Evolvere', num: '05', color: 'rgba(185,135,255,0.9)', soustitre: 'Progredire senza perdersi', description: 'L\'evoluzione non è una corsa.', points: ['Aumentare l\'ampiezza prima del carico', 'Integrare il movimento nella vita quotidiana', 'Misurare il progresso dalla qualità', 'Tornare alle basi per andare avanti meglio'] },
  ],
};

const SEANCES_FR = {
  p1: [['Comprendre l\'épaule', '12 min', 'Comprendre'], ['La coiffe des rotateurs', '15 min', 'Comprendre'], ['Ressentir les omoplates', '12 min', 'Ressentir'], ['Le poids du bras', '15 min', 'Ressentir'], ['Cercles de conscience', '18 min', 'Ressentir'], ['Libérer les trapèzes', '20 min', 'Préparer'], ['Mobiliser la scapula', '22 min', 'Préparer'], ['Activer le dentelé', '25 min', 'Préparer'], ['Ouverture thoracique', '28 min', 'Préparer'], ['Proprioception épaule', '30 min', 'Préparer'], ['Le geste juste', '25 min', 'Exécuter'], ['Élévation consciente', '28 min', 'Exécuter'], ['Rotation externe guidée', '30 min', 'Exécuter'], ['Tirés et poussés', '32 min', 'Exécuter'], ['Circuit épaule complète', '35 min', 'Exécuter'], ['Force & souplesse I', '35 min', 'Évoluer'], ['Épaule sous charge', '38 min', 'Évoluer'], ['Équilibre scapulaire', '40 min', 'Évoluer'], ['L\'épaule athlétique', '42 min', 'Évoluer'], ['Maîtrise totale', '45 min', 'Évoluer']],
  p2: [['Le dos expliqué', '12 min', 'Comprendre'], ['Pourquoi le dos souffre', '15 min', 'Comprendre'], ['La nuque et ses tensions', '15 min', 'Comprendre'], ['Ressentir sa colonne', '12 min', 'Ressentir'], ['Le sacrum comme base', '18 min', 'Ressentir'], ['Relâcher le psoas', '20 min', 'Préparer'], ['Décompression lombaire', '22 min', 'Préparer'], ['Mobiliser les thoraciques', '25 min', 'Préparer'], ['Cat-Cow conscient', '20 min', 'Préparer'], ['Libérer la nuque', '22 min', 'Préparer'], ['Renforcement profond I', '25 min', 'Exécuter'], ['La planche consciente', '28 min', 'Exécuter'], ['Pont fessier guidé', '28 min', 'Exécuter'], ['Rotation vertébrale', '30 min', 'Exécuter'], ['Extension du dos', '32 min', 'Exécuter'], ['Programme anti-douleur I', '30 min', 'Évoluer'], ['Programme anti-douleur II', '35 min', 'Évoluer'], ['Dos & respiration', '38 min', 'Évoluer'], ['Colonne intégrée', '40 min', 'Évoluer'], ['La colonne parfaite', '45 min', 'Évoluer']],
  p3: [['Comprendre la hanche', '12 min', 'Comprendre'], ['Le genou fragile', '15 min', 'Comprendre'], ['La cheville oubliée', '12 min', 'Comprendre'], ['Ressentir la hanche', '15 min', 'Ressentir'], ['Cartographie bas du corps', '20 min', 'Ressentir'], ['Mobilisation de hanche I', '20 min', 'Préparer'], ['Libération des fléchisseurs', '22 min', 'Préparer'], ['Mobilisation de hanche II', '25 min', 'Préparer'], ['Mobilité du genou', '20 min', 'Préparer'], ['La cheville en action', '22 min', 'Préparer'], ['Squat conscient I', '25 min', 'Exécuter'], ['Fente guidée', '28 min', 'Exécuter'], ['Pont et rotation de hanche', '28 min', 'Exécuter'], ['Station unipodale', '30 min', 'Exécuter'], ['Circuit mobilité', '32 min', 'Exécuter'], ['Mobilité & Pilates I', '30 min', 'Évoluer'], ['Profondeur de hanche', '35 min', 'Évoluer'], ['Genoux & force', '38 min', 'Évoluer'], ['La chaîne postérieure', '40 min', 'Évoluer'], ['Corps libre en bas', '45 min', 'Évoluer']],
  p4: [['La posture expliquée', '12 min', 'Comprendre'], ['Les 4 courbes naturelles', '15 min', 'Comprendre'], ['Posture & douleur', '15 min', 'Comprendre'], ['Ressentir l\'alignement', '12 min', 'Ressentir'], ['L\'axe vertical', '18 min', 'Ressentir'], ['Débloquer la cage thoracique', '20 min', 'Préparer'], ['Activer les stabilisateurs', '22 min', 'Préparer'], ['Rééquilibrer le bassin', '25 min', 'Préparer'], ['Aligner le cou', '22 min', 'Préparer'], ['Proprioception posturale', '25 min', 'Préparer'], ['Debout conscient', '25 min', 'Exécuter'], ['Marche consciente', '28 min', 'Exécuter'], ['Assis sans souffrir', '25 min', 'Exécuter'], ['Travail en miroir', '30 min', 'Exécuter'], ['Posture sous charge', '32 min', 'Exécuter'], ['Programme bureau I', '25 min', 'Évoluer'], ['Programme bureau II', '30 min', 'Évoluer'], ['Posture & respiration', '35 min', 'Évoluer'], ['Corps en équilibre', '40 min', 'Évoluer'], ['L\'alignement parfait', '45 min', 'Évoluer']],
  p5: [['Comprendre le souffle', '12 min', 'Comprendre'], ['Le diaphragme', '15 min', 'Comprendre'], ['Respiration & nerfs', '15 min', 'Comprendre'], ['Ressentir son souffle', '10 min', 'Ressentir'], ['Le souffle tridimensionnel', '15 min', 'Ressentir'], ['Cohérence cardiaque I', '12 min', 'Préparer'], ['Libérer le diaphragme', '15 min', 'Préparer'], ['Respiration latérale', '18 min', 'Préparer'], ['Respiration dorsale', '20 min', 'Préparer'], ['Plancher pelvien', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Souffle & mouvement', '25 min', 'Exécuter'], ['Cohérence cardiaque II', '20 min', 'Exécuter'], ['Souffle & gainage', '28 min', 'Exécuter'], ['Séquence souffle complet', '30 min', 'Exécuter'], ['Techniques avancées I', '25 min', 'Évoluer'], ['Souffle & performance', '30 min', 'Évoluer'], ['Respiration & émotions', '32 min', 'Évoluer'], ['Anti-stress respiratoire', '35 min', 'Évoluer'], ['Maître du souffle', '40 min', 'Évoluer']],
  p6: [['Qu\'est-ce que la proprioception', '12 min', 'Comprendre'], ['Le corps dans l\'espace', '15 min', 'Comprendre'], ['Conscience & douleur', '15 min', 'Comprendre'], ['Le scan corporel I', '12 min', 'Ressentir'], ['Sentir sans voir', '15 min', 'Ressentir'], ['Équilibre statique I', '15 min', 'Préparer'], ['Micro-mouvements', '18 min', 'Préparer'], ['Équilibre instable', '20 min', 'Préparer'], ['Le regard intérieur', '22 min', 'Préparer'], ['Mapping corporel', '25 min', 'Préparer'], ['Mouvement lent I', '20 min', 'Exécuter'], ['Coordination fine', '25 min', 'Exécuter'], ['Anticipation & réaction', '28 min', 'Exécuter'], ['Mouvement lent II', '30 min', 'Exécuter'], ['Fluidité consciente', '32 min', 'Exécuter'], ['Méditation en mouvement', '25 min', 'Évoluer'], ['Inversion consciente', '30 min', 'Évoluer'], ['Conscience des fascias', '35 min', 'Évoluer'], ['Intelligence corporelle', '38 min', 'Évoluer'], ['L\'être dans le corps', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & sa méthode', '12 min', 'Comprendre'], ['Les 6 principes du Mat', '15 min', 'Comprendre'], ['Le centre — powerhouse', '15 min', 'Comprendre'], ['Sentir le tapis sous soi', '12 min', 'Ressentir'], ['Connexion bassin-plancher', '15 min', 'Ressentir'], ['Le Hundred — initiation', '20 min', 'Préparer'], ['Roll-Up conscient', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Activation du centre', '22 min', 'Préparer'], ['La série des 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Séquence Mat niveau 1', '35 min', 'Évoluer'], ['Séquence Mat niveau 2', '38 min', 'Évoluer'], ['Teaser guidé', '40 min', 'Évoluer'], ['Mat flow complet', '42 min', 'Évoluer'], ['Maîtrise du Mat', '45 min', 'Évoluer']],

};

const SEANCES_EN = {
  p1: [['Understanding the shoulder', '12 min', 'Comprendre'], ['The rotator cuff', '15 min', 'Comprendre'], ['Feeling the shoulder blades', '12 min', 'Ressentir'], ['The weight of the arm', '15 min', 'Ressentir'], ['Awareness circles', '18 min', 'Ressentir'], ['Releasing the trapezius', '20 min', 'Préparer'], ['Mobilizing the scapula', '22 min', 'Préparer'], ['Activating the serratus', '25 min', 'Préparer'], ['Thoracic opening', '28 min', 'Préparer'], ['Shoulder proprioception', '30 min', 'Préparer'], ['The right gesture', '25 min', 'Exécuter'], ['Conscious elevation', '28 min', 'Exécuter'], ['Guided external rotation', '30 min', 'Exécuter'], ['Pulls and pushes', '32 min', 'Exécuter'], ['Full shoulder circuit', '35 min', 'Exécuter'], ['Strength & flexibility I', '35 min', 'Évoluer'], ['Loaded shoulder', '38 min', 'Évoluer'], ['Scapular balance', '40 min', 'Évoluer'], ['The athletic shoulder', '42 min', 'Évoluer'], ['Total mastery', '45 min', 'Évoluer']],
  p2: [['The back explained', '12 min', 'Comprendre'], ['Why the back hurts', '15 min', 'Comprendre'], ['The neck and its tensions', '15 min', 'Comprendre'], ['Feeling the spine', '12 min', 'Ressentir'], ['The sacrum as base', '18 min', 'Ressentir'], ['Releasing the psoas', '20 min', 'Préparer'], ['Lumbar decompression', '22 min', 'Préparer'], ['Mobilizing the thoracics', '25 min', 'Préparer'], ['Conscious Cat-Cow', '20 min', 'Préparer'], ['Releasing the neck', '22 min', 'Préparer'], ['Deep strengthening I', '25 min', 'Exécuter'], ['The conscious plank', '28 min', 'Exécuter'], ['Guided glute bridge', '28 min', 'Exécuter'], ['Vertebral rotation', '30 min', 'Exécuter'], ['Back extension', '32 min', 'Exécuter'], ['Anti-pain program I', '30 min', 'Évoluer'], ['Anti-pain program II', '35 min', 'Évoluer'], ['Back & breathing', '38 min', 'Évoluer'], ['Integrated spine', '40 min', 'Évoluer'], ['The perfect spine', '45 min', 'Évoluer']],
  p3: [['Understanding the hip', '12 min', 'Comprendre'], ['The fragile knee', '15 min', 'Comprendre'], ['The forgotten ankle', '12 min', 'Comprendre'], ['Feeling the hip', '15 min', 'Ressentir'], ['Lower body mapping', '20 min', 'Ressentir'], ['Hip mobilization I', '20 min', 'Préparer'], ['Releasing the flexors', '22 min', 'Préparer'], ['Hip mobilization II', '25 min', 'Préparer'], ['Knee mobility', '20 min', 'Préparer'], ['The ankle in action', '22 min', 'Préparer'], ['Conscious squat I', '25 min', 'Exécuter'], ['Guided lunge', '28 min', 'Exécuter'], ['Hip bridge & rotation', '28 min', 'Exécuter'], ['Single leg stance', '30 min', 'Exécuter'], ['Mobility circuit', '32 min', 'Exécuter'], ['Mobility & Pilates I', '30 min', 'Évoluer'], ['Hip depth', '35 min', 'Évoluer'], ['Knees & strength', '38 min', 'Évoluer'], ['The posterior chain', '40 min', 'Évoluer'], ['Free lower body', '45 min', 'Évoluer']],
  p4: [['Posture explained', '12 min', 'Comprendre'], ['The 4 natural curves', '15 min', 'Comprendre'], ['Posture & pain', '15 min', 'Comprendre'], ['Feeling alignment', '12 min', 'Ressentir'], ['The vertical axis', '18 min', 'Ressentir'], ['Opening the chest', '20 min', 'Préparer'], ['Activating stabilizers', '22 min', 'Préparer'], ['Rebalancing the pelvis', '25 min', 'Préparer'], ['Aligning the neck', '22 min', 'Préparer'], ['Postural proprioception', '25 min', 'Préparer'], ['Standing consciously', '25 min', 'Exécuter'], ['Conscious walking', '28 min', 'Exécuter'], ['Sitting without pain', '25 min', 'Exécuter'], ['Mirror work', '30 min', 'Exécuter'], ['Posture under load', '32 min', 'Exécuter'], ['Desk program I', '25 min', 'Évoluer'], ['Desk program II', '30 min', 'Évoluer'], ['Posture & breathing', '35 min', 'Évoluer'], ['Body in balance', '40 min', 'Évoluer'], ['Perfect alignment', '45 min', 'Évoluer']],
  p5: [['Understanding the breath', '12 min', 'Comprendre'], ['The diaphragm', '15 min', 'Comprendre'], ['Breathing & nerves', '15 min', 'Comprendre'], ['Feeling your breath', '10 min', 'Ressentir'], ['3D breathing', '15 min', 'Ressentir'], ['Cardiac coherence I', '12 min', 'Préparer'], ['Releasing the diaphragm', '15 min', 'Préparer'], ['Lateral breathing', '18 min', 'Préparer'], ['Dorsal breathing', '20 min', 'Préparer'], ['Pelvic floor', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Breath & movement', '25 min', 'Exécuter'], ['Cardiac coherence II', '20 min', 'Exécuter'], ['Breath & core', '28 min', 'Exécuter'], ['Full breath sequence', '30 min', 'Exécuter'], ['Advanced techniques I', '25 min', 'Évoluer'], ['Breath & performance', '30 min', 'Évoluer'], ['Breathing & emotions', '32 min', 'Évoluer'], ['Anti-stress breathing', '35 min', 'Évoluer'], ['Master of breath', '40 min', 'Évoluer']],
  p6: [['What is proprioception', '12 min', 'Comprendre'], ['The body in space', '15 min', 'Comprendre'], ['Awareness & pain', '15 min', 'Comprendre'], ['Body scan I', '12 min', 'Ressentir'], ['Feeling without seeing', '15 min', 'Ressentir'], ['Static balance I', '15 min', 'Préparer'], ['Micro-movements', '18 min', 'Préparer'], ['Unstable balance', '20 min', 'Préparer'], ['The inner gaze', '22 min', 'Préparer'], ['Body mapping', '25 min', 'Préparer'], ['Slow movement I', '20 min', 'Exécuter'], ['Fine coordination', '25 min', 'Exécuter'], ['Anticipation & reaction', '28 min', 'Exécuter'], ['Slow movement II', '30 min', 'Exécuter'], ['Conscious fluidity', '32 min', 'Exécuter'], ['Movement meditation', '25 min', 'Évoluer'], ['Conscious inversion', '30 min', 'Évoluer'], ['Fascia awareness', '35 min', 'Évoluer'], ['Body intelligence', '38 min', 'Évoluer'], ['Being in the body', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & his method', '12 min', 'Comprendre'], ['The 6 Mat principles', '15 min', 'Comprendre'], ['The center — powerhouse', '15 min', 'Comprendre'], ['Feeling the mat beneath you', '12 min', 'Ressentir'], ['Pelvis-floor connection', '15 min', 'Ressentir'], ['The Hundred — initiation', '20 min', 'Préparer'], ['Conscious Roll-Up', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Center activation', '22 min', 'Préparer'], ['The series of 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Mat sequence level 1', '35 min', 'Évoluer'], ['Mat sequence level 2', '38 min', 'Évoluer'], ['Guided Teaser', '40 min', 'Évoluer'], ['Full Mat flow', '42 min', 'Évoluer'], ['Mat mastery', '45 min', 'Évoluer']],

};

const SEANCES_ES = {
  p1: [['Entender el hombro', '12 min', 'Comprendre'], ['El manguito rotador', '15 min', 'Comprendre'], ['Sentir los omóplatos', '12 min', 'Ressentir'], ['El peso del brazo', '15 min', 'Ressentir'], ['Círculos de conciencia', '18 min', 'Ressentir'], ['Liberar los trapecios', '20 min', 'Préparer'], ['Movilizar la escápula', '22 min', 'Préparer'], ['Activar el serrato', '25 min', 'Préparer'], ['Apertura torácica', '28 min', 'Préparer'], ['Propiocepción hombro', '30 min', 'Préparer'], ['El gesto correcto', '25 min', 'Exécuter'], ['Elevación consciente', '28 min', 'Exécuter'], ['Rotación externa guiada', '30 min', 'Exécuter'], ['Jalones y empujes', '32 min', 'Exécuter'], ['Circuito hombro completo', '35 min', 'Exécuter'], ['Fuerza & flexibilidad I', '35 min', 'Évoluer'], ['Hombro con carga', '38 min', 'Évoluer'], ['Equilibrio escapular', '40 min', 'Évoluer'], ['El hombro atlético', '42 min', 'Évoluer'], ['Dominio total', '45 min', 'Évoluer']],
  p2: [['La espalda explicada', '12 min', 'Comprendre'], ['Por qué duele la espalda', '15 min', 'Comprendre'], ['El cuello y sus tensiones', '15 min', 'Comprendre'], ['Sentir la columna', '12 min', 'Ressentir'], ['El sacro como base', '18 min', 'Ressentir'], ['Liberar el psoas', '20 min', 'Préparer'], ['Descompresión lumbar', '22 min', 'Préparer'], ['Movilizar las torácicas', '25 min', 'Préparer'], ['Cat-Cow consciente', '20 min', 'Préparer'], ['Liberar el cuello', '22 min', 'Préparer'], ['Fortalecimiento profundo I', '25 min', 'Exécuter'], ['La plancha consciente', '28 min', 'Exécuter'], ['Puente glúteo guiado', '28 min', 'Exécuter'], ['Rotación vertebral', '30 min', 'Exécuter'], ['Extensión de espalda', '32 min', 'Exécuter'], ['Programa antidolor I', '30 min', 'Évoluer'], ['Programa antidolor II', '35 min', 'Évoluer'], ['Espalda & respiración', '38 min', 'Évoluer'], ['Columna integrada', '40 min', 'Évoluer'], ['La columna perfecta', '45 min', 'Évoluer']],
  p3: [['Entender la cadera', '12 min', 'Comprendre'], ['La rodilla frágil', '15 min', 'Comprendre'], ['El tobillo olvidado', '12 min', 'Comprendre'], ['Sentir la cadera', '15 min', 'Ressentir'], ['Cartografía parte inferior', '20 min', 'Ressentir'], ['Movilización de cadera I', '20 min', 'Préparer'], ['Liberación de flexores', '22 min', 'Préparer'], ['Movilización de cadera II', '25 min', 'Préparer'], ['Movilidad de rodilla', '20 min', 'Préparer'], ['El tobillo en acción', '22 min', 'Préparer'], ['Sentadilla consciente I', '25 min', 'Exécuter'], ['Zancada guiada', '28 min', 'Exécuter'], ['Puente y rotación cadera', '28 min', 'Exécuter'], ['Postura unipodal', '30 min', 'Exécuter'], ['Circuito movilidad', '32 min', 'Exécuter'], ['Movilidad & Pilates I', '30 min', 'Évoluer'], ['Profundidad de cadera', '35 min', 'Évoluer'], ['Rodillas & fuerza', '38 min', 'Évoluer'], ['La cadena posterior', '40 min', 'Évoluer'], ['Cuerpo libre abajo', '45 min', 'Évoluer']],
  p4: [['La postura explicada', '12 min', 'Comprendre'], ['Las 4 curvas naturales', '15 min', 'Comprendre'], ['Postura & dolor', '15 min', 'Comprendre'], ['Sentir la alineación', '12 min', 'Ressentir'], ['El eje vertical', '18 min', 'Ressentir'], ['Abrir la caja torácica', '20 min', 'Préparer'], ['Activar estabilizadores', '22 min', 'Préparer'], ['Reequilibrar la pelvis', '25 min', 'Préparer'], ['Alinear el cuello', '22 min', 'Préparer'], ['Propiocepción postural', '25 min', 'Préparer'], ['De pie consciente', '25 min', 'Exécuter'], ['Caminar consciente', '28 min', 'Exécuter'], ['Sentado sin dolor', '25 min', 'Exécuter'], ['Trabajo frente al espejo', '30 min', 'Exécuter'], ['Postura bajo carga', '32 min', 'Exécuter'], ['Programa oficina I', '25 min', 'Évoluer'], ['Programa oficina II', '30 min', 'Évoluer'], ['Postura & respiración', '35 min', 'Évoluer'], ['Cuerpo en equilibrio', '40 min', 'Évoluer'], ['Alineación perfecta', '45 min', 'Évoluer']],
  p5: [['Entender el aliento', '12 min', 'Comprendre'], ['El diafragma', '15 min', 'Comprendre'], ['Respiración & nervios', '15 min', 'Comprendre'], ['Sentir la respiración', '10 min', 'Ressentir'], ['Respiración 3D', '15 min', 'Ressentir'], ['Coherencia cardíaca I', '12 min', 'Préparer'], ['Liberar el diafragma', '15 min', 'Préparer'], ['Respiración lateral', '18 min', 'Préparer'], ['Respiración dorsal', '20 min', 'Préparer'], ['Suelo pélvico', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Aliento & movimiento', '25 min', 'Exécuter'], ['Coherencia cardíaca II', '20 min', 'Exécuter'], ['Aliento & core', '28 min', 'Exécuter'], ['Secuencia aliento completo', '30 min', 'Exécuter'], ['Técnicas avanzadas I', '25 min', 'Évoluer'], ['Aliento & rendimiento', '30 min', 'Évoluer'], ['Respiración & emociones', '32 min', 'Évoluer'], ['Respiración antiestres', '35 min', 'Évoluer'], ['Maestro del aliento', '40 min', 'Évoluer']],
  p6: [['Qué es la propiocepción', '12 min', 'Comprendre'], ['El cuerpo en el espacio', '15 min', 'Comprendre'], ['Conciencia & dolor', '15 min', 'Comprendre'], ['Scan corporal I', '12 min', 'Ressentir'], ['Sentir sin ver', '15 min', 'Ressentir'], ['Equilibrio estático I', '15 min', 'Préparer'], ['Micro-movimientos', '18 min', 'Préparer'], ['Equilibrio inestable', '20 min', 'Préparer'], ['La mirada interior', '22 min', 'Préparer'], ['Mapeo corporal', '25 min', 'Préparer'], ['Movimiento lento I', '20 min', 'Exécuter'], ['Coordinación fina', '25 min', 'Exécuter'], ['Anticipación & reacción', '28 min', 'Exécuter'], ['Movimiento lento II', '30 min', 'Exécuter'], ['Fluidez consciente', '32 min', 'Exécuter'], ['Meditación en movimiento', '25 min', 'Évoluer'], ['Inversión consciente', '30 min', 'Évoluer'], ['Conciencia de fascias', '35 min', 'Évoluer'], ['Inteligencia corporal', '38 min', 'Évoluer'], ['Ser en el cuerpo', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & su método', '12 min', 'Comprendre'], ['Los 6 principios del Mat', '15 min', 'Comprendre'], ['El centro — powerhouse', '15 min', 'Comprendre'], ['Sentir la colchoneta', '12 min', 'Ressentir'], ['Conexión pelvis-suelo', '15 min', 'Ressentir'], ['El Hundred — iniciación', '20 min', 'Préparer'], ['Roll-Up consciente', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Activación del centro', '22 min', 'Préparer'], ['La serie de los 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Secuencia Mat nivel 1', '35 min', 'Évoluer'], ['Secuencia Mat nivel 2', '38 min', 'Évoluer'], ['Teaser guiado', '40 min', 'Évoluer'], ['Flujo Mat completo', '42 min', 'Évoluer'], ['Dominio del Mat', '45 min', 'Évoluer']],

};

const SEANCES_IT = {
  p1: [['Capire la spalla', '12 min', 'Comprendre'], ['La cuffia dei rotatori', '15 min', 'Comprendre'], ['Sentire le scapole', '12 min', 'Ressentir'], ['Il peso del braccio', '15 min', 'Ressentir'], ['Cerchi di consapevolezza', '18 min', 'Ressentir'], ['Liberare i trapezi', '20 min', 'Préparer'], ['Mobilizzare la scapola', '22 min', 'Préparer'], ['Attivare il dentato', '25 min', 'Préparer'], ['Apertura toracica', '28 min', 'Préparer'], ['Propriocezione spalla', '30 min', 'Préparer'], ['Il gesto giusto', '25 min', 'Exécuter'], ['Elevazione consapevole', '28 min', 'Exécuter'], ['Rotazione esterna guidata', '30 min', 'Exécuter'], ['Tirate e spinte', '32 min', 'Exécuter'], ['Circuito spalla completo', '35 min', 'Exécuter'], ['Forza & flessibilità I', '35 min', 'Évoluer'], ['Spalla sotto carico', '38 min', 'Évoluer'], ['Equilibrio scapolare', '40 min', 'Évoluer'], ['La spalla atletica', '42 min', 'Évoluer'], ['Maestria totale', '45 min', 'Évoluer']],
  p2: [['La schiena spiegata', '12 min', 'Comprendre'], ['Perché fa male la schiena', '15 min', 'Comprendre'], ['Il collo e le sue tensioni', '15 min', 'Comprendre'], ['Sentire la colonna', '12 min', 'Ressentir'], ['Il sacro come base', '18 min', 'Ressentir'], ['Rilasciare lo psoas', '20 min', 'Préparer'], ['Decompressione lombare', '22 min', 'Préparer'], ['Mobilizzare le toraciche', '25 min', 'Préparer'], ['Cat-Cow consapevole', '20 min', 'Préparer'], ['Liberare il collo', '22 min', 'Préparer'], ['Rinforzo profondo I', '25 min', 'Exécuter'], ['Il plank consapevole', '28 min', 'Exécuter'], ['Ponte glutei guidato', '28 min', 'Exécuter'], ['Rotazione vertebrale', '30 min', 'Exécuter'], ['Estensione della schiena', '32 min', 'Exécuter'], ['Programma antidolore I', '30 min', 'Évoluer'], ['Programma antidolore II', '35 min', 'Évoluer'], ['Schiena & respirazione', '38 min', 'Évoluer'], ['Colonna integrata', '40 min', 'Évoluer'], ['La colonna perfetta', '45 min', 'Évoluer']],
  p3: [['Capire l\'anca', '12 min', 'Comprendre'], ['Il ginocchio fragile', '15 min', 'Comprendre'], ['La caviglia dimenticata', '12 min', 'Comprendre'], ['Sentire l\'anca', '15 min', 'Ressentir'], ['Mappatura parte inferiore', '20 min', 'Ressentir'], ['Mobilizzazione anca I', '20 min', 'Préparer'], ['Liberare i flessori', '22 min', 'Préparer'], ['Mobilizzazione anca II', '25 min', 'Préparer'], ['Mobilità del ginocchio', '20 min', 'Préparer'], ['La caviglia in azione', '22 min', 'Préparer'], ['Squat consapevole I', '25 min', 'Exécuter'], ['Affondo guidato', '28 min', 'Exécuter'], ['Ponte e rotazione anca', '28 min', 'Exécuter'], ['Stazione monopodica', '30 min', 'Exécuter'], ['Circuito mobilità', '32 min', 'Exécuter'], ['Mobilità & Pilates I', '30 min', 'Évoluer'], ['Profondità dell\'anca', '35 min', 'Évoluer'], ['Ginocchia & forza', '38 min', 'Évoluer'], ['La catena posteriore', '40 min', 'Évoluer'], ['Corpo libero in basso', '45 min', 'Évoluer']],
  p4: [['La postura spiegata', '12 min', 'Comprendre'], ['Le 4 curve naturali', '15 min', 'Comprendre'], ['Postura & dolore', '15 min', 'Comprendre'], ['Sentire l\'allineamento', '12 min', 'Ressentir'], ['L\'asse verticale', '18 min', 'Ressentir'], ['Aprire la gabbia toracica', '20 min', 'Préparer'], ['Attivare gli stabilizzatori', '22 min', 'Préparer'], ['Riequilibrare il bacino', '25 min', 'Préparer'], ['Allineare il collo', '22 min', 'Préparer'], ['Propriocezione posturale', '25 min', 'Préparer'], ['In piedi consapevole', '25 min', 'Exécuter'], ['Camminata consapevole', '28 min', 'Exécuter'], ['Seduti senza dolore', '25 min', 'Exécuter'], ['Lavoro allo specchio', '30 min', 'Exécuter'], ['Postura sotto carico', '32 min', 'Exécuter'], ['Programma ufficio I', '25 min', 'Évoluer'], ['Programma ufficio II', '30 min', 'Évoluer'], ['Postura & respirazione', '35 min', 'Évoluer'], ['Corpo in equilibrio', '40 min', 'Évoluer'], ['L\'allineamento perfetto', '45 min', 'Évoluer']],
  p5: [['Capire il respiro', '12 min', 'Comprendre'], ['Il diaframma', '15 min', 'Comprendre'], ['Respirazione & nervi', '15 min', 'Comprendre'], ['Sentire il proprio respiro', '10 min', 'Ressentir'], ['Respirazione 3D', '15 min', 'Ressentir'], ['Coerenza cardiaca I', '12 min', 'Préparer'], ['Liberare il diaframma', '15 min', 'Préparer'], ['Respirazione laterale', '18 min', 'Préparer'], ['Respirazione dorsale', '20 min', 'Préparer'], ['Pavimento pelvico', '22 min', 'Préparer'], ['Pilates breathing I', '20 min', 'Exécuter'], ['Respiro & movimento', '25 min', 'Exécuter'], ['Coerenza cardiaca II', '20 min', 'Exécuter'], ['Respiro & core', '28 min', 'Exécuter'], ['Sequenza respiro completo', '30 min', 'Exécuter'], ['Tecniche avanzate I', '25 min', 'Évoluer'], ['Respiro & prestazione', '30 min', 'Évoluer'], ['Respirazione & emozioni', '32 min', 'Évoluer'], ['Anti-stress respiratorio', '35 min', 'Évoluer'], ['Maestro del respiro', '40 min', 'Évoluer']],
  p6: [['Cos\'è la propriocezione', '12 min', 'Comprendre'], ['Il corpo nello spazio', '15 min', 'Comprendre'], ['Consapevolezza & dolore', '15 min', 'Comprendre'], ['Scan corporeo I', '12 min', 'Ressentir'], ['Sentire senza vedere', '15 min', 'Ressentir'], ['Equilibrio statico I', '15 min', 'Préparer'], ['Micro-movimenti', '18 min', 'Préparer'], ['Equilibrio instabile', '20 min', 'Préparer'], ['Lo sguardo interiore', '22 min', 'Préparer'], ['Mappatura corporea', '25 min', 'Préparer'], ['Movimento lento I', '20 min', 'Exécuter'], ['Coordinazione fine', '25 min', 'Exécuter'], ['Anticipazione & reazione', '28 min', 'Exécuter'], ['Movimento lento II', '30 min', 'Exécuter'], ['Fluidità consapevole', '32 min', 'Exécuter'], ['Meditazione in movimento', '25 min', 'Évoluer'], ['Inversione consapevole', '30 min', 'Évoluer'], ['Consapevolezza delle fasce', '35 min', 'Évoluer'], ['Intelligenza corporea', '38 min', 'Évoluer'], ['Essere nel corpo', '45 min', 'Évoluer']],
  p7: [['Joseph Pilates & il suo metodo', '12 min', 'Comprendre'], ['I 6 principi del Mat', '15 min', 'Comprendre'], ['Il centro — powerhouse', '15 min', 'Comprendre'], ['Sentire il tappetino', '12 min', 'Ressentir'], ['Connessione bacino-pavimento', '15 min', 'Ressentir'], ['Il Hundred — iniziazione', '20 min', 'Préparer'], ['Roll-Up consapevole', '22 min', 'Préparer'], ['Single Leg Circle', '20 min', 'Préparer'], ['Rolling Like a Ball', '18 min', 'Préparer'], ['Attivazione del centro', '22 min', 'Préparer'], ['La serie dei 5', '25 min', 'Exécuter'], ['Spine Stretch Forward', '28 min', 'Exécuter'], ['Open Leg Rocker', '30 min', 'Exécuter'], ['Swan & Child', '28 min', 'Exécuter'], ['Side Kick Series', '32 min', 'Exécuter'], ['Sequenza Mat livello 1', '35 min', 'Évoluer'], ['Sequenza Mat livello 2', '38 min', 'Évoluer'], ['Teaser guidato', '40 min', 'Évoluer'], ['Flusso Mat completo', '42 min', 'Évoluer'], ['Maestria del Mat', '45 min', 'Évoluer']],

};

function getSeances(lang) {
  if (lang === 'en') return SEANCES_EN;
  if (lang === 'es') return SEANCES_ES;
  if (lang === 'it') return SEANCES_IT;
  return SEANCES_FR;
}

const ETAPE_COLORS = {
  'Comprendre': 'rgba(0,220,170,0.9)',
  'Ressentir': 'rgba(100,190,255,0.9)',
  'Préparer': 'rgba(255,200,80,0.9)',
  'Exécuter': 'rgba(255,145,100,0.9)',
  'Évoluer': 'rgba(185,135,255,0.9)',
};

const PILIERS_DATA = [
  { key: 'p7', color: 'rgba(255,100,180,0.9)', bg: 'rgba(255,100,180,0.15)', top: 188, left: 188 },
  { key: 'p3', color: 'rgba(0,200,255,0.9)', bg: 'rgba(0,200,255,0.15)', top: 279, left: 325 },
  { key: 'p4', color: 'rgba(255,160,50,0.9)', bg: 'rgba(255,160,50,0.15)', top: 427, left: 356 },
  { key: 'p6', color: 'rgba(235,240,255,0.95)', bg: 'rgba(235,240,255,0.10)', top: 546, left: 264 },
  { key: 'p5', color: 'rgba(235,240,255,0.95)', bg: 'rgba(235,240,255,0.10)', top: 546, left: 112 },
  { key: 'p1', color: 'rgba(0,215,168,0.9)', bg: 'rgba(0,215,168,0.15)', top: 427, left: 22 },
  { key: 'p2', color: 'rgba(255,208,65,0.9)', bg: 'rgba(255,208,65,0.15)', top: 279, left: 51 },
];
// cx=220 cy=420 r=175 — p1/p4 +30px droite
// cx=220 cy=460 r=175
// cx=200 cy=540 r=175 — symétrie ✓
// cx=215 cy=403 r=188
// cx=215 cy=403 r=165
// ← cx=195 cy=403 r=150 — symétrie gauche/droite ✓
// ← cx=215 cy=403 r=175 — décalé droite

const PILIER_LABEL_IDX = { p1: 0, p2: 1, p3: 2, p4: 3, p5: 4, p6: 5, p7: 6 };
function getPiliers(lang) {
  const t = T[lang] || T['fr'];
  return PILIERS_DATA.map((p) => ({ ...p, label: t.piliers[PILIER_LABEL_IDX[p.key]] }));
}

function tentaclePath(bx, by, angle, length, t, phase, amp) {
  const N = 12;
  const cos = Math.cos(angle); const sin = Math.sin(angle);
  const px = -sin; const py = cos;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const dist = s * length;
    const wave = Math.sin(s * Math.PI * 4 - t * 2.5 + phase) * amp * Math.pow(s, 0.5);
    pts.push([bx + cos * dist + px * wave, by + sin * dist + py * wave]);
  }
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = i > 1 ? pts[i - 2] : pts[0];
    const p1 = pts[i - 1]; const p2 = pts[i];
    const p3 = i < pts.length - 1 ? pts[i + 1] : p2;
    const cp1x = p1[0] + (p2[0] - p0[0]) * 0.25; const cp1y = p1[1] + (p2[1] - p0[1]) * 0.25;
    const cp2x = p2[0] - (p3[0] - p1[0]) * 0.25; const cp2y = p2[1] - (p3[1] - p1[1]) * 0.25;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// ── TENTACULES RÉALISTES — depuis le bord de la cloche ──
const TENTS2 = [
  { sx:42,  sy:122, angle:Math.PI*0.560, len:300, phase:0.0, amp:16, color:'rgba(220,228,255,0.55)', w:0.9 },
  { sx:68,  sy:135, angle:Math.PI*0.535, len:350, phase:1.4, amp:20, color:'rgba(215,225,255,0.50)', w:0.75},
  { sx:95,  sy:143, angle:Math.PI*0.518, len:320, phase:2.7, amp:18, color:'rgba(225,232,255,0.50)', w:0.80},
  { sx:118, sy:148, angle:Math.PI*0.508, len:400, phase:0.8, amp:26, color:'rgba(218,226,255,0.42)', w:0.62},
  { sx:140, sy:151, angle:Math.PI*0.500, len:440, phase:2.1, amp:30, color:'rgba(220,228,255,0.38)', w:0.55},
  { sx:162, sy:148, angle:Math.PI*0.492, len:400, phase:1.2, amp:26, color:'rgba(218,226,255,0.42)', w:0.62},
  { sx:185, sy:143, angle:Math.PI*0.482, len:320, phase:0.4, amp:18, color:'rgba(225,232,255,0.50)', w:0.80},
  { sx:212, sy:135, angle:Math.PI*0.465, len:350, phase:3.1, amp:20, color:'rgba(215,225,255,0.50)', w:0.75},
  { sx:238, sy:122, angle:Math.PI*0.440, len:300, phase:1.9, amp:16, color:'rgba(220,228,255,0.55)', w:0.9 },
  { sx:82,  sy:140, angle:Math.PI*0.525, len:470, phase:1.0, amp:36, color:'rgba(210,220,255,0.28)', w:0.48},
  { sx:198, sy:140, angle:Math.PI*0.475, len:450, phase:2.5, amp:32, color:'rgba(210,220,255,0.28)', w:0.48},
  { sx:55,  sy:128, angle:Math.PI*0.548, len:260, phase:3.5, amp:14, color:'rgba(222,230,255,0.45)', w:0.70},
  { sx:225, sy:128, angle:Math.PI*0.452, len:260, phase:0.7, amp:14, color:'rgba(222,230,255,0.45)', w:0.70},
];

function IconEpaules({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Path d="M22 62 Q18 46 30 36 Q44 26 44 18 Q44 26 58 36 Q70 46 66 62" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/><Circle cx="44" cy="13" r="6" stroke={color} strokeWidth="2.4" fill="none"/></Svg>; }
function IconDos({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Line x1="44" y1="10" x2="44" y2="78" stroke={color} strokeWidth="2.4" strokeLinecap="round"/><Rect x="38" y="16" width="12" height="8" rx="2.5" stroke={color} strokeWidth="2.0" fill="none"/><Rect x="38" y="29" width="12" height="8" rx="2.5" stroke={color} strokeWidth="2.0" fill="none"/><Rect x="38" y="42" width="12" height="8" rx="2.5" stroke={color} strokeWidth="2.0" fill="none"/><Rect x="38" y="55" width="12" height="8" rx="2.5" stroke={color} strokeWidth="2.0" fill="none"/></Svg>; }
function IconMobilite({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Circle cx="44" cy="44" r="16" stroke={color} strokeWidth="2.4" fill="none"/><Path d="M44 28 A16 16 0 0 1 60 44" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none"/><Path d="M60 36 L60 44 L52 44" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Path d="M24 44 A20 20 0 0 0 44 64" stroke={color} strokeWidth="1.6" strokeDasharray="4 3" strokeLinecap="round" fill="none" opacity="0.6"/></Svg>; }
function IconPosture({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Circle cx="44" cy="14" r="6" stroke={color} strokeWidth="2.4" fill="none"/><Line x1="44" y1="20" x2="44" y2="54" stroke={color} strokeWidth="2.4" strokeLinecap="round"/><Path d="M28 30 L44 38 L60 30" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/><Path d="M44 54 L34 72" stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none"/><Path d="M44 54 L54 72" stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none"/><Line x1="24" y1="8" x2="24" y2="76" stroke={color} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.45"/></Svg>; }
function IconRespiration({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Path d="M8 44 Q18 22 28 44 Q38 66 44 44 Q50 22 60 44 Q70 66 80 44" stroke={color} strokeWidth="2.8" strokeLinecap="round" fill="none"/><Path d="M16 54 Q24 44 32 54 Q40 64 48 54 Q56 44 64 54 Q70 50 76 54" stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.5"/></Svg>; }
function IconConscience({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Path d="M14 44 Q28 22 44 44 Q58 66 72 44 Q58 22 44 44 Q28 66 14 44Z" stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none"/><Circle cx="44" cy="44" r="8" stroke={color} strokeWidth="2.2" fill="none"/><Circle cx="44" cy="44" r="3" fill={color}/></Svg>; }
function IconMatPilates({ color }) { return <Svg width={46} height={46} viewBox="0 0 88 88" fill="none"><Circle cx="30" cy="28" r="6" stroke={color} strokeWidth="2.4" fill="none"/><Line x1="30" y1="34" x2="30" y2="56" stroke={color} strokeWidth="2.4" strokeLinecap="round"/><Path d="M30 42 L18 36" stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none"/><Path d="M30 42 L42 36" stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none"/><Path d="M30 56 L22 70" stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none"/><Path d="M30 56 L38 70" stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none"/><Rect x="10" y="72" width="68" height="6" rx="3" stroke={color} strokeWidth="1.8" fill="none" opacity="0.6"/><Path d="M42 36 C54 26 64 20 74 18" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 3" fill="none" opacity="0.7"/><Circle cx="74" cy="18" r="3.5" fill={color} opacity="0.8"/></Svg>; }
const ICONS = { p1: IconEpaules, p2: IconDos, p3: IconMobilite, p4: IconPosture, p5: IconRespiration, p6: IconConscience, p7: IconMatPilates };

function Bulle({ delay, x, size, duration }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { setTimeout(() => { Animated.loop(Animated.timing(a, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })).start(); }, delay); }, []);
  return <Animated.View style={{ position: 'absolute', bottom: 80, left: x, width: size, height: size, borderRadius: size / 2, borderWidth: 1.2, borderColor: 'rgba(0,240,255,0.9)', backgroundColor: 'rgba(0,240,255,0.15)', opacity: a.interpolate({ inputRange: [0, 0.1, 0.88, 1], outputRange: [0, 1, 0.7, 0] }), transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -520] }) }] }} />;
}

function Rayon({ left, width, delay, duration, opacity }) {
  const a = useRef(new Animated.Value(opacity * 0.5)).current;
  useEffect(() => { setTimeout(() => { Animated.loop(Animated.sequence([Animated.timing(a, { toValue: opacity, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), Animated.timing(a, { toValue: opacity * 0.2, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true })])).start(); }, delay); }, []);
  return <Animated.View style={{ position: 'absolute', top: 0, left, width, height: '70%', backgroundColor: 'rgba(0,255,255,0.12)', opacity: a, transform: [{ skewX: '-5deg' }] }} />;
}

function Meduse() {
  const anim  = useRef(new Animated.Value(0)).current;
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    // Une seule valeur 0→1 linéaire — la courbe sinusoïdale est dans l'interpolate
    Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 8000,        // cycle complet : inspiration + expiration
        easing: Easing.linear, // PAS d'easing ici — le sin est dans l'interpolate
        useNativeDriver: true,
      })
    ).start();
    const id = setInterval(() => { tickRef.current += 0.026; setTick(tickRef.current); }, 36);
    return () => clearInterval(id);
  }, []);

  // Demi-sinusoïde 0→π : montée douce, sommet, redescente douce — 20 points
  const N = 20;
  const pts = Array.from({ length: N + 1 }, (_, i) => i / N);
  const bellScale = anim.interpolate({
    inputRange:  pts,
    outputRange: pts.map(t => 1.0 + 0.11 * Math.sin(Math.PI * t)),
  });
  const floatY = anim.interpolate({
    inputRange:  pts,
    outputRange: pts.map(t => -18 * Math.sin(Math.PI * t)),
  });

  const tentPaths = TENTS2.map(t => tentaclePath(t.sx, t.sy, t.angle, t.len, tick, t.phase, t.amp));

  return (
    <Animated.View style={{ transform: [{ translateY: floatY }], alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ scale: bellScale }] }}>
        <Svg width={260} height={460} viewBox="0 0 280 520" overflow="visible">
          {tentPaths.map((d, i) => (
            <Path key={i} d={d} stroke={TENTS2[i].color} strokeWidth={TENTS2[i].w} fill="none" strokeLinecap="round" />
          ))}
          <Defs>
            {/* Dégradé radial principal — bleu électrique vers sombre */}
            <RadialGradient id="bellGrad" cx="50%" cy="28%" rx="55%" ry="60%" fx="48%" fy="22%">
              <Stop offset="0%"   stopColor="#ffffff" stopOpacity="0.75" />
              <Stop offset="20%"  stopColor="#f8faff" stopOpacity="0.58" />
              <Stop offset="45%"  stopColor="#f0f4ff" stopOpacity="0.40" />
              <Stop offset="70%"  stopColor="#e4ecff" stopOpacity="0.22" />
              <Stop offset="88%"  stopColor="#d8e4ff" stopOpacity="0.10" />
              <Stop offset="100%" stopColor="#c8d8f8" stopOpacity="0.04" />
            </RadialGradient>
            {/* Surbrillance — éclat nacré */}
            <RadialGradient id="topGlow" cx="40%" cy="20%" rx="42%" ry="35%">
              <Stop offset="0%"   stopColor="#ffffff" stopOpacity="0.45" />
              <Stop offset="50%"  stopColor="#f8f8ff" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.00" />
            </RadialGradient>
          </Defs>

          {/* ── HALO EXTÉRIEUR — lueur bioluminescente diffuse ── */}
          <Path
            d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
            fill="none"
            stroke="rgba(220,230,255,0.15)"
            strokeWidth="18"
          />
          <Path
            d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
            fill="none"
            stroke="rgba(230,235,255,0.20)"
            strokeWidth="10"
          />
          <Path
            d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
            fill="none"
            stroke="rgba(240,242,255,0.30)"
            strokeWidth="5"
          />
          {/* ── CONTOUR LUMINEUX NET — le bord électrique ── */}
          <Path
            d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
            fill="none"
            stroke="rgba(255,255,255,0.90)"
            strokeWidth="1.5"
          />
          {/* ── REFLET BRILLANT — arc supérieur ── */}
          <Path
            d="M 55 62 C 75 28 115 10 160 14 C 190 17 215 32 232 55"
            fill="none"
            stroke="rgba(255,255,255,0.70)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <Path
            d="M 62 58 C 82 26 118 9 158 13"
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* ── BASE BLANCHE SOLIDE — évite que le fond bleu transperce ── */}
          <Path
            d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
            fill="rgba(240,245,255,0.28)"
          />
          {/* Cloche — dégradé nacré par-dessus */}
          <Path
            d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
            fill="url(#bellGrad)"
          />
          {/* Surbrillance naturelle */}
          <Path
            d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
            fill="url(#topGlow)"
          />
          {/* Bord sombre supprimé — méduse plus lumineuse */}
          {/* ── CONTOUR INTÉRIEUR — ligne lumineuse après le fill ── */}
          <Path
            d="M 32 118 C 20 65 55 12 140 8 C 226 12 260 65 248 118 C 238 140 210 152 186 148 C 170 155 155 157 140 157 C 125 157 110 155 94 148 C 70 152 42 140 32 118 Z"
            fill="none"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="1.2"
          />
          <Path d="M 140 105 Q 108 88 78  98"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 115 78 100 52"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 132 68 130 38"  stroke="rgba(205,218,255,0.22)" strokeWidth="1.2" fill="none"/>
          <Path d="M 140 105 Q 140 66 140 36"  stroke="rgba(210,220,255,0.26)" strokeWidth="1.4" fill="none"/>
          <Path d="M 140 105 Q 148 68 150 38"  stroke="rgba(205,218,255,0.22)" strokeWidth="1.2" fill="none"/>
          <Path d="M 140 105 Q 165 78 180 52"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 172 88 202 98"  stroke="rgba(200,215,255,0.25)" strokeWidth="1.3" fill="none"/>
          <Path d="M 140 105 Q 95  95  68 108"  stroke="rgba(200,212,255,0.20)" strokeWidth="1.1" fill="none"/>
          <Path d="M 140 105 Q 185 95 212 108"  stroke="rgba(200,212,255,0.20)" strokeWidth="1.1" fill="none"/>
          <Path d="M 46 122 Q 62 136 80 132 Q 96 142 112 138 Q 126 144 140 144 Q 154 144 168 138 Q 184 142 200 132 Q 218 136 234 122" stroke="rgba(220,228,255,0.50)" strokeWidth="1.8" fill="none" />
          <Path d="M 58 126 Q 68 134 78 130 Q 88 138 100 134 Q 112 142 124 138 Q 132 144 140 143 Q 148 144 156 138 Q 168 142 180 134 Q 192 138 202 130 Q 212 134 222 126" stroke="rgba(228,235,255,0.35)" strokeWidth="1.2" fill="none" />
          <Path d="M 140 148 C 134 160 126 172 122 186 C 118 198 124 208 130 218 C 124 228 118 240 122 254 C 118 264 112 274 115 288" stroke="rgba(200,210,255,0.65)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          <Path d="M 140 148 C 146 160 154 172 158 186 C 162 198 156 208 150 218 C 156 228 162 240 158 254 C 162 264 168 274 165 288" stroke="rgba(200,210,255,0.65)" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          <Path d="M 140 148 C 140 164 138 178 136 192 C 134 204 138 215 140 225 C 142 215 146 204 144 192 C 142 178 140 164 140 148" stroke="rgba(210,218,255,0.58)" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
          <Path d="M 126 178 C 118 182 112 190 110 200" stroke="rgba(215,222,255,0.52)" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          <Path d="M 124 192 C 114 196 108 206 106 218" stroke="rgba(215,222,255,0.48)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <Path d="M 122 210 C 112 215 106 226 108 238" stroke="rgba(218,224,255,0.42)" strokeWidth="1.0" fill="none" strokeLinecap="round"/>
          <Path d="M 154 178 C 162 182 168 190 170 200" stroke="rgba(215,222,255,0.52)" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          <Path d="M 156 192 C 166 196 172 206 174 218" stroke="rgba(215,222,255,0.48)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          <Path d="M 158 210 C 168 215 174 226 172 238" stroke="rgba(218,224,255,0.42)" strokeWidth="1.0" fill="none" strokeLinecap="round"/>
          <Path d="M 110 200 C 104 205 100 214 102 224" stroke="rgba(220,226,255,0.35)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
          <Path d="M 170 200 C 176 205 180 214 178 224" stroke="rgba(220,226,255,0.35)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
          <Path d="M 136 218 C 130 224 126 234 128 244" stroke="rgba(220,226,255,0.32)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
          <Path d="M 144 218 C 150 224 154 234 152 244" stroke="rgba(220,226,255,0.32)" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
          <Circle cx="96"  cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
          <Circle cx="184" cy="60" r="2.2" fill="rgba(200,235,255,0.72)" />
          <Circle cx="68"  cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
          <Circle cx="212" cy="95" r="1.8" fill="rgba(180,225,255,0.60)" />
          <Circle cx="140" cy="28" r="2.8" fill="rgba(240,250,255,0.95)" />
          <Circle cx="120" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
          <Circle cx="160" cy="22" r="1.5" fill="rgba(220,242,255,0.70)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}


const BULLES = [
  { x: 337, size: 2, delay: 409,   duration: 11506 },
  { x: 135, size: 3, delay: 2286,  duration: 8679  },
  { x: 356, size: 5, delay: 1424,  duration: 13912 },
  { x: 26,  size: 2, delay: 1535,  duration: 10582 },
  { x: 129, size: 5, delay: 9863,  duration: 7434  },
  { x: 297, size: 3, delay: 11731, duration: 15928 },
  { x: 224, size: 3, delay: 7359,  duration: 11557 },
  { x: 13,  size: 3, delay: 11438, duration: 13924 },
  { x: 184, size: 3, delay: 2547,  duration: 10527 },
  { x: 182, size: 2, delay: 1519,  duration: 13224 },
  { x: 59,  size: 4, delay: 5635,  duration: 11333 },
  { x: 32,  size: 5, delay: 8785,  duration: 9045  },
  { x: 203, size: 2, delay: 9044,  duration: 11803 },
  { x: 331, size: 6, delay: 5925,  duration: 10150 },
  { x: 370, size: 2, delay: 750,   duration: 10733 },
  { x: 158, size: 2, delay: 3814,  duration: 8654  },
  { x: 204, size: 3, delay: 7428,  duration: 12977 },
  { x: 93,  size: 4, delay: 5820,  duration: 10432 },
  { x: 353, size: 3, delay: 11498, duration: 8169  },
  { x: 321, size: 7, delay: 2803,  duration: 15751 },
  { x: 135, size: 3, delay: 7573,  duration: 13216 },
  { x: 148, size: 7, delay: 11274, duration: 10598 },
  { x: 360, size: 4, delay: 916,   duration: 10752 },
  { x: 26,  size: 4, delay: 6572,  duration: 11386 },
  { x: 43,  size: 3, delay: 9292,  duration: 12155 },
  { x: 118, size: 7, delay: 8179,  duration: 13482 },
  { x: 339, size: 5, delay: 2340,  duration: 11339 },
  { x: 81,  size: 3, delay: 9197,  duration: 15830 },
  { x: 144, size: 6, delay: 7019,  duration: 13543 },
  { x: 195, size: 3, delay: 2266,  duration: 15348 },
  { x: 262, size: 2, delay: 771,   duration: 8796  },
  { x: 88,  size: 7, delay: 2621,  duration: 13916 },
  { x: 315, size: 2, delay: 6304,  duration: 13252 },
  { x: 315, size: 5, delay: 8669,  duration: 11119 },
  { x: 293, size: 2, delay: 11145, duration: 8876  },
  { x: 359, size: 5, delay: 4371,  duration: 12573 },
  { x: 67,  size: 3, delay: 7123,  duration: 9591  },
  { x: 242, size: 2, delay: 11830, duration: 11315 },
  { x: 266, size: 3, delay: 8317,  duration: 8743  },
  { x: 330, size: 3, delay: 10468, duration: 15317 },
  { x: 321, size: 3, delay: 2504,  duration: 13126 },
  { x: 92,  size: 5, delay: 8689,  duration: 7009  },
  { x: 316, size: 4, delay: 8005,  duration: 7319  },
  { x: 67,  size: 4, delay: 5038,  duration: 10923 },
  { x: 39,  size: 3, delay: 9295,  duration: 8290  },
  { x: 53,  size: 5, delay: 1133,  duration: 15727 },
  { x: 74,  size: 3, delay: 10809, duration: 14787 },
  { x: 291, size: 3, delay: 4342,  duration: 15645 },
  { x: 320, size: 4, delay: 3470,  duration: 15835 },
  { x: 363, size: 3, delay: 11680, duration: 12107 },
  { x: 214, size: 7, delay: 10647, duration: 13118 },
  { x: 234, size: 5, delay: 7397,  duration: 8982  },
  { x: 136, size: 3, delay: 1049,  duration: 12539 },
  { x: 20,  size: 6, delay: 9075,  duration: 10770 },
  { x: 311, size: 3, delay: 117,   duration: 8163  },
  { x: 372, size: 7, delay: 964,   duration: 10750 },
  { x: 44,  size: 2, delay: 5413,  duration: 8160  },
  { x: 273, size: 3, delay: 4562,  duration: 14953 },
  { x: 119, size: 5, delay: 2167,  duration: 14744 },
  { x: 134, size: 5, delay: 6669,  duration: 10119 },
];

// ══════════════════════════════════
// VIDEO PLAYER
// ══════════════════════════════════
function VideoPlayer({ seance, pilier, onClose, onComplete, lang }) {
  const tr = T[lang] || T['fr'];
  const videoRef = useRef(null);
  const [status, setStatus] = useState({});
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef(null);
  const [dims, setDims] = useState(Dimensions.get('window'));
  const [titre, duree, etape] = seance;
  useEffect(() => {
    ScreenOrientation.unlockAsync();
    const sub = Dimensions.addEventListener('change', ({ window }) => setDims(window));
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      sub?.remove();
    };
  }, []);
  function togglePlay() { if (status.isPlaying) { videoRef.current?.pauseAsync(); } else { videoRef.current?.playAsync(); } showControlsTemp(); }
  function showControlsTemp() { setShowControls(true); if (controlsTimer.current) clearTimeout(controlsTimer.current); controlsTimer.current = setTimeout(() => setShowControls(false), 3000); }
  function formatTime(ms) { if (!ms) return '0:00'; const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
  const progress = status.durationMillis ? status.positionMillis / status.durationMillis : 0;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: '#000', width: dims.width, height: dims.height }}>
      <TouchableOpacity activeOpacity={1} onPress={showControlsTemp} style={{ flex: 1, backgroundColor: '#000' }}>
        <Video ref={videoRef} source={{ uri: VIDEO_DEMO }} style={{ position: 'absolute', top: 0, left: 0, width: dims.width, height: dims.height }} resizeMode={ResizeMode.CONTAIN} shouldPlay onPlaybackStatusUpdate={s => setStatus(s)} />
      </TouchableOpacity>
      {showControls && (
        <View style={{ position: 'absolute', top: 0, left: 0, width: dims.width, height: dims.height, justifyContent: 'space-between' }}>
          <LinearGradient colors={['rgba(0,0,0,0.85)', 'transparent']} style={{ paddingTop: 28, paddingHorizontal: 24, paddingBottom: 30 }}>
            <TouchableOpacity onPress={onClose} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.retour_video}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '200', color: 'rgba(255,255,255,0.95)' }}>{titre}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 0.5, borderColor: ETAPE_COLORS[etape] }}>
                <Text style={{ fontSize: 10, color: ETAPE_COLORS[etape] }}>{tr.etapes[etape] || etape}</Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 0.5, borderColor: pilier.color }}>
                <Text style={{ fontSize: 10, color: pilier.color }}>{pilier.label} · {duree}</Text>
              </View>
            </View>
          </LinearGradient>
          <TouchableOpacity onPress={togglePlay} style={{ alignSelf: 'center' }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 26, color: 'white' }}>{status.isPlaying ? '⏸' : '▶'}</Text>
            </View>
          </TouchableOpacity>
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={{ paddingBottom: 28, paddingHorizontal: 24, paddingTop: 30 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{formatTime(status.positionMillis)}</Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{formatTime(status.durationMillis)}</Text>
            </View>
            <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginBottom: 18, overflow: 'hidden' }}>
              <View style={{ height: 5, width: `${progress * 100}%`, backgroundColor: pilier.color, borderRadius: 3 }} />
            </View>
            <TouchableOpacity onPress={onComplete} style={{ height: 50, borderRadius: 25, backgroundColor: 'rgba(0,215,168,0.25)', borderWidth: 1.5, borderColor: 'rgba(0,215,168,0.8)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: 'rgba(0,240,190,0.95)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.seance_done}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

// ══════════════════════════════════
// PILIER PANEL — simplifié, toutes les séances visibles
// ══════════════════════════════════
function PilierPanel({ pilier, done, onToggle, onClose, lang, isRecommended }) {
  const tr = T[lang] || T['fr'];
  const seances = getSeances(lang)[pilier.key] || [];
  const doneCount = done.filter(Boolean).length;
  const [activeVideo, setActiveVideo] = useState(null);

  if (activeVideo !== null) {
    return <VideoPlayer seance={seances[activeVideo]} pilier={pilier} lang={lang} onClose={() => setActiveVideo(null)} onComplete={() => { onToggle(activeVideo); setActiveVideo(null); }} />;
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.18} />
      <Rayon left={280} width={40} delay={4000} duration={8000} opacity={0.12} />
      {BULLES.map((b, i) => <Bulle key={i} {...b} />)}
      <View style={{ paddingTop: 60, paddingHorizontal: 22, paddingBottom: 16 }}>
        <TouchableOpacity onPress={onClose} style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 10, color: 'rgba(0,205,248,0.44)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.retour}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 34, fontWeight: '200', color: 'rgba(195,242,255,0.94)' }}>{pilier.label}</Text>
          {isRecommended && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(0,215,255,0.2)', borderWidth: 1, borderColor: 'rgba(0,215,255,0.7)' }}>
              <Text style={{ fontSize: 9, color: 'rgba(0,220,255,0.9)', letterSpacing: 1 }}>★ {tr.recommande_pour_toi}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 10, color: pilier.color, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.seances_done(doneCount)}</Text>
        <View style={{ height: 3, backgroundColor: 'rgba(0,200,240,0.1)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
          <View style={{ height: 3, width: `${(doneCount / 20) * 100}%`, backgroundColor: pilier.color, borderRadius: 2 }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }}>
          {Object.keys(ETAPE_COLORS).map(e => (
            <View key={e} style={{ marginRight: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, borderWidth: 0.5, borderColor: 'rgba(0,200,240,0.2)', backgroundColor: 'rgba(0,18,32,0.6)' }}>
              <Text style={{ fontSize: 9, color: ETAPE_COLORS[e], letterSpacing: 1, textTransform: 'uppercase' }}>{tr.etapes[e] || e}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        {seances.map(([titre, duree, etape], i) => {
          const isDone = done[i];
          return (
            <TouchableOpacity key={i} onPress={() => setActiveVideo(i)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDone ? 'rgba(0,30,22,0.7)' : 'rgba(0,18,32,0.7)', borderWidth: 0.5, borderColor: isDone ? 'rgba(0,220,150,0.35)' : 'rgba(0,195,240,0.12)', borderRadius: 18, marginBottom: 10, padding: 14 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDone ? 'rgba(0,200,130,0.2)' : 'rgba(0,180,235,0.1)', borderWidth: 1, borderColor: isDone ? 'rgba(0,220,150,0.5)' : 'rgba(0,195,240,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 12, color: isDone ? 'rgba(0,230,160,0.9)' : 'rgba(0,210,250,0.7)' }}>{isDone ? '✓' : '▶'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '300', color: isDone ? 'rgba(0,220,150,0.8)' : 'rgba(195,240,255,0.9)', marginBottom: 4 }}>{titre}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontSize: 9, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,195,240,0.1)', color: ETAPE_COLORS[etape], borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.2)', letterSpacing: 0.5 }}>{tr.etapes[etape] || etape}</Text>
                  <Text style={{ fontSize: 9, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,195,240,0.1)', color: 'rgba(0,212,248,0.75)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.2)' }}>{duree}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, color: 'rgba(0,195,240,0.3)', fontWeight: '300' }}>{String(i + 1).padStart(2, '0')}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════
// ORBE — avec badge recommandé
// ══════════════════════════════════
function Orbe({ pilier, onPress, recommended, lang }) {
  const tr = T[lang] || T['fr'];
  const pulse = useRef(new Animated.Value(1)).current;
  const IconComp = ICONS[pilier.key];
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: recommended ? 1.18 : 1.1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1.0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, [recommended]);
  const pos = {};
  if (pilier.left !== undefined) pos.left = pilier.left;
  if (pilier.right !== undefined) pos.right = pilier.right;
  return (
    <TouchableOpacity onPress={() => onPress(pilier)} style={{ position: 'absolute', top: pilier.top, ...pos, alignItems: 'center', zIndex: 20, width: 96, marginLeft: -16 }}>
      <Animated.View style={{
        transform: [{ scale: pulse }],
        width: 74, height: 74, borderRadius: 37,
        backgroundColor: pilier.bg,
        borderWidth: recommended ? 2.5 : 2,
        borderColor: pilier.color,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: pilier.color,
        shadowOpacity: recommended ? 0.95 : 0.65,
        shadowRadius: recommended ? 16 : 10,
        elevation: recommended ? 12 : 6,
      }}>
        <IconComp color={pilier.color} />
        {/* Badge étoile recommandé */}
        {recommended && (
          <View style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(0,215,255,0.95)', borderWidth: 1, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 9, color: '#000', fontWeight: '700' }}>★</Text>
          </View>
        )}
      </Animated.View>
      <Text style={{ fontSize: 11, fontWeight: '500', letterSpacing: 0.8, color: pilier.color, marginTop: 6, textTransform: 'uppercase', textAlign: 'center', width: 90 }}>{pilier.label}</Text>
      {recommended && (
        <Text style={{ fontSize: 8, color: 'rgba(0,215,255,0.8)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{tr.recommande_pour_toi}</Text>
      )}
    </TouchableOpacity>
  );
}

// ══════════════════════════════════
// MON CORPS
// ══════════════════════════════════
function MonCorps({ prenom, done, toggleDone, lang, tensionIdxs }) {
  const tr = T[lang] || T['fr'];
  const [openPilier, setOpenPilier] = useState(null);
  const totalDone = Object.values(done).flat().filter(Boolean).length;
  const piliers = getPiliers(lang);

  // Piliers recommandés en fonction des tensions choisies à l'onboarding
  const recommendedPiliers = tensionIdxs.map(i => ZONE_TO_PILIER[i]);

  // Si aucune tension sélectionnée → on recommande p1 (épaules) par défaut
  const effectiveRecommended = recommendedPiliers.length > 0 ? recommendedPiliers : [];

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.18} />
      <Rayon left={140} width={55} delay={2000} duration={11000} opacity={0.15} />
      <Rayon left={280} width={40} delay={4000} duration={8000} opacity={0.12} />
      {BULLES.map((b, i) => <Bulle key={i} {...b} />)}
      <Text style={styles.logoTitle}>FluidBody</Text>
      <View style={{ position: 'absolute', top: 108, flexDirection: 'row', alignItems: 'center', zIndex: 10 }}><Text style={{ fontSize: 30 }}>🪼</Text><Text style={{ fontSize: 13, color: 'rgba(0,210,250,0.85)', letterSpacing: 3, textTransform: 'uppercase', marginLeft: 6 }}>{tr.logoSub.replace('🪼  ','')}</Text></View>
      {prenom ? <Text style={{ position: 'absolute', top: 138, fontSize: 13, color: 'rgba(0,210,250,0.5)', letterSpacing: 2 }}>{tr.bonjour(prenom)}</Text> : null}
      {piliers.map(p => (
        <Orbe
          key={p.key}
          pilier={p}
          onPress={setOpenPilier}
          recommended={effectiveRecommended.includes(p.key)}
          lang={lang}
        />
      ))}
      <View style={{ marginTop: 200 }}><Meduse /></View>
      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.mval}>{totalDone}</Text><Text style={styles.mlbl}>{tr.m_seances}</Text></View>
        <View style={styles.metric}><Text style={styles.mval}>3🔥</Text><Text style={styles.mlbl}>{tr.m_streak}</Text></View>
        <View style={styles.metric}><Text style={styles.mval}>{Math.round(totalDone / 140 * 100)}%</Text><Text style={styles.mlbl}>{tr.m_progress}</Text></View>
      </View>
      {openPilier && (
        <PilierPanel
          pilier={openPilier}
          done={done[openPilier.key]}
          onToggle={(idx) => toggleDone(openPilier.key, idx)}
          onClose={() => setOpenPilier(null)}
          lang={lang}
          isRecommended={effectiveRecommended.includes(openPilier.key)}
        />
      )}
    </View>
  );
}

// ══════════════════════════════════
// SABRINA — freemium (3 msg/jour gratuits)
// ══════════════════════════════════
const FREE_LIMIT = 3;
const STORAGE_KEY_COUNT = 'sabrina_msg_count';
const STORAGE_KEY_DATE  = 'sabrina_msg_date';
const STORAGE_KEY_PREMIUM = 'sabrina_premium';

function PaywallModal({ visible, onClose, onUnlock, onRestore, lang }) {
  const tr = T[lang] || T['fr'];
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  useEffect(() => {
    if (visible) Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
    else scaleAnim.setValue(0.92);
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,5,15,0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '100%', backgroundColor: 'rgba(0,12,28,0.98)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(0,215,255,0.25)', overflow: 'hidden' }}>
          <LinearGradient colors={['rgba(0,60,100,0.6)', 'rgba(0,12,28,0)']} style={{ padding: 32, alignItems: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,180,235,0.15)', borderWidth: 2, borderColor: 'rgba(0,220,255,0.5)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 32 }}>🪼</Text>
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,200,50,0.15)', borderWidth: 1, borderColor: 'rgba(255,200,50,0.5)', marginBottom: 14 }}>
              <Text style={{ fontSize: 10, color: 'rgba(255,210,60,0.9)', letterSpacing: 2, fontWeight: '600' }}>{tr.premium_badge}</Text>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '300', color: 'rgba(215,248,255,0.95)', textAlign: 'center', marginBottom: 10, letterSpacing: 0.5 }}>{tr.free_limit_title}</Text>
            <Text style={{ fontSize: 14, fontWeight: '200', color: 'rgba(155,215,240,0.6)', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>{tr.free_limit_sub}</Text>
            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity onPress={onUnlock} style={{ height: 56, borderRadius: 28, backgroundColor: 'rgba(0,180,235,0.3)', borderWidth: 1.5, borderColor: 'rgba(0,235,255,0.8)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: 'rgba(230,250,255,1)', letterSpacing: 1 }}>{tr.free_limit_cta}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: 'rgba(0,195,240,0.35)', textAlign: 'center' }}>{tr.free_limit_price}</Text>
              <TouchableOpacity onPress={onRestore} style={{ height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, color: 'rgba(0,195,240,0.5)', letterSpacing: 1 }}>{tr.free_limit_restore}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, color: 'rgba(0,180,220,0.4)', letterSpacing: 1 }}>{tr.free_limit_later}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SabrinaScreen({ prenom, lang }) {
  const tr = T[lang] || T['fr'];
  const [messages, setMessages] = useState([{ role: 'assistant', content: tr.sabrina_hello(prenom) }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgCount, setMsgCount] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    async function loadState() {
      try {
        const premium = await AsyncStorage.getItem(STORAGE_KEY_PREMIUM);
        if (premium === 'true') { setIsPremium(true); return; }
        const today = new Date().toDateString();
        const savedDate = await AsyncStorage.getItem(STORAGE_KEY_DATE);
        if (savedDate === today) {
          const count = parseInt(await AsyncStorage.getItem(STORAGE_KEY_COUNT) || '0');
          setMsgCount(count);
        } else {
          await AsyncStorage.setItem(STORAGE_KEY_DATE, today);
          await AsyncStorage.setItem(STORAGE_KEY_COUNT, '0');
          setMsgCount(0);
        }
      } catch (e) {}
    }
    loadState();
  }, []);

  const messagesLeft = Math.max(0, FREE_LIMIT - msgCount);
  const canSend = isPremium || msgCount < FREE_LIMIT;

  async function handleUnlock() {
    try { await AsyncStorage.setItem(STORAGE_KEY_PREMIUM, 'true'); } catch (e) {}
    setIsPremium(true);
    setShowPaywall(false);
  }

  async function handleRestore() {
    try {
      const premium = await AsyncStorage.getItem(STORAGE_KEY_PREMIUM);
      if (premium === 'true') {
        setIsPremium(true);
        setShowPaywall(false);
      }
    } catch (e) {}
  }

  async function sendMessage(text) {
    const msg = text || input.trim();
    if (!msg) return;
    if (!canSend) { setShowPaywall(true); return; }
    setInput('');
    const newMessages = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    // Incrémente le compteur
    if (!isPremium) {
      const newCount = msgCount + 1;
      setMsgCount(newCount);
      try {
        await AsyncStorage.setItem(STORAGE_KEY_COUNT, String(newCount));
      } catch (e) {}
    }
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system: tr.sabrina_system, messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.content?.[0]?.text || '🪼' }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '🪼' }]);
    }
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }


  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.18} />
      <View style={{ paddingTop: 58, paddingHorizontal: 22, paddingBottom: 12, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,210,255,0.1)' }}>
        <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,180,235,0.15)', borderWidth: 1.5, borderColor: 'rgba(0,220,255,0.4)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 26 }}>🪼</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '200', color: 'rgba(215,248,255,0.95)', letterSpacing: 3 }}>Sabrina</Text>
        {isPremium
          ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 9, color: 'rgba(255,210,60,0.8)', letterSpacing: 2 }}>{tr.premium_active}</Text>
            </View>
          : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={{ fontSize: 9, color: 'rgba(0,210,250,0.42)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.sabrina_sub}</Text>
              {messagesLeft > 0 && (
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,180,235,0.15)', borderWidth: 0.5, borderColor: 'rgba(0,210,255,0.3)' }}>
                  <Text style={{ fontSize: 9, color: 'rgba(0,215,255,0.7)' }}>{tr.free_messages_left(messagesLeft)}</Text>
                </View>
              )}
            </View>
        }
      </View>
      <ScrollView ref={scrollRef} style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16 }}>
        {messages.map((m, i) => (
          <View key={i} style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <View style={{ maxWidth: '85%', backgroundColor: m.role === 'user' ? 'rgba(0,180,235,0.18)' : 'rgba(0,30,55,0.85)', borderWidth: 0.5, borderColor: m.role === 'user' ? 'rgba(0,210,255,0.35)' : 'rgba(0,195,240,0.18)', borderRadius: 18, borderBottomRightRadius: m.role === 'user' ? 4 : 18, borderBottomLeftRadius: m.role === 'assistant' ? 4 : 18, padding: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: '200', color: 'rgba(215,248,255,0.92)', lineHeight: 24 }}>{m.content}</Text>
              {m.role === 'assistant' && <Text style={{ fontSize: 9, color: 'rgba(0,210,250,0.35)', marginTop: 6, letterSpacing: 1 }}>{tr.sabrina_label}</Text>}
            </View>
          </View>
        ))}
        {loading && <View style={{ alignItems: 'flex-start', marginBottom: 12 }}><View style={{ backgroundColor: 'rgba(0,30,55,0.85)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.18)', borderRadius: 18, borderBottomLeftRadius: 4, padding: 14 }}><Text style={{ fontSize: 14, color: 'rgba(0,210,250,0.55)', fontWeight: '200' }}>{tr.sabrina_thinking}</Text></View></View>}
        {!isPremium && messagesLeft === 0 && (
          <TouchableOpacity onPress={() => setShowPaywall(true)} style={{ margin: 8, padding: 18, borderRadius: 20, backgroundColor: 'rgba(0,18,38,0.9)', borderWidth: 1, borderColor: 'rgba(0,215,255,0.3)', alignItems: 'center' }}>
            <Text style={{ fontSize: 22, marginBottom: 8 }}>🪼</Text>
            <Text style={{ fontSize: 15, fontWeight: '300', color: 'rgba(215,248,255,0.9)', textAlign: 'center', marginBottom: 4 }}>{tr.free_limit_title}</Text>
            <Text style={{ fontSize: 12, color: 'rgba(0,215,255,0.6)', textAlign: 'center' }}>{tr.free_limit_cta} →</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
      {canSend && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, paddingVertical: 10, maxHeight: 52 }}>
          {tr.sabrina_suggestions.map((s, i) => (
            <TouchableOpacity key={i} onPress={() => sendMessage(s)} style={{ marginRight: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(0,30,55,0.8)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.2)' }}>
              <Text style={{ fontSize: 11, color: 'rgba(0,210,250,0.7)' }}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 30, paddingTop: 8, gap: 10 }}>
          <TouchableOpacity onPress={() => !canSend && setShowPaywall(true)} style={{ flex: 1 }} activeOpacity={canSend ? 1 : 0.7}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={canSend ? tr.sabrina_placeholder : tr.free_limit_cta}
              placeholderTextColor={canSend ? 'rgba(0,180,220,0.3)' : 'rgba(0,180,220,0.5)'}
              style={{ height: 50, backgroundColor: 'rgba(0,18,38,0.8)', borderWidth: 0.5, borderColor: canSend ? 'rgba(0,195,240,0.25)' : 'rgba(0,215,255,0.35)', borderRadius: 25, color: 'rgba(215,248,255,0.9)', fontSize: 14, fontWeight: '200', paddingHorizontal: 18 }}
              editable={canSend}
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => canSend ? sendMessage() : setShowPaywall(true)} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: canSend ? 'rgba(0,180,235,0.25)' : 'rgba(255,200,50,0.2)', borderWidth: 1, borderColor: canSend ? 'rgba(0,220,255,0.5)' : 'rgba(255,200,50,0.5)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, color: canSend ? 'rgba(0,220,255,0.9)' : 'rgba(255,210,60,0.8)' }}>{canSend ? '↑' : '🔒'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} onUnlock={handleUnlock} onRestore={handleRestore} lang={lang} />
    </View>
  );
}

// ══════════════════════════════════
// ARTICLE DETAIL
// ══════════════════════════════════
function ArticleDetail({ article, onClose, lang }) {
  const tr = T[lang] || T['fr'];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.15} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingTop: 58, paddingHorizontal: 22 }}>
          <TouchableOpacity onPress={onClose} style={{ marginBottom: 20 }}><Text style={{ fontSize: 10, color: 'rgba(0,205,248,0.44)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.retour_biblio}</Text></TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,18,32,0.7)', borderWidth: 0.5, borderColor: article.color }}>
              <Text style={{ fontSize: 9, color: article.color, letterSpacing: 1 }}>{article.duree}{tr.lire}</Text>
            </View>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '200', color: 'rgba(215,248,255,0.95)', lineHeight: 36, marginBottom: 20 }}>{article.titre}</Text>
          <Text style={{ fontSize: 17, fontWeight: '300', color: article.color, lineHeight: 28, marginBottom: 24, fontStyle: 'italic' }}>{article.intro}</Text>
          <Text style={{ fontSize: 15, fontWeight: '200', color: 'rgba(195,235,255,0.82)', lineHeight: 26, marginBottom: 32 }}>{article.corps}</Text>
          <View style={{ borderLeftWidth: 2, borderLeftColor: article.color, paddingLeft: 16, marginBottom: 32 }}>
            <Text style={{ fontSize: 16, fontWeight: '200', color: 'rgba(215,248,255,0.9)', lineHeight: 26, fontStyle: 'italic' }}>{article.citation}</Text>
            <Text style={{ fontSize: 10, color: 'rgba(0,210,250,0.4)', marginTop: 8, letterSpacing: 1, textTransform: 'uppercase' }}>— Sabrina · FluidBody</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════
// FICHE DETAIL
// ══════════════════════════════════
function FicheDetail({ fiche, onClose, lang }) {
  const tr = T[lang] || T['fr'];
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.15} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ paddingTop: 58, paddingHorizontal: 22 }}>
          <TouchableOpacity onPress={onClose} style={{ marginBottom: 20 }}><Text style={{ fontSize: 10, color: 'rgba(0,205,248,0.44)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.retour_biblio}</Text></TouchableOpacity>
          <Text style={{ fontSize: 72, fontWeight: '200', color: fiche.color, opacity: 0.3, lineHeight: 80 }}>{fiche.num}</Text>
          <Text style={{ fontSize: 32, fontWeight: '200', color: 'rgba(215,248,255,0.95)', lineHeight: 40, marginBottom: 8 }}>{fiche.etape}</Text>
          <Text style={{ fontSize: 16, fontWeight: '300', color: fiche.color, marginBottom: 24, fontStyle: 'italic' }}>{fiche.soustitre}</Text>
          <View style={{ backgroundColor: 'rgba(0,18,38,0.7)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.15)', borderRadius: 18, padding: 20, marginBottom: 24 }}>
            <Text style={{ fontSize: 15, fontWeight: '200', color: 'rgba(195,235,255,0.85)', lineHeight: 26 }}>{fiche.description}</Text>
          </View>
          <Text style={{ fontSize: 11, color: 'rgba(0,210,250,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>{tr.points_cles}</Text>
          {fiche.points.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,18,32,0.8)', borderWidth: 1, borderColor: fiche.color, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 }}>
                <Text style={{ fontSize: 10, color: fiche.color, fontWeight: '500' }}>{i + 1}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '200', color: 'rgba(195,235,255,0.85)', lineHeight: 24 }}>{p}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════
// BIBLIOTHEQUE
// ══════════════════════════════════
function Biblio({ lang }) {
  const tr = T[lang] || T['fr'];
  const [tab, setTab] = useState('piliers');
  const [openArticle, setOpenArticle] = useState(null);
  const [openFiche, setOpenFiche] = useState(null);
  const articles = ARTICLES[lang] || ARTICLES.fr;
  const fiches = FICHES[lang] || FICHES.fr;

  if (openArticle) return <ArticleDetail article={openArticle} onClose={() => setOpenArticle(null)} lang={lang} />;
  if (openFiche) return <FicheDetail fiche={openFiche} onClose={() => setOpenFiche(null)} lang={lang} />;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.15} />
      {BULLES.map((b, i) => <Bulle key={i} {...b} />)}
      <View style={{ paddingTop: 62, paddingHorizontal: 22, paddingBottom: 16 }}>
        <Text style={{ fontSize: 34, fontWeight: '200', color: 'rgba(215,248,255,0.94)', letterSpacing: 1 }}>{tr.biblio_titre}</Text>
        <Text style={{ fontSize: 10, color: 'rgba(0,210,250,0.42)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.biblio_sub}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <TouchableOpacity onPress={() => setTab('piliers')} style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: tab === 'piliers' ? 'rgba(0,220,255,0.7)' : 'rgba(0,195,240,0.2)', backgroundColor: tab === 'piliers' ? 'rgba(0,180,230,0.18)' : 'rgba(0,18,32,0.5)' }}>
            <Text style={{ fontSize: 12, fontWeight: '300', color: tab === 'piliers' ? 'rgba(0,230,255,0.9)' : 'rgba(0,180,220,0.5)' }}>{tr.tab_piliers}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('methode')} style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: tab === 'methode' ? 'rgba(0,220,255,0.7)' : 'rgba(0,195,240,0.2)', backgroundColor: tab === 'methode' ? 'rgba(0,180,230,0.18)' : 'rgba(0,18,32,0.5)' }}>
            <Text style={{ fontSize: 12, fontWeight: '300', color: tab === 'methode' ? 'rgba(0,230,255,0.9)' : 'rgba(0,180,220,0.5)' }}>{tr.tab_methode}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
        {tab === 'piliers' && (
          <View style={{ gap: 12, paddingBottom: 40 }}>
            {articles.map((a, i) => {
              const IconComp = ICONS[a.key];
              return (
                <TouchableOpacity key={i} onPress={() => setOpenArticle(a)} style={{ backgroundColor: 'rgba(0,18,38,0.75)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.12)', borderRadius: 20, padding: 18 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,18,32,0.8)', borderWidth: 1.5, borderColor: a.color, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <IconComp color={a.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '300', color: 'rgba(215,248,255,0.92)', lineHeight: 22 }}>{a.titre}</Text>
                      <Text style={{ fontSize: 10, color: a.color, marginTop: 3 }}>{a.duree}{tr.lire}</Text>
                    </View>
                    <Text style={{ fontSize: 18, color: 'rgba(0,195,240,0.3)' }}>›</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '200', color: 'rgba(155,215,240,0.55)', lineHeight: 20 }} numberOfLines={2}>{a.intro}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {tab === 'methode' && (
          <View style={{ gap: 12, paddingBottom: 40 }}>
            <View style={{ backgroundColor: 'rgba(0,18,38,0.7)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.15)', borderRadius: 20, padding: 18, marginBottom: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '200', color: 'rgba(155,215,240,0.7)', lineHeight: 22 }}>{tr.biblio_intro}</Text>
            </View>
            {fiches.map((f, i) => (
              <TouchableOpacity key={i} onPress={() => setOpenFiche(f)} style={{ backgroundColor: 'rgba(0,18,38,0.75)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.12)', borderRadius: 20, padding: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,18,32,0.8)', borderWidth: 1.5, borderColor: f.color, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: f.color }}>{f.num}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: '200', color: f.color }}>{f.etape}</Text>
                    <Text style={{ fontSize: 11, color: 'rgba(155,215,240,0.5)', marginTop: 2 }}>{f.soustitre}</Text>
                  </View>
                  <Text style={{ fontSize: 18, color: 'rgba(0,195,240,0.3)' }}>›</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '200', color: 'rgba(155,215,240,0.55)', lineHeight: 20 }} numberOfLines={2}>{f.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════
// PARCOURS
// ══════════════════════════════════
function ParcoursScreen({ prenom, done, lang, onChangeLang, tensionIdxs }) {
  const tr = T[lang] || T['fr'];
  const totalDone = Object.values(done).flat().filter(Boolean).length;
  const pct = Math.round(totalDone / 140 * 100);
  const animPct = useRef(new Animated.Value(0)).current;
  const piliers = getPiliers(lang);
  const recommendedPiliers = tensionIdxs.map(i => ZONE_TO_PILIER[i]);

  useEffect(() => {
    Animated.timing(animPct, { toValue: pct, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [pct]);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.15} />
      {BULLES.map((b, i) => <Bulle key={i} {...b} />)}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingTop: 62, paddingHorizontal: 24, alignItems: 'center', marginBottom: 28 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,180,235,0.15)', borderWidth: 2, borderColor: 'rgba(0,220,255,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 36 }}>🪼</Text>
          </View>
          <Text style={{ fontSize: 26, fontWeight: '200', color: 'rgba(215,248,255,0.95)', letterSpacing: 2 }}>{prenom || 'FluidBody'}</Text>
          <Text style={{ fontSize: 10, color: 'rgba(0,210,250,0.4)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 4 }}>{tr.mon_parcours}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={styles.statCard}><Text style={styles.statVal}>{totalDone}</Text><Text style={styles.statLbl}>{tr.m_seances}</Text></View>
          <View style={styles.statCard}><Text style={styles.statVal}>3🔥</Text><Text style={styles.statLbl}>{tr.m_streak}</Text></View>
          <View style={styles.statCard}><Text style={styles.statVal}>{pct}%</Text><Text style={styles.statLbl}>{tr.m_progress}</Text></View>
        </View>

        {/* Zones identifiées à l'onboarding */}
        {recommendedPiliers.length > 0 && (
          <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.7)', borderWidth: 0.5, borderColor: 'rgba(0,215,168,0.3)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
            <Text style={{ fontSize: 12, color: 'rgba(0,215,168,0.7)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>★ {tr.recommande_pour_toi}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {recommendedPiliers.map(pk => {
                const p = piliers.find(x => x.key === pk);
                if (!p) return null;
                const IconComp = ICONS[pk];
                return (
                  <View key={pk} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: p.color, backgroundColor: p.bg }}>
                    <IconComp color={p.color} />
                    <Text style={{ fontSize: 12, color: p.color }}>{p.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Sélecteur de langue */}
        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.7)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.15)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
          <Text style={{ fontSize: 12, color: 'rgba(0,210,250,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>🌐  Langue · Language</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {Object.values(T).map(l => (
              <TouchableOpacity key={l.lang} onPress={() => onChangeLang(l.lang)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: lang === l.lang ? 'rgba(0,220,255,0.7)' : 'rgba(0,195,240,0.2)', backgroundColor: lang === l.lang ? 'rgba(0,180,230,0.18)' : 'rgba(0,18,32,0.5)' }}>
                <Text style={{ fontSize: 13, color: lang === l.lang ? 'rgba(0,230,255,0.9)' : 'rgba(0,180,220,0.5)' }}>{l.flag} {l.nom}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.7)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.15)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
          <Text style={{ fontSize: 12, color: 'rgba(0,210,250,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>{tr.prog_globale}</Text>
          <View style={{ height: 8, backgroundColor: 'rgba(0,195,240,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <Animated.View style={{ height: 8, width: animPct.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), backgroundColor: 'rgba(0,215,255,0.7)', borderRadius: 4 }} />
          </View>
          <Text style={{ fontSize: 11, color: 'rgba(0,195,240,0.4)', textAlign: 'right' }}>{totalDone} / 140</Text>
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.7)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.15)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
          <Text style={{ fontSize: 12, color: 'rgba(0,210,250,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>{tr.par_pilier}</Text>
          {piliers.map((p, i) => (
            <View key={i} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '300', color: p.color }}>{p.label}</Text>
                  {recommendedPiliers.includes(p.key) && <Text style={{ fontSize: 9, color: 'rgba(0,215,255,0.7)' }}>★</Text>}
                </View>
                <Text style={{ fontSize: 11, color: 'rgba(0,195,240,0.4)' }}>{done[p.key].filter(Boolean).length}/20</Text>
              </View>
              <View style={{ height: 5, backgroundColor: 'rgba(0,195,240,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ height: 5, width: `${(done[p.key].filter(Boolean).length / 20) * 100}%`, backgroundColor: p.color, borderRadius: 3, opacity: 0.8 }} />
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: 'rgba(0,18,38,0.7)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.15)', borderRadius: 20, padding: 20 }}>
          <Text style={{ fontSize: 12, color: 'rgba(0,210,250,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>{tr.mon_compte}</Text>
          {tr.compte_info.map(([label, val], i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: i < 2 ? 0.5 : 0, borderBottomColor: 'rgba(0,195,240,0.08)' }}>
              <Text style={{ fontSize: 13, fontWeight: '200', color: 'rgba(155,215,240,0.55)' }}>{label}</Text>
              <Text style={{ fontSize: 13, fontWeight: '300', color: 'rgba(0,215,255,0.7)' }}>{val}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════
// PROGRESSER
// ══════════════════════════════════
function Progresser({ done, lang, tensionIdxs }) {
  const tr = T[lang] || T['fr'];
  const totalDone = Object.values(done).flat().filter(Boolean).length;
  const pct = Math.round(totalDone / 140 * 100);
  const piliers = getPiliers(lang);
  const recommendedPiliers = tensionIdxs.map(i => ZONE_TO_PILIER[i]);

  // Trier les piliers : recommandés en premier
  const sortedPiliers = [...piliers].sort((a, b) => {
    const aRec = recommendedPiliers.includes(a.key) ? 0 : 1;
    const bRec = recommendedPiliers.includes(b.key) ? 0 : 1;
    return aRec - bRec;
  });

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#005878', '#00bdd0', '#001828']} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.15} />
      {BULLES.map((b, i) => <Bulle key={i} {...b} />)}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingTop: 65, paddingHorizontal: 24, marginBottom: 24 }}>
          <Text style={{ fontSize: 34, fontWeight: '200', color: 'rgba(215,248,255,0.94)', letterSpacing: 1 }}>{tr.tabs[1]}</Text>
          <Text style={{ fontSize: 10, color: 'rgba(0,210,250,0.42)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>{tr.progresser_sub(pct)}</Text>
          <View style={{ height: 4, backgroundColor: 'rgba(0,195,240,0.1)', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
            <View style={{ height: 4, width: `${pct}%`, backgroundColor: 'rgba(0,215,255,0.7)', borderRadius: 2 }} />
          </View>
        </View>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {sortedPiliers.map(p => {
            const count = done[p.key].filter(Boolean).length;
            const IconComp = ICONS[p.key];
            const isRec = recommendedPiliers.includes(p.key);
            return (
              <View key={p.key} style={{ backgroundColor: 'rgba(0,18,38,0.75)', borderWidth: isRec ? 1 : 0.5, borderColor: isRec ? p.color : 'rgba(0,195,240,0.12)', borderRadius: 20, padding: 18 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.bg, borderWidth: 1, borderColor: p.color, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <IconComp color={p.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: '300', color: 'rgba(215,248,255,0.9)' }}>{p.label}</Text>
                      {isRec && (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,215,255,0.15)', borderWidth: 0.5, borderColor: 'rgba(0,215,255,0.5)' }}>
                          <Text style={{ fontSize: 8, color: 'rgba(0,215,255,0.9)', letterSpacing: 1 }}>★ {tr.recommande_pour_toi}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 10, color: p.color, letterSpacing: 1, marginTop: 2 }}>{count}/20</Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '500', color: p.color }}>{Math.round(count / 20 * 100)}%</Text>
                </View>
                <View style={{ height: 5, backgroundColor: 'rgba(0,195,240,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ height: 5, width: `${(count / 20) * 100}%`, backgroundColor: p.color, borderRadius: 3, opacity: 0.85 }} />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════
// ONBOARDING — 3 étapes : intro → tensions → prénom
// ══════════════════════════════════
function OnboardingScreen({ onDone }) {
  const [langStep, setLangStep] = useState(true);
  const [lang, setLang] = useState('fr');
  const [step, setStep] = useState(0);
  const [prenom, setPrenom] = useState('');
  const [tensionIdxs, setTensionIdxs] = useState([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  function nextStep(n) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(n), 250);
  }

  function toggleTension(idx) {
    setTensionIdxs(prev => prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]);
  }

  if (langStep) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient colors={['#000e18', '#002d48', '#00bdd0', '#005878', '#001828']} locations={[0, 0.3, 0.52, 0.72, 1]} style={StyleSheet.absoluteFill} />
        {BULLES.map((b, i) => <Bulle key={i} {...b} />)}
        <View style={{ position: 'absolute', top: 130, left: 0, right: 0, alignItems: 'center', opacity: 0.9 }}><Meduse /></View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 80 }}>
          <Text style={{ fontSize: 42, fontWeight: '200', color: 'rgba(215,248,255,0.95)', letterSpacing: 6, marginBottom: 8 }}>FluidBody</Text>
          <Text style={{ fontSize: 10, color: 'rgba(0,210,250,0.42)', letterSpacing: 4, textTransform: 'uppercase', marginBottom: 40 }}>🪼</Text>
          <View style={{ gap: 12, width: '80%' }}>
            {Object.values(T).map(l => (
              <TouchableOpacity key={l.lang} onPress={() => { setLang(l.lang); setLangStep(false); }} style={{ height: 54, borderRadius: 27, backgroundColor: 'rgba(0,180,235,0.2)', borderWidth: 1.5, borderColor: 'rgba(0,235,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, color: 'rgba(230,250,255,1)', letterSpacing: 2 }}>{l.flag}  {l.nom}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const tr = T[lang] || T['fr'];
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#000e18', '#002d48', '#00bdd0', '#005878', '#001828']} locations={[0, 0.3, 0.52, 0.72, 1]} style={StyleSheet.absoluteFill} />
      <Rayon left={20} width={45} delay={0} duration={9000} opacity={0.18} />
      <Rayon left={140} width={55} delay={2000} duration={11000} opacity={0.15} />
      {BULLES.map((b, i) => <Bulle key={i} {...b} />)}
      <View style={{ position: 'absolute', top: 130, left: 0, right: 0, alignItems: 'center', opacity: 0.9 }}><Meduse /></View>
      {/* Indicateurs — 3 étapes */}
      <View style={{ position: 'absolute', top: 60, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8, zIndex: 10 }}>
        {[0, 1, 2].map(i => <View key={i} style={{ width: step === i ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: step === i ? 'rgba(0,225,255,0.9)' : 'rgba(0,200,240,0.25)' }} />)}
      </View>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 60, zIndex: 5 }}>

        {/* STEP 0 : intro */}
        {step === 0 && (
          <View style={{ alignItems: 'center', paddingHorizontal: 32, width: '100%' }}>
            <Text style={{ fontSize: 13, color: 'rgba(0,220,255,0.55)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14, textAlign: 'center' }}>{tr.ob_tag}</Text>
            <Text style={{ fontSize: 27, fontWeight: '300', color: 'rgba(215,248,255,0.95)', textAlign: 'center', lineHeight: 38, marginBottom: 10 }}>{tr.ob_l1}<Text style={{ color: 'rgba(80,235,255,0.9)' }}>{tr.ob_l1b}</Text></Text>
            <Text style={{ fontSize: 27, fontWeight: '300', color: 'rgba(215,248,255,0.95)', textAlign: 'center', lineHeight: 38, marginBottom: 10 }}>{tr.ob_l2}<Text style={{ color: 'rgba(80,235,255,0.9)' }}>{tr.ob_l2b}</Text></Text>
            <Text style={{ fontSize: 15, color: 'rgba(120,195,225,0.65)', textAlign: 'center', marginBottom: 36, marginTop: 10 }}>{tr.ob_sub}</Text>
            <TouchableOpacity onPress={() => nextStep(1)} style={styles.btnCtaLarge}>
              <Text style={styles.btnCtaLargeTxt}>{tr.ob_cta}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDone('', lang, [])} style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 14, color: 'rgba(0,190,230,0.6)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.ob_compte}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 1 : tensions */}
        {step === 1 && (
          <View style={{ alignItems: 'center', paddingHorizontal: 32, width: '100%' }}>
            <Text style={{ fontSize: 12, color: 'rgba(0,225,255,0.6)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>{tr.ob_bilan}</Text>
            <Text style={{ fontSize: 32, fontWeight: '300', color: 'rgba(215,248,255,0.95)', textAlign: 'center', marginBottom: 8 }}>{tr.ob_tensions}</Text>
            <Text style={{ fontSize: 14, color: 'rgba(120,195,225,0.6)', marginBottom: 18 }}>{tr.ob_select}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 28, marginTop: 8 }}>
              {tr.ob_zones.map((zone, idx) => (
                <TouchableOpacity key={idx} onPress={() => toggleTension(idx)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5, borderColor: tensionIdxs.includes(idx) ? 'rgba(0,220,255,0.7)' : 'rgba(0,200,240,0.2)', backgroundColor: tensionIdxs.includes(idx) ? 'rgba(0,180,230,0.15)' : 'rgba(0,20,35,0.55)' }}>
                  <Text style={{ fontSize: 15, color: tensionIdxs.includes(idx) ? 'rgba(0,230,255,0.95)' : 'rgba(120,200,230,0.75)' }}>{zone}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => nextStep(2)} style={[styles.btnCtaLarge, tensionIdxs.length === 0 && styles.btnCtaOff]}>
              <Text style={styles.btnCtaLargeTxt}>{tr.ob_continuer}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => nextStep(2)} style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 14, color: 'rgba(0,190,230,0.6)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.ob_explorer}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2 : prénom */}
        {step === 2 && (
          <View style={{ alignItems: 'center', paddingHorizontal: 32, width: '100%' }}>
            <Text style={{ fontSize: 12, color: 'rgba(0,225,255,0.6)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>{tr.ob_prenom_tag}</Text>
            <Text style={{ fontSize: 32, fontWeight: '300', color: 'rgba(215,248,255,0.95)', textAlign: 'center', marginBottom: 8 }}>{tr.ob_prenom}</Text>
            <Text style={{ fontSize: 15, color: 'rgba(120,195,225,0.65)', marginBottom: 24, textAlign: 'center' }}>{tr.ob_prenom_sub}</Text>
            <TextInput
              value={prenom} onChangeText={setPrenom}
              placeholder={tr.ob_placeholder} placeholderTextColor="rgba(0,180,220,0.3)"
              style={{ width: '100%', height: 62, backgroundColor: 'rgba(0,18,32,0.6)', borderWidth: 0.5, borderColor: 'rgba(0,200,240,0.22)', borderRadius: 16, color: 'rgba(200,245,255,0.95)', fontSize: 18, fontWeight: '300', textAlign: 'center', marginBottom: 22 }}
            />
            <TouchableOpacity onPress={() => onDone(prenom, lang, tensionIdxs)} style={[styles.btnCtaLarge, prenom.trim() === '' && styles.btnCtaOff]}>
              <Text style={styles.btnCtaLargeTxt}>{tr.ob_demarrer}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDone('', lang, tensionIdxs)} style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 14, color: 'rgba(0,190,230,0.6)', letterSpacing: 2, textTransform: 'uppercase' }}>{tr.ob_anon}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ══════════════════════════════════
// MAIN APP
// ══════════════════════════════════
function MainApp({ prenom, lang, onChangeLang, tensionIdxs }) {
  const tr = T[lang] || T['fr'];
  const [done, setDone] = useState({
    p1: Array(20).fill(false), p2: Array(20).fill(false),
    p3: Array(20).fill(false), p4: Array(20).fill(false),
    p5: Array(20).fill(false), p6: Array(20).fill(false),
    p7: Array(20).fill(false),
  });
  function toggleDone(key, idx) {
    setDone(prev => { const next = { ...prev, [key]: [...prev[key]] }; next[key][idx] = !next[key][idx]; return next; });
  }
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: 'rgba(0,10,20,0.95)', borderTopColor: 'rgba(0,215,255,0.14)', height: 90, paddingBottom: 14, paddingTop: 8 }, tabBarActiveTintColor: 'rgba(0,220,255,0.9)', tabBarInactiveTintColor: 'rgba(0,195,240,0.36)', tabBarLabelStyle: { fontSize: 14, fontWeight: '400', letterSpacing: 0.3 }, tabBarIconStyle: { marginBottom: -2 } }}>
        <Tab.Screen name={tr.tabs[0]} options={{ tabBarIcon: ({ color }) => <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M12 2C8 2 5 6 5 10c0 3 2 5 5 6v6" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><Path d="M12 16c3-1 7-3 7-6 0-4-3-8-7-8" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.5"/></Svg> }}>{() => <MonCorps prenom={prenom} done={done} toggleDone={toggleDone} lang={lang} tensionIdxs={tensionIdxs} />}</Tab.Screen>
        <Tab.Screen name={tr.tabs[1]} options={{ tabBarIcon: ({ color }) => <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M3 20h18M3 14h12M3 8h8" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><Circle cx="19" cy="8" r="3" stroke={color} strokeWidth="1.6" fill="none"/></Svg> }}>{() => <Progresser done={done} lang={lang} tensionIdxs={tensionIdxs} />}</Tab.Screen>
        <Tab.Screen name={tr.tabs[2]} options={{ tabBarIcon: ({ color }) => <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="8" r="5" stroke={color} strokeWidth="1.6" fill="none"/><Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.6" strokeLinecap="round" fill="none"/></Svg> }}>{() => <SabrinaScreen prenom={prenom} lang={lang} />}</Tab.Screen>
        <Tab.Screen name={tr.tabs[3]} options={{ tabBarIcon: ({ color }) => <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Path d="M4 4h16v16H4z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill="none" rx="2"/><Path d="M8 8h8M8 12h8M8 16h5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/></Svg> }}>{() => <Biblio lang={lang} />}</Tab.Screen>
        <Tab.Screen name={tr.tabs[4]} options={{ tabBarIcon: ({ color }) => <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" fill="none"/><Path d="M12 7v5l3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></Svg> }}>{() => <ParcoursScreen prenom={prenom} done={done} lang={lang} onChangeLang={onChangeLang} tensionIdxs={tensionIdxs} />}</Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// ══════════════════════════════════
// APP ROOT
// ══════════════════════════════════
export default function App() {
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [prenom, setPrenom] = useState('');
  const [lang, setLang] = useState('fr');
  const [tensionIdxs, setTensionIdxs] = useState([]);

  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onDone={(p, l, t) => {
          setPrenom(p);
          setLang(l);
          setTensionIdxs(t);
          setOnboardingDone(true);
        }}
      />
    );
  }
  return (
    <MainApp
      prenom={prenom}
      lang={lang}
      onChangeLang={setLang}
      tensionIdxs={tensionIdxs}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoTitle: { position: 'absolute', top: 58, fontSize: 44, color: 'rgba(215,248,255,0.96)', fontWeight: '200', letterSpacing: 7, textTransform: 'uppercase', zIndex: 10 },
  logoSub: { position: 'absolute', top: 108, fontSize: 15, color: 'rgba(0,210,250,0.85)', letterSpacing: 4, textTransform: 'uppercase', zIndex: 10 },
  metrics: { position: 'absolute', bottom: 95, left: 16, right: 16, flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: 'rgba(0,18,32,0.72)', borderWidth: 0.5, borderColor: 'rgba(0,210,255,0.2)', borderRadius: 16, padding: 10, alignItems: 'center' },
  mval: { fontSize: 20, fontWeight: '500', color: 'rgba(0,238,255,0.95)' },
  mlbl: { fontSize: 9, fontWeight: '200', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(0,175,215,0.55)', marginTop: 3 },
  text: { fontSize: 20, color: 'rgba(215,248,255,0.7)', fontWeight: '200' },
  btnCtaLarge: { width: '100%', height: 66, borderRadius: 33, backgroundColor: 'rgba(0,180,235,0.3)', borderWidth: 2, borderColor: 'rgba(0,235,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  btnCtaOff: { opacity: 0.3 },
  btnCtaLargeTxt: { fontSize: 17, fontWeight: '600', color: 'rgba(230,250,255,1)', letterSpacing: 3, textTransform: 'uppercase' },
  statCard: { flex: 1, backgroundColor: 'rgba(0,18,38,0.75)', borderWidth: 0.5, borderColor: 'rgba(0,195,240,0.15)', borderRadius: 16, padding: 14, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '500', color: 'rgba(0,238,255,0.9)', marginBottom: 4 },
  statLbl: { fontSize: 9, fontWeight: '200', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(0,175,215,0.42)' },
});