// Sign-in via Clerk (https://clerk.com), shared with the anyrouter.dev dashboard.
//
// The deployment opts in by setting CLERK_PUBLISHABLE_KEY (pk_live_… / pk_test_…, safe to publish).
// The frontend loads Clerk with that key and hands the resulting session JWT to
// PublicApi.loginWithClerk(), which verifies it here against the instance's JWKS and resolves the
// user's verified email. Because the key is the same Clerk instance anyrouter.dev uses, anyone with
// an anyrouter.dev account can sign in.
//
// The default Clerk session token doesn't carry the email claim, so resolving the email requires
// the Clerk Backend API and CLERK_SECRET_KEY (sk_…, a wrangler secret). Deployments that configure
// a Clerk JWT template adding an "email" claim don't need the secret.

import { createRemoteJWKSet, jwtVerify } from "jose";

type ClerkEnv = {
  CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
};

/** Whether this deployment offers Clerk sign-in. */
export function isClerkConfigured(env: Cloudflare.Env): boolean {
  return !!(env as ClerkEnv).CLERK_PUBLISHABLE_KEY;
}

/** The deployment's Clerk publishable key, or undefined when Clerk sign-in is not configured. */
export function getClerkPublishableKey(env: Cloudflare.Env): string | undefined {
  return (env as ClerkEnv).CLERK_PUBLISHABLE_KEY || undefined;
}

/**
 * The Clerk Frontend API origin encoded in a publishable key
 * (e.g. pk_live_<base64("clerk.anyrouter.dev$")> -> https://clerk.anyrouter.dev).
 */
export function clerkFrontendApi(publishableKey: string): string {
  const encoded = publishableKey.replace(/^pk_(live|test)_/, "");
  let domain: string;
  try {
    domain = atob(encoded).replace(/\$$/, "");
  } catch {
    throw new Error("CLERK_PUBLISHABLE_KEY is not a valid Clerk publishable key.");
  }
  if (!domain) {
    throw new Error("CLERK_PUBLISHABLE_KEY is not a valid Clerk publishable key.");
  }
  return `https://${domain}`;
}

// JWKS fetcher, cached per isolate. jose's remote JWK set caches keys internally, so verifying a
// login does not refetch the JWKS every time.
let jwksCache: { frontendApi: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null;

function jwksFor(frontendApi: string) {
  if (jwksCache?.frontendApi !== frontendApi) {
    jwksCache = {
      frontendApi,
      jwks: createRemoteJWKSet(new URL(`${frontendApi}/.well-known/jwks.json`)),
    };
  }
  return jwksCache.jwks;
}

/**
 * Verify a Clerk session JWT and return the account's verified email (which keys the user DO,
 * like every other sign-in path). Throws when Clerk sign-in isn't configured, the token doesn't
 * verify, or the email can't be resolved.
 */
export async function verifyClerkLogin(env: Cloudflare.Env, sessionToken: string): Promise<string> {
  const publishableKey = getClerkPublishableKey(env);
  if (!publishableKey) {
    throw new Error("Clerk sign-in is not configured on this deployment.");
  }
  const frontendApi = clerkFrontendApi(publishableKey);

  const { payload } = await jwtVerify(sessionToken, jwksFor(frontendApi), {
    issuer: frontendApi,
  });

  // A JWT-template claim, when the instance is configured to include one.
  if (typeof payload.email === "string" && payload.email) {
    return payload.email;
  }

  const userId = payload.sub;
  if (!userId) {
    throw new Error("Clerk session token has no subject.");
  }
  const secretKey = (env as ClerkEnv).CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
        "CLERK_SECRET_KEY is not configured, and the session token carries no email claim. " +
        "Set the secret (wrangler secret put CLERK_SECRET_KEY) or add an email claim to the " +
        "instance's session token.");
  }

  const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Clerk user lookup failed (${res.status}).`);
  }
  const user = await res.json() as {
    primary_email_address_id?: string;
    email_addresses?: Array<{ id?: string; email_address?: string }>;
  };
  const primary = user.email_addresses?.find(e => e.id === user.primary_email_address_id)
      ?? user.email_addresses?.[0];
  const email = primary?.email_address;
  if (!email) {
    throw new Error("This Clerk account has no email address, so it can't be used to sign in.");
  }
  return email;
}
