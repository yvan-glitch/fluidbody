import { selectSeanceDuJour, dureeMinutes, niveauOf } from '../seanceDuJour';

function s(pilierKey, idx, etape, duree, extra) {
  return Object.assign({ pilierKey, idx, etape, duree, available: true, done: false }, extra || {});
}

const catalogue = {
  byPilier: {
    p2: [
      s('p2', 0, 'Comprendre', "2'"),
      s('p2', 5, 'Préparer', "12'"),
      s('p2', 6, 'Préparer', "8'"),
      s('p2', 7, 'Exécuter', "15'"),
      s('p2', 8, 'Exécuter', "20'"),
      s('p2', 9, 'Évoluer', "25'"),
    ],
    p7: [
      s('p7', 5, 'Préparer', "10'"),
      s('p7', 6, 'Exécuter', "18'"),
      s('p7', 7, 'Évoluer', "22'"),
    ],
    p4: [
      s('p4', 5, 'Préparer', "9'", { available: false }),
      s('p4', 6, 'Exécuter', "14'"),
    ],
  },
  tensionPiliers: ['p2'],
};

describe('selectSeanceDuJour', () => {
  test('aucun choix = séance prévue inchangée', () => {
    expect(selectSeanceDuJour({ pilierKey: 'p7', idx: 7 }, null, catalogue))
      .toEqual({ pilierKey: 'p7', idx: 7, adapted: false, reason: null });
  });

  test('Fatiguée : Évoluer → Exécuter du même pilier', () => {
    const r = selectSeanceDuJour({ pilierKey: 'p7', idx: 7 }, 'fatiguee', catalogue);
    expect(r).toEqual({ pilierKey: 'p7', idx: 6, adapted: true, reason: 'fatiguee' });
  });

  test('Fatiguée : Exécuter → Préparer, la plus courte', () => {
    const r = selectSeanceDuJour({ pilierKey: 'p2', idx: 8 }, 'fatiguee', catalogue);
    expect(r).toEqual({ pilierKey: 'p2', idx: 6, adapted: true, reason: 'fatiguee' });
  });

  test('Fatiguée : préfère une séance pas encore faite', () => {
    const cat = JSON.parse(JSON.stringify(catalogue));
    cat.byPilier.p2[2].done = true; // p2_6 (8') déjà faite
    const r = selectSeanceDuJour({ pilierKey: 'p2', idx: 8 }, 'fatiguee', cat);
    expect(r.idx).toBe(5);
  });

  test('Fatiguée : Évoluer sans Exécuter disponible descend à Préparer', () => {
    const cat = { byPilier: { p9: [s('p9', 5, 'Préparer', "10'"), s('p9', 6, 'Exécuter', "12'", { available: false }), s('p9', 7, 'Évoluer', "20'")] } };
    expect(selectSeanceDuJour({ pilierKey: 'p9', idx: 7 }, 'fatiguee', cat).idx).toBe(5);
  });

  test('Fatiguée : déjà au niveau Préparer = fallback séance prévue', () => {
    const r = selectSeanceDuJour({ pilierKey: 'p2', idx: 5 }, 'fatiguee', catalogue);
    expect(r).toEqual({ pilierKey: 'p2', idx: 5, adapted: false, reason: null });
  });

  test('Fatiguée : jamais la théorie', () => {
    const cat = { byPilier: { p1: [s('p1', 0, 'Comprendre', "1'"), s('p1', 6, 'Exécuter', "15'")] } };
    expect(selectSeanceDuJour({ pilierKey: 'p1', idx: 6 }, 'fatiguee', cat).adapted).toBe(false);
  });

  test('Une gêne : séance douce du pilier de la zone de tension', () => {
    const r = selectSeanceDuJour({ pilierKey: 'p7', idx: 7 }, 'gene', catalogue);
    expect(r).toEqual({ pilierKey: 'p2', idx: 6, adapted: true, reason: 'gene' });
  });

  test('Une gêne : saute une séance indisponible (verrouillée / sans vidéo)', () => {
    const cat = Object.assign({}, catalogue, { tensionPiliers: ['p4'] });
    const r = selectSeanceDuJour({ pilierKey: 'p7', idx: 7 }, 'gene', cat);
    expect(r).toEqual({ pilierKey: 'p4', idx: 6, adapted: true, reason: 'gene' });
  });

  test('Une gêne : zone suivante si le 1er pilier est vide', () => {
    const cat = Object.assign({}, catalogue, { tensionPiliers: ['p6', 'p2'] });
    expect(selectSeanceDuJour({ pilierKey: 'p7', idx: 7 }, 'gene', cat).pilierKey).toBe('p2');
  });

  test('Une gêne : aucune zone de tension = fallback', () => {
    const cat = Object.assign({}, catalogue, { tensionPiliers: [] });
    expect(selectSeanceDuJour({ pilierKey: 'p7', idx: 7 }, 'gene', cat).adapted).toBe(false);
  });

  test('Une gêne : la séance douce est déjà la séance prévue = fallback', () => {
    expect(selectSeanceDuJour({ pilierKey: 'p2', idx: 6 }, 'gene', catalogue).adapted).toBe(false);
  });

  test('entrées invalides = fallback sans crash', () => {
    expect(selectSeanceDuJour(null, 'gene', catalogue).adapted).toBe(false);
    expect(selectSeanceDuJour({ pilierKey: 'p2', idx: 8 }, 'fatiguee', null).adapted).toBe(false);
    expect(selectSeanceDuJour({ pilierKey: 'pX', idx: 1 }, 'fatiguee', catalogue).adapted).toBe(false);
  });
});

describe('helpers', () => {
  test('dureeMinutes', () => {
    expect(dureeMinutes("12'30''")).toBe(12.5);
    expect(dureeMinutes("8'")).toBe(8);
    expect(dureeMinutes(undefined)).toBe(Infinity);
  });
  test('niveauOf', () => {
    expect(niveauOf('Préparer')).toBe(0);
    expect(niveauOf('Évoluer')).toBe(2);
    expect(niveauOf('Comprendre')).toBe(-1);
  });
});
