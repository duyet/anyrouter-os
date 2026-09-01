# Explore and blueprints

Blueprints are reusable gadget starting points. **Explore** (`/explore`) is the catalog. **Blueprints** (`/blueprints`) is the signed-in library. `/blueprint/$id` is a public landing that can be opened while signed out.

## Sub-features

- `explore-grid` `/explore` titled Explore, blueprint cards with `aria-label="Open blueprint …"`.
- `library-list` `/blueprints` heading **Blueprints** and the user's saved/published set.
- `blueprint-public` `/blueprint/$id` shows metadata; signed-out primary action is **Log in to create a gadget**.
- `blueprint-missing` unknown id shows **Blueprint not found** and **Back to Explore**.
- `blueprint-create` signed-in **Create Gadget** after connections are configured.

## How to get to it (user POV)

- Rail **Explore** or **Blueprints**.
- Open a shared `/blueprint/<id>` link (works signed out).
- From a card, **Open blueprint &lt;title&gt;**.

## Driving it with control-anyrouter-os

Preconditions:

- **Public 404 path** (no account): live is enough.
- **Explore / library / create**: signed-in session. Otherwise those routes are the sign-in landing — report `account`.

- **Missing id (public).** `goto https://os.anyrouter.dev/blueprint/does-not-exist` then `wait --text "Blueprint not found"`. Optional: `click --name "Back to Explore"` — signed-out this still hits the landing, not Explore.
- **Public blueprint.** Only with a known published id. `wait` on the blueprint title (document title) and the primary button **Log in to create a gadget** when signed out.
- **Explore (signed-in).** `click --name "Explore"` then `wait --title "Explore - AnyRouter OS"`. Open a card via `click --selector 'a[aria-label^="Open blueprint "]'` (or the exact name).
- **Library.** `click --name "Blueprints"` (rail, not the public 404). `wait --title "Blueprints - AnyRouter OS"` and `wait --text "Reusable starting points"`.
- **Proof (public, this checkout).** Screenshot + `state.json` of `/blueprint/does-not-exist` showing **Blueprint not found**. That is the unauthenticated path that does not require a secret id. Do not call Explore "verified" from that 404.

## Gotchas

- `/explore` is **not** a standalone public route in `__root.tsx`. Signed-out visitors never see the catalog.
- Card accessible name is `Open blueprint ${title}`, not the title alone.
- Creating a gadget from a blueprint mutates the user's library. Do not do that on a shared live account as a casual proof.
- Screenshot URLs under `/blueprint-screenshot/` are images, not the SPA feature.
