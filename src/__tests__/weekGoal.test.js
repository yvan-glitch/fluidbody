import { countSessionsThisWeek } from '../utils/weekGoal';

describe('countSessionsThisWeek', () => {
  const cal = { '2026-11-15': 4, '2026-11-16': 1, '2026-11-19': 2, '2026-11-22': 1, '2026-11-23': 5 };
  test('un dimanche, la semaine va du lundi précédent à ce dimanche', () => {
    expect(countSessionsThisWeek(cal, new Date(2026, 10, 22, 17, 0))).toBe(4);
  });
  test('un lundi, la semaine repart de zéro', () => {
    expect(countSessionsThisWeek(cal, new Date(2026, 10, 23, 8, 0))).toBe(5);
  });
  test('calendrier vide ou absent', () => {
    expect(countSessionsThisWeek({}, new Date(2026, 10, 22))).toBe(0);
    expect(countSessionsThisWeek(null, new Date(2026, 10, 22))).toBe(0);
  });
});
