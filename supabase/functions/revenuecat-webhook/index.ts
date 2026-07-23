// revenuecat-webhook — synchronisation server-side de l'abonnement.
//
// Avant : profiles.is_subscriber n'était peuplé que par confirm-purchase,
// c'est-à-dire uniquement quand le CLIENT appelait la fonction après un achat
// ou un restore. Les renouvellements, annulations, expirations et
// remboursements qui se produisent côté stores (sans que l'app soit ouverte)
// n'étaient jamais répercutés en base.
//
// Maintenant : RevenueCat → Integrations → Webhooks pousse chaque événement
// ici, et on met à jour profiles.is_subscriber / subscription_expires_at
// (colonnes verrouillées contre l'écriture client par la migration
// 20260610100000_security_lockdown.sql — d'où le service-role).
//
// Auth : PAS de JWT Supabase (RevenueCat n'en a pas) — déployer avec
// `--no-verify-jwt`. À la place, RevenueCat permet de configurer une valeur
// custom pour le header Authorization ; on la compare au secret
// RC_WEBHOOK_AUTH. La valeur configurée dans le dashboard RC doit être
// STRICTEMENT identique au secret (préfixe "Bearer " compris, si tu en mets un).
//
// Règle d'or webhook RC : répondre 200 vite. RC retente tout non-200 avec
// backoff — un user inconnu ou un type d'événement ignoré n'est PAS une
// erreur, on répond {skipped:true} en 200. Seuls l'auth invalide (401) et la
// config serveur manquante (500) sortent du 200.
//
// Mapping des types d'événements (https://www.revenuecat.com/docs/webhooks) :
//   INITIAL_PURCHASE / RENEWAL / UNCANCELLATION / NON_RENEWING_PURCHASE
//     → is_subscriber = true + subscription_expires_at
//   CANCELLATION
//     → auto-renew désactivé, l'accès court jusqu'à l'échéance : on ne touche
//       PAS is_subscriber, on met juste à jour subscription_expires_at
//       (sign-video-url compare déjà expires_at à now, l'accès tombera seul)
//   BILLING_ISSUE
//     → grace period : accès conservé jusqu'à l'échéance, même traitement
//   PRODUCT_CHANGE
//     → changement de plan : on met à jour l'échéance
//   EXPIRATION
//     → is_subscriber = false (remboursements inclus : RC émet une EXPIRATION
//       avec expiration immédiate après un refund)
//   Tout le reste (TEST, TRANSFER, SUBSCRIPTION_PAUSED…) → skipped.
//
// Env (function secrets) : RC_WEBHOOK_AUTH (requis).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const RC_WEBHOOK_AUTH = Deno.env.get("RC_WEBHOOK_AUTH") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type RcEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  expiration_at_ms?: number | null;
};

// expiration_at_ms → timestamptz ISO. null/absent = pas d'échéance connue
// (ex. NON_RENEWING_PURCHASE lifetime) → on stocke null, que sign-video-url
// interprète déjà comme "pas d'expiration".
function expirationIso(ev: RcEvent): string | null {
  const ms = ev.expiration_at_ms;
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method-not-allowed" }, 405);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RC_WEBHOOK_AUTH) {
    console.error("revenuecat-webhook: secrets manquants (RC_WEBHOOK_AUTH ?)");
    return json({ error: "server-not-configured" }, 500);
  }

  // Auth : comparaison stricte du header Authorization avec le secret.
  // (RC envoie la valeur telle quelle, sans convention Bearer imposée.)
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== RC_WEBHOOK_AUTH) {
    return json({ error: "unauthorized" }, 401);
  }

  let event: RcEvent | undefined;
  try {
    const body = await req.json();
    event = body?.event;
  } catch (_) {
    // Corps illisible : on ne veut pas que RC retente en boucle.
    console.error("revenuecat-webhook: body JSON invalide");
    return json({ skipped: true, reason: "bad-json" });
  }
  if (!event?.type) {
    return json({ skipped: true, reason: "no-event" });
  }

  // Décision selon le type d'événement.
  const type = event.type.toUpperCase();
  const expiresAt = expirationIso(event);
  const now = new Date().toISOString();

  let update: Record<string, unknown> | null = null;
  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE":
      update = {
        is_subscriber: true,
        subscription_expires_at: expiresAt,
        updated_at: now,
      };
      break;
    case "CANCELLATION": // auto-renew off — accès conservé jusqu'à l'échéance
    case "BILLING_ISSUE": // grace period — idem
    case "PRODUCT_CHANGE": // changement de plan — nouvelle échéance
      update = { subscription_expires_at: expiresAt, updated_at: now };
      break;
    case "EXPIRATION":
      update = {
        is_subscriber: false,
        subscription_expires_at: expiresAt,
        updated_at: now,
      };
      break;
    default:
      // TEST, TRANSFER, SUBSCRIPTION_PAUSED… : rien à écrire.
      return json({ skipped: true, reason: "ignored-event-type" });
  }

  // Candidats d'identifiants RC pour retrouver le profil : app_user_id,
  // original_app_user_id, plus le tableau aliases si présent.
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(Array.isArray(event.aliases) ? event.aliases : []),
  ].filter((v): v is string => typeof v === "string" && v.length > 0);
  const unique = [...new Set(candidates)];
  if (unique.length === 0) {
    return json({ skipped: true, reason: "no-app-user-id" });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1er essai : matcher profiles.rc_app_user_id (lié par confirm-purchase).
  let profileId: string | null = null;
  const { data: byRcId, error: rcErr } = await admin
    .from("profiles")
    .select("id")
    .in("rc_app_user_id", unique)
    .limit(1);
  if (rcErr) {
    console.error("revenuecat-webhook: lookup rc_app_user_id failed", rcErr);
  } else if (byRcId && byRcId.length > 0) {
    profileId = byRcId[0].id;
  }

  // 2e essai : si le client a fait Purchases.logIn(supaUser.id), l'app_user_id
  // RC EST l'uuid auth.users — on tente le match direct sur profiles.id.
  if (!profileId) {
    const uuids = unique.filter((v) => UUID_RE.test(v));
    if (uuids.length > 0) {
      const { data: byId, error: idErr } = await admin
        .from("profiles")
        .select("id")
        .in("id", uuids)
        .limit(1);
      if (idErr) {
        console.error("revenuecat-webhook: lookup profiles.id failed", idErr);
      } else if (byId && byId.length > 0) {
        profileId = byId[0].id;
      }
    }
  }

  // Utilisateur inconnu (ex. ID anonyme jamais lié) : pas une erreur —
  // 200 pour que RC ne retente pas.
  if (!profileId) {
    return json({ skipped: true, reason: "unknown-user" });
  }

  const { error: upErr } = await admin
    .from("profiles")
    .update(update)
    .eq("id", profileId);
  if (upErr) {
    // On log mais on répond quand même 200 : le prochain événement RC (ou un
    // confirm-purchase côté client) rattrapera l'état.
    console.error("revenuecat-webhook: update failed", upErr);
    return json({ ok: false, error: "profile-update-failed" });
  }

  return json({ ok: true, event_type: type, profile_id: profileId });
});
