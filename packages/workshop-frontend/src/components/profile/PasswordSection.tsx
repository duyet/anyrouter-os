import { useState } from 'react'
import { useKumoToastManager } from '@cloudflare/kumo'
import { Lock } from '@phosphor-icons/react'
import { useAuthenticatedApi } from '../../AuthContext'
import { hashPassword } from '../../passwordHash'
import { PasswordField } from './PasswordField'
import { PRIMARY_BTN, SectionLabel } from './controls'

/** Change-password form. Only rendered for accounts that actually have a password. */
export function PasswordSection({ userId }: { userId: string }) {
  const { authenticatedApi } = useAuthenticatedApi()
  const toasts = useKumoToastManager()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const oldHash = await hashPassword(userId, currentPassword)
      const newHash = await hashPassword(userId, newPassword)
      await authenticatedApi.changePassword(oldHash, newHash)
      toasts.add({ title: 'Password changed successfully', variant: 'success' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
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
            error={error}
          />

          <div className="pt-1">
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              className={PRIMARY_BTN}
            >
              <Lock size={14} weight="bold" />
              {loading ? 'Changing…' : 'Change password'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
