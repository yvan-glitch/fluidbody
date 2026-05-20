// Client helper pour le flux de pairing Apple TV ↔ iPhone.
//
// Trois actions exposées :
//   - initPairing()      : appelée par la TV au mount du TVLoginScreen.
//                          Retourne { nonce, tv_secret, expires_at, qr_payload }.
//   - pollPairing(...)   : appelée par la TV toutes les 2 s.
//   - redeemPairing(...) : appelée par l'iPhone après scan du QR.
//
// On ne dépend pas de `supabase.functions.invoke` pour les actions
// anonymes (init/poll) parce qu'elles n'ont pas besoin d'un JWT, et
// `invoke` essaie systématiquement d'attacher le token de session — ce
// qui rend l'init impossible sur la TV non logguée. On fait du fetch
// direct contre l'URL de la fonction, avec la clé anon en header.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

function functionUrl(name) {
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL not configured');
  // Format standard Supabase Edge Functions :
  // https://<ref>.supabase.co/functions/v1/<name>
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${name}`;
}

async function callTvPair(body, extraHeaders) {
  const headers = {
    'content-type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: extraHeaders?.Authorization || `Bearer ${SUPABASE_ANON_KEY}`,
    ...(extraHeaders || {}),
  };
  const res = await fetch(functionUrl('tv-pair'), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch (_) { json = null; }
  if (!res.ok) {
    const err = new Error(json?.error || `tv-pair-${res.status}`);
    err.status = res.status;
    err.detail = json?.detail;
    throw err;
  }
  return json || {};
}

export async function initPairing() {
  const data = await callTvPair({ action: 'init' });
  // qr_payload : ce qu'on encode dans le QR code. Format JSON compact
  // pour rester court (< 200 chars), parsable côté iPhone même hors
  // d'un deep link Universal Link. Si on veut un deep link plus tard,
  // on pourra wrapper ça dans fluidbody://tv-pair?n=<nonce>.
  const qrPayload = JSON.stringify({
    v: 1,
    kind: 'fluidbody-tv-pair',
    nonce: data.nonce,
  });
  return {
    nonce: data.nonce,
    tv_secret: data.tv_secret,
    expires_at: data.expires_at,
    ttl_seconds: data.ttl_seconds,
    qr_payload: qrPayload,
  };
}

export async function pollPairing({ nonce, tv_secret }) {
  const data = await callTvPair({ action: 'poll', nonce, tv_secret });
  return data; // { status: 'pending' } | { status: 'ready', access_token, refresh_token, user_id }
}

// Appelé depuis l'iPhone : on prend le JWT actuel + le refresh token
// d'une session Supabase déjà existante (l'utilisateur est loggué) et
// on les pousse à la TV via redeem.
export async function redeemPairing({ nonce, access_token, refresh_token }) {
  if (!access_token) throw new Error('missing-access-token');
  if (!refresh_token) throw new Error('missing-refresh-token');
  return callTvPair(
    { action: 'redeem', nonce, refresh_token },
    { Authorization: `Bearer ${access_token}` },
  );
}

// Tente de parser un QR scanné. Retourne le nonce si reconnu, sinon
// null. Tolère un format texte brut "FLUIDBODY:<nonce>" pour le mode
// dégradé (saisie manuelle du code).
export function parsePairingPayload(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Format JSON officiel
  if (s.startsWith('{')) {
    try {
      const obj = JSON.parse(s);
      if (obj && obj.kind === 'fluidbody-tv-pair' && typeof obj.nonce === 'string') {
        return obj.nonce.trim() || null;
      }
    } catch (_) {}
  }

  // Format texte (saisie manuelle / SMS) "FLUIDBODY:<nonce>"
  if (/^FLUIDBODY[: -]/i.test(s)) {
    const m = s.match(/^FLUIDBODY[: -]\s*([A-Z0-9]{8,16})/i);
    if (m) return m[1].toUpperCase();
  }

  // Just the bare nonce, with format check (12 alphanum chars, no I/O/0/1)
  if (/^[A-HJ-NP-Z2-9]{12}$/i.test(s)) return s.toUpperCase();

  return null;
}
