/**
 * AnyRouter OAuth-client + catalog helpers.
 *
 * AnyRouter OS is a registered "Sign in with AnyRouter" OAuth client of
 * anyrouter.dev: the browser sends the user through the authorize/consent flow
 * (PKCE S256, public client, no secret), and the backend exchanges the returned
 * code for an `sk-ar-…` key scoped to the USER's own AnyRouter account
 * (inference-only, expiring). Browser clients cannot call anyrouter.dev
 * directly (no CORS), so the token exchange is proxied here.
 *
 * The deployment's client id comes from ANYROUTER_OAUTH_CLIENT_ID, obtained
 * once via AnyRouter's open dynamic client registration (see
 * deploy/anyrouter-os.md).
 *
 * Docs: https://anyrouter.dev/docs/guides/sign-in-with-anyrouter.md
 *       https://anyrouter.dev/docs/api-reference/network-stats.md
 */

export const ANYROUTER_API_BASE = "https://anyrouter.dev/api/v1";

/** The authorize endpoint the browser sends the user to (with PKCE params). */
export const ANYROUTER_AUTHORIZE_URL = `${ANYROUTER_API_BASE}/mcp/oauth/authorize`;

const ANYROUTER_TOKEN_URL = `${ANYROUTER_API_BASE}/mcp/oauth/token`;

type OauthClientEnv = { ANYROUTER_OAUTH_CLIENT_ID?: string };

/**
 * The deployment's registered AnyRouter OAuth client id (public, like the Clerk
 * publishable key), or undefined when not configured.
 */
export function getAnyRouterOauthClientId(env: Cloudflare.Env): string | undefined {
  return (env as OauthClientEnv).ANYROUTER_OAUTH_CLIENT_ID || undefined;
}

/** Result of a successful authorization-code exchange. */
export type AnyRouterGrant = {
  /** The user's `sk-ar-…` key (inference-scoped, billed to their account). */
  apiToken: string;
  /** When the key expires (sign-in keys always do), or null when not reported. */
  expiresAt: string | null;
};

/**
 * Exchange an authorization code (+ PKCE verifier) for the user's AnyRouter
 * key. The code was obtained by the browser via the authorize/consent flow;
 * `redirectUri` must match the one used there (and the registered allowlist).
 */
export async function exchangeAnyRouterOAuthCode(
  env: Cloudflare.Env,
  params: { code: string; codeVerifier: string; redirectUri: string },
): Promise<AnyRouterGrant> {
  const clientId = getAnyRouterOauthClientId(env);
  if (!clientId) {
    throw new Error(
        "ANYROUTER_OAUTH_CLIENT_ID is not configured, so this deployment can't complete " +
        "AnyRouter sign-in. Register the app and set the var (see deploy/anyrouter-os.md).");
  }
  const res = await fetch(ANYROUTER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
      client_id: clientId,
    }),
  });
  const text = await res.text();
  let data: {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`AnyRouter token exchange returned an invalid response (${res.status}).`);
  }
  if (!res.ok || !data.access_token) {
    throw new Error(
        data.error_description
        ?? (data.error ? `AnyRouter token exchange failed: ${data.error}` : undefined)
        ?? `AnyRouter token exchange failed (${res.status}).`);
  }
  return {
    apiToken: data.access_token,
    expiresAt: typeof data.expires_in === "number"
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

/** The signed-in user's AnyRouter account, as reported by `/me`. Any field may be absent. */
export type AnyRouterProfile = {
  id: string | null;
  username: string | null;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

type MeResponse = {
  id?: string | null;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  image_url?: string | null;
};

/**
 * Fetch the signed-in user's AnyRouter account profile with their own `sk-ar-…` key. The
 * `read:profile` scope granted by "Sign in with AnyRouter" already covers this endpoint, so no
 * extra consent is needed.
 */
export async function fetchAnyRouterProfile(apiToken: string): Promise<AnyRouterProfile> {
  const res = await fetch(`${ANYROUTER_API_BASE}/me`, {
    headers: { Authorization: `Bearer ${apiToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    // A rejected key is the user's problem to fix (approve again); anything else is transient.
    if (res.status === 401 || res.status === 403) {
      throw new Error(
          "AnyRouter rejected the stored key — it was revoked or has expired. " +
          "Approve access again to reconnect.");
    }
    throw new Error(`AnyRouter profile request failed (${res.status}).`);
  }
  const data = await res.json() as MeResponse;
  return {
    id: data.id ?? null,
    username: data.username ?? null,
    name: data.name ?? null,
    email: data.email ?? null,
    avatarUrl: data.image_url ?? null,
  };
}

/**
 * The stable key identifying an AnyRouter account, used to key the user DO (via idFromName) when
 * "Sign in with AnyRouter" is the deployment's login method. Prefers the account's email so that
 * ADMINS (matched by email) and the other email-keyed sign-in paths (Clerk, gatekeepers, CF Access)
 * stay consistent; falls back to the opaque account id when AnyRouter reports no email. Throws when
 * neither is present, since an account with no stable identity can't own a session.
 */
export function anyRouterAccountKey(profile: AnyRouterProfile): string {
  if (profile.email) return profile.email;
  if (profile.id) return `anyrouter:${profile.id}`;
  throw new Error("AnyRouter did not return an account identity (no email or id), so sign-in " +
      "can't establish who you are. Try again.");
}

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
// Keep in sync with SUGGESTED_MODELS.anyrouter in workshop-shared.
const FALLBACK_SUGGESTED: AnyRouterSuggestedModel[] = [
  { id: "z-ai/glm-5.2", name: "GLM-5.2 (AnyRouter)", contextWindow: 1_000_000 },
  { id: "moonshotai/kimi-k3", name: "Kimi K3 (AnyRouter)", contextWindow: 1_048_576 },
  { id: "stepfun-ai/step-3.7-flash", name: "Step 3.7 Flash (AnyRouter)", contextWindow: 128_000 },
  { id: "meituan/longcat-2.0", name: "LongCat-2.0 (AnyRouter)", contextWindow: 1_048_576 },
];

let suggestedCache: { at: number; models: AnyRouterSuggestedModel[] } | null = null;
const SUGGESTED_TTL_MS = 10 * 60 * 1000;

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
