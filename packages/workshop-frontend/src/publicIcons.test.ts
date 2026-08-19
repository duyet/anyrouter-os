// Vitest runs under node, but the src/ tsconfig only has browser types — hence the suppressions.
// @ts-expect-error node builtin without @types/node
import { readFileSync } from 'node:fs'
// @ts-expect-error node builtin without @types/node
import { dirname, join } from 'node:path'
// @ts-expect-error node builtin without @types/node
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const frontendRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(frontendRoot, 'public')

describe('public icons', () => {
  it('names AnyRouter OS on the SVG favicon', () => {
    const svg = readFileSync(join(publicDir, 'favicon.svg'), 'utf8')
    expect(svg).toContain('aria-label="AnyRouter OS"')
    expect(svg).not.toContain('Cloudflare OS')
  })

  it('keeps the SVG favicon link in the document', () => {
    const html = readFileSync(join(frontendRoot, 'index.html'), 'utf8')
    expect(html).toContain('href="/favicon.svg"')
    expect(html).toContain('type="image/svg+xml"')
  })

  it('preloads the AnyRouter mark from the brand CDN', () => {
    const html = readFileSync(join(frontendRoot, 'index.html'), 'utf8')
    expect(html).toContain('rel="preload"')
    expect(html).toContain('https://anyrouter.dev/brand/anyrouter-logo.svg')
  })

  it('ships a real ICO so /favicon.ico is not the SPA document', () => {
    const ico = new Uint8Array(readFileSync(join(publicDir, 'favicon.ico')))
    // ICONDIR: reserved 0, type 1 (icon)
    expect([...ico.subarray(0, 4)]).toEqual([0, 0, 1, 0])
    const prefix = new TextDecoder().decode(ico.subarray(0, 15))
    expect(prefix.startsWith('<!DOCTYPE')).toBe(false)
    expect(prefix.startsWith('<html')).toBe(false)
    expect(ico.byteLength).toBeGreaterThan(64)
  })
})
