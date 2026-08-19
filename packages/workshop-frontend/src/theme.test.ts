// @vitest-environment jsdom

// Vitest runs under node, but the src/ tsconfig only has browser types — hence the suppressions.
// @ts-expect-error node builtin without @types/node
import { readFileSync } from 'node:fs'
// @ts-expect-error node builtin without @types/node
import { dirname, join } from 'node:path'
// @ts-expect-error node builtin without @types/node
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
  THEME_MODE_STORAGE_KEY,
  applyStoredThemeMode,
  applyThemeMode,
  readThemeMode,
} from './theme'

const INDEX_HTML = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../index.html'),
  'utf8',
)

function stubMatchMedia(prefersDark: boolean) {
  window.matchMedia = (query: string) => ({
    matches: query.includes('prefers-color-scheme: dark') ? prefersDark : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false },
    onchange: null,
  })
}

function colorSchemeMeta() {
  return document.head.querySelector('meta[name="color-scheme"]')
}

function themeColorMeta() {
  return document.head.querySelector('meta[name="theme-color"]:not([media])')
}

describe('theme', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-mode')
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.style.colorScheme = ''
    colorSchemeMeta()?.remove()
    themeColorMeta()?.remove()
  })

  it('applyThemeMode sets data-mode, .dark/.light, color-scheme style, and the color-scheme meta', () => {
    stubMatchMedia(false)
    applyThemeMode('dark')
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(colorSchemeMeta()?.getAttribute('content')).toBe('dark')
    expect(themeColorMeta()?.getAttribute('content')).toBe(THEME_COLOR_DARK)

    applyThemeMode('light')
    expect(document.documentElement.getAttribute('data-mode')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(themeColorMeta()?.getAttribute('content')).toBe(THEME_COLOR_LIGHT)
  })

  it('applyStoredThemeMode follows gadgets:theme-mode, else the OS preference', () => {
    stubMatchMedia(true)
    expect(readThemeMode()).toBe('system')
    expect(applyStoredThemeMode()).toBe('dark')

    localStorage.setItem(THEME_MODE_STORAGE_KEY, 'light')
    expect(applyStoredThemeMode()).toBe('light')
    expect(document.documentElement.getAttribute('data-mode')).toBe('light')
  })
})

describe('index.html theme boot script', () => {
  it('is a classic render-blocking script that reads the same storage key', () => {
    expect(INDEX_HTML).toContain(`localStorage.getItem('${THEME_MODE_STORAGE_KEY}')`)
    expect(INDEX_HTML).toMatch(/<script>\s*\(function \(\) \{/)
    expect(INDEX_HTML).toContain("root.setAttribute('data-mode', mode)")
    expect(INDEX_HTML).toContain("root.classList.toggle('dark', dark)")
    expect(INDEX_HTML).toContain("root.classList.toggle('light', !dark)")
    expect(INDEX_HTML).toContain('root.style.colorScheme = mode')
    expect(INDEX_HTML).toContain("meta.setAttribute('name', 'color-scheme')")
    expect(INDEX_HTML).toContain('name="theme-color"')
    expect(INDEX_HTML).not.toMatch(/theme-color[^>]*media=/)
    expect(INDEX_HTML).toContain('#ffffff')
    expect(INDEX_HTML).toContain('#0a0a0a')
    // Must not be a module: type=module is deferred and would paint CSS first.
    const boot = INDEX_HTML.match(/<script>([\s\S]*?)<\/script>/)
    expect(boot).not.toBeNull()
    expect(boot![0]).not.toContain('type="module"')
    expect(boot![0]).toContain("color.setAttribute('content', dark ? '#0a0a0a' : '#ffffff')")
  })
})
