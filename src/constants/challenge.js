// ── Défi 7 jours « Libère ton dos » ──
// Parcours guidé d'une semaine composé de séances EXISTANTES du catalogue —
// aucune nouvelle vidéo requise, uniquement de l'orchestration. Le gating
// abonnement reste celui du catalogue (canAccessSeanceIndex) : les jours
// premium ouvrent le paywall pour les non-abonnés, exactement comme partout.
//
// ⚠️ INTERRUPTEUR : `enabled: false` tant que les vidéos des 7 jours ne sont
// pas toutes en ligne (au 2026-07-23, seuls p2_0, p2_1 et p3_0 ont le flag
// vidéo dans data.js). Quand les tournages arrivent : flip à `true` + OTA.
// La carte d'entrée sur l'écran Séances n'apparaît que si enabled.
//
// Progression pensée avec la logique des étapes : Comprendre (J1-J2) →
// Ressentir (J3) → Préparer (J4-J6) → Exécuter (J7). Durées croissantes :
// 2 min → 28 min. Les deux premiers jours sont gratuits (vidéos déjà en
// ligne) : le nouvel utilisateur goûte la valeur avant de rencontrer le
// paywall au J4.
export const CHALLENGE_7J = {
  id: 'dos7_v1',
  enabled: false,
  days: [
    { pilier: 'p2', idx: 0 },  // J1 — Le dos expliqué (2 min, Comprendre, gratuit, vidéo ✓)
    { pilier: 'p2', idx: 1 },  // J2 — Pourquoi le dos souffre (2 min 29, Comprendre, gratuit, vidéo ✓)
    { pilier: 'p2', idx: 3 },  // J3 — Ressentir sa colonne (12 min, Ressentir, gratuit)
    { pilier: 'p2', idx: 5 },  // J4 — Relâcher le psoas (20 min, Préparer, premium)
    { pilier: 'p2', idx: 6 },  // J5 — Décompression lombaire (22 min, Préparer, premium)
    { pilier: 'p8', idx: 8 },  // J6 — Dos assis — décompression (8 min, Préparer, premium)
    { pilier: 'p2', idx: 12 }, // J7 — Pont fessier guidé (28 min, Exécuter, premium)
  ],
};

/** Nombre de jours du défi complétés d'après la map `done` globale. */
export function challengeDoneCount(done) {
  if (!done) return 0;
  let n = 0;
  for (const d of CHALLENGE_7J.days) {
    const arr = done[d.pilier];
    const v = arr && arr[d.idx];
    if (v === true || v === 'true') n++;
  }
  return n;
}

/** Index (0-based) du prochain jour à faire, ou -1 si tout est complété. */
export function challengeNextDay(done) {
  for (let i = 0; i < CHALLENGE_7J.days.length; i++) {
    const d = CHALLENGE_7J.days[i];
    const arr = done && done[d.pilier];
    const v = arr && arr[d.idx];
    if (!(v === true || v === 'true')) return i;
  }
  return -1;
}
