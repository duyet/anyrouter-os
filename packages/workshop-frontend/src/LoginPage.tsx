import { useState, FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { RpcStub } from 'capnweb'
import { PublicApi } from '@gadgets/workshop-shared/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/alert'
import { Loader } from '@/components/ui/loader'
import { hashPassword } from './passwordHash'
import { useServerConfig, useServerConfigError, useSiteName } from './ServerConfigContext'
import { useDocumentTitle } from './useDocumentTitle'
import { useConnectionLost } from './RpcContext'
import OAuthButtons from './components/auth/OAuthButtons'
import ClerkLogin from './components/auth/ClerkLogin'
import AnyRouterLoginButton from './components/auth/AnyRouterLoginButton'
import ThemeModeButton from './components/ThemeModeButton'
import Hero from './components/landing/Hero'
import FeatureGrid from './components/landing/FeatureGrid'
import LogoStrip from './components/landing/LogoStrip'
import DemoPromptToApp from './components/landing/DemoPromptToApp'
import DemoGatekeeperApproval from './components/landing/DemoGatekeeperApproval'
import DemoOwnKey from './components/landing/DemoOwnKey'
import DemoBlueprintShare from './components/landing/DemoBlueprintShare'
import { LANDING_SHELL } from './components/landing/tokens'
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

  // Don't hide the landing while config loads — only the sign-in slot waits, so the headline
  // and demos paint immediately. Guessing the auth method would show a password form on Clerk
  // deployments, so the card stays a spinner until we know.
  const anyrouterOnly = !!serverConfig?.anyrouterAuthEnabled && !!serverConfig.anyrouterOauthClientId
  const authVendors = anyrouterOnly ? [] : (serverConfig?.authVendors ?? [])
  const clerkKey = anyrouterOnly ? undefined : serverConfig?.clerkPublishableKey
  const passwordAuthEnabled = !!serverConfig && !anyrouterOnly && !clerkKey && serverConfig.passwordAuthEnabled

  const signIn = !serverConfig ? (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      {serverConfigError && !connectionLost ? (
        <div role="alert" className="flex flex-col items-center gap-3">
          <p className="text-sm text-destructive text-center">
            Couldn&apos;t load deployment settings.
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      ) : (
        <>
          <Loader size="lg" />
          <p className="text-sm text-muted-foreground text-center">
            {connectionLost ? "Can't reach the server. Retrying…" : 'Loading…'}
          </p>
        </>
      )}
    </div>
  ) : (
    <>
      <p className="mb-5 text-center text-[15px] font-semibold text-foreground">
        Sign in to {siteName}
      </p>

      {/* AnyRouter is the only way in when enabled: users sign in with their anyrouter.dev account. */}
      {anyrouterOnly && (
        <AnyRouterLoginButton
          clientId={serverConfig.anyrouterOauthClientId!}
          onSuccess={onLoginSuccess}
        />
      )}

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

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary hover:underline font-medium">
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
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          {!passwordAuthEnabled && error && (
            <Banner variant="error" title={error} className="mb-4" />
          )}
          <OAuthButtons rpcStub={rpcStub} vendors={authVendors} onSuccess={onLoginSuccess} />
        </div>
      )}

    </>
  )

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className={`${LANDING_SHELL} flex items-center justify-end py-3`}>
        <ThemeModeButton size="lg" />
      </header>
      <Hero siteName={siteName} signIn={signIn} />

      <div className="flex flex-col">
        <div className="pb-2">
          <FeatureGrid />
          <LogoStrip />
        </div>
        <DemoPromptToApp />
        <DemoGatekeeperApproval />
        <DemoOwnKey />
        <DemoBlueprintShare />
      </div>

      <div className={`${LANDING_SHELL} py-10 text-center sm:py-14`}>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-3xl">
          See it for yourself
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground sm:text-[15px]">
          Sign in and describe the first thing you want built.
        </p>
        <a href="#sign-in" className={`${PRIMARY_BTN} mt-5`}>
          Sign in
        </a>
      </div>
    </div>
  )
}
