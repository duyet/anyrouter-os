/**
 * AnyRouter wordmark on the global anyrouter.dev asset CDN (24h edge cache).
 * The SVG uses prefers-color-scheme fills so it stays readable as an <img>.
 */
export const ANYROUTER_MARK_CDN =
  'https://anyrouter.dev/brand/anyrouter-logo.svg'

/** Provider marks from the same CDN (openai-color.svg, …). */
export const ANYROUTER_PROVIDER_CDN = 'https://anyrouter.dev/providers'

export function anyrouterProviderLogo(file: string): string {
  return `${ANYROUTER_PROVIDER_CDN}/${file}`
}
