import { buildShootingPlan } from '../utils/shootingPlan';

const piliers = [{ key: 'p2', label: 'Dos' }, { key: 'p3', label: 'Mobilité' }, { key: 'p4', label: 'Posture' }];
const seances = {
  p2: [['A', '2 min', 'Comprendre'], ['B', '20 min', 'Préparer']],
  p3: [['C', '5 min', 'Comprendre'], ['D', '10 min', 'Préparer'], ['E', '15 min', 'Exécuter']],
  p4: [['F', '5 min', 'Comprendre']],
};
const filmed = { p2_0: true, p3_0: true, p3_1: true, p4_0: true };
const has = (pk, i) => !!filmed[pk + '_' + i];

test('défi en premier, puis piliers les plus avancés, piliers complets exclus', () => {
  const plan = buildShootingPlan(piliers, seances, has, [{ pilier: 'p2', idx: 0 }, { pilier: 'p2', idx: 1 }]);
  expect(plan.challenge).toEqual([{ pilierKey: 'p2', idx: 1, title: 'B', duree: '20 min', etape: 'Préparer', day: 2 }]);
  expect(plan.groups.map((g) => g.key)).toEqual(['p3', 'p2']);
  expect(plan.groups[0].missing.map((m) => m.idx)).toEqual([2]);
  expect(plan.totalMissing).toBe(2);
});

test('tout est filmé : plan vide', () => {
  const plan = buildShootingPlan(piliers, seances, () => true, []);
  expect(plan.totalMissing).toBe(0);
  expect(plan.groups).toEqual([]);
});
