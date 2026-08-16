// Whether the Clerk session may be exchanged for a workshop session automatically.
//
// This deployment shares anyrouter.dev's Clerk instance, so arriving with an existing Clerk session
// signs the user in with nothing to type — good on arrival, but it also meant "Sign out" did
// nothing: clearing the workshop token dropped the user on the sign-in page, where the bridge saw
// the still-valid Clerk session and signed them back in before they could read the screen.
//
// Signing out therefore records that the user asked to leave. The Clerk session itself is left
// alone — it belongs to anyrouter.dev as much as to this app, so ending it is offered as a separate
// choice ("Use a different account") rather than done on their behalf.

const SUPPRESSED_KEY = 'clerkAutoSignInSuppressed'

/** True when the user signed out here, so the Clerk session must not sign them straight back in. */
export function isClerkAutoSignInSuppressed(): boolean {
  try {
    return localStorage.getItem(SUPPRESSED_KEY) === '1'
  } catch {
    // Private-mode storage failures shouldn't strand anyone on the sign-in page.
    return false
  }
}

/** Record that the user signed out, suppressing the automatic Clerk exchange until they return. */
export function suppressClerkAutoSignIn(): void {
  try {
    localStorage.setItem(SUPPRESSED_KEY, '1')
  } catch {
    // Best-effort: without storage the session bridge just behaves as it did before.
  }
}

/** Clear the suppression — the user explicitly chose to sign in again. */
export function allowClerkAutoSignIn(): void {
  try {
    localStorage.removeItem(SUPPRESSED_KEY)
  } catch {
    // Ignore: the flag defaults to "not suppressed" when storage is unavailable.
  }
}
