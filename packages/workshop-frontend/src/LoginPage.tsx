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
          className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4"
        >
          <p className="text-sm text-destructive text-center">
            Couldn&apos;t load deployment settings.
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      )
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-4">
        <Loader size="lg" />
        <p className="text-sm text-muted-foreground text-center">
          {connectionLost ? "Can't reach the server. Retrying…" : 'Loading…'}
        </p>
      </div>
    )
  }

  // "Sign in with AnyRouter" (when enabled) is the sole method — it suppresses every other one,
  // just as Clerk does. Both are mutually exclusive with password + gatekeeper sign-in.
  const anyrouterOnly = serverConfig.anyrouterAuthEnabled && !!serverConfig.anyrouterOauthClientId
  const authVendors = anyrouterOnly ? [] : (serverConfig.authVendors ?? [])
  // Clerk replaces every other sign-in method when configured (see ServerConfig.clerkPublishableKey).
  const clerkKey = anyrouterOnly ? undefined : serverConfig.clerkPublishableKey
  const passwordAuthEnabled = !anyrouterOnly && !clerkKey && serverConfig.passwordAuthEnabled

  // The sign-in card's content, unchanged from the original LoginPage other than its heading (the
  // page headline in Hero is now the only <h1>). Passed into Hero as a slot rather than owned by
  // it, so every auth path here keeps living in this file exactly as it did before.
  const signIn = (
    <>
      <div className="text-center mb-6">
        <p className="text-base font-semibold text-foreground">Sign in to {siteName}</p>
      </div>

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

      <div className="mt-8 flex justify-center">
        <ThemeModeButton size="lg" />
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-background">
      <Hero siteName={siteName} signIn={signIn} />

      <div className="flex flex-col divide-y divide-border">
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
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          See it for yourself
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
          Sign in and describe the first thing you want built.
        </p>
        <a href="#sign-in" className={`${PRIMARY_BTN} mt-6`}>
          Sign in
        </a>
      </div>
    </div>
  )
}
