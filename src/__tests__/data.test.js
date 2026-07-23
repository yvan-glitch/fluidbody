// Tests d'intégrité des constantes (src/constants/data.js) :
// cohérence FR/EN des séances, validité de la sélection gratuite du mois,
// mapping zones→piliers. Ces invariants sont consommés partout dans l'app
// (paywall, cercle des piliers, onboarding) — une désynchro casserait l'UI.
const {
  T,
  SEANCES_FR,
  SEANCES_EN,
  PILIERS_BASE,
  FREE_MONTHLY_SELECTION,
  FREE_SEANCE_INDEX,
  ZONE_TO_PILIER,
} = require('../constants/data');

const ETAPES = ['Comprendre', 'Ressentir', 'Préparer', 'Exécuter', 'Évoluer'];

describe('T — traductions', () => {
  test('fr et en existent avec le bon code de langue', () => {
    expect(T.fr.lang).toBe('fr');
    expect(T.en.lang).toBe('en');
  });

  test('chaque langue a 4 tabs et 9 labels de piliers (p1–p9)', () => {
    for (const lang of Object.keys(T)) {
      expect(T[lang].tabs).toHaveLength(4);
      // PILIER_LABEL_IDX va jusqu'à l'index 8 → il faut 9 labels
      expect(T[lang].piliers.length).toBeGreaterThanOrEqual(9);
    }
  });
});

describe('SEANCES_FR / SEANCES_EN — parité et forme des tuples', () => {
  test('mêmes piliers et même nombre de séances dans les deux langues', () => {
    expect(Object.keys(SEANCES_EN).sort()).toEqual(Object.keys(SEANCES_FR).sort());
    for (const pk of Object.keys(SEANCES_FR)) {
      expect(SEANCES_EN[pk]).toHaveLength(SEANCES_FR[pk].length);
    }
  });

  test('chaque tuple = [titre, durée, étape valide, flag vidéo optionnel]', () => {
    for (const [pk, seances] of Object.entries(SEANCES_FR)) {
      seances.forEach((s, i) => {
        expect(typeof s[0]).toBe('string');
        expect(s[0].length).toBeGreaterThan(0);
        expect(typeof s[1]).toBe('string');
        if (!ETAPES.includes(s[2])) {
          throw new Error(`Étape invalide "${s[2]}" pour ${pk}[${i}]`);
        }
      });
    }
  });

  test('l’étape et le flag vidéo protégée concordent entre FR et EN', () => {
    for (const pk of Object.keys(SEANCES_FR)) {
      SEANCES_FR[pk].forEach((s, i) => {
        const en = SEANCES_EN[pk][i];
        expect(en[2]).toBe(s[2]); // même étape → mêmes règles de gratuité théorie
        expect(!!en[3]).toBe(!!s[3]); // même flag vidéo → même id video_assets
      });
    }
  });
});

describe('FREE_MONTHLY_SELECTION — sélection gratuite du mois', () => {
  test('chaque entrée pointe vers une séance existante (FR et EN)', () => {
    expect(FREE_MONTHLY_SELECTION.length).toBeGreaterThan(0);
    for (const { pilier, idx } of FREE_MONTHLY_SELECTION) {
      expect(SEANCES_FR[pilier]).toBeDefined();
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(SEANCES_FR[pilier].length);
      expect(idx).toBeLessThan(SEANCES_EN[pilier].length);
    }
  });

  test('FREE_SEANCE_INDEX reste 0 (première séance gratuite pour tous)', () => {
    expect(FREE_SEANCE_INDEX).toBe(0);
  });
});

describe('PILIERS_BASE & ZONE_TO_PILIER', () => {
  test('chaque pilier du cercle a des séances définies', () => {
    for (const p of PILIERS_BASE) {
      expect(SEANCES_FR[p.key]).toBeDefined();
      expect(SEANCES_FR[p.key].length).toBeGreaterThan(0);
    }
  });

  test('les clés de piliers sont uniques', () => {
    const keys = PILIERS_BASE.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('chaque zone de tension de l’onboarding mappe vers un pilier existant', () => {
    const validKeys = new Set(PILIERS_BASE.map((p) => p.key));
    for (const pk of Object.values(ZONE_TO_PILIER)) {
      expect(validKeys.has(pk)).toBe(true);
    }
  });
});
