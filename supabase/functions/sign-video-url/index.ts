// Signs Bunny CDN URLs for authenticated, subscribed users.
//
// Flow:
//   client → POST /sign-video-url  { session_id, kind, lang? }
//          with Authorization: Bearer <user_jwt>
//   1. verify the JWT → resolve auth.users row
//   2. look up `video_assets.bunny_path` for `session_id`
//   3. confirm entitlement (admin allowlist → profiles.is_subscriber →
//      optional live RevenueCat hit if profiles.rc_app_user_id is set)
//   4. mint a Bunny Token-Auth URL with a short TTL and return it
//
// The Bunny token-auth host (the pull-zone CNAME) and the secret token key are
// configured via env vars; nothing about the secret leaves the function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const BUNNY_TOKEN_KEY = Deno.env.get("BUNNY_TOKEN_KEY") ?? "";
const BUNNY_PULL_ZONE_HOST =
  Deno.env.get("BUNNY_PULL_ZONE_HOST") ?? "vz-1a4e2cac-0dc.b-cdn.net";
const SIGNED_URL_TTL_SECONDS = parseInt(
  Deno.env.get("SIGNED_URL_TTL_SECONDS") ?? "1800",
  10,
);
const REVENUECAT_SECRET_API_KEY =
  Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";
const REVENUECAT_ENTITLEMENT_ID =
  Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "Fluidbody Pilates Pro";
const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Kind = "hls" | "mp4" | "vtt";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

function b64UrlSafeNoPad(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
    .replace(/\n/g, "");
}

async function signBunnyUrl(
  host: string,
  path: string,
  tokenKey: string,
  ttlSeconds: number,
): Promise<{ url: string; expires: number }> {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const input = tokenKey + path + expires;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  const token = b64UrlSafeNoPad(new Uint8Array(digest));
  return {
    url: `https://${host}${path}?token=${token}&expires=${expires}`,
    expires,
  };
}

type Quality = "eco" | "standard" | "hd";

// Variant Bunny par qualité — actuellement seul "standard" (720p) est
// publié pour toutes les séances. Quand Yvan publiera les 480p/1080p,
// décommenter les variants correspondants. Tant qu'ils ne sont pas
// publiés, on retombe sur 720p pour les 3 qualités — l'UI marche, le
// fichier livré est juste le même.
function mp4FileForQuality(quality?: Quality): string {
  // if (quality === "eco") return "play_480p.mp4";
  // if (quality === "hd") return "play_1080p.mp4";
  return "play_720p.mp4";
}

function pathForKind(bunnyPath: string, kind: Kind, lang?: string, quality?: Quality): string {
  const base = `/${bunnyPath.replace(/^\/+|\/+$/g, "")}`;
  if (kind === "mp4") return `${base}/${mp4FileForQuality(quality)}`;
  if (kind === "vtt") {
    const l = (lang || "fr").replace(/[^a-z]/gi, "").toLowerCase() || "fr";
    return `${base}/subtitles/${l}.vtt`;
  }
  return `${base}/playlist.m3u8`;
}

async function isEntitledViaRevenueCat(rcAppUserId: string): Promise<boolean> {
  if (!REVENUECAT_SECRET_API_KEY || !rcAppUserId) return false;
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
    if (!res.ok) return false;
    const body = await res.json();
    const ent = body?.subscriber?.entitlements?.[REVENUECAT_ENTITLEMENT_ID];
    const expires = ent?.expires_date ? Date.parse(ent.expires_date) : 0;
    return !!ent && (expires === 0 || expires > Date.now());
  } catch (_) {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json({ error: "method-not-allowed" }, 405);

  if (!BUNNY_TOKEN_KEY) return json({ error: "server-not-configured" }, 500);
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "server-not-configured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!jwt) return json({ error: "unauthenticated" }, 401);

  let body: { session_id?: string; kind?: Kind; lang?: string; quality?: Quality } = {};
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: "bad-request" }, 400);
  }
  const sessionId = (body.session_id || "").trim();
  const kind: Kind =
    body.kind === "hls" || body.kind === "vtt" ? body.kind : "mp4";
  const lang = typeof body.lang === "string" ? body.lang : undefined;
  const quality: Quality | undefined =
    body.quality === "eco" || body.quality === "standard" || body.quality === "hd"
      ? body.quality
      : undefined;
  if (!/^[a-z0-9]+_\d+$/i.test(sessionId)) {
    return json({ error: "bad-session-id" }, 400);
  }

  // Service-role client: we trust its results, never expose its key downstream.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve the caller from the JWT.
  const { data: userRes, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userRes?.user) return json({ error: "unauthenticated" }, 401);
  const user = userRes.user;

  // Asset lookup. Anything not in the table is "not a real video".
  const { data: asset, error: assetErr } = await admin
    .from("video_assets")
    .select("bunny_path")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (assetErr) return json({ error: "lookup-failed" }, 500);
  if (!asset?.bunny_path) return json({ error: "not-found" }, 404);

  // Séance 1 (index 0) gratuite pour TOUS — miroir de canAccessSeanceIndex côté
  // app (« séance 1 gratuite pour tous »). Sans ça, un utilisateur non abonné
  // se voit refuser la séance d'essai → vidéo « indisponible ».
  // + Sélection gratuite du mois (2 vidéos) — miroir de FREE_MONTHLY_SELECTION
  // dans src/constants/data.js. Garder les deux listes synchronisées.
  const FREE_MONTHLY_IDS = new Set(["p2_0", "p7_10"]);
  // + Théorie (étapes Comprendre/Ressentir) gratuite pour tous — décision
  // produit du 26/07 : aligne le serveur sur canAccessSeanceIndex (le client
  // affichait la théorie déverrouillée mais le serveur répondait 403).
  // Liste générée depuis SEANCES_FR (étape en position 2 du tuple) ; à
  // régénérer si la structure du catalogue change :
  //   node -e "voir AUDIT-SECURITE-2026-07-26.md" — aujourd'hui ce sont les
  //   indices 0-4 de chaque pilier p1..p9.
  const FREE_THEORY_IDS = new Set([
    "p1_0","p1_1","p1_2","p1_3","p1_4",
    "p2_0","p2_1","p2_2","p2_3","p2_4",
    "p3_0","p3_1","p3_2","p3_3","p3_4",
    "p4_0","p4_1","p4_2","p4_3","p4_4",
    "p5_0","p5_1","p5_2","p5_3","p5_4",
    "p6_0","p6_1","p6_2","p6_3","p6_4",
    "p7_0","p7_1","p7_2","p7_3","p7_4",
    "p8_0","p8_1","p8_2","p8_3","p8_4",
    "p9_0","p9_1","p9_2","p9_3","p9_4",
  ]);
  const seanceIdx = parseInt(sessionId.split("_").pop() || "", 10);
  const isFreeSeance = seanceIdx === 0
    || FREE_MONTHLY_IDS.has(sessionId)
    || FREE_THEORY_IDS.has(sessionId);

  // Entitlement: admin email → profiles.is_subscriber → live RC fallback.
  const email = (user.email || "").toLowerCase();
  let entitled = ADMIN_EMAILS.includes(email);

  let rcAppUserId: string | null = null;
  if (!entitled) {
    const { data: profile } = await admin
      .from("profiles")
      .select("is_subscriber, subscription_expires_at, rc_app_user_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.is_subscriber) {
      const exp = profile.subscription_expires_at
        ? Date.parse(profile.subscription_expires_at)
        : 0;
      entitled = exp === 0 || exp > Date.now();
    }
    rcAppUserId = profile?.rc_app_user_id ?? null;
  }

  if (!entitled && rcAppUserId) {
    entitled = await isEntitledViaRevenueCat(rcAppUserId);
  }

  if (!entitled && !isFreeSeance) return json({ error: "not-subscribed" }, 403);

  const path = pathForKind(asset.bunny_path, kind, lang, quality);
  const signed = await signBunnyUrl(
    BUNNY_PULL_ZONE_HOST,
    path,
    BUNNY_TOKEN_KEY,
    SIGNED_URL_TTL_SECONDS,
  );

  return json({ url: signed.url, expires: signed.expires, kind });
});
