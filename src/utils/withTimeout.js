// Promise.race avec timeout — protège les appels réseau (ex: Supabase auth)
// pour éviter qu'un spinner reste figé indéfiniment si la requête ne résout
// jamais (réseau flaky au démarrage). Au timeout la promesse rejette, donc le
// `catch` appelant affiche une erreur honnête et débloque l'UI (setLoading
// false) au lieu de tourner sans fin.
export function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error((label || 'request') + ' timeout after ' + ms + 'ms'));
      }, ms);
    }),
  ]);
}
