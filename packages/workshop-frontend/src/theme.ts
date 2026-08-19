// Runtime color theming.
//
// Light/dark palettes live in styles.css (`:root` / `.dark` / `[data-mode="dark"]`).
// Theme mode is stamped on <html> as both `data-mode` and `.dark` / `.light`
// (shadcn) before paint. Accent can be overridden at runtime from an
// admin-chosen seed; hover/ring shades are derived with CSS relative color.

import { applyAccentColor as applyAccentColorToStyle } from '@gadgets/workshop-shared/theme'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedThemeMode = 'light' | 'dark'

/**
 * localStorage key for the user's theme preference.
 *
 * The render-blocking boot script in `index.html` reads this same key before CSS paint.
 * Keep the two in sync.
 */
export const THEME_MODE_STORAGE_KEY = 'gadgets:theme-mode'

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function getSystemThemeMode(): ResolvedThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function readThemeMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_MODE_STORAGE_KEY)
    return isThemeMode(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function writeThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode)
  } catch {
    // Ignore storage failures; the selected mode still applies for this session.
  }
}

export function resolveThemeMode(mode: ThemeMode): ResolvedThemeMode {
  return mode === 'system' ? getSystemThemeMode() : mode
}

export function applyThemeMode(mode: ThemeMode): ResolvedThemeMode {
  const resolved = resolveThemeMode(mode)
  const root = document.documentElement

  // Stamp both `data-mode` and shadcn's `.dark` / `.light` so semantic tokens
  // resolve the same palette before paint.
  root.setAttribute('data-mode', resolved)
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
  root.style.colorScheme = resolved

  let meta = document.querySelector('meta[name="color-scheme"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'color-scheme')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', resolved)

  return resolved
}

export function applyStoredThemeMode(): ResolvedThemeMode {
  return applyThemeMode(readThemeMode())
}

/** Apply the accent color to the document root. Pass "" / invalid to clear back to the base theme. */
export function applyAccentColor(color: string | null | undefined): void {
  applyAccentColorToStyle(document.documentElement.style, color)
}

/** The base/default accent, shown in the admin picker when no custom color is set. */
export const DEFAULT_ACCENT_COLOR = '#ff4801'
