import { useKumoToastManager } from '@cloudflare/kumo'
import { useAuthenticatedApi } from './AuthContext'
import { useState, useEffect, useCallback } from 'react'
import { AiChatAuthorInfo, AnyRouterConnectionStatus } from '@gadgets/workshop-shared/api'
import { hashPassword } from './passwordHash'
import { CF_ACCESS_MODE } from './useAuth'
import { User, Lock, Eye, EyeSlash, ArrowsClockwise, ShieldCheck } from '@phosphor-icons/react'
import { useServerConfig } from './ServerConfigContext'
import { ANYROUTER_ACCOUNT_URL, isAnyRouterGrantExpired } from './anyrouterOAuth'
import { useAnyRouterConnect } from './useAnyRouterConnect'
import { invalidateAvatarCache } from './useAvatar'
import { useDocumentTitle } from './useDocumentTitle'

// Shared, on-language control classes (match the rest of the app: Workspaces/Blueprints headers,
// the gatekeepers toolbar, the command palette). Kept here so the profile page reads as part of the
// system rather than a stack of default Kumo cards.
const PRIMARY_BTN =
  'press inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-kumo-brand px-3.5 text-[13px] font-medium tracking-[-0.25px] text-white transition-colors hover:bg-kumo-brand-hover disabled:cursor-not-allowed disabled:opacity-60'
const INPUT =
  'h-9 w-full rounded-lg border border-kumo-line bg-kumo-base px-3 text-[14px] tracking-[-0.25px] text-kumo-default placeholder:text-kumo-inactive transition-[border-color,box-shadow] focus:border-kumo-ring focus:outline-none focus:ring-[3px] focus:ring-kumo-ring/15'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-[12px] font-medium uppercase tracking-[0.08em] text-kumo-inactive">
      {children}
    </h2>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium tracking-[-0.1px] text-kumo-subtle">{children}</p>
  )
}

// On-language password field: same input/focus treatment as the rest of the app, with an inline
// show/hide toggle (replacing Kumo's SensitiveInput, which read as dated against the new look).
function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  description,
  error,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  description?: string
  error?: string | null
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative mt-1.5">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`${INPUT} pr-10 ${error ? 'border-kumo-danger focus:border-kumo-danger' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-kumo-inactive transition-colors hover:text-kumo-default"
        >
          {show ? <EyeSlash size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-[12px] tracking-[-0.1px] text-kumo-danger">{error}</p>
      ) : description ? (
        <p className="mt-1 text-[12px] tracking-[-0.1px] text-kumo-subtle">{description}</p>
      ) : null}
    </div>
  )
}

const SECONDARY_BTN =
  'press inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-kumo-line bg-kumo-base px-3.5 text-[13px] font-medium tracking-[-0.25px] text-kumo-default transition-colors hover:bg-kumo-tint disabled:cursor-not-allowed disabled:opacity-60'

function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const t = Date.parse(expiresAt)
  if (!Number.isFinite(t)) return null
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * The user's AnyRouter account — the identity this app runs on. Name, username, email and
 * picture all come from anyrouter.dev and are read-only here (the AnyRouter dashboard is where
 * they change), so the page's actions are Sync (re-read the account with the stored key) and
 * Approve again (re-run the consent flow, which is also how newly added permissions get granted
 * and how a revoked key is replaced).
 */
function AnyRouterSection({ onIdentityChanged }: { onIdentityChanged: () => void }) {
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

  const profile = connection?.profile
  const expired = isAnyRouterGrantExpired(connection?.expiresAt ?? null)
  const expiry = formatExpiry(connection?.expiresAt ?? null)

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>
        <span className="inline-flex items-center gap-1.5">
          <img src="/anyrouter-logo.svg" alt="" className="h-3.5 w-3.5" />
          AnyRouter account
        </span>
      </SectionLabel>
      <div className="divide-y divide-kumo-line overflow-hidden rounded-xl border border-kumo-line bg-kumo-base">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-kumo-fill">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <User size={28} className="text-kumo-subtle" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium tracking-[-0.25px] text-kumo-default">
              {connection?.connected
                ? profile?.name || profile?.username || profile?.email || 'AnyRouter account'
                : 'Not connected'}
            </p>
            <p className="mt-0.5 truncate text-[12px] leading-4 tracking-[-0.2px] text-kumo-subtle">
              {!connection?.connected
                ? 'Approve access to run inference on your own AnyRouter key'
                : expired
                  ? 'Your sign-in key has expired — approve again to keep models working'
                  : expiry ? `Sign-in key expires ${expiry}` : 'Connected'}
            </p>
          </div>
        </div>

        {connection?.connected && (
          <div className="px-5 py-4">
            <FieldLabel>Username</FieldLabel>
            <p className="mt-1 truncate text-[14px] tracking-[-0.25px] text-kumo-default">
              {profile?.username ?? '—'}
            </p>
            <p className="mt-1 text-[12px] tracking-[-0.1px] text-kumo-subtle">
              Your username, display name and picture come from AnyRouter.{' '}
              <a
                href={ANYROUTER_ACCOUNT_URL}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-kumo-default"
              >
                Change them on AnyRouter
              </a>
              , then sync.
            </p>
          </div>
        )}

        {connection?.connected && profile?.email && (
          <div className="px-5 py-4">
            <FieldLabel>Email</FieldLabel>
            <p className="mt-1 truncate text-[14px] tracking-[-0.25px] text-kumo-default">
              {profile.email}
            </p>
          </div>
        )}

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
              : connection?.connected ? 'Approve again' : 'Connect AnyRouter'}
          </button>
          {connection?.connected && (
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
          <p className="px-5 py-3 text-[12px] tracking-[-0.1px] text-kumo-danger">{error}</p>
        )}
      </div>
    </section>
  )
}

export default function SettingsPage() {
  useDocumentTitle('Profile')

  const { authenticatedApi } = useAuthenticatedApi()
  const toasts = useKumoToastManager()
  const [userInfo, setUserInfo] = useState<AiChatAuthorInfo | null>(null)
  const [loading, setLoading] = useState(true)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  // Whether this account has a password (false for OAuth-created accounts). Null while loading.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)

  // Determine whether to show the change-password section.
  useEffect(() => {
    let cancelled = false
    authenticatedApi.hasPasswordLogin()
      .then((v: boolean) => { if (!cancelled) setHasPassword(v) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [authenticatedApi])

  const loadUserInfo = useCallback(async () => {
    try {
      return await authenticatedApi.whoami()
    } catch (error) {
      console.error('Failed to fetch user info:', error)
      toasts.add({ title: 'Failed to load user information', variant: 'error' })
      return null
    }
  }, [authenticatedApi])

  useEffect(() => {
    let cancelled = false
    loadUserInfo()
      .then((info) => { if (!cancelled && info) setUserInfo(info) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [loadUserInfo])

  // A sync pulls the name and picture from AnyRouter, so the rest of the app (header avatar,
  // author names) has to be told the cached copies are stale.
  const handleIdentityChanged = useCallback(() => {
    if (userInfo?.id) invalidateAvatarCache(userInfo.id)
    loadUserInfo().then((info) => { if (info) setUserInfo(info) })
  }, [userInfo?.id, loadUserInfo])

  const handleChangePassword = async () => {
    if (!userInfo) return
    if (!currentPassword || !newPassword || !confirmPassword) return
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setPasswordLoading(true)
    setPasswordError(null)

    try {
      const oldHash = await hashPassword(userInfo.id, currentPassword)
      const newHash = await hashPassword(userInfo.id, newPassword)
      await authenticatedApi.changePassword(oldHash, newHash)
      toasts.add({ title: 'Password changed successfully', variant: 'success' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change password'
      setPasswordError(errorMessage)
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <p className="text-[13px] tracking-[-0.25px] text-kumo-subtle">Loading profile…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-6 pb-16 sm:px-10">
      <header className="px-1 pb-2 pt-10">
        <h1 className="text-2xl font-semibold tracking-tight text-kumo-default">Profile</h1>
        <p className="mt-1 text-[13px] leading-[18px] tracking-[-0.25px] text-kumo-subtle">
          Your AnyRouter account powers this workspace — keep it in sync here.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-9">
        <AnyRouterSection onIdentityChanged={handleIdentityChanged} />

        {/* Security — only for password accounts (hidden under CF Access or gatekeeper sign-in) */}
        {!CF_ACCESS_MODE && hasPassword === true && (
          <section className="flex flex-col gap-3">
            <SectionLabel>Security</SectionLabel>
            <div className="rounded-xl border border-kumo-line bg-kumo-base p-5">
              <div className="flex max-w-sm flex-col gap-4">
                <PasswordField
                  label="Current password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />

                <PasswordField
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Enter new password"
                  description="Must be at least 8 characters"
                  autoComplete="new-password"
                />

                <PasswordField
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  error={passwordError}
                />

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                    className={PRIMARY_BTN}
                  >
                    <Lock size={14} weight="bold" />
                    {passwordLoading ? 'Changing…' : 'Change password'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
