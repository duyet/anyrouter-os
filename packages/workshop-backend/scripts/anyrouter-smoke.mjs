#!/usr/bin/env node
/**
 * Live smoke for AnyRouter as an upstream model provider.
 *
 * Mirrors the production direct path in `getModelDirect` for provider
 * `anyrouter` (openai-completions against the OpenAI-compatible root):
 *   base:  https://anyrouter.dev/api/v1  (or ANYROUTER_BASE_URL)
 *   path:  /chat/completions
 *   auth:  Authorization: Bearer $ANYROUTER_API_KEY
 *   model: provider/model id (default z-ai/glm-5.2)
 *
 * Routing/auth assembly is unit-tested against the real `getModel` stream stack
 * in `__tests__/ai-models.test.ts`; this script only proves the live upstream
 * accepts the same contract.
 *
 * Env:
 *   ANYROUTER_API_KEY   required (prefix sk-ar-)
 *   ANYROUTER_MODEL     optional (default z-ai/glm-5.2)
 *   ANYROUTER_BASE_URL  optional (default https://anyrouter.dev/api/v1)
 *
 * Prints the assistant text on stdout. Exit 1 if the key is missing or the
 * model returns an error / empty reply.
 */

const apiKey = process.env.ANYROUTER_API_KEY;
const modelId = process.env.ANYROUTER_MODEL ?? "z-ai/glm-5.2";
const baseUrl = (process.env.ANYROUTER_BASE_URL ?? "https://anyrouter.dev/api/v1")
  .replace(/\/+$/, "");

if (!apiKey) {
  console.error(
    "anyrouter-smoke: ANYROUTER_API_KEY is not set. " +
    "Export a key from https://anyrouter.dev/dashboard (prefix sk-ar-).",
  );
  process.exit(1);
}

const url = `${baseUrl}/chat/completions`;
console.log(`anyrouter-smoke: POST ${url} model=${modelId}`);

const response = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: modelId,
    messages: [{ role: "user", content: "Reply with exactly: anyrouter-ok" }],
    max_tokens: 32,
  }),
});

const raw = await response.text();
if (!response.ok) {
  console.error(`anyrouter-smoke: HTTP ${response.status}: ${raw.slice(0, 500)}`);
  process.exit(1);
}

/** @type {{ choices?: { message?: { content?: string | null } }[] }} */
let body;
try {
  body = JSON.parse(raw);
} catch {
  console.error(`anyrouter-smoke: non-JSON response: ${raw.slice(0, 500)}`);
  process.exit(1);
}

const text = body.choices?.[0]?.message?.content?.trim() ?? "";
if (!text) {
  console.error("anyrouter-smoke: empty assistant response");
  console.error(raw.slice(0, 1000));
  process.exit(1);
}

console.log(text);
console.log("anyrouter-smoke: ok");
