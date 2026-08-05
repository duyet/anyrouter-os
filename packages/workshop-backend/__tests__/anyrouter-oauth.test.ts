import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAnyRouterSuggestedModelsCache,
  fetchAnyRouterSuggestedModels,
  pollAnyRouterDeviceLogin,
  startAnyRouterDeviceLogin,
} from "../src/anyrouter-oauth.js";

afterEach(() => {
  clearAnyRouterSuggestedModelsCache();
  vi.unstubAllGlobals();
});

describe("startAnyRouterDeviceLogin", () => {
  it("maps the device-code response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({
        device_code: "dc-1",
        user_code: "ABCD-EFGH",
        verification_uri: "https://anyrouter.dev/cli/device",
        verification_uri_complete: "https://anyrouter.dev/cli/device?code=ABCD-EFGH",
        expires_in: 600,
        interval: 5,
      })));

    const start = await startAnyRouterDeviceLogin({ clientName: "Test" });
    expect(start.deviceCode).toBe("dc-1");
    expect(start.userCode).toBe("ABCD-EFGH");
    expect(start.verificationUriComplete).toContain("ABCD-EFGH");
    expect(start.interval).toBe(5);

    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("https://anyrouter.dev/api/v1/oauth/device/code");
    const body = JSON.parse(call[1].body as string);
    expect(body.client_name).toBe("Test");
  });
});

describe("pollAnyRouterDeviceLogin", () => {
  it("returns ready with the access token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({
        access_token: "sk-ar-v1-secret",
        token_type: "Bearer",
        scope: "inference",
        user_id: "user_1",
      })));

    const poll = await pollAnyRouterDeviceLogin("dc-1");
    expect(poll).toEqual({
      status: "ready",
      accessToken: "sk-ar-v1-secret",
      scope: "inference",
      userId: "user_1",
    });
  });

  it("maps authorization_pending and slow_down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ error: "authorization_pending" }, { status: 400 })));
    expect(await pollAnyRouterDeviceLogin("dc")).toEqual({
      status: "pending",
      interval: 5,
    });

    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ error: "slow_down", interval: 10 }, { status: 400 })));
    expect(await pollAnyRouterDeviceLogin("dc")).toEqual({
      status: "slow_down",
      interval: 10,
    });
  });

  it("maps denied and expired", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ error: "access_denied", error_description: "nope" }, { status: 400 })));
    expect(await pollAnyRouterDeviceLogin("dc")).toMatchObject({
      status: "denied",
      message: "nope",
    });

    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ error: "expired_token" }, { status: 400 })));
    expect(await pollAnyRouterDeviceLogin("dc")).toMatchObject({ status: "expired" });
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
