import { beforeEach, describe, expect, it } from "vitest";
import type { AiChatAuthorInfo } from "@gadgets/workshop-shared/api";
import { getModel, type ModelHandle } from "../src/ai-models.js";

// These tests exercise the real pi-ai stack: no module mocks. Routing decisions are asserted on
// the returned handle's model descriptor (baseUrl/id/api), and request-level behavior (URLs, auth
// headers) is asserted by driving `handle.stream` with an injected `options.fetch` stub. pi
// streams never reject; a stubbed 400 simply ends the stream with an error-stop message once the
// request has been captured.

const INITIATOR: AiChatAuthorInfo = {
  type: "user",
  id: "user-123",
  name: "User",
};

function env(): Cloudflare.Env {
  return {} as Cloudflare.Env;
}

type CapturedRequest = { url: string; headers: Headers; body: string };

const capturedRequests: CapturedRequest[] = [];

const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input as RequestInfo, init);
  capturedRequests.push({ url: request.url, headers: request.headers, body: await request.text() });
  // A non-retryable client error: the provider SDK reports it, pi converts it into an
  // error-stop assistant message, and the request stays captured for assertions.
  return Response.json({ error: { type: "bad_request", message: "stubbed" } }, { status: 400 });
}) as typeof fetch;

// Runs one request through the handle with the fetch stub and returns what was sent.
async function captureRequest(handle: ModelHandle): Promise<CapturedRequest> {
  const stream = await handle.stream(handle.model, {
    messages: [{ role: "user", content: "hello", timestamp: 0 }],
  }, { fetch: fetchStub, maxRetries: 0 });
  const message = await stream.result();
  expect(message.stopReason).toBe("error");
  expect(capturedRequests.length).toBeGreaterThan(0);
  return capturedRequests[0];
}

describe("getModel AnyRouter routing", () => {
  beforeEach(() => {
    capturedRequests.length = 0;
  });

  it("routes via openai-completions to the default base URL", async () => {
    const handle = getModel(env(), {
      provider: "anyrouter",
      model: "openai/gpt-5.4-mini",
      apiToken: "sk-ar-test-token",
    }, INITIATOR);

    expect(handle.model.api).toBe("openai-completions");
    expect(handle.model.id).toBe("openai/gpt-5.4-mini");
    expect(handle.model.provider).toBe("anyrouter");
    expect(handle.model.baseUrl).toBe("https://anyrouter.dev/api/v1");

    const request = await captureRequest(handle);
    expect(request.url).toBe("https://anyrouter.dev/api/v1/chat/completions");
    expect(request.headers.get("authorization")).toBe("Bearer sk-ar-test-token");
    const body = JSON.parse(request.body) as { model: string };
    expect(body.model).toBe("openai/gpt-5.4-mini");
  }, 15000);

  it("honors an apiUrl override and strips a trailing slash", async () => {
    const handle = getModel(env(), {
      provider: "anyrouter",
      model: "anthropic/claude-sonnet-4.6",
      apiToken: "sk-ar-override",
      apiUrl: "https://proxy.example.com/api/v1/",
    }, INITIATOR);

    expect(handle.model.baseUrl).toBe("https://proxy.example.com/api/v1");
    const request = await captureRequest(handle);
    expect(request.url).toBe("https://proxy.example.com/api/v1/chat/completions");
    expect(request.headers.get("authorization")).toBe("Bearer sk-ar-override");
  }, 15000);

  it("uses the suggested-model context window for compaction budgets", () => {
    // A SUGGESTED_MODELS entry declares the window; an unlisted model falls back to a
    // conservative default.
    const suggested = getModel(env(), {
      provider: "anyrouter",
      model: "z-ai/glm-5.2",
      apiToken: "sk-ar-test-token",
    }, INITIATOR);
    expect(suggested.model.contextWindow).toBe(1_000_000);

    const unknown = getModel(env(), {
      provider: "anyrouter",
      model: "someone/unknown-model",
      apiToken: "sk-ar-test-token",
    }, INITIATOR);
    expect(unknown.model.contextWindow).toBe(128_000);
  });
});
