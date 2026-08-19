import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Banner, Loader } from '@cloudflare/kumo'
import { Check } from '@phosphor-icons/react'
import { WorkshopButton } from '../components/WorkshopControls'
import { useOptionalAuthenticatedApi } from '../AuthContext'
import { useRpcStub } from '../RpcContext'
import {
  ANYROUTER_OAUTH_CHANNEL,
  anyrouterOAuthRedirectUri,
  takePendingAnyRouterOAuth,
} from '../anyrouterOAuth'
import { useDocumentTitle } from '../useDocumentTitle'

type CallbackSearch = {
  code?: string
  state?: string
  error?: string
  error_description?: string
}

export const Route = createFileRoute('/anyrouter/oauth/callback')({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: typeof search.code === 'string' ? search.code : undefined,
    state: typeof search.state === 'string' ? search.state : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
    error_description:
      typeof search.error_description === 'string' ? search.error_description : undefined,
  }),
  component: AnyRouterOAuthCallback,
})

/**
 * Landing page for AnyRouter's consent redirect. Validates the state against the pending PKCE
 * attempt, completes the code exchange server-side, then notifies the opener (onboarding / Add
 * Model dialog) over a BroadcastChannel and closes itself when it ran in a popup.
 */
function AnyRouterOAuthCallback() {
  // Signed-in: this is the post-login "connect" flow (add/refresh the inference key). Signed-out:
  // it's "Sign in with AnyRouter" itself — the account resolved here becomes the OS identity.
  const auth = useOptionalAuthenticatedApi()
  const publicApi = useRpcStub()
  const navigate = useNavigate()
  const { code, state, error, error_description } = Route.useSearch()
  const signingIn = auth === null
  useDocumentTitle(signingIn ? 'Signing in with AnyRouter' : 'Connecting AnyRouter')

  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working')
  const [message, setMessage] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const fail = (text: string) => {
      setStatus('error')
      setMessage(text)
    }

    if (error) {
      fail(error_description ?? `AnyRouter authorization failed: ${error}`)
      return
    }
    if (!code || !state) {
      fail('Missing authorization code. Start the connection again.')
      return
    }
    const verifier = takePendingAnyRouterOAuth(state)
    if (!verifier) {
      fail('This authorization attempt is stale or was not started here. Try connecting again.')
      return
    }
    const redirectUri = anyrouterOAuthRedirectUri()

    // Both paths return whether the exchange succeeded. Sign-in additionally stores the returned
    // session token, which the opener (AnyRouterLoginButton) reads to complete login.
    const exchange = signingIn
      ? publicApi.loginWithAnyRouter(code, verifier, redirectUri).then((token) => {
          if (!token) {
            fail('New sign-ups are currently disabled on this deployment.')
            return false
          }
          localStorage.setItem('authToken', token)
          return true
        })
      : auth.authenticatedApi.completeAnyRouterOAuth(code, verifier, redirectUri).then(() => true)

    exchange
      .then((ok) => {
        if (!ok) return
        setStatus('done')
        // Tell whoever opened the popup that it landed (they also poll as a fallback).
        try {
          const channel = new BroadcastChannel(ANYROUTER_OAUTH_CHANNEL)
          // BroadcastChannel.postMessage takes no targetOrigin (that is window.postMessage).
          // oxlint-disable-next-line unicorn/require-post-message-target-origin
          channel.postMessage({ type: 'connected' })
          channel.close()
        } catch {
          // BroadcastChannel unavailable — the opener's polling covers it.
        }
        // Popups close themselves once the user has had a moment to read the confirmation; a full
        // tab has nothing to close, so it returns to the app instead. When signing in a full tab
        // must fully reload so the app boots with the freshly stored token.
        if (window.opener) {
          setTimeout(() => window.close(), 1500)
        } else if (signingIn) {
          window.location.assign('/')
        } else {
          navigate({ to: '/' })
        }
      })
      .catch((err) => {
        console.error('AnyRouter token exchange failed:', err)
        fail(err instanceof Error ? err.message : 'Connecting AnyRouter failed. Try again.')
      })
  }, [auth, publicApi, signingIn, code, state, error, error_description, navigate])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
      {status === 'working' && (
        <>
          <Loader size="lg" />
          <p className="text-sm text-kumo-subtle">Connecting your AnyRouter account…</p>
        </>
      )}
      {status === 'done' && (
        <>
          <div className="w-10 h-10 rounded-full bg-kumo-brand flex items-center justify-center">
            <Check size={20} weight="bold" className="text-kumo-inverse" />
          </div>
          <p className="text-base font-medium text-kumo-default">
            {signingIn ? 'Signed in with AnyRouter' : 'AnyRouter connected'}
          </p>
          <p className="text-sm text-kumo-subtle">
            You can close this window and go back to AnyRouter OS.
          </p>
          <WorkshopButton onClick={() => window.close()}>Close window</WorkshopButton>
        </>
      )}
      {status === 'error' && message && <Banner variant="error" title={message} />}
    </div>
  )
}
