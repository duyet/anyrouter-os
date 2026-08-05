/**
 * AnyRouter public OAuth device-flow + catalog helpers.
 *
 * Device authorization (RFC 8628) lets the Workshop UI open AnyRouter's consent
 * page so the user can pick an existing key or mint a new one; the secret is
 * delivered once as `access_token`. Browser clients cannot call anyrouter.dev
 * directly (no CORS), so the Workshop backend proxies these public endpoints.
 *
 * Docs: https://anyrouter.dev/docs/api-reference/oauth.md
 *       https://anyrouter.dev/docs/api-reference/network-stats.md
 */

export const ANYROUTER_API_BASE = "https://anyrouter.dev/api/v1";

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

/** Result of starting an AnyRouter device authorization. */
export type AnyRouterDeviceLoginStart = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
};

/** One poll of an in-flight device login. */
export type AnyRouterDeviceLoginPoll =
  | { status: "pending"; interval: number }
  | { status: "slow_down"; interval: number }
  | { status: "denied"; message: string }
  | { status: "expired"; message: string }
  | { status: "ready"; accessToken: string; scope?: string; userId?: string }
  | { status: "error"; message: string };

/** A suggested AnyRouter model for the Add Model picker. */
export type AnyRouterSuggestedModel = {
  id: string;
  name: string;
  contextWindow: number;
  rank?: number;
};

type NetworkStatsResponse = {
  top_models?: Array<{
    model_id?: string;
    model_name?: string;
    rank?: number;
    tokens?: number;
    requests?: number;
  }>;
};

type ModelsListResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    context_length?: number;
    category?: string;
  }>;
};

// Fallback when the live network stats endpoint is unreachable.
const FALLBACK_SUGGESTED: AnyRouterSuggestedModel[] = [
  { id: "openai/gpt-5.4-mini", name: "GPT 5.4 Mini (AnyRouter)", contextWindow: 128_000 },
  { id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6 (AnyRouter)", contextWindow: 200_000 },
];

let suggestedCache: { at: number; models: AnyRouterSuggestedModel[] } | null = null;
const SUGGESTED_TTL_MS = 10 * 60 * 1000;

/**
 * Start an AnyRouter device-code login. The user opens `verificationUriComplete`
 * and either picks an existing API key or creates a new one on the consent page.
 */
export async function startAnyRouterDeviceLogin(options: {
  clientName?: string;
  keyLabel?: string;
  /** Space-separated scopes. Defaults to inference (enough to run chat models). */
  scope?: string;
} = {}): Promise<AnyRouterDeviceLoginStart> {
  const body = {
    client_name: options.clientName ?? "Cloudflare OS",
    key_label: options.keyLabel ?? "Cloudflare OS",
    // Consent UI still lets the user narrow scopes; inference is the minimum we need.
    scope: options.scope ?? "inference",
  };
  const res = await fetch(`${ANYROUTER_API_BASE}/oauth/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`AnyRouter device login failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text) as {
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    verification_uri_complete?: string;
    expires_in?: number;
    interval?: number;
  };
  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error("AnyRouter device login returned an incomplete response.");
  }
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    verificationUriComplete: data.verification_uri_complete
      ?? `${data.verification_uri}?code=${encodeURIComponent(data.user_code)}`,
    expiresIn: data.expires_in ?? 600,
    interval: data.interval ?? 5,
  };
}

/**
 * Poll AnyRouter for completion of a device-code login started by
 * {@link startAnyRouterDeviceLogin}.
 */
export async function pollAnyRouterDeviceLogin(
  deviceCode: string,
): Promise<AnyRouterDeviceLoginPoll> {
  const res = await fetch(`${ANYROUTER_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: DEVICE_GRANT,
      device_code: deviceCode,
    }),
  });
  const text = await res.text();
  let data: {
    access_token?: string;
    scope?: string;
    user_id?: string;
    error?: string;
    error_description?: string;
    interval?: number;
  } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return { status: "error", message: `Invalid response from AnyRouter (${res.status})` };
  }

  if (res.ok && data.access_token) {
    return {
      status: "ready",
      accessToken: data.access_token,
      scope: data.scope,
      userId: data.user_id,
    };
  }

  const err = data.error ?? "error";
  const interval = data.interval ?? 5;
  switch (err) {
    case "authorization_pending":
      return { status: "pending", interval };
    case "slow_down":
      return { status: "slow_down", interval: data.interval ?? interval + 5 };
    case "access_denied":
      return {
        status: "denied",
        message: data.error_description ?? "Authorization was denied.",
      };
    case "expired_token":
      return {
        status: "expired",
        message: data.error_description
          ?? "The login code expired or was already used. Start again.",
      };
    default:
      return {
        status: "error",
        message: data.error_description ?? `AnyRouter login error: ${err}`,
      };
  }
}

/**
 * Live top models by network-wide token usage (public analytics), enriched with
 * catalog context windows when available. Falls back to a short static list.
 */
export async function fetchAnyRouterSuggestedModels(
  limit = 12,
): Promise<AnyRouterSuggestedModel[]> {
  if (suggestedCache && Date.now() - suggestedCache.at < SUGGESTED_TTL_MS) {
    return suggestedCache.models.slice(0, limit);
  }

  try {
    const [statsRes, modelsRes] = await Promise.all([
      fetch(`${ANYROUTER_API_BASE}/analytics/network`, {
        headers: { Accept: "application/json" },
      }),
      fetch(`${ANYROUTER_API_BASE}/models`, {
        headers: { Accept: "application/json" },
      }),
    ]);

    if (!statsRes.ok) {
      return FALLBACK_SUGGESTED.slice(0, limit);
    }

    const stats = await statsRes.json() as NetworkStatsResponse;
    const catalog = modelsRes.ok
      ? await modelsRes.json() as ModelsListResponse
      : { data: [] };

    const byId = new Map<string, { name?: string; context_length?: number }>();
    for (const m of catalog.data ?? []) {
      if (m.id) byId.set(m.id, m);
    }

    const models: AnyRouterSuggestedModel[] = [];
    for (const row of stats.top_models ?? []) {
      const id = row.model_id?.trim();
      if (!id) continue;
      // Virtual routers without a concrete model slug are still valid, but prefer
      // provider/model ids that users can call for chat.
      const cat = byId.get(id);
      models.push({
        id,
        name: row.model_name?.trim()
          || cat?.name
          || id,
        contextWindow: cat?.context_length && cat.context_length > 0
          ? cat.context_length
          : 128_000,
        rank: row.rank,
      });
      if (models.length >= limit) break;
    }

    if (models.length === 0) {
      return FALLBACK_SUGGESTED.slice(0, limit);
    }

    suggestedCache = { at: Date.now(), models };
    return models;
  } catch {
    return FALLBACK_SUGGESTED.slice(0, limit);
  }
}

/** Reset the in-memory catalog cache (tests). */
export function clearAnyRouterSuggestedModelsCache(): void {
  suggestedCache = null;
}
