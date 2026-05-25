// Fetches short-lived Bunny Token-Auth URLs from the `sign-video-url` edge
// function. URLs are cached in-memory per (sessionId, kind, lang) until they
// approach expiry, so scrubbing inside the player never re-signs.
//
// Session ids match the DownloadManager convention: `${pilierKey}_${index}`
// (e.g. 'p2_0'). The mapping from session id to Bunny GUID lives server-side
// in the `video_assets` table — never in the bundled JS.

import supabase from '../lib/supabase';

const SAFETY_MARGIN_MS = 60_000; // re-sign 1 min before the token expires
const cache = new Map();
// In-flight promise dedup : when two callers ask for the same (sessionId, kind,
// lang) simultaneously (e.g. user taps séance → prefetch starts, then the
// VideoPlayer mounts and asks for the same URL), we share the pending Promise
// instead of firing a second sign-video-url request.
const inflight = new Map();

export function buildSessionId(pilierKey, seanceIndex) {
  if (!pilierKey || seanceIndex == null) return null;
  return `${pilierKey}_${seanceIndex}`;
}

function cacheKey(sessionId, kind, lang, quality) {
  const base = lang ? `${sessionId}|${kind}|${lang}` : `${sessionId}|${kind}`;
  return quality ? `${base}|${quality}` : base;
}

// `quality` (optionnel) : 'eco' | 'standard' | 'hd'. L'edge function
// sign-video-url peut adapter le bunny_path (variant 480p/720p/1080p) si
// les variants sont publiés ; sinon elle renvoie l'URL standard pour
// toutes les qualités (l'UI marche, le backend suivra).
export async function getSignedVideoUrl(sessionId, kind = 'mp4', lang, quality) {
  if (!sessionId) throw new Error('sessionId required');
  if (!supabase) throw new Error('Supabase non configuré');

  const key = cacheKey(sessionId, kind, lang, quality);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt - SAFETY_MARGIN_MS > now) return cached.url;

  // Coalesce duplicate concurrent calls
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('not-signed-in');

    function callSign(accessToken) {
      const body = { session_id: sessionId, kind, lang };
      if (quality) body.quality = quality;
      return supabase.functions.invoke('sign-video-url', {
        body: body,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }

    let { data, error } = await callSign(session.access_token);

    // JWT expiré (fréquent sur Apple TV restée idle : autoRefresh ne tourne
    // pas toujours). On rafraîchit la session une fois puis on retente.
    const status = error && (error.context?.status || error.status);
    const looksAuth = error && (status === 401 || /jwt|expired|unauthor|unauthenticated/i.test(error.message || ''));
    if (looksAuth) {
      try {
        const refreshed = await supabase.auth.refreshSession();
        const newToken = refreshed && refreshed.data && refreshed.data.session && refreshed.data.session.access_token;
        if (newToken) {
          const retry = await callSign(newToken);
          data = retry.data;
          error = retry.error;
        }
      } catch (e) { /* on garde l'erreur d'origine */ }
    }

    if (error) {
      const err = new Error(error.message || 'sign-video-url-failed');
      err.status = error.context?.status || error.status;
      throw err;
    }
    const { url, expires } = data || {};
    if (!url || !expires) throw new Error('invalid-sign-response');

    cache.set(key, { url, expiresAt: expires * 1000 });
    return url;
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

/**
 * Kick off the sign-video-url request without awaiting — typically called on
 * the tap that will navigate to the VideoPlayer, so by the time the modal
 * finishes its open animation the URL is already cached (or close to ready).
 *
 * Failures are swallowed silently: the real VideoPlayer call will retry and
 * surface the error to the user there.
 */
export function prefetchSignedVideoUrl(sessionId, kind = 'mp4', lang) {
  if (!sessionId) return;
  getSignedVideoUrl(sessionId, kind, lang).catch(() => {});
}

export function clearVideoUrlCache(sessionId) {
  if (!sessionId) { cache.clear(); return; }
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(`${sessionId}|`)) cache.delete(k);
  }
}
