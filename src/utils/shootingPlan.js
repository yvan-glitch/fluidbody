// Plan de tournage (22.11.2026), réservé aux comptes admin.
// Priorités : 1) ce qui manque au défi 7 jours ; 2) les piliers déjà
// commencés, du plus avancé au moins avancé ; 3) les piliers vides.
// Pur : `hasVideoFn(pilierKey, idx)` est fourni par l'appelant.

export function buildShootingPlan(piliers, seancesByKey, hasVideoFn, challengeDays) {
  const byKey = seancesByKey || {};
  const challenge = [];
  (challengeDays || []).forEach(function (d, i) {
    const s = (byKey[d.pilier] || [])[d.idx];
    if (s && !hasVideoFn(d.pilier, d.idx)) {
      challenge.push({ pilierKey: d.pilier, idx: d.idx, title: s[0], duree: s[1], etape: s[2], day: i + 1 });
    }
  });
  const groups = (piliers || []).map(function (p) {
    const list = byKey[p.key] || [];
    const missing = [];
    let filmed = 0;
    list.forEach(function (s, i) {
      if (!s) return;
      if (hasVideoFn(p.key, i)) filmed += 1;
      else missing.push({ pilierKey: p.key, idx: i, title: s[0], duree: s[1], etape: s[2] });
    });
    return { key: p.key, label: p.label, filmed: filmed, total: list.length, missing: missing };
  }).filter(function (g) { return g.missing.length > 0; });
  groups.sort(function (a, b) { return b.filmed - a.filmed || (a.key < b.key ? -1 : 1); });
  let totalMissing = 0;
  groups.forEach(function (g) { totalMissing += g.missing.length; });
  return { challenge: challenge, groups: groups, totalMissing: totalMissing };
}
