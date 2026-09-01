---
name: verify-anyrouter-os
description: >-
  Drive the AnyRouter OS web app (os.anyrouter.dev) through a dedicated Chrome
  CDP CLI. Use to screenshot, click, wait on copy, dump ARIA, or prove a mapped
  feature. Default target is the live Clerk landing; local production-parity is
  blocked without gitignored Clerk env.
---

# Verify AnyRouter OS

Drive the **AnyRouter OS** SPA the way a user does: a browser against the real origin, not a mocked RPC stub.

`node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs --help` is canonical.

Repo: `duyet/anyrouter-os`. Live product: [https://os.anyrouter.dev](https://os.anyrouter.dev). Surface: `packages/workshop-frontend` (React + TanStack Router) talking Cap'n Web over `wss://<host>/api`. Kernel is `packages/workshop-backend`; do not prove UI by calling Worker internals.

## Pick a target

| Target | Origin | When to use |
| --- | --- | --- |
| **live** (default) | `https://os.anyrouter.dev` | Production-parity. Clerk sign-in, AnyRouter OAuth client `anyrouter-os`. Shared instance — signed-out only unless the operator already has a session. |
| **local** | `http://localhost:8787` | `pnpm run-local`. **Not production-parity in this checkout.** |

`packages/workshop-backend/wrangler.jsonc` (what `run-local` uses) has **no** `CLERK_PUBLISHABLE_KEY`. Production Clerk lives in `wrangler.anyrouter-os.jsonc` plus the `CLERK_SECRET_KEY` Worker secret. This tree has no `.env.local` / `.dev.vars` (both gitignored). Do **not** invent those files.

`doctor --target local` therefore reports `BLOCKED: local-not-production-parity` and exits 2. `launch --target local` is refused for the same reason. Prove against live.

Dev split (`pnpm dev-server` + `pnpm dev-client` → Vite `:3000` + wrangler `:8787`) is for humans iterating on source. Verification uses the live origin or a `run-local` asset-served `:8787`, never a half-started Vite-only tab.

## Launch

Live is already up. Start a dedicated Chrome (fresh profile, own CDP port):

```bash
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs doctor --target live
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs open --target live
```

Ready when `doctor --target live` prints `ok: true` (HTTP 200, `<title>AnyRouter OS</title>`, `#root`, Chrome binary present) and `open` prints a `cdp :PORT pid PID` line.

If a later change **does** add Clerk to local wrangler + a real `.dev.vars` in the operator's tree:

```bash
pnpm run-local          # http://localhost:8787 — ready when that origin 200s with #root
# teardown: SIGTERM the pid recorded by launch; never pkill -f wrangler
```

Isolation: `open` writes `/tmp/verify-anyrouter-os/<session>/session.json` and a private `--user-data-dir`. A second `open` on the same session is refused until `cleanup`. Pass `--session <id>` for a parallel run. Never attach to a random Chrome on 9222. Never reuse the operator's default profile (that would steal their Clerk cookies).

## Doctor

Run first whenever anything looks off.

```bash
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs doctor --target live
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs doctor --target live --json
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs doctor --target local --json
```

Live worth driving: status 200, HTML title contains `AnyRouter OS`, `#root` present, Chrome found.

Local worth driving: **not in this checkout**. Doctor names the missing Clerk env instead of pretending password-auth `run-local` is os.anyrouter.dev.

## Drive

```bash
BIN=node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs

$BIN open --target live
$BIN wait --title "Sign in - AnyRouter OS" --timeout-ms 30000
$BIN wait --text "Describe an app. It writes it, runs it, sandboxes it."
$BIN click --selector 'header a[href="#sign-in"]'
$BIN wait --selector '#sign-in'
$BIN state --path .cursor/skills/verify-anyrouter-os/artifacts/sign-in-landing/state.json
$BIN snapshot --aria --path .cursor/skills/verify-anyrouter-os/artifacts/sign-in-landing/landing.aria.txt
$BIN screenshot --path .cursor/skills/verify-anyrouter-os/artifacts/sign-in-landing/landing.png
$BIN cleanup
```

Handles that exist in this repo (prefer these over coordinates):

| Handle | Where |
| --- | --- |
| `header a[href="#sign-in"]` | Header **Sign in** (visible at ≥ `lg` / 1024px; drive at 1280×800) |
| `#sign-in` | Hero sign-in card |
| `h1` text `Describe an app. It writes it, runs it, sandboxes it.` | Landing headline |
| `h2` text `Sign in to AnyRouter OS` | Card heading (`DEFAULT_SITE_NAME`) |
| `nav[aria-label="Primary"]` | Header links: Models, Docs, GitHub |
| `button[aria-label^="Theme:"]` | Theme cycle: system → light → dark (`gadgets:theme-mode`) |
| `button[aria-label="Open menu"]` | Mobile header sheet (`< lg`) |
| iframe `src` host `clerk.anyrouter.dev` | Clerk `<SignIn>` (live). Cross-origin; do not type passwords into it from this harness unless proving the Clerk widget itself. |
| `textarea[role="combobox"]` placeholder `Start a new conversation…` | Signed-in Home composer (`/`) |
| `aria-label="Send message"` | Composer send |
| `section[aria-label="Example tasks"]` | Home **Get started** list |
| `nav` labels Home / Workspaces / Blueprints / Outputs / Explore | Signed-in `AppShell` rail |
| `h1` `Workspaces` + link `Create workspace` | `/workspaces` |
| `h1` `Blueprints` | `/blueprints` |
| document title `Explore - AnyRouter OS` | `/explore` |
| `⌘K` / `Ctrl+K` | Command palette (signed-in) |

Signed-in routes (`/`, `/workspaces`, `/blueprints`, `/explore`, `/profile`, `/workspace/$id`) render `LoginPage` until Clerk has minted `localStorage.authToken`. Public without a session: `/`, `/signup`, `/blueprint/$id`, `/anyrouter/oauth/callback`.

Do not complete OAuth against live as a proof of "it logs in" unless you already have an AnyRouter/Clerk session the operator provided. Creating accounts or burning a real key is out of scope for this skill.

## Evidence

Put proof under `.cursor/skills/verify-anyrouter-os/artifacts/<feature-id>/`. Cleanup **must not** delete that tree.

Standards:

- Exercise the real user path (load the origin, wait for RPC-backed UI, click the same controls a person uses). Do not call `PublicApi` from Node as a substitute for the landing.
- Capture **action + result**: e.g. click header Sign in, then `location.hash === "#sign-in"` and the card still shows `Sign in to AnyRouter OS`.
- `state.json` (structured) + `landing.png` (pixels) + `landing.aria.txt` (AX tree). Title must read `Sign in - AnyRouter OS` after `getServerConfig` lands.
- Side effects: theme writes `localStorage['gadgets:theme-mode']`; auth writes `localStorage.authToken`. Read those after the UI path, do not set them to fake a session.
- Mocks: none on the live origin. Local password login is a different product surface, not a mock of Clerk.

## Cleanup

```bash
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs cleanup
```

Kills the Chrome pid (and optional `run-local` pid) recorded in `/tmp/verify-anyrouter-os/<session>/`, then deletes that runtime dir. Uses the pid we started, never `pkill -f chrome`. Artifacts stay in `.cursor/skills/verify-anyrouter-os/artifacts/`.

Run cleanup after failed iterations too so ports and profiles do not leak.

## Helpers

```bash
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs --help
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs doctor --target live --json
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs open --target live
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs wait --text "Sign in to AnyRouter OS"
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs click --selector 'header a[href="#sign-in"]'
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs state
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs snapshot --aria
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs screenshot --path /tmp/os.png
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs eval 'document.documentElement.getAttribute("data-mode")'
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs info
node .cursor/skills/verify-anyrouter-os/control-anyrouter-os.mjs cleanup
```

The helper talks to system Chrome over CDP (`VERIFY_CHROME` overrides the binary). It is not a Playwright dependency of the monorepo.

## Feature map

Behavior inventory: [`features/README.md`](features/README.md). Each file uses `Sub-features`, `How to get to it (user POV)`, `Driving it with control-anyrouter-os`, `Gotchas`.

Keep the map honest with `/maintain-verification-skill` as the landing, Clerk widget, or rail labels change.
