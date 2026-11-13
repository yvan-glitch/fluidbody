// catalogVisibility — le masquage ne doit jamais renuméroter les index,
// et le mode HIDE_UNFILMED=false doit être un no-op strict.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import {
  HIDE_UNFILMED,
  hasVideo,
  isSeanceVisible,
  visibleSeances,
  countVisible,
  pilierHasContent,
  __resetForTests,
} from '../utils/catalogVisibility';
import { SEANCES_FR } from '../constants/data';

afterEach(() => __resetForTests(null));

describe('flags du bundle', () => {
  test('les séances filmées sont détectées', () => {
    expect(hasVideo('p2', 0)).toBe(true);
    expect(hasVideo('p2', 1)).toBe(true);
    expect(hasVideo('p3', 0)).toBe(false); // flag retiré le 10.10.2026 (vidéo absente de Bunny)
    expect(hasVideo('p3', 5)).toBe(true);
    expect(hasVideo('p9', 5)).toBe(true);
  });

  test('une séance non filmée ne l\'est pas', () => {
    expect(hasVideo('p1', 5)).toBe(false);
    expect(hasVideo('p7', 10)).toBe(false);
  });
});

describe('liste remote', () => {
  test('une vidéo ajoutée en DB devient jouable sans OTA', () => {
    expect(hasVideo('p1', 5)).toBe(false);
    __resetForTests(['p1_5']);
    expect(hasVideo('p1', 5)).toBe(true);
    // Les flags bundle restent valides en parallèle.
    expect(hasVideo('p2', 0)).toBe(true);
  });
});

describe('mode HIDE_UNFILMED=false (comportement historique)', () => {
  const maybe = HIDE_UNFILMED ? test.skip : test;

  maybe('tout est visible', () => {
    expect(isSeanceVisible('p1', 7)).toBe(true);
    expect(countVisible(SEANCES_FR.p1, 'p1')).toBe(SEANCES_FR.p1.length);
    expect(pilierHasContent('p6', SEANCES_FR)).toBe(true);
  });
});

describe('mode HIDE_UNFILMED=true (soumission App Store)', () => {
  const maybe = HIDE_UNFILMED ? test : test.skip;

  maybe('seules les séances avec vidéo sont visibles', () => {
    expect(isSeanceVisible('p2', 0)).toBe(true);
    expect(isSeanceVisible('p1', 7)).toBe(false);
    expect(pilierHasContent('p6', SEANCES_FR)).toBe(false);
  });
});

describe('préservation des index', () => {
  test('visibleSeances renvoie les index du tableau source', () => {
    const vs = visibleSeances(SEANCES_FR.p2, 'p2');
    vs.forEach(({ seance, idx }) => {
      expect(SEANCES_FR.p2[idx]).toBe(seance);
    });
  });
});

describe('mode admin (plan de tournage)', () => {
  const { setCatalogAdminMode, isHidingUnfilmed, countFilmed } = require('../utils/catalogVisibility');
  const maybe = HIDE_UNFILMED ? test : test.skip;

  maybe('un admin voit tout le catalogue, un compte normal seulement le filmé', () => {
    expect(isSeanceVisible('p1', 7)).toBe(false);
    setCatalogAdminMode(true);
    expect(isHidingUnfilmed()).toBe(false);
    expect(isSeanceVisible('p1', 7)).toBe(true);
    expect(pilierHasContent('p6', SEANCES_FR)).toBe(true);
    setCatalogAdminMode(false);
    expect(isSeanceVisible('p1', 7)).toBe(false);
  });

  test('countFilmed compte les séances avec vidéo', () => {
    expect(countFilmed(SEANCES_FR.p6, 'p6')).toBe(0);
    expect(countFilmed(SEANCES_FR.p9, 'p9')).toBeGreaterThanOrEqual(3);
  });
});
