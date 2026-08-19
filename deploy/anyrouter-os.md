# anyrouter-os production deploy

| Piece | Value |
|-------|--------|
| Router Worker | `anyrouter-os` |
| Backend Worker | `anyrouter-os-backend` |
| Hostname | `https://os.anyrouter.dev` |
| Account | `7df185a18b98382c3240fa7ac4a37075` |

## Redeploy

`scripts/deploy-anyrouter-os.sh` does the usual path (frontend build → backend → router),
reading credentials from `.env.local` at the repo root. Without them wrangler drops into an
interactive OAuth login, which does nothing in a non-interactive shell. Deploy the gatekeepers
by hand, as below, when they change.

```bash
export CLOUDFLARE_API_TOKEN=…   # Workers edit — or put it in .env.local
export CLOUDFLARE_ACCOUNT_ID=7df185a18b98382c3240fa7ac4a37075

# Frontend (Clerk sign-in)
cd packages/workshop-frontend && pnpm build && cd ../..

# GitHub gatekeeper (OAuth secrets live here, not on the backend)
cd packages/gatekeeper-github
pnpm run build   # builds the configurator UI, then tsc
pnpm exec wrangler deploy --config wrangler.anyrouter-os.jsonc
# printf '%s' "$GITHUB_CLIENT_ID" | pnpm exec wrangler secret put CLIENT_ID --config wrangler.anyrouter-os.jsonc
# printf '%s' "$GITHUB_CLIENT_SECRET" | pnpm exec wrangler secret put CLIENT_SECRET --config wrangler.anyrouter-os.jsonc

# MCP gatekeeper (AnyRouter prefilled via MCP_DEFAULT_ENDPOINT; any other URL still accepted)
cd ../gatekeeper-mcp
pnpm run build   # builds the configurator UI, then tsc
pnpm exec wrangler deploy --config wrangler.anyrouter-os.jsonc

# Backend
cd ../workshop-backend
pnpm exec wrangler deploy --config wrangler.anyrouter-os.jsonc
# First time / rotated secrets:
# Clerk Backend API key (sk_…) — resolves the signed-in user's email from the session token:
# printf '%s' "$CLERK_SECRET_KEY" | pnpm exec wrangler secret put CLERK_SECRET_KEY --config wrangler.anyrouter-os.jsonc
# (Model access needs no secret: ANYROUTER_OAUTH_CLIENT_ID is a public var — see below.)

# Router + custom domain
cd ../router
pnpm exec wrangler deploy --config wrangler.anyrouter-os.jsonc
```

## Auth (Clerk)

Sign-in is Clerk-only, sharing the anyrouter.dev Clerk instance
(`CLERK_PUBLISHABLE_KEY = pk_live_Y2xlcmsuYW55cm91dGVyLmRldiQ` → `clerk.anyrouter.dev`), so any
anyrouter.dev account works here. The backend verifies session JWTs against the instance JWKS and
looks up the email via the Clerk Backend API (`CLERK_SECRET_KEY` secret). The old Zero Trust
Access app for `os.anyrouter.dev` must be removed (or set to bypass) — Cloudflare Access
authentication has been removed from the backend and frontend entirely.

Model access is AnyRouter-only, via **"Sign in with AnyRouter"**: AnyRouter OS is a registered
OAuth client of anyrouter.dev. On onboarding (and in the Add Model dialog) the user approves a
one-click consent (same Clerk session, so no re-login) and the backend exchanges the code for a
key on the USER's own AnyRouter account (inference-only, billed to them, revocable from their
AnyRouter dashboard under Connected apps). Sign-in keys expire (default 30 days; per-app
`key_ttl_seconds` override up to 90 days) — the UI offers a Reconnect, and models store an empty
`apiToken` that resolves to the stored grant, so one reconnect refreshes everything. The
`CF_AI_GATEWAY*` vars were removed along with the Workers AI built-in models.

### First-party OAuth client (no registration needed)

AnyRouter OS is a **git-versioned first-party client** of AnyRouter: it is an entry in the
anyrouter repo's first-party app registry (`packages/lib/src/oauth/first-party-apps.ts`) with
the stable slug id `anyrouter-os`, app_type signin, 90-day key TTL, and redirect URI
`https://os.anyrouter.dev/anyrouter/oauth/callback`. There is no DCR curl, no admin approval,
no database row, and nothing to seed — deploying anyrouter with that registry entry is the
whole setup, and `ANYROUTER_OAUTH_CLIENT_ID` is committed as `anyrouter-os` in
`wrangler.anyrouter-os.jsonc`. Future first-party apps (AnyWorker, chmonitor, …) are one
registry line each.

Registry membership also means: immune to the stale-DCR-client sweep by construction, its
name/slug can't be squatted via open registration, and — when the browser already has a Clerk
session — the authorize endpoint auto-approves and redirects straight back with a code, so
connecting AnyRouter in the OS is fully invisible (no consent click).

## Workers

| Piece | Worker name |
|-------|-------------|
| Router | `anyrouter-os` |
| Backend | `anyrouter-os-backend` |
| GitHub gatekeeper | `anyrouter-os-gatekeeper-github` |
| MCP gatekeeper | `anyrouter-os-gatekeeper-mcp` |

GitHub OAuth App callback: `https://os.anyrouter.dev/gatekeeper/github/oauth`

### AnyRouter MCP

[AnyRouter MCP Gateway](https://anyrouter.dev/mcp) Streamable HTTP endpoint:

```text
https://anyrouter.dev/api/v1/mcp
```

(`https://anyrouter.dev/mcp` is the product page, not the MCP protocol URL.)

In the Workshop: **Connections → + New Connection → MCP** (or open Connectors), connect an
account, complete AnyRouter OAuth once. Tools from the gateway (native + servers you connected in
the AnyRouter dashboard) become grantable resources.

That URL is prefilled: `MCP_DEFAULT_ENDPOINT` in `packages/gatekeeper-mcp/wrangler.anyrouter-os.jsonc`
puts it in the connect form's field, so connecting AnyRouter is a click rather than a paste. It is a
default, not a restriction — the field stays editable for any other MCP server, and each user still
authorizes as themselves, so no deployment-wide credential exists.

What that connection reaches follows the user's own AnyRouter key scopes. A "Sign in with AnyRouter"
key carries `["inference", "read:profile"]`, so through MCP it sees the curated always-ready
connection tools (currently the `firecrawl` namespace) rather than management tools — an intentional
boundary on AnyRouter's side (`SIGNIN_BUNDLE` in its `packages/lib/src/auth/management-scopes.ts`).


## Account move (2026-08-16) — done

Moved from `23050adb6c92e313643a29e1ba64c88a` to `7df185a18b98382c3240fa7ac4a37075`, all four
Workers redeployed. Everything below is account-scoped, so it was re-provisioned, not moved:

- KV `BLUEPRINTS` `e0198c767f464f9d924aed0990b004a0` (was `8cf665d8…`)
- KV `AVATARS` `f47b716d46ec433db94dbc9c0db2321f` (was `2627a086…`)
- R2 `cowork-blueprint-content` — already existed in the new account
- AI Gateway `anyrouter` (was `cowork-ai`); authentication is on, so `CF_AI_GATEWAY_API_TOKEN`
  still needs a `wrangler secret put` on the backend
- Zero Trust: an Access app "AnyRouter OS" was created for `os.anyrouter.dev` (aud
  `1a177010…`, team `https://anyr.cloudflareaccess.com`). **Deleted again on 2026-08-16** — it
  302'd every request to the Access login before Clerk was ever reached, which contradicts
  Clerk-only sign-in. Do not recreate it.
- GitHub gatekeeper `CLIENT_ID` / `CLIENT_SECRET` re-put from `.env.local`
- Zone `anyrouter.dev` was already in the new account, so the custom domain bound cleanly

### Routing gotcha — the host needs an explicit route

Two zone records are named `anyrouter.dev`: the live one is `f13a6aa2…` (account `7df185a1…`,
"AnyRouter Inc."); `2a9a797b…` under the old account is status `moved` and serves nothing — don't
edit routes there. On the live zone, `*.anyrouter.dev/*` -> `anyrouter` (the marketing Worker)
beats the Workers Custom Domain, so `os.anyrouter.dev` served the marketing site until an explicit
route was added:

```
os.anyrouter.dev/*  ->  anyrouter-os
```

`admin`, `docs` and `blog` each carry the same explicit route for this reason. Note this leaves
both a Custom Domain and a route bound to the hostname; the route is what actually serves.

**Durable Object state did not migrate** — user/workspace DOs start empty. KV blueprint/avatar
contents were not copied; the old namespaces still hold them under `23050adb…`.

## Old-account storage (ids NOT valid on the new account)

- KV blueprints `8cf665d809904fb0943ba11dab6bae91`
- KV avatars `2627a086155246e0b92507ed111eb930`

## Access

Zero Trust Access is intentionally NOT in front of `os.anyrouter.dev` — Clerk is the only gate.
The backend no longer supports Cloudflare Access authentication at all.
