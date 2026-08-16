#!/usr/bin/env bash
# Deploys the anyrouter-os production stack (see deploy/anyrouter-os.md).
# Credentials come from .env.local at the repo root — wrangler falls back to an
# interactive OAuth login when they are missing, which silently does nothing in
# a non-interactive shell.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
env_file="$root/.env.local"

if [ ! -f "$env_file" ]; then
  echo "Missing $env_file (needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID)." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

: "${CLOUDFLARE_API_TOKEN:?not set in .env.local}"
: "${CLOUDFLARE_ACCOUNT_ID:?not set in .env.local}"

# The router serves workshop-frontend/dist, so the frontend must be built first.
(cd "$root/packages/workshop-frontend" && pnpm build)

for pkg in workshop-backend router; do
  echo "==> deploying $pkg"
  (cd "$root/packages/$pkg" && pnpm exec wrangler deploy --config wrangler.anyrouter-os.jsonc)
done
