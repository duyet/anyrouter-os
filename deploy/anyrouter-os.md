# anyrouter-os production deploy

| Piece | Value |
|-------|--------|
| Router Worker | `anyrouter-os` |
| Backend Worker | `anyrouter-os-backend` |
| Hostname | `https://os.anyrouter.dev` |
| Account | `7df185a18b98382c3240fa7ac4a37075` |

## Redeploy

```bash
export CLOUDFLARE_API_TOKEN=…   # Workers edit
export CLOUDFLARE_ACCOUNT_ID=7df185a18b98382c3240fa7ac4a37075

# Frontend (Access-mode SPA)
cd packages/workshop-frontend && VITE_CF_ACCESS_MODE=true pnpm build && cd ../..

# GitHub gatekeeper (OAuth secrets live here, not on the backend)
cd packages/gatekeeper-github
pnpm run build:configurator
pnpm exec wrangler deploy --config wrangler.anyrouter-os.jsonc
# printf '%s' "$GITHUB_CLIENT_ID" | pnpm exec wrangler secret put CLIENT_ID --config wrangler.anyrouter-os.jsonc
# printf '%s' "$GITHUB_CLIENT_SECRET" | pnpm exec wrangler secret put CLIENT_SECRET --config wrangler.anyrouter-os.jsonc

# MCP gatekeeper (BYO endpoints — users paste a URL; no static OAuth app secrets)
cd ../gatekeeper-mcp
pnpm run build:configurator
pnpm exec wrangler deploy --config wrangler.anyrouter-os.jsonc

# Backend
cd ../workshop-backend
pnpm exec wrangler deploy --config wrangler.anyrouter-os.jsonc
# First time / rotated token:
# printf '%s' "$CF_AI_GATEWAY_API_TOKEN" | pnpm exec wrangler secret put CF_AI_GATEWAY_API_TOKEN --config wrangler.anyrouter-os.jsonc

# Router + custom domain
cd ../router
pnpm exec wrangler deploy --config wrangler.anyrouter-os.jsonc
```

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
account, paste that URL, complete AnyRouter OAuth once. Tools from the gateway (native + servers
you connected in the AnyRouter dashboard) become grantable resources.


## Account move (2026-08-16) — done

Moved from `23050adb6c92e313643a29e1ba64c88a` to `7df185a18b98382c3240fa7ac4a37075`, all four
Workers redeployed. Everything below is account-scoped, so it was re-provisioned, not moved:

- KV `BLUEPRINTS` `e0198c767f464f9d924aed0990b004a0` (was `8cf665d8…`)
- KV `AVATARS` `f47b716d46ec433db94dbc9c0db2321f` (was `2627a086…`)
- R2 `cowork-blueprint-content` — already existed in the new account
- AI Gateway `anyrouter` (was `cowork-ai`); authentication is on, so `CF_AI_GATEWAY_API_TOKEN`
  still needs a `wrangler secret put` on the backend
- Zero Trust: new Access app "AnyRouter OS" for `os.anyrouter.dev`, aud
  `1a17701011c030fe75fc07e509495cce76a0f80066c506e667958e52e1c563e6`, team
  `https://anyr.cloudflareaccess.com`, one allow policy for `duyet.cs@gmail.com`
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

Zero Trust → Access → application for this host: include `os.anyrouter.dev`.
Keep the same Application Audience as `CF_ACCESS_AUD` unless you create a new app.
