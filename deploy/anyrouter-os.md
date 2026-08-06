# anyrouter-os production deploy

| Piece | Value |
|-------|--------|
| Router Worker | `anyrouter-os` |
| Backend Worker | `anyrouter-os-backend` |
| Hostname | `https://os.anyrouter.dev` |
| Account | `23050adb6c92e313643a29e1ba64c88a` |

## Redeploy

```bash
export CLOUDFLARE_API_TOKEN=…   # Workers edit
export CLOUDFLARE_ACCOUNT_ID=23050adb6c92e313643a29e1ba64c88a

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


## Preserved storage

- KV blueprints `8cf665d809904fb0943ba11dab6bae91`
- KV avatars `2627a086155246e0b92507ed111eb930`
- R2 `cowork-blueprint-content`

Durable Object state is **per Worker script name**. Moving from `cowork-backend` to
`anyrouter-os-backend` starts empty user/workspace DO storage (re-login).

## Access

Zero Trust → Access → application for this host: include `os.anyrouter.dev`.
Keep the same Application Audience as `CF_ACCESS_AUD` unless you create a new app.
