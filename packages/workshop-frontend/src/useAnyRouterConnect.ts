// Browser flow for "Sign in with AnyRouter": open the consent popup, then wait for the callback
// route to report that the grant landed — over a BroadcastChannel, with polling as the fallback
// when BroadcastChannel is unavailable or the message is missed.
//
// Shared by every caller (onboarding, the Add Model dialog, the profile page's "Approve again"),
// so the popup/timeout/completion race is written once. "Already connected" can't be the
// completion signal, because a re-approve starts from a grant that is already there; completion
// is a new grant — the account going from unconnected to connected, or the key's expiry moving.

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
  // Set the moment an attempt resolves, so the broadcast and an in-flight poll tick can't both
  // report the same grant (each would otherwise spend another round trip to find that out).
  const settledRef = useRef(false)

  const stop = useCallback(() => {
    settledRef.current = true
    if (timerRef.current != null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Callers are long-lived routes as well as modals: never leave a poll running past unmount.
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
    stop()
    settledRef.current = false
    setState('waiting')

    const deadline = Date.now() + POLL_TIMEOUT_MS
    // `authoritative` marks the broadcast from the callback route, which only fires after the
    // server stored the new grant. Polling has no such proof, so it waits for the expiry to move
    // — the one field a fresh key reliably changes.
    const check = async (authoritative = false) => {
      if (settledRef.current) return
      const status = await read().catch(() => null)
      if (settledRef.current) return
      const landed = status?.connected
        && (authoritative || !before.connected || status.expiresAt !== before.expiresAt)
      if (landed) {
        stop()
        setState('done')
        onConnected(status)
      } else if (Date.now() > deadline) {
        cancel()
      }
    }

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
