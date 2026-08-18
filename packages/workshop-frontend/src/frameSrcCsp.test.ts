import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const indexHtml = readFileSync(resolve(here, '../index.html'), 'utf8')
const wrangler = readFileSync(
  resolve(here, '../../workshop-backend/wrangler.anyrouter-os.jsonc'),
  'utf8',
)

function frameSrcDirective(html: string): string {
  const match = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?>/,
  )
  expect(match, 'index.html is missing the frame-src CSP meta').toBeTruthy()
  const content = match![1]
  expect(content.startsWith('frame-src ')).toBe(true)
  return content.slice('frame-src '.length).replace(/;$/, '')
}

function frontendApiFromPublishableKey(publishableKey: string): string {
  const encoded = publishableKey.replace(/^pk_(live|test)_/, '')
  const domain = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '')
  return `https://${domain}`
}

describe('workshop frame-src CSP', () => {
  it('keeps srcdoc locked while allowing this deployment\'s Clerk auth frames', () => {
    const sources = frameSrcDirective(indexHtml).split(/\s+/)

    expect(sources[0]).toBe('srcdoc:')
    expect(sources).toContain('https://clerk.anyrouter.dev')
    expect(sources).toContain('https://accounts.anyrouter.dev')
    expect(sources).toContain('https://challenges.cloudflare.com')
    expect(sources).toContain('https://*.protect.clerk.com')
    expect(sources).not.toContain("'self'")
    expect(sources).not.toContain('https:')
    expect(sources).not.toContain('*')
    expect(sources).not.toContain('https://*')
  })

  it('allowlists the Frontend API origin encoded in the committed Clerk publishable key', () => {
    const keyMatch = wrangler.match(/"CLERK_PUBLISHABLE_KEY":\s*"(pk_(?:live|test)_[^"]+)"/)
    expect(keyMatch, 'missing CLERK_PUBLISHABLE_KEY in wrangler.anyrouter-os.jsonc').toBeTruthy()
    const frontendApi = frontendApiFromPublishableKey(keyMatch![1])
    expect(frontendApi).toBe('https://clerk.anyrouter.dev')
    expect(frameSrcDirective(indexHtml).split(/\s+/)).toContain(frontendApi)
  })
})
