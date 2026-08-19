/** Shared destinations for the signed-out header and footer. */

export const LANDING_URLS = {
  signIn: '#sign-in',
  github: 'https://github.com/duyet/anyrouter-os',
  gateway: 'https://anyrouter.dev',
  models: 'https://anyrouter.dev/models',
  docs: 'https://docs.anyrouter.dev',
  mcp: 'https://anyrouter.dev/mcp',
  about: 'https://anyrouter.dev/about',
  blog: 'https://blog.anyrouter.dev',
  privacy: 'https://anyrouter.dev/privacy',
  terms: 'https://anyrouter.dev/terms',
} as const

/** Compact top-bar items — same destinations as anyrouter.dev's public header. */
export const LANDING_NAV: { label: string; href: string }[] = [
  { label: 'Models', href: LANDING_URLS.models },
  { label: 'Docs', href: LANDING_URLS.docs },
  { label: 'GitHub', href: LANDING_URLS.github },
]

export const LANDING_FOOTER_COLUMNS: {
  title: string
  links: { label: string; href: string }[]
}[] = [
  {
    title: 'Product',
    links: [
      { label: 'Sign in', href: LANDING_URLS.signIn },
      { label: 'GitHub', href: LANDING_URLS.github },
    ],
  },
  {
    title: 'AnyRouter',
    links: [
      { label: 'Gateway', href: LANDING_URLS.gateway },
      { label: 'Models', href: LANDING_URLS.models },
      { label: 'Docs', href: LANDING_URLS.docs },
      { label: 'MCP', href: LANDING_URLS.mcp },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: LANDING_URLS.about },
      { label: 'Blog', href: LANDING_URLS.blog },
      { label: 'Privacy', href: LANDING_URLS.privacy },
      { label: 'Terms', href: LANDING_URLS.terms },
    ],
  },
]
