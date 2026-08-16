// Re-usable browser side of "Sign in with AnyRouter" for pages that already have a grant and
// want a fresh one — the profile page's "Approve again", which is also how a user grants newly
// added permissions. It opens the consent popup and waits for the callback route's broadcast,
// polling as a fallback.
//
// Unlike the first-time connect in AddModelModal / OnboardingWizard, "already connected" can't
// be the completion signal (it is true before the user clicks Approve). Completion here is the
// grant's expiry moving away from the snapshot taken when the popup opened.
//
// NOTE: AddModelModal and OnboardingWizard still carry their own copies of this loop. Folding
// them into this hook is a worthwhile follow-up, kept out of this change.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnyRouterConnectionStatus } from '@gadgets/workshop-shared/api'
import { ANYROUTER_OAUTH_CHANNEL, beginAnyRouterOAuth } from './anyrouterOAuth'

/** Fallback poll cadence and how long to keep polling if the user never approves. */
const POLL_MS = 2500
const POLL_TIMEOUT_MS = 5 * 60 * 1000

export type AnyRouterConnectState = 'idle' | 'waiting' | 'done'

export function useAnyRouterConnect(options: {
  clientId: string | undefined
  /** Read the current status from the server. */
  read: () => Promise<AnyRouterConnectionStatus>
  onConnected: (status: AnyRouterConnectionStatus) => void
  onError: (message: string) => void
}) {
  const { clientId, read, onConnected, onError } = options
  const [state, setState] = useState<AnyRouterConnectState>('idle')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Long-lived route: never leave a poll running past the page.
  useEffect(() => stop, [stop])

  const cancel = useCallback(() => {
    stop()
    setState('idle')
  }, [stop])

  const start = useCallback(async () => {
    if (!clientId) {
      onError(
        'AnyRouter sign-in is not configured on this deployment '
          + '(ANYROUTER_OAUTH_CLIENT_ID is missing).',
      )
      return
    }
    // Without a "before" snapshot the poll can't tell an existing grant from a fresh one, so a
    // failed read has to stop the flow rather than risk reporting success the user never gave.
    let before: AnyRouterConnectionStatus
    try {
      before = await read()
    } catch {
      onError('Could not read your AnyRouter connection. Try again.')
      return
    }
    const popup = await beginAnyRouterOAuth(clientId)
    if (!popup) {
      onError('The browser blocked the AnyRouter window. Allow pop-ups and try again.')
      return
    }
    setState('waiting')

    const deadline = Date.now() + POLL_TIMEOUT_MS
    const succeed = (status: AnyRouterConnectionStatus) => {
      stop()
      setState('done')
      onConnected(status)
    }
    // `authoritative` marks the broadcast from the callback route, which only fires after the
    // server stored the new grant. Polling has no such proof, so it waits for the expiry to move
    // — the one field a fresh key reliably changes.
    const check = async (authoritative = false) => {
      const status = await read().catch(() => null)
      if (!status?.connected) {
        if (Date.now() > deadline) cancel()
        return
      }
      if (authoritative || !before.connected || status.expiresAt !== before.expiresAt) {
        succeed(status)
        return
      }
      if (Date.now() > deadline) cancel()
    }

    stop()
    timerRef.current = setInterval(check, POLL_MS)
    try {
      const channel = new BroadcastChannel(ANYROUTER_OAUTH_CHANNEL)
      channel.addEventListener('message', () => {
        channel.close()
        check(true)
      }, { once: true })
    } catch {
      // Polling covers it.
    }
  }, [clientId, read, onConnected, onError, stop, cancel])

  return { state, start, cancel }
}
