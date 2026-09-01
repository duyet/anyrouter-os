# AnyRouter OS feature map

Behavior-level inventory of AnyRouter OS (`duyet/anyrouter-os`, live at https://os.anyrouter.dev). Agents use this map to decide what to drive and what evidence counts.

## Baseline preconditions

- Default target is **live** `https://os.anyrouter.dev`. Run `control-anyrouter-os.mjs doctor --target live` and require `ok: true` before driving.
- `doctor --target local` is **blocked** in this checkout: no `.dev.vars` / `.env.local`, and local `wrangler.jsonc` has no Clerk key. Do not invent those files. Do not treat password-auth `pnpm run-local` as the live Clerk landing.
- Drive a Chrome started by `open`, 1280×800, dedicated user-data-dir. Refuse a second `open` on the same session until `cleanup`.
- Signed-out is the only safe live path unless the operator already provided a session. Do not complete Clerk/AnyRouter OAuth against production as a "login proof".
- Prefer ARIA names, `aria-label`, `#sign-in`, and `header a[href="#sign-in"]`. Class selectors are last resort.
- Wait for RPC-backed UI (`Sign in - AnyRouter OS` title, Clerk iframe, or Home composer). The static HTML title `AnyRouter OS` is the shell, not a signed-in app.
- Cleanup removes `/tmp/verify-anyrouter-os/<session>/` only. Keep `.cursor/skills/verify-anyrouter-os/artifacts/`.

## Driving conventions

- Start every recipe from `open --target live` unless the feature says otherwise.
- Treat every command as literal. Keep quoted copy unchanged.
- Record the feature id and entry point with every artifact.
- When a path needs a signed-in session you do not have, report it unreachable (account gate) and do not claim it verified via the landing.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes `state.json`, an ARIA snapshot, and a screenshot with AnyRouter OS identity visible.
- Mutation proof (theme, auth token) reads `localStorage` after the control was used.
- Do not report a skipped signed-in entry point as verified through the public landing.

## Features

- [Sign-in landing](./sign-in-landing.md) — signed-out marketing + Clerk card. **This is the live proof target.**
- [Theme mode](./theme-mode.md) — system/light/dark toggle on the public header/footer.
- [Home composer](./home-composer.md) — signed-in `/` prompt, model picker, Get started.
- [Workspaces](./workspaces.md) — signed-in rail + `/workspaces` list.
- [Explore and blueprints](./explore-blueprints.md) — `/explore`, `/blueprints`, public `/blueprint/$id`.
