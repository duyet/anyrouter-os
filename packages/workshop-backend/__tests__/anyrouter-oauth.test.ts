import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAnyRouterSuggestedModelsCache,
  exchangeAnyRouterOAuthCode,
  fetchAnyRouterSuggestedModels,
} from "../src/anyrouter-oauth.js";

afterEach(() => {
  clearAnyRouterSuggestedModelsCache();
  vi.unstubAllGlobals();
});

function env(clientId?: string): Cloudflare.Env {
  return { ANYROUTER_OAUTH_CLIENT_ID: clientId } as unknown as Cloudflare.Env;
}

describe("exchangeAnyRouterOAuthCode", () => {
  const PARAMS = {
    code: "authcode-1",
    codeVerifier: "v".repeat(43),
    redirectUri: "https://os.anyrouter.dev/anyrouter/oauth/callback",
  };

  it("exchanges a code for the user's key and computes the expiry", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({
        access_token: "sk-ar-v1-secret",
        token_type: "Bearer",
        scope: "inference read:profile",
        expires_in: 3600,
      })));

    const before = Date.now();
    const grant = await exchangeAnyRouterOAuthCode(env("client-1"), PARAMS);
    expect(grant.apiToken).toBe("sk-ar-v1-secret");
    expect(Date.parse(grant.expiresAt!)).toBeGreaterThanOrEqual(before + 3600 * 1000 - 5000);

    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://anyrouter.dev/api/v1/mcp/oauth/token");
    const body = JSON.parse(call[1].body as string);
    expect(body).toMatchObject({
      grant_type: "authorization_code",
      code: "authcode-1",
      code_verifier: PARAMS.codeVerifier,
      redirect_uri: PARAMS.redirectUri,
      client_id: "client-1",
    });
  });

  it("reports no expiry when the response omits expires_in", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ access_token: "sk-ar-v1-secret", token_type: "Bearer" })));
    const grant = await exchangeAnyRouterOAuthCode(env("client-1"), PARAMS);
    expect(grant.expiresAt).toBeNull();
  });

  it("surfaces OAuth errors with their description", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json(
        { error: "invalid_grant", error_description: "Code expired or used" },
        { status: 400 })));
    await expect(exchangeAnyRouterOAuthCode(env("client-1"), PARAMS))
      .rejects.toThrow("Code expired or used");
  });

  it("fails clearly when the client id is not configured", async () => {
    await expect(exchangeAnyRouterOAuthCode(env(undefined), PARAMS))
      .rejects.toThrow("ANYROUTER_OAUTH_CLIENT_ID");
  });
});

describe("fetchAnyRouterSuggestedModels", () => {
  it("ranks network top models and joins catalog context windows", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/analytics/network")) {
        return Response.json({
          top_models: [
            { model_id: "z-ai/glm-5.2", model_name: "GLM-5.2", rank: 1 },
            { model_id: "anthropic/claude-sonnet-4.6", model_name: "Claude Sonnet 4.6", rank: 2 },
          ],
        });
      }
      if (url.includes("/models")) {
        return Response.json({
          data: [
            { id: "z-ai/glm-5.2", name: "GLM-5.2", context_length: 200000 },
            { id: "anthropic/claude-sonnet-4.6", context_length: 200000 },
          ],
        });
      }
      return new Response("not found", { status: 404 });
    }));

    const models = await fetchAnyRouterSuggestedModels(5);
    expect(models).toEqual([
      { id: "z-ai/glm-5.2", name: "GLM-5.2", contextWindow: 200000, rank: 1 },
      {
        id: "anthropic/claude-sonnet-4.6",
        name: "Claude Sonnet 4.6",
        contextWindow: 200000,
        rank: 2,
      },
    ]);
  });

  it("falls back when the network stats endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    const models = await fetchAnyRouterSuggestedModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toContain("/");
  });
});
