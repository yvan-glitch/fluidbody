# Supabase: `sign-video-url` edge function

Mints short-lived Bunny CDN URLs for authenticated, subscribed users. The
client never sees a raw Bunny URL.

## Bunny dashboard setup (one-time)

Done in the Bunny.net dashboard — there is no CLI for this. The token key here
is the secret used in step 4; treat it like a service credential.

1. **Pull Zones → your pull zone → Security → Token Authentication → Enable**
2. (Optional, recommended) Enable **Token Authentication on Directories** so a
   single token grants the whole HLS folder. Without it the HLS player has to
   re-sign each `.ts` segment, which the current edge function does not do.
3. (Optional) Add the Supabase Edge runtime IP ranges to the **Allowed
   Referrers / IPs** allowlist for the pull zone. Supabase publishes the egress
   IPs per region. Skip this if you also serve the videos from a marketing
   site that uses the same pull zone.
4. Copy the **Token Authentication Key** from the dashboard. This is the
   `BUNNY_TOKEN_KEY` secret below.
5. (Optional) Set a max **Token Expiration Time** in the pull zone settings —
   the URLs from this function default to a 30-min TTL, so anything ≥ 1 h is
   fine.

## Required environment

Set these as Supabase function secrets, **never** as `EXPO_PUBLIC_*` (they
must not be bundled into the app):

| Name                          | Source                                 | Notes |
|-------------------------------|----------------------------------------|-------|
| `BUNNY_TOKEN_KEY`             | Bunny pull-zone dashboard              | Required. The shared secret. |
| `BUNNY_PULL_ZONE_HOST`        | e.g. `vz-1a4e2cac-0dc.b-cdn.net`       | Required. Defaults to the FluidBody pull zone but should be set explicitly. |
| `SIGNED_URL_TTL_SECONDS`      | integer, default `1800`                | Optional. 15-60 min is reasonable. |
| `REVENUECAT_SECRET_API_KEY`   | RevenueCat → Project → API keys → **Secret** | Optional. Used only if `profiles.rc_app_user_id` is populated and `profiles.is_subscriber` is false. |
| `REVENUECAT_ENTITLEMENT_ID`   | default `Fluidbody Pilates Pro`        | Optional. |
| `ADMIN_EMAILS`                | comma-separated lower-case             | Optional. Mirrors the admin allowlist in `App.js` so testers without active RC subs can still play. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
the Supabase Functions runtime.

## Deploy

```bash
# from the repo root
supabase login                       # once per machine
supabase link --project-ref <ref>    # once per repo

# secrets — only the names you actually want to set
supabase secrets set \
  BUNNY_TOKEN_KEY=...                 \
  BUNNY_PULL_ZONE_HOST=vz-1a4e2cac-0dc.b-cdn.net \
  SIGNED_URL_TTL_SECONDS=1800        \
  REVENUECAT_SECRET_API_KEY=...      \
  ADMIN_EMAILS="yvan@espace-pilates.ch,sabrina.tissot@icloud.com"

# database migration (creates video_assets + adds profiles.is_subscriber)
supabase db push

# deploy the function
supabase functions deploy sign-video-url
```

`supabase db push` applies migrations under `supabase/migrations/`. The
initial seed inserts the three videos that used to be hot-linked.

To add a new video later:

```sql
insert into public.video_assets (session_id, bunny_path)
values ('p4_0', '<bunny-library-guid>');
```

Then flag the corresponding entry in `src/constants/data.js` with `true` at
index 3.

## Subscription state

The function checks entitlement in this order, short-circuiting at the first
positive answer:

1. **Admin allowlist** (`ADMIN_EMAILS` env var) — for testers.
2. **`profiles.is_subscriber`** column — fed by a RevenueCat webhook (not yet
   wired in this repo; until then this stays `false` for everyone).
3. **Live RevenueCat lookup** if `profiles.rc_app_user_id` is set on the row.
   This call uses the **Secret** RC API key, not the public SDK key.

Anyone else gets 403. Anyone signed-out gets 401.

To turn on the webhook path: in RevenueCat → Integrations → Webhooks, send
events to a separate `revenuecat-webhook` function (TBD) that updates
`profiles.is_subscriber` and `profiles.subscription_expires_at` keyed by
`event.app_user_id`. The client must also call `Purchases.logIn(supaUser.id)`
after login so RC's app-user-id matches `auth.users.id`.
