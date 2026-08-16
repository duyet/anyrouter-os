// Browser side of "Sign in with AnyRouter" (OAuth authorization-code + PKCE, public client).
//
// beginAnyRouterOAuth() stashes the PKCE verifier + state in localStorage (the callback opens in
// a separate popup window, so sessionStorage wouldn't reach it) and opens AnyRouter's authorize
// endpoint. AnyRouter redirects to /anyrouter/oauth/callback on our origin, whose route validates
// the state, retrieves the verifier, and completes the exchange server-side via
// AuthenticatedApi.completeAnyRouterOAuth() (anyrouter.dev has no CORS for browsers).
//
// Both apps share the same Clerk instance, so the consent page never asks the user to sign in
// again — connecting is a single Approve click.

const AUTHORIZE_URL = 'https://anyrouter.dev/api/v1/mcp/oauth/authorize'

/** Where AnyRouter explains the plans a sign-in key requires. */
export const ANYROUTER_PRICING_URL = 'https://anyrouter.dev/pricing'

/** Where the user edits the account fields this app mirrors (name, username, picture). */
export const ANYROUTER_ACCOUNT_URL = 'https://dash.anyrouter.dev/account'

/**
 * Path AnyRouter redirects back to. The router matches it, the root shell exempts it from the
 * onboarding gate, and the redirect_uri is built from it — one definition keeps those in step.
 */
export const ANYROUTER_OAUTH_CALLBACK_PATH = '/anyrouter/oauth/callback'

const PENDING_KEY = 'anyrouterOAuthPending'

/** Channel the callback route uses to tell the opener the grant landed. */
export const ANYROUTER_OAUTH_CHANNEL = 'anyrouter-oauth'

export function anyrouterOAuthRedirectUri(): string {
  return `${window.location.origin}${ANYROUTER_OAUTH_CALLBACK_PATH}`
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64url(bytes)
}

/**
 * Start the AnyRouter consent flow in a popup. Returns the popup window, or null when the
 * browser blocked it (the caller should tell the user to allow popups).
 */
export async function beginAnyRouterOAuth(clientId: string): Promise<Window | null> {
  const verifier = randomToken()
  const state = randomToken()
  const challengeBytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  )

  localStorage.setItem(PENDING_KEY, JSON.stringify({ state, verifier, at: Date.now() }))

  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', anyrouterOAuthRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('code_challenge', base64url(challengeBytes))
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  // Cosmetic label for the minted key in the user's AnyRouter dashboard.
  url.searchParams.set('key_name', 'AnyRouter OS')

  return window.open(url.toString(), 'anyrouter-oauth', 'popup,width=520,height=680')
}

/**
 * Retrieve (and consume) the PKCE verifier for a callback carrying `state`. Returns null when
 * the state doesn't match a pending attempt (stale callback, or a forged redirect).
 */
export function takePendingAnyRouterOAuth(state: string): string | null {
  const raw = localStorage.getItem(PENDING_KEY)
  if (!raw) return null
  localStorage.removeItem(PENDING_KEY)
  try {
    const pending = JSON.parse(raw) as { state?: string; verifier?: string; at?: number }
    if (!pending.verifier || pending.state !== state) return null
    // Authorize codes live 10 minutes; anything older is a stale stash.
    if (pending.at && Date.now() - pending.at > 15 * 60 * 1000) return null
    return pending.verifier
  } catch {
    return null
  }
}

/** Whether a stored grant is past its expiry (sign-in keys always expire eventually). */
export function isAnyRouterGrantExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  const t = Date.parse(expiresAt)
  return Number.isFinite(t) && t <= Date.now()
}
