// Objectif semaine : séances faites dans la semaine en cours (22.11.2026).
// `cal` = contenu de `fluid_activity_calendar` ({ 'AAAA-MM-JJ': nombre }).

// Nombre de séances du lundi au dimanche de la semaine de `now`.
export function countSessionsThisWeek(cal, now) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  function k(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  const from = k(monday);
  const to = k(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6));
  let n = 0;
  Object.keys(cal || {}).forEach(function(key) {
    if (key >= from && key <= to) n += Number(cal[key]) || 0;
  });
  return n;
}
