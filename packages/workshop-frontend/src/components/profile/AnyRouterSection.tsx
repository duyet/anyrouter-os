import { useCallback, useEffect, useState } from 'react'
import { useKumoToastManager } from '@/components/ui/toast'
import { ArrowsClockwise, ShieldCheck, User } from '@phosphor-icons/react'
import { AnyRouterConnectionStatus } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from '../../AuthContext'
import { useServerConfig } from '../../ServerConfigContext'
import { ANYROUTER_ACCOUNT_URL, isAnyRouterGrantExpired } from '../../anyrouterOAuth'
import { useAnyRouterConnect } from '../../useAnyRouterConnect'
import { Field, PRIMARY_BTN, SECONDARY_BTN, SectionLabel } from './controls'

function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const t = Date.parse(expiresAt)
  if (!Number.isFinite(t)) return null
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * The user's AnyRouter account — the identity this app runs on. Name, username, email and
 * picture all come from anyrouter.dev and are read-only here (the AnyRouter dashboard is where
 * they change), so the actions are Sync (re-read the account with the stored key) and Approve
 * again (re-run the consent flow, which is also how newly added permissions get granted and how
 * a revoked key is replaced).
 */
export function AnyRouterSection({ onIdentityChanged }: { onIdentityChanged: () => void }) {
  const { authenticatedApi } = useAuthenticatedApi()
  const serverConfig = useServerConfig()
  const toasts = useKumoToastManager()

  const [connection, setConnection] = useState<AnyRouterConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const read = useCallback(
    () => authenticatedApi.getAnyRouterConnection(),
    [authenticatedApi],
  )

  useEffect(() => {
    let cancelled = false
    read()
      .then((status) => { if (!cancelled) setConnection(status) })
      .catch(() => { if (!cancelled) setError('Could not read your AnyRouter connection.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [read])

  const connect = useAnyRouterConnect({
    clientId: serverConfig?.anyrouterOauthClientId,
    read,
    onConnected: (status) => {
      setConnection(status)
      setError(null)
      onIdentityChanged()
      toasts.add({ title: 'AnyRouter access approved', variant: 'success' })
    },
    onError: setError,
  })

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    try {
      const status = await authenticatedApi.refreshAnyRouterProfile()
      setConnection(status)
      onIdentityChanged()
      toasts.add({ title: 'Synced with AnyRouter', variant: 'success' })
    } catch (err) {
      // The grant is deliberately left in place: the fix is to approve again, not to lose the key.
      setError(err instanceof Error ? err.message : 'Could not sync with AnyRouter.')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return null

  const connected = connection?.connected ?? false
  const profile = connection?.profile
  const expired = isAnyRouterGrantExpired(connection?.expiresAt ?? null)
  const expiry = formatExpiry(connection?.expiresAt ?? null)

  const subtitle = !connected
    ? 'Approve access to run inference on your own AnyRouter key'
    : expired
      ? 'Your sign-in key has expired — approve again to keep models working'
      : expiry ? `Sign-in key expires ${expiry}` : 'Connected'

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>
        <span className="inline-flex items-center gap-1.5">
          <img src="/anyrouter-logo.svg" alt="" className="h-3.5 w-3.5" />
          AnyRouter account
        </span>
      </SectionLabel>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <User size={28} className="text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium tracking-[-0.25px] text-foreground">
              {connected
                ? profile?.name || profile?.username || profile?.email || 'AnyRouter account'
                : 'Not connected'}
            </p>
            <p className="mt-0.5 truncate text-[12px] leading-4 tracking-[-0.2px] text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>

        {connected && (
          <Field
            label="Username"
            value={profile?.username ?? '—'}
            note={
              <>
                Your username, display name and picture come from AnyRouter.{' '}
                <a
                  href={ANYROUTER_ACCOUNT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Change them on AnyRouter
                </a>
                , then sync.
              </>
            }
          />
        )}

        {connected && profile?.email && <Field label="Email" value={profile.email} />}

        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <button
            type="button"
            onClick={() => connect.start()}
            disabled={connect.state === 'waiting'}
            className={PRIMARY_BTN}
          >
            <ShieldCheck size={14} weight="bold" />
            {connect.state === 'waiting'
              ? 'Approve in the AnyRouter tab…'
              : connected ? 'Approve again' : 'Connect AnyRouter'}
          </button>
          {connected && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className={SECONDARY_BTN}
            >
              <ArrowsClockwise size={14} className={syncing ? 'animate-spin' : undefined} />
              {syncing ? 'Syncing…' : 'Sync account data'}
            </button>
          )}
          {connect.state === 'waiting' && (
            <button type="button" onClick={connect.cancel} className={SECONDARY_BTN}>
              Cancel
            </button>
          )}
        </div>

        {error && (
          <p className="px-5 py-3 text-[12px] tracking-[-0.1px] text-destructive">{error}</p>
        )}
      </div>
    </section>
  )
}
