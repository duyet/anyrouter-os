# Home composer

Signed-in `/` is the new-workspace launcher: headline **What are we working on?**, a composer, and a **Get started** list. Submitting creates a gadget and navigates to `/workspace/$id`.

## Sub-features

- `home-empty` shows the hero, composer, and three starter tasks.
- `home-seed` clicking a Get started row fills the composer (does not send).
- `home-send` Send (or Enter) starts a chat and opens `/workspace/$id`.
- `home-model` the model picker (`aria-label="Select model"`) lists AnyRouter models after `listModels()`.
- `home-deep-link` `/?prompt=` seeds the composer then strips the query.

## How to get to it (user POV)

- Sign in, finish onboarding if shown, land on `/`.
- Choose **Home** in the left rail.
- Choose **Create workspace** on `/workspaces` (routes to `/`).
- Open a `/?prompt=...` link.

## Driving it with control-anyrouter-os

Preconditions:

- A real signed-in session (Clerk completed). Without it this feature is **unreachable** on live — the origin shows the sign-in landing instead. Report `account` as the blocker.
- `doctor --target live` is `ok`.
- Onboarding wizard is not covering the shell (`isOnboardingCompleted()` already true).

- **Confirm Home.** `wait --text "What are we working on?"` and `wait --title "Home - AnyRouter OS"`.
- **Composer.** `wait --selector 'textarea[role="combobox"]'`. Placeholder is `Start a new conversation…`.
- **Seed.** `click --name "Write a 1:1 pre-read"` (or whichever of the three shuffled rows is visible). The combobox value becomes that row's prompt. Send stays disabled until there is text.
- **Send.** `click --selector 'button[aria-label="Send message"]'`. URL becomes `/workspace/<id>` (fullscreen editor, no AppShell rail).
- **Proof.** Screenshot of Home with a seeded prompt **before** send, plus `state.json` with the `h1` and combobox value. After send, a second screenshot of `/workspace/...` plus the URL. Do not treat the landing page as this feature.

## Gotchas

- Get started picks **three random** suggestions per mount (`VISIBLE_SUGGESTIONS`). Match by visible label, not a hardcoded id.
- The composer is `role="combobox"` without an accessible name; use the placeholder or `textarea[role="combobox"]`.
- `Send message` is disabled while empty (`canSend`).
- A signed-out `open --target live` of `/` is the landing, not Home. Check the title.
- Do not `eval` `authenticatedApi.newGadget()` as the proof — the user path is the composer.
