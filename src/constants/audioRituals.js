// audioRituals.js — Foundation data structure for Audio Rituals (v1.2).
//
// Why : Sabrina's bandwidth is the bottleneck (8h cours/day at 55).
// Video séances require studio setup, framing, light, multiple takes.
// Audio rituals = Sabrina records 3-10 min sitting at her desk with the
// AirPods mic — done in 30 min for 5 rituals, no setup.
//
// Strategic value :
//   - Stretches the catalogue cheaply (each ritual is 30 min of work for
//     Sabrina vs 4-8h for a video séance).
//   - New use case : daily 2-min breathing rituals, evening wind-down,
//     pre-meeting calming, post-workout integration.
//   - Premium positioning : "le seul moment Pilates qui rentre vraiment
//     dans ta journée" (versus "j'ai pas le temps de me changer").
//   - Low storage = fast download = works on poor connections (Sabrina's
//     studio clientele includes older users with slower data plans).
//
// Tech notes :
//   - Audio files hosted on Bunny CDN like videos (same Token Auth flow).
//   - Lightweight player (no fullscreen, just bottom bar with play/pause).
//   - Sabrina's voice : raw recording, no music, no production. Authenticity.
//   - Optional ambient background : sea waves, rain (light loop, no
//     copyright issues).
//
// Categories (proposed for first batch):

export const RITUAL_CATEGORIES = {
  respiration: {
    keyFr: 'Respiration',
    keyEn: 'Breathing',
    description: 'Cohérence cardiaque, respiration carrée, 4-7-8',
    icon: 'wind', // Liquid Glass wind icon
    color: '#7BD9FF', // light blue
  },
  reveil: {
    keyFr: 'Réveil',
    keyEn: 'Morning',
    description: 'Sortir du lit en douceur, 3 à 5 min',
    icon: 'sunrise',
    color: '#FFD27B', // warm yellow
  },
  pause: {
    keyFr: 'Pause active',
    keyEn: 'Active Pause',
    description: 'Décontraction express au bureau',
    icon: 'pause-circle',
    color: '#AEEF4D', // Fluidbody green
  },
  endormissement: {
    keyFr: 'Endormissement',
    keyEn: 'Sleep',
    description: 'Détente avant la nuit : scan corporel, respiration profonde',
    icon: 'moon',
    color: '#9B7BFF', // soft purple
  },
  meditation: {
    keyFr: 'Méditation',
    keyEn: 'Meditation',
    description: 'Ancrage, gratitude, observation des sensations',
    icon: 'meditation',
    color: '#FF9BB8', // soft pink
  },
};

// Initial batch — to be filled when Sabrina records. Format mirrors
// SEANCES (data.js) tuples: [titleFr, duration, category, hasAudio].
// hasAudio=true means the file is on Bunny + has a row in audio_assets.
// Until Sabrina records, all entries are placeholders (hasAudio=false).

export const RITUALS_FR = {
  respiration: [
    ['Cohérence cardiaque 5 min', "5'00''", 'respiration', false],
    ['Respiration carrée : début', "3'30''", 'respiration', false],
    ['4-7-8 pour s\'endormir', "4'15''", 'respiration', false],
    ['Souffle de l\'ours : apaisement', "6'00''", 'respiration', false],
  ],
  reveil: [
    ['Ouvrir le corps en 3 minutes', "3'00''", 'reveil', false],
    ['Réveil doux pour le dos', "5'30''", 'reveil', false],
    ['Étirements depuis le lit', "4'00''", 'reveil', false],
  ],
  pause: [
    ['Décontraction nuque & épaules', "3'00''", 'pause', false],
    ['Pause bureau express', "2'30''", 'pause', false],
    ['Respiration entre deux réunions', "1'45''", 'pause', false],
  ],
  endormissement: [
    ['Scan corporel pour s\'endormir', "8'00''", 'endormissement', false],
    ['Détente progressive de Jacobson', "10'00''", 'endormissement', false],
    ['Visualisation marine', "7'30''", 'endormissement', false],
  ],
  meditation: [
    ['Ancrage 5 minutes', "5'00''", 'meditation', false],
    ['Gratitude du soir', "4'00''", 'meditation', false],
    ['Observation des sensations', "8'00''", 'meditation', false],
  ],
};

export const RITUALS_EN = {
  respiration: [
    ['Coherent Breathing 5 min', "5'00''", 'respiration', false],
    ['Box Breathing: beginner', "3'30''", 'respiration', false],
    ['4-7-8 for sleep', "4'15''", 'respiration', false],
    ['Bear Breath: calming', "6'00''", 'respiration', false],
  ],
  reveil: [
    ['Open your body in 3 min', "3'00''", 'reveil', false],
    ['Gentle back wake-up', "5'30''", 'reveil', false],
    ['In-bed stretches', "4'00''", 'reveil', false],
  ],
  pause: [
    ['Neck & shoulder release', "3'00''", 'pause', false],
    ['Office break express', "2'30''", 'pause', false],
    ['Breath between meetings', "1'45''", 'pause', false],
  ],
  endormissement: [
    ['Body scan for sleep', "8'00''", 'endormissement', false],
    ['Jacobson relaxation', "10'00''", 'endormissement', false],
    ['Ocean visualization', "7'30''", 'endormissement', false],
  ],
  meditation: [
    ['5-min grounding', "5'00''", 'meditation', false],
    ['Evening gratitude', "4'00''", 'meditation', false],
    ['Observing sensations', "8'00''", 'meditation', false],
  ],
};

// Helper : ritual session ID convention.
// Mirrors video sessions: ${category}_${index}, e.g. "respiration_0".
export function buildRitualId(category, index) {
  return `${category}_${index}`;
}

// Helper : get rituals for current language.
export function getRituals(lang) {
  return (lang || '').toLowerCase().startsWith('en') ? RITUALS_EN : RITUALS_FR;
}
