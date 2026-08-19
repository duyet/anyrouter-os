import { describe, expect, it } from "vitest";
import { isAnyRouterAuthEnabled, isPasswordAuthEnabled } from "../src/auth/config.js";

function env(vars: Record<string, unknown>): Cloudflare.Env {
  return vars as unknown as Cloudflare.Env;
}

describe("isAnyRouterAuthEnabled", () => {
  it("is on only when the flag and the client id are both present", () => {
    expect(isAnyRouterAuthEnabled(
        env({ ANYROUTER_AUTH_ONLY: "true", ANYROUTER_OAUTH_CLIENT_ID: "anyrouter-os" }))).toBe(true);
  });

  it("stays off with the flag but no client id (so a stray flag can't lock everyone out)", () => {
    expect(isAnyRouterAuthEnabled(env({ ANYROUTER_AUTH_ONLY: "true" }))).toBe(false);
  });

  it("stays off with a client id but no flag (AnyRouter is then only a post-login connect)", () => {
    expect(isAnyRouterAuthEnabled(env({ ANYROUTER_OAUTH_CLIENT_ID: "anyrouter-os" }))).toBe(false);
  });

  it("is off by default", () => {
    expect(isAnyRouterAuthEnabled(env({}))).toBe(false);
  });
});

describe("isPasswordAuthEnabled", () => {
  it("is on by default", () => {
    expect(isPasswordAuthEnabled(env({}))).toBe(true);
  });

  it("is off when AnyRouter is the sole sign-in method", () => {
    expect(isPasswordAuthEnabled(
        env({ ANYROUTER_AUTH_ONLY: "true", ANYROUTER_OAUTH_CLIENT_ID: "anyrouter-os" }))).toBe(false);
  });

  it("is off when Clerk sign-in is configured", () => {
    expect(isPasswordAuthEnabled(env({ CLERK_PUBLISHABLE_KEY: "pk_test_abc" }))).toBe(false);
  });

  it("stays on with DISABLE_PASSWORD_AUTH but no auth gatekeeper (avoids lockout)", () => {
    expect(isPasswordAuthEnabled(env({ DISABLE_PASSWORD_AUTH: "true" }))).toBe(true);
  });

  it("is off with DISABLE_PASSWORD_AUTH once an auth gatekeeper is allowlisted", () => {
    expect(isPasswordAuthEnabled(
        env({ DISABLE_PASSWORD_AUTH: "true", AUTH_GATEKEEPERS: "google" }))).toBe(false);
  });
});
