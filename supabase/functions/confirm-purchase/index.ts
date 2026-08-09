// confirm-purchase — server-side purchase verification (audit 2026-06-10, C-1/C-2).
//
// Avant : le client appelait directement la RPC credit_referral_on_first_paid
// sans aucune preuve de paiement, et RIEN ne peuplait profiles.is_subscriber /
// rc_app_user_id (le flag dont dépend le flux tvOS et le 2e niveau
// d'entitlement de sign-video-url).
//
// Maintenant :
//   client → POST /confirm-purchase  { rc_app_user_id? }
//          with Authorization: Bearer <user_jwt>
//   1. verify the JWT → resolve auth.users row
//   2. l'ID RC vérifié/lié est TOUJOURS l'uid authentifié (le client fait
//      Purchases.logIn(uid), cf. App.js) — jamais un id libre du body. Si le
//      body porte rc_app_user_id, il DOIT égaler l'uid (audit F6/F8).
//   3. hit the RevenueCat REST API (secret key, server-side) for that uid →
//      confirm the entitlement is genuinely active
//   4. service-role write: profiles.is_subscriber / subscription_expires_at /
//      rc_app_user_id  (colonnes verrouillées contre l'écriture client par la
//      migration 20260610100000_security_lockdown.sql). Upsert atomique ;
//      l'unicité de rc_app_user_id est garantie par l'index UNIQUE partiel
//      (23505 → rc-id-already-bound).
//   5. service-role rpc: credit_referral_on_first_paid(p_user) — idempotent
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
  const bodyRcAppUserId = (body.rc_app_user_id || "").trim();

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (userErr || !user) return json({ error: "unauthenticated" }, 401);

  // Anti-détournement (audit 2026-08-08, F6/F8) : l'ID RC à vérifier et à lier
  // est TOUJOURS celui du caller authentifié (user.id du JWT vérifié), jamais
  // un id libre fourni par le client. Le client appelle Purchases.logIn(uid)
  // (cf. App.js) donc son rc_app_user_id = uid ; on l'accepte dans le body à
  // condition qu'il soit identique à l'uid, sinon on refuse (l'ancienne
  // version acceptait n'importe quel id → un attaquant soumettait l'ID RC
  // d'un tiers abonné pour se faire passer pour lui).
  const rcAppUserId = user.id;
  if (bodyRcAppUserId && bodyRcAppUserId !== rcAppUserId) {
    return json({ error: "bad-rc-app-user-id" }, 400);
  }

  // Vérification du paiement à la source : API RevenueCat, clé secrète.
  const ent = await fetchRcEntitlement(rcAppUserId);
  if (!ent) return json({ error: "rc-unreachable" }, 502);
  if (!ent.active) return json({ error: "not-entitled" }, 403);

  // Écriture server-side des colonnes verrouillées. Upsert atomique : plus de
  // pré-check read-then-write (TOCTOU). L'unicité de rc_app_user_id est
  // désormais garantie par l'index UNIQUE partiel (migration
  // 20260808000000_profiles_rc_app_user_id_unique.sql) ; une seconde liaison
  // du même id sur un autre profil échoue avec 23505 → rc-id-already-bound.
  const { error: upErr } = await admin
    .from("profiles")
    .upsert({
      id: user.id,
      is_subscriber: true,
      subscription_expires_at: ent.expiresAt,
      rc_app_user_id: rcAppUserId,
      updated_at: new Date().toISOString(),
    });
  if (upErr) {
    if ((upErr as { code?: string }).code === "23505") {
      return json({ error: "rc-id-already-bound" }, 409);
    }
    return json({ error: "profile-update-failed" }, 500);
  }

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
