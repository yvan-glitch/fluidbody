// Citations Sabrina — 30 lignes courtes, sereines, non mystiques. Une par
// jour, déterministe via le jour de l'année (mêmes pour toute la journée).

const QUOTES = [
  "Le centre, point de départ de tout.",
  "Respirer, c'est déjà s'aligner.",
  "Le mouvement libre commence par un dos conscient.",
  "Ton corps connaît le chemin, écoute-le.",
  "Chaque jour, une nouvelle posture à apprivoiser.",
  "Le Pilates conscient, c'est l'art de se réinventer en bougeant.",
  "Trente ans d'application, une vie de transformation.",
  "Comprendre, ressentir, exécuter, évoluer.",
  "La force naît du calme, jamais de la tension.",
  "Le souffle te ramène au moment présent.",
  "Une épaule libre, c'est une journée libre.",
  "Avant de pousser, ancre-toi.",
  "Le plancher pelvien est ton fondement silencieux.",
  "Sentir d'abord, puis seulement bouger.",
  "Petit geste, grande conscience.",
  "Aligne-toi, le reste suit.",
  "Le dos heureux porte tout le corps.",
  "Mobiliser, c'est rajeunir.",
  "Bouge lentement, tu iras plus loin.",
  "La constance bat l'intensité.",
  "Cinq minutes par jour valent plus qu'une heure le dimanche.",
  "Le centre te tient. Le souffle te porte.",
  "Une seule respiration peut tout changer.",
  "Ton tapis t'attend, sans jugement.",
  "Sois doux avec toi avant d'être fort.",
  "Le Pilates ne demande pas de souplesse, il la construit.",
  "Habite ton corps comme on habite une maison.",
  "Aujourd'hui n'est pas hier, ton corps non plus.",
  "Reviens à ton souffle dès qu'il s'envole.",
  "La qualité d'un mouvement vaut mille répétitions.",
];

function dayOfYear(date) {
  const d = date || new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / 86400000);
}

export function getDailyQuote() {
  if (!QUOTES.length) return '';
  return QUOTES[dayOfYear() % QUOTES.length];
}

export { QUOTES as SABRINA_QUOTES_ALL };
