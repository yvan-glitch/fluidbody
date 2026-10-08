// Connexion Google via Supabase OAuth (navigateur sécurisé iOS, ASWebAuthenticationSession).
// Prérequis : fournisseur Google activé dans Supabase + « fluidbody://auth-callback »
// ajouté dans Authentication → URL Configuration → Redirect URLs.
let WebBrowser = null;
try { WebBrowser = require('expo-web-browser'); } catch (e) {}

export const GOOGLE_REDIRECT_URL = 'fluidbody://auth-callback';

function parseParams(url) {
  const out = {};
  const parts = [];
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  if (q !== -1) parts.push(url.slice(q + 1, h !== -1 && h > q ? h : undefined));
  if (h !== -1) parts.push(url.slice(h + 1));
  parts.join('&').split('&').forEach(function (kv) {
    if (!kv) return;
    const i = kv.indexOf('=');
    const k = decodeURIComponent(i === -1 ? kv : kv.slice(0, i));
    const v = i === -1 ? '' : decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
    out[k] = v;
  });
  return out;
}

// Retourne { ok: true, user } | { cancelled: true } | { error: string }
export async function signInWithGoogle(supabase) {
  if (!supabase) return { error: 'Supabase indisponible.' };
  if (!WebBrowser) return { error: 'Module expo-web-browser non chargé.' };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: GOOGLE_REDIRECT_URL,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) return { error: error.message };
  if (!data || !data.url) return { error: 'URL Google introuvable.' };

  const res = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT_URL, { preferEphemeralSession: false });
  if (res.type !== 'success' || !res.url) return { cancelled: true };

  const p = parseParams(res.url);
  if (p.error || p.error_description) return { error: p.error_description || p.error };

  if (p.code) {
    const { data: s, error: e2 } = await supabase.auth.exchangeCodeForSession(p.code);
    if (e2) return { error: e2.message };
    return { ok: true, user: s && s.user };
  }
  if (p.access_token && p.refresh_token) {
    const { data: s, error: e2 } = await supabase.auth.setSession({ access_token: p.access_token, refresh_token: p.refresh_token });
    if (e2) return { error: e2.message };
    return { ok: true, user: s && s.user };
  }
  return { error: 'Réponse Google incomplète.' };
}
