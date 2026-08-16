import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Banner, Loader } from '@cloudflare/kumo'
import { useAuthenticatedApi } from '../AuthContext'
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
  const { authenticatedApi } = useAuthenticatedApi()
  const navigate = useNavigate()
  const { code, state, error, error_description } = Route.useSearch()
  useDocumentTitle('Connecting AnyRouter')

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

    authenticatedApi
      .completeAnyRouterOAuth(code, verifier, anyrouterOAuthRedirectUri())
      .then(() => {
        setStatus('done')
        // Tell whoever opened the popup that the grant landed (they also poll as a fallback).
        try {
          const channel = new BroadcastChannel(ANYROUTER_OAUTH_CHANNEL)
          channel.postMessage({ type: 'connected' })
        } catch {
          // BroadcastChannel unavailable — the opener's polling covers it.
        }
        if (window.opener) {
          setTimeout(() => window.close(), 800)
        } else {
          navigate({ to: '/' })
        }
      })
      .catch((err) => {
        console.error('AnyRouter token exchange failed:', err)
        fail(err instanceof Error ? err.message : 'Connecting AnyRouter failed. Try again.')
      })
  }, [authenticatedApi, code, state, error, error_description, navigate])

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
      {status === 'working' && (
        <>
          <Loader size="lg" />
          <p className="text-sm text-kumo-subtle">Connecting your AnyRouter account…</p>
        </>
      )}
      {status === 'done' && (
        <p className="text-sm text-kumo-default">
          AnyRouter connected. You can close this window.
        </p>
      )}
      {status === 'error' && message && <Banner variant="error" title={message} />}
    </div>
  )
}
