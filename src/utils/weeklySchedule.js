// weeklySchedule — propose une programmation hebdomadaire (7 séances
// pour les 7 prochains jours) sur la page Pour vous TV.
//
// Algorithme :
// 1. Pour chaque jour J=0..6 (J0 = aujourd'hui), on choisit 1 séance.
// 2. On varie les piliers : pas 7× le même.
// 3. Durée privilégiée : 12-18 min (sweet spot "rituel quotidien").
// 4. Étape : Ressentir ou Exécuter (on évite Comprendre / Évoluer).
// 5. Si l'utilisateur a une intention du jour, on biaise J0 vers le
//    pilier matchant (cf. INTENTION_TO_PILIER).
// 6. Pseudo-aléatoire stable par date : la même semaine produit la
//    même planification jusqu'à dimanche soir (seed dérivée du jour
//    de l'année). Évite que la planification danse à chaque ouverture.
//
// Output : array de { dayIdx, dayLabel, pilier, idx, seance }.

import { getPilierKeyForIntention } from './dailyIntention';
import { hasVideo } from './catalogVisibility';

const DAY_LABELS_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
const DAY_LABELS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = (d - start) + ((start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function parseMin(s) {
  const m = String(s || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

// PRNG déterministe (mulberry32) — seedable depuis le jour de l'année.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Renvoie un tableau de 7 entrées (1/jour) ou [] si rien n'est jouable.
//
// @param piliers — liste des piliers (objets { key, label, ... }).
// @param seancesByKey — map pilierKey → array de seances.
// @param opts.intentionKey — clé d'intention du jour (optionnel) ; biaise J0.
// @param opts.now — Date à utiliser (défaut: new Date()) — pour tests.
// @param opts.lang — 'fr' | 'en' pour les labels de jour.
export function getThisWeekSchedule(piliers, seancesByKey, opts) {
  const o = opts || {};
  const now = o.now instanceof Date ? o.now : new Date();
  const lang = (o.lang || 'fr').toLowerCase();
  const labels = lang.indexOf('fr') === 0 ? DAY_LABELS_FR : DAY_LABELS_EN;
  const intentionKey = o.intentionKey || null;
  const intentionPilier = intentionKey ? getPilierKeyForIntention(intentionKey) : null;

  // Builde un pool de candidats avec score heuristique.
  // Privilégier 12-18 min et étapes Ressentir/Exécuter.
  const pool = [];
  (piliers || []).forEach(function (p) {
    const arr = (seancesByKey && seancesByKey[p.key]) || [];
    arr.forEach(function (s, i) {
      if (!s) return;
      const etape = s[2];
      if (etape === 'Comprendre') return;       // pas pour J0
      if (!hasVideo(p.key, i)) return;           // vidéo requise (bundle ou remote)
      const mins = parseMin(s[1]);
      let score = 0;
      if (mins >= 12 && mins <= 18) score += 3;
      else if (mins >= 8 && mins <= 22) score += 1;
      if (etape === 'Ressentir' || etape === 'Exécuter') score += 2;
      if (etape === 'Préparer') score += 1;
      pool.push({ pilier: p, idx: i, seance: s, mins: mins, score: score });
    });
  });
  if (pool.length === 0) return [];

  // Seed stable par jour de l'année + année (la planification reste la
  // même tant qu'on est dans la même journée).
  const seed = (now.getFullYear() * 366) + dayOfYear(now);
  const rnd = mulberry32(seed);

  const usedPiliers = new Set();
  const usedSessions = new Set();
  const out = [];

  for (let d = 0; d < 7; d++) {
    // Filtre candidats : prefer un pilier qu'on n'a pas encore utilisé
    // cette semaine ; et pour J0 prefer l'intention si disponible.
    let candidates = pool.filter(function (c) {
      if (usedSessions.has(c.pilier.key + '_' + c.idx)) return false;
      return !usedPiliers.has(c.pilier.key);
    });
    // Si on a épuisé les piliers (catalogue petit), relâche la
    // contrainte d'unicité de pilier.
    if (candidates.length === 0) {
      candidates = pool.filter(function (c) { return !usedSessions.has(c.pilier.key + '_' + c.idx); });
    }
    if (candidates.length === 0) break;

    // Biais intention pour J0 : si un candidat match le pilier
    // recommandé, on le prend en priorité (le mieux scoré).
    if (d === 0 && intentionPilier) {
      const intentCandidates = candidates.filter(function (c) { return c.pilier.key === intentionPilier; });
      if (intentCandidates.length > 0) candidates = intentCandidates;
    }

    // Trie par score décroissant, tie-break random stable.
    candidates.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return rnd() - 0.5;
    });
    // Sélection parmi les top-K (K=3) pour garder de la variété sans
    // sacrifier la qualité du score.
    const topK = candidates.slice(0, Math.min(3, candidates.length));
    const chosen = topK[Math.floor(rnd() * topK.length)] || candidates[0];

    usedPiliers.add(chosen.pilier.key);
    usedSessions.add(chosen.pilier.key + '_' + chosen.idx);

    const dDate = new Date(now.getTime() + d * 86400000);
    const dayIdx = dDate.getDay();
    out.push({
      dayIdx: dayIdx,
      dayLabel: labels[dayIdx],
      pilier: chosen.pilier,
      idx: chosen.idx,
      seance: chosen.seance,
      mins: chosen.mins,
    });
  }
  return out;
}
