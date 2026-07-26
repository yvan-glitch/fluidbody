// Apple TV pairing — flow QR code.
//
// La TV (sans clavier) appelle cette fonction pour orchestrer son login :
//
//   1) action=init  (anon, depuis la TV)
//      → la fonction génère { nonce, tv_secret, expires_at }, écrit la
//        ligne dans `tv_pairings`, retourne ces valeurs. La TV affiche un
//        QR code qui encode `{ nonce, url }` (cf. TVLoginScreen.js).
//
//   2) action=redeem  (depuis l'iPhone loggué, JWT requis)
//      → l'iPhone scanne le QR, envoie { nonce, jwt }. La fonction
//        vérifie le JWT, récupère access_token + refresh_token de la
//        session (via supabase.auth.getSession() côté iPhone), pose-les
//        sur la ligne `tv_pairings`.
//
//   3) action=poll  (anon, depuis la TV, toutes les 2 s)
//      → la TV envoie { nonce, tv_secret }. Si la ligne contient des
//        tokens, la fonction les retourne UNE FOIS et les efface
//        (consumed_at posé, tokens nulled — anti-rejeu). La TV appelle
//        ensuite `supabase.auth.setSession(...)` localement.
//
// Sécurité :
//   - tv_secret : 16 chars connus seulement de la TV, vérifié au poll.
//     Empêche qu'un attaquant ayant intercepté le nonce (ex: photo du QR
//     code) puisse drainer la session avant la TV légitime.
//   - Anti-rejeu : tokens nulled au premier poll réussi.
//   - Rate-limit poll : 1 req/sec/nonce (vérif `last_poll_at` lazy,
//     migration 20260610100500). Réponse 429, la TV retente au tick
//     suivant (intervalle 2 s > 1 s, donc jamais throttlée en usage normal).
//   - TTL strict 5 min : `expires_at` posé à l'init.
//
// Limite assumée (audit 2026-06-10 E-5) : le redeem n'exige QUE le nonce +
// un JWT valide — c'est inhérent au design, l'iPhone ne connaît que le
// contenu du QR, et mettre le tv_secret dans le QR détruirait la protection
// du poll contre les photos du QR. Conséquence : quiconque photographie le
// QR pendant ses 5 min de vie peut redeem AVANT le téléphone légitime, avec
// SON propre compte — la TV se loggue alors sur le compte de l'attaquant
// (confusion/déni, pas de vol de session : le poll reste protégé par le
// secret). Mitigations en place : TTL 5 min, redeem one-shot
// (already-redeemed 409), contexte physique (QR affiché dans le salon).
//
// La fonction utilise SERVICE_ROLE pour bypass RLS de `tv_pairings` (la
// table est verrouillée par défaut, cf. migration).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PAIRING_TTL_SECONDS = parseInt(
  Deno.env.get("TV_PAIRING_TTL_SECONDS") ?? "300", // 5 min
  10,
);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // pas de I/O/0/1
function randomCode(length: number): string {
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[arr[i] % ALPHABET.length];
  return out;
}

function admin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function purgeExpired(): Promise<void> {
  try {
    await admin().rpc("purge_expired_tv_pairings");
  } catch (_) {
    // best-effort, n'interrompt jamais une req utilisateur
  }
}

async function handleInit(): Promise<Response> {
  // GC opportuniste à chaque init (audit 26/07 : avant 1 fois sur 10, trop
  // rare avec le faible trafic pour purger les tokens dormants à temps).
  // Fire-and-forget, n'ajoute pas de latence à la réponse.
  purgeExpired();

  const nonce = randomCode(12);
  const tv_secret = randomCode(16);
  const expiresAt = new Date(Date.now() + PAIRING_TTL_SECONDS * 1000);

  const { error } = await admin()
    .from("tv_pairings")
    .insert({
      nonce,
      tv_secret,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    // Audit 26/07 : pas de error.message vers un appelant anonyme (fuite
    // d'infos de schéma Postgres).
    return json({ error: "init-failed" }, 500);
  }

  return json({
    ok: true,
    nonce,
    tv_secret,
    expires_at: expiresAt.toISOString(),
    ttl_seconds: PAIRING_TTL_SECONDS,
  });
}

async function handleRedeem(req: Request, body: {
  nonce?: string;
}): Promise<Response> {
  const nonce = (body.nonce || "").trim();
  if (!nonce || nonce.length < 8) {
    return json({ error: "bad-nonce" }, 400);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  // Le client iPhone envoie son session JWT (access_token) ET son
  // refresh_token dans le body (lu plus bas) pour qu'on les pousse à
  // la TV. On vérifie d'abord la validité du JWT côté serveur.
  const adminClient = admin();
  const { data: userRes, error: userErr } = await adminClient.auth.getUser(jwt);
  if (userErr || !userRes?.user) return json({ error: "unauthenticated" }, 401);
  const user = userRes.user;

  // Body contient { nonce, refresh_token }.
  const refreshToken = typeof (body as { refresh_token?: string }).refresh_token === "string"
    ? (body as { refresh_token: string }).refresh_token.trim()
    : "";
  if (!refreshToken) return json({ error: "missing-refresh-token" }, 400);

  // Vérifier que la ligne existe + n'est pas expirée + pas déjà redeemée.
  const { data: pairing, error: lookupErr } = await adminClient
    .from("tv_pairings")
    .select("nonce, expires_at, redeemed_user_id")
    .eq("nonce", nonce)
    .maybeSingle();
  if (lookupErr) return json({ error: "lookup-failed" }, 500);
  if (!pairing) return json({ error: "not-found" }, 404);
  if (new Date(pairing.expires_at).getTime() < Date.now()) {
    return json({ error: "expired" }, 410);
  }
  if (pairing.redeemed_user_id) {
    return json({ error: "already-redeemed" }, 409);
  }

  const { error: updErr } = await adminClient
    .from("tv_pairings")
    .update({
      redeemed_user_id: user.id,
      redeemed_at: new Date().toISOString(),
      access_token: jwt,
      refresh_token: refreshToken,
    })
    .eq("nonce", nonce);
  if (updErr) return json({ error: "update-failed" }, 500);

  return json({ ok: true, user_id: user.id });
}

async function handlePoll(body: {
  nonce?: string;
  tv_secret?: string;
}): Promise<Response> {
  const nonce = (body.nonce || "").trim();
  const tvSecret = (body.tv_secret || "").trim();
  if (!nonce || !tvSecret) return json({ error: "bad-request" }, 400);

  const adminClient = admin();
  const { data: pairing, error: lookupErr } = await adminClient
    .from("tv_pairings")
    .select(
      "nonce, tv_secret, expires_at, redeemed_user_id, access_token, refresh_token, consumed_at, last_poll_at",
    )
    .eq("nonce", nonce)
    .maybeSingle();
  if (lookupErr) return json({ error: "lookup-failed" }, 500);
  if (!pairing) return json({ error: "not-found" }, 404);

  // Secret check EN PREMIER : on ne révèle PAS la cause précise pour
  // éviter de dire à un attaquant "bon nonce, mauvais secret" — même
  // réponse que not-found. Et surtout, le rate-limit n'est stampé QU'APRÈS
  // un secret valide : sinon un attaquant qui ne connaît que le nonce
  // (photo du QR) pourrait poller à 1 Hz et maintenir la TV légitime en
  // 429 permanent (DoS du pairing).
  if (pairing.tv_secret !== tvSecret) {
    return json({ error: "not-found" }, 404);
  }

  // Rate-limit lazy : 1 poll/s/nonce. La TV polle toutes les 2 s, donc un
  // client légitime n'est jamais throttlé ; seules les requêtes au secret
  // valide comptent dans la fenêtre (cf. ci-dessus).
  const lastPollMs = pairing.last_poll_at ? Date.parse(pairing.last_poll_at) : 0;
  if (lastPollMs && Date.now() - lastPollMs < 1000) {
    return json({ error: "too-many-requests" }, 429);
  }
  await adminClient
    .from("tv_pairings")
    .update({ last_poll_at: new Date().toISOString() })
    .eq("nonce", nonce);

  if (new Date(pairing.expires_at).getTime() < Date.now()) {
    // Audit 26/07 : nuller les tokens dès l'expiration. Sans ça, si la TV
    // ne repollait jamais ensuite (crash, réseau), un refresh_token longue
    // durée pouvait dormir en clair dans la table jusqu'à la purge.
    if (pairing.access_token || pairing.refresh_token) {
      await adminClient
        .from("tv_pairings")
        .update({ access_token: null, refresh_token: null })
        .eq("nonce", nonce);
    }
    return json({ error: "expired" }, 410);
  }

  // Encore en attente
  if (!pairing.redeemed_user_id || !pairing.access_token) {
    return json({ ok: true, status: "pending" });
  }

  // Déjà consommé : la TV doit faire un nouvel init si elle a perdu
  // les tokens entre-temps.
  if (pairing.consumed_at) {
    return json({ error: "already-consumed" }, 410);
  }

  // Premier poll réussi : on retourne les tokens et on les efface.
  const { error: consumeErr } = await adminClient
    .from("tv_pairings")
    .update({
      consumed_at: new Date().toISOString(),
      access_token: null,
      refresh_token: null,
    })
    .eq("nonce", nonce);
  if (consumeErr) return json({ error: "consume-failed" }, 500);

  // Audit 26/07 : la TV affiche une confirmation « Se connecter comme
  // {prenom} ? » avant d'activer la session — contre le scénario où un
  // tiers photographie le QR et appaire la TV sur SON compte. On joint
  // donc le prénom du compte redeemé (best-effort, null si absent).
  let prenom: string | null = null;
  try {
    const { data: prof } = await adminClient
      .from("profiles")
      .select("prenom")
      .eq("id", pairing.redeemed_user_id)
      .maybeSingle();
    prenom = prof?.prenom ?? null;
  } catch (_) {
    // best-effort
  }

  return json({
    ok: true,
    status: "ready",
    user_id: pairing.redeemed_user_id,
    prenom,
    access_token: pairing.access_token,
    refresh_token: pairing.refresh_token,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json({ error: "method-not-allowed" }, 405);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "server-not-configured" }, 500);
  }

  let body: { action?: string; nonce?: string; tv_secret?: string; refresh_token?: string } = {};
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: "bad-request" }, 400);
  }
  const action = body.action;

  if (action === "init") return handleInit();
  if (action === "redeem") return handleRedeem(req, body);
  if (action === "poll") return handlePoll(body);
  return json({ error: "unknown-action" }, 400);
});
