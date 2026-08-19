# Gadgets Workshop Frontend

Single-page app for the Gadgets Workshop UI. Built with React, Kumo, and Vite.

## Development

```sh
pnpm dev        # start dev server on http://localhost:3000
pnpm build      # type-check and build for production
pnpm preview    # preview production build locally
```

## Authentication

Users log in with a username and password, via Clerk, or via an OAuth-button sign-in gatekeeper.
Account creation is available via `/signup`. No extra configuration needed.
