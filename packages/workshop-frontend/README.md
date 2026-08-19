# AnyRouter OS frontend

Single-page app for AnyRouter OS. Built with React, shadcn/Base UI, and Vite. Speaks to the backend over Cap'n Web RPC.

## Development

```sh
pnpm dev        # start dev server on http://localhost:3000
pnpm build      # type-check and build for production
pnpm preview    # preview production build locally
```

## Authentication

This instance signs in with Clerk (the same instance as anyrouter.dev). Password login is available only when Clerk is not configured. Account creation is at `/signup` when password auth is on.

Model access uses **Sign in with AnyRouter** (`ANYROUTER_OAUTH_CLIENT_ID`), not a deployment-wide API key.
