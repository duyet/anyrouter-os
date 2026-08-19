import { useEffect, useRef, useState } from 'react'
import { CircleNotch } from '@phosphor-icons/react'
import { Banner } from '@/components/ui/alert'
import { ANYROUTER_OAUTH_CHANNEL, beginAnyRouterOAuth } from '../../anyrouterOAuth'
import AnyRouterMark from '../AnyRouterMark'

interface AnyRouterLoginButtonProps {
  /** The deployment's AnyRouter OAuth client id (ServerConfig.anyrouterOauthClientId). */
  clientId: string
  onSuccess?: () => void
}

/** How long to wait for the popup to complete before giving up (authorize codes live ~10 min). */
const WAIT_TIMEOUT_MS = 5 * 60 * 1000

/**
 * "Continue with AnyRouter" button for the signed-out login/signup page. Opens AnyRouter's consent
 * popup; the callback route (running logged-out) exchanges the code via PublicApi.loginWithAnyRouter,
 * stores the resulting session token in localStorage, and announces it over a BroadcastChannel. This
 * button watches for that signal (with a localStorage poll as the fallback) and then logs the app in.
 */
export default function AnyRouterLoginButton({ clientId, onSuccess }: AnyRouterLoginButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Never leave a poll/listener running past unmount (e.g. the user navigates away mid sign-in).
  useEffect(() => () => cleanupRef.current?.(), [])

  const start = async () => {
    setError(null)
    setPending(true)

    const popup = await beginAnyRouterOAuth(clientId)
    if (!popup) {
      setError('The browser blocked the AnyRouter window. Allow pop-ups and try again.')
      setPending(false)
      return
    }

    let settled = false
    const deadline = Date.now() + WAIT_TIMEOUT_MS
    let channel: BroadcastChannel | null = null
    let poll: ReturnType<typeof setInterval> | null = null

    const cleanup = () => {
      settled = true
      if (poll !== null) { clearInterval(poll); poll = null }
      if (channel) { channel.close(); channel = null }
      cleanupRef.current = null
    }
    cleanupRef.current = cleanup

    const succeed = () => {
      const token = localStorage.getItem('authToken')
      if (!token) return false
      cleanup()
      if (onSuccess) onSuccess()
      else window.location.reload()
      return true
    }

    const check = () => {
      if (settled) return
      // The callback stores the session token before announcing, so its presence is the signal that
      // sign-in landed. (On this page there was no prior token, so a stray one can't false-positive.)
      if (succeed()) return
      if (popup.closed) { cleanup(); setError('Sign-in was cancelled.'); setPending(false) }
      else if (Date.now() > deadline) { cleanup(); setError('Sign-in timed out. Try again.'); setPending(false) }
    }

    poll = setInterval(check, 700)
    try {
      channel = new BroadcastChannel(ANYROUTER_OAUTH_CHANNEL)
      channel.addEventListener('message', () => check())
    } catch {
      // BroadcastChannel unavailable — the localStorage poll covers it.
    }
  }

  return (
    <div className="space-y-3">
      {error && <Banner variant="error" title={error} />}
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="group inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <CircleNotch size={16} className="animate-spin text-primary" />
        ) : (
          <AnyRouterMark className="size-4 shrink-0 text-primary transition-transform group-hover:scale-110" />
        )}
        <span className="whitespace-nowrap">
          {pending ? 'Waiting for AnyRouter…' : 'Sign in with AnyRouter'}
        </span>
      </button>
    </div>
  )
}
