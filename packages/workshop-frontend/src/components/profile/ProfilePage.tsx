import { useCallback, useEffect, useState } from 'react'
import { useKumoToastManager } from '@cloudflare/kumo'
import { AiChatAuthorInfo } from '@gadgets/workshop-shared/api'
import { useAuthenticatedApi } from '../../AuthContext'
import { CF_ACCESS_MODE } from '../../useAuth'
import { invalidateAvatarCache } from '../../useAvatar'
import { useDocumentTitle } from '../../useDocumentTitle'
import { AnyRouterSection } from './AnyRouterSection'
import { PasswordSection } from './PasswordSection'

/** Page shell: loads who the user is, then composes the profile's sections. */
export default function ProfilePage() {
  useDocumentTitle('Profile')

  const { authenticatedApi } = useAuthenticatedApi()
  const toasts = useKumoToastManager()
  const [userInfo, setUserInfo] = useState<AiChatAuthorInfo | null>(null)
  const [loading, setLoading] = useState(true)
  // Whether this account has a password (false for OAuth-created accounts). Null while loading.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    authenticatedApi.hasPasswordLogin()
      .then((v: boolean) => { if (!cancelled) setHasPassword(v) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [authenticatedApi])

  useEffect(() => {
    let cancelled = false
    authenticatedApi.whoami()
      .then((info) => { if (!cancelled) setUserInfo(info) })
      .catch((error) => {
        console.error('Failed to fetch user info:', error)
        if (!cancelled) toasts.add({ title: 'Failed to load user information', variant: 'error' })
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [authenticatedApi])

  // A sync copies the picture from AnyRouter into this account's avatar, so the cached copy the
  // rest of the app renders (header, author rows) is stale until it is dropped.
  const handleIdentityChanged = useCallback(() => {
    if (userInfo?.id) invalidateAvatarCache(userInfo.id)
  }, [userInfo?.id])

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

        {/* Only for password accounts (hidden under CF Access or gatekeeper sign-in). */}
        {!CF_ACCESS_MODE && hasPassword === true && userInfo && (
          <PasswordSection userId={userInfo.id} />
        )}
      </div>
    </div>
  )
}
