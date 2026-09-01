# Theme mode

Visitors cycle color mode from the public header and footer. The preference is stored as `localStorage['gadgets:theme-mode']` (`system` | `light` | `dark`) and stamped on `<html>` as `data-mode` plus `.dark` / `.light`.

## Sub-features

- `theme-read` exposes the current mode on the theme button's `aria-label`.
- `theme-cycle` walks system → light → dark → system.
- `theme-persist` keeps the choice after a reload.
- `theme-footer` offers a second control in the dark footer slab.

## How to get to it (user POV)

- Click the sun/moon/desktop icon in the sticky landing header.
- Click the same control in the footer copyright row.
- Signed-in chrome uses the same `ThemeModeButton` where it is mounted; the storage key does not change.

## Driving it with control-anyrouter-os

Preconditions:

- Signed-out live landing is loaded (`sign-in-landing` `landing-load` already green).
- `doctor --target live` is `ok`.

- **Read label.** Run `eval 'document.querySelector("button[aria-label^=\\"Theme:\\"]")?.getAttribute("aria-label")'`. Example: `Theme: system (dark). Switch to light.`
- **Cycle once.** Run `click --selector 'header button[aria-label^="Theme:"]'`. `document.documentElement.getAttribute("data-mode")` changes, and `localStorage.getItem("gadgets:theme-mode")` is `light` or `dark` (not `system` if you left system).
- **Confirm reload.** Run `goto https://os.anyrouter.dev/` then `wait --title "Sign in - AnyRouter OS"`. The stored mode is still applied (`data-mode` matches storage when storage is `light` or `dark`).
- **Proof.** `state.json` includes `dataMode` and `themeButton`. Screenshot shows the resolved palette (light page vs dark page) with the same headline still visible.

## Gotchas

- Default with empty storage is `system`, so `data-mode` follows `prefers-color-scheme`. Headless Chrome is often light. Assert the label + storage, not a hardcoded dark page.
- The footer is forced `.dark`; a screenshot of only the footer does not prove the document theme.
- Two theme buttons exist (header + footer). Prefer `header button[aria-label^="Theme:"]` so you do not click the footer control off-screen.
