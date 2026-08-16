import { useState, FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { RpcStub } from 'capnweb'
import { PublicApi } from '@gadgets/workshop-shared/api'
import { Input, Button, Banner, Loader } from '@cloudflare/kumo'
import { hashPassword } from './passwordHash'
import { useServerConfig, useServerConfigError, useSiteName } from './ServerConfigContext'
import { useDocumentTitle } from './useDocumentTitle'
import { useConnectionLost } from './RpcContext'
import OAuthButtons from './components/auth/OAuthButtons'
import ClerkLogin from './components/auth/ClerkLogin'
import ThemeModeButton from './components/ThemeModeButton'
import Hero from './components/landing/Hero'
import FeatureGrid from './components/landing/FeatureGrid'
import DemoPromptToApp from './components/landing/DemoPromptToApp'
import DemoGatekeeperApproval from './components/landing/DemoGatekeeperApproval'
import DemoOwnKey from './components/landing/DemoOwnKey'
import DemoBlueprintShare from './components/landing/DemoBlueprintShare'
import { PRIMARY_BTN } from './components/profile/controls'

interface LoginPageProps {
  rpcStub: RpcStub<PublicApi>
  onLoginSuccess?: () => void
}

export default function LoginPage({ rpcStub, onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const serverConfig = useServerConfig()
  const serverConfigError = useServerConfigError()
  const siteName = useSiteName()
  const connectionLost = useConnectionLost()
  useDocumentTitle('Sign in')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username || !password || loading) return
    setLoading(true)
    setError(null)

    try {
      const passwordHash = await hashPassword(username, password)
      const token = await rpcStub.login(username, passwordHash)
      if (token) {
        localStorage.setItem('authToken', token)
        if (onLoginSuccess) {
          onLoginSuccess()
        } else {
          window.location.reload()
        }
      } else {
        setError('Invalid username or password')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  // Until the deployment config loads we don't know which auth methods are enabled, so don't guess:
  // defaulting to the password form would show it even where it's disabled (and hide configured
  // OAuth providers). This is especially important when the server is unreachable — serverConfig
  // stays null — so render a loading / connection state instead of a misconfigured form. (A visitor
  // on a slow config load sees only this gate, not the landing content below — deliberate: there's
  // nothing accurate to show about auth methods yet.)
  if (!serverConfig) {
    if (serverConfigError && !connectionLost) {
      return (
        <div
          role="alert"
          className="min-h-screen flex flex-col items-center justify-center gap-4 bg-kumo-base px-4"
        >
          <p className="text-sm text-kumo-danger text-center">
            Couldn&apos;t load deployment settings.
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      )
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-kumo-base px-4">
        <Loader size="lg" />
        <p className="text-sm text-kumo-subtle text-center">
          {connectionLost ? "Can't reach the server. Retrying…" : 'Loading…'}
        </p>
      </div>
    )
  }

  const authVendors = serverConfig.authVendors ?? []
  // Clerk replaces every other sign-in method when configured (see ServerConfig.clerkPublishableKey).
  const clerkKey = serverConfig.clerkPublishableKey
  const passwordAuthEnabled = !clerkKey && serverConfig.passwordAuthEnabled

  // The sign-in card's content, unchanged from the original LoginPage other than its heading (the
  // page headline in Hero is now the only <h1>). Passed into Hero as a slot rather than owned by
  // it, so every auth path here keeps living in this file exactly as it did before.
  const signIn = (
    <>
      <div className="text-center mb-6">
        <p className="text-base font-semibold text-kumo-default">Sign in to {siteName}</p>
      </div>

      {/* Clerk is the only way in when configured (shared with anyrouter.dev). */}
      {clerkKey && (
        <ClerkLogin rpcStub={rpcStub} publishableKey={clerkKey} onSuccess={onLoginSuccess} />
      )}

      {passwordAuthEnabled && (
        <>
          {/* Username / password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              disabled={loading}
              placeholder="your-username"
            />

            <Input
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
              placeholder="••••••••"
            />

            {error && (
              <Banner variant="error" title={error} />
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={!username || !password}
              loading={loading}
              className="w-full justify-center"
            >
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-kumo-subtle mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-kumo-brand hover:underline font-medium">
              Create one
            </Link>
          </p>
        </>
      )}

      {/* Gatekeeper sign-in options, shown whenever any auth vendor is configured. */}
      {!clerkKey && authVendors.length > 0 && (
        <div className={passwordAuthEnabled ? 'mt-6' : ''}>
          {passwordAuthEnabled && (
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-kumo-line" />
              <span className="text-xs text-kumo-subtle">or</span>
              <div className="h-px flex-1 bg-kumo-line" />
            </div>
          )}
          {!passwordAuthEnabled && error && (
            <Banner variant="error" title={error} className="mb-4" />
          )}
          <OAuthButtons rpcStub={rpcStub} vendors={authVendors} onSuccess={onLoginSuccess} />
        </div>
      )}

      <div className="mt-8 flex justify-center">
        <ThemeModeButton size="lg" />
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-kumo-base">
      <Hero siteName={siteName} signIn={signIn} />

      <div className="flex flex-col divide-y divide-kumo-line">
        <div className="pb-4 pt-4">
          <FeatureGrid />
        </div>
        <DemoPromptToApp />
        <DemoGatekeeperApproval />
        <DemoOwnKey />
        <DemoBlueprintShare />
      </div>

      {/* Closing CTA — repeats the sign-in action after a visitor has scrolled through the demos. */}
      <div className="mx-auto max-w-4xl px-6 py-16 text-center sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-kumo-default sm:text-3xl">
          See it for yourself
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-kumo-subtle">
          Sign in and describe the first thing you want built.
        </p>
        <a href="#sign-in" className={`${PRIMARY_BTN} mt-6`}>
          Sign in
        </a>
      </div>
    </div>
  )
}
