import { useEffect, useRef, useState } from 'react'
import { RpcStub } from 'capnweb'
import { PublicApi } from '@gadgets/workshop-shared/api'
import {
  ClerkProvider, SignIn, useAuth as useClerkAuth, useClerk, useUser,
} from '@clerk/clerk-react'
import { Banner, Button, Loader } from '@cloudflare/kumo'
import {
  allowClerkAutoSignIn, isClerkAutoSignInSuppressed, suppressClerkAutoSignIn,
} from '../../clerkAutoSignIn'

interface ClerkLoginProps {
  rpcStub: RpcStub<PublicApi>
  publishableKey: string
  onSuccess?: () => void
}

/**
 * Clerk-only sign-in. Renders Clerk's hosted <SignIn> UI (covering both sign-in and sign-up on the
 * shared anyrouter.dev Clerk instance); once a Clerk session exists, exchanges its JWT for a
 * workshop session token via PublicApi.loginWithClerk(). Because the Clerk instance is the same one
 * anyrouter.dev uses, a user already signed in there is signed in here without retyping anything.
 */
export default function ClerkLogin({ rpcStub, publishableKey, onSuccess }: ClerkLoginProps) {
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <ClerkSessionBridge rpcStub={rpcStub} onSuccess={onSuccess} />
    </ClerkProvider>
  )
}

function ClerkSessionBridge({
  rpcStub,
  onSuccess,
}: {
  rpcStub: RpcStub<PublicApi>
  onSuccess?: () => void
}) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [error, setError] = useState<string | null>(null)
  // Read once on mount: the flag only changes from this component, and re-reading storage on every
  // render would fight the state update below.
  const [autoSignInSuppressed, setAutoSignInSuppressed] = useState(isClerkAutoSignInSuppressed)
  // Guard against re-entry: getToken()/loginWithClerk are async and this effect re-runs whenever
  // auth state changes, so without the ref one Clerk session could start several exchanges.
  const exchangingRef = useRef(false)

  // Suppression only guards a session that outlived the user's sign-out. Once there is no session
  // at all, whatever they sign in with next is a deliberate choice, so stop guarding — otherwise
  // signing in through the form below would land back on the "you're signed out" screen.
  useEffect(() => {
    if (isLoaded && !isSignedIn && autoSignInSuppressed) {
      allowClerkAutoSignIn()
      setAutoSignInSuppressed(false)
    }
  }, [isLoaded, isSignedIn, autoSignInSuppressed])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || autoSignInSuppressed || exchangingRef.current) return
    exchangingRef.current = true
    let cancelled = false
    ;(async () => {
      try {
        const clerkToken = await getToken()
        if (!clerkToken) throw new Error('Could not read the Clerk session token.')
        const token = await rpcStub.loginWithClerk(clerkToken)
        if (cancelled) return
        if (token) {
          localStorage.setItem('authToken', token)
          allowClerkAutoSignIn()
          if (onSuccess) {
            onSuccess()
          } else {
            window.location.reload()
          }
        } else {
          setError('New sign-ups are currently disabled on this deployment.')
        }
      } catch (err) {
        console.error('Clerk sign-in failed:', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.')
        }
      } finally {
        exchangingRef.current = false
      }
    })()
    return () => { cancelled = true }
  }, [isLoaded, isSignedIn, autoSignInSuppressed, getToken, rpcStub, onSuccess])

  if (!isLoaded) {
    return (
      <div className="flex justify-center py-8">
        <Loader size="lg" />
      </div>
    )
  }

  // Signed out here, but the Clerk session is still good: offer the one-click way back in rather
  // than taking it for them, and a way to leave that session entirely.
  if (isSignedIn && autoSignInSuppressed) {
    const label = user?.firstName || user?.username
      || user?.primaryEmailAddress?.emailAddress || null
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        {error && <Banner variant="error" title={error} />}
        <p className="text-sm text-kumo-subtle text-center">
          {label ? `You're signed out. Continue as ${label}?` : "You're signed out."}
        </p>
        <Button
          variant="primary"
          onClick={() => {
            allowClerkAutoSignIn()
            setAutoSignInSuppressed(false)
          }}
        >
          {label ? `Continue as ${label}` : 'Continue with AnyRouter'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            // Ending the shared Clerk session signs the user out of anyrouter.dev too, so it stays
            // an explicit choice. Keep the flag set: the sign-in form should follow, not another
            // automatic exchange.
            suppressClerkAutoSignIn()
            signOut().catch((err) => {
              console.error('Clerk sign-out failed:', err)
              setError('Could not sign out of AnyRouter. Try again.')
            })
          }}
        >
          Use a different account
        </Button>
      </div>
    )
  }

  // Signed in with Clerk — exchanging the session for a workshop token.
  if (isSignedIn) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {error ? (
          <Banner variant="error" title={error} />
        ) : (
          <>
            <Loader size="lg" />
            <p className="text-sm text-kumo-subtle">Signing you in…</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {error && <Banner variant="error" title={error} />}
      <SignIn routing="hash" />
    </div>
  )
}
