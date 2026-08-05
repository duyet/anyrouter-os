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

# Backend
cd packages/workshop-backend
pnpm exec wrangler deploy --config wrangler.anyrouter-os.jsonc
# First time / rotated token:
# printf '%s' "$CF_AI_GATEWAY_API_TOKEN" | pnpm exec wrangler secret put CF_AI_GATEWAY_API_TOKEN --config wrangler.anyrouter-os.jsonc

# Router + custom domain
cd ../router
pnpm exec wrangler deploy --config wrangler.anyrouter-os.jsonc
```

## Preserved storage

- KV blueprints `8cf665d809904fb0943ba11dab6bae91`
- KV avatars `2627a086155246e0b92507ed111eb930`
- R2 `cowork-blueprint-content`

Durable Object state is **per Worker script name**. Moving from `cowork-backend` to
`anyrouter-os-backend` starts empty user/workspace DO storage (re-login).

## Access

Zero Trust → Access → application for this host: include `os.anyrouter.dev`.
Keep the same Application Audience as `CF_ACCESS_AUD` unless you create a new app.
