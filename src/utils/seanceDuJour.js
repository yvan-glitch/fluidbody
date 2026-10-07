// seanceDuJour — « Ajustement du jour » (Phase 2, 07.10.2026).
//
// Deux chips discrètes sous « Démarrer » sur la carte de la séance du jour :
// « Fatiguée » et « Une gêne ». Aucune chip = séance prévue inchangée.
// Pas de questionnaire : on réutilise ce que l'app sait déjà (zones de
// tension choisies à l'onboarding).
//
// FONCTION PURE (aucun import React Native) : testée dans
// src/utils/__tests__/seanceDuJour.test.js.

// Niveaux de pratique, du plus doux au plus soutenu. La théorie
// (Comprendre / Ressentir) n'est jamais proposée comme séance du jour.
export const NIVEAUX = ['Préparer', 'Exécuter', 'Évoluer'];
const THEORIE = { Comprendre: true, Ressentir: true };

export function niveauOf(etape) {
  if (THEORIE[etape]) return -1;
  return NIVEAUX.indexOf(etape);
}

// "12'30''" → 12.5 ; "1'59''" → ~2 ; inconnu → Infinity (classé en dernier).
export function dureeMinutes(duree) {
  if (typeof duree !== 'string') return Infinity;
  const m = duree.match(/(\d+)\s*'(?:\s*(\d+))?/);
  if (!m) return Infinity;
  return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 60 : 0);
}

// Meilleur candidat : disponible, pas la séance prévue ; on préfère une
// séance pas encore faite, puis la plus courte, puis l'index le plus bas.
function pick(list, exclude) {
  const c = (list || []).filter(function (s) {
    return s && s.available && !(exclude && s.pilierKey === exclude.pilierKey && s.idx === exclude.idx);
  });
  if (!c.length) return null;
  c.sort(function (a, b) {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    const da = dureeMinutes(a.duree), db = dureeMinutes(b.duree);
    if (da !== db) return da - db;
    return a.idx - b.idx;
  });
  return c[0];
}

/**
 * selectSeanceDuJour(seancePrevue, choix, catalogue)
 *
 * @param seancePrevue { pilierKey, idx }   séance prévue (programme ou séance du jour)
 * @param choix        null | 'fatiguee' | 'gene'
 * @param catalogue    {
 *   byPilier: { [pilierKey]: [{ pilierKey, idx, etape, duree, available, done }] },
 *   tensionPiliers: ['p2', …]   piliers des zones de tension (onboarding, ZONE_TO_PILIER)
 * }
 *   `available` = vidéo en ligne ET accessible à l'utilisateur (calculé par
 *   l'appelant) : on ne propose jamais une séance injouable ou verrouillée.
 *
 * @returns { pilierKey, idx, adapted, reason }
 *   adapted=false → séance prévue (aucun choix, ou aucun candidat : fallback).
 *   reason : 'fatiguee' | 'gene' | null.
 */
export function selectSeanceDuJour(seancePrevue, choix, catalogue) {
  const fallback = {
    pilierKey: seancePrevue && seancePrevue.pilierKey,
    idx: seancePrevue && seancePrevue.idx,
    adapted: false,
    reason: null,
  };
  if (!seancePrevue || !choix || !catalogue || !catalogue.byPilier) return fallback;
  const byPilier = catalogue.byPilier;
  const prevuList = byPilier[seancePrevue.pilierKey] || [];
  const prevu = prevuList.find(function (s) { return s.idx === seancePrevue.idx; });

  if (choix === 'fatiguee') {
    // Même pilier, niveau inférieur (Évoluer → Exécuter → Préparer). Si la
    // séance prévue est déjà au niveau le plus doux : séance prévue.
    const niv = prevu ? niveauOf(prevu.etape) : -1;
    for (let n = niv - 1; n >= 0; n--) {
      const s = pick(prevuList.filter(function (x) { return niveauOf(x.etape) === n; }), seancePrevue);
      if (s) return { pilierKey: s.pilierKey, idx: s.idx, adapted: true, reason: 'fatiguee' };
    }
    return fallback;
  }

  if (choix === 'gene') {
    // Zone de tension de l'onboarding → pilier ; séance la plus douce de ce
    // pilier (Préparer d'abord, puis Exécuter). Jamais Évoluer.
    const tp = Array.isArray(catalogue.tensionPiliers) ? catalogue.tensionPiliers : [];
    for (let i = 0; i < tp.length; i++) {
      const list = byPilier[tp[i]] || [];
      for (let n = 0; n <= 1; n++) {
        const s = pick(list.filter(function (x) { return niveauOf(x.etape) === n; }), null);
        if (s) {
          if (s.pilierKey === seancePrevue.pilierKey && s.idx === seancePrevue.idx) return fallback;
          return { pilierKey: s.pilierKey, idx: s.idx, adapted: true, reason: 'gene' };
        }
      }
    }
    return fallback;
  }

  return fallback;
}
