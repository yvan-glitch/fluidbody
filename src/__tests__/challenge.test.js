// Tests du Défi 7 jours — logique pure de src/constants/challenge.js.
import { CHALLENGE_7J, challengeDoneCount, challengeNextDay } from '../constants/challenge';
import { SEANCES_FR } from '../constants/data';

function emptyDone() {
  return { p1: Array(20).fill(false), p2: Array(20).fill(false), p3: Array(20).fill(false),
    p4: Array(20).fill(false), p5: Array(20).fill(false), p6: Array(20).fill(false),
    p7: Array(20).fill(false), p8: Array(20).fill(false), p9: Array(20).fill(false) };
}

describe('Défi 7 jours — configuration', () => {
  test('7 jours exactement, tous pointant vers des séances existantes', () => {
    expect(CHALLENGE_7J.days).toHaveLength(7);
    for (const d of CHALLENGE_7J.days) {
      const s = (SEANCES_FR[d.pilier] || [])[d.idx];
      expect(s).toBeDefined();
      expect(typeof s[0]).toBe('string');
    }
  });

  test('aucun jour ne pointe vers p9 (coming soon)', () => {
    for (const d of CHALLENGE_7J.days) expect(d.pilier).not.toBe('p9');
  });

  test('J1 et J2 sont gratuits (idx 0/1 théorie du pilier Dos)', () => {
    expect(CHALLENGE_7J.days[0]).toEqual({ pilier: 'p2', idx: 0 });
    expect(CHALLENGE_7J.days[1].pilier).toBe('p2');
  });
});

describe('Défi 7 jours — progression', () => {
  test('vierge : 0 fait, prochain jour = 0', () => {
    const done = emptyDone();
    expect(challengeDoneCount(done)).toBe(0);
    expect(challengeNextDay(done)).toBe(0);
  });

  test('J1 fait : 1 fait, prochain jour = 1', () => {
    const done = emptyDone();
    done.p2[0] = true;
    expect(challengeDoneCount(done)).toBe(1);
    expect(challengeNextDay(done)).toBe(1);
  });

  test("valeurs 'true' string (legacy AsyncStorage) comptées comme faites", () => {
    const done = emptyDone();
    done.p2[0] = 'true';
    expect(challengeDoneCount(done)).toBe(1);
  });

  test('jours faits dans le désordre : nextDay = premier trou', () => {
    const done = emptyDone();
    done.p2[0] = true;      // J1
    done.p2[5] = true;      // J4 fait en avance
    expect(challengeDoneCount(done)).toBe(2);
    expect(challengeNextDay(done)).toBe(1); // J2 reste le prochain
  });

  test('tout fait : count 7, nextDay -1', () => {
    const done = emptyDone();
    for (const d of CHALLENGE_7J.days) done[d.pilier][d.idx] = true;
    expect(challengeDoneCount(done)).toBe(7);
    expect(challengeNextDay(done)).toBe(-1);
  });

  test('done null/undefined ne crashe pas', () => {
    expect(challengeDoneCount(null)).toBe(0);
    expect(challengeNextDay(undefined)).toBe(0);
  });
});
