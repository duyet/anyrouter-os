# Workspaces

Signed-in users keep gadgets in a persistent left rail and a full list at `/workspaces`. Each workspace is an isolated environment (conversations, gatekeepers, outputs).

## Sub-features

- `shell-rail` AppShell primary nav: Home, Workspaces, Blueprints, Outputs, Explore.
- `shell-search` magnifying glass / ⌘K opens the command palette.
- `shell-collapse` **Collapse sidebar** / **Expand sidebar**.
- `workspaces-list` `/workspaces` heading and the gadget list.
- `workspaces-create` **Create workspace** routes to Home (`/`).
- `workspace-open` opening a row goes to `/workspace/$id` (fullscreen, no rail).

## How to get to it (user POV)

- Sign in, then use the left rail **Workspaces**.
- Open a Recent / Favorite row in the rail.
- From Home, send a first message (creates a workspace).

## Driving it with control-anyrouter-os

Preconditions:

- Signed-in session. Otherwise live `/workspaces` is the sign-in landing — **unreachable** (`account`).
- `doctor --target live` is `ok`.

- **Rail.** `wait --text "Workspaces"` inside `aside[aria-label="Primary"]` is not a heading; click the nav link: `click --name "Workspaces"` (the rail `Link` text).
- **List page.** `wait --title "Workspaces - AnyRouter OS"` and `wait --text "Each workspace is an isolated environment"`.
- **Create.** `click --name "Create workspace"`. Title becomes `Home - AnyRouter OS`.
- **Open existing.** Click a workspace row by its visible title. URL matches `/workspace/` and the rail is gone (fullscreen editor).
- **Palette.** `press --key` is not a chord helper; use `eval` only to *read* after `Meta+k` if you dispatch it via CDP `Input.dispatchKeyEvent` with modifiers. Prefer clicking `button[aria-label="Search"]`.
- **Proof.** Screenshot of `/workspaces` showing the `h1` and at least the Create control (empty list is a valid empty state). `state.json` title `Workspaces - AnyRouter OS`. A landing screenshot is not this feature.

## Gotchas

- `/gadget/$id` redirects to `/workspace/$id`. Do not assert the legacy path.
- Below `md`, the rail is a drawer behind **Open menu**. 1280×800 keeps the desktop rail.
- Collapsed rail hides labels but keeps them for AT; click by `aria-label` / `title`.
- Creating a workspace from Home has side effects on the user's account. Prefer a disposable account if you send a real prompt on live.
