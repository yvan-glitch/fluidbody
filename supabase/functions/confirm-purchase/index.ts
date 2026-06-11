// confirm-purchase — server-side purchase verification (audit 2026-06-10, C-1/C-2).
//
// Avant : le client appelait directement la RPC credit_referral_on_first_paid
// sans aucune preuve de paiement, et RIEN ne peuplait profiles.is_subscriber /
// rc_app_user_id (le flag dont dépend le flux tvOS et le 2e niveau
// d'entitlement de sign-video-url).
//
// Maintenant :
//   client → POST /confirm-purchase  { rc_app_user_id }
//          with Authorization: Bearer <user_jwt>
//   1. verify the JWT → resolve auth.users row
//   2. hit the RevenueCat REST API (secret key, server-side) for that
//      rc_app_user_id → confirm the entitlement is genuinely active
//   3. service-role write: profiles.is_subscriber / subscription_expires_at /
//      rc_app_user_id  (colonnes verrouillées contre l'écriture client par la
//      migration 20260610100000_security_lockdown.sql)
//   4. service-role rpc: credit_referral_on_first_paid(p_user) — idempotent
//
// Appelé par le client après purchasePackage / restorePurchases (best-effort,
// fire-and-forget). Idempotent : safe à rappeler à chaque achat/restore.
//
// Env (function secrets) : REVENUECAT_SECRET_API_KEY (requis ici),
// REVENUECAT_ENTITLEMENT_ID (optionnel, défaut "Fluidbody Pilates Pro").

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const REVENUECAT_SECRET_API_KEY =
  Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";
const REVENUECAT_ENTITLEMENT_ID =
  Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "Fluidbody Pilates Pro";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

type RcEntitlement = { active: boolean; expiresAt: string | null };

async function fetchRcEntitlement(
  rcAppUserId: string,
): Promise<RcEntitlement | null> {
  try {
    const res = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(rcAppUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${REVENUECAT_SECRET_API_KEY}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) return null;
    const body = await res.json();
    const ent = body?.subscriber?.entitlements?.[REVENUECAT_ENTITLEMENT_ID];
    if (!ent) return { active: false, expiresAt: null };
    const expiresMs = ent.expires_date ? Date.parse(ent.expires_date) : 0;
    const active = expiresMs === 0 || expiresMs > Date.now();
    return { active, expiresAt: ent.expires_date ?? null };
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json({ error: "method-not-allowed" }, 405);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "server-not-configured" }, 500);
  }
  if (!REVENUECAT_SECRET_API_KEY) {
    return json({ error: "server-not-configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  let body: { rc_app_user_id?: string } = {};
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: "bad-request" }, 400);
  }
  const rcAppUserId = (body.rc_app_user_id || "").trim();
  // RC app user IDs: soit l'ID anonyme `$RCAnonymousID:<hex>`, soit un ID
  // custom. Validation laxiste mais bornée.
  if (!rcAppUserId || rcAppUserId.length > 128) {
    return json({ error: "bad-rc-app-user-id" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (userErr || !user) return json({ error: "unauthenticated" }, 401);

  // Anti-détournement : si ce rc_app_user_id est déjà lié à un AUTRE profil,
  // on refuse — sinon un user pourrait revendiquer l'abonnement d'un tiers
  // dont il connaît l'ID RC. `.limit(1)` (et pas .maybeSingle()) : si jamais
  // plusieurs lignes partageaient le même ID, maybeSingle() renverrait une
  // erreur et le check serait silencieusement bypassé.
  // Limite connue : premier arrivé, premier lié. Si un abonné se fait
  // "voler" son ID RC avant de l'avoir lié, il verra rc-id-already-bound —
  // déliage manuel côté support (TODO : webhook RC + alias app_user_id=uid).
  const { data: existingRows, error: existErr } = await admin
    .from("profiles")
    .select("id")
    .eq("rc_app_user_id", rcAppUserId)
    .neq("id", user.id)
    .limit(1);
  if (existErr) return json({ error: "lookup-failed" }, 500);
  if (existingRows && existingRows.length > 0) {
    return json({ error: "rc-id-already-bound" }, 409);
  }

  // Vérification du paiement à la source : API RevenueCat, clé secrète.
  const ent = await fetchRcEntitlement(rcAppUserId);
  if (!ent) return json({ error: "rc-unreachable" }, 502);
  if (!ent.active) return json({ error: "not-entitled" }, 403);

  // Écriture server-side des colonnes verrouillées.
  const { error: upErr } = await admin
    .from("profiles")
    .upsert({
      id: user.id,
      is_subscriber: true,
      subscription_expires_at: ent.expiresAt,
      rc_app_user_id: rcAppUserId,
      updated_at: new Date().toISOString(),
    });
  if (upErr) return json({ error: "profile-update-failed" }, 500);

  // Crédit parrainage (idempotent — no-op si déjà crédité).
  let referral: unknown = null;
  const { data: rpcData, error: rpcErr } = await admin.rpc(
    "credit_referral_on_first_paid",
    { p_user: user.id },
  );
  if (!rpcErr) referral = rpcData;

  return json({
    ok: true,
    is_subscriber: true,
    subscription_expires_at: ent.expiresAt,
    referral,
  });
});
