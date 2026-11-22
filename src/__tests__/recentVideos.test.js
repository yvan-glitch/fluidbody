jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { pickRecentIds } from '../utils/catalogVisibility';

describe('pickRecentIds (rangée Nouveautés)', () => {
  const now = new Date('2026-11-22T17:00:00Z');
  const dates = {
    p3_22: '2026-11-22T10:00:00Z',
    p6_5: '2026-11-22T09:00:00Z',
    p9_5: '2026-11-14T08:00:00Z',
    p7_5: '2026-09-16T08:00:00Z',
    materiel_0: '2026-11-21T08:00:00Z',
    p2_1: 'pas une date',
  };
  test('garde les 14 derniers jours, la plus récente en premier', () => {
    expect(pickRecentIds(dates, now, 14, 8)).toEqual(['p3_22', 'p6_5', 'p9_5']);
  });
  test('ignore les vidéos hors piliers et les dates invalides', () => {
    const ids = pickRecentIds(dates, now, 14, 8);
    expect(ids).not.toContain('materiel_0');
    expect(ids).not.toContain('p2_1');
  });
  test('respecte le maximum', () => {
    expect(pickRecentIds(dates, now, 14, 1)).toEqual(['p3_22']);
  });
  test('sans dates, rien', () => {
    expect(pickRecentIds({}, now, 14, 8)).toEqual([]);
    expect(pickRecentIds(null, now, 14, 8)).toEqual([]);
  });
});
