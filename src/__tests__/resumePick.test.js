import { pickResume } from '../utils/resumePick';

const P = 'fluid_video_resume_v1_';
const now = 1795370000000;
const mk = (pos, dur, ageH) => JSON.stringify({ uri: 'x', positionMillis: pos, durationMillis: dur, t: now - ageH * 3600000 });

describe('pickResume', () => {
  test('prend la vidéo interrompue la plus récente', () => {
    const r = pickResume([[P + 'p3_10', mk(300000, 900000, 48)], [P + 'p9_5', mk(120000, 780000, 2)]], P, now);
    expect(r.pilierKey).toBe('p9');
    expect(r.idx).toBe(5);
    expect(r.minutesLeft).toBe(11);
  });
  test('ignore trop vieux, à peine commencé, presque fini, clés étrangères', () => {
    const r = pickResume([
      [P + 'p3_10', mk(300000, 900000, 24 * 20)],
      [P + 'p3_11', mk(5000, 900000, 1)],
      [P + 'p3_12', mk(890000, 900000, 1)],
      [P + 'materiel_0', mk(60000, 220000, 1)],
      ['autre', mk(300000, 900000, 1)],
    ], P, now);
    expect(r).toBeNull();
  });
  test('entrées vides ou corrompues', () => {
    expect(pickResume([], P, now)).toBeNull();
    expect(pickResume([[P + 'p3_1', '{pas du json']], P, now)).toBeNull();
  });
});
