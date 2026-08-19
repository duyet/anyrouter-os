// Configuration for sign-in via authentication gatekeepers (an optional, additive login feature).
//
// Authentication is provided by gatekeepers (e.g. "google", "github", "cloudflare") that advertise
// `providesAuth`. A deployment opts specific gatekeepers into the login UI via the AUTH_GATEKEEPERS
// allowlist (comma-separated vendor ids). When set, each listed, auth-capable gatekeeper gets a
// "Continue with ..." button alongside the normal username/password form (unless password auth is
// disabled). All OFF by default.

import { isClerkConfigured } from "./clerk.js";
import { getAnyRouterOauthClientId } from "../anyrouter-oauth.js";

/**
 * Parse the AUTH_GATEKEEPERS allowlist into a list of gatekeeper vendor ids (lowercased). These are
 * the gatekeepers permitted to drive sign-in; a vendor must also actually advertise `providesAuth`
 * to be offered. Empty when unset.
 */
export function getAuthGatekeeperAllowlist(env: Cloudflare.Env): string[] {
  const raw = (env as { AUTH_GATEKEEPERS?: string }).AUTH_GATEKEEPERS;
  if (!raw) return [];
  return raw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** Whether the deployment has opted any gatekeeper into sign-in. */
export function hasAuthGatekeepers(env: Cloudflare.Env): boolean {
  return getAuthGatekeeperAllowlist(env).length > 0;
}

/**
 * Whether "Sign in with AnyRouter" is the deployment's sign-in method. Opt in by setting
 * ANYROUTER_AUTH_ONLY=true together with ANYROUTER_OAUTH_CLIENT_ID: every user then authenticates
 * with their own anyrouter.dev account via OAuth, and that account is also the source of the
 * inference key, so sign-in and billing share one identity. When enabled it is the ONLY way in —
 * password, gatekeeper, and Clerk sign-in are all suppressed — mirroring how Clerk takes over when
 * configured. Off unless the client id is present, so a stray flag can't lock everyone out.
 */
export function isAnyRouterAuthEnabled(env: Cloudflare.Env): boolean {
  const only = (env as { ANYROUTER_AUTH_ONLY?: string }).ANYROUTER_AUTH_ONLY === "true";
  return only && !!getAnyRouterOauthClientId(env);
}

/**
 * Whether username/password login + signup is available. Enabled by default. Configuring Clerk
 * sign-in (CLERK_PUBLISHABLE_KEY) or AnyRouter-only sign-in (see isAnyRouterAuthEnabled) replaces
 * it entirely — that method becomes the only way in. Otherwise, an installation can set
 * DISABLE_PASSWORD_AUTH=true to be OAuth-only — but that only takes effect when at least one auth
 * gatekeeper is allowlisted, otherwise we'd lock everyone out, so password auth stays on.
 */
export function isPasswordAuthEnabled(env: Cloudflare.Env): boolean {
  if (isClerkConfigured(env)) return false;
  if (isAnyRouterAuthEnabled(env)) return false;
  if (env.DISABLE_PASSWORD_AUTH !== "true") return true;
  return !hasAuthGatekeepers(env);
}
