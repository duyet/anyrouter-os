# Sign-in landing

The signed-out origin is a marketing landing plus a Clerk sign-in card. Unauthenticated visits to `/` (and most other routes) render this page. The card waits on `PublicApi.getServerConfig()` over `wss://<host>/api` before showing Clerk; the headline paints immediately.

## Sub-features

- `landing-load` shows the product headline and AnyRouter OS chrome after the SPA boots.
- `landing-config` replaces the sign-in spinner with Clerk once deployment config arrives.
- `landing-signin-cta` scrolls/focuses `#sign-in` from the header and footer **Sign in** links.
- `landing-nav` exposes Models / Docs / GitHub in `nav[aria-label="Primary"]`.
- `landing-demos` below the fold: facts row, prompt-to-app demo, gatekeeper demo, key demo, blueprint demo.

## How to get to it (user POV)

- Open https://os.anyrouter.dev (or any non-public path while signed out).
- Choose **Sign in** in the sticky header (desktop) or the mobile menu.
- Choose **Sign in** in the footer conversion band or the Product column.
- Land on `/signup` — same Clerk widget, no marketing chrome.

## Driving it with control-anyrouter-os

Preconditions:

- `doctor --target live` reports `ok: true`.
- No verification Chrome session, or `cleanup` has already run.
- Viewport 1280×800 so the header **Sign in** control is visible (`lg` and up).

- **Open origin.** Run `control-anyrouter-os.mjs open --target live`. Chrome navigates to `https://os.anyrouter.dev/`.
- **Wait for SPA + RPC.** Run `wait --title "Sign in - AnyRouter OS"` and `wait --text "Describe an app. It writes it, runs it, sandboxes it."`. Document title is `Sign in - AnyRouter OS` (`useDocumentTitle('Sign in')`), not the static HTML `AnyRouter OS`.
- **Wait for the card.** Run `wait --text "Sign in to AnyRouter OS"` and `wait --selector '#sign-in'`. The card eyebrow reads `AnyRouter · Sign in`.
- **Wait for Clerk.** Run `wait --selector 'iframe[src*="clerk.anyrouter.dev"]' --timeout-ms 20000`. The spinner text `Loading…` is gone. Do not type into the iframe.
- **Header Sign in.** Run `click --selector 'header a[href="#sign-in"]'`. `location.hash` is `#sign-in` and `#sign-in` remains in the tree.
- **Primary nav.** `state` lists Models → `https://anyrouter.dev/models`, Docs → `https://docs.anyrouter.dev`, GitHub → `https://github.com/duyet/anyrouter-os`.
- **Proof.** Run `state --path artifacts/sign-in-landing/state.json`, `snapshot --aria --path artifacts/sign-in-landing/landing.aria.txt`, `screenshot --path artifacts/sign-in-landing/landing.png`. JSON has `h1` containing `Describe an app`, `h2` containing `Sign in to AnyRouter OS`, `hasSignInCard: true`, `hasLoading: false`, and a `clerkIframes` entry. The screenshot shows the headline, the card, and Clerk — not a full-page spinner.

## Gotchas

- Static HTML title is `AnyRouter OS` until React sets `Sign in - AnyRouter OS`. Waiting only on the first title races the shell.
- Header **Sign in** is `hidden lg:inline-flex`. A 800px viewport hides it behind **Open menu**.
- Production is Clerk (`CLERK_PUBLISHABLE_KEY` in `wrangler.anyrouter-os.jsonc`). `ANYROUTER_AUTH_ONLY` is not set there, so the card is **not** the `Sign in with AnyRouter` button from `AnyRouterLoginButton`.
- Completing Clerk signs the operator into a real account. That is not this feature's proof.
- `/signup` is a public route without the marketing header; do not treat it as the landing.
