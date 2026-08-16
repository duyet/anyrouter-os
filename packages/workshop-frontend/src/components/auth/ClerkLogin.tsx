import { useEffect, useRef, useState } from 'react'
import { RpcStub } from 'capnweb'
import { PublicApi } from '@gadgets/workshop-shared/api'
import { ClerkProvider, SignIn, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { Banner, Loader } from '@cloudflare/kumo'

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
  const [error, setError] = useState<string | null>(null)
  // Guard against re-entry: getToken()/loginWithClerk are async and this effect re-runs whenever
  // auth state changes, so without the ref one Clerk session could start several exchanges.
  const exchangingRef = useRef(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || exchangingRef.current) return
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
  }, [isLoaded, isSignedIn, getToken, rpcStub, onSuccess])

  if (!isLoaded) {
    return (
      <div className="flex justify-center py-8">
        <Loader size="lg" />
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
