# Apple TV ↔ iPhone — Protocole de pairing QR

> Branche `claude/flamboyant-franklin-ee2a5f` · Phase 2 · 2026-05-18
> Source : `supabase/functions/tv-pair/index.ts`, `src/utils/tvPair.js`,
> `src/screens/TVLoginScreen.js`, `src/screens/PairAppleTV.js`,
> migration `supabase/migrations/20260518000000_tv_pairings.sql`.

## Pourquoi ce protocole

L'Apple TV n'a pas de clavier ergonomique (la Siri Remote oblige à
taper lettre par lettre via un picker). On veut éviter à l'utilisateur :

- de retaper son email Supabase,
- d'attendre / cliquer dans un magic link,
- de devoir tester un mot de passe.

Idée : déléguer l'auth à l'iPhone (déjà loggué). La TV affiche un QR
code, l'utilisateur le scanne depuis l'app iPhone, l'iPhone pousse ses
tokens Supabase à la TV via une fonction edge.

C'est le même principe que Netflix / Disney+ / Spotify TV.

## Vue d'ensemble

```
┌────────────┐                  ┌───────────────────┐                 ┌────────────┐
│  Apple TV  │                  │ Edge: tv-pair     │                 │  iPhone    │
│ (anonyme)  │                  │ (service_role)    │                 │ (loggué)   │
└─────┬──────┘                  └─────────┬─────────┘                 └─────┬──────┘
      │                                   │                                 │
      │  POST {action:init}               │                                 │
      ├──────────────────────────────────▶│                                 │
      │                                   │ INSERT tv_pairings              │
      │                                   │ (nonce, tv_secret, expires_at)  │
      │  {nonce, tv_secret, expires_at}   │                                 │
      │◀──────────────────────────────────┤                                 │
      │                                   │                                 │
      │ ┌───────────────────────────┐     │                                 │
      │ │  affiche QR code          │     │                                 │
      │ │  payload: {nonce, kind}   │     │                                 │
      │ └───────────────────────────┘     │                                 │
      │                                   │                                 │
      │                                   │            scan QR              │
      │                                   │◀────────────────────────────────┤
      │                                   │                                 │
      │                                   │   POST {action:redeem,          │
      │                                   │         nonce, refresh_token}   │
      │                                   │   Authorization: Bearer <JWT>   │
      │                                   │◀────────────────────────────────┤
      │                                   │                                 │
      │                                   │ verify JWT → user.id            │
      │                                   │ UPDATE tv_pairings              │
      │                                   │ SET redeemed_user_id, tokens    │
      │                                   │                                 │
      │  POST {action:poll, nonce,        │                                 │
      │         tv_secret} (every 2 s)    │                                 │
      ├──────────────────────────────────▶│                                 │
      │                                   │ tv_secret match? expired?       │
      │                                   │                                 │
      │ {status:'pending'} (← pas encore) │                                 │
      │◀──────────────────────────────────┤                                 │
      │  ... boucle ...                   │                                 │
      │                                   │                                 │
      │                                   │ (après redeem)                  │
      │  {status:'ready',                 │                                 │
      │   access_token, refresh_token}    │                                 │
      │◀──────────────────────────────────┤                                 │
      │                                   │ UPDATE tv_pairings              │
      │                                   │ SET consumed_at=now,            │
      │                                   │     access_token=null,          │
      │                                   │     refresh_token=null          │
      │ supabase.auth.setSession(...)     │ (anti-rejeu)                    │
      │                                   │                                 │
      ▼                                   ▼                                 ▼
   loggué                                                                loggué
```

## Acteurs

| | Apple TV | Edge function `tv-pair` | iPhone |
|---|---|---|---|
| Auth | anonyme (clé `anon`) | service_role (interne) | session Supabase loggée |
| État | nonce + tv_secret en mémoire | DB Postgres + RLS | session JWT + refresh |
| Réseau | poll 1× / 2 s | stateless, lit/écrit `tv_pairings` | 1 scan + 1 POST |

## Modèle de données

Table `tv_pairings` (cf. migration `20260518000000_tv_pairings.sql`) :

| colonne | type | description |
|---|---|---|
| `nonce` | text PK | 12 chars alphanum, généré côté edge |
| `tv_secret` | text NOT NULL | 16 chars, partagé entre TV et edge, jamais leak |
| `expires_at` | timestamptz | now() + 5 min |
| `created_at` | timestamptz | now() |
| `redeemed_user_id` | uuid FK auth.users | posé au redeem, NULL avant |
| `redeemed_at` | timestamptz | posé au redeem |
| `access_token` | text NULLABLE | posé au redeem, nulled au premier poll réussi |
| `refresh_token` | text NULLABLE | idem |
| `consumed_at` | timestamptz | posé au premier poll réussi |

**RLS** : `enable row level security` sans aucune policy → tout est
denied par défaut, seul `service_role` (utilisé par l'edge function)
peut lire/écrire. Si plus tard on veut autoriser un client à lire
directement (ex. pour un client web qui ne passe pas par l'edge), il
faudra une policy explicite. **Pas faite** pour rester strict.

## Endpoints (tous via POST sur `/functions/v1/tv-pair`)

### `action: 'init'`

- Auth : anonyme (clé `anon` Supabase).
- Body : `{ action: 'init' }`.
- Réponse 200 :
  ```json
  {
    "ok": true,
    "nonce": "ABCD2EFG3JKL",
    "tv_secret": "MNPQ4RST5VWXYZ23",
    "expires_at": "2026-05-18T14:35:00.000Z",
    "ttl_seconds": 300
  }
  ```
- Effet : INSERT dans `tv_pairings`.
- GC opportuniste : 1 appel sur 10 déclenche `purge_expired_tv_pairings()`.

### `action: 'redeem'`

- Auth : Bearer `<user_jwt>` (l'iPhone est loggué).
- Body : `{ action: 'redeem', nonce, refresh_token }`.
- Réponse 200 : `{ ok: true, user_id: '<uuid>' }`.
- Erreurs : `bad-nonce` (400), `unauthenticated` (401), `not-found`
  (404), `already-redeemed` (409), `expired` (410), `update-failed` (500).
- Effet : UPDATE `redeemed_user_id`, `redeemed_at`, `access_token`,
  `refresh_token`.

### `action: 'poll'`

- Auth : anonyme.
- Body : `{ action: 'poll', nonce, tv_secret }`.
- Réponses :
  - `200 { status: 'pending' }` — pas encore redeem.
  - `200 { status: 'ready', user_id, access_token, refresh_token }`
    — la TV consomme une seule fois.
  - `404 not-found` — nonce inconnu **ou** tv_secret invalide
    (réponse volontairement identique pour ne pas leaker).
  - `410 expired` ou `410 already-consumed`.
- Effet (status ready) : UPDATE `consumed_at = now()`, `access_token =
  null`, `refresh_token = null` (anti-rejeu).

## Sécurité — analyse rapide

| Menace | Mitigation |
|---|---|
| Attaquant photographie le QR de la TV → drain la session | Le QR contient seulement le `nonce`. Pour poll il faut aussi `tv_secret`, jamais affiché. Sans `tv_secret`, `poll` renvoie `not-found`. |
| Attaquant intercept réseau le redeem → vole les tokens | Tous les calls passent en HTTPS via supabase.co. Pas plus exposé que les autres requêtes Supabase. |
| Replay du poll après tokens consommés | `consumed_at` est posé au premier poll réussi, tokens nulled. Réponse suivante : `already-consumed`. |
| Brute-force du nonce | Nonce 12 chars alphabet 32 = ~2^60 ≈ 10^18. Rate-limit (TODO post-MVP) : N tentatives/IP/min. Pour l'instant on s'appuie sur l'unicité + TTL court. |
| iPhone compromis pousse n'importe quel JWT | L'edge vérifie le JWT via `supabase.auth.getUser(jwt)` → si le JWT est invalide ou expiré, redeem échoue. |
| Dénégation de service par flood `init` | TTL court + GC opportuniste + purge cron (à wiring). Table reste petite. |
| Race condition : 2 polls simultanés consomment tokens | Postgres update atomique sur PK ; le second poll trouve `consumed_at != null` → renvoie `already-consumed`. **TV side, voir TODO**. |

### TODOs sécurité post-MVP

- [ ] Rate-limit côté edge (`Deno KV` ou `tv_pairings.last_poll_at`)
      pour empêcher poll > 1 / sec / nonce.
- [ ] `pg_cron` quotidien sur `purge_expired_tv_pairings()` pour
      garder la table petite indépendamment du trafic.
- [ ] Audit log : trace les redeems suspects (même IP, plusieurs
      nonces, …) — utile si on voit du brute-force.

## Fallback : saisie manuelle du code

La TV affiche le `nonce` formaté en groupes de 4 sous le QR code
(`ABCD EFGH JKLM`). Sur l'iPhone, l'écran `PairAppleTV` propose une
saisie manuelle de ce code si le scanner ne marche pas (permission
caméra refusée, lentille sale, etc.). Le code parsé passe par
`parsePairingPayload()` qui accepte :

- JSON officiel `{"v":1,"kind":"fluidbody-tv-pair","nonce":"…"}`.
- Format texte `FLUIDBODY:ABCDEFGH...` (utile pour partage SMS).
- Nonce brut 12 chars alphanum.

## TTL et expérience utilisateur

- **5 min serveur** : choix arbitraire. Suffisant pour ouvrir l'app
  iPhone, scanner, valider. Pas trop long pour qu'un QR abandonné
  reste pollable.
- **6 min côté TV** : la TV arrête de poll au bout de 6 min
  (`HARD_TIMEOUT_MS`) — sécurité côté client si l'edge ne renvoie
  jamais `410 expired` à temps. L'utilisateur voit alors l'état
  "code expiré" avec un bouton Réessayer focusable.

## Variables d'environnement

Côté Supabase Edge Functions (`supabase functions secrets set ...`) :

| nom | défaut | utilisation |
|---|---|---|
| `SUPABASE_URL` | (auto) | client admin |
| `SUPABASE_SERVICE_ROLE_KEY` | (auto) | bypass RLS sur `tv_pairings` |
| `TV_PAIRING_TTL_SECONDS` | `300` | TTL de chaque nonce |

Côté app (déjà set pour `sign-video-url`) :

| nom | utilisation |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | base URL des edge functions |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | header `apikey` |

## Déploiement

```bash
# 1. push la migration
supabase db push   # crée tv_pairings + purge_expired_tv_pairings

# 2. deploy l'edge function
supabase functions deploy tv-pair

# 3. (optionnel) cron quotidien GC
psql -c "SELECT cron.schedule('tv_pairings_gc','0 4 * * *', \$\$ SELECT public.purge_expired_tv_pairings(); \$\$);"
```
