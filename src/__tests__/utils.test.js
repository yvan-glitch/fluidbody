// Tests de la logique métier pure de src/utils.js — surtout le paywall
// (canAccessSeanceIndex) et la recommandation du jour (getSeanceDuJour).
//
// On mocke les modules lourds importés par src/utils.js pour ne pas tirer
// toute la chaîne native (expo-av, supabase, healthkit…) : seul
// VIDEO_RESUME_PREFIX est consommé depuis VideoPlayer.

jest.mock('../components/VideoPlayer', () => ({
  VIDEO_RESUME_PREFIX: 'fluid_video_resume_v1_',
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const {
  canAccessSeanceIndex,
  getPiliers,
  getSeanceDuJour,
  getSeances,
  isComingSoon,
} = require('../utils');
const { T, SEANCES_FR, SEANCES_EN, FREE_MONTHLY_SELECTION } = require('../constants/data');

describe('canAccessSeanceIndex — règles du paywall', () => {
  test('la séance 0 est gratuite pour tous, abonné ou non', () => {
    expect(canAccessSeanceIndex(0, false, 'p1')).toBe(true);
    expect(canAccessSeanceIndex(0, false, 'p7')).toBe(true);
    expect(canAccessSeanceIndex(0, false)).toBe(true); // sans pilierKey aussi
  });

  test('la théorie (Comprendre / Ressentir) est gratuite pour les non-abonnés', () => {
    // p1 idx 1 = 'La coiffe des rotateurs' (Comprendre)
    expect(SEANCES_FR.p1[1][2]).toBe('Comprendre');
    expect(canAccessSeanceIndex(1, false, 'p1')).toBe(true);
    // p1 idx 3 = 'Le poids du bras' (Ressentir)
    expect(SEANCES_FR.p1[3][2]).toBe('Ressentir');
    expect(canAccessSeanceIndex(3, false, 'p1')).toBe(true);
  });

  test('les séances pratiques (Préparer / Exécuter / Évoluer) sont payantes pour les non-abonnés', () => {
    expect(SEANCES_FR.p1[5][2]).toBe('Préparer');
    expect(canAccessSeanceIndex(5, false, 'p1')).toBe(false);
    expect(SEANCES_FR.p2[10][2]).toBe('Exécuter');
    expect(canAccessSeanceIndex(10, false, 'p2')).toBe(false);
    expect(SEANCES_FR.p9[6][2]).toBe('Exécuter');
    expect(canAccessSeanceIndex(6, false, 'p9')).toBe(false);
  });

  test('un abonné accède à tout', () => {
    expect(canAccessSeanceIndex(5, true, 'p1')).toBe(true);
    expect(canAccessSeanceIndex(19, true, 'p2')).toBe(true);
    expect(canAccessSeanceIndex(2, true)).toBe(true);
  });

  test('la sélection gratuite du mois débloque des séances pratiques précises', () => {
    // FREE_MONTHLY_SELECTION contient p7_10 et p3_15 (pratiques normalement payantes)
    expect(canAccessSeanceIndex(10, false, 'p7')).toBe(true);
    expect(canAccessSeanceIndex(15, false, 'p3')).toBe(true);
    // …mais pas leurs voisines
    expect(canAccessSeanceIndex(11, false, 'p7')).toBe(false);
    expect(canAccessSeanceIndex(16, false, 'p3')).toBe(false);
  });

  test('sans pilierKey, seule la règle idx 0 / abonné s’applique', () => {
    expect(canAccessSeanceIndex(2, false)).toBe(false);
    expect(canAccessSeanceIndex(2, true)).toBe(true);
  });
});

describe('getPiliers', () => {
  test('retourne les 9 piliers avec clé, couleurs et label traduit', () => {
    const fr = getPiliers('fr');
    expect(fr).toHaveLength(9);
    for (const p of fr) {
      expect(typeof p.key).toBe('string');
      expect(typeof p.color).toBe('string');
      expect(typeof p.bg).toBe('string');
      expect(typeof p.label).toBe('string');
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  test('les labels suivent la langue et l’ordre du cercle est préservé', () => {
    const fr = getPiliers('fr');
    const en = getPiliers('en');
    // Premier pilier du cercle = p7 (Mat Pilates)
    expect(fr[0].key).toBe('p7');
    expect(fr[0].label).toBe(T.fr.piliers[6]);
    const p1fr = fr.find((p) => p.key === 'p1');
    const p1en = en.find((p) => p.key === 'p1');
    expect(p1fr.label).toBe('Épaules');
    expect(p1en.label).toBe('Shoulders');
  });

  test('langue inconnue → repli sur le français', () => {
    const de = getPiliers('de');
    expect(de.find((p) => p.key === 'p2').label).toBe(T.fr.piliers[1]);
  });
});

describe('getSeances', () => {
  test('fr → SEANCES_FR, autres langues → SEANCES_EN', () => {
    expect(getSeances('fr')).toBe(SEANCES_FR);
    expect(getSeances('en')).toBe(SEANCES_EN);
    expect(getSeances('es')).toBe(SEANCES_EN);
  });
});

describe('getSeanceDuJour', () => {
  test('privilégie le pilier lié aux zones de tension et saute la théorie', () => {
    // Zone 1 = Épaules → p1. Les 5 premières séances de p1 sont de la théorie,
    // donc la première pratique non faite est l’index 5.
    const r = getSeanceDuJour({}, [1], 'fr');
    expect(r.key).toBe('p1');
    expect(r.idx).toBe(5);
    expect(['Préparer', 'Exécuter', 'Évoluer']).toContain(r.seance[2]);
  });

  test('avance à la séance pratique suivante quand la première est faite', () => {
    const r = getSeanceDuJour({ p1: { 5: true } }, [1], 'fr');
    expect(r.key).toBe('p1');
    expect(r.idx).toBe(6);
  });

  test('tout est terminé → repli sur la première séance du premier pilier', () => {
    const allDone = {};
    for (const pk of Object.keys(SEANCES_FR)) {
      allDone[pk] = {};
      SEANCES_FR[pk].forEach((s, i) => {
        allDone[pk][i] = true;
      });
    }
    const r = getSeanceDuJour(allDone, [], 'fr');
    expect(r.key).toBe('p7'); // premier pilier de l'ordre du cercle
    expect(r.idx).toBe(0);
  });

  test('retourne toujours une séance valide même sans tensions', () => {
    const r = getSeanceDuJour({}, [], 'fr');
    expect(r).toBeTruthy();
    expect(SEANCES_FR[r.key][r.idx]).toBe(r.seance);
  });
});

describe('isComingSoon', () => {
  test('p9 (Ménopause) est en attente de tournage, pas les autres', () => {
    expect(isComingSoon('p9', 0)).toBe(true);
    expect(isComingSoon('p1', 0)).toBe(false);
    expect(isComingSoon('p7', 19)).toBe(false);
  });
});
