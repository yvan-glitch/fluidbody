// Reprendre (22.11.2026) : choisit la vidéo interrompue la plus récente.
// `entries` = [[clé AsyncStorage, valeur JSON]] des clés fluid_video_resume_v1_*.
// Pur : testé dans src/__tests__/resumePick.test.js.

export const RESUME_MAX_AGE_DAYS = 14;

export function pickResume(entries, prefix, now) {
  let best = null;
  (entries || []).forEach(function (pair) {
    const key = pair && pair[0];
    const raw = pair && pair[1];
    if (!key || !raw || key.indexOf(prefix) !== 0) return;
    const m = key.slice(prefix.length).match(/^(p\d+)_(\d+)$/);
    if (!m) return;
    let o = null;
    try { o = JSON.parse(raw); } catch (e) { return; }
    if (!o || !o.t || !o.durationMillis || !o.positionMillis) return;
    if (now - o.t > RESUME_MAX_AGE_DAYS * 86400000) return;
    const left = o.durationMillis - o.positionMillis;
    if (o.positionMillis < 15000 || left < 30000) return; // à peine commencée, ou presque finie
    if (!best || o.t > best.t) {
      best = { pilierKey: m[1], idx: parseInt(m[2], 10), t: o.t, minutesLeft: Math.max(1, Math.round(left / 60000)), progress: o.positionMillis / o.durationMillis };
    }
  });
  return best;
}
